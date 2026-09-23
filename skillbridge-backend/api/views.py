import threading
from rest_framework.throttling import AnonRateThrottle
import requests as http_requests
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
# pyrefly: ignore [missing-import]
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Count, Sum, Max, Q
from django.db.models.deletion import ProtectedError
from django.utils.dateparse import parse_date
from .models import (
    User, Batch, BatchEnrollment, SkillCategory,
    Assessment, Question, AnswerChoice,
    StudentResponse, ResponseAnswer, SkillScore, StudentCompetencyProfile,
    Company, Position, PositionRequirement, Recommendation, OJTPlacement,
    RecommendationConfiguration,
)
from .serializers import UserSerializer
from .assessment_layout import build_question_layout, ordered_choices, ordered_questions
from .recommendation_nlp import (
    MODEL_OPTIONS, model_status, normalize_tags, suggest_position_tags, suggest_skill_tags,
)


INTEGRITY_REASON_DISPLAYS = {
    'window_lost_focus': 'Assessment window lost focus.',
    'tab_hidden': 'Assessment tab or app was hidden.',
    'fullscreen_exited': 'Fullscreen mode was exited.',
    'restricted_shortcut': 'A restricted keyboard shortcut was used.',
    'page_closed': 'The assessment page was refreshed, closed, or left.',
}


def serialize_attempt_integrity(response_obj):
    if response_obj is None:
        return {
            'attempt_status': None,
            'is_flagged': False,
            'stopped_reason': '',
            'stopped_reason_display': '',
            'stopped_at': None,
            'violation_count': 0,
            'retake_allowed': False,
        }
    return {
        'attempt_status': response_obj.status,
        'is_flagged': response_obj.is_flagged,
        'stopped_reason': response_obj.stopped_reason,
        'stopped_reason_display': response_obj.stopped_reason_display,
        'stopped_at': response_obj.stopped_at,
        'violation_count': response_obj.violation_count,
        'retake_allowed': response_obj.retake_allowed,
    }


def get_qualitative_tag(percentage):
    if percentage >= 90:
        return 'Expert'
    elif percentage >= 75:
        return 'Proficient'
    elif percentage >= 50:
        return 'Competent'
    return 'Beginner'


def serialize_recommendation(recommendation):
    """Stable recommendation payload shared by student/admin/instructor APIs."""
    position = recommendation.position
    company = position.company
    return {
        'id': recommendation.id,
        'position_id': position.id,
        'position': position.title,
        'company': company.name,
        'slots': position.slots_available,
        'match_score': round(recommendation.match_score, 1),
        'category_score_component': round(recommendation.category_score_component, 1),
        'nlp_score_component': round(recommendation.nlp_score_component, 1),
        'location_score_component': round(recommendation.location_score_component, 1),
        'model_used': recommendation.model_used,
        'distance_km': round(recommendation.distance_km, 1) if recommendation.distance_km is not None else None,
        'lat': company.location_lat,
        'lng': company.location_lng,
        'address': ', '.join(filter(None, [
            (company.address or {}).get('barangay', ''),
            (company.address or {}).get('city', ''),
            (company.address or {}).get('province', ''),
        ])) or None,
        'tags': list(dict.fromkeys(
            [req.skill_category.name for req in position.requirements.select_related('skill_category').all()]
            + list(position.tags or [])
        )),
    }


def serialize_competency_profile(profile, include_nlp_text=True):
    if profile is None:
        return None
    return {
        'orientation_label': profile.orientation_label,
        'orientation_summary': profile.orientation_summary,
        **({'competency_profile_text': profile.competency_profile_text} if include_nlp_text else {}),
        'development_suggestions': profile.development_suggestions or [],
        'supporting_categories': profile.supporting_categories or [],
        'generated_at': profile.generated_at,
    }


def latest_competency_profiles(student_ids, assessment=None):
    queryset = StudentCompetencyProfile.objects.filter(student_id__in=student_ids)
    if assessment is not None:
        queryset = queryset.filter(assessment=assessment)
    result = {}
    for profile in queryset.order_by('student_id', '-generated_at', '-id'):
        result.setdefault(profile.student_id, profile)
    return result


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


def get_student_enrollment_email_html(student_name, instructor_name, batch_name, frontend_url):
    """HTML email sent to a student when an instructor enrolls them in a batch."""
    return f"""
    <div style="font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #16a34a; padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold;">SkillBridge</h1>
            <p style="color: #dcfce7; margin: 5px 0 0; font-size: 14px;">Davao del Norte State College — OJT Placement System</p>
        </div>
        <div style="padding: 40px 30px;">
            <h2 style="color: #111827; margin: 0 0 12px; font-size: 20px;">You're Enrolled! 🎉</h2>
            <p style="color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 20px;">
                Hi <strong>{student_name}</strong>, your OJT instructor <strong>{instructor_name}</strong> has
                enrolled you in <strong>{batch_name}</strong> on SkillBridge.
            </p>
            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px 20px; margin: 0 0 28px;">
                <p style="margin: 0 0 8px; color: #15803d; font-size: 14px; font-weight: 600;">What you can do now:</p>
                <ul style="margin: 0; padding-left: 18px; color: #166534; font-size: 14px; line-height: 1.8;">
                    <li>Sign in using your DNSC Google account (@dnsc.edu.ph)</li>
                    <li>Complete the OJT skills assessment assigned to your batch</li>
                    <li>View your skill profile and top company matches</li>
                </ul>
            </div>
            <div style="text-align: center;">
                <a href="{frontend_url}/login"
                   style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none;
                          font-size: 15px; font-weight: bold; padding: 14px 32px; border-radius: 8px; letter-spacing: 0.3px;">
                    Go to SkillBridge →
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
    print(f"[SkillBridge DEBUG] send_instructor_email called for user: {user.email}")
    def _send():
        print(f"[SkillBridge DEBUG] Thread started for sending email to {user.email}")
        try:
            api_key = os.getenv('BREVO_API_KEY')
            from_email = os.getenv('EMAIL_HOST_USER', 'azelmv14@gmail.com')
            print(f"[SkillBridge DEBUG] BREVO_API_KEY present: {bool(api_key)}")
            print(f"[SkillBridge DEBUG] from_email: {from_email}")
            
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
                print(f"[SkillBridge DEBUG] Sending to Brevo API...")
                
                # http_requests is imported as `import requests as http_requests` at the top of views.py
                res = http_requests.post("https://api.brevo.com/v3/smtp/email", json=payload, headers=headers)
                print(f"[SkillBridge DEBUG] Brevo API Response Status: {res.status_code}")
                print(f"[SkillBridge DEBUG] Brevo API Response Text: {res.text}")
                res.raise_for_status() 
                print(f'[SkillBridge] Async HTTP API email successfully sent to {user.email}')
            
            else:
                # -------------------------------------------------------------
                # STANDARD SMTP ROUTE (Fails gracefully on Railway free tier)
                # -------------------------------------------------------------
                print(f"[SkillBridge DEBUG] Falling back to standard SMTP route...")
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
            status_code = e.response.status_code if e.response is not None else None
            print(f'[SkillBridge] Brevo HTTP Error for {user.email}: {status_code} | {e.response.text if e.response is not None else "no response"}')
            # 401 = IP not whitelisted in Brevo — fall back to Django SMTP
            if status_code == 401:
                print(f'[SkillBridge] Brevo IP not authorized. Trying SMTP fallback for {user.email}...')
                try:
                    send_mail(
                        subject=subject,
                        message=body,
                        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@skillbridge.local'),
                        recipient_list=[user.email],
                        fail_silently=False,
                        html_message=html_body,
                    )
                    print(f'[SkillBridge] SMTP fallback succeeded for {user.email}')
                except Exception as smtp_err:
                    print(f'[SkillBridge] SMTP fallback also failed for {user.email}: {smtp_err}')
        except Exception as e:
            import traceback
            print(f'[SkillBridge DEBUG] Async email send FAILED for {user.email} Exception details: {e}')
            traceback.print_exc()

    try:
        t = threading.Thread(target=_send)
        t.daemon = True
        t.start()
        print(f"[SkillBridge DEBUG] Thread successfully started for {user.email}")
        return True
    except Exception as e:
        print(f"[SkillBridge DEBUG] Failed to start email thread: {e}")
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

    user.name      = request.data.get('name',      user.name) or user.name
    user.school_id = request.data.get('studentId', user.school_id)
    user.course    = request.data.get('course',    user.course)
    user.phone     = request.data.get('phone',     user.phone)
    user.address   = address
    user.save(update_fields=['name', 'school_id', 'course', 'phone', 'address'])

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
        .order_by('-started_at', '-id')
        .first()
    )

    has_submitted  = latest_response is not None and latest_response.submitted_at is not None
    retake_allowed = latest_response.retake_allowed if latest_response else False
    approved_placement = _approved_student_placement(user.id)

    return Response({
        **UserSerializer(user).data,
        'has_submitted':      has_submitted,
        'retake_allowed':     retake_allowed,
        **serialize_attempt_integrity(latest_response),
        'active_assessment':  active_assessment,
        'batch':              {
            'id':   enrollment.batch.id,
            'name': enrollment.batch.name,
        } if enrollment else None,
        # Students only receive their finalized placement. Removed/rejected
        # history remains internal to coordinators and instructors.
        'placement': _serialize_placement_visibility(approved_placement),
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
        return Response([{
            'id': c.id, 'name': c.name, 'description': c.description, 'tags': c.tags or []
        } for c in cats])

    # POST — create new category (instructor or admin only)
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)

    name = request.data.get('name', '').strip()
    if not name:
        return Response({'error': 'name is required'}, status=400)

    cat, created = SkillCategory.objects.get_or_create(
        name__iexact=name,
        defaults={
            'name': name,
            'description': request.data.get('description', ''),
            'tags': normalize_tags(request.data.get('tags')),
            'created_by': request.user,
        }
    )
    return Response(
        {'id': cat.id, 'name': cat.name, 'tags': cat.tags or [], 'created': created},
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def suggest_tags_view(request):
    """Suggest editable tags without persisting or overwriting saved tags."""
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)

    tag_type = request.data.get('type')
    if tag_type == 'skill':
        return Response({'suggested_tags': suggest_skill_tags(
            request.data.get('name', ''), request.data.get('description', '')
        )})
    if tag_type == 'position':
        requirements = []
        for category_name, percentage in (request.data.get('requirements') or {}).items():
            category = SkillCategory.objects.filter(name__iexact=category_name).first()
            requirements.append({
                'name': category_name,
                'percentage': percentage,
                'tags': category.tags if category else [],
            })
        return Response({'suggested_tags': suggest_position_tags(
            request.data.get('title', ''), requirements
        )})
    return Response({'error': 'type must be skill or position'}, status=400)


def _nlp_config_payload(config, include_status=False):
    options = []
    for model_id, metadata in MODEL_OPTIONS.items():
        option = {'id': model_id, **metadata}
        if include_status:
            option.update(model_status(model_id))
        options.append(option)
    return {
        'active_model': config.active_model,
        'active_model_label': MODEL_OPTIONS[config.active_model]['label'],
        'default_model': 'spacy_md',
        'models': options,
        'updated_at': config.updated_at,
    }


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def admin_nlp_configuration(request):
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)
    config = RecommendationConfiguration.get_active()
    if request.method == 'GET':
        return Response(_nlp_config_payload(config, include_status=True))

    model_id = request.data.get('active_model')
    if model_id not in MODEL_OPTIONS:
        return Response({'error': 'Unsupported NLP model.'}, status=400)
    config.active_model = model_id
    config.updated_by = request.user
    config.save(update_fields=['active_model', 'updated_by', 'updated_at'])
    payload = _nlp_config_payload(config, include_status=True)
    payload['message'] = 'Active NLP model updated. Re-run recommendations to refresh saved scores.'
    return Response(payload)


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
    # Each item: { email, name, course?, studentId? }
    enrolled = []
    errors   = []

    for item in students_data:
        email     = item.get('email', '').strip().lower()
        name      = item.get('name',  '').strip()
        course    = item.get('course', '').strip()
        school_id = item.get('studentId', item.get('student_id', '')).strip()
        if not email:
            errors.append({'email': email, 'error': 'email required'})
            continue

        try:
            student = User.objects.get(email=email, role='student')
            # If student self-registered but is still pending, auto-approve when enrolled.
            update_fields = []
            if not student.is_approved:
                student.is_approved = True
                update_fields.append('is_approved')
            # Update course/school_id if provided by instructor and student hasn't set them yet
            if course and not student.course:
                student.course = course
                update_fields.append('course')
            if school_id and not student.school_id:
                student.school_id = school_id
                update_fields.append('school_id')
            if update_fields:
                student.save(update_fields=update_fields)
        except User.DoesNotExist:
            # Auto-create student account (will log in via Google)
            student = User.objects.create(
                email=email,
                name=name or email.split('@')[0],
                role='student',
                course=course,
                school_id=school_id,
                is_approved=True,
                is_active=True,
            )
            student.set_unusable_password()
            student.save()

        _, created = BatchEnrollment.objects.get_or_create(batch=batch, student=student)
        enrolled.append({'email': email, 'name': student.name, 'created': created})

        # ── Send enrollment notification email (only for new enrollments) ──
        print(f"[SkillBridge DEBUG] Processing enrollment for {email}. Enrollment created? {created}")
        if created:
            print(f"[SkillBridge DEBUG] Preparing to send enrollment email to {student.email}")
            frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
            html = get_student_enrollment_email_html(
                student_name=student.name,
                instructor_name=request.user.name,
                batch_name=batch.name,
                frontend_url=frontend_url,
            )
            send_instructor_email(
                user=student,
                subject='You have been enrolled in SkillBridge — Complete your OJT Assessment',
                body=(
                    f'Hi {student.name},\n\n'
                    f'Your OJT instructor {request.user.name} has enrolled you in {batch.name} on SkillBridge.\n'
                    f'Sign in with your DNSC Google account at {frontend_url}/login to take your assessment.\n\n'
                    f'— SkillBridge, Davao del Norte State College'
                ),
                html_body=html,
            )
        else:
            print(f"[SkillBridge DEBUG] Enrollment not newly created for {email}, skipping email send.")

    return Response({'enrolled': enrolled, 'errors': errors}, status=200)


# ── POST /api/instructor/batches/{id}/archive/ ───────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def instructor_batch_archive(request, batch_id):
    """Mark a batch as archived (read-only). Only the owning instructor can do this."""
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        batch = Batch.objects.get(id=batch_id, instructor=request.user)
    except Batch.DoesNotExist:
        return Response({'error': 'Batch not found'}, status=404)
    batch.status      = 'archived'
    batch.archived_at = timezone.now()
    batch.save(update_fields=['status', 'archived_at'])
    # Deactivate all assessments linked to this batch so students can no longer take them
    Assessment.objects.filter(batch=batch).update(is_active=False)
    return Response({'id': batch.id, 'status': 'archived', 'archived_at': batch.archived_at})


# ── POST /api/instructor/batches/{id}/unarchive/ ─────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def instructor_batch_unarchive(request, batch_id):
    """Mark a batch as active. Only the owning instructor can do this."""
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        batch = Batch.objects.get(id=batch_id, instructor=request.user)
    except Batch.DoesNotExist:
        return Response({'error': 'Batch not found'}, status=404)
    batch.status      = 'active'
    batch.archived_at = None
    batch.save(update_fields=['status', 'archived_at'])
    # Re-activate assessments linked to this batch
    Assessment.objects.filter(batch=batch).update(is_active=True)
    return Response({'id': batch.id, 'status': 'active', 'archived_at': None})


# ── PATCH /api/instructor/students/{id}/retake/ ──────────────────
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def instructor_student_retake(request, student_id):
    """Toggle retake_allowed for the student's latest submission."""
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)
    retake_allowed = request.data.get('retake_allowed', False)
    if request.user.role == 'instructor':
        belongs_to_instructor = BatchEnrollment.objects.filter(
            batch__instructor=request.user,
            student_id=student_id,
        ).exists()
        if not belongs_to_instructor:
            return Response({'error': 'Student not in your batches'}, status=403)

    latest_response = (
        StudentResponse.objects
        .filter(student_id=student_id, submitted_at__isnull=False)
        .order_by('-started_at', '-id')
        .first()
    )
    if latest_response is None:
        return Response({'error': 'No submission found for this student'}, status=404)
    latest_response.retake_allowed = bool(retake_allowed)
    latest_response.save(update_fields=['retake_allowed'])
    return Response({
        'student_id': student_id,
        'retake_allowed': latest_response.retake_allowed,
        **serialize_attempt_integrity(latest_response),
    })


# ── DELETE /api/instructor/students/{id}/ ────────────────────────
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def instructor_student_remove(request, student_id):
    """Unenroll a student from all of this instructor's batches."""
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)
    batches = Batch.objects.filter(instructor=request.user)
    deleted, _ = BatchEnrollment.objects.filter(
        batch__in=batches, student_id=student_id
    ).delete()
    if deleted == 0:
        return Response({'error': 'Student not found in your batches'}, status=404)
    return Response({'deleted': True, 'student_id': student_id})


# ── GET /api/instructor/batches/{id}/students/ ───────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_batch_students(request, batch_id):
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)

    try:
        batch_query = Batch.objects.filter(id=batch_id)
        if request.user.role == 'instructor':
            batch_query = batch_query.filter(instructor=request.user)
        batch = batch_query.get()
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
            scores_map[score.student_id][score.skill_category.name] = {
                'percentage': round(score.percentage, 1),
                'tag': get_qualitative_tag(score.percentage)
            }

    profile_map = latest_competency_profiles(student_ids, batch_assessment) if batch_assessment else {}

    # ── Bulk-load top-3 company recommendations per student ──────────
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

    placements_by_student = _visible_placements_by_student(student_ids)

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
            **serialize_attempt_integrity(resp),
            'skill_scores':   scores_map.get(s.id, {}),
            'competency_profile': serialize_competency_profile(profile_map.get(s.id)),
            'enrolled_at':    e.enrolled_at,
            'address':        s.address or {},
            'placement':      _serialize_placement_visibility(
                placements_by_student.get(s.id), include_unplaced=True,
            ),
            'top_recommendations': [
                {
                    'position':    r.position.title,
                    'company':     r.position.company.name,
                    'match_score': round(r.match_score, 2),
                    'category_score_component': round(r.category_score_component, 2),
                    'nlp_score_component': round(r.nlp_score_component, 2),
                    'location_score_component': round(r.location_score_component, 2),
                    'model_used': r.model_used,
                    'distance_km': r.distance_km,
                    'lat':         r.position.company.location_lat,
                    'lng':         r.position.company.location_lng,
                }
                for r in recs_by_student.get(s.id, [])
            ],
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

        # Deactivate any existing active assessments for this batch
        Assessment.objects.filter(batch=batch, is_active=True).update(is_active=False)

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

    existing = StudentResponse.objects.filter(student=user, assessment=assessment).first()
    if existing and existing.status == StudentResponse.STATUS_STOPPED and not existing.retake_allowed:
        return Response({
            'id': assessment.id,
            'title': assessment.title,
            'duration_minutes': assessment.duration_minutes,
            'batch_name': enrollment.batch.name,
            **serialize_attempt_integrity(existing),
        })
    if existing and existing.submitted_at is not None and not existing.retake_allowed:
        return Response({'error': 'already_submitted'}, status=409)

    return Response({
        'id':               assessment.id,
        'title':            assessment.title,
        'duration_minutes': assessment.duration_minutes,
        'batch_name':       enrollment.batch.name,
        **serialize_attempt_integrity(existing),
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

    # Lock the response while its layout is first created. This prevents two
    # near-simultaneous /start/ requests from returning different arrangements.
    with transaction.atomic():
        now = timezone.now()
        response_obj, created = (
            StudentResponse.objects.select_for_update().get_or_create(
                student=user,
                assessment=assessment,
                defaults={'started_at': now},
            )
        )

        if created:
            response_obj.question_layout = build_question_layout(assessment)
            response_obj.status = StudentResponse.STATUS_IN_PROGRESS
            response_obj.save(update_fields=['question_layout', 'status'])
        elif response_obj.submitted_at is not None:
            if not response_obj.retake_allowed:
                return Response({'error': 'Assessment already submitted'}, status=409)

            # The existing model keeps one response row per student/assessment.
            # Starting an allowed retake turns that row into a fresh attempt.
            response_obj.answers.all().delete()
            SkillScore.objects.filter(student=user, assessment=assessment).delete()
            Recommendation.objects.filter(student=user).delete()
            response_obj.started_at = now
            response_obj.submitted_at = None
            response_obj.retake_allowed = False
            response_obj.question_layout = build_question_layout(assessment)
            response_obj.status = StudentResponse.STATUS_IN_PROGRESS
            response_obj.stopped_reason = ''
            response_obj.stopped_reason_display = ''
            response_obj.stopped_at = None
            response_obj.violation_count = 0
            response_obj.violation_events = []
            response_obj.is_flagged = False
            response_obj.save(update_fields=[
                'started_at', 'submitted_at', 'retake_allowed', 'question_layout',
                'status', 'stopped_reason', 'stopped_reason_display', 'stopped_at',
                'violation_count', 'violation_events', 'is_flagged',
            ])
        else:
            update_fields = []
            if response_obj.started_at is None:
                response_obj.started_at = now
                update_fields.append('started_at')
            if not response_obj.question_layout:
                response_obj.question_layout = build_question_layout(assessment)
                update_fields.append('question_layout')
            if update_fields:
                response_obj.save(update_fields=update_fields)

    # Build question list (no correct answer revealed)
    q_list = []
    for q in ordered_questions(assessment, response_obj.question_layout):
        q_list.append({
            'id':            q.id,
            'question_text': q.question_text,
            'question_type': q.question_type,
            'category':      q.skill_category.name if q.skill_category else '',
            'choices': [
                {'id': choice.id, 'text': choice.choice_text}
                for choice in ordered_choices(q, response_obj.question_layout)
            ],
        })

    return Response({
        'response_id':    response_obj.id,
        'started_at':     response_obj.started_at,
        'time_limit_sec': assessment.duration_minutes * 60,
        'questions':      q_list,
        'status':         response_obj.status,
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

    answers_data = request.data.get('answers', [])
    if not isinstance(answers_data, list):
        return Response({'error': 'answers must be a list'}, status=400)
    categories   = list(SkillCategory.objects.all())

    # The row lock makes normal submit and integrity stop mutually exclusive.
    # Whichever request finalizes the attempt first wins.
    with transaction.atomic():
        try:
            response_obj = StudentResponse.objects.select_for_update().get(
                student=user,
                assessment=assessment,
            )
        except StudentResponse.DoesNotExist:
            return Response({'error': 'No in-progress attempt found. Call /start/ first.'}, status=400)

        response_id = request.data.get('response_id')
        if response_id and str(response_obj.id) != str(response_id):
            return Response({'error': 'Attempt does not match response_id.'}, status=400)
        if response_obj.status != StudentResponse.STATUS_IN_PROGRESS or response_obj.submitted_at is not None:
            return Response({'error': 'Assessment attempt is already finalized.'}, status=409)

        # Timer validation remains non-blocking, matching the existing behavior.
        if response_obj.started_at:
            elapsed = (timezone.now() - response_obj.started_at).total_seconds()
            allowed = assessment.duration_minutes * 60 + 30
            if elapsed > allowed:
                pass

        score_results = score_submission(response_obj, answers_data, categories)
        response_obj.submitted_at = timezone.now()
        response_obj.status = StudentResponse.STATUS_SUBMITTED
        response_obj.is_flagged = False
        response_obj.save(update_fields=['submitted_at', 'status', 'is_flagged'])

    # ── Generate recommendations (cosine similarity) ─────────────
    recommendations = generate_recommendations(user, assessment, categories)

    # ── Build correct-answer map for frontend Answer Review ──────────
    # Safe to expose now — exam is already locked (submitted_at is set).
    correct_answers = {}
    for q in assessment.questions.prefetch_related('choices').all():
        correct_choice = q.choices.filter(is_correct=True).first()
        if not correct_choice:
            continue
        if q.question_type == 'identification':
            correct_answers[q.id] = {'type': 'identification', 'text': correct_choice.choice_text}
        else:
            correct_answers[str(q.id)] = {'type': 'choice', 'id': correct_choice.id, 'text': correct_choice.choice_text}

    return Response({
        'message':         'Assessment submitted successfully.',
        'scores':          score_results,
        'recommendations': recommendations[:5],   # top 5
        'correct_answers': correct_answers,
    })


# ── POST /api/assessments/{id}/stop/ ──────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assessment_stop(request, assessment_id):
    """Finalize an attempt after the first browser integrity rule is triggered."""
    from .scoring import score_submission, generate_recommendations

    user = request.user
    if user.role != 'student':
        return Response({'error': 'Students only'}, status=403)

    try:
        assessment = Assessment.objects.get(id=assessment_id)
    except Assessment.DoesNotExist:
        return Response({'error': 'Assessment not found'}, status=404)

    reason = request.data.get('reason', '')
    if reason not in INTEGRITY_REASON_DISPLAYS:
        return Response({'error': 'Invalid integrity stop reason.'}, status=400)
    answers_data = request.data.get('answers', [])
    if not isinstance(answers_data, list):
        return Response({'error': 'answers must be a list'}, status=400)
    # Integrity stops record only genuinely completed responses, not inputs a
    # student touched and then cleared before the rule was triggered.
    answers_data = [
        answer for answer in answers_data
        if isinstance(answer, dict) and (
            answer.get('selected_choice_id') or
            str(answer.get('text_answer', '')).strip()
        )
    ]

    detail = str(request.data.get('detail', '')).strip()[:120]
    base_display = INTEGRITY_REASON_DISPLAYS[reason]
    reason_display = f'{base_display} ({detail})' if detail else base_display
    categories = list(SkillCategory.objects.all())

    with transaction.atomic():
        try:
            response_obj = StudentResponse.objects.select_for_update().get(
                student=user,
                assessment=assessment,
            )
        except StudentResponse.DoesNotExist:
            return Response({'error': 'No in-progress attempt found. Call /start/ first.'}, status=400)

        response_id = request.data.get('response_id')
        if response_id and str(response_obj.id) != str(response_id):
            return Response({'error': 'Attempt does not match response_id.'}, status=400)

        # Stop retries are intentionally idempotent: never rescore or append events.
        if response_obj.status == StudentResponse.STATUS_STOPPED:
            return Response({
                'message': 'Assessment was already stopped.',
                'already_stopped': True,
                **serialize_attempt_integrity(response_obj),
            })
        if response_obj.status != StudentResponse.STATUS_IN_PROGRESS or response_obj.submitted_at is not None:
            return Response({'error': 'Assessment attempt is already finalized.'}, status=409)

        score_submission(response_obj, answers_data, categories)
        stopped_at = timezone.now()
        response_obj.status = StudentResponse.STATUS_STOPPED
        response_obj.submitted_at = stopped_at
        response_obj.stopped_at = stopped_at
        response_obj.stopped_reason = reason
        response_obj.stopped_reason_display = reason_display
        response_obj.violation_count = 1
        response_obj.violation_events = [{
            'reason': reason,
            'display': reason_display,
            'detail': detail,
            'occurred_at': request.data.get('occurred_at') or stopped_at.isoformat(),
            'recorded_at': stopped_at.isoformat(),
        }]
        response_obj.is_flagged = True
        response_obj.retake_allowed = False
        response_obj.save(update_fields=[
            'status', 'submitted_at', 'stopped_at', 'stopped_reason',
            'stopped_reason_display', 'violation_count', 'violation_events',
            'is_flagged', 'retake_allowed',
        ])

    recommendations = generate_recommendations(user, assessment, categories)
    return Response({
        'message': 'Assessment stopped and completed answers recorded.',
        'scores_saved': True,
        'recommendations': recommendations[:5],
        **serialize_attempt_integrity(response_obj),
    })


# ════════════════════════════════════════════════════════════════════════════
# INSTRUCTOR — Recommendations / Student Results
# ════════════════════════════════════════════════════════════════════════════

# ── GET /api/instructor/students/recommendations/ ─────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_student_recommendations(request):
    """
    Returns students in the instructor's ACTIVE batch with their top 3 recommended positions.
    Only shows the current cohort so the dashboard reflects live progress, not archived history.
    Used by InstructorDashboard.
    """
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)

    # ── Only pull from the active batch ───────────────────────────
    active_batch = Batch.objects.filter(instructor=request.user, status='active').first()
    if not active_batch:
        return Response([])  # No active batch → empty dashboard (not archived data)

    enrollments = list(
        BatchEnrollment.objects
        .filter(batch=active_batch)
        .select_related('student', 'batch')
    )
    student_ids = list({e.student_id for e in enrollments})
    profile_map = latest_competency_profiles(student_ids)
    response_map = {}
    for attempt in (
        StudentResponse.objects
        .filter(student_id__in=student_ids, assessment__batch=active_batch)
        .order_by('student_id', '-started_at', '-id')
    ):
        response_map.setdefault(attempt.student_id, attempt)

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

    placements_by_student = _visible_placements_by_student(student_ids)

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
        attempt = response_map.get(student.id)
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
            'has_submitted': bool(attempt and attempt.submitted_at is not None),
            'retake_allowed': attempt.retake_allowed if attempt else False,
            **serialize_attempt_integrity(attempt),
            'skill_scores': {sc['category']: sc['percentage'] for sc in scores_by_student.get(student.id, [])},
            'competency_profile': serialize_competency_profile(profile_map.get(student.id)),
            'batch':       {'id': e.batch.id, 'name': e.batch.name},
            'address':     student.address or {},
            'placement':   _serialize_placement_visibility(
                placements_by_student.get(student.id), include_unplaced=True,
            ),
            'top_recommendations': [
                {
                    'position':    r.position.title,
                    'company':     r.position.company.name,
                    'match_score': r.match_score,
                    'category_score_component': r.category_score_component,
                    'nlp_score_component': r.nlp_score_component,
                    'location_score_component': r.location_score_component,
                    'model_used': r.model_used,
                    'distance_km': r.distance_km,
                    'lat':         r.position.company.location_lat,
                    'lng':         r.position.company.location_lng,
                }
                for r in top_recs
            ],
        })

    return Response(results)


# ── GET /api/instructor/companies/ ───────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def instructor_companies(request):
    """
    Returns all companies with positions.
    For each position, includes matched students from this instructor's batches,
    sorted by match score descending.
    """
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)

    # Students belonging to this instructor's batches
    batches = Batch.objects.filter(instructor=request.user)
    enrollments = BatchEnrollment.objects.filter(batch__in=batches).select_related('batch')
    
    student_batch_info = {}
    for e in enrollments:
        student_batch_info[e.student_id] = {
            'name': e.batch.name,
            'status': e.batch.status
        }
    student_ids = list(student_batch_info.keys())

    # Bulk-load all recommendations for those students
    from collections import defaultdict
    all_recs = (
        Recommendation.objects
        .filter(student_id__in=student_ids)
        .select_related('student', 'position')
        .order_by('position_id', '-match_score')
    )
    recs_by_position = defaultdict(list)
    for r in all_recs:
        recs_by_position[r.position_id].append(r)

    companies = (
        Company.objects
        .prefetch_related('positions', 'positions__requirements', 'positions__requirements__skill_category')
        .order_by('name')
    )

    result = []
    for company in companies:
        positions_data = []
        for pos in company.positions.all().order_by('title'):
            matched = [
                {
                    'id':          r.student.id,
                    'name':        r.student.name,
                    'school_id':   r.student.school_id,
                    'course':      r.student.course,
                    'photo_url':   r.student.photo_url,
                    'match_score': round(float(r.match_score), 1),
                    'category_score_component': round(float(r.category_score_component), 1),
                    'nlp_score_component': round(float(r.nlp_score_component), 1),
                    'location_score_component': round(float(r.location_score_component), 1),
                    'model_used': r.model_used,
                    'distance_km': r.distance_km,
                    'batch_name':  student_batch_info.get(r.student.id, {}).get('name', ''),
                    'batch_status': student_batch_info.get(r.student.id, {}).get('status', 'active'),
                }
                for r in recs_by_position.get(pos.id, [])
            ]
            positions_data.append({
                'id':              pos.id,
                'title':           pos.title,
                'slots':           pos.slots_available,
                'tags':            pos.tags or [],
                'requirements': {
                    requirement.skill_category.name: requirement.required_percentage
                    for requirement in pos.requirements.all()
                },
                'matched_students': matched,
                'matched_count':   len(matched),
            })
        result.append({
            'id':            company.id,
            'name':          company.name,
            'address':       company.address or {},
            'lat':           company.location_lat,
            'lng':           company.location_lng,
            'positions':     positions_data,
            'total_matched': sum(p['matched_count'] for p in positions_data),
        })

    return Response(result)


# ── PATCH /api/instructor/companies/<co_id>/ ────────────────────────
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def instructor_company_edit(request, co_id):
    """
    Allows instructors to edit company info and position details.
    Accepts:
      { name, address, lat, lng,
        positions: [{ id, title, slots, tags }] }
    """
    if request.user.role not in ('instructor', 'admin'):
        return Response({'error': 'Forbidden'}, status=403)

    try:
        company = Company.objects.get(id=co_id)
    except Company.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)

    data = request.data
    # Never let a slot edit make an existing approved placement over capacity.
    for pos_data in data.get('positions', []):
        if 'slots' not in pos_data:
            continue
        try:
            position = company.positions.get(id=pos_data['id'])
            requested_slots = int(pos_data['slots'])
        except (KeyError, TypeError, ValueError, Position.DoesNotExist):
            return Response({'error': 'Invalid position or slots value.'}, status=400)
        approved_count = position.ojt_placements.filter(
            status=OJTPlacement.STATUS_APPROVED,
        ).count()
        if requested_slots < approved_count:
            return Response({
                'error': 'slots cannot be lower than the approved placement count.',
                'position_id': position.id,
                'approved_count': approved_count,
            }, status=409)

    if 'name'    in data: company.name         = data['name']
    if 'address' in data: company.address      = data['address']
    if 'lat'     in data: company.location_lat  = data['lat']
    if 'lng'     in data: company.location_lng  = data['lng']
    company.save()

    for pos_data in data.get('positions', []):
        try:
            pos = company.positions.get(id=pos_data['id'])
            if 'title' in pos_data: pos.title           = pos_data['title']
            if 'slots' in pos_data: pos.slots_available = pos_data['slots']
            if 'tags' in pos_data: pos.tags = normalize_tags(pos_data.get('tags'))
            pos.save()
        except Position.DoesNotExist:
            pass

    return Response({'ok': True, 'id': company.id, 'name': company.name})


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
    latest = (
        StudentResponse.objects
        .filter(student=user, submitted_at__isnull=False)
        .order_by('-submitted_at')
        .select_related('assessment')
        .first()
    )
    competency_profile = (
        StudentCompetencyProfile.objects
        .filter(student=user, assessment=latest.assessment)
        .first()
        if latest else None
    )
    approved_placement = _approved_student_placement(user.id)

    # Auto-generate missing legacy profiles/recommendations after deployment.
    if skill_scores.exists() and latest and (not recommendations.exists() or competency_profile is None):
        try:
            from .scoring import generate_recommendations
            cats = list(SkillCategory.objects.all())
            generate_recommendations(user, latest.assessment, cats)
            competency_profile = StudentCompetencyProfile.objects.filter(
                student=user, assessment=latest.assessment
            ).first()
            recommendations = (
                Recommendation.objects
                .filter(student=user)
                .select_related('position', 'position__company')
                .order_by('-match_score')
            )
        except Exception:
            pass

    return Response({
        'skill_scores': [
            {
                'category':   ss.skill_category.name,
                'raw_score':  ss.raw_score,
                'max_score':  ss.max_score,
                'percentage': round(ss.percentage, 1),
                'tag':        get_qualitative_tag(ss.percentage),
            }
            for ss in skill_scores.order_by('-percentage')
        ],
        'recommendations': [serialize_recommendation(r) for r in recommendations],
        'competency_profile': serialize_competency_profile(competency_profile, include_nlp_text=False),
        'active_model': RecommendationConfiguration.get_active().active_model,
        'placement': _serialize_placement_visibility(approved_placement),
    })


# ── GET /api/student/results/review/ ─────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_results_review(request):
    """
    Returns the student's submitted answers with correct answers from the DB.
    Bypasses localStorage — always reflects DB truth for the Answer Review.
    """
    user = request.user
    if user.role != 'student':
        return Response({'error': 'Students only'}, status=403)

    latest_response = (
        StudentResponse.objects
        .filter(student=user, submitted_at__isnull=False)
        .order_by('-submitted_at')
        .select_related('assessment')
        .first()
    )
    if not latest_response:
        return Response({'questions': [], 'answers': {}})

    questions = ordered_questions(
        latest_response.assessment,
        latest_response.question_layout,
    )
    submitted = {
        ra.question_id: ra
        for ra in ResponseAnswer.objects.filter(response=latest_response)
            .select_related('selected_choice')
    }

    q_list = []
    answers = {}

    for q in questions:
        correct_choice = q.choices.filter(is_correct=True).first()
        is_ident = q.question_type == 'identification'
        ra = submitted.get(q.id)

        q_dict = {
            'id':            q.id,
            'question_text': q.question_text,
            'question_type': q.question_type,
            'category':      q.skill_category.name if q.skill_category else '',
        }
        if is_ident:
            q_dict['correct_text'] = correct_choice.choice_text if correct_choice else ''
            q_dict['choices']      = []
        else:
            q_dict['choices'] = [
                {'id': c.id, 'text': c.choice_text, 'is_correct': c.is_correct}
                for c in ordered_choices(q, latest_response.question_layout)
            ]
        q_list.append(q_dict)

        if ra:
            answers[str(q.id)] = {
                'selected_choice_id': ra.selected_choice_id if not is_ident else None,
                'text_answer':        ra.text_answer if is_ident else '',
            }

    return Response({'questions': q_list, 'answers': answers})


# ── GET /api/student/companies/ ───────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_companies(request):
    """
    Returns ALL partner companies with positions and match scores.
    Used for the 'Browse all companies' tab on the Results page.
    """
    user = request.user
    if user.role != 'student':
        return Response({'error': 'Students only'}, status=403)

    user_recs = {
        r.position_id: r.match_score
        for r in Recommendation.objects.filter(student=user)
    }

    companies = (
        Company.objects
        .prefetch_related(
            'positions',
            'positions__requirements',
            'positions__requirements__skill_category',
        )
        .all()
    )

    result = []
    for company in companies:
        positions = [
            {
                'id':          p.id,
                'title':       p.title,
                'slots':       p.slots_available,
                'match_score': round(user_recs.get(p.id, 0), 1),
                'tags': [
                    req.skill_category.name
                    for req in p.requirements.all()
                ] + list(p.tags or []),
            }
            for p in company.positions.all()
        ]
        result.append({
            'id':       company.id,
            'name':     company.name,
            'address':  ', '.join(filter(None, [
                (company.address or {}).get('barangay', ''),
                (company.address or {}).get('city', ''),
                (company.address or {}).get('province', ''),
            ])) or None,
            'lat':       company.location_lat,
            'lng':       company.location_lng,
            'positions': positions,
        })
    return Response(result)


# ── GET /api/admin/students/recommendations/ ──────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_student_recommendations(request):
    """Admin-wide view: all students with their top recommendations."""
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)

    students = list(User.objects.filter(role='student', is_active=True))
    student_ids = [s.id for s in students]
    profile_map = latest_competency_profiles(student_ids)

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
            'photo_url':        student.photo_url,
            'instructor_name':  instructor_by_student.get(student.id, ''),
            'has_submitted':    bool(top_one),
            'top_match_score':  round(top_one.match_score, 2) if top_one else None,
            'top_position_name': top_one.position.title if top_one else None,
            'top_company_name':  top_one.position.company.name if top_one else None,
            'competency_profile': serialize_competency_profile(profile_map.get(student.id)),
            'student': {
                'id':        student.id,
                'name':      student.name,
                'email':     student.email,
                'school_id': student.school_id,
                'course':    student.course,
                'photo_url': student.photo_url,
            },
            'top_recommendations': [
                {
                    'position':    r.position.title,
                    'company':     r.position.company.name,
                    'match_score': r.match_score,
                    'category_score_component': r.category_score_component,
                    'nlp_score_component': r.nlp_score_component,
                    'location_score_component': r.location_score_component,
                    'model_used': r.model_used,
                    'distance_km': r.distance_km,
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
    profile_map = latest_competency_profiles(student_ids)
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

    response_by_student = {}
    for attempt in (
        StudentResponse.objects
        .filter(student_id__in=student_ids)
        .order_by('student_id', '-started_at', '-id')
    ):
        response_by_student.setdefault(attempt.student_id, attempt)

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
        attempt = response_by_student.get(s.id)
        student_status = (
            'stopped' if attempt and attempt.status == StudentResponse.STATUS_STOPPED
            else 'completed' if attempt and attempt.status == StudentResponse.STATUS_SUBMITTED
            else 'pending'
        )
        students_out.append({
            'id':               s.id,
            'name':             s.name,
            'email':            s.email,
            'student_id':       s.school_id or '',
            'course':           s.course or '',
            'instructor':       instructor_by_student.get(s.id, 'TBD'),
            'status':           student_status,
            'top_match_score':  round(top_rec.match_score, 2) if top_rec else None,
            'top_position_name': top_rec.position.title if top_rec else None,
            'top_company_name':  top_rec.position.company.name if top_rec else None,
            'retake_allowed':    attempt.retake_allowed if attempt else False,
            **serialize_attempt_integrity(attempt),
            'address':           s.address or {},
            'photo_url':         s.photo_url,
            'competency_profile': serialize_competency_profile(profile_map.get(s.id)),
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
            'photo_url':    user.photo_url,
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
                    'tags':   pos.tags or [],
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
        try:
            company.delete()
        except ProtectedError:
            return Response({
                'error': 'Company cannot be deleted while placement history references it.',
            }, status=409)
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
    tags     = normalize_tags(request.data.get('tags'))

    if not title:
        return Response({'error': 'title is required'}, status=400)

    position = Position.objects.create(
        company=company,
        title=title,
        slots_available=slots,
        tags=tags,
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

    # Re-score all existing students against the new position
    _rerun_recommendations_for_all_students()

    return Response({
        'id':    position.id,
        'title': position.title,
        'slots': position.slots_available,
        'tags':  position.tags or [],
    }, status=201)


def _rerun_recommendations_for_all_students():
    """
    Called after a new position is added.
    Re-runs generate_recommendations() for every student who has already
    submitted so the new position gets scored against their existing skill
    profile. Uses update_or_create internally — no duplicates created.
    """
    try:
        from .scoring import generate_recommendations
        cats = list(SkillCategory.objects.all())
        submitted = (
            StudentResponse.objects
            .filter(submitted_at__isnull=False)
            .order_by('student_id', '-submitted_at')
            .distinct('student_id')
            .select_related('student', 'assessment')
        )
        for resp in submitted:
            try:
                generate_recommendations(resp.student, resp.assessment, cats)
            except Exception:
                pass  # Never let one student's failure break the loop
    except Exception:
        pass  # Fail silently — position was still created successfully



# ── POST /api/admin/rerun-recommendations/ ────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_rerun_recommendations(request):
    """
    Manually re-run recommendation scoring for ALL students who have
    already submitted an assessment. Useful after bulk company/position
    changes or if scores look stale.
    """
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)

    try:
        from .scoring import generate_recommendations
        cats = list(SkillCategory.objects.all())
        submitted = (
            StudentResponse.objects
            .filter(submitted_at__isnull=False)
            .order_by('student_id', '-submitted_at')
            .distinct('student_id')
            .select_related('student', 'assessment')
        )
        count = 0
        errors = 0
        for resp in submitted:
            try:
                generate_recommendations(resp.student, resp.assessment, cats)
                count += 1
            except Exception:
                errors += 1

        return Response({
            'ok': True,
            'students_processed': count,
            'errors': errors,
            'active_model': RecommendationConfiguration.get_active().active_model,
            'message': f'Recommendations re-run for {count} student(s).',
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)


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
        try:
            position.delete()
        except ProtectedError:
            return Response({
                'error': 'Position cannot be deleted while placement history references it.',
            }, status=409)
        return Response(status=204)
 
    # ── PATCH ─────────────────────────────────────────────────────────────────
    if 'title' in request.data:
        title = (request.data['title'] or '').strip()
        if title:
            position.title = title
 
    if 'slots' in request.data:
        try:
            requested_slots = max(1, int(request.data['slots']))
        except (TypeError, ValueError):
            return Response({'error': 'slots must be an integer.'}, status=400)
        approved_count = position.ojt_placements.filter(
            status=OJTPlacement.STATUS_APPROVED,
        ).count()
        if requested_slots < approved_count:
            return Response({
                'error': 'slots cannot be lower than the approved placement count.',
                'approved_count': approved_count,
            }, status=409)
        position.slots_available = requested_slots

    if 'tags' in request.data:
        position.tags = normalize_tags(request.data.get('tags'))
 
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
        'tags':         position.tags or [],
        'requirements': updated_reqs,
    })

# ── GET/POST /api/admin/skills/ ───────────────────────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_skills(request):
    if request.user.role != 'admin':
        return Response({'error': 'Forbidden'}, status=403)
    
    if request.method == 'GET':
        cats = SkillCategory.objects.all().order_by('name')
        return Response([{
            'id': c.id, 'name': c.name, 'description': c.description, 'tags': c.tags or []
        } for c in cats])
        
    elif request.method == 'POST':
        name = request.data.get('name', '').strip()
        description = request.data.get('description', '').strip()
        tags = normalize_tags(request.data.get('tags'))
        if not name:
            return Response({'error': 'Name is required'}, status=400)
            
        cat, created = SkillCategory.objects.get_or_create(
            name__iexact=name,
            defaults={'name': name, 'description': description, 'tags': tags, 'created_by': request.user}
        )
        if not created:
            return Response({'error': 'Skill category already exists'}, status=400)
            
        return Response({
            'id': cat.id, 'name': cat.name, 'description': cat.description, 'tags': cat.tags or []
        }, status=201)

# ── PUT/DELETE /api/admin/skills/<id>/ ────────────────────────────────────
@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def admin_skill_detail(request, skill_id):
    if request.user.role != 'admin':
        return Response({'error': 'Forbidden'}, status=403)
        
    try:
        cat = SkillCategory.objects.get(id=skill_id)
    except SkillCategory.DoesNotExist:
        return Response({'error': 'Skill not found'}, status=404)
        
    if request.method == 'PUT':
        name = request.data.get('name', '').strip()
        description = request.data.get('description', '').strip()
        tags = normalize_tags(request.data.get('tags'))
        if not name:
            return Response({'error': 'Name is required'}, status=400)
            
        if SkillCategory.objects.filter(name__iexact=name).exclude(id=skill_id).exists():
            return Response({'error': 'Another skill with this name already exists'}, status=400)
            
        cat.name = name
        cat.description = description
        cat.tags = tags
        cat.save(update_fields=['name', 'description', 'tags'])
        return Response({
            'id': cat.id, 'name': cat.name, 'description': cat.description, 'tags': cat.tags or []
        })
        
    elif request.method == 'DELETE':
        cat.delete()
        return Response(status=204)



# ── GET /api/admin/reports/ ───────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_reports(request):
    if request.user.role != 'admin':
        return Response({'error': 'Forbidden'}, status=403)

    from django.db.models import Count, Avg

    # --- Submission stats ---
    total_students      = User.objects.filter(role='student', is_active=True).count()
    submitted_students  = StudentResponse.objects.filter(submitted_at__isnull=False).values('student').distinct().count()
    pending_students    = total_students - submitted_students

    # --- Recommendation stats ---
    total_recs = Recommendation.objects.count()
    strong_matches = Recommendation.objects.filter(match_score__gte=80).count()
    fair_matches   = Recommendation.objects.filter(match_score__gte=60, match_score__lt=80).count()
    low_matches    = Recommendation.objects.filter(match_score__lt=60).count()

    # --- Average match score ---
    avg_score_data = Recommendation.objects.aggregate(avg=Avg('match_score'))
    avg_score = round(avg_score_data['avg'] or 0, 1)

    # --- Skill category breakdown (avg score per category) ---
    skill_scores = (
        SkillScore.objects
        .values('skill_category__name')
        .annotate(avg_pct=Avg('percentage'), student_count=Count('student', distinct=True))
        .order_by('-avg_pct')
    )
    skill_breakdown = [
        {
            'category': s['skill_category__name'],
            'avg_score': round(s['avg_pct'], 1),
            'student_count': s['student_count'],
        }
        for s in skill_scores
        if s['skill_category__name']
    ]

    # --- Top matched companies ---
    from django.db.models import Count as DCount, Avg as DAvg
    top_companies = (
        Recommendation.objects
        .filter(match_score__gte=60)
        .values('position__company__name')
        .annotate(match_count=DCount('id'), avg_score=DAvg('match_score'))
        .order_by('-match_count')[:5]
    )
    top_companies_out = [
        {
            'company': t['position__company__name'],
            'match_count': t['match_count'],
            'avg_score': round(t['avg_score'], 1),
        }
        for t in top_companies
    ]

    # --- Assessment completion rate per batch ---
    batches = Batch.objects.prefetch_related('enrollments').order_by('-created_at')[:10]
    batch_completion = []
    for b in batches:
        total = b.enrollments.count()
        if total == 0:
            continue
        try:
            assessment = Assessment.objects.get(batch=b)
            submitted = StudentResponse.objects.filter(
                assessment=assessment, submitted_at__isnull=False
            ).count()
        except Assessment.DoesNotExist:
            submitted = 0
        batch_completion.append({
            'batch': b.name,
            'total': total,
            'submitted': submitted,
            'rate': round((submitted / total) * 100, 1) if total else 0,
        })

    return Response({
        'submission_stats': {
            'total': total_students,
            'submitted': submitted_students,
            'pending': pending_students,
        },
        'recommendation_stats': {
            'total': total_recs,
            'strong': strong_matches,
            'fair': fair_matches,
            'low': low_matches,
            'avg_score': avg_score,
        },
        'skill_breakdown': skill_breakdown,
        'top_companies': top_companies_out,
        'batch_completion': batch_completion,
    })


# ══════════════════════════════════════════════════════════════════════════
# OJT PLACEMENTS
# ═══════════════════════════════════════════════════════════════════════════

def _placement_batch(student_id):
    """Use the student's newest active enrollment, then newest enrollment."""
    enrollments = BatchEnrollment.objects.filter(student_id=student_id).select_related('batch')
    enrollment = enrollments.filter(batch__status='active').order_by('-enrolled_at', '-id').first()
    if enrollment is None:
        enrollment = enrollments.order_by('-enrolled_at', '-id').first()
    return enrollment.batch if enrollment else None


def _serialize_placement(placement):
    return {
        'id': placement.id,
        'student': {
            'id': placement.student_id,
            'name': placement.student.name,
            'school_id': placement.student.school_id,
            'email': placement.student.email,
            'course': placement.student.course,
        },
        'company': {
            'id': placement.company_id,
            'name': placement.company.name,
            'address': placement.company.address or {},
        },
        'position': {
            'id': placement.position_id,
            'title': placement.position.title,
        },
        'recommendation_id': placement.recommendation_id,
        'batch': (
            {'id': placement.batch_id, 'name': placement.batch.name}
            if placement.batch_id else None
        ),
        'match_score_at_assignment': placement.match_score_at_assignment,
        'category_score_component_at_assignment': placement.category_score_component_at_assignment,
        'nlp_score_component_at_assignment': placement.nlp_score_component_at_assignment,
        'location_score_component_at_assignment': placement.location_score_component_at_assignment,
        'distance_km_at_assignment': placement.distance_km_at_assignment,
        'status': placement.status,
        'remarks': placement.remarks,
        'assigned_by': (
            {'id': placement.assigned_by_id, 'name': placement.assigned_by.name}
            if placement.assigned_by_id else None
        ),
        'approved_by': (
            {'id': placement.approved_by_id, 'name': placement.approved_by.name}
            if placement.approved_by_id else None
        ),
        'removed_by': (
            {'id': placement.removed_by_id, 'name': placement.removed_by.name}
            if placement.removed_by_id else None
        ),
        'rejected_by': (
            {'id': placement.rejected_by_id, 'name': placement.rejected_by.name}
            if placement.rejected_by_id else None
        ),
        'created_at': placement.created_at,
        'updated_at': placement.updated_at,
        'approved_at': placement.approved_at,
        'removed_at': placement.removed_at,
        'rejected_at': placement.rejected_at,
    }


def _serialize_placement_visibility(placement, include_unplaced=False):
    """Small, read-only placement payload for student and instructor screens."""
    if placement is None:
        if not include_unplaced:
            return None
        return {
            'id': None,
            'status': 'unplaced',
            'company': None,
            'position': None,
            'match_score_at_assignment': None,
            'approved_at': None,
        }

    return {
        'id': placement.id,
        'status': placement.status,
        'company': {
            'id': placement.company_id,
            'name': placement.company.name,
            'address': placement.company.address or {},
            'address_text': _company_address_text(placement.company.address),
        },
        'position': {
            'id': placement.position_id,
            'title': placement.position.title,
        },
        'match_score_at_assignment': placement.match_score_at_assignment,
        'approved_at': placement.approved_at,
        'updated_at': placement.updated_at,
    }


def _approved_student_placement(student_id):
    return _placement_select_related(
        OJTPlacement.objects.filter(
            student_id=student_id,
            status=OJTPlacement.STATUS_APPROVED,
        )
    ).order_by('-approved_at', '-id').first()


def _visible_placements_by_student(student_ids):
    """Approved placement wins; otherwise expose only the latest workflow state."""
    if not student_ids:
        return {}

    latest = {}
    placements = _placement_select_related(
        OJTPlacement.objects.filter(student_id__in=student_ids)
    ).order_by('student_id', '-updated_at', '-id')
    for placement in placements:
        latest.setdefault(placement.student_id, placement)

    approved = {}
    approved_rows = _placement_select_related(
        OJTPlacement.objects.filter(
            student_id__in=student_ids,
            status=OJTPlacement.STATUS_APPROVED,
        )
    ).order_by('student_id', '-approved_at', '-id')
    for placement in approved_rows:
        approved.setdefault(placement.student_id, placement)

    return {
        student_id: approved.get(student_id) or latest.get(student_id)
        for student_id in student_ids
    }


def _placement_area(address):
    """Group by city first, province second, with a stable empty fallback."""
    if not isinstance(address, dict):
        return 'Unknown Area'
    for key in ('city', 'province'):
        value = address.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return 'Unknown Area'


def _placement_select_related(queryset):
    return queryset.select_related(
        'student', 'company', 'position', 'recommendation', 'batch',
        'assigned_by', 'approved_by', 'removed_by', 'rejected_by',
    )


def _positive_int(raw_value, field_name):
    if raw_value in (None, ''):
        return None, None
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        return None, f'{field_name} must be an integer.'
    if value <= 0:
        return None, f'{field_name} must be greater than zero.'
    return value, None


def _query_flag(request, name):
    return str(request.query_params.get(name, '')).lower() in ('1', 'true', 'yes')


def _can_manage_placement_student(user, student_id):
    if user.role == 'admin':
        return True
    return user.role == 'instructor' and BatchEnrollment.objects.filter(
        student_id=student_id, batch__instructor=user,
    ).exists()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def placement_suggestions(request):
    """Recommendation-ranked students grouped under company positions."""
    if request.user.role not in ('admin', 'instructor'):
        return Response({'error': 'Forbidden'}, status=403)

    company_id, error = _positive_int(request.query_params.get('company_id'), 'company_id')
    if error:
        return Response({'error': error}, status=400)
    position_id, error = _positive_int(request.query_params.get('position_id'), 'position_id')
    if error:
        return Response({'error': error}, status=400)
    batch_id, error = _positive_int(request.query_params.get('batch_id'), 'batch_id')
    if error:
        return Response({'error': error}, status=400)

    include_history = _query_flag(request, 'include_history')
    include_placed = _query_flag(request, 'include_placed')

    enrollments = BatchEnrollment.objects.all()
    if request.user.role == 'instructor':
        enrollments = enrollments.filter(batch__instructor=request.user)
    if batch_id:
        enrollments = enrollments.filter(batch_id=batch_id)
    student_ids = list(enrollments.values_list('student_id', flat=True).distinct())
    if request.user.role == 'admin' and not batch_id:
        student_ids = list(
            User.objects.filter(role='student', is_active=True).values_list('id', flat=True)
        )

    scoped_enrollments = BatchEnrollment.objects.filter(student_id__in=student_ids).select_related('batch')
    if request.user.role == 'instructor':
        scoped_enrollments = scoped_enrollments.filter(batch__instructor=request.user)
    batch_by_student = {}
    for enrollment in scoped_enrollments.filter(batch__status='active').order_by(
        'student_id', '-enrolled_at', '-id',
    ):
        batch_by_student.setdefault(enrollment.student_id, enrollment.batch)
    for enrollment in scoped_enrollments.order_by('student_id', '-enrolled_at', '-id'):
        batch_by_student.setdefault(enrollment.student_id, enrollment.batch)

    companies = Company.objects.prefetch_related('positions').order_by('name', 'id')
    if company_id:
        companies = companies.filter(id=company_id)
    if position_id:
        companies = companies.filter(positions__id=position_id).distinct()

    positions_query = Position.objects.filter(company__in=companies)
    if position_id:
        positions_query = positions_query.filter(id=position_id)
    position_ids = list(positions_query.values_list('id', flat=True))

    recommendations = (
        Recommendation.objects
        .filter(student_id__in=student_ids, position_id__in=position_ids)
        .select_related('student', 'position')
        .order_by('position_id', '-match_score', 'student__name', 'id')
    )
    recommendations_by_position = {}
    for recommendation in recommendations:
        recommendations_by_position.setdefault(recommendation.position_id, []).append(recommendation)

    approved_counts = {
        row['position_id']: row['count']
        for row in OJTPlacement.objects.filter(
            position_id__in=position_ids, status=OJTPlacement.STATUS_APPROVED,
        ).values('position_id').annotate(count=Count('id'))
    }
    approved_by_student = {
        placement.student_id: placement
        for placement in _placement_select_related(OJTPlacement.objects.filter(
            student_id__in=student_ids, status=OJTPlacement.STATUS_APPROVED,
        ))
    }
    latest_by_student_position = {}
    for placement in _placement_select_related(OJTPlacement.objects.filter(
        student_id__in=student_ids, position_id__in=position_ids,
    )).order_by('student_id', 'position_id', '-updated_at', '-id'):
        latest_by_student_position.setdefault(
            (placement.student_id, placement.position_id), placement,
        )

    output = []
    for company in companies:
        positions_output = []
        positions = company.positions.all().order_by('title', 'id')
        if position_id:
            positions = positions.filter(id=position_id)
        for position in positions:
            students = []
            for recommendation in recommendations_by_position.get(position.id, []):
                approved = approved_by_student.get(recommendation.student_id)
                latest = latest_by_student_position.get(
                    (recommendation.student_id, position.id),
                )
                if approved is not None:
                    suggestion_status = (
                        OJTPlacement.STATUS_APPROVED
                        if approved.position_id == position.id else 'already_placed'
                    )
                    status_placement = approved
                elif latest is not None:
                    suggestion_status = latest.status
                    status_placement = latest
                else:
                    suggestion_status = 'unplaced'
                    status_placement = None

                if suggestion_status in (
                    OJTPlacement.STATUS_REMOVED, OJTPlacement.STATUS_REJECTED,
                ) and not include_history:
                    continue
                if suggestion_status == 'already_placed' and not include_placed:
                    continue

                batch = batch_by_student.get(recommendation.student_id)
                students.append({
                    'recommendation_id': recommendation.id,
                    'placement_id': status_placement.id if status_placement else None,
                    'placement_status': suggestion_status,
                    'student': {
                        'id': recommendation.student_id,
                        'name': recommendation.student.name,
                        'school_id': recommendation.student.school_id,
                        'course': recommendation.student.course,
                    },
                    'batch': {'id': batch.id, 'name': batch.name} if batch else None,
                    'match_score': recommendation.match_score,
                    'category_score_component': recommendation.category_score_component,
                    'nlp_score_component': recommendation.nlp_score_component,
                    'location_score_component': recommendation.location_score_component,
                    'distance_km': recommendation.distance_km,
                    'approved_placement': (
                        {
                            'id': approved.id,
                            'company_id': approved.company_id,
                            'company_name': approved.company.name,
                            'position_id': approved.position_id,
                            'position_title': approved.position.title,
                        }
                        if approved else None
                    ),
                })

            approved_count = approved_counts.get(position.id, 0)
            positions_output.append({
                'id': position.id,
                'title': position.title,
                'slots_available': position.slots_available,
                'approved_count': approved_count,
                'remaining_slots': max(position.slots_available - approved_count, 0),
                'suggested_students': students,
            })
        output.append({
            'id': company.id,
            'name': company.name,
            'address': company.address or {},
            'lat': company.location_lat,
            'lng': company.location_lng,
            'positions': positions_output,
        })

    eligible_students = []
    for student in User.objects.filter(id__in=student_ids, role='student', is_active=True).order_by('name'):
        batch = batch_by_student.get(student.id)
        eligible_students.append({
            'id': student.id,
            'name': student.name,
            'student_id': student.school_id,
            'course': student.course,
            'batch': {'id': batch.id, 'name': batch.name} if batch else None,
        })

    return Response({
        'companies': output,
        'eligible_students': eligible_students,
        'include_history': include_history,
        'include_placed': include_placed,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def placement_approve(request):
    if request.user.role not in ('admin', 'instructor'):
        return Response({'error': 'Forbidden'}, status=403)
    recommendation_id, error = _positive_int(
        request.data.get('recommendation_id'), 'recommendation_id',
    )
    if error or recommendation_id is None:
        return Response({'error': error or 'recommendation_id is required.'}, status=400)

    try:
        with transaction.atomic():
            recommendation = Recommendation.objects.select_for_update().get(id=recommendation_id)
            if not _can_manage_placement_student(request.user, recommendation.student_id):
                return Response({'error': 'Student is not enrolled in one of your batches.'}, status=403)
            student = User.objects.select_for_update().get(id=recommendation.student_id)
            position = Position.objects.select_for_update().select_related('company').get(
                id=recommendation.position_id,
            )

            current = _placement_select_related(OJTPlacement.objects.filter(
                student=student, status=OJTPlacement.STATUS_APPROVED,
            )).first()
            if current:
                if current.position_id == position.id:
                    return Response({'placement': _serialize_placement(current), 'idempotent': True})
                return Response({
                    'error': 'Student already has an approved placement.',
                    'placement': _serialize_placement(current),
                }, status=409)

            approved_count = OJTPlacement.objects.filter(
                position=position, status=OJTPlacement.STATUS_APPROVED,
            ).count()
            if approved_count >= position.slots_available:
                return Response({
                    'error': 'No remaining slots for this position.',
                    'slots_available': position.slots_available,
                    'approved_count': approved_count,
                    'remaining_slots': 0,
                }, status=409)

            placement = OJTPlacement.objects.select_for_update().filter(
                recommendation=recommendation,
                status=OJTPlacement.STATUS_SUGGESTED,
            ).order_by('-id').first()
            created = placement is None
            if placement is None:
                placement = OJTPlacement(
                    student=student,
                    company=position.company,
                    position=position,
                    batch=_placement_batch(student.id),
                )
            placement.copy_recommendation_snapshot(recommendation)
            placement.status = OJTPlacement.STATUS_APPROVED
            placement.assigned_by = placement.assigned_by or request.user
            placement.approved_by = request.user
            placement.approved_at = timezone.now()
            if 'remarks' in request.data:
                placement.remarks = str(request.data.get('remarks') or '').strip()
            placement.clean()
            placement.save()
    except Recommendation.DoesNotExist:
        return Response({'error': 'Recommendation not found.'}, status=404)
    except IntegrityError:
        return Response({'error': 'Student already has an approved placement.'}, status=409)

    return Response(
        {'placement': _serialize_placement(placement)},
        status=201 if created else 200,
    )


def _change_placement_status(request, new_status):
    if request.user.role not in ('admin', 'instructor'):
        return Response({'error': 'Forbidden'}, status=403)
    remarks = str(request.data.get('remarks') or '').strip()
    if not remarks:
        return Response({'error': 'remarks is required.'}, status=400)
    placement_id, placement_error = _positive_int(
        request.data.get('placement_id'), 'placement_id',
    )
    recommendation_id, recommendation_error = _positive_int(
        request.data.get('recommendation_id'), 'recommendation_id',
    )
    if placement_error:
        return Response({'error': placement_error}, status=400)
    if recommendation_error:
        return Response({'error': recommendation_error}, status=400)
    if placement_id is None and recommendation_id is None:
        return Response({
            'error': 'placement_id or recommendation_id is required.',
        }, status=400)

    try:
        with transaction.atomic():
            recommendation = None
            if placement_id:
                initial = OJTPlacement.objects.get(id=placement_id)
                if not _can_manage_placement_student(request.user, initial.student_id):
                    return Response({'error': 'Student is not enrolled in one of your batches.'}, status=403)
                User.objects.select_for_update().get(id=initial.student_id)
                Position.objects.select_for_update().get(id=initial.position_id)
                placement = _placement_select_related(
                    # Related audit users are nullable. PostgreSQL cannot apply
                    # FOR UPDATE to the nullable side of those outer joins, so
                    # lock only the placement row while still eager-loading it.
                    OJTPlacement.objects.select_for_update(of=('self',)),
                ).get(id=placement_id)
            else:
                recommendation = Recommendation.objects.select_for_update().select_related(
                    'student', 'position__company',
                ).get(id=recommendation_id)
                if not _can_manage_placement_student(request.user, recommendation.student_id):
                    return Response({'error': 'Student is not enrolled in one of your batches.'}, status=403)
                User.objects.select_for_update().get(id=recommendation.student_id)
                Position.objects.select_for_update().get(id=recommendation.position_id)
                placement = _placement_select_related(
                    OJTPlacement.objects.select_for_update(of=('self',)).filter(
                        recommendation=recommendation,
                    ),
                ).order_by('-updated_at', '-id').first()

                if placement and placement.status in (
                    OJTPlacement.STATUS_REMOVED, OJTPlacement.STATUS_REJECTED,
                ):
                    if placement.status == new_status:
                        return Response({
                            'placement': _serialize_placement(placement),
                            'idempotent': True,
                        })
                    return Response({
                        'error': f'Suggestion is already {placement.status}.',
                        'placement': _serialize_placement(placement),
                    }, status=409)

                if placement is None:
                    placement = OJTPlacement(
                        student=recommendation.student,
                        company=recommendation.position.company,
                        position=recommendation.position,
                        batch=_placement_batch(recommendation.student_id),
                    )
                    placement.copy_recommendation_snapshot(recommendation)

            if placement.status == new_status:
                return Response({
                    'placement': _serialize_placement(placement), 'idempotent': True,
                })
            if placement.status in (
                OJTPlacement.STATUS_REMOVED, OJTPlacement.STATUS_REJECTED,
            ):
                return Response({
                    'error': f'Placement is already {placement.status}.',
                    'placement': _serialize_placement(placement),
                }, status=409)

            placement.status = new_status
            placement.remarks = remarks
            now = timezone.now()
            if new_status == OJTPlacement.STATUS_REMOVED:
                placement.removed_by = request.user
                placement.removed_at = now
            else:
                placement.rejected_by = request.user
                placement.rejected_at = now
            placement.clean()
            placement.save()
    except OJTPlacement.DoesNotExist:
        return Response({'error': 'Placement not found.'}, status=404)
    except Recommendation.DoesNotExist:
        return Response({'error': 'Recommendation not found.'}, status=404)

    return Response({'placement': _serialize_placement(placement)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def placement_remove(request):
    return _change_placement_status(request, OJTPlacement.STATUS_REMOVED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def placement_reject(request):
    return _change_placement_status(request, OJTPlacement.STATUS_REJECTED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def placement_manual_assign(request):
    if request.user.role not in ('admin', 'instructor'):
        return Response({'error': 'Forbidden'}, status=403)
    student_id, error = _positive_int(request.data.get('student_id'), 'student_id')
    if error or student_id is None:
        return Response({'error': error or 'student_id is required.'}, status=400)
    position_id, error = _positive_int(request.data.get('position_id'), 'position_id')
    if error or position_id is None:
        return Response({'error': error or 'position_id is required.'}, status=400)
    batch_id, error = _positive_int(request.data.get('batch_id'), 'batch_id')
    if error:
        return Response({'error': error}, status=400)

    try:
        with transaction.atomic():
            student = User.objects.select_for_update().get(id=student_id, role='student')
            if not _can_manage_placement_student(request.user, student.id):
                return Response({'error': 'Student is not enrolled in one of your batches.'}, status=403)
            position = Position.objects.select_for_update().select_related('company').get(
                id=position_id,
            )
            current = _placement_select_related(OJTPlacement.objects.filter(
                student=student, status=OJTPlacement.STATUS_APPROVED,
            )).first()
            if current:
                return Response({
                    'error': 'Student already has an approved placement.',
                    'placement': _serialize_placement(current),
                }, status=409)

            approved_count = OJTPlacement.objects.filter(
                position=position, status=OJTPlacement.STATUS_APPROVED,
            ).count()
            if approved_count >= position.slots_available:
                return Response({
                    'error': 'No remaining slots for this position.',
                    'slots_available': position.slots_available,
                    'approved_count': approved_count,
                    'remaining_slots': 0,
                }, status=409)

            if batch_id:
                enrollment = BatchEnrollment.objects.select_related('batch').filter(
                    batch_id=batch_id, student=student,
                ).first()
                if enrollment is None:
                    return Response({
                        'error': 'Student is not enrolled in the selected batch.',
                    }, status=400)
                batch = enrollment.batch
            else:
                batch = _placement_batch(student.id)

            recommendation = Recommendation.objects.filter(
                student=student, position=position,
            ).first()
            placement = OJTPlacement(
                student=student,
                company=position.company,
                position=position,
                batch=batch,
                status=OJTPlacement.STATUS_APPROVED,
                remarks=str(request.data.get('remarks') or '').strip(),
                assigned_by=request.user,
                approved_by=request.user,
                approved_at=timezone.now(),
            )
            if recommendation:
                placement.copy_recommendation_snapshot(recommendation)
            placement.clean()
            placement.save()
    except User.DoesNotExist:
        return Response({'error': 'Student not found.'}, status=404)
    except Position.DoesNotExist:
        return Response({'error': 'Position not found.'}, status=404)
    except IntegrityError:
        return Response({'error': 'Student already has an approved placement.'}, status=409)

    return Response({'placement': _serialize_placement(placement)}, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def placement_history(request):
    if request.user.role not in ('admin', 'instructor'):
        return Response({'error': 'Forbidden'}, status=403)

    placements = _placement_select_related(OJTPlacement.objects.all())
    if request.user.role == 'instructor':
        placements = placements.filter(
            student__enrollments__batch__instructor=request.user,
        ).distinct()

    status_filter = request.query_params.get('status')
    if status_filter:
        valid_statuses = {choice[0] for choice in OJTPlacement.STATUS_CHOICES}
        if status_filter not in valid_statuses:
            return Response({'error': 'Invalid status.'}, status=400)
        placements = placements.filter(status=status_filter)

    for query_name, field_name in (
        ('student_id', 'student_id'),
        ('company_id', 'company_id'),
        ('position_id', 'position_id'),
        ('batch_id', 'batch_id'),
    ):
        value, error = _positive_int(request.query_params.get(query_name), query_name)
        if error:
            return Response({'error': error}, status=400)
        if value:
            placements = placements.filter(**{field_name: value})

    try:
        limit = min(max(int(request.query_params.get('limit', 200)), 1), 500)
        offset = max(int(request.query_params.get('offset', 0)), 0)
    except (TypeError, ValueError):
        return Response({'error': 'limit and offset must be integers.'}, status=400)

    placements = placements.order_by('-updated_at', '-id')
    total = placements.count()
    page = placements[offset:offset + limit]
    return Response({
        'count': total,
        'limit': limit,
        'offset': offset,
        'placements': [_serialize_placement(placement) for placement in page],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def placement_analytics(request):
    """System-wide OJT capacity, placement, and area analytics for admins."""
    if request.user.role != 'admin':
        return Response({'error': 'Admins only'}, status=403)

    from collections import Counter

    students = list(
        User.objects.filter(role='student', is_active=True).only('id', 'address')
    )
    approved_placements = list(
        OJTPlacement.objects
        .filter(status=OJTPlacement.STATUS_APPROVED)
        .select_related('company')
        .only('student_id', 'position_id', 'company__address')
    )
    approved_student_ids = {placement.student_id for placement in approved_placements}

    student_counts = Counter(_placement_area(student.address) for student in students)
    unplaced_counts = Counter(
        _placement_area(student.address)
        for student in students
        if student.id not in approved_student_ids
    )

    companies = list(Company.objects.all().only('id', 'address'))
    company_counts = Counter(_placement_area(company.address) for company in companies)
    placement_counts = Counter(
        _placement_area(placement.company.address)
        for placement in approved_placements
    )

    approved_by_position = Counter(
        placement.position_id for placement in approved_placements
    )
    total_slots = 0
    available_slots = 0
    total_slots_by_area = Counter()
    available_slots_by_area = Counter()
    for position in Position.objects.select_related('company').all():
        area = _placement_area(position.company.address)
        position_slots = position.slots_available or 0
        position_free = max(
            position_slots - approved_by_position.get(position.id, 0), 0,
        )
        total_slots += position_slots
        available_slots += position_free
        total_slots_by_area[area] += position_slots
        available_slots_by_area[area] += position_free

    all_areas = sorted(
        set(student_counts)
        | set(unplaced_counts)
        | set(company_counts)
        | set(placement_counts)
        | set(total_slots_by_area)
    )
    area_breakdown = [{
        'area': area,
        'student_count': student_counts.get(area, 0),
        'approved_placements': placement_counts.get(area, 0),
        'unplaced_students': unplaced_counts.get(area, 0),
        'company_count': company_counts.get(area, 0),
        'total_slots': total_slots_by_area.get(area, 0),
        'available_slots': available_slots_by_area.get(area, 0),
    } for area in all_areas]

    def top_areas(metric):
        return [
            {'area': row['area'], 'count': row[metric]}
            for row in sorted(
                (item for item in area_breakdown if item[metric] > 0),
                key=lambda item: (-item[metric], item['area'].lower()),
            )[:5]
        ]

    active_student_ids = {student.id for student in students}
    approved_count = len(approved_placements)
    unplaced_count = len(students) - len(
        approved_student_ids.intersection(active_student_ids)
    )
    fill_rate = round((approved_count / total_slots) * 100, 1) if total_slots else 0

    return Response({
        'summary': {
            'total_ojt_slots': total_slots,
            'approved_placements': approved_count,
            'remaining_slots': available_slots,
            'unplaced_students': unplaced_count,
            'placement_fill_rate': fill_rate,
        },
        'area_breakdown': area_breakdown,
        'top_areas': {
            'by_student_count': top_areas('student_count'),
            'by_placement_count': top_areas('approved_placements'),
        },
        'generated_at': timezone.now(),
    })


PLACEMENT_REPORT_TYPES = {
    'company_placements',
    'student_placements',
    'placement_history',
}


def _placement_report_queryset(user):
    placements = _placement_select_related(OJTPlacement.objects.all())
    if user.role == 'instructor':
        placements = placements.filter(
            student__enrollments__batch__instructor=user,
        ).distinct()
    return placements


def _company_address_text(address):
    if not address:
        return ''
    if isinstance(address, str):
        return address
    keys = ('street', 'barangay', 'city', 'municipality', 'province', 'region')
    values = []
    for key in keys:
        value = address.get(key)
        if value and value not in values:
            values.append(str(value))
    if not values:
        for value in address.values():
            if isinstance(value, str) and value.strip() and value not in values:
                values.append(value)
    return ', '.join(values)


def _serialize_placement_report_record(placement, capacity_by_position):
    serialized = _serialize_placement(placement)
    capacity = capacity_by_position.get(placement.position_id, {})
    slots_available = placement.position.slots_available
    approved_count = capacity.get('approved_count', 0)
    serialized['company']['address_text'] = _company_address_text(
        placement.company.address,
    )
    serialized['position'].update({
        'slots_available': slots_available,
        'approved_count': approved_count,
        'remaining_slots': max(slots_available - approved_count, 0),
    })
    return serialized


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def placement_reports(request):
    """Filtered, export-ready placement records for frontend PDF/XLSX reports."""
    if request.user.role not in ('admin', 'instructor'):
        return Response({'error': 'Forbidden'}, status=403)

    report_type = request.query_params.get('report_type', 'company_placements')
    if report_type not in PLACEMENT_REPORT_TYPES:
        return Response({
            'error': 'Invalid report_type.',
            'supported_report_types': sorted(PLACEMENT_REPORT_TYPES),
        }, status=400)

    placements = _placement_report_queryset(request.user)
    status_filter = request.query_params.get('status', 'all').strip().lower()
    valid_statuses = {choice[0] for choice in OJTPlacement.STATUS_CHOICES}
    if status_filter not in valid_statuses | {'all'}:
        return Response({'error': 'Invalid status.'}, status=400)
    if status_filter != 'all':
        placements = placements.filter(status=status_filter)

    applied_filters = {
        'status': status_filter,
        'company_id': None,
        'position_id': None,
        'batch_id': None,
        'course': request.query_params.get('course', '').strip(),
        'area': request.query_params.get('area', '').strip(),
        'city': request.query_params.get('city', '').strip(),
        'province': request.query_params.get('province', '').strip(),
        'date_field': request.query_params.get('date_field', 'created_at').strip(),
        'date_from': request.query_params.get('date_from', '').strip(),
        'date_to': request.query_params.get('date_to', '').strip(),
    }

    for query_name, field_name in (
        ('company_id', 'company_id'),
        ('position_id', 'position_id'),
        ('batch_id', 'batch_id'),
    ):
        value, error = _positive_int(request.query_params.get(query_name), query_name)
        if error:
            return Response({'error': error}, status=400)
        applied_filters[query_name] = value
        if value:
            placements = placements.filter(**{field_name: value})

    if applied_filters['course']:
        placements = placements.filter(student__course__iexact=applied_filters['course'])
    if applied_filters['area']:
        area = applied_filters['area']
        placements = placements.filter(
            Q(company__address__city__icontains=area)
            | Q(company__address__municipality__icontains=area)
            | Q(company__address__province__icontains=area)
            | Q(company__address__region__icontains=area)
        )
    if applied_filters['city']:
        city = applied_filters['city']
        placements = placements.filter(
            Q(company__address__city__icontains=city)
            | Q(company__address__municipality__icontains=city)
        )
    if applied_filters['province']:
        placements = placements.filter(
            company__address__province__icontains=applied_filters['province'],
        )

    date_field = applied_filters['date_field']
    if date_field not in ('created_at', 'approved_at'):
        return Response({
            'error': 'date_field must be created_at or approved_at.',
        }, status=400)
    parsed_dates = {}
    for query_name in ('date_from', 'date_to'):
        raw_value = applied_filters[query_name]
        if not raw_value:
            continue
        parsed_value = parse_date(raw_value)
        if parsed_value is None:
            return Response({
                'error': f'{query_name} must use YYYY-MM-DD format.',
            }, status=400)
        parsed_dates[query_name] = parsed_value
    if (
        parsed_dates.get('date_from')
        and parsed_dates.get('date_to')
        and parsed_dates['date_from'] > parsed_dates['date_to']
    ):
        return Response({'error': 'date_from cannot be after date_to.'}, status=400)
    if parsed_dates.get('date_from'):
        placements = placements.filter(**{
            f'{date_field}__date__gte': parsed_dates['date_from'],
        })
    if parsed_dates.get('date_to'):
        placements = placements.filter(**{
            f'{date_field}__date__lte': parsed_dates['date_to'],
        })

    if report_type == 'company_placements':
        placements = placements.order_by(
            'company__name', 'position__title', 'student__name', 'id',
        )
    elif report_type == 'student_placements':
        placements = placements.order_by(
            'student__name', '-updated_at', '-id',
        )
    else:
        placements = placements.order_by('-updated_at', '-id')

    position_ids = list(placements.values_list('position_id', flat=True).distinct())
    capacity_by_position = {
        row['id']: {
            'approved_count': row['approved_count'],
            'slots_available': row['slots_available'],
        }
        for row in Position.objects.filter(id__in=position_ids).annotate(
            approved_count=Count(
                'ojt_placements',
                filter=Q(ojt_placements__status=OJTPlacement.STATUS_APPROVED),
            ),
        ).values('id', 'slots_available', 'approved_count')
    }
    records = [
        _serialize_placement_report_record(placement, capacity_by_position)
        for placement in placements
    ]
    status_counts = {status_name: 0 for status_name in valid_statuses}
    for record in records:
        status_counts[record['status']] += 1

    unique_positions = set()
    unique_companies = set()
    unique_students = set()
    for record in records:
        unique_positions.add(record['position']['id'])
        unique_companies.add(record['company']['id'])
        unique_students.add(record['student']['id'])

    summary = {
        'total_records': len(records),
        'unique_students': len(unique_students),
        'unique_companies': len(unique_companies),
        'unique_positions': len(unique_positions),
        'status_counts': status_counts,
        'slots_available': sum(
            capacity_by_position[position_id]['slots_available']
            for position_id in unique_positions
        ),
        'approved_count': sum(
            capacity_by_position[position_id]['approved_count']
            for position_id in unique_positions
        ),
    }
    summary['remaining_slots'] = max(
        summary['slots_available'] - summary['approved_count'], 0,
    )

    return Response({
        'report_type': report_type,
        'generated_at': timezone.now(),
        'generated_by': {
            'id': request.user.id,
            'name': request.user.name,
            'role': request.user.role,
        },
        'filters': applied_filters,
        'summary': summary,
        'records': records,
    })
