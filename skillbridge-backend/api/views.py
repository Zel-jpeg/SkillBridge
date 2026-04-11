import requests as http_requests
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import User
from .serializers import UserSerializer


# ── POST /api/auth/login/ ─────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
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

    # Fetch user info from Google using the access token
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

    # Only allow DNSC email addresses
    if not email.endswith('@dnsc.edu.ph'):
        return Response({'error': 'not_dnsc'}, status=status.HTTP_403_FORBIDDEN)

    # Find or create the student user
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

    # Keep name and photo fresh on every login
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

# ── PATCH /api/students/me/profile/ ──────────────────────────────
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def student_profile(request):
    user = request.user

    if user.role != 'student':
        return Response({'error': 'Not a student'}, status=status.HTTP_403_FORBIDDEN)

    # Pack all address + location data into the address JSONField
    address = {
        'stayingAt':        request.data.get('stayingAt', ''),
        'travelWilling':    request.data.get('travelWilling', ''),
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