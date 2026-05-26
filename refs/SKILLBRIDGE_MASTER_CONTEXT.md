# SkillBridge — Master Context File
> **Single source of truth for the entire project (backend + frontend).**
> Paste ONLY this file at the start of any new AI chat.
> Update `## Current Status` every work session before closing.
> Last updated: April 18, 2026

---

## 1. What is SkillBridge?

A **web-based OJT (On-the-Job Training) placement decision support system** for **Davao del Norte State College (DNSC)**, Panabo City, Davao del Norte. Built as a **thesis project** for the **Bachelor of Science in Information Technology** degree at the Institute of Computing.

### The Problem it Solves
DNSC currently uses manual/paper-based methods and Google Forms to assess student skills before OJT deployment. There is no structured matching between student skills and company requirements.

### What the System Does
1. Instructors/OJT coordinators upload skill assessment questionnaires (replacing Google Forms)
2. Students take the assessment digitally — auto-scored by the backend
3. The system builds a **skill profile** per student using NLP (category-based scoring)
4. Students are shown **ranked company + position recommendations** based on their skills
5. Instructors and admins see dashboards with student performance data

### Project Metadata
| Item | Value |
|------|-------|
| Thesis authors | David Rey P. Bali-os, Lemuel P. Brion, Azel M. Villanueva |
| Builder (current solo dev) | David Rey P. Bali-os |
| Defense/submission deadline | Last week of May 2026 |
| Panel requirement | 100% UI complete + 30% functionalities working |
| Personal goal | 50–60% functionalities working |
| Scope | Single institution (DNSC only) — no multi-school support needed |

---

## 2. Tech Stack

| Layer | Technology | Where it runs |
|-------|-----------|---------------|
| Frontend | React 19 (Vite) + Tailwind CSS v4 | Vercel (free) |
| Backend | Python + Django 6.0.4 + DRF 3.17.1 | Railway.app (free tier) |
| Database | PostgreSQL via Supabase | Supabase (free tier) |
| NLP / Matching | scikit-learn (TF-IDF + cosine similarity) | Inside Django on Railway |
| Auth | JWT via `djangorestframework-simplejwt` | Django backend |
| HTTP client | Axios (`src/api/axios.js`) | React frontend |
| Routing | React Router DOM v7 | React frontend |
| Excel parsing | SheetJS (XLSX) | React frontend (CDN) |
| Map | Leaflet via CDN (no npm install) | React frontend |
| Address input | PSGC API (psgc.gitlab.io) | React frontend |
| Geocoding | Nominatim (free, no API key) | React frontend |

### Live URLs
| Environment | URL |
|-------------|-----|
| Frontend (production) | `https://skill-bridge-six-psi.vercel.app` |
| Backend (production) | `https://skillbridge-production-1e3c.up.railway.app` |
| Frontend (local dev) | `http://localhost:5173` |
| Backend (local dev) | `http://127.0.0.1:8000` |

### Important Tailwind v4 Note
- Uses **Tailwind CSS v4** via `@tailwindcss/vite` plugin — **NO `tailwind.config.js`**
- Dark mode in `src/index.css`:
  ```css
  @import "tailwindcss";
  @custom-variant dark (&:where(.dark, .dark *));
  ```
- Dark mode works by toggling `dark` class on `document.documentElement`
- Red squiggle on `@custom-variant` in VS Code is a false warning

---

## 3. User Roles

| Role | Login Method | What they can do |
|------|-------------|-----------------|
| **Student** | Google OAuth (`@dnsc.edu.ph` only) | Take assessments, view skill profile, see ranked company/position recommendations |
| **Instructor / OJT Coordinator** | Email + password (admin-created account) | Upload questionnaires (questions + correct answers + skill tags), view all student scores, enroll students into batches; must be approved by admin before login |
| **Admin** | Email + password (seeded in DB) | Manage companies and positions, manage all users (approve instructors, view all students), view full recommendations |

---

## 4. Database — All 14 Tables (all migrated ✅)

```
api_user               — id, email, name, role, school_id, course, phone, address (JSONField),
                         photo_url, is_approved, is_active, is_staff, created_at
batches                — id, name, instructor_id (FK→api_user), status, archived_at, created_at
batch_enrollments      — id, batch_id, student_id, enrolled_at [UNIQUE(batch, student)]
skill_categories       — id, name, description, created_by (FK→api_user), created_at
assessments            — id, title, created_by (FK), batch_id (FK), duration_minutes, is_active, created_at
questions              — id, assessment_id (FK), skill_category_id (FK), question_text,
                         question_type (mcq|truefalse|identification), question_order
answer_choices         — id, question_id (FK), choice_text, is_correct (bool)
student_responses      — id, student_id (FK), assessment_id (FK), started_at, submitted_at,
                         retake_allowed [UNIQUE(student, assessment)]
response_answers       — id, response_id (FK), question_id (FK), selected_choice_id (FK, nullable),
                         text_answer (for identification type)
skill_scores           — id, student_id (FK), assessment_id (FK), skill_category_id (FK),
                         raw_score, max_score, percentage [UNIQUE(student, assessment, skill_category)]
companies              — id, name, address (JSONField), location_lat, location_lng, added_by (FK), created_at
positions              — id, company_id (FK), title, slots_available
position_requirements  — id, position_id (FK), skill_category_id (FK), required_percentage
                         [UNIQUE(position, skill_category)]
recommendations        — id, student_id (FK), position_id (FK), match_score, generated_at
```

### JSONField Structures
- **`api_user.address`**: `{ stayingAt, travelWilling, home: {province, city, barangay}, boarding: {province, city, barangay}, pinLat, pinLng }`
- **`companies.address`**: `{ province, city, barangay }`

### Key Notes
- `school_id` stores institutional ID in `YYYY-NNNNN` format (e.g., `2021-12345`)
- `photo_url` stores Google profile photo URL (no file uploads needed)
- Skill categories are **NOT hardcoded** — created dynamically by instructor/admin
- `question_type` supports: `mcq`, `truefalse`, `identification`
- For `identification` type, the correct answer is stored as a single `AnswerChoice` row with `is_correct=True`

---

## 5. Backend — File Structure

```
skillbridge-backend/
├── core/                    ← Django project settings
│   ├── settings.py          ✅ JWT, CORS, DRF, PostgreSQL configured
│   ├── urls.py              ✅ includes api.urls at /api/
│   ├── wsgi.py
│   └── asgi.py
├── api/                     ← Single Django app (all models/views/urls)
│   ├── migrations/
│   │   └── 0001_initial.py  ✅ all 14 models migrated
│   ├── backends.py          ✅ Custom EmailBackend (email replaces username)
│   ├── models.py            ✅ All 14 DB models
│   ├── serializers.py       ✅ UserSerializer
│   ├── scoring.py           ✅ NLP engine (scoring + cosine similarity + TF-IDF)
│   ├── views.py             ✅ All API endpoint handlers (~983 lines)
│   └── urls.py              ✅ All URL routes
├── Procfile                 ← Railway deployment (migrate + gunicorn)
├── manage.py
├── requirements.txt
└── .env                     ← secrets (never commit)
```

### Railway Procfile
```
web: python manage.py migrate --noinput && gunicorn core.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120
```

---

## 6. Backend — All API Endpoints

All routes are prefixed with `/api/` (mounted at `core/urls.py`).

### Auth
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/auth/login/` | No | Email + password → JWT access + refresh + user object |
| POST | `/api/auth/refresh/` | No | Refresh token → new access token |
| GET | `/api/auth/me/` | Yes | Returns logged-in user's profile |
| POST | `/api/auth/google/` | No | Google access token → validate → find/create student → JWT |

### Student
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/students/me/` | Yes (student) | Full student profile + `has_submitted`, `retake_allowed`, `active_assessment`, `batch` |
| PATCH | `/api/students/me/profile/` | Yes (student) | Save student ID, course, phone, address, pin |
| GET | `/api/student/results/` | Yes (student) | Student's own skill scores + ranked recommendations |

### Skill Categories (shared)
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/categories/` | Yes | List all skill categories |
| POST | `/api/categories/` | Yes (instructor/admin) | Create new category |
| POST | `/api/categories/suggest/` | Yes | TF-IDF suggest category for question text |

### Instructor — Batches
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/instructor/batches/` | Yes (instructor/admin) | List instructor's own batches |
| POST | `/api/instructor/batches/` | Yes (instructor/admin) | Create new batch |
| POST | `/api/instructor/batches/{id}/enroll/` | Yes (instructor/admin) | Enroll students into batch (auto-creates student accounts) |
| GET | `/api/instructor/batches/{id}/students/` | Yes (instructor/admin) | List students in batch + submission status |

### Instructor — Assessments
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/instructor/assessments/` | Yes (instructor/admin) | List instructor's assessments |
| POST | `/api/instructor/assessments/` | Yes (instructor/admin) | Create assessment + nested questions + choices |
| PATCH | `/api/instructor/assessments/{id}/` | Yes (instructor/admin) | Update title, duration, is_active |
| GET | `/api/instructor/assessments/{id}/questions/` | Yes (instructor/admin) | Full question list for review |

### Student — Assessment Flow
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/assessments/active/` | Yes (student) | Get active assessment for student's batch |
| POST | `/api/assessments/{id}/start/` | Yes (student) | Start assessment — records `started_at`, returns questions (no correct answers) |
| POST | `/api/assessments/{id}/submit/` | Yes (student) | Submit answers → auto-score → recommendations |

### Instructor — Recommendations
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/instructor/students/recommendations/` | Yes (instructor/admin) | All students in batches + top 3 recommendations + skill scores |

### Admin
| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/admin/companies/` | Yes (admin) | List all companies with positions + requirements |
| POST | `/api/admin/companies/` | Yes (admin) | Add company |
| POST | `/api/admin/companies/{id}/positions/` | Yes (admin) | Add position + requirements to company |
| GET | `/api/admin/students/recommendations/` | Yes (admin) | All students with top 3 recommendations |

---

## 7. Backend — NLP & Scoring Engine (`api/scoring.py`)

Three NLP touchpoints used for the thesis "NLP" requirement:

### Touchpoint 1: TF-IDF Category Suggestion
```python
suggest_category(question_text, categories)
# Uses TfidfVectorizer + cosine_similarity to match question text to existing category names
# Returns best matching category name, or None if similarity < 0.05
```
- Used in `POST /api/categories/suggest/`
- Helps instructor tag new questions automatically

### Touchpoint 2: Auto-Scoring
```python
score_submission(student_response, answers_data, categories)
# MCQ/TrueFalse: checks selected_choice.is_correct
# Identification: case-insensitive exact string match vs stored correct answer
# Writes SkillScore rows to DB (raw, max, percentage per category)
```

### Touchpoint 3: Cosine Similarity Recommendation
```python
generate_recommendations(student, assessment, categories)
# 1. Build student skill vector: [0.82, 0.55, 0.30, ...] (normalized percentages)
# 2. For each Position that has requirements, build position vector
# 3. cosine_similarity(student_vec, position_vec) → match_score (0–100%)
# 4. Writes/updates Recommendation rows in DB
# 5. Returns sorted list (highest match first)
```

**Libraries:** `numpy`, `scikit-learn` (`TfidfVectorizer`, `cosine_similarity`)

---

## 8. Backend — Key Settings (core/settings.py)

```python
AUTH_USER_MODEL = 'api.User'           # ← CRITICAL — must exist before first migrate
SECRET_KEY     = os.getenv('SECRET_KEY')
DEBUG          = os.getenv('DEBUG', 'False') == 'True'
ALLOWED_HOSTS  = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

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
    'http://localhost:5173',
    'https://skill-bridge-six-psi.vercel.app',
]

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}

# Rate limiting
DEFAULT_THROTTLE_RATES = {
    'anon':  '60/minute',
    'user':  '200/minute',
    'login': '10/minute',   # LoginRateThrottle scope
}
```

### Environment Variables (.env — never commit)
```env
SECRET_KEY=django-insecure-changethislater-skillbridge2026
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=<supabase-db-password>
DB_HOST=<supabase-pooler-host>   # Use IPv4 pooling URL for Railway
DB_PORT=5432
```

> ⚠️ **Railway database connection:** Use Supabase **Session Mode (port 5432)** connection pooling URL for DB_HOST, NOT the direct IPv6 `db.*.supabase.co` host (Railway doesn't support IPv6).

---

## 9. Backend — Auth Details

### Google Login flow (students)
1. Frontend calls `useGoogleLogin({ flow: 'implicit' })` → gets `access_token`
2. Sends `{ token: access_token }` to `POST /api/auth/google/`
3. Backend calls `googleapis.com/oauth2/v3/userinfo` to verify token
4. Rejects non-`@dnsc.edu.ph` emails with `403 { error: 'not_dnsc' }`
5. `User.objects.get_or_create(email=email, defaults={role:'student', is_approved:True})`
6. Updates `name` and `photo_url` on every login (keeps photo fresh)
7. Returns `{ access, refresh, user }`

### Instructor pending check
- `POST /api/auth/login/` checks `user.is_approved`
- If instructor not approved: `403 { error: 'pending' }`
- Frontend redirects to `/instructor/pending`

### Custom EmailBackend
```python
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
Required because Django's default auth uses `username` field, but the `User` model uses `email` as `USERNAME_FIELD`.

### Student auto-enrollment
When instructor enrolls students via `POST /api/instructor/batches/{id}/enroll/`, for each email:
- If `User.objects.get(email=email)` exists → reuse
- If doesn't exist → auto-create account with `set_unusable_password()` → student logs in via Google

---

## 10. Backend — Installed Packages

```
Django==6.0.4
djangorestframework==3.17.1
djangorestframework_simplejwt==5.5.1
django-cors-headers==4.9.0
psycopg2-binary==2.9.11
python-dotenv==1.2.2
requests==2.33.1
gunicorn
numpy
scikit-learn
```

---

## 11. Frontend — File Structure

```
skillbridge-frontend/
├── src/
│   ├── api/
│   │   └── axios.js               ✅ Axios instance with JWT Bearer interceptor
│   ├── context/
│   │   ├── SessionContext.jsx     ✅ Session-expired modal (triggered on 401)
│   │   └── ToastContext.jsx       ✅ Toast notifications
│   ├── hooks/
│   │   └── useApi.js              ✅ Universal hook: auto-fetch + manual request + 401 handling
│   ├── components/
│   │   ├── AddressDropdowns.jsx   ✅ PSGC cascading Province→City→Barangay
│   │   ├── NavBar.jsx             ✅ Shared nav with profile dropdown + dark mode toggle
│   │   ├── EmptyState.jsx         ✅ Reusable empty state component
│   │   ├── ErrorBoundary.jsx      ✅ React error boundary
│   │   ├── PageHeader.jsx         ✅ Reusable page header
│   │   ├── Pagination.jsx         ✅ Pagination component
│   │   ├── SearchBar.jsx          ✅ Search bar component
│   │   ├── StatCard.jsx           ✅ Stats card component
│   │   └── StatusBadge.jsx        ✅ Status badge component
│   ├── router/
│   │   └── PrivateRoute.jsx       ✅ Role-based route guard
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.jsx      ✅ WIRED — Google OAuth → /api/auth/google/
│   │   │   └── AdminLogin.jsx     ✅ WIRED — email/password → /api/auth/login/
│   │   ├── student/
│   │   │   ├── StudentSetup.jsx   ✅ WIRED — 4-step profile → PATCH /api/students/me/profile/
│   │   │   ├── StudentDashboard.jsx ✅ WIRED — GET /api/students/me/ (instant via cached sb-user)
│   │   │   ├── StudentAssessment.jsx ✅ WIRED — full assessment flow (start/submit/timer)
│   │   │   ├── StudentResults.jsx   ✅ WIRED — GET /api/student/results/
│   │   │   └── StudentProfile.jsx   ✅ WIRED — profile view + address + map pin
│   │   ├── instructor/
│   │   │   ├── InstructorDashboard.jsx ✅ WIRED — stats, student grid, recommendations tab
│   │   │   ├── InstructorUpload.jsx    ✅ WIRED — manual + Excel upload → POST /api/instructor/assessments/
│   │   │   ├── EnrolledStudents.jsx    ✅ WIRED — batch management, enroll modal
│   │   │   └── InstructorPending.jsx   ✅ Static — pending approval holding screen
│   │   └── admin/
│   │       ├── AdminDashboard.jsx      ✅ WIRED — stats overview + top matches
│   │       ├── AdminCompanies.jsx      ✅ WIRED — Leaflet map + companies/positions CRUD
│   │       ├── AdminUsers.jsx          ✅ WIRED — Students + Instructors tabs, UserDetailModal
│   │       └── AdminNotifications.jsx  ✅ Notification centre (filter/mark-as-read)
│   ├── App.jsx       ✅ All routes defined
│   ├── main.jsx      ✅ Providers: BrowserRouter → GoogleOAuthProvider → ToastProvider → SessionProvider → App
│   ├── index.css     ✅ Tailwind v4 + dark mode custom variant
│   └── App.css
├── index.html
├── vite.config.js
├── vercel.json       ✅ SPA rewrites + security headers
└── package.json
```

---

## 12. Frontend — All Routes

| Route | Component | Auth | Status |
|-------|-----------|------|--------|
| `/` | LoginPage | No | ✅ |
| `/login` | LoginPage | No | ✅ |
| `/admin/login` | AdminLogin | No | ✅ |
| `/instructor/pending` | InstructorPending | No | ✅ |
| `/student/setup` | StudentSetup | student | ✅ |
| `/student/dashboard` | StudentDashboard | student | ✅ |
| `/student/assessment` | StudentAssessment | student | ✅ |
| `/student/results` | StudentResults | student | ✅ |
| `/student/profile` | StudentProfile | student | ✅ |
| `/instructor/dashboard` | InstructorDashboard | instructor | ✅ |
| `/instructor/assessment/create` | InstructorUpload | instructor | ✅ |
| `/instructor/students` | EnrolledStudents | instructor | ✅ |
| `/admin/dashboard` | AdminDashboard | admin | ✅ |
| `/admin/companies` | AdminCompanies | admin | ✅ |
| `/admin/users` | AdminUsers | admin | ✅ |
| `/admin/notifications` | AdminNotifications | admin | ✅ |
| `*` | → `/login` redirect | — | ✅ |

---

## 13. Frontend — Key Technical Patterns

### Auth Storage (localStorage keys)
| Key | Value | Set by |
|-----|-------|--------|
| `sb-token` | JWT access token | Login response |
| `sb-refresh` | JWT refresh token | Login response |
| `sb-role` | `admin` / `instructor` / `student` | Login response |
| `sb-user` | Full user object (JSON string) | Login response (instant render pattern) |
| `sb-theme` | `dark` / `light` | NavBar dark mode toggle |
| `sb_pin_location` | `{ lat, lng }` JSON | StudentProfile map pin |
| `sb_answers_{id}` | Assessment autosave per question | StudentAssessment |
| `sb_timer_{id}` | Timer autosave | StudentAssessment |
| `sb_assessment_draft` | Instructor question draft (1s debounce) | InstructorUpload |

### Axios Instance (`src/api/axios.js`)
```js
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000' })
api.interceptors.request.use(config => {
  const token = localStorage.getItem('sb-token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

### `useApi` Hook Pattern
```js
// Auto-fetch on mount:
const { data, loading, error } = useApi('/api/students/me/', { initialData: getCachedUser() })
// initialData = cached sb-user from localStorage → instant render, API refreshes in background

// Manual trigger (POST/PATCH/DELETE):
const { request, loading } = useApi()
const result = await request('patch', '/api/students/me/profile/', { phone: '...' })
// Returns { ok: true, data } or { ok: false, status, message }
```

On 401 response: `useApi` calls `triggerSessionExpired()` → shows "Session Expired" modal → user re-logs in.

### PrivateRoute Guard
```jsx
const ROLE_REDIRECTS = {
  admin: '/admin/login', instructor: '/admin/login', student: '/login'
}
// Checks localStorage sb-token + sb-role → redirects if unauthenticated or wrong role
```

---

## 14. Frontend — Page-by-Page Feature Detail

### StudentDashboard (WIRED ✅)
- Instant render using `getCachedUser()` from `localStorage['sb-user']`
- Background API refresh via `GET /api/students/me/` updates `has_submitted`, `retake_allowed`, `active_assessment`
- Bento grid layout with named CSS grid areas (desktop 3-col, tablet 2-col, mobile stacked)
- Leaflet map shows nearby companies (loads only after assessment is submitted)
- Map singleton pattern — prevents double-load on re-render
- `haversineKm()` calculates distance from student pin to company lat/lng

### StudentAssessment (WIRED ✅)
- One question at a time (not all questions on one page)
- Timer: set by `duration_minutes` from API, counts down. Amber at 10min, red at 5min, modal warning at 5min, auto-submit at 0
- Autosave: every answer pick → `localStorage['sb_answers_{id}']`
- Timer persisted to `localStorage['sb_timer_{id}']` (survives refresh)
- Before first question: `POST /api/assessments/{id}/start/` records `started_at` (anti-cheat)
- On final submit: `POST /api/assessments/{id}/submit/` → clears localStorage → redirects to `/student/results`
- Identification questions: text input, case-insensitive grading
- MCQ/TrueFalse: radio-style choice selection

### InstructorUpload (WIRED ✅)
- Two question-entry modes: **Manual** (one-by-one form) + **Excel/CSV upload**
- Excel template columns: `question | type | choice_a | choice_b | choice_c | choice_d | correct | category`
- Excel parsed client-side with SheetJS (loaded from CDN on first use)
- Preview table before importing — row-level errors shown
- TF-IDF category suggestion: POST to `/api/categories/suggest/` as user types question text
- Draft auto-saves to `localStorage['sb_assessment_draft']` with 1s debounce
- Restore draft banner appears on page reload if draft exists
- Question types supported: `mcq`, `truefalse`, `identification`
- Publish sends `POST /api/instructor/assessments/` with nested questions + choices

### InstructorDashboard (WIRED ✅)
- Stats: total students, submitted count, avg score
- Student table: grid/list view toggle, pagination, search
- Student Detail Modal: allow retake toggle
- Recommendations tab: shows top 3 companies per student (from `/api/instructor/students/recommendations/`)
- Mobile-responsive nav

### EnrolledStudents (WIRED ✅)
- Batch dropdown — lists all batches (active/archived)
- Enroll modal with two tabs: Excel upload + Manual entry
- Manual entry: email-first → auto-suggests name from DNSC email (`lastname.firstname@dnsc.edu.ph` → `Firstname Lastname`)
- Auto-suggested name is editable
- Duplicate detection (email already enrolled)
- Uses shared Student Detail Modal

### AdminCompanies (WIRED ✅)
- Company cards + Leaflet map (lazy-loaded — only on first map open)
- Geocoding via Nominatim (province/city → lat/lng)
- Map z-index fix: `isolation: isolate` on wrapper element
- Add company modal → POST `/api/admin/companies/`
- Add position modal → POST `/api/admin/companies/{id}/positions/`
- Position requirements: per-category percentage sliders

### AdminUsers (WIRED ✅)
- Tab switcher: Students | Instructors | All Users
- "Instructor Pending" approval workflow with real-time admin notifications
- Soft-archive system (not permanent deletion)
- Role-switching capability (student ↔ instructor)
- User Detail Modal with inline edit (pencil icon for instructor details)
- Add Instructor modal: email-first input, auto-suggests name from email

### AdminNotifications (✅ Built — mostly static/mock)
- Filter tabs: All / Unread / Read
- Mark-as-read per row + mark-all-as-read
- Click-to-navigate on notification

### AddressDropdowns Component
- PSGC API: `https://psgc.gitlab.io/api`
- Three levels: Province → City → Barangay
- Caches in `sessionStorage`: `psgc_provinces`, `psgc_cities_{code}`, `psgc_barangays_{code}`
- All storage wrapped in `try/catch` — safe in private/incognito mode

---

## 15. Frontend — Environment Variables

```env
# skillbridge-frontend/.env
VITE_API_URL=https://skillbridge-production-1e3c.up.railway.app   # production
# VITE_API_URL=http://127.0.0.1:8000                             # local dev (comment out prod)
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

---

## 16. Assessment — Key Design Decisions

| Decision | What was chosen | Why |
|----------|----------------|-----|
| Assessment layout | One question at a time | Cleaner UX, works for any question count |
| Timer anti-cheat | `started_at` recorded on `POST /start/` | Backend can validate elapsed time |
| Autosave | localStorage on every answer pick | Survives internet drop, tab close |
| Question types (v1) | MCQ + True/False + Identification | MCQ/TF auto-gradable; Identification allows text-answer type |
| Identification grading | Case-insensitive exact match | Simple, explainable for thesis |
| Excel template | SheetJS (CDN, no npm install) | Keeps bundle small |
| Draft save | `sb_assessment_draft`, 1s debounce | Protects 100+ manually-entered questions |

---

## 17. Current Status

### ✅ What is Working (End-to-End)

#### Backend
- Django project setup + Supabase PostgreSQL connected ✅
- All 14 models migrated ✅
- `POST /api/auth/login/` → JWT ✅
- `POST /api/auth/refresh/` → new access token ✅
- `GET /api/auth/me/` → user profile ✅
- `POST /api/auth/google/` → Google OAuth + auto-create student ✅
- `PATCH /api/students/me/profile/` → save to Supabase ✅
- `GET /api/students/me/` → student status + batch + assessment info ✅
- `POST /api/instructor/assessments/` → create assessment + questions ✅
- `GET /api/assessments/active/` → active assessment for student's batch ✅
- `POST /api/assessments/{id}/start/` → start + return questions ✅
- `POST /api/assessments/{id}/submit/` → auto-score + recommendations ✅
- `GET /api/instructor/students/recommendations/` → all students' match data ✅
- `GET /api/admin/companies/` → all companies with positions ✅
- `POST /api/admin/companies/` → add company ✅
- `POST /api/admin/companies/{id}/positions/` → add position + requirements ✅
- `GET /api/student/results/` → student's skill scores + recommendations ✅
- NLP scoring (auto-grade MCQ/TF/identification) ✅
- Cosine similarity recommendations ✅
- TF-IDF category suggestion ✅
- Rate limiting (login throttle: 10/min) ✅
- Deployed to Railway ✅

#### Frontend
- All 16 pages built ✅
- Auth flow (Google OAuth + email/password) wired ✅
- Student profile setup wired ✅
- Student Dashboard wired (instant render from cache + background refresh) ✅
- Student Assessment flow wired (start/timer/autosave/submit) ✅
- Student Results page wired ✅
- Student Profile page wired ✅
- Instructor Dashboard wired ✅
- InstructorUpload wired (manual + Excel + TF-IDF suggestion) ✅
- EnrolledStudents batch management + enroll modal wired ✅
- AdminCompanies wired (Leaflet + geocoding + CRUD) ✅
- AdminUsers wired ✅
- AdminDashboard wired ✅
- Deployed to Vercel ✅

### ⚠️ Known Issues / Past Bugs Fixed
| Issue | Status | Fix |
|-------|--------|-----|
| `OperationalError` on Railway — backend couldn't connect to Supabase | Fixed | Use IPv4-compatible Session Mode pooler URL for `DB_HOST`, not `db.*.supabase.co` (IPv6) |
| `401 user_not_found` on JWT auth | Fixed | `AUTH_USER_MODEL = 'api.User'` must be in `settings.py` |
| Frontend crashes on AdminDashboard/StudentDashboard — undefined variables | Fixed | Safe fallbacks on API data destructuring; `getCachedUser()` pattern |
| Leaflet map z-index bleeds above modals | Fixed | `isolation: isolate` on map wrapper |
| NavBar hidden behind Leaflet map | Fixed | CSS stacking context with `isolation: isolate` |
| `corsheaders.E014` trailing slash CORS error | Fixed | Remove trailing slash from `CORS_ALLOWED_ORIGINS` URLs |

### 🔜 Next Things To Do

**Priority 1 — Remaining wiring:**
1. `AdminNotifications.jsx` — wire to real notification data (currently mock/static)
2. AdminDashboard stats — wire all stat cards to real DB counts
3. Student results page maps — wire company locations from DB to map

**Priority 2 — Missing features for completeness:**
1. Batch archive/unarchive endpoint
2. Admin — approve/reject instructor accounts endpoint
3. Allow retake endpoint — instructor toggles `retake_allowed` on `StudentResponse`
4. Instructor assessments list page (`/instructor/assessments`) — PENDING COORDINATOR DECISION

**Priority 3 — Polish:**
1. PDF/CSV export — `StudentResults` download, `InstructorDashboard` CSV, `AdminUsers` export
2. Location-based filtering on `StudentResults` — distance slider
3. `AdminNotifications` real-time feed

**Post-defense (v2):**
- spaCy text processing (improves matching accuracy)
- Multiple simultaneous assessments per batch
- Email notifications
- Slot management (active assignment vs recommendation only)

---

## 18. Development Commands

### Backend
```bash
# Activate venv (Windows)
venv\Scripts\activate

# Run dev server
python manage.py runserver

# Make and apply migrations
python manage.py makemigrations
python manage.py migrate

# Open Django shell (for seeding / debugging)
python manage.py shell

# Save requirements
pip freeze > requirements.txt
```

### Frontend
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

### Seed Admin User (via Django shell)
```python
from api.models import User
u = User(email='admin@dnsc.edu.ph', name='Administrator', role='admin', is_approved=True, is_staff=True, is_superuser=True)
u.set_password('admin123')
u.save()
```

### Seed Test Instructor (via Django shell)
```python
from api.models import User
u = User(email='instructor@dnsc.edu.ph', name='Ma. Lourdes T. Reyes', role='instructor', is_approved=True, is_active=True)
u.set_password('instructor123')
u.save()
```

### Seed Test Student (via Django shell — or create via Google login)
```python
# Students are auto-created on first Google OAuth login with a @dnsc.edu.ph account
# No pre-seeding needed
```

---

## 19. Deployment

### Backend — Railway
- Git push to `main` branch → Railway auto-deploys
- `Procfile` runs: `python manage.py migrate --noinput && gunicorn core.wsgi:application`
- Environment variables set in Railway dashboard (same keys as `.env`)
- URL: `https://skillbridge-production-1e3c.up.railway.app`

### Frontend — Vercel
- Git push to `main` branch → Vercel auto-deploys
- Environment variables set in Vercel dashboard: `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`
- `vercel.json` handles SPA routing (all paths → `/index.html`)
- URL: `https://skill-bridge-six-psi.vercel.app`

### Google OAuth Setup
- Google Client ID configured in Google Cloud Console
- Authorized JavaScript origins: `http://localhost:5173`, `https://skill-bridge-six-psi.vercel.app`
- Authorized redirect URIs: same origins

---

## 20. 7-Week Development Schedule

| Week | Dates | Focus | Status |
|------|-------|-------|--------|
| W1 | Apr 6–12 | UI | Login, student pages — ✅ DONE |
| W2 | Apr 13–19 | UI | Instructor + admin pages — ✅ DONE |
| W3 | Apr 20–26 | Backend | Django setup, all models, auth — ✅ DONE (early) |
| W4 | Apr 27–May 3 | Backend | Assessment CRUD, auto-scoring — ✅ DONE (early) |
| W5 | May 4–10 | Backend | Cosine similarity, recommendations, wire results — ✅ DONE (early) |
| W6 | May 11–17 | Connect | Wire remaining pages, fix bugs | 🔄 IN PROGRESS |
| W7 | May 18–24 | Deploy | Railway + Vercel deploy, seed data, demo prep | ⬜ PENDING |

> **Status as of April 18, 2026:** Well ahead of schedule. Backend fully implemented including NLP scoring and recommendations. Frontend all pages built and most wired. Currently in W6 connect/polish phase.

---

## 21. Key Design Decisions Log

| Decision | Chosen | Why |
|----------|--------|-----|
| Frontend framework | React (Vite) | Industry standard, large community |
| Backend framework | Django + DRF | Python needed for scikit-learn |
| Database | PostgreSQL via Supabase | Free hosted, visual editor, great for Django |
| Backend hosting | Railway.app | Free tier does NOT sleep (unlike Render) |
| Frontend hosting | Vercel | Free, auto GitHub deploy, fastest for React |
| NLP approach | Cosine similarity (scikit-learn) | Simple, explainable, no heavy model needed |
| Question auto-scoring | is_correct flag on AnswerChoice | Each choice stores correctness |
| Identification grading | Exact string match (case-insensitive) | Simple, deterministic |
| Question entry method | Excel upload (SheetJS) + manual | Excel handles bulk; manual for custom questions |
| Map library | Leaflet via CDN (NOT npm install) | Avoids bundle bloat; singleton prevents double-load |
| Geocoding | Nominatim (free, no key) | Sufficient for school-internal tool |
| Address input | PSGC API cascading dropdowns | Official PH gov data, no typos in DB |
| Auth — student | Google OAuth (DNSC account only) | DNSC emails already have Google accounts |
| Auth — admin/instructor | Email + password | Admin-seeded, no Google needed |
| Student name from email | Extract from `lastname.firstname@dnsc.edu.ph` | Reduces typos; name is fully editable |
| Admin account creation | Seeded via Django shell | No UI needed for thesis — one admin |
| Instant render pattern | `getCachedUser()` returns `sb-user` from localStorage | No skeleton on navigation between pages |
| Map lazy-mount | `mapEverOpened` flag | Leaflet only loads when map first opened |
| Map z-index fix | `isolation: isolate` | CSS stacking context contains Leaflet z-indices |
| Assessment one-per-batch | One active assessment per batch | Simplifies flow; PENDING coordinator confirmation for multi-assessment |
| Slot management | Recommendation only (v1) | Active assignment pending adviser confirmation |
