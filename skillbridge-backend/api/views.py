import threading
from rest_framework.throttling import AnonRateThrottle
import requests as http_requests
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.db.models import Sum, Max
from .models import (
    User, Batch, BatchEnrollment, SkillCategory,
    Assessment, Question, AnswerChoice,
    StudentResponse, ResponseAnswer, SkillScore,
    Company, Position, PositionRequirement, Recommendation,
)
from .serializers import UserSerializer


class LoginRateThrottle(AnonRateThrottle):
    scope = 'login'


def get_instructor_email_html(name, frontend_url, instructor_id=None, department=None):
    details_html = ""
    if instructor_id and department:
        details_html = f"""
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #4b5563; font-size: 14px;"><strong>Instructor ID:</strong> {instructor_id}</p>
            <p style="margin: 5px 0 0; color: #4b5563; font-size: 14px;"><strong>Department:</strong> {department}</p>
        </div>
        """

    return f"""
    <div style="font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #16a34a; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">SkillBridge</h1>
            <p style="color: #dcfce7; margin: 5px 0 0; font-size: 14px;">Davao del Norte State College</p>
        </div>
        <div style="padding: 40px 30px;">
            <h2 style="color: #111827; margin: 0 0 20px; font-size: 20px;">Welcome, {name}!</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Your instructor access has been successfully approved for the SkillBridge OJT Placement System.
            </p>
            {details_html}
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                You can now log in securely using your DNSC Google account.
            </p>
            <div style="text-align: center;">
                <a href="{frontend_url}/login" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; padding: 14px 28px; border-radius: 8px;">
                    Sign in to SkillBridge
                </a>
            </div>
        </div>
        <div style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">Institute of Computing • Panabo City, Davao del Norte</p>
            <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0;">Please do not reply to this automated email.</p>
        </div>
    </div>
    """

import os

def send_instructor_email(user, subject, body, html_body=None):
    def _send():
        try:
            api_key = os.getenv('BREVO_API_KEY')
            from_email = os.getenv('EMAIL_HOST_USER', 'azelmv14@gmail.com')
            
            if api_key:
                # -------------------------------------------------------------
                # 100% FREE HTTP API ROUTE (Bypasses Railway SMTP Block on Port 443)
                # -------------------------------------------------------------
                payload = {
                    "sender": {"name": "Skill Bridge", "email": from_email},
                    "to": [{"email": user.email, "name": user.name}],
                    "subject": subject,
                    "htmlContent": html_body if html_body else f"<p>{body}</p>"
                }
                headers = {
                    "accept": "application/json",
                    "api-key": api_key,
                    "content-type": "application/json"
                }
                
                # http_requests is imported as `import requests as http_requests` at the top of views.py
                res = http_requests.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers)
                res.raise_for_status() 
                print(f'[SkillBridge] Async HTTP API email successfully sent to {user.email}')
            
            else:
                # -------------------------------------------------------------
                # STANDARD SMTP ROUTE (Fails gracefully on Railway free tier)
                # -------------------------------------------------------------
                send_mail(
                    subject=subject,
                    message=body,
                    from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@skillbridge.local'),
                    recipient_list=[user.email],
                    fail_silently=False,
                    html_message=html_body,
                )
                print(f'[SkillBridge] Async SMTP email successfully sent to {user.email}')
                
        except http_requests.exceptions.HTTPError as e:
            print(f'[SkillBridge] Brevo HTTP Error for {user.email}: {e.response.status_code} | {e.response.text}')
        except Exception as e:
            print(f'[SkillBridge] Async email send FAILED for {user.email}: {e}')

    try:
        t = threading.Thread(target=_send)
        t.daemon = True
        t.start()
        return True
    except Exception as e:
        print(f"[SkillBridge] Failed to start email thread: {e}")
        return False



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

    try:
        user = User.objects.get(email=email)
        user.name = name
        user.photo_url = photo_url
        user.save(update_fields=['name', 'photo_url'])
    except User.DoesNotExist:
        return Response(
            {'error': 'role_selection_required', 'email': email, 'name': name},
            status=status.HTTP_403_FORBIDDEN
        )

    if user.role == 'instructor' and not user.is_approved:
        return Response({'error': 'pending'}, status=status.HTTP_403_FORBIDDEN)
    if user.role == 'student':
        # Student must be approved AND enrolled by instructor first.
        if not user.is_approved:
            return Response({'error': 'student_pending'}, status=status.HTTP_403_FORBIDDEN)
        has_enrollment = BatchEnrollment.objects.filter(student=user).exists()
        if not has_enrollment:
            return Response({'error': 'student_not_enrolled'}, status=status.HTTP_403_FORBIDDEN)

    refresh = RefreshToken.for_user(user)
    return Response({
        'access':  str(refresh.access_token),
        'refresh': str(refresh),
        'user':    UserSerializer(user).data,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def register_role(request):
    access_token = request.data.get('token')
    role = request.data.get('role', '').strip().lower()

    if not access_token:
        return Response({'error': 'No token provided'}, status=status.HTTP_400_BAD_REQUEST)
    if role not in ('student', 'instructor'):
        return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)

    google_response = http_requests.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        headers={'Authorization': f'Bearer {access_token}'}
    )
    if google_response.status_code != 200:
        return Response({'error': 'Invalid token'}, status=status.HTTP_401_UNAUTHORIZED)

    idinfo = google_response.json()
    email = idinfo.get('email', '')
    name = idinfo.get('name', '')
    photo_url = idinfo.get('picture', '')

    if not email.endswith('@dnsc.edu.ph'):
        return Response({'error': 'not_dnsc'}, status=status.HTTP_403_FORBIDDEN)

    existing = User.objects.filter(email=email).first()
    if existing:
        existing.name = name or existing.name
        existing.photo_url = photo_url or existing.photo_url
        existing.save(update_fields=['name', 'photo_url'])
        return Response({
            'ok': True,
            'already_exists': True,
            'role': existing.role,
            'is_approved': existing.is_approved,
        })

    user = User.objects.create(
        email=email,
        name=name or email.split('@')[0],
        role=role,
        photo_url=photo_url,
        is_approved=False,
        is_active=True,
    )
    user.set_unusable_password()
    user.save(update_fields=['password'])

    return Response({
        'ok': True,
        'role': user.role,
        'is_approved': user.is_approved,
        'message': 'Account created and pending approval/enrollment.',
    }, status=201)


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
            # If student self-registered but is still pending, auto-approve when enrolled.
            if not student.is_approved:
                student.is_approved = True
                student.save(update_fields=['is_approved'])
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

    enrollments = list(BatchEnrollment.objects.filter(batch=batch).select_related('student'))
    student_objs = [e.student for e in enrollments]
    student_ids  = [s.id for s in student_objs]

    # Preload the batch's assessment once
    try:
        batch_assessment = Assessment.objects.get(batch=batch)
    except Assessment.DoesNotExist:
        batch_assessment = None

    # ── Bulk-load responses and scores for all students ──────────────
    response_map = {}   # student_id -> StudentResponse
    scores_map   = {}   # student_id -> { category_name: percentage }

    if batch_assessment:
        for resp in StudentResponse.objects.filter(
            assessment=batch_assessment, student_id__in=student_ids
        ):
            response_map[resp.student_id] = resp

        for score in SkillScore.objects.filter(
            assessment=batch_assessment, student_id__in=student_ids
        ).select_related('skill_category'):
            scores_map.setdefault(score.student_id, {})
            scores_map[score.student_id][score.skill_category.name] = round(score.percentage, 1)

    students = []
    for e in enrollments:
        s    = e.student
        resp = response_map.get(s.id)
        students.append({
            'id':             s.id,
            'name':           s.name,
            'email':          s.email,
            'school_id':      s.school_id,
            'course':         s.course,
            'photo_url':      s.photo_url,
            'has_submitted':  bool(resp and resp.submitted_at is not None),
            'retake_allowed': resp.retake_allowed if resp else False,
            'skill_scores':   scores_map.get(s.id, {}),
            'enrolled_at':    e.enrolled_at,
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
        assessments = Assessment.objects.all().prefetch_related('questions').order_by('-created_at')

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
        assessment = Assessment.objects.get(id=assessment_id)
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


# ── POST /api/instructor/assessments/{id}/questions/add/ ──────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def instructor_assessment_add_questions(request, assessment_id):
    """
    Append new questions (from a parsed file upload) to an existing assessment.
    Also clears all student submissions so everyone retakes with the full set.
 
    Body:
    {
      "questions": [
        {
          "question_text": "What does HTML stand for?",
          "question_type": "mcq",
          "category":      "Web Development",
          "choices":       [
            { "text": "HyperText Markup Language", "is_correct": true  },
            { "text": "High Text Machine Language", "is_correct": false }
          ]
        },
        {
          "question_text": "What does CPU stand for?",
          "question_type": "identification",
          "category":      "Computer Hardware",
          "correct_answer": "Central Processing Unit"
        }
      ],
      "clear_submissions": true    // default true — resets student progress
    }
 
    Returns:
    {
      "added":                5,
      "total":                30,
      "submissions_cleared":  true
    }
    """
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)
 
    try:
        assessment = Assessment.objects.get(id=assessment_id)
    except Assessment.DoesNotExist:
        return Response({'error': 'Assessment not found'}, status=404)
 
    questions_data    = request.data.get('questions', [])
    clear_submissions = request.data.get('clear_submissions', True)
 
    if not questions_data:
        return Response({'error': 'at least one question is required'}, status=400)
 
    # Append after the last existing question
    from django.db.models import Max
    current_max = (
        assessment.questions.aggregate(max_order=Max('question_order'))['max_order'] or 0
    )
 
    created_count = 0
    for i, q_data in enumerate(questions_data, start=1):
        q_text         = q_data.get('question_text', '').strip()
        q_type         = q_data.get('question_type', 'mcq').lower()
        cat_name       = q_data.get('category', '').strip()
        choices        = q_data.get('choices', [])
        correct_answer = q_data.get('correct_answer', '')
 
        if not q_text:
            continue
        if q_type not in ('mcq', 'truefalse', 'identification'):
            q_type = 'mcq'
 
        # Auto-create category if needed (same pattern as assessment creation)
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
            question_order=current_max + i,
        )
 
        if q_type == 'identification':
            if correct_answer:
                AnswerChoice.objects.create(
                    question=question,
                    choice_text=correct_answer.strip(),
                    is_correct=True,
                )
        else:
            for c in choices:
                text = c.get('text', '').strip()
                if text:
                    AnswerChoice.objects.create(
                        question=question,
                        choice_text=text,
                        is_correct=bool(c.get('is_correct', False)),
                    )
 
        created_count += 1
 
    # Clear all student submissions so everyone retakes with the full question set
    submissions_cleared = False
    if clear_submissions and created_count > 0:
        response_ids = list(
            StudentResponse.objects.filter(assessment=assessment).values_list('id', flat=True)
        )
        if response_ids:
            ResponseAnswer.objects.filter(response_id__in=response_ids).delete()
            StudentResponse.objects.filter(assessment=assessment).delete()
            SkillScore.objects.filter(assessment=assessment).delete()
            submissions_cleared = True
 
    total = assessment.questions.count()
    return Response({
        'added':               created_count,
        'total':               total,
        'submissions_cleared': submissions_cleared,
    }, status=201)

# ── PATCH / DELETE  /api/instructor/questions/{id}/ ──────────────────────────
@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def instructor_question_detail(request, question_id):
    """
    PATCH  → update question text, type, choices, category.
    DELETE → permanently remove the question.
 
    PATCH body (all fields optional — only provided fields are updated):
    {
      "question_text":  "Updated question?",
      "question_type":  "mcq",               // mcq | truefalse | identification
      "category":       "Database",           // auto-created if new; "" to clear
      "choices": [                            // for mcq / truefalse
        { "text": "Option A", "is_correct": true  },
        { "text": "Option B", "is_correct": false }
      ],
      "correct_answer": "Central Processing Unit"  // identification only
    }
 
    When 'choices' OR 'correct_answer' is present all existing choices are
    replaced atomically.
    """
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)
 
    # Admins can edit any question; instructors only questions in their own assessments
    try:
        if request.user.role == 'admin':
            question = Question.objects.select_related(
                'assessment', 'skill_category'
            ).prefetch_related('choices').get(id=question_id)
        else:
            question = Question.objects.select_related(
                'assessment', 'skill_category'
            ).prefetch_related('choices').get(
                id=question_id,
                assessment__created_by=request.user
            )
    except Question.DoesNotExist:
        return Response({'error': 'Question not found'}, status=404)
 
    # ── DELETE ────────────────────────────────────────────────────────────────
    if request.method == 'DELETE':
        question.delete()
        return Response({'ok': True})
 
    # ── PATCH ─────────────────────────────────────────────────────────────────
    data = request.data
 
    if 'question_text' in data:
        question.question_text = (data['question_text'] or '').strip()
 
    if 'question_type' in data:
        new_type = (data['question_type'] or '').lower()
        if new_type in ('mcq', 'truefalse', 'identification'):
            question.question_type = new_type
 
    if 'category' in data:
        cat_name = (data['category'] or '').strip()
        if cat_name:
            cat, _ = SkillCategory.objects.get_or_create(
                name__iexact=cat_name,
                defaults={'name': cat_name, 'created_by': request.user}
            )
            question.skill_category = cat
        else:
            question.skill_category = None
 
    question.save()
 
    # Replace choices only when caller explicitly sends choice data
    if 'choices' in data or 'correct_answer' in data:
        question.choices.all().delete()
 
        if question.question_type == 'identification':
            correct_answer = (data.get('correct_answer') or '').strip()
            if correct_answer:
                AnswerChoice.objects.create(
                    question=question,
                    choice_text=correct_answer,
                    is_correct=True,
                )
        else:
            for c in (data.get('choices') or []):
                text = (c.get('text') or '').strip()
                if text:
                    AnswerChoice.objects.create(
                        question=question,
                        choice_text=text,
                        is_correct=bool(c.get('is_correct', False)),
                    )
 
    # Return refreshed question so the frontend can reconcile its local state
    choices_out = [
        {'id': c.id, 'text': c.choice_text, 'is_correct': c.is_correct}
        for c in question.choices.order_by('id').all()
    ]
    return Response({
        'id':             question.id,
        'question_text':  question.question_text,
        'question_type':  question.question_type,
        'question_order': question.question_order,
        'category': (
            {'id': question.skill_category.id, 'name': question.skill_category.name}
            if question.skill_category else None
        ),
        'choices': choices_out,
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

    batches     = Batch.objects.filter(instructor=request.user)
    enrollments = list(BatchEnrollment.objects.filter(batch__in=batches).select_related('student', 'batch'))
    student_ids = list({e.student_id for e in enrollments})

    # ── Bulk-load all recommendations ─────────────────────────────
    from collections import defaultdict
    all_recs = (
        Recommendation.objects
        .filter(student_id__in=student_ids)
        .select_related('position', 'position__company')
        .order_by('student_id', '-match_score')
    )
    recs_by_student = defaultdict(list)
    for r in all_recs:
        if len(recs_by_student[r.student_id]) < 3:
            recs_by_student[r.student_id].append(r)

    # ── Bulk-load all skill scores ─────────────────────────────────
    all_scores = (
        SkillScore.objects
        .filter(student_id__in=student_ids)
        .select_related('skill_category')
    )
    scores_by_student = defaultdict(list)
    for sc in all_scores:
        scores_by_student[sc.student_id].append({'category': sc.skill_category.name, 'percentage': sc.percentage})

    # ── Build the result using pre-loaded data ─────────────────────
    results = []
    for e in enrollments:
        student  = e.student
        top_recs = recs_by_student.get(student.id, [])
        # Normalise to the shape InstructorDashboard expects
        top_one  = top_recs[0] if top_recs else None
        results.append({
            'id':          student.id,
            'student_id':  student.id,
            'student_name': student.name,
            'name':        student.name,
            'email':       student.email,
            'school_id':   student.school_id,
            'course':      student.course,
            'photo_url':   student.photo_url,
            'has_submitted': bool(top_one),
            'skill_scores': {sc['category']: sc['percentage'] for sc in scores_by_student.get(student.id, [])},
            'batch':       {'id': e.batch.id, 'name': e.batch.name},
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

    students = list(User.objects.filter(role='student', is_active=True))
    student_ids = [s.id for s in students]

    # ── Bulk-load ALL recommendations in ONE query ────────────────────
    all_recs = (
        Recommendation.objects
        .filter(student_id__in=student_ids)
        .select_related('position', 'position__company', 'student')
        .order_by('student_id', '-match_score')
    )

    # Group top-3 per student
    from collections import defaultdict
    recs_by_student = defaultdict(list)
    for r in all_recs:
        if len(recs_by_student[r.student_id]) < 3:
            recs_by_student[r.student_id].append(r)

    # Also get instructor names via batch enrollments
    enrollments = (
        BatchEnrollment.objects
        .filter(student_id__in=student_ids)
        .select_related('batch', 'batch__instructor')
    )
    instructor_by_student = {}
    for e in enrollments:
        if e.student_id not in instructor_by_student:
            instructor_by_student[e.student_id] = e.batch.instructor.name if e.batch.instructor else ''

    results = []
    for student in students:
        top_recs = recs_by_student.get(student.id, [])
        top_one  = top_recs[0] if top_recs else None
        results.append({
            'id':               student.id,
            'student_name':     student.name,
            'email':            student.email,
            'school_id':        student.school_id,
            'course':           student.course,
            'instructor_name':  instructor_by_student.get(student.id, ''),
            'has_submitted':    bool(top_one),
            'top_match_score':  round(top_one.match_score, 2) if top_one else None,
            'top_position_name': top_one.position.title if top_one else None,
            'top_company_name':  top_one.position.company.name if top_one else None,
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
# ADMIN — Dashboard / Users
# ════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_stats(request):
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)

    total_students = User.objects.filter(role='student', is_active=True).count()
    total_companies = Company.objects.count()
    open_positions = Position.objects.aggregate(total=Sum('slots_available')).get('total') or 0
    recommendations_made = Recommendation.objects.count()

    return Response({
        'total_students': total_students,
        'total_companies': total_companies,
        'open_positions': open_positions,
        'recommendations_made': recommendations_made,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_users(request):
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)

    students            = list(User.objects.filter(role='student', is_active=True).order_by('name'))
    instructors         = list(User.objects.filter(role='instructor', is_active=True, is_approved=True).order_by('name'))
    pending_instructors = list(User.objects.filter(role='instructor', is_active=True, is_approved=False).order_by('name'))

    # ── Bulk-load top recs for all students in ONE query ─────────────
    student_ids = [s.id for s in students]
    all_recs = (
        Recommendation.objects
        .filter(student_id__in=student_ids)
        .select_related('position', 'position__company')
        .order_by('student_id', '-match_score')
    )
    top_rec_by_student = {}
    for r in all_recs:
        if r.student_id not in top_rec_by_student:
            top_rec_by_student[r.student_id] = r

    # ── Bulk-load instructor names for students ──────────────────────
    enrollments = (
        BatchEnrollment.objects
        .filter(student_id__in=student_ids)
        .select_related('batch', 'batch__instructor')
    )
    instructor_by_student = {}
    for e in enrollments:
        if e.student_id not in instructor_by_student and e.batch.instructor:
            instructor_by_student[e.student_id] = e.batch.instructor.name

    students_out = []
    for s in students:
        top_rec = top_rec_by_student.get(s.id)
        students_out.append({
            'id':               s.id,
            'name':             s.name,
            'email':            s.email,
            'student_id':       s.school_id or '',
            'course':           s.course or '',
            'instructor':       instructor_by_student.get(s.id, 'TBD'),
            'status':           'completed' if top_rec else 'pending',
            'top_match_score':  round(top_rec.match_score, 2) if top_rec else None,
            'top_position_name': top_rec.position.title if top_rec else None,
            'top_company_name':  top_rec.position.company.name if top_rec else None,
            'retake_allowed':    False,
        })

    def serialize_instructor(user):
        return {
            'id':           user.id,
            'name':         user.name,
            'email':        user.email,
            'instructor_id': user.school_id or '',
            'department':   'Institute of Computing',
            'courses':      user.course or 'BSIT / BSIS',
            'is_approved':  user.is_approved,
        }

    return Response({
        'students':            students_out,
        'instructors':         [serialize_instructor(i) for i in instructors],
        'pending_instructors': [serialize_instructor(i) for i in pending_instructors],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_instructors(request):
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)

    email = request.data.get('email', '').strip().lower()
    name = request.data.get('name', '').strip()
    instructor_id = request.data.get('instructor_id', '').strip()
    department = request.data.get('department', 'Institute of Computing').strip()
    courses = request.data.get('courses', 'BSIT / BSIS').strip()

    if not email.endswith('@dnsc.edu.ph'):
        return Response({'error': 'Instructor email must use @dnsc.edu.ph'}, status=400)
    if not name:
        return Response({'error': 'name is required'}, status=400)
    if not instructor_id:
        return Response({'error': 'instructor_id is required'}, status=400)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already exists'}, status=409)
    if User.objects.filter(role='instructor', school_id=instructor_id).exists():
        return Response({'error': 'Instructor ID already exists'}, status=409)

    user = User.objects.create(
        email=email,
        name=name,
        role='instructor',
        school_id=instructor_id,
        course=courses,
        is_approved=True,
        is_active=True,
    )
    user.set_unusable_password()
    user.save(update_fields=['password'])

    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://skill-bridge-six-psi.vercel.app')
    html_body = get_instructor_email_html(name, frontend_url, instructor_id, department)
    email_sent = send_instructor_email(
        user,
        subject='SkillBridge Instructor Access Approved',
        body=(
            f'Hello {name},\n\n'
            'You were added as an instructor in SkillBridge.\n'
            'You can now log in using your DNSC Google account.\n\n'
            f'Login page: {frontend_url}/login\n'
            f'Instructor ID: {instructor_id}\n'
            f'Department: {department}\n'
        ),
        html_body=html_body
    )

    return Response({
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'instructor_id': user.school_id,
        'department': department,
        'courses': user.course,
        'is_approved': user.is_approved,
        'email_sent': email_sent,
    }, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_approve_instructor(request, user_id):
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)

    try:
        user = User.objects.get(id=user_id, role='instructor')
    except User.DoesNotExist:
        return Response({'error': 'Instructor not found'}, status=404)

    user.is_approved = True
    user.save(update_fields=['is_approved'])

    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://skill-bridge-six-psi.vercel.app')
    html_body = get_instructor_email_html(user.name, frontend_url)
    email_sent = send_instructor_email(
        user,
        subject='SkillBridge Instructor Access Approved',
        body=(
            f'Hello {user.name},\n\n'
            'Your instructor access has been approved in SkillBridge.\n'
            'You can now log in using your DNSC Google account.\n\n'
            f'Login: {frontend_url}/login\n'
        ),
        html_body=html_body
    )

    return Response({'ok': True, 'email_sent': email_sent})


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


# ── PATCH + DELETE  /api/admin/companies/{id}/ ────────────────────────────────
# Replace the existing admin_company_detail function (was DELETE-only)
@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def admin_company_detail(request, company_id):
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)
    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        return Response({'error': 'Company not found'}, status=404)
 
    if request.method == 'DELETE':
        company.delete()
        return Response(status=204)
 
    # ── PATCH ─────────────────────────────────────────────────────────────────
    if 'name' in request.data:
        name = (request.data['name'] or '').strip()
        if name:
            company.name = name
 
    if 'address' in request.data:
        # Store the structured PSGC JSON object { street, barangay, city, province }
        company.address = request.data['address']
 
    if 'lat' in request.data:
        val = request.data.get('lat')
        company.location_lat = float(val) if val is not None else None
 
    if 'lng' in request.data:
        val = request.data.get('lng')
        company.location_lng = float(val) if val is not None else None
 
    company.save()
 
    return Response({
        'id':      company.id,
        'name':    company.name,
        'address': company.address,
        'lat':     company.location_lat,
        'lng':     company.location_lng,
    })


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


# ── PATCH + DELETE  /api/admin/positions/{id}/ ───────────────────────────────
# Replace the existing admin_position_detail function (was DELETE-only)
@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def admin_position_detail(request, position_id):
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)
    try:
        position = Position.objects.get(id=position_id)
    except Position.DoesNotExist:
        return Response({'error': 'Position not found'}, status=404)
 
    if request.method == 'DELETE':
        position.delete()
        return Response(status=204)
 
    # ── PATCH ─────────────────────────────────────────────────────────────────
    if 'title' in request.data:
        title = (request.data['title'] or '').strip()
        if title:
            position.title = title
 
    if 'slots' in request.data:
        try:
            position.slots_available = max(1, int(request.data['slots']))
        except (TypeError, ValueError):
            pass
 
    position.save()
 
    # Replace skill requirements atomically when the caller sends 'requirements'
    if 'requirements' in request.data:
        reqs = request.data.get('requirements') or {}
        # Wipe existing, then re-create from the new dict
        position.requirements.all().delete()
        for cat_name, pct in reqs.items():
            try:
                pct_float = float(pct)
            except (TypeError, ValueError):
                continue
            if pct_float <= 0:
                continue
            try:
                cat = SkillCategory.objects.get(name__iexact=cat_name)
                PositionRequirement.objects.create(
                    position=position,
                    skill_category=cat,
                    required_percentage=pct_float,
                )
            except SkillCategory.DoesNotExist:
                pass  # skip unknown categories silently
 
    # Return the refreshed position so the frontend can reconcile local state
    updated_reqs = {
        r.skill_category.name: r.required_percentage
        for r in position.requirements.select_related('skill_category').all()
    }
    return Response({
        'id':           position.id,
        'title':        position.title,
        'slots':        position.slots_available,
        'requirements': updated_reqs,
    })