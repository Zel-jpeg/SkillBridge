# SkillBridge — Backend Context File

> **Single source of truth for all backend work.**
> Paste this file + `SKILLBRIDGE_CONTEXT.md` from `skillbridge-frontend/` at the start of any AI chat.
> Update `## Current Status` every work session before closing.

---

## Quick Reference

| Item | Value |
|---|---|
| Backend framework | Django 6.0.4 + Django REST Framework 3.17.1 |
| Database | PostgreSQL via Supabase (free tier) |
| Auth | JWT via `djangorestframework-simplejwt` 5.5.1 |
| Auth backend | Custom `EmailBackend` (email replaces username) |
| Hosting (planned) | Railway.app (free tier, does not sleep) |
| Local dev server | `http://127.0.0.1:8000` |
| Frontend URL (Vercel) | `https://skill-bridge-six-psi.vercel.app` |
| Monorepo structure | `SkillBridge/skillbridge-backend/` + `SkillBridge/skillbridge-frontend/` |
| Python version | 3.13.x |

---

## Folder Structure (verified)

```
skillbridge-backend/
├── core/                  ← Django project settings
│   ├── settings.py        ✅ JWT, CORS, DRF, PostgreSQL configured
│   ├── urls.py            ✅ includes api.urls at /api/
│   └── wsgi.py
├── api/                   ← Single Django app (all models, views, serializers, urls)
│   ├── migrations/
│   │   └── 0001_initial.py  ✅ all 14 models migrated
│   ├── backends.py        ✅ Custom EmailBackend
│   ├── models.py          ✅ All DB models (14 tables)
│   ├── serializers.py     ✅ UserSerializer
│   ├── views.py           ✅ 5 endpoint handlers
│   └── urls.py            ✅ 5 URL routes
├── venv/                  ← Virtual environment (never commit)
├── manage.py
├── requirements.txt       ← pip freeze output
└── .env                   ← secrets (never commit)
```

---

## Installed Packages (from requirements.txt — verified)

```
Django==6.0.4
djangorestframework==3.17.1
djangorestframework_simplejwt==5.5.1
django-cors-headers==4.9.0
psycopg2-binary==2.9.11
python-dotenv==1.2.2
requests==2.33.1
google-auth==2.49.2
```

Run to restore: `pip install -r requirements.txt`

---

## Environment Variables (`.env`)

```env
SECRET_KEY=django-insecure-changethislater-skillbridge2026
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=<your-supabase-db-password>
DB_HOST=db.<your-supabase-ref>.supabase.co
DB_PORT=5432
```

> `.env` is in `.gitignore` — never committed to GitHub.
> Get `DB_HOST` and `DB_PASSWORD` from Supabase → Database → Settings → Connection parameters.

---

## `core/settings.py` — Working Config (verified)

```python
from pathlib import Path
from dotenv import load_dotenv
from datetime import timedelta
import os

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

AUTH_USER_MODEL = 'api.User'   # ← CRITICAL — must be set before first migrate
                                # ✅ Confirmed present in actual settings.py at line 21

SECRET_KEY = 'django-insecure-h0v%7...'  # use env var in production
DEBUG = True
ALLOWED_HOSTS = []

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # must be first
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT'),
    }
}

CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',                          # Vite dev server
    'https://skill-bridge-six-psi.vercel.app',        # Vercel production
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}

AUTHENTICATION_BACKENDS = [
    'api.backends.EmailBackend',
]
```

> ✅ `AUTH_USER_MODEL = 'api.User'` is confirmed present in `core/settings.py` at line 21.
> This is the critical setting that makes SimpleJWT look users up in `api_user` instead of the built-in `auth_user` table.
> **Never remove this line.** Without it, all authenticated requests return `401 user_not_found`.

---

## `api/models.py` — All 14 Models (verified)

### User
```python
class User(AbstractBaseUser, PermissionsMixin):
    email        = EmailField(unique=True)
    name         = CharField(max_length=255)
    role         = CharField(choices=['student', 'instructor', 'admin'])
    school_id    = CharField(max_length=20, blank=True)   # format YYYY-NNNNN
    course       = CharField(max_length=100, blank=True)
    phone        = CharField(max_length=20, blank=True)
    address      = JSONField(blank=True, null=True)        # { stayingAt, travelWilling, home, boarding, pinLat, pinLng }
    photo_url    = TextField(blank=True)                   # Google profile photo URL
    is_approved  = BooleanField(default=False)             # instructors start False
    is_active    = BooleanField(default=True)
    is_staff     = BooleanField(default=False)
    created_at   = DateTimeField(auto_now_add=True)

    groups            = ManyToManyField('auth.Group', related_name='api_users')
    user_permissions  = ManyToManyField('auth.Permission', related_name='api_users')

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['name', 'role']
```

### Other 13 models (all migrated ✅)
`Batch`, `BatchEnrollment`, `SkillCategory`, `Assessment` (has `batch` FK), `Question` (has `question_type`), `AnswerChoice`, `StudentResponse`, `ResponseAnswer`, `SkillScore`, `Company` (address is JSONField), `Position`, `PositionRequirement`, `Recommendation`

---

## `api/backends.py` — Custom Auth Backend (verified)

```python
from django.contrib.auth.backends import ModelBackend
from .models import User

class EmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        try:
            user = User.objects.get(email=username)
        except User.DoesNotExist:
            return None
        if user.check_password(password):
            return user
        return None
```

---

## `api/urls.py` — All Registered Endpoints (verified)

```python
from django.urls import path
from . import views

urlpatterns = [
    path('auth/login/',          views.login,           name='login'),
    path('auth/refresh/',        views.refresh,         name='refresh'),
    path('auth/me/',             views.me,              name='me'),
    path('auth/google/',         views.google_login,    name='google_login'),
    path('students/me/profile/', views.student_profile, name='student_profile'),
]
```

All routes are prefixed with `/api/` via `core/urls.py`.

---

## `api/serializers.py` (verified)

```python
from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ['id', 'email', 'name', 'role', 'school_id',
                  'course', 'phone', 'address', 'photo_url', 'is_approved']
```

---

## API Endpoints — Built & Working ✅

### Auth

| Method | URL | Auth | What it does |
|--------|-----|------|--------------|
| POST | `/api/auth/login/` | No | Email + password → JWT access + refresh + user object |
| POST | `/api/auth/refresh/` | No | Refresh token → new access token |
| GET | `/api/auth/me/` | Yes | Returns logged-in user's profile |
| POST | `/api/auth/google/` | No | Google OAuth token → finds/creates student user → JWT |
| PATCH | `/api/students/me/profile/` | Yes (student) | Saves student ID, course, phone, address, pin |

### Google Login — how it works

1. Frontend sends Google `access_token` to `/api/auth/google/`
2. Backend calls `https://www.googleapis.com/oauth2/v3/userinfo` to verify
3. Rejects non-`@dnsc.edu.ph` emails with `403 { error: 'not_dnsc' }`
4. Calls `User.objects.get_or_create(email=email, defaults={...})` — creates student if new
5. Updates `name` and `photo_url` on every login (keeps Google profile photo fresh)
6. Returns `{ access, refresh, user }` — same shape as email login

### Login — instructor pending check

If an instructor logs in via `/api/auth/login/` and `user.is_approved` is `False`, the backend returns:
```json
{ "error": "pending" }   HTTP 403
```
The frontend `AdminLogin.jsx` catches this and redirects to `/instructor/pending`.

### Student Profile PATCH — field mapping

| Request field | Model field | Stored in |
|---|---|---|
| `studentId` | `school_id` | top-level column |
| `course` | `course` | top-level column |
| `phone` | `phone` | top-level column |
| `stayingAt`, `travelWilling`, `homeProvince/City/Barangay`, `boardingProvince/City/Barangay`, `pinLat`, `pinLng` | `address` | JSONField |

---

## Frontend Integration

### localStorage keys set on login:

| Key | Value |
|-----|-------|
| `sb-token` | JWT access token |
| `sb-refresh` | JWT refresh token |
| `sb-role` | `admin` / `instructor` / `student` |
| `sb-user` | Full user object (JSON string) |

### Files wired to real auth (Week 3):
- `LoginPage.jsx` — real Google OAuth → `/api/auth/google/`, stores token + redirects
- `AdminLogin.jsx` — real email/password → `/api/auth/login/`, handles pending instructor
- `StudentSetup.jsx` — real `api.patch('/api/students/me/profile/')` on finish

---

## Seed Data

| Email | Password | Role | Notes |
|-------|----------|------|-------|
| `admin@dnsc.edu.ph` | `admin123` | admin | Created via Django shell |

> Create via Django shell:
> ```python
> from api.models import User
> u = User(email='admin@dnsc.edu.ph', name='Administrator', role='admin', is_approved=True, is_staff=True, is_superuser=True)
> u.set_password('admin123')
> u.save()
> ```

Student users are auto-created on first Google login. No pre-seeding needed.

---

## Migrations Log

| Migration | What it created |
|-----------|----------------|
| `api.0001_initial` | All 14 tables: User (with school_id, photo_url, address JSONField), Batch, BatchEnrollment, SkillCategory, Assessment (with batch FK, question_type), Question, AnswerChoice, StudentResponse, ResponseAnswer, SkillScore, Company (address JSONField), Position, PositionRequirement, Recommendation |

---

## Current Status

**Current week:** Week 3 — ✅ COMPLETE (ahead of schedule)
**Last completed:** Full auth flow working end-to-end. Google OAuth login + email/password login + student profile setup all saving to Supabase. ✅

**What's working end-to-end:**
- Django project setup ✅
- Supabase PostgreSQL connected ✅
- All 14 models migrated ✅
- `POST /api/auth/login/` → JWT ✅
- `POST /api/auth/refresh/` → new access ✅
- `GET /api/auth/me/` → user profile ✅
- `POST /api/auth/google/` → Google OAuth + auto-create student ✅
- `PATCH /api/students/me/profile/` → save to Supabase ✅

**Next tasks (Week 4):**

1. `GET /api/students/me/` — return current student's full profile + assessment status
2. Assessment CRUD endpoints:
   - `POST /api/instructor/assessments/` — instructor creates assessment + questions
   - `GET /api/assessments/` — student lists available assessments
   - `POST /api/assessments/{id}/submit/` — student submits responses, triggers auto-scoring
3. Auto-scoring logic: compare `ResponseAnswer.selected_choice.is_correct`, aggregate per category, write to `SkillScore`
4. Wire `StudentDashboard.jsx` to real user data (replace mock `STUDENT` constant)
5. Wire `StudentAssessment.jsx` to real assessment data from API

---

## Common Commands

```bash
# Activate venv (Windows)
venv\Scripts\activate

# Run dev server
python manage.py runserver

# Make and apply migrations
python manage.py makemigrations
python manage.py migrate

# Open Django shell
python manage.py shell

# Save dependencies
pip freeze > requirements.txt
```

---

## Known Issues / Watch Out For

| Issue | Fix |
|-------|-----|
| `401 user_not_found` on all JWT-authenticated requests | `AUTH_USER_MODEL = 'api.User'` missing from settings.py — Django queries wrong table. ✅ Already present at line 21 in actual settings.py. |
| `corsheaders.E014` — trailing slash in CORS origin | Remove trailing slash from URL in `CORS_ALLOWED_ORIGINS` |
| `authenticate()` returns None even with correct password | Custom `EmailBackend` required — Django defaults to `username` field |
| `groups`/`user_permissions` reverse accessor clash | `related_name='api_users'` on both fields in `User` model ✅ already fixed |
| `AUTH_USER_MODEL` must be set BEFORE first migrate | If already migrated without it, delete migrations and re-migrate |
| Red squiggles on Django imports in VS Code | Select venv interpreter: Ctrl+Shift+P → "Python: Select Interpreter" → choose venv |
| settings.py shows `Django==6.0.4` not `5.x` | Context files previously said Django 5.x — actual version is 6.0.4 |

---

## How to Use This File With Any AI

Paste both this file and `SKILLBRIDGE_CONTEXT.md` from `skillbridge-frontend/` at the start of your message, then add your question.

Example:
> [paste skillbridge-backend/SKILLBRIDGE_CONTEXT.md]
> [paste skillbridge-frontend/SKILLBRIDGE_CONTEXT.md]
> I'm on Week 4. I need to build the assessment submission endpoint with auto-scoring. What should it look like?

**Works with:** Claude, ChatGPT, Gemini, Copilot, or any AI assistant.
