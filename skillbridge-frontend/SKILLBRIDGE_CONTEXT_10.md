# SkillBridge — Project Context File

> Paste this entire file at the start of any new AI chat to restore full context.
> Update the `## Current Status` section every time you finish a work session.

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

## Tech Stack (decided)

| Layer          | Technology                              | Where it runs            |
| -------------- | --------------------------------------- | ------------------------ |
| Frontend       | React.js (Vite) + Tailwind CSS v4       | Vercel (free)            |
| Backend        | Python + Django + Django REST Framework | Railway.app (free tier)  |
| Database       | PostgreSQL via Supabase                 | Supabase (free tier)     |
| NLP / Matching | scikit-learn (cosine similarity)        | Inside Django on Railway |
| Auth           | JWT via djangorestframework-simplejwt   | Django                   |
| HTTP client    | Axios                                   | React frontend           |
| Routing        | React Router DOM v7                     | React frontend           |

**Domain:** Using free `skillbridge.vercel.app` subdomain — no custom domain for thesis.
**NOT using:** .edu.ph (requires school admin approval), Render.com (sleeps on free tier), spaCy (cut for v1), location filtering (cut for v1).

### Important Tailwind v4 note

Project uses **Tailwind CSS v4** (via `@tailwindcss/vite` plugin). There is NO `tailwind.config.js`.
Dark mode is configured in `src/index.css` like this:

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

## Database Tables (planned, not yet built)

```
users                  — id, name, email, password_hash, role (student/instructor/admin), employee_id (format YYYY-NNNNN, used for both students and instructors), course (students only), year_level, address
batches                — id, name (e.g. "AY 2025-2026"), instructor_id (FK), status ("active"/"archived"), archived_at, created_at
skill_categories       — id, name, description, created_by (instructor/admin), created_at
assessments            — id, title, created_by (instructor), created_at, is_active, duration_minutes
questions              — id, assessment_id, question_text, skill_category_id (FK → skill_categories), question_order
answer_choices         — id, question_id, choice_text, is_correct
student_responses      — id, student_id, assessment_id, submitted_at, retake_allowed (boolean, defaults false)
response_answers       — id, response_id, question_id, selected_choice_id
skill_scores           — id, student_id, assessment_id, skill_category_id (FK), raw_score, max_score, percentage
companies              — id, name, address, location_lat, location_lng, added_by (admin)
positions              — id, company_id, title, slots_available
position_requirements  — id, position_id, skill_category_id (FK), required_percentage
recommendations        — id, student_id, position_id, match_score, generated_at
```

> Note: skill categories are fully dynamic — created by instructors/coordinators/admins through the system.
> assessments table has duration_minutes — instructor sets this when creating an assessment.

### Map / location data note

`companies.location_lat` and `companies.location_lng` are already in the schema. The frontend
`AdminCompanies.jsx` already collects these via the PinMap in Step 2 of Add Company modal.
`handleSubmit()` already packages `lat` and `lng` from pinned state. When the API is wired in
Week 4, just include them in the POST body to `/api/admin/companies/`. No schema changes needed.

---

## Skill Categories

**Skill categories are NOT hardcoded.** They are created dynamically by the instructor, OJT coordinator, or admin through the system. This makes the system flexible — any department can define their own categories.

Examples of what an instructor might create:

- "Web Development", "Networking", "Database Management" (for IT)
- Or completely different categories for other courses

### How dynamic categories affect the database

Instead of fixed columns, there is a `skill_categories` table and a separate `position_requirements` table:

```
skill_categories    — id, name, description, created_by, created_at
```

Questions are tagged with a `skill_category_id` (foreign key) instead of a hardcoded text value.

Position requirements are stored per category in a separate table instead of fixed columns:

```
position_requirements — id, position_id, skill_category_id, required_percentage
```

### How dynamic categories affect the recommendation algorithm

The cosine similarity still works — vectors are just built dynamically based on whatever categories currently exist in the database. If there are 6 categories, vectors have 6 dimensions. If there are 3, vectors have 3 dimensions. The math is the same.

---

## How the NLP / Recommendation Works (simplified)

**This is NOT complex AI — it is weighted scoring + cosine similarity.**

### Step 1 — Auto-scoring

After student submits, compare selected answers to `is_correct` field per question.
Count correct answers per skill category. Store in `skill_scores` table.

### Step 2 — Skill vector

Convert scores to percentages:

```python
student_vector = {
  "frontend": 82,   # got 41/50 frontend questions right
  "backend": 55,
  "networking": 30,
  "database": 70,
  "design": 60
}
# Normalized: [0.82, 0.55, 0.30, 0.70, 0.60]
```

### Step 3 — Company/position vector

Admin sets requirements per position (0–100 per category):

```python
position_vector = [0.70, 0.60, 0.00, 0.50, 0.40]  # web dev position
```

### Step 4 — Cosine similarity (the "NLP" / matching part)

```python
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

score = cosine_similarity([student_vector], [position_vector])[0][0]
# Returns value 0.0 to 1.0 — multiply by 100 for percentage match
```

### Step 5 — Rank and return

Sort all positions by match score descending. Return top N as recommendations.

**Libraries needed:** `scikit-learn`, `numpy` (both install via pip, no advanced setup)

---

## Pages / Screens

### Auth pages

- `/login` — Google OAuth button (DNSC account) — ✅ built

### Student pages

- `/student/setup` — 3-step profile setup (student ID, course, phone, address, travel pref) — ✅ built
- `/student/dashboard` — welcome, assessment CTA, locked skill + match preview — ✅ built → **needs update:** replace single CTA button with assessment cards list when multiple assessments feature is added
- `/student/assessments` — full list of available assessments with status per card (not started / in-progress / completed) — ⬜ not built yet
- `/student/assessment` — one question at a time, timer, autosave, review screen, confirm modal — ✅ built → **needs update:** handle retake flow (pre-fill answers, timer reset) when retake feature is added
- `/student/results` — animated skill bars + ranked company match cards — ✅ built → **needs update:** distance badge + filter, download report button, retake button
- `/student/profile` — edit profile photo + all setup fields — ✅ built → **needs update:** notification preferences section

### Shared components

- `src/components/AddressDropdowns.jsx` — cascading Province → City → Barangay using PSGC API — ✅ built + production-hardened
- `src/components/NavBar.jsx` — shared nav with profile dropdown (My profile, dark mode toggle, logout) — ✅ built

### Instructor pages

- `/instructor/dashboard` — stats + skill leaders + student table with **grid/list view toggle + pagination** + mobile-responsive nav. Fixed New Assessment button navigates to `/instructor/assessment/create`. Clicking a student opens a shared **Student Detail Modal** with toggleable "Allow Retake" action. — ✅ built + updated
- `/instructor/assessments` — manage all published assessments: active/inactive toggle, submission count per assessment, archive/delete — ⬜ not built yet
- `/instructor/assessment/create` — two question-entry modes: (1) manual form with category tagging, (2) Excel/CSV upload with SheetJS parse → preview table → import into question list. Both modes share the same categories manager and assessment metadata. Download template button (CSV). **Draft auto-saves to `localStorage` (`sb_assessment_draft`) on every change (1s debounce); restore banner on reload; draft cleared on publish.** Mobile-responsive nav. — ✅ built + updated
- `/instructor/students` — enrolled students list with **batch dropdown selection (Active/Archived cohorts)**. Enroll modal has two tabs: Excel upload and manual entry. **Manual entry asks for Email first, then auto-suggests the Full Name based on the DNSC email** (`lastname.firstname@dnsc.edu.ph` → `Firstname Lastname`), which can be edited. Duplicate ID/email detection. Green toast on success. Uses the shared **Student Detail Modal** for per-student view and actions. — ✅ built + updated

### Admin pages

- `/admin/dashboard` — overview stats + top matches + searchable student table — ✅ built
- `/admin/companies` — company cards + map + add company/position modals — ✅ built + production-hardened
- `/admin/students` — tab switcher: Students table + Instructors table + Email-first Add Instructor modal. Uses shared **User Detail Modal** to view profiles, see assessment status (Retake toggling), and inline edit Instructor details (pencil icon). — ✅ built + updated

---

## Assessment — Key Design Decisions

- **Layout:** One question at a time (cleaner UX, works for any question count)
- **Timer:** Set by instructor via `duration_minutes` field. Countdown shown in nav sub-bar. Turns amber at 10 min left, red at 5 min, shows warning modal at exactly 5 min, auto-submits at 0.
- **Autosave:** Every answer pick saves to `localStorage` immediately using keys `sb_answers_{assessment_id}` and `sb_timer_{assessment_id}`. Survives refresh, internet drop, tab close.
- **No back/pause button on purpose** — autosave handles reconnection scenarios.
- **Review screen:** Shows all questions with selected answers. Each has an Edit button to jump back to that question. Unanswered shown in amber.
- **Confirmation modal:** Shows X of Y answered, warns it's final.
- **After submit:** Clears localStorage progress, redirects to `/student/results`.

---

## Assessment — Question Types (DECIDED)

**v1 supports MCQ (multiple choice) only.** This is a deliberate scope decision, not a limitation.

### Why MCQ only?

The entire auto-scoring → skill profiling → cosine similarity pipeline requires auto-gradable answers. Open-ended/paragraph answers require manual grading, which breaks the pipeline and removes the system's core technical contribution.

### Supported question formats:

| Format                | How it works                                  | Example                                                 |
| --------------------- | --------------------------------------------- | ------------------------------------------------------- |
| Multiple choice (MCQ) | Standard question + 4 choices (A/B/C/D)       | "What does CSS stand for?"                              |
| True/False            | 2-choice question, stored the same way as MCQ | "CSS stands for Cascading Style Sheets. True or False?" |

### Question types CUT from v1:

- Image-based questions (deferred — adds complexity to upload template and display)
- Open-ended / paragraph answers (needs manual grading, breaks scoring pipeline)
- Fill-in-the-blank (fragile exact matching)
- Drag-and-drop / ordering questions

---

## Assessment — Instructor Upload Flow (DECIDED)

**Instructors can add questions via Excel upload OR manual entry — both are fully supported.**

### Flow:

1. Instructor downloads a pre-made `.xlsx` template from the create page
2. Fills in questions offline in Excel (question text, 4 choices, correct answer letter, skill category)
3. Uploads the `.xlsx` on the create assessment page
4. Frontend parses the file using **SheetJS**
5. Questions are shown in a preview table — instructor can spot and fix errors
6. Instructor sets assessment title + duration, then publishes
7. POST to `/api/instructor/assessments/` with full payload

### Excel template columns:

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

- Stored in `localStorage` as `sb-theme` ('dark' or 'light')
- Toggle is in the profile dropdown in NavBar
- Applied by adding/removing `dark` class on `document.documentElement`
- All pages read `localStorage.getItem('sb-theme')` on mount to restore preference
- Photo upload stored temporarily in `localStorage` as `sb_photo` (base64) until Week 3 API

---

## 7-Week Schedule

| Week | Dates        | Focus   | Goal                                                                          |
| ---- | ------------ | ------- | ----------------------------------------------------------------------------- |
| W1   | Apr 6–12     | UI      | Login, student pages — **✅ DONE**                                            |
| W2   | Apr 13–19    | UI      | Instructor + admin pages — **✅ DONE**                                        |
| W3   | Apr 20–26    | Backend | Django setup, all models, auth endpoints, real login works                    |
| W4   | Apr 27–May 3 | Backend | Assessment CRUD, auto-scoring, instructor dashboard shows real data           |
| W5   | May 4–10     | Backend | Skill vectors, cosine similarity, recommendations endpoint, results page real |
| W6   | May 11–17    | Connect | Wire remaining pages to backend, fix bugs, full flow works                    |
| W7   | May 18–24    | Deploy  | Railway + Vercel deploy, seed data, demo prep                                 |

---

## Features Included in v1 (50–60% goal)

- [x] (planned) Login + register — all 3 roles
- [x] (planned) Instructor uploads questionnaire with skill-tagged questions
- [x] (planned) Student takes assessment — form with multiple choice
- [x] (planned) Auto-scoring on submit — no manual scoring needed
- [x] (planned) Skill profile generated per student (5 categories)
- [x] (planned) Admin adds companies and positions with skill requirements
- [x] (planned) Cosine similarity recommendation — ranked list per student
- [x] (planned) Instructor dashboard — student scores, top performers
- [x] (planned) Admin dashboard — company management

## Features CUT from v1 (add after defense)

All 6 deferred features require **both backend work and frontend UI changes**.
The UI shells for these should be built now (visible but non-functional) so the app looks 100% complete.

---

### 1. Location-based filtering (geopy / Haversine)

**Backend:** distance math using geopy/Haversine from student address to company location.
**Frontend changes needed:**

- `StudentResults.jsx` — distance badge on each company match card ("~4.2 km away"), max-distance slider/filter above the results list

---

### 2. spaCy text processing

**Backend only** — improves matching accuracy behind the scenes.
**No frontend changes needed.**

---

### 3. PDF / export reports

**Backend:** generates PDF.
**Frontend changes needed:**

- `StudentResults.jsx` — "Download my report" button (skill profile + ranked matches as PDF)
- `InstructorDashboard.jsx` — "Export class scores" button (CSV or PDF of all student scores table)
- `AdminStudents.jsx` — "Export" button on the students table

---

### 4. Email notifications

**Backend:** sends emails via SMTP.
**Frontend changes needed:**

- `StudentProfile.jsx` — add a **Notification preferences** section (toggles: "Email me when results are ready", etc.)
- `InstructorDashboard.jsx` — notification preference toggle: "Email me when a student submits"

---

### 5. Multiple simultaneous active assessments

**Backend:** assessment list endpoint, active/inactive flag, multiple assessments per instructor.
**Frontend changes needed (most impactful of the 6):**

- `StudentDashboard.jsx` — replace single big CTA button with a **list of available assessment cards** (each showing: title, status: not started / in-progress / completed, deadline if any)
- New page `/student/assessments` — full list view of all assessments available to the student
- New page `/instructor/assessments` — manage all published assessments (active/inactive toggle, submission count per assessment, archive/delete)
- `InstructorDashboard.jsx` — add an **assessment selector dropdown** at the top so the instructor can switch which assessment's scores they're viewing in the table

---

### 6. Editing submitted answers / retake

**Backend:** re-open a student's submission, reset score.
**Frontend changes needed:**

- `StudentResults.jsx` — "Retake assessment" button (only visible if instructor has allowed it)
- `InstructorDashboard.jsx` — per-student **"Allow retake"** action (button or toggle next to each student row in list view)
- `StudentAssessment.jsx` — handle retake flow (pre-fill previous answers on load, timer reset)

---

### UI work summary (what to build, where)

| UI change                                     | File                      | Status       |
| --------------------------------------------- | ------------------------- | ------------ |
| Distance badge + filter slider on match cards | `StudentResults.jsx`      | ⬜ not built |
| "Download my report" button                   | `StudentResults.jsx`      | ⬜ not built |
| "Retake assessment" button (if allowed)       | `StudentResults.jsx`      | ⬜ not built |
| Assessment cards list (replace CTA button)    | `StudentDashboard.jsx`    | ⬜ not built |
| Notification preferences toggles              | `StudentProfile.jsx`      | ⬜ not built |
| Assessment selector dropdown                  | `InstructorDashboard.jsx` | ⬜ not built |
| "Allow retake" toggle per student row         | `InstructorDashboard.jsx` | ⬜ not built |
| "Export class scores" button                  | `InstructorDashboard.jsx` | ⬜ not built |
| "Export" button on students table             | `AdminStudents.jsx`       | ⬜ not built |
| New page: student assessment list             | `/student/assessments`    | ⬜ not built |
| New page: instructor assessment manager       | `/instructor/assessments` | ⬜ not built |

---

## AdminCompanies.jsx — Technical Notes (important for Week 4 wiring)

### Map data → database

- `companies.location_lat` and `companies.location_lng` are already in the schema.
- The PinMap (Step 2 of Add Company modal) sets `pinned = { lat, lng }` via click or drag.
- `handleSubmit()` already sends `lat: pinned?.lat ?? null` and `lng: pinned?.lng ?? null`.
- When wiring the API in Week 4, just include `location_lat` and `location_lng` in the POST body.

### Map library — Leaflet via CDN

- Leaflet is **not npm-installed** — it is loaded from CDN via a singleton `loadLeaflet()` promise.
- The singleton ensures the script is only injected once per browser session.
- Do **not** add `leaflet` to `package.json` — the CDN approach is intentional.

### Performance fixes applied (production-ready)

1. **Lazy-mount for CompaniesMap** — `mapEverOpened` flag prevents Leaflet from loading until the user first opens the "Partner Locations" panel. On subsequent open/close, the component stays mounted (CSS `max-h` handles show/hide). This eliminates the slow initial page load.
2. **`showMap` defaults to `false`** — overview map is closed by default so page loads instantly.
3. **`isolation: isolate`** on the CompaniesMap wrapper — creates a CSS stacking context that contains Leaflet's internal z-indices so they never bleed above the Add Company modal. This is the correct fix for the Leaflet z-index problem.

### Geocoding — `geocodeAddress({ barangay, city, province })`

- Uses Nominatim (free, no API key, 1 req/sec limit — fine for internal school tool).
- Returns `{ lat, lng, zoom }` — zoom is smart based on specificity:
  - Barangay selected → zoom 17 (street level, ideal for pinning)
  - City only → zoom 15 (neighbourhood level)
  - Province only → zoom 12 (city overview)
- PinMap re-centers at the correct zoom whenever any dropdown changes — user lands exactly where they need to drop the pin.
- Geocoding status label is dynamic: "Locating Brgy. X on map…" vs "Locating City Y on map…"

---

## AddressDropdowns.jsx — Technical Notes

### sessionStorage caching (production-ready)

All 3 API levels are cached in `sessionStorage`:

- `psgc_provinces` — province list (fetched once, never changes)
- `psgc_cities_{code}` — city list per province code
- `psgc_barangays_{code}` — barangay list per city code

On revisit or re-selection of the same area, data loads instantly from cache with no network request.
Cache clears when the tab is closed (sessionStorage behaviour), which is correct — PSGC data rarely changes but we don't want stale data across sessions.

### Safe storage helpers

`ssGet()` and `ssSet()` wrap all sessionStorage calls in try/catch. This prevents crashes in private/incognito mode or on devices where storage is blocked by policy. Falls back silently to fetching from the API.

### API used

`https://psgc.gitlab.io/api` — Official Philippine Statistics Authority PSGC data, free, no signup, no key.

---

## Current Status

> **Update this section every work session before closing.**

**Current week:** Week 2 — ✅ COMPLETE (UI done + production hardening done + UX polish done)
**Last thing completed:** Admin & Instructor Student Management Polish — Batch cohorts, User Detail Modals, inline Action toggles, email-derived names for all roles. ✅
**Currently working on:** Ready for backend API transition.
**Next task:** Week 3 — Django setup, all models, auth endpoints, real login works

**Key decisions made this session:**

- **Batch Management (`EnrolledStudents.jsx`):**
  - Grouped students into `Batches` (e.g. AY 2025-2026). Allows instructors to manage Active/Archived cohorts.
  - Archived batches disable add/retake logic to preserve historical data.
- **Unified User Detail Modals (`StudentModal` & `UserDetailModal`):**
  - Standardized the clickable detailed view for users.
  - Allows Admins and Instructors to view assessment scores, current placement, and perform actions (Toggle Retake, Remove).
  - Admins can inline-edit instructor details directly in the modal via Pencil icon.
- **Email-Derived Name Automation (`AddInstructorModal` & `EnrollModal`):**
  - Typing `john.doe@dnsc.edu.ph` live-previews "Doe John" in the Full Name input field, which can be confirmed or edited manually.
  - Works consistently for adding Instructors (Admin panel) and enrolling Students (Instructor panel).
- **Assessment Retake Workflow (`StudentDashboard`, `EnrolledStudents`, `InstructorDashboard`, `AdminStudents`):**
  - Added `retakeAllowed` boolean.
  - Instructors and admins can allow student retakes from the user detail modals.
  - When allowed, students see an interactive "Retake Available" notification banner in their dashboard.

**Affected files this session:** EnrolledStudents.jsx, StudentDashboard.jsx, AdminStudents.jsx, InstructorDashboard.jsx
**Blockers / problems:** None

### File structure so far

```
src/
├── components/
│   ├── AddressDropdowns.jsx   ✅ PSGC cascading dropdowns + sessionStorage cache + safe storage helpers
│   └── NavBar.jsx             ✅ shared nav with dropdown (profile, dark mode, logout)
├── pages/
│   ├── auth/
│   │   └── LoginPage.jsx      ✅ Google OAuth button (fake for now)
│   ├── student/
│   │   ├── StudentSetup.jsx   ✅ 3-step profile setup
│   │   ├── StudentDashboard.jsx ✅ assessment CTA + locked previews
│   │   ├── StudentAssessment.jsx ✅ timer + autosave + review + confirm
│   │   ├── StudentResults.jsx ✅ skill bars + ranked match cards
│   │   └── StudentProfile.jsx ✅ edit profile + photo upload
│   ├── instructor/
│   │   ├── InstructorDashboard.jsx  ✅ stats + skill leaders + student table (grid/list view + pagination, clickable cards)
│   │   │                               mobile-responsive nav + fixed New Assessment button + retake toggling toggle
│   │   ├── InstructorUpload.jsx     ✅ manual entry + Excel upload for questions, tab switcher
│   │   │                               draft auto-save to localStorage + restore banner on reload
│   │   │                               mobile-responsive nav
│   │   └── EnrolledStudents.jsx     ✅ student list with active/historical **Batch toggling**, enroll modal (Excel/manual)
│   │                                   manual entry derives student name from DNSC email automatically
│   └── admin/
│       ├── AdminDashboard.jsx  ✅ stats + top matches + searchable student table
│       ├── AdminCompanies.jsx  ✅ company cards + Leaflet map (lazy-loaded) + add company modal
│       │                          (2-step: PSGC dropdowns → smart pin map) + z-index fix + geocoding
│       └── AdminStudents.jsx   ✅ tab switcher: Students + Instructors tables + email-first Add Instructor modal. Clickable users via UserDetailModal.
├── App.jsx      ✅ all routes defined including /student/profile — needs /student/assessments and /instructor/assessments added when those pages are built
├── main.jsx     ✅ BrowserRouter wrapping App
└── index.css    ✅ Tailwind v4 + dark mode custom variant
```

### Completed checklist

- [x] Concept paper outline
- [x] Tech stack decided
- [x] Roadmap planned
- [ ] GitHub repos created
- [ ] Supabase project created
- [ ] Railway account created
- [ ] Vercel account created
- [x] React project initialized (Vite + React 19)
- [x] Tailwind CSS v4 configured
- [x] React Router DOM v7 set up
- [x] Login page built
- [x] Student setup page built (3-step with PSGC address dropdowns)
- [x] Student dashboard built (static)
- [x] Student assessment built (timer + autosave + review)
- [x] Student results built (static)
- [x] Student profile built (photo upload + edit fields)
- [x] Shared NavBar component built
- [x] Shared AddressDropdowns component built + production-hardened
- [x] Instructor dashboard built — grid/list view, pagination, mobile nav, fixed nav button
- [x] Instructor upload page built — manual + Excel upload, draft auto-save, mobile nav
- [x] Instructor enrolled students page built — enroll via Excel/manual, email-derived name, mobile nav
- [x] Admin pages built (static) — dashboard, companies, students
- [x] AdminCompanies production-hardened (lazy Leaflet, z-index fix, smart geocoding)
- [ ] Django project created
- [ ] Django connected to Supabase
- [ ] All Django models created + migrated
- [ ] Auth endpoints working (register/login/JWT)
- [ ] Assessment endpoints working
- [ ] Auto-scoring logic working
- [ ] Skill vector builder working
- [ ] Cosine similarity recommendation working
- [ ] Frontend connected to backend (Axios)
- [ ] Full flow tested end-to-end
- [ ] Deployed to Railway + Vercel

**Post-defense UI to build (shells — visible but non-functional until backend is ready):**

- [ ] `/student/assessments` page built (PENDING COORDINATOR DECISION)
- [ ] `/instructor/assessments` page built (PENDING COORDINATOR DECISION)
- [ ] `StudentDashboard.jsx` — assessment cards list replaces single CTA (PENDING)
- [x] `StudentResults.jsx` — distance badge + filter, download report, retake button
- [x] `StudentProfile.jsx` — notification preferences section
- [x] `StudentAssessment.jsx` — retake flow banner
- [ ] `InstructorDashboard.jsx` — assessment selector (PENDING)
- [x] `InstructorDashboard.jsx` — export button
- [x] `AdminStudents.jsx` — export button

---

## How to Use This File With Any AI

Paste this entire file at the start of your message, then add your question. Example:

> [paste this file]
> I'm on Week 3. I just set up my Django project and now I need to write the User model. The user has a role field that can be student, instructor, or admin. What should the model look like?

**Works with:** Claude, ChatGPT, Gemini, Copilot, or any AI assistant.

---

## Key Decisions Log

| Decision                           | What was chosen                                                                | Why                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend framework                 | React (Vite)                                                                   | Industry standard, large community                                                                                                                                                                                                                                                               |
| Backend framework                  | Django + DRF                                                                   | Python needed for scikit-learn, Django has built-in admin                                                                                                                                                                                                                                        |
| Database                           | PostgreSQL via Supabase                                                        | Free hosted, visual table editor, great for Django                                                                                                                                                                                                                                               |
| Backend hosting                    | Railway.app                                                                    | Free tier does NOT sleep (unlike Render)                                                                                                                                                                                                                                                         |
| Frontend hosting                   | Vercel                                                                         | Free, automatic GitHub deploy, fastest for React                                                                                                                                                                                                                                                 |
| Domain                             | vercel.app subdomain                                                           | Free, acceptable for thesis defense                                                                                                                                                                                                                                                              |
| NLP approach                       | Cosine similarity (scikit-learn)                                               | Simple, explainable, no heavy model needed                                                                                                                                                                                                                                                       |
| Scoring                            | Automatic on submit                                                            | MCQ questions have stored correct answers                                                                                                                                                                                                                                                        |
| Location filtering                 | Cut from v1                                                                    | Out of scope for one-month solo build                                                                                                                                                                                                                                                            |
| Assessment question entry          | Excel file upload (SheetJS)                                                    | Manual entry = Google Forms. Bulk upload handles 100+ questions                                                                                                                                                                                                                                  |
| Question types (v1)                | MCQ + True/False only                                                          | Auto-scoring requires auto-gradable answers                                                                                                                                                                                                                                                      |
| Assessment timer                   | Countdown set by instructor                                                    | Stored in assessments.duration_minutes                                                                                                                                                                                                                                                           |
| Assessment autosave                | localStorage on every answer pick                                              | Survives internet drop, refresh, calamity                                                                                                                                                                                                                                                        |
| Dark mode storage                  | localStorage sb-theme key                                                      | Persists across page reloads                                                                                                                                                                                                                                                                     |
| Profile photo (temp)               | localStorage base64                                                            | Replaced with API upload in Week 3                                                                                                                                                                                                                                                               |
| Address input                      | PSGC API cascading dropdowns                                                   | Official PH gov data, free, no typos in DB                                                                                                                                                                                                                                                       |
| Address caching                    | sessionStorage per level                                                       | Instant re-selection; clears on tab close so data stays fresh                                                                                                                                                                                                                                    |
| Tailwind config                    | No tailwind.config.js (v4)                                                     | v4 uses CSS-first config via index.css                                                                                                                                                                                                                                                           |
| Auth gating                        | Pre-registration required                                                      | Only users in `users` table can log in — prevents unauthorized access                                                                                                                                                                                                                            |
| User identity                      | Email + YYYY-NNNNN ID (both required)                                          | Two-layer: email = Google login key, ID = institutional record                                                                                                                                                                                                                                   |
| Admin account creation             | Seeded directly in DB                                                          | No UI needed for thesis — one admin, created once via Django shell                                                                                                                                                                                                                               |
| Instructor account creation        | Admin adds via "Add Instructor" modal                                          | Admin controls who can be an OJT coordinator                                                                                                                                                                                                                                                     |
| Student account creation           | Instructor enrolls via Excel upload or manual form                             | Instructor responsible for their own students                                                                                                                                                                                                                                                    |
| Map library                        | Leaflet via CDN (no npm install)                                               | Avoids bundle bloat; singleton promise prevents double-load                                                                                                                                                                                                                                      |
| Map lazy-mount                     | `mapEverOpened` flag                                                           | Leaflet only downloads when user first opens the map — faster page load                                                                                                                                                                                                                          |
| Map z-index fix                    | `isolation: isolate` on wrapper                                                | Correct CSS fix: contains Leaflet's internal z-indices so they never bleed above modals                                                                                                                                                                                                          |
| Geocoding                          | Nominatim (free, no key)                                                       | Sufficient for internal school tool; returns zoom level per address specificity                                                                                                                                                                                                                  |
| Company lat/lng                    | Captured in PinMap, sent in POST body                                          | Already in DB schema (location_lat, location_lng); Week 4 just includes in API call                                                                                                                                                                                                              |
| Instructor table UX                | Grid + list view toggle + pagination on InstructorDashboard                    | Matches EnrolledStudents pattern for consistency; grid is default on mobile                                                                                                                                                                                                                      |
| Assessment draft save              | `localStorage` key `sb_assessment_draft`, 1s debounce, restored on page reload | Protects 100+ manually-entered questions from internet drop or accidental close                                                                                                                                                                                                                  |
| Draft auto-clear                   | `clearDraft()` called on successful publish                                    | Prevents stale draft from appearing when instructor starts a new assessment                                                                                                                                                                                                                      |
| Student name from email            | Extract from DNSC email `lastname.firstname@dnsc.edu.ph`                       | DNSC emails already encode the student's name — no need to ask twice; reduces typos and provides a starting suggestion                                                                                                                                                                           |
| Manual enroll fields               | Email + Name + Student ID (name suggested from email, but editable)            | Simpler form, but still allows correcting edge-cases in the extracted name if needed                                                                                                                                                                                                             |
| **(PENDING)** Assessment Count     | One Assessment vs Multiple Assessments per Batch                               | Need to confirm with OJT Coordinator if a batch takes a single Entrance Exam, or multiple Quiz-style assessments. Single assessment is heavily recommended for matching simplicity.                                                                                                              |
| Backend PDF Generation             | Student Report PDF & Admin/Instructor CSV Exports                              | To keep the frontend fast and lightweight, complex PDF/CSV generation will be built exclusively in the Django backend (e.g., using `ReportLab`) rather than heavy UI libraries. The UI currently uses mock `.md` and toast notifications as placeholders.                                        |
| **(PENDING)** Slot Management Flow | "Recommendation Only" vs "Active Assignment & Slot Depletion"                  | Need to confirm with Capstone Adviser if Instructors should actively click "Assign" to lock a student to a company. If yes, the database must track `slots_requested` vs `slots_filled` per Batch, grey out companies that are "FULL", and change student status from `completed` to `deployed`. |
