from rest_framework.throttling import AnonRateThrottle
import requests as http_requests
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.utils import timezone
from .models import (
    User, Batch, BatchEnrollment, SkillCategory,
    Assessment, Question, AnswerChoice,
    StudentResponse, SkillScore,
    Company, Position, PositionRequirement, Recommendation,
)
from .serializers import UserSerializer


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


# ════════════════════════════════════════════════════════════════════════════
# AUTH
# ════════════════════════════════════════════════════════════════════════════

# ── POST /api/auth/login/ ─────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    throttle = LoginRateThrottle()
    if not throttle.allow_request(request, None):
        return Response(
            {'error': 'Too many login attempts. Please wait a minute and try again.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )

    email    = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')

    if not email or not password:
        return Response(
            {'error': 'Email and password are required.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(request, username=email, password=password)

    if user is None:
        return Response(
            {'error': 'Invalid credentials.'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    # Block instructors who haven't been approved yet
    if user.role == 'instructor' and not user.is_approved:
        return Response(
            {'error': 'pending'},
            status=status.HTTP_403_FORBIDDEN
        )

    refresh = RefreshToken.for_user(user)
    return Response({
        'access':  str(refresh.access_token),
        'refresh': str(refresh),
        'user':    UserSerializer(user).data,
    })


# ── POST /api/auth/refresh/ ───────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def refresh(request):
    token = request.data.get('refresh')
    if not token:
        return Response({'error': 'Refresh token required.'}, status=400)
    try:
        r = RefreshToken(token)
        return Response({'access': str(r.access_token)})
    except Exception:
        return Response({'error': 'Invalid or expired token.'}, status=401)


# ── GET /api/auth/me/ ─────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)


# ── POST /api/auth/google/ ────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def google_login(request):
    access_token = request.data.get('token')
    if not access_token:
        return Response({'error': 'No token provided'}, status=status.HTTP_400_BAD_REQUEST)

    google_response = http_requests.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        headers={'Authorization': f'Bearer {access_token}'}
    )

    if google_response.status_code != 200:
        return Response({'error': 'Invalid token'}, status=status.HTTP_401_UNAUTHORIZED)

    idinfo    = google_response.json()
    email     = idinfo.get('email', '')
    name      = idinfo.get('name', '')
    photo_url = idinfo.get('picture', '')

    if not email.endswith('@dnsc.edu.ph'):
        return Response({'error': 'not_dnsc'}, status=status.HTTP_403_FORBIDDEN)

    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            'name':        name,
            'role':        'student',
            'photo_url':   photo_url,
            'is_approved': True,
            'is_active':   True,
        }
    )

    if not created:
        user.name      = name
        user.photo_url = photo_url
        user.save(update_fields=['name', 'photo_url'])

    refresh = RefreshToken.for_user(user)
    return Response({
        'access':  str(refresh.access_token),
        'refresh': str(refresh),
        'user':    UserSerializer(user).data,
    })


# ════════════════════════════════════════════════════════════════════════════
# STUDENT
# ════════════════════════════════════════════════════════════════════════════

# ── PATCH /api/students/me/profile/ ──────────────────────────────
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def student_profile(request):
    user = request.user
    if user.role != 'student':
        return Response({'error': 'Not a student'}, status=status.HTTP_403_FORBIDDEN)

    address = {
        'stayingAt':     request.data.get('stayingAt', ''),
        'travelWilling': request.data.get('travelWilling', ''),
        'home': {
            'province': request.data.get('homeProvince', ''),
            'city':     request.data.get('homeCity', ''),
            'barangay': request.data.get('homeBarangay', ''),
        },
        'boarding': {
            'province': request.data.get('boardingProvince', ''),
            'city':     request.data.get('boardingCity', ''),
            'barangay': request.data.get('boardingBarangay', ''),
        },
        'pinLat': request.data.get('pinLat'),
        'pinLng': request.data.get('pinLng'),
    }

    user.school_id = request.data.get('studentId', user.school_id)
    user.course    = request.data.get('course',    user.course)
    user.phone     = request.data.get('phone',     user.phone)
    user.address   = address
    user.save(update_fields=['school_id', 'course', 'phone', 'address'])

    return Response(UserSerializer(user).data)


# ── GET /api/students/me/ ─────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_me(request):
    user = request.user
    if user.role != 'student':
        return Response({'error': 'Not a student'}, status=status.HTTP_403_FORBIDDEN)

    # Get the student's current active batch enrollment
    enrollment = (
        BatchEnrollment.objects
        .filter(student=user, batch__status='active')
        .select_related('batch')
        .first()
    )

    active_assessment = None
    if enrollment:
        try:
            assessment = Assessment.objects.get(
                batch=enrollment.batch,
                is_active=True
            )
            active_assessment = {
                'id':               assessment.id,
                'title':            assessment.title,
                'duration_minutes': assessment.duration_minutes,
            }
        except Assessment.DoesNotExist:
            pass

    # Check submission status
    latest_response = (
        StudentResponse.objects
        .filter(student=user)
        .order_by('-submitted_at')
        .first()
    )

    has_submitted  = latest_response is not None and latest_response.submitted_at is not None
    retake_allowed = latest_response.retake_allowed if latest_response else False

    return Response({
        **UserSerializer(user).data,
        'has_submitted':      has_submitted,
        'retake_allowed':     retake_allowed,
        'active_assessment':  active_assessment,
        'batch':              {
            'id':   enrollment.batch.id,
            'name': enrollment.batch.name,
        } if enrollment else None,
    })


# ════════════════════════════════════════════════════════════════════════════
# SKILL CATEGORIES  (shared: instructor + admin)
# ════════════════════════════════════════════════════════════════════════════

# ── GET /api/categories/   POST /api/categories/ ─────────────────
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def categories(request):
    if request.method == 'GET':
        cats = SkillCategory.objects.all().order_by('name')
        return Response([{'id': c.id, 'name': c.name, 'description': c.description} for c in cats])

    # POST — create new category (instructor or admin only)
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)

    name = request.data.get('name', '').strip()
    if not name:
        return Response({'error': 'name is required'}, status=400)

    cat, created = SkillCategory.objects.get_or_create(
        name__iexact=name,
        defaults={'name': name, 'description': request.data.get('description', ''), 'created_by': request.user}
    )
    return Response(
        {'id': cat.id, 'name': cat.name, 'created': created},
        status=201 if created else 200
    )


# ── POST /api/categories/suggest/ ────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def suggest_category_view(request):
    """
    NLP Touchpoint 1: TF-IDF category suggestion.
    Body: { "question_text": "..." }
    Returns: { "suggested_category": "Database" } or null
    """
    from .scoring import suggest_category
    question_text = request.data.get('question_text', '').strip()
    if not question_text:
        return Response({'suggested_category': None})

    cats = list(SkillCategory.objects.all())
    suggestion = suggest_category(question_text, cats)
    return Response({'suggested_category': suggestion})


# ════════════════════════════════════════════════════════════════════════════
# INSTRUCTOR — Batches
# ════════════════════════════════════════════════════════════════════════════

# ── GET /api/instructor/batches/   POST /api/instructor/batches/ ─
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def instructor_batches(request):
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)

    if request.method == 'GET':
        batches = Batch.objects.filter(instructor=request.user).order_by('-created_at')
        return Response([{
            'id':          b.id,
            'name':        b.name,
            'status':      b.status,
            'created_at':  b.created_at,
            'student_count': b.enrollments.count(),
        } for b in batches])

    # POST — create batch
    name = request.data.get('name', '').strip()
    if not name:
        return Response({'error': 'name is required'}, status=400)

    batch = Batch.objects.create(name=name, instructor=request.user)
    return Response({'id': batch.id, 'name': batch.name, 'status': batch.status}, status=201)


# ── POST /api/instructor/batches/{id}/enroll/ ────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def instructor_batch_enroll(request, batch_id):
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)

    try:
        batch = Batch.objects.get(id=batch_id, instructor=request.user)
    except Batch.DoesNotExist:
        return Response({'error': 'Batch not found'}, status=404)

    students_data = request.data.get('students', [])
    # Each item: { email, name }
    enrolled = []
    errors   = []

    for item in students_data:
        email = item.get('email', '').strip().lower()
        name  = item.get('name',  '').strip()
        if not email:
            errors.append({'email': email, 'error': 'email required'})
            continue

        try:
            student = User.objects.get(email=email, role='student')
        except User.DoesNotExist:
            # Auto-create student account (will log in via Google)
            student = User.objects.create(
                email=email,
                name=name or email.split('@')[0],
                role='student',
                is_approved=True,
                is_active=True,
            )
            student.set_unusable_password()
            student.save()

        _, created = BatchEnrollment.objects.get_or_create(batch=batch, student=student)
        enrolled.append({'email': email, 'name': student.name, 'created': created})

    return Response({'enrolled': enrolled, 'errors': errors}, status=200)


# ── GET /api/instructor/batches/{id}/students/ ───────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_batch_students(request, batch_id):
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)

    try:
        batch = Batch.objects.get(id=batch_id)
    except Batch.DoesNotExist:
        return Response({'error': 'Batch not found'}, status=404)

    enrollments = BatchEnrollment.objects.filter(batch=batch).select_related('student')
    students    = []

    for e in enrollments:
        s = e.student
        # Has this student submitted for this batch's assessment?
        has_submitted = False
        try:
            assessment = Assessment.objects.get(batch=batch)
            has_submitted = StudentResponse.objects.filter(
                student=s, assessment=assessment, submitted_at__isnull=False
            ).exists()
        except Assessment.DoesNotExist:
            pass

        students.append({
            'id':           s.id,
            'name':         s.name,
            'email':        s.email,
            'school_id':    s.school_id,
            'course':       s.course,
            'photo_url':    s.photo_url,
            'has_submitted': has_submitted,
            'enrolled_at':  e.enrolled_at,
        })

    return Response({'batch': {'id': batch.id, 'name': batch.name}, 'students': students})


# ════════════════════════════════════════════════════════════════════════════
# INSTRUCTOR — Assessments
# ════════════════════════════════════════════════════════════════════════════

# ── GET /api/instructor/assessments/   POST /api/instructor/assessments/ ─
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def instructor_assessments(request):
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)

    if request.method == 'GET':
        assessments = Assessment.objects.filter(
            created_by=request.user
        ).prefetch_related('questions').order_by('-created_at')

        return Response([{
            'id':               a.id,
            'title':            a.title,
            'batch_id':         a.batch_id,
            'batch_name':       a.batch.name if a.batch else None,
            'duration_minutes': a.duration_minutes,
            'is_active':        a.is_active,
            'question_count':   a.questions.count(),
            'submission_count': a.responses.filter(submitted_at__isnull=False).count(),
            'created_at':       a.created_at,
        } for a in assessments])

    # ── POST: Create assessment with nested questions ─────────────────────
    data = request.data

    title            = data.get('title', '').strip()
    batch_id         = data.get('batch_id')
    duration_minutes = int(data.get('duration_minutes', 60))
    questions_data   = data.get('questions', [])

    if not title:
        return Response({'error': 'title is required'}, status=400)
    if not questions_data:
        return Response({'error': 'at least one question is required'}, status=400)

    # Validate batch belongs to this instructor
    batch = None
    if batch_id:
        try:
            batch = Batch.objects.get(id=batch_id, instructor=request.user)
        except Batch.DoesNotExist:
            return Response({'error': 'Batch not found or not yours'}, status=404)

    # Create the assessment
    assessment = Assessment.objects.create(
        title=title,
        created_by=request.user,
        batch=batch,
        duration_minutes=duration_minutes,
        is_active=True,
    )

    created_questions = []
    for order, q_data in enumerate(questions_data, start=1):
        q_text    = q_data.get('question_text', '').strip()
        q_type    = q_data.get('question_type', 'mcq').lower()
        cat_name  = q_data.get('category', '').strip()
        choices   = q_data.get('choices', [])
        correct_answer = q_data.get('correct_answer', '')   # for identification

        if not q_text:
            continue
        if q_type not in ('mcq', 'truefalse', 'identification'):
            q_type = 'mcq'

        # Auto-create category if needed
        cat = None
        if cat_name:
            cat, _ = SkillCategory.objects.get_or_create(
                name__iexact=cat_name,
                defaults={'name': cat_name, 'created_by': request.user}
            )

        question = Question.objects.create(
            assessment=assessment,
            skill_category=cat,
            question_text=q_text,
            question_type=q_type,
            question_order=order,
        )

        # Create choices
        if q_type == 'identification':
            # Store correct answer as a single AnswerChoice with is_correct=True
            if correct_answer:
                AnswerChoice.objects.create(
                    question=question,
                    choice_text=correct_answer.strip(),
                    is_correct=True,
                )
        else:
            for c in choices:
                AnswerChoice.objects.create(
                    question=question,
                    choice_text=c.get('text', '').strip(),
                    is_correct=bool(c.get('is_correct', False)),
                )

        created_questions.append(question.id)

    return Response({
        'id':               assessment.id,
        'title':            assessment.title,
        'batch_id':         assessment.batch_id,
        'duration_minutes': assessment.duration_minutes,
        'question_count':   len(created_questions),
    }, status=201)


# ── PATCH /api/instructor/assessments/{id}/ ──────────────────────
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def instructor_assessment_detail(request, assessment_id):
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)

    try:
        assessment = Assessment.objects.get(id=assessment_id, created_by=request.user)
    except Assessment.DoesNotExist:
        return Response({'error': 'Assessment not found'}, status=404)

    # Only allow changing non-question fields after students may have submitted
    if 'title' in request.data:
        assessment.title = request.data['title'].strip()
    if 'duration_minutes' in request.data:
        assessment.duration_minutes = int(request.data['duration_minutes'])
    if 'is_active' in request.data:
        assessment.is_active = bool(request.data['is_active'])

    assessment.save(update_fields=['title', 'duration_minutes', 'is_active'])

    return Response({
        'id':               assessment.id,
        'title':            assessment.title,
        'duration_minutes': assessment.duration_minutes,
        'is_active':        assessment.is_active,
    })


# ── GET /api/instructor/assessments/{id}/questions/ ──────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_assessment_questions(request, assessment_id):
    """Return full question list for instructor review/edit."""
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)

    try:
        assessment = Assessment.objects.get(id=assessment_id, created_by=request.user)
    except Assessment.DoesNotExist:
        return Response({'error': 'Assessment not found'}, status=404)

    questions = assessment.questions.prefetch_related('choices', 'skill_category').order_by('question_order')
    data = []
    for q in questions:
        choices = [
            {'id': c.id, 'text': c.choice_text, 'is_correct': c.is_correct}
            for c in q.choices.all()
        ]
        data.append({
            'id':            q.id,
            'question_text': q.question_text,
            'question_type': q.question_type,
            'question_order': q.question_order,
            'category':      {'id': q.skill_category.id, 'name': q.skill_category.name} if q.skill_category else None,
            'choices':       choices,
        })

    return Response({
        'assessment': {
            'id':               assessment.id,
            'title':            assessment.title,
            'duration_minutes': assessment.duration_minutes,
            'is_active':        assessment.is_active,
        },
        'questions': data,
    })


# ════════════════════════════════════════════════════════════════════════════
# STUDENT — Assessment Flow
# ════════════════════════════════════════════════════════════════════════════

# ── GET /api/assessments/active/ ─────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def assessment_active(request):
    """
    Returns the single active assessment for the student's current batch.
    Returns 404 if not enrolled or no active assessment.
    """
    user = request.user
    if user.role != 'student':
        return Response({'error': 'Students only'}, status=403)

    enrollment = (
        BatchEnrollment.objects
        .filter(student=user, batch__status='active')
        .select_related('batch')
        .first()
    )
    if not enrollment:
        return Response({'error': 'not_enrolled'}, status=404)

    try:
        assessment = Assessment.objects.get(batch=enrollment.batch, is_active=True)
    except Assessment.DoesNotExist:
        return Response({'error': 'no_active_assessment'}, status=404)

    # Check if already submitted (and retake not allowed)
    existing = StudentResponse.objects.filter(
        student=user, assessment=assessment, submitted_at__isnull=False
    ).first()
    if existing and not existing.retake_allowed:
        return Response({'error': 'already_submitted'}, status=409)

    return Response({
        'id':               assessment.id,
        'title':            assessment.title,
        'duration_minutes': assessment.duration_minutes,
        'batch_name':       enrollment.batch.name,
    })


# ── POST /api/assessments/{id}/start/ ────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assessment_start(request, assessment_id):
    """
    Called when the student loads the first question.
    Records started_at for timer anti-cheat.
    Returns full shuffled question list (without revealing correct answers).
    """
    user = request.user
    if user.role != 'student':
        return Response({'error': 'Students only'}, status=403)

    try:
        assessment = Assessment.objects.get(id=assessment_id, is_active=True)
    except Assessment.DoesNotExist:
        return Response({'error': 'Assessment not found'}, status=404)

    # Create or retrieve in-progress response
    response_obj, created = StudentResponse.objects.get_or_create(
        student=user,
        assessment=assessment,
        submitted_at__isnull=True,
        defaults={'started_at': timezone.now()}
    )

    # Record start time only on first open
    if created or response_obj.started_at is None:
        response_obj.started_at = timezone.now()
        response_obj.save(update_fields=['started_at'])

    # Build question list (no correct answer revealed)
    questions = assessment.questions.prefetch_related('choices').order_by('question_order')
    q_list = []
    for q in questions:
        if q.question_type == 'identification':
            # Don't send the correct answer to client
            q_list.append({
                'id':            q.id,
                'question_text': q.question_text,
                'question_type': q.question_type,
                'category':      q.skill_category.name if q.skill_category else '',
                'choices':       [],
            })
        else:
            q_list.append({
                'id':            q.id,
                'question_text': q.question_text,
                'question_type': q.question_type,
                'category':      q.skill_category.name if q.skill_category else '',
                'choices': [
                    {'id': c.id, 'text': c.choice_text}
                    for c in q.choices.all()
                ],
            })

    return Response({
        'response_id':    response_obj.id,
        'started_at':     response_obj.started_at,
        'time_limit_sec': assessment.duration_minutes * 60,
        'questions':      q_list,
    })


# ── POST /api/assessments/{id}/submit/ ───────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assessment_submit(request, assessment_id):
    """
    Grade all answers, write SkillScore rows, generate recommendations.
    Body: { "answers": [ { "question_id": 1, "selected_choice_id": 5 }, ... ] }
    """
    from .scoring import score_submission, generate_recommendations

    user = request.user
    if user.role != 'student':
        return Response({'error': 'Students only'}, status=403)

    try:
        assessment = Assessment.objects.get(id=assessment_id, is_active=True)
    except Assessment.DoesNotExist:
        return Response({'error': 'Assessment not found'}, status=404)

    # Get the in-progress response
    try:
        response_obj = StudentResponse.objects.get(
            student=user,
            assessment=assessment,
            submitted_at__isnull=True
        )
    except StudentResponse.DoesNotExist:
        return Response({'error': 'No in-progress attempt found. Call /start/ first.'}, status=400)

    # Timer validation: check if they exceeded time limit
    if response_obj.started_at:
        elapsed = (timezone.now() - response_obj.started_at).total_seconds()
        allowed = assessment.duration_minutes * 60 + 30  # 30 sec grace period
        if elapsed > allowed:
            # Mark submitted anyway but flag it
            pass  # For thesis: flag but don't block

    answers_data = request.data.get('answers', [])
    categories   = list(SkillCategory.objects.all())

    # ── Auto-score ───────────────────────────────────────────────
    score_results = score_submission(response_obj, answers_data, categories)

    # ── Mark submitted ───────────────────────────────────────────
    response_obj.submitted_at = timezone.now()
    response_obj.save(update_fields=['submitted_at'])

    # ── Generate recommendations (cosine similarity) ─────────────
    recommendations = generate_recommendations(user, assessment, categories)

    return Response({
        'message':         'Assessment submitted successfully.',
        'scores':          score_results,
        'recommendations': recommendations[:5],   # top 5
    })


# ════════════════════════════════════════════════════════════════════════════
# INSTRUCTOR — Recommendations / Student Results
# ════════════════════════════════════════════════════════════════════════════

# ── GET /api/instructor/students/recommendations/ ─────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_student_recommendations(request):
    """
    Returns all students in instructor's batches with their top 3 recommended positions.
    Used by InstructorDashboard Recommendations tab.
    """
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)

    batches = Batch.objects.filter(instructor=request.user)
    enrollments = BatchEnrollment.objects.filter(batch__in=batches).select_related('student', 'batch')

    results = []
    for e in enrollments:
        student = e.student
        top_recs = (
            Recommendation.objects
            .filter(student=student)
            .select_related('position', 'position__company')
            .order_by('-match_score')[:3]
        )
        # Latest skill scores
        skill_scores = SkillScore.objects.filter(student=student).select_related('skill_category')
        results.append({
            'student': {
                'id':        student.id,
                'name':      student.name,
                'email':     student.email,
                'school_id': student.school_id,
                'course':    student.course,
                'photo_url': student.photo_url,
            },
            'batch': {'id': e.batch.id, 'name': e.batch.name},
            'skill_scores': [
                {'category': ss.skill_category.name, 'percentage': ss.percentage}
                for ss in skill_scores
            ],
            'top_recommendations': [
                {
                    'position':    r.position.title,
                    'company':     r.position.company.name,
                    'match_score': r.match_score,
                }
                for r in top_recs
            ],
        })

    return Response(results)


# ── GET /api/student/results/ ─────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_results(request):
    """Returns the student's own skill scores + ranked recommendations."""
    user = request.user
    if user.role != 'student':
        return Response({'error': 'Students only'}, status=403)

    skill_scores = SkillScore.objects.filter(student=user).select_related('skill_category')
    recommendations = (
        Recommendation.objects
        .filter(student=user)
        .select_related('position', 'position__company')
        .order_by('-match_score')
    )

    return Response({
        'skill_scores': [
            {
                'category':   ss.skill_category.name,
                'raw_score':  ss.raw_score,
                'max_score':  ss.max_score,
                'percentage': ss.percentage,
            }
            for ss in skill_scores
        ],
        'recommendations': [
            {
                'position':    r.position.title,
                'company':     r.position.company.name,
                'slots':       r.position.slots_available,
                'match_score': r.match_score,
            }
            for r in recommendations
        ],
    })


# ── GET /api/admin/students/recommendations/ ──────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_student_recommendations(request):
    """Admin-wide view: all students with their top recommendations."""
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)

    students = User.objects.filter(role='student', is_active=True)
    results  = []

    for student in students:
        top_recs = (
            Recommendation.objects
            .filter(student=student)
            .select_related('position', 'position__company')
            .order_by('-match_score')[:3]
        )
        results.append({
            'student': {
                'id':        student.id,
                'name':      student.name,
                'email':     student.email,
                'school_id': student.school_id,
                'course':    student.course,
            },
            'top_recommendations': [
                {
                    'position':    r.position.title,
                    'company':     r.position.company.name,
                    'match_score': r.match_score,
                }
                for r in top_recs
            ],
        })

    return Response(results)


# ════════════════════════════════════════════════════════════════════════════
# ADMIN — Companies & Positions
# ════════════════════════════════════════════════════════════════════════════

# ── GET /api/admin/companies/   POST /api/admin/companies/ ────────
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_companies(request):
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)

    if request.method == 'GET':
        companies = Company.objects.prefetch_related(
            'positions', 'positions__requirements', 'positions__requirements__skill_category'
        ).all()

        data = []
        for co in companies:
            positions = []
            for pos in co.positions.all():
                reqs = {
                    r.skill_category.name: r.required_percentage
                    for r in pos.requirements.all()
                }
                positions.append({
                    'id':     pos.id,
                    'title':  pos.title,
                    'slots':  pos.slots_available,
                    'requirements': reqs,
                })
            data.append({
                'id':       co.id,
                'name':     co.name,
                'address':  co.address,
                'lat':      co.location_lat,
                'lng':      co.location_lng,
                'positions': positions,
            })

        return Response(data)

    # POST — add company
    name    = request.data.get('name', '').strip()
    address = request.data.get('address')   # JSONField { province, city, barangay }
    lat     = request.data.get('lat')
    lng     = request.data.get('lng')

    if not name:
        return Response({'error': 'name is required'}, status=400)

    company = Company.objects.create(
        name=name,
        address=address,
        location_lat=lat,
        location_lng=lng,
        added_by=request.user,
    )
    return Response({'id': company.id, 'name': company.name}, status=201)


# ── POST /api/admin/companies/{id}/positions/ ─────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_company_positions(request, company_id):
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)

    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        return Response({'error': 'Company not found'}, status=404)

    title    = request.data.get('title', '').strip()
    slots    = int(request.data.get('slots', 1))
    reqs     = request.data.get('requirements', {})  # { "Database": 70, "Programming": 60 }

    if not title:
        return Response({'error': 'title is required'}, status=400)

    position = Position.objects.create(
        company=company,
        title=title,
        slots_available=slots,
    )

    # Create requirement rows
    for cat_name, pct in reqs.items():
        if pct <= 0:
            continue
        try:
            cat = SkillCategory.objects.get(name__iexact=cat_name)
            PositionRequirement.objects.create(
                position=position,
                skill_category=cat,
                required_percentage=float(pct),
            )
        except SkillCategory.DoesNotExist:
            pass  # Skip unknown categories

    return Response({
        'id':    position.id,
        'title': position.title,
        'slots': position.slots_available,
    }, status=201)