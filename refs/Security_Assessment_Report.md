# Security Assessment Report Draft - SkillBridge

*Note: This markdown file contains all the required information for your final paper. You will need to copy this content into a word processor (like MS Word or Google Docs) to apply the specific Document Format requirements (Arial font, size 12, 1.5 line spacing, justified alignment, specific margins) before saving it as a PDF.*

---

## I. Title Page
**IT322 – INFORMATION ASSURANCE AND SECURITY**
**FINAL PROJECT**

*(Insert DNSC Logo Here)*

**Security Assessment Report**

**Presented to**
<Name of Instructor>

**Faculty, Institute of Computing**
**Davao del Norte State College**

Student A
Student B
Student C
Student D

**Date**

---

## II. System Overview (Understand the System)

### a. System Description
SkillBridge is a web-based On-the-Job Training (OJT) placement decision support system developed for the Davao del Norte State College (DNSC). It streamlines the assessment of student skills before OJT deployment by replacing manual, paper-based methods and Google Forms with a structured digital platform. The system allows instructors to upload skill assessment questionnaires, enables students to take digitally auto-scored assessments, and uses Natural Language Processing (cosine similarity) to generate skill profiles and recommend ranked company and position matches based on student performance.

### b. Users and Roles
*   **Student:** Can take skill assessments, view their generated skill profile, and see ranked company and position recommendations. They use Google OAuth (DNSC account) to log in.
*   **Instructor / OJT Coordinator:** Can upload questionnaires (questions, correct answers, skill tags) manually or via Excel/CSV, view all student scores, and see top performers per skill category.
*   **Admin:** Manages companies and positions (including slots and required skills), views the full list of students and their recommendations, and manages user accounts (e.g., approving instructors).

### c. Technologies Used
*   **Frontend:** React.js (Vite), Tailwind CSS v4
*   **Backend:** Python, Django 6.0.4, Django REST Framework (DRF)
*   **Database:** PostgreSQL (hosted via Supabase)
*   **Authentication:** JWT (JSON Web Tokens) via `djangorestframework-simplejwt`, Custom Email Auth, Google OAuth
*   **Algorithm/NLP:** scikit-learn (cosine similarity)
*   **Hosting:** Vercel (Frontend), Railway.app (Backend)

---

## III. Vulnerability Assessment (Identify Issues)

| # | Vulnerability | Location | Possible Attack |
|---|---|---|---|
| 1 | Lack of Rate Limiting on Authentication Endpoints | Login module (`/api/auth/login/`) | Brute force or credential stuffing attacks |
| 2 | Insecure Storage of Sensitive Tokens | Frontend LocalStorage (`sb-token`, `sb-refresh`) | Cross-Site Scripting (XSS) leading to token theft |
| 3 | Unrestricted File Upload Risks | InstructorUpload module (Excel/CSV upload) | Malicious file execution or parsing exploits (e.g., XML External Entity - XXE if not properly secured during SheetJS parsing) |
| 4 | Potential Insecure Direct Object Reference (IDOR) | API endpoints handling user profiles and assessments | Unauthorized access to other students' profiles or assessment scores by manipulating IDs |
| 5 | Weak Password Policy | Admin/Instructor Registration & Login | Brute force attacks or password guessing |
| 6 | Missing Security Headers | Global Application Configuration | Clickjacking, Man-in-the-Middle (MitM), and XSS (e.g., missing Strict-Transport-Security, Content-Security-Policy) |
| 7 | Session Replay / Token Re-use Vulnerability | JWT Implementation | Attackers using intercepted or stolen JWTs before they expire, due to long token lifetimes or missing token revocation mechanisms |

---

## IV. Risk Analysis (Analyze Impact)

### a. Asset Identification
*   **Data:** User profiles, student assessment scores, school IDs, company requirements, address information (staying location, home, boarding), authentication tokens.
*   **System:** Frontend application (Vercel), Backend API (Railway), PostgreSQL Database (Supabase), NLP Recommendation Engine.
*   **Users:** Students, Instructors, Admins.

### b. Threat and Impact Analysis
*   Threats include unauthorized access, data breaches, data manipulation (altering assessment scores), and service disruption. Impacts range from privacy violations (exposing student data) and compromised OJT placements to reputational damage for the institution.

### c. Risk Evaluation

| Asset | Threat | Impact | Risk Level |
|---|---|---|---|
| User Database & Profiles | Brute Force on Admin/Instructor Accounts | Unauthorized access, data breach | High |
| JWT Tokens in LocalStorage | XSS leading to Token Theft | Account takeover | High |
| Assessment & Score Data | IDOR on API endpoints | Exposure or tampering of grades | Medium |
| Uploaded Excel/CSV Files | Malicious File Upload | Denial of service, parsing exploits | Medium |
| Application API | Lack of Rate Limiting | Resource exhaustion, system slowdown | Low |
| System Communication | Missing Security Headers | Clickjacking, downgrading attacks | Medium |
| User Passwords | Weak Password Policies | Unauthorized system access | Medium |

---

## V. Security Controls and Improvements (Apply Solutions)

| Issue | Proposed Solution | Type of Control |
|---|---|---|
| Brute force attacks on login | Implement rate limiting (e.g., Django Ratelimit) and account lockout after failed attempts. | Technical |
| Token Theft via XSS | Migrate JWT storage from LocalStorage to HTTPOnly Secure cookies to prevent JavaScript access. | Technical |
| Malicious File Uploads | Implement strict file validation (MIME type checking, file size limits) and sanitize parsed data. | Technical / Administrative |
| IDOR Vulnerabilities | Enforce strict object-level permissions in Django views to ensure users can only access their own data. | Technical |
| Weak Passwords | Enforce a strong password policy (minimum length, complexity requirements) and consider Multi-Factor Authentication (MFA) for Admins. | Technical / Administrative |
| Missing Security Headers | Configure Django security middleware and reverse proxy to include headers like CSP, HSTS, X-Frame-Options. | Technical |
| Lack of Security Awareness | Conduct security training for instructors and admins on handling student data securely. | Administrative |

---

## VI. Security Design (System Protection Plan)

### a. To-Be Security Design
The improved system architecture will enforce a zero-trust approach at the application layer. All requests will pass through a Web Application Firewall (WAF) or rate-limiter before reaching the backend API. Authentication will be fortified by moving JWTs to HTTPOnly cookies, mitigating XSS risks.

### b. Representation (Secured System Flow Explanation)
1.  **Authentication is Secure:** When a user logs in, instead of sending the JWT back in the response body to be stored in LocalStorage, the server sets an `HttpOnly` and `Secure` cookie containing the token. Google OAuth provides an added layer of security for student accounts, reducing reliance on passwords.
2.  **Data is Protected:** All endpoints accessing student records or assessments verify not just if the user is authenticated, but if they have the specific role and object-level permission to view that specific record (mitigating IDOR). Uploaded Excel/CSV files are scanned and strictly parsed in a sandboxed environment without executing arbitrary macros.
3.  **Communication is Safe:** The system enforces HTTPS (HSTS) across all connections. Cross-Origin Resource Sharing (CORS) is strictly configured to only allow the Vercel frontend URL, and Content Security Policy (CSP) headers restrict script execution.

---

## VII. Justification (Explain Your Design)

### a. CIA Triad
*   **Confidentiality:** Moving JWTs to HTTPOnly cookies and enforcing strict object-level authorization ensures that sensitive student data (like addresses and assessment scores) is only visible to authorized individuals.
*   **Integrity:** Proper validation of file uploads and input sanitization prevents malicious users from altering system data or injecting malicious scripts (XSS).
*   **Availability:** Implementing rate limiting on authentication and API endpoints protects the Railway.app backend from resource exhaustion and Denial of Service (DoS) attacks, ensuring the system remains available for legitimate users.

### b. Defense-in-Depth
The proposed design applies multiple layers of security. Instead of relying solely on a login screen, security is applied at the network edge (rate limiting, HSTS), the application layer (CORS, CSP, HTTPOnly cookies), the authorization layer (role-based access control, object-level permissions), and the data layer (input validation, secure file parsing). If one layer (e.g., the frontend) is compromised, secondary layers (e.g., backend object-level permissions) prevent the attacker from accessing unauthorized data.

---

## VIII. References
*(Add your references here in APA format. Examples below:)*
*   Bejtlich, R. (2013). *The practice of network security monitoring: Understanding incident detection and response.* No Starch Press.
*   OWASP Foundation. (2021). *OWASP Top 10:2021.* Retrieved from https://owasp.org/Top10/
*   Stuttard, D., & Pinto, M. (2011). *The Web Application Hacker's Handbook: Finding and Exploiting Security Flaws* (2nd ed.). Wiley.






---

# Appendix A: Backend Context File

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

### Assessment & Core

| Method | URL | Auth | What it does |
|--------|-----|------|--------------|
| GET | `/api/students/me/` | Yes (student) | Returns full student profile + assessment status |
| POST | `/api/instructor/assessments/` | Yes (instructor) | Instructor creates assessment + questions |
| GET | `/api/assessments/` | Yes (student) | Student lists available assessments |
| POST | `/api/assessments/{id}/start/` | Yes (student) | Starts assessment |
| POST | `/api/assessments/{id}/submit/` | Yes (student) | Submits responses, triggers auto-scoring + vector gen |
| GET | `/api/admin/events/` | Yes (admin) | SSE stream for real-time dashboard updates |
| GET | `/api/instructor/events/` | Yes (instructor) | SSE stream for real-time dashboard updates |

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

**Current week:** Week 4 — ✅ COMPLETE
**Last completed:** Assessment flow, auto-scoring, recommendations, and real-time SSE stream fully working end-to-end. ✅

**What's working end-to-end:**
- Django project setup ✅
- Supabase PostgreSQL connected ✅
- All 14 models migrated ✅
- `POST /api/auth/login/` → JWT ✅
- `POST /api/auth/refresh/` → new access ✅
- `GET /api/auth/me/` → user profile ✅
- `POST /api/auth/google/` → Google OAuth + auto-create student ✅
- `PATCH /api/students/me/profile/` → save to Supabase ✅

**Next tasks (Week 5):**

1. Wire remaining edge cases in frontend dashboards.
2. Prepare presentation and review algorithm matching accuracy.

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


---

# Appendix B: Frontend Context File

# SkillBridge — Project Context File (Frontend)

> **Single source of truth.** Paste this file at the start of any new AI chat.
> Update `## Current Status` every work session before closing.
> Companion file: `SKILLBRIDGE_CONTEXT.md` in `skillbridge-backend/`

---

## What is SkillBridge?

A web-based OJT (On-the-Job Training) placement decision support system for **Davao del Norte State College (DNSC)**, Panabo City, Davao del Norte. Built as a thesis project for the **Bachelor of Science in Information Technology** degree at the Institute of Computing.

**The problem it solves:** DNSC currently uses manual/paper-based methods and Google Forms to assess student skills before OJT deployment. There is no structured matching between student skills and company requirements.

**What the system does:**

1. Instructors/OJT coordinators upload skill assessment questionnaires (replacing Google Forms)
2. Students take the assessment digitally and it is auto-scored
3. The system builds a skill profile per student using NLP (category-based scoring)
4. Students are shown ranked company + position recommendations based on their skills
5. Instructors and admins see dashboards with student performance data

**Thesis authors:** David Rey P. Bali-os, Lemuel P. Brion, Azel M. Villanueva
**Builder (current solo dev):** David Rey P. Bali-os
**Submission deadline:** Last week of May 2026

---

## Thesis Requirements

- **Required by panel:** 100% UI complete + 30% functionalities working
- **Personal goal:** 50–60% functionalities working
- The system only needs to work within DNSC — single institution scope
- Final placement decisions remain with instructors (system is decision _support_, not automatic assignment)

---

## Tech Stack (confirmed)

| Layer          | Technology                              | Where it runs            |
| -------------- | --------------------------------------- | ------------------------ |
| Frontend       | React.js (Vite) + Tailwind CSS v4       | Vercel (free)            |
| Backend        | Python + Django 6.0.4 + DRF             | Railway.app (free tier)  |
| Database       | PostgreSQL via Supabase                 | Supabase (free tier)     |
| NLP / Matching | scikit-learn (cosine similarity)        | Inside Django on Railway |
| Auth           | JWT via djangorestframework-simplejwt   | Django                   |
| HTTP client    | Axios (`src/api/axios.js`)              | React frontend           |
| Routing        | React Router DOM v7                     | React frontend           |

**Live frontend URL:** `https://skill-bridge-six-psi.vercel.app`
**Local dev:** `http://localhost:5173` (Vite)
**NOT using:** .edu.ph domain, Render.com (sleeps on free tier), spaCy (cut for v1), location filtering (cut for v1)

### Important Tailwind v4 note

Project uses **Tailwind CSS v4** (via `@tailwindcss/vite` plugin). There is NO `tailwind.config.js`.
Dark mode is configured in `src/index.css`:

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

The red squiggle on `@custom-variant` in VS Code is a false warning — install **Tailwind CSS IntelliSense** extension to fix it. Dark mode works by toggling the `dark` class on `<html>`.

---

## User Roles

| Role                             | What they can do                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Student**                      | Take assessments, view their skill profile, see ranked company/position recommendations                                          |
| **Instructor / OJT Coordinator** | Upload questionnaires (questions + correct answers + skill tags), view all student scores, see top performers per skill category |
| **Admin**                        | Manage companies and positions (name, required skills per position, slot count), view full student list and recommendations      |

---

## Database Tables (all migrated ✅)

```
api_user               — id, email, name, role, school_id, course, phone, address (JSONField), photo_url, is_approved, is_active, is_staff, created_at
batches                — id, name, instructor_id (FK), status, archived_at, created_at
batch_enrollments      — id, batch_id, student_id, enrolled_at
skill_categories       — id, name, description, created_by, created_at
assessments            — id, title, created_by, batch_id, duration_minutes, is_active, created_at
questions              — id, assessment_id, skill_category_id, question_text, question_type, question_order
answer_choices         — id, question_id, choice_text, is_correct
student_responses      — id, student_id, assessment_id, submitted_at, retake_allowed
response_answers       — id, response_id, question_id, selected_choice_id
skill_scores           — id, student_id, assessment_id, skill_category_id, raw_score, max_score, percentage
companies              — id, name, address (JSONField), location_lat, location_lng, added_by, created_at
positions              — id, company_id, title, slots_available
position_requirements  — id, position_id, skill_category_id, required_percentage
recommendations        — id, student_id, position_id, match_score, generated_at
```

> `address` JSONField on User stores: `{ stayingAt, travelWilling, home: {province, city, barangay}, boarding: {province, city, barangay}, pinLat, pinLng }`
> `school_id` stores institutional ID in `YYYY-NNNNN` format for both students and instructors.
> `companies.address` JSONField stores: `{ province, city, barangay }`

---

## Skill Categories

**Skill categories are NOT hardcoded.** They are created dynamically by the instructor or admin through the system. Questions are tagged with a `skill_category_id` FK. Position requirements are stored per category in `position_requirements`.

---

## How the NLP / Recommendation Works (simplified)

**This is NOT complex AI — it is weighted scoring + cosine similarity.**

1. **Auto-scoring:** Compare selected answers to `is_correct`. Count correct per skill category → store in `skill_scores`.
2. **Skill vector:** Convert scores to percentages → `[0.82, 0.55, 0.30, 0.70, 0.60]`
3. **Position vector:** Admin sets requirements per position → `[0.70, 0.60, 0.00, 0.50, 0.40]`
4. **Cosine similarity:** `score = cosine_similarity([student_vec], [position_vec])[0][0]`
5. **Rank:** Sort all positions by match score descending → return top N as recommendations.

**Libraries needed:** `scikit-learn`, `numpy`

---

## Pages / Screens

### Auth pages

- `/login` — Google OAuth button (DNSC account only) — ✅ built + **wired to real API**
- `/admin/login` — Email + password for admins and instructors — ✅ built + **wired to real API**
- `/instructor/pending` — Holding screen for unapproved instructors — ✅ built

### Student pages

- `/student/setup` — 4-step profile setup (ID, course, phone, address + travel pref, map pin, review) — ✅ built + **wired to real API**
- `/student/dashboard` — welcome, assessment CTA, locked skill + match preview — ✅ built (mock data — wire Week 4/5)
- `/student/assessments` — full list of available assessments — ⬜ not built yet (PENDING COORDINATOR DECISION)
- `/student/assessment` — one question at a time, timer, autosave, review screen, confirm modal — ✅ built (mock data — wire Week 4)
- `/student/results` — animated skill bars + ranked company match cards — ✅ built (mock data — wire Week 5)
- `/student/profile` — edit all profile fields + photo — ✅ built (mock data — wire Week 4/5)

### Shared components

- `src/components/AddressDropdowns.jsx` — cascading Province → City → Barangay (PSGC API) — ✅ built + production-hardened
- `src/components/NavBar.jsx` — shared nav with profile dropdown (My profile, dark mode toggle, logout) — ✅ built

### Instructor pages

- `/instructor/dashboard` — stats + skill leaders + student table with **grid/list view toggle + pagination** + mobile-responsive nav. Fixed New Assessment button navigates to `/instructor/assessment/create`. Clicking a student opens a shared **Student Detail Modal** with toggleable "Allow Retake" action. — ✅ built
- `/instructor/assessments` — manage all published assessments: active/inactive toggle, submission count, archive/delete — ⬜ not built yet (PENDING COORDINATOR DECISION)
- `/instructor/assessment/create` — two question-entry modes: (1) manual form with category tagging, (2) Excel/CSV upload with SheetJS parse → preview table → import. Both share the same categories manager and assessment metadata. Download template button (CSV). Draft auto-saves to `localStorage` (`sb_assessment_draft`) on every change (1s debounce); restore banner on reload; draft cleared on publish. Mobile-responsive nav. — ✅ built (`InstructorUpload.jsx`)
- `/instructor/students` — enrolled students list with **batch dropdown selection (Active/Archived cohorts)**. Enroll modal has two tabs: Excel upload and manual entry. **Manual entry asks for Email first, then auto-suggests the Full Name based on DNSC email** (`lastname.firstname@dnsc.edu.ph` → `Firstname Lastname`), which can be edited. Duplicate ID/email detection. Green toast on success. Uses shared **Student Detail Modal**. — ✅ built (`EnrolledStudents.jsx`)
- `/instructor/pending` — Pending approval holding screen. Has "Check Status Again" (reload) and "Cancel & Sign Out" buttons. — ✅ built (`InstructorPending.jsx`)

### Admin pages

- `/admin/dashboard` — overview stats + top matches + searchable student table — ✅ built
- `/admin/companies` — company cards + map + add company/position modals — ✅ built + production-hardened (`AdminCompanies.jsx`)
- `/admin/users` — tab switcher: Students table + Instructors table + Email-first Add Instructor modal. Uses shared **User Detail Modal** to view profiles, see assessment status (Retake toggling), and inline edit Instructor details (pencil icon). — ✅ built (`AdminUsers.jsx`)
- `/admin/notifications` — notification centre with filter tabs (All / Unread / Read), mark-as-read per row, mark-all-as-read button, click-to-navigate, empty states per tab — ✅ built (`AdminNotifications.jsx`)

---

## Assessment — Key Design Decisions

- **Layout:** One question at a time (cleaner UX, works for any question count)
- **Timer:** Set by instructor via `duration_minutes`. Countdown shown in nav sub-bar. Turns amber at 10 min left, red at 5 min, shows warning modal at exactly 5 min, auto-submits at 0.
- **Autosave:** Every answer pick saves to `localStorage` immediately using keys `sb_answers_{assessment_id}` and `sb_timer_{assessment_id}`. Survives refresh, internet drop, tab close.
- **No back/pause button on purpose** — autosave handles reconnection scenarios.
- **Review screen:** Shows all questions with selected answers. Each has an Edit button to jump back. Unanswered shown in amber.
- **Confirmation modal:** Shows X of Y answered, warns it's final.
- **After submit:** Clears localStorage progress, redirects to `/student/results`.
- **Question types:** MCQ + True/False only (auto-gradable required for scoring pipeline).

### Excel template columns (for instructor upload):

| Column     | Required | Example                    |
| ---------- | -------- | -------------------------- |
| `question` | ✅       | What does SQL stand for?   |
| `type`     | ✅       | mcq or truefalse           |
| `choice_a` | ✅ (mcq) | Structured Query Language  |
| `choice_b` | ✅ (mcq) | Simple Query Logic         |
| `choice_c` | ✅ (mcq) | Sequential Query List      |
| `choice_d` | ✅ (mcq) | Standard Question Language |
| `correct`  | ✅       | A (for mcq) or True/False  |
| `category` | ✅       | Database                   |

---

## Dark Mode

- Stored in `localStorage` as `sb-theme` (`dark` / `light`)
- Toggle is in the profile dropdown in NavBar
- Applied by adding/removing `dark` class on `document.documentElement`
- All pages read `localStorage.getItem('sb-theme')` on mount to restore preference

---

## localStorage Keys Used by Frontend

| Key | Value | Set by |
|-----|-------|--------|
| `sb-token` | JWT access token | Login response |
| `sb-refresh` | JWT refresh token | Login response |
| `sb-role` | `admin` / `instructor` / `student` | Login response |
| `sb-user` | Full user object (JSON string) | Login response |
| `sb-theme` | `dark` / `light` | NavBar dark mode toggle |
| `sb_pin_location` | `{ lat, lng }` JSON | StudentProfile map pin |
| `sb_answers_{id}` | Assessment autosave | StudentAssessment |
| `sb_timer_{id}` | Timer autosave | StudentAssessment |
| `sb_assessment_draft` | Instructor question draft | InstructorUpload |

---

## Axios Instance — `src/api/axios.js`

```js
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000',
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('sb-token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
```

---

## AdminCompanies.jsx — Technical Notes (important for Week 4 wiring)

- `location_lat` and `location_lng` already in schema and already sent by `handleSubmit()`
- When wiring Week 4: just include `location_lat` and `location_lng` in POST body to `/api/admin/companies/`
- Leaflet loaded via CDN singleton — do **NOT** npm install leaflet
- `mapEverOpened` flag = lazy-load Leaflet only on first map open (faster page load)
- `isolation: isolate` on wrapper = CSS z-index fix (Leaflet layers never bleed above modals)
- Geocoding via Nominatim (free, no key). Returns `{ lat, lng, zoom }` with smart zoom:
  - Barangay selected → zoom 17 (street level)
  - City only → zoom 15 (neighbourhood)
  - Province only → zoom 12 (city overview)

---

## AddressDropdowns.jsx — Technical Notes

- Caches all 3 PSGC levels in `sessionStorage`:
  - `psgc_provinces` — fetched once per session
  - `psgc_cities_{code}` — per province
  - `psgc_barangays_{code}` — per city
- `ssGet()` / `ssSet()` wrap all storage access in try/catch — safe in private/incognito mode
- API used: `https://psgc.gitlab.io/api` (Official PSA PSGC data, free, no signup, no key)

---

## 7-Week Schedule

| Week | Dates        | Focus   | Goal                                                                          |
| ---- | ------------ | ------- | ----------------------------------------------------------------------------- |
| W1   | Apr 6–12     | UI      | Login, student pages — ✅ DONE                                                |
| W2   | Apr 13–19    | UI      | Instructor + admin pages — ✅ DONE                                            |
| W3   | Apr 20–26    | Backend | Django setup, all models, auth endpoints, real login works — ✅ DONE (early) |
| W4   | Apr 27–May 3 | Backend | Assessment CRUD, auto-scoring, instructor dashboard shows real data — ✅ DONE  |
| W5   | May 4–10     | Backend | Skill vectors, cosine similarity, recommendations endpoint, results page real — ✅ DONE |
| W6   | May 11–17    | Connect | Wire remaining pages to backend, fix bugs, full flow works                    |
| W7   | May 18–24    | Deploy  | Railway + Vercel deploy, seed data, demo prep                                 |

---

## Current Status

> **Update this section every work session before closing.**

**Current week:** Week 4 — ✅ COMPLETE
**Last thing completed:** Assessment flow, auto-scoring, recommendations, and real-time SSE stream fully working end-to-end. All mock data wired to real API. ✅

**What was built/wired in Week 3:**
- Django project created, all models migrated to Supabase ✅
- `POST /api/auth/login/` — email + password login → JWT ✅
- `POST /api/auth/refresh/` — refresh token → new access token ✅
- `GET /api/auth/me/` — returns current user ✅
- `POST /api/auth/google/` — Google OAuth token exchange, auto-creates student ✅
- `PATCH /api/students/me/profile/` — saves student setup data to Supabase ✅
- `LoginPage.jsx` wired to real Google OAuth + backend ✅
- `AdminLogin.jsx` wired to real email/password login (both admin and instructor) ✅
- `StudentSetup.jsx` wired to real profile save ✅

**Critical bug fixed in Week 3:**
> `AUTH_USER_MODEL = 'api.User'` must be in `settings.py`.
> Without it Django authenticates against the built-in `auth_user` table (empty), causing `401 user_not_found` on every authenticated request even with a valid token.
> ✅ This line IS present in `core/settings.py` at line 21 — confirmed.

**Next tasks (Week 4):**
1. `GET /api/students/me/` — full student profile + assessment status
2. Assessment CRUD — instructor creates, student views + takes
3. Auto-scoring on submit → populate `skill_scores`
4. Wire `StudentDashboard.jsx` to real user data
5. Wire `StudentAssessment.jsx` to real assessment from API

**Blockers / problems:** None

---

### File structure (verified against codebase)

```
skillbridge-frontend/
├── src/
│   ├── api/
│   │   └── axios.js               ✅ axios instance with JWT interceptor
│   ├── components/
│   │   ├── AddressDropdowns.jsx   ✅ PSGC cascading dropdowns + sessionStorage cache + safe helpers
│   │   └── NavBar.jsx             ✅ shared nav with dropdown (profile, dark mode, logout)
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx         ✅ Google OAuth — WIRED TO REAL API
│   │   │   └── AdminLogin.jsx        ✅ email/password — WIRED TO REAL API (admin + instructor dual-role)
│   │   ├── student/
│   │   │   ├── StudentSetup.jsx      ✅ 4-step profile setup — WIRED TO REAL API
│   │   │   ├── StudentDashboard.jsx  ✅ mock data (wire Week 4/5)
│   │   │   ├── StudentAssessment.jsx ✅ mock data (wire Week 4)
│   │   │   ├── StudentResults.jsx    ✅ mock data (wire Week 5)
│   │   │   └── StudentProfile.jsx    ✅ mock data (wire Week 4/5)
│   │   ├── instructor/
│   │   │   ├── InstructorDashboard.jsx  ✅ mock data (stats, grid/list view, pagination, retake toggle)
│   │   │   ├── InstructorUpload.jsx     ✅ mock data (manual + Excel upload, draft auto-save)
│   │   │   ├── InstructorPending.jsx    ✅ pending approval holding screen
│   │   │   └── EnrolledStudents.jsx     ✅ mock data (batch toggling, enroll modal, email-derived name)
│   │   └── admin/
│   │       ├── AdminDashboard.jsx       ✅ mock data
│   │       ├── AdminCompanies.jsx       ✅ mock data (Leaflet map lazy-loaded, z-index fix, geocoding)
│   │       ├── AdminUsers.jsx           ✅ mock data (Students + Instructors tabs, UserDetailModal)
│   │       └── AdminNotifications.jsx   ✅ mock data (filter tabs, mark-as-read, click-to-navigate)
│   ├── App.jsx      ✅ all routes defined (see route list below)
│   ├── main.jsx     ✅ BrowserRouter wrapping App
│   └── index.css    ✅ Tailwind v4 + dark mode custom variant
```

### Routes defined in App.jsx (verified)

| Route | Component |
|-------|-----------|
| `/` | `LoginPage` |
| `/login` | `LoginPage` |
| `/admin/login` | `AdminLogin` |
| `/student/setup` | `StudentSetup` |
| `/student/dashboard` | `StudentDashboard` |
| `/student/assessment` | `StudentAssessment` |
| `/student/results` | `StudentResults` |
| `/student/profile` | `StudentProfile` |
| `/instructor/dashboard` | `InstructorDashboard` |
| `/instructor/assessment/create` | `InstructorUpload` |
| `/instructor/students` | `EnrolledStudents` |
| `/instructor/pending` | `InstructorPending` |
| `/admin/dashboard` | `AdminDashboard` |
| `/admin/companies` | `AdminCompanies` |
| `/admin/users` | `AdminUsers` |
| `/admin/notifications` | `AdminNotifications` |

> ⚠️ `/student/assessments` and `/instructor/assessments` routes are NOT yet in App.jsx — add when those pages are built.

---

### Completed checklist

- [x] React project initialized (Vite + React 19)
- [x] Tailwind CSS v4 configured
- [x] React Router DOM v7 set up
- [x] All UI pages built (Weeks 1–2)
- [x] `src/api/axios.js` created with JWT interceptor
- [x] Django project created + connected to Supabase
- [x] All Django models created + migrated
- [x] Auth endpoints working (email/password + Google OAuth + JWT)
- [x] Student profile setup endpoint working
- [x] `LoginPage.jsx` wired to real Google OAuth
- [x] `AdminLogin.jsx` wired to real email/password login
- [x] `StudentSetup.jsx` wired to real profile save
- [x] Assessment endpoints working
- [x] Auto-scoring logic working
- [x] Student dashboard wired to real data
- [x] Skill vector builder working
- [x] Cosine similarity recommendation working
- [x] Remaining pages wired to backend
- [ ] Deployed to Railway + Vercel

**Post-defense UI shells (visible but non-functional until backend ready):**

- [ ] `/student/assessments` page — PENDING COORDINATOR DECISION
- [ ] `/instructor/assessments` page — PENDING COORDINATOR DECISION
- [ ] `StudentDashboard.jsx` — assessment cards list replaces single CTA — PENDING
- [x] `StudentResults.jsx` — distance badge + filter, download report, retake button (shell built)
- [x] `StudentProfile.jsx` — notification preferences section (shell built)
- [x] `StudentAssessment.jsx` — retake flow handling (shell built)
- [ ] `InstructorDashboard.jsx` — assessment selector dropdown — PENDING
- [x] `InstructorDashboard.jsx` — export button (shell built)
- [x] `AdminUsers.jsx` — export button (shell built)

---

## Features Included in v1 (50–60% goal)

- [x] Login + auth — all 3 roles ✅ DONE
- [x] Student profile setup ✅ DONE
- [x] Instructor uploads questionnaire with skill-tagged questions ✅ DONE
- [x] Student takes assessment — auto-scored ✅ DONE
- [x] Skill profile generated per student ✅ DONE
- [x] Admin adds companies and positions ✅ DONE
- [x] Cosine similarity recommendation ✅ DONE
- [x] Instructor dashboard — real student scores ✅ DONE
- [x] Admin dashboard — real company management ✅ DONE

## Features CUT from v1 (add after defense)

1. **Location-based filtering** — distance badge + max-distance slider on `StudentResults`
2. **spaCy text processing** — backend only, improves matching accuracy
3. **PDF / export reports** — `StudentResults` download, `InstructorDashboard` CSV export, `AdminUsers` export
4. **Email notifications** — `StudentProfile` notification prefs, instructor submit alerts
5. **Multiple simultaneous assessments** — assessment list pages, dashboard assessment cards
6. **Retake flow** — `StudentResults` retake button, instructor allow-retake toggle

---

## Key Decisions Log

| Decision | What was chosen | Why |
|---|---|---|
| Frontend framework | React (Vite) | Industry standard, large community |
| Backend framework | Django + DRF | Python needed for scikit-learn |
| Database | PostgreSQL via Supabase | Free hosted, visual editor, great for Django |
| Backend hosting | Railway.app | Free tier does NOT sleep (unlike Render) |
| Frontend hosting | Vercel | Free, auto GitHub deploy, fastest for React |
| NLP approach | Cosine similarity (scikit-learn) | Simple, explainable, no heavy model needed |
| Scoring | Automatic on submit | MCQ questions have stored correct answers |
| Assessment question entry | Excel upload (SheetJS) | Bulk upload handles 100+ questions |
| Question types (v1) | MCQ + True/False only | Auto-scoring requires auto-gradable answers |
| Map library | Leaflet via CDN (no npm install) | Avoids bundle bloat; singleton prevents double-load |
| Geocoding | Nominatim (free, no key) | Sufficient for internal school tool |
| Address input | PSGC API cascading dropdowns | Official PH gov data, no typos in DB |
| Auth — student | Google OAuth (DNSC account only) | DNSC emails already have Google accounts |
| Auth — admin/instructor | Email + password | Admin-seeded, no Google needed |
| Student photo | Google profile photo URL (stored as `photo_url`) | No file upload storage needed |
| Dark mode storage | `sb-theme` in localStorage | Persists across page reloads |
| Assessment autosave | localStorage on every answer pick | Survives internet drop, refresh, tab close |
| Assessment draft save | `sb_assessment_draft` key, 1s debounce | Protects 100+ manually-entered questions |
| Student name from email | Extract from `lastname.firstname@dnsc.edu.ph` | Reduces typos; name is editable if wrong |
| Admin account creation | Seeded directly in DB via Django shell | No UI needed for thesis — one admin |
| Instructor account creation | Admin adds via "Add Instructor" modal | Admin controls who can be OJT coordinator |
| Student account creation | Auto-created on first Google login | No pre-seeding needed |
| Map lazy-mount | `mapEverOpened` flag | Leaflet only loads when map first opened |
| Map z-index fix | `isolation: isolate` on wrapper | CSS stacking context contains Leaflet z-indices |
| **(PENDING)** Assessment count | One vs Multiple per Batch | Confirm with OJT Coordinator |
| **(PENDING)** Slot management | Recommendation only vs Active assignment | Confirm with Capstone Adviser |
| Backend PDF generation | Django backend only (ReportLab) | Keeps frontend lightweight |

---

## How to Use This File With Any AI

Paste this file + `SKILLBRIDGE_CONTEXT.md` from `skillbridge-backend/` at the start of your message.

Example:
> [paste skillbridge-frontend/SKILLBRIDGE_CONTEXT.md]
> [paste skillbridge-backend/SKILLBRIDGE_CONTEXT.md]
> I'm on Week 4. I need to build the assessment creation endpoint. What should it look like?

**Works with:** Claude, ChatGPT, Gemini, Copilot, or any AI assistant.
