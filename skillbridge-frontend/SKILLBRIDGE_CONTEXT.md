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
| W4   | Apr 27–May 3 | Backend | Assessment CRUD, auto-scoring, instructor dashboard shows real data           |
| W5   | May 4–10     | Backend | Skill vectors, cosine similarity, recommendations endpoint, results page real |
| W6   | May 11–17    | Connect | Wire remaining pages to backend, fix bugs, full flow works                    |
| W7   | May 18–24    | Deploy  | Railway + Vercel deploy, seed data, demo prep                                 |

---

## Current Status

> **Update this section every work session before closing.**

**Current week:** Week 3 — ✅ COMPLETE (ahead of schedule)
**Last thing completed:** Full auth flow working end-to-end — Google OAuth login, admin/instructor email+password login, student profile setup saved to Supabase. ✅

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
- [ ] Assessment endpoints working
- [ ] Auto-scoring logic working
- [ ] Student dashboard wired to real data
- [ ] Skill vector builder working
- [ ] Cosine similarity recommendation working
- [ ] Remaining pages wired to backend
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
- [ ] Instructor uploads questionnaire with skill-tagged questions
- [ ] Student takes assessment — auto-scored
- [ ] Skill profile generated per student
- [ ] Admin adds companies and positions
- [ ] Cosine similarity recommendation
- [ ] Instructor dashboard — real student scores
- [ ] Admin dashboard — real company management

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
