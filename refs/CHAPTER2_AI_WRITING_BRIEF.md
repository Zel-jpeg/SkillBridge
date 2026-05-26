# SkillBridge — Chapter 2 (Methodology) AI Writing Brief
> **How to use this file:** Paste this entire file into Claude or ChatGPT along with the Chapter 2 example/template given by your professor. Then ask the AI to write Chapter 2 for SkillBridge following that format.
>
> **System Title:** SkillBridge — Web-Based OJT Placement Decision Support System
> **Institution:** Davao del Norte State College (DNSC), Panabo City, Davao del Norte
> **Program:** Bachelor of Science in Information Technology, Institute of Computing
> **Authors:** David Rey P. Bali-os, Lemuel P. Brion, Azel M. Villanueva
> **Adviser:** [Insert adviser name]

---

## HOW TO PROMPT THE AI

Copy and paste this into Claude or ChatGPT:

```
I am writing Chapter 2 (Methodology) of my capstone paper titled "SkillBridge: A Web-Based OJT Placement Decision Support System for Davao del Norte State College."

Below is the exact format/template given to us by our professor (Chapter 2 example):
[PASTE YOUR PROFESSOR'S CHAPTER 2 EXAMPLE HERE]

Below is all the information about our actual system that you need to write Chapter 2:
[PASTE THE REST OF THIS FILE HERE]

Please write Chapter 2 for SkillBridge following exactly the same structure, section order, and academic writing style as the example. Replace all fire-detection-specific content with SkillBridge-specific content. Keep the language formal and academic. Do not make up features that are not listed here.
```

---

## SECTION 1 — PROJECT OVERVIEW

### What is SkillBridge?
SkillBridge is a **web-based OJT (On-the-Job Training) placement decision support system** developed for **Davao del Norte State College (DNSC)**, Panabo City, Davao del Norte, Philippines.

### The Problem It Solves
DNSC currently uses manual and paper-based methods, including Google Forms, to assess student skills before OJT deployment. There is no structured, data-driven matching between student competency profiles and company/position requirements. OJT coordinators rely on subjective judgment when assigning students to companies.

### What the System Does
1. OJT Coordinators (Instructors) upload skill assessment questionnaires to the system (replacing Google Forms)
2. Students take the digital assessment — it is automatically scored by the backend
3. The system builds a **skill competency profile** per student using NLP-based category scoring
4. Students are shown **ranked company and position recommendations** based on their skill match scores
5. Instructors and Admins view dashboards with student performance data, scores, and ranked placements
6. The OJT coordinator retains full authority over the final placement decision — SkillBridge **recommends**, it does not automate assignment

### Why It Is a Decision Support System (DSS)
A DSS has three components: (1) Data Management, (2) Model/Algorithm Management, and (3) User Interface. SkillBridge satisfies all three:
- **Data Management:** PostgreSQL (via Supabase) with 14 tables storing user profiles, assessments, scores, companies, and recommendations
- **Model Management:** `scoring.py` — the NLP engine that auto-grades assessments, builds skill vectors, and generates cosine similarity recommendations
- **User Interface:** React-based web frontend with role-specific dashboards for students, instructors, and admins

---

## SECTION 2 — METHODOLOGY (Project Management Approach)

### Adopted Methodology
SkillBridge used a **Hybrid Project Management Methodology** combining:
- **Waterfall** approach for the initial stages: planning, requirements definition, and documentation (proposals, system designs)
- **Agile/Iterative** approach during implementation and testing: iterative development, continuous testing, and incremental improvement of features (NLP scoring engine, recommendation system, UI dashboards)

This is aligned with the **PADIM framework** (Planning, Analysis, Design, Implementation, Maintenance).

### Phase Descriptions

#### Planning Phase
The proponents defined the project scope, objectives, and timeline based on the approved concept paper. They identified that DNSC lacked a structured, automated system for matching IT students to OJT positions. They established the feasibility of building a web-based DSS with NLP-based skill matching within the project timeline. The team also determined the required technologies and resources.

#### Analysis Phase
The proponents gathered system requirements by:
- Reviewing the existing DNSC OJT process (Google Forms, manual assessment)
- Identifying user roles and their needs: students need placement recommendations; instructors need to create and deploy assessments; admins need to manage companies and users
- Identifying both functional and non-functional requirements
- Determining the technical feasibility of NLP-based matching (cosine similarity) for a small-to-medium student population

#### Design Phase
The proponents translated requirements into:
- System architecture (React frontend + Django REST Framework backend + PostgreSQL database)
- Database schema (14 tables, ERD)
- User interface prototypes for all three user roles
- Data flow diagrams (Context/Level 1 DFD)
- NLP algorithm selection (TF-IDF + Cosine Similarity)

#### Implementation Phase
The proponents developed the system using an iterative approach:
- Week 1–2: Frontend UI for all 16 pages (student, instructor, admin)
- Week 3–4: Django backend, all 14 models, authentication, assessment CRUD
- Week 5: NLP scoring engine, cosine similarity recommendations, wiring frontend to backend
- Week 6–7: Bug fixing, deployment, final integration
- Features developed incrementally: assessment creation → auto-scoring → recommendation generation → dashboard visualization

#### Maintenance Phase
After deployment, the proponents:
- Conducted system evaluation and UAT (User Acceptance Testing)
- Identified and resolved bugs (e.g., Railway IPv6/IPv4 connection issue, JWT user model conflict, Leaflet z-index)
- Applied improvements based on testing results
- Established a system security plan and maintenance plan

---

## SECTION 3 — SYSTEM PLANNING

### Project Team Organization
| Role | Name | Responsibilities |
|------|------|-----------------|
| Adviser | [Insert adviser name] | Provides overall academic and technical guidance; ensures project meets institutional standards |
| Project Manager | David Rey P. Bali-os | Oversees planning, task coordination, development, and progress monitoring; primary developer |
| System Analyst / Documentation | Lemuel P. Brion | Requirements analysis, documentation, system design diagrams |
| System Developer / Documentation | Azel M. Villanueva | Supports development and documentation; co-author |

### Work Breakdown Structure (WBS) — PADIM Framework

**Planning Phase Tasks:**
- Define project scope and objectives
- Review existing DNSC OJT process
- Prepare concept paper and proposal
- Identify system requirements (functional and non-functional)
- Select technology stack
- Establish project timeline (Gantt chart)

**Analysis Phase Tasks:**
- Identify and document user roles (student, instructor, admin)
- Conduct requirements gathering
- Define functional requirements (assessment module, scoring, recommendations, dashboards)
- Define non-functional requirements (ISO/IEC 25010 quality attributes)
- Analyze existing literature on NLP, DSS, and OJT systems

**Design Phase Tasks:**
- Design system architecture (3-tier: frontend, backend, database)
- Design database schema (14-table ERD)
- Design user interface prototypes (16 pages across 3 roles)
- Create Context Flow Diagram (Level 0 DFD)
- Create Level 1 DFD
- Select NLP algorithms (TF-IDF, cosine similarity)
- Define JSON schema for data structures
- Prepare data dictionary

**Implementation Phase Tasks:**
- Set up development environment (Vite + React, Django, PostgreSQL)
- Build all frontend pages (16 pages: auth, student, instructor, admin)
- Implement backend API endpoints (auth, assessments, scoring, recommendations)
- Implement NLP scoring engine (text normalization, TF-IDF, cosine similarity)
- Integrate frontend with backend (Axios, JWT auth)
- Conduct unit and integration testing
- Deploy backend to Railway.app
- Deploy frontend to Vercel

**Maintenance Phase Tasks:**
- Conduct User Acceptance Testing (UAT)
- Identify and resolve post-deployment issues
- Implement system security plan
- Establish system maintenance plan

### Gantt Chart — 7-Week Development Schedule

| Week | Dates | Focus | Status |
|------|-------|-------|--------|
| Week 1 | Apr 6–12, 2026 | Frontend UI — Login, all Student pages | ✅ Done |
| Week 2 | Apr 13–19, 2026 | Frontend UI — all Instructor and Admin pages | ✅ Done |
| Week 3 | Apr 20–26, 2026 | Backend — Django setup, all 14 models, authentication | ✅ Done |
| Week 4 | Apr 27–May 3, 2026 | Backend — Assessment CRUD, auto-scoring engine | ✅ Done |
| Week 5 | May 4–10, 2026 | Backend — Cosine similarity, recommendations, wiring Results page | ✅ Done |
| Week 6 | May 11–17, 2026 | Connect — Wire remaining pages, integration testing, bug fixing | ✅ Done |
| Week 7 | May 18–24, 2026 | Deploy — Railway + Vercel deployment, seed data, demo preparation | ✅ Done |

---

## SECTION 4 — SYSTEM ANALYSIS

### System Architecture

SkillBridge follows a **3-tier client-server architecture** with three main layers:

**Presentation Layer (Frontend):**
- React 19 (built with Vite) with Tailwind CSS v4
- Hosted on Vercel (CDN-distributed, global)
- 16 pages across 3 user roles
- Live URL: `https://skill-bridge-six-psi.vercel.app`
- Communicates with backend via REST API using Axios with JWT Bearer tokens

**Application/Logic Layer (Backend):**
- Python + Django 6.0.4 + Django REST Framework 3.17.1
- Hosted on Railway.app
- Handles all business logic: authentication, assessment management, NLP scoring, recommendation generation
- Live URL: `https://skillbridge-production-1e3c.up.railway.app`
- API endpoints prefixed with `/api/`

**Data Layer (Database):**
- PostgreSQL hosted on Supabase (free tier)
- 14 tables organized into 4 logical groups
- Connected via Supabase Session Mode (IPv4-compatible) connection pooling

**External Services:**
- Google OAuth (`googleapis.com/oauth2/v3/userinfo`) — student authentication, restricted to `@dnsc.edu.ph` domain
- PSGC API (`psgc.gitlab.io/api`) — Philippine Standard Geographic Code for address dropdowns
- Nominatim (free, no API key) — geocoding for company GPS coordinates
- SheetJS (CDN) — client-side Excel parsing for bulk question upload

**Data Flow Summary:**
Students authenticate via Google OAuth → take assessments → answers are submitted to Django backend → `scoring.py` auto-grades answers using NLP → computes skill vectors → runs cosine similarity against company position vectors → stores ranked recommendations → student dashboard displays ranked placements with match scores and distance data.

### Functional Requirements

The system shall provide the following functionalities:

1. The system shall allow students to authenticate using their institutional Google account (`@dnsc.edu.ph`) through Google OAuth 2.0.
2. The system shall allow instructors and administrators to authenticate using email and password credentials.
3. The system shall enforce role-based access control (RBAC), restricting access to specific features based on user role (student, instructor, or admin).
4. The system shall allow instructors to create skill assessment questionnaires with multiple question types: Multiple Choice (MCQ), True/False, and Identification.
5. The system shall support bulk question upload via Excel files using a standardized template.
6. The system shall automatically suggest skill category tags for new questions using TF-IDF text analysis.
7. The system shall automatically grade submitted student assessments — MCQ and True/False via `is_correct` flags; Identification via NLP text normalization (case-insensitive exact match).
8. The system shall compute per-category skill score percentages for each student and store them as structured skill profiles.
9. The system shall generate ranked OJT placement recommendations by computing cosine similarity between student skill vectors and company position requirement vectors.
10. The system shall display ranked placement recommendations to students, showing match score percentage for each company position.
11. The system shall display a role-specific dashboard to each user: skill profile and recommendations for students, batch analytics and student scores for instructors, and system-wide statistics and company management for admins.
12. The system shall allow admins to manage company profiles and OJT position requirements (skill categories and required percentages).
13. The system shall allow instructors to create and manage student batches and enroll students by email.
14. The system shall auto-create student accounts when an instructor enrolls a student email that is not yet registered.
15. The system shall display company locations on an interactive map with distance calculations from the student's address.

### Non-Functional Requirements (ISO/IEC 25010)

1. **Performance Efficiency.** The system shall process and display assessment results and recommendations within acceptable response time with minimal latency. Auto-scoring and recommendation generation shall complete within the same HTTP request cycle.
2. **Reliability.** The system shall ensure continuous operation with minimal downtime through deployment on cloud platforms (Railway for backend, Vercel for frontend, Supabase for database) with automatic failover support.
3. **Usability.** The system shall provide a user-friendly, responsive web interface accessible to students, instructors, and admins without specialized training. All pages follow consistent design patterns with clear navigation.
4. **Security.** The system shall protect data through JWT-based authentication, role-based access control, HTTPS for all communications, API rate limiting (login: 10/min; user: 200/min), and domain-restricted Google OAuth (DNSC accounts only).
5. **Compatibility.** The system shall be accessible across different devices (desktops, tablets, and mobile devices) through a responsive web-based interface. It shall support modern web browsers without requiring plugin installation.
6. **Maintainability.** The system shall be organized in a modular codebase (single Django app, component-based React frontend) that supports easy updates, debugging, and future enhancements.
7. **Scalability (Portability/Adaptability).** The system shall support the addition of new skill categories, companies, positions, students, and assessments without degradation in performance or recommendation accuracy.
8. **Availability.** The system shall be accessible to authorized users at any time through stable cloud infrastructure. JWT refresh tokens (7-day validity) maintain user sessions without requiring frequent re-authentication.

---

## SECTION 5 — USE CASE DIAGRAM

### Primary Actors and Use Cases

**Student:**
- Register / Login via Google OAuth (DNSC account only)
- Complete profile setup (school ID, course, address, map pin)
- Take skill assessment (timer-based, one question at a time, auto-save)
- View skill profile and per-category scores
- View ranked OJT company/position recommendations with match scores
- View company locations on map with distance data

**Instructor (OJT Coordinator):**
- Login via email + password
- Create student batches and enroll students by email
- Create skill categories
- Create/upload skill assessments (manual entry or Excel bulk upload)
- View student progress per batch (submitted / pending)
- View student skill scores and top placement recommendations
- Toggle student retake permission

**Administrator:**
- Login via email + password (seeded account)
- Approve or manage instructor accounts
- Add and manage company profiles with GPS locations
- Add and manage OJT positions with skill requirements per category
- View system-wide statistics (user counts, submission counts)
- View all students' ranked recommendations

### Role Interaction Summary
- The **System** processes student answers, computes scores, and generates recommendations automatically upon assessment submission
- The **OJT Coordinator** receives ranked recommendations from the system to make an informed final placement decision
- The **Admin** configures the company and position data that the recommendation engine uses as its target

---

## SECTION 6 — CONTEXT FLOW DIAGRAM (Level 0 DFD)

### External Entities
| Entity | Description |
|--------|-------------|
| Student | DNSC IT students with `@dnsc.edu.ph` email; authenticate via Google, take assessments, view recommendations |
| Instructor / OJT Coordinator | Faculty who create batches, upload assessments, manage students, view analytics |
| Administrator | Manages companies, positions, users; approves instructors |
| Google OAuth API | External identity provider; validates student/instructor Google tokens; enforces `@dnsc.edu.ph` domain |
| External Geo APIs (PSGC / Nominatim) | PSGC: cascading address dropdowns; Nominatim: geocodes company addresses to GPS coordinates |

### Key Data Flows (Level 0)
**Student → System:** Google OAuth token, profile data (school ID, course, address, map pin), assessment answers (MCQ choices / typed text)
**System → Student:** JWT session tokens, skill profile scores, ranked company/position recommendations with match percentages, company distances

**Instructor → System:** Login credentials, batch names, student emails for enrollment, assessment questions (Excel/manual), skill category names, retake toggles
**System → Instructor:** JWT tokens, student progress data, per-category scores, top placement matches per student

**Admin → System:** Login credentials, company profiles (name, address, GPS), position titles and slots, position skill requirements (category → percentage), instructor approval decisions
**System → Admin:** JWT tokens, system-wide statistics, user lists, full recommendation reports

**System ↔ Google OAuth API:** Token validation request → verified user identity (email, name, photo), domain check
**System ↔ External Geo APIs:** Province/city/barangay queries → PSGC address hierarchies; address text → GPS coordinates (Nominatim)

---

## SECTION 7 — LEVEL 1 DATA FLOW DIAGRAM

### Sub-Processes

| Process | Description |
|---------|-------------|
| **1.0 User Authentication & Registration** | Authenticates via Google OAuth (students/instructors) or email+password (admin). Issues JWT tokens. Enforces `@dnsc.edu.ph` domain. Handles instructor approval workflow. Checks student enrollment status before login. |
| **2.0 Assessment Management** | Instructors create assessments with questions (MCQ/True-False/Identification). Supports Excel bulk upload (SheetJS, parsed client-side). TF-IDF suggests skill category tag as instructor types question text. |
| **3.0 Batch & Enrollment Management** | Instructors create named batches (e.g., "AY 2025-2026") and enroll students by email. Auto-creates student accounts if email not yet registered. |
| **4.0 Assessment Execution** | Student receives active assessment. `started_at` is recorded on first load (anti-cheat). Answers auto-saved to localStorage. On final submit, `submitted_at` is recorded and all answers are sent to backend. Triggers scoring engine. |
| **5.0 Scoring & Matching Engine** | Grades answers (MCQ/TF via `is_correct`, Identification via NLP text normalization). Computes per-category skill score percentages. Builds student skill vector. Builds position requirement vectors. Runs cosine similarity. Stores ranked recommendations. |
| **6.0 Dashboard & Visualization** | Renders role-specific dashboards: students see skill profile and ranked recommendations with company map; instructors see batch analytics; admins see system stats and company management. |

### Data Stores

| Data Store | Tables | Description |
|------------|--------|-------------|
| D1: Users | `api_user` | User credentials, roles, school ID, course, address, photo URL, approval status |
| D2: Batches & Enrollments | `batches`, `batch_enrollments` | Student groupings and enrollment records |
| D3: Skill Categories | `skill_categories` | Dynamically created competency taxonomy (e.g., "Web Development", "Database Management") |
| D4: Assessments | `assessments`, `questions`, `answer_choices` | Assessment metadata, questions, and answer choices with correctness flags |
| D5: Responses & Scores | `student_responses`, `response_answers`, `skill_scores` | Assessment sessions, individual answers, and computed per-category skill percentages |
| D6: Companies & Positions | `companies`, `positions`, `position_requirements` | Company profiles, internship positions, and per-position skill category requirements |
| D7: Recommendations | `recommendations` | Cosine similarity match scores (0–100%) between each student and each position |

---

## SECTION 8 — SYSTEM DESIGN

### Entity Relationship Diagram (ERD)

**14 Tables organized into 4 logical groups:**

#### Group 1: User Management
| Table | Key Fields | Description |
|-------|-----------|-------------|
| `api_user` | id (PK), email (unique), name, role (student/instructor/admin), school_id, course, phone, address (JSONField), photo_url, is_approved, is_active, created_at | All system users — students, instructors, and admins |
| `batches` | id (PK), name, instructor_id (FK→user), status (active/archived), archived_at, created_at | Student groupings created by instructors |
| `batch_enrollments` | id (PK), batch_id (FK), student_id (FK), enrolled_at; UNIQUE(batch, student) | Links students to batches |

#### Group 2: Assessment Engine
| Table | Key Fields | Description |
|-------|-----------|-------------|
| `skill_categories` | id (PK), name, description, created_by (FK→user, nullable), created_at | Dynamically created competency areas |
| `assessments` | id (PK), title, created_by (FK→user), batch_id (FK, nullable), duration_minutes, is_active, created_at | Assessment metadata |
| `questions` | id (PK), assessment_id (FK), skill_category_id (FK, nullable), question_text, question_type (mcq/truefalse/identification), question_order | Individual questions |
| `answer_choices` | id (PK), question_id (FK), choice_text, is_correct (bool) | Answer options and correct answer flags |

#### Group 3: Response & Scoring
| Table | Key Fields | Description |
|-------|-----------|-------------|
| `student_responses` | id (PK), student_id (FK), assessment_id (FK), started_at (nullable), submitted_at (nullable), retake_allowed; UNIQUE(student, assessment) | One record per student per assessment |
| `response_answers` | id (PK), response_id (FK), question_id (FK), selected_choice_id (FK, nullable), text_answer | Individual answer selections |
| `skill_scores` | id (PK), student_id (FK), assessment_id (FK), skill_category_id (FK), raw_score, max_score, percentage; UNIQUE(student, assessment, skill_category) | Computed skill scores per category |

#### Group 4: Placement Matching
| Table | Key Fields | Description |
|-------|-----------|-------------|
| `companies` | id (PK), name, address (JSONField: province/city/barangay), location_lat, location_lng, added_by (FK→user, nullable), created_at | Company profiles with GPS coordinates |
| `positions` | id (PK), company_id (FK), title, slots_available | Internship positions offered by companies |
| `position_requirements` | id (PK), position_id (FK), skill_category_id (FK), required_percentage; UNIQUE(position, skill_category) | Skill requirements per position |
| `recommendations` | id (PK), student_id (FK), position_id (FK), match_score (0.0–100.0), generated_at; UNIQUE(student, position) | Cosine similarity match scores |

### Key Relationships
- One User (instructor) → Many Batches
- One Batch → Many BatchEnrollments → Many Students
- One Assessment → Many Questions → Many AnswerChoices
- One StudentResponse → Many ResponseAnswers
- One Assessment submission → Many SkillScore records (one per skill category)
- One Company → Many Positions → Many PositionRequirements
- One Student → Many Recommendations (one per position, sorted by match_score descending)

### JSON Field Structures

**User.address (JSONField):**
```json
{
  "stayingAt": "home | boarding",
  "travelWilling": "yes | no",
  "home": { "province": "Davao del Norte", "city": "Panabo City", "barangay": "San Francisco" },
  "boarding": { "province": "...", "city": "...", "barangay": "..." },
  "pinLat": 7.3087,
  "pinLng": 125.6841
}
```

**Company.address (JSONField):**
```json
{
  "province": "Davao del Norte",
  "city": "Tagum City",
  "barangay": "Poblacion"
}
```

### Data Dictionary (Summary)

| Table | Field | Type | Constraint | Description |
|-------|-------|------|------------|-------------|
| api_user | id | BIGINT | PK | Auto-generated primary key |
| api_user | email | VARCHAR | UNIQUE, NOT NULL | User email; `USERNAME_FIELD` for auth |
| api_user | role | VARCHAR(20) | NOT NULL | 'student', 'instructor', or 'admin' |
| api_user | school_id | VARCHAR(20) | | Institutional ID in YYYY-NNNNN format |
| api_user | address | JSONB | NULLABLE | Home/boarding/pin location data |
| api_user | is_approved | BOOLEAN | DEFAULT FALSE | Required for instructor login |
| assessments | duration_minutes | INTEGER | DEFAULT 60 | Timer duration for assessment |
| assessments | is_active | BOOLEAN | DEFAULT TRUE | Only active assessments served to students |
| questions | question_type | VARCHAR(20) | | 'mcq', 'truefalse', or 'identification' |
| answer_choices | is_correct | BOOLEAN | DEFAULT FALSE | Marks the correct answer for auto-grading |
| student_responses | started_at | TIMESTAMPTZ | NULLABLE | Set on first question load (anti-cheat timer) |
| student_responses | submitted_at | TIMESTAMPTZ | NULLABLE | NULL = assessment in progress |
| skill_scores | percentage | FLOAT | | raw_score / max_score × 100 |
| companies | location_lat | FLOAT | NULLABLE | From Nominatim geocoding |
| companies | location_lng | FLOAT | NULLABLE | From Nominatim geocoding |
| position_requirements | required_percentage | FLOAT | | Minimum skill % needed for this position |
| recommendations | match_score | FLOAT | | Cosine similarity result × 100 (0–100) |

---

## SECTION 9 — TECHNOLOGIES, CONCEPTS, AND THEORIES

### Data Collection
Student skill data is collected through a **digital assessment platform** built into SkillBridge. Instructors create skill-based questionnaires (via manual entry or Excel bulk upload) containing MCQ, True/False, and Identification questions — each tagged to a skill competency category (e.g., "Web Development", "Database Management", "Networking"). Students take these assessments through the web-based interface. The system records every selected answer and typed response in the database upon submission, providing the raw input data for the scoring engine.

### Data Pre-Processing
Before analysis, submitted answers undergo pre-processing through **NLP text normalization** (for identification-type questions):
```python
raw_answer = ans.get('text_answer', '').strip().lower()
correct = AnswerChoice.objects.get(question=question, is_correct=True)
is_correct = raw_answer == correct.choice_text.strip().lower()
```
This ensures that "CPU", "cpu", and "  Cpu  " are recognized as the same answer. MCQ and True/False questions are graded deterministically via the `is_correct` flag stored on each `AnswerChoice` record. This pre-processing step improves grading accuracy and eliminates false negatives caused by formatting differences.

### Feature Extraction
After scoring, the system extracts **per-category skill score percentages** from the raw scores:
- `raw_score` = number of correct answers in a category
- `max_score` = total questions in that category
- `percentage` = raw_score / max_score × 100

These percentages are normalized to `[0, 1]` and arranged into a **skill vector** — one dimension per skill category. For example: `[0.82, 0.55, 0.30, 0.70]` (Web Dev: 82%, Database: 55%, Networking: 30%, Programming: 70%). This numerical vector is the student's **competency profile**, serving as the feature representation for the recommendation algorithm.

### Classification / Matching Algorithm: Cosine Similarity

The system utilizes **cosine similarity** (via scikit-learn) to match student skill vectors to company position requirement vectors.

**Why Cosine Similarity was chosen:**

| Algorithm | Reason Not Used |
|-----------|----------------|
| Euclidean Distance | Sensitive to raw magnitude — a student scoring 90% vs 45% appears "far" even if the relative skill pattern matches well |
| Pearson Correlation | Intended for mean-centered distributions; less direct for skill percentage vectors |
| Collaborative Filtering | Requires historical user-item rating data (past placements) — not yet available at DNSC |
| Supervised ML (classifier) | Requires labeled placement outcome data — not available; overkill for this scope and dataset size |
| **Cosine Similarity ✅** | Simple, mathematically transparent, scale-invariant, no training data needed, standard in NLP and IR |

**Algorithm Steps:**
1. Build student skill vector: `[0.82, 0.55, 0.30, 0.70]`
2. Build position requirement vector (same category order): `[0.80, 0.60, 0.20, 0.70]`
3. Compute: `cosine_similarity(student_vec, position_vec)` → returns 0.965
4. Store: `match_score = 0.965 × 100 = 96.5%`
5. Sort all positions by match_score descending → ranked recommendations

Geometric interpretation: cosine similarity measures the **angle** between two vectors. An angle near 0° means the student's skill pattern closely aligns with the position's requirements (score → 100%). An angle near 90° means misaligned skills (score → 0%).

### TF-IDF for Skill Category Suggestion

**TF-IDF (Term Frequency–Inverse Document Frequency)** is applied during assessment creation. When an instructor types a new question (e.g., "What is the purpose of a primary key in SQL?"), the system uses TF-IDF to automatically suggest a skill category:

```python
corpus = category_names + [question_text]
vectorizer = TfidfVectorizer(stop_words='english')
tfidf_matrix = vectorizer.fit_transform(corpus)
similarities = cosine_similarity(tfidf_matrix[-1], tfidf_matrix[:-1])[0]
best_idx = int(np.argmax(similarities))
return category_names[best_idx] if similarities[best_idx] > 0.05 else None
```

This reduces manual tagging effort and ensures consistent question categorization across assessments.

### Technologies Used in the System

#### React 19 (Vite) — Frontend Framework
The user interface is built using **React 19**, a modern JavaScript library for building component-based user interfaces, bundled with **Vite** for fast development and optimized builds. The frontend is styled with **Tailwind CSS v4** and deployed on **Vercel**. React enables the development of 16 distinct pages with role-based access, interactive dashboards, and real-time UI updates without page reloads.

#### Python + Django 6.0 + Django REST Framework 3.17 — Backend Framework
The server-side application is built with **Python** and **Django 6.0.4**, a high-level web framework that follows the Model-View-Template (MVT) pattern. **Django REST Framework (DRF) 3.17.1** provides the API layer, enabling structured RESTful endpoints consumed by the React frontend. Python was chosen specifically because it integrates natively with scikit-learn for the NLP algorithms.

#### PostgreSQL via Supabase — Database Management System
**PostgreSQL** is the relational database used to store all system data across 14 tables. It is hosted on **Supabase**, which provides a free-tier managed PostgreSQL instance with a visual table editor, real-time subscriptions, and connection pooling. PostgreSQL was selected for its robust support for JSON fields (used for address data), complex queries, and referential integrity through foreign key constraints.

#### scikit-learn + NumPy — NLP and Machine Learning Library
**scikit-learn** is the Python machine learning library used for the core NLP algorithms: `TfidfVectorizer` (for category suggestion) and `cosine_similarity` (for placement matching). **NumPy** is used to construct and manipulate numerical skill vectors. These libraries are production-grade, peer-reviewed, and widely used in information retrieval and recommendation systems.

#### JWT Authentication — `djangorestframework-simplejwt`
**JSON Web Tokens (JWT)** are used for stateless authentication. Upon login, the backend issues an access token (8-hour validity) and a refresh token (7-day validity). The frontend stores these in `localStorage` and attaches the access token as a `Bearer` header on every API request. This approach is secure, stateless, and compatible with the cross-origin deployment (Railway backend, Vercel frontend).

#### Google OAuth 2.0 — Student Authentication
Students authenticate using their institutional **Google OAuth 2.0** accounts. The frontend uses `@react-oauth/google` to obtain a Google access token, which is sent to the backend for verification against `googleapis.com/oauth2/v3/userinfo`. Access is restricted to `@dnsc.edu.ph` email addresses, ensuring only DNSC students can register.

#### Leaflet + Nominatim — Map and Geocoding
**Leaflet** (loaded via CDN) provides the interactive company location map on the student dashboard and admin companies page. **Nominatim** (free, no API key) geocodes company addresses (province/city) to GPS coordinates. The frontend calculates distances between students and companies using the **Haversine formula** for great-circle distance.

#### PSGC API — Philippine Address Data
The **Philippine Standard Geographic Code (PSGC) API** (`psgc.gitlab.io/api`) provides official cascading address dropdowns (Province → City/Municipality → Barangay) used during student profile setup and company registration. Address data is cached in `sessionStorage` to avoid repeated API calls.

#### SheetJS (XLSX) — Excel Parsing
**SheetJS** (loaded from CDN) enables client-side parsing of Excel files during assessment creation. Instructors can upload questions in bulk using a standardized template with columns: `question | type | choice_a | choice_b | choice_c | choice_d | correct | category`. Questions are previewed before import, with row-level error detection.

---

## SECTION 10 — SYSTEM TESTING AND IMPLEMENTATION

### Testing Approach

The testing phase evaluates SkillBridge's correctness, performance, and usability across all system components. Testing is conducted to validate:
- **Authentication:** Google OAuth flow, JWT issuance, role-based access control, domain restriction
- **Assessment Management:** Question creation (manual + Excel), TF-IDF category suggestion, assessment activation
- **Assessment Execution:** Timer functionality, answer auto-save, anti-cheat `started_at` recording, final submission
- **Scoring Engine:** Auto-grading accuracy (MCQ/TF via `is_correct`, Identification via text normalization), per-category score computation
- **Recommendation Engine:** Cosine similarity computation correctness, ranked output ordering, match score accuracy
- **Dashboards:** Correct data rendering per user role, map rendering, distance calculations

### Key Metrics Evaluated
- **Accuracy:** Percentage of correctly graded answers across MCQ, True/False, and Identification types
- **Precision of Recommendations:** Match scores correctly reflect skill alignment with position requirements
- **Response Time:** API response time for assessment submission, scoring, and recommendation generation
- **Usability:** System Usability Scale (SUS) score from User Acceptance Testing (UAT) with student, instructor, and admin respondents

### Test Cases Summary

| Component | Test Case | Expected Result | Status |
|-----------|-----------|-----------------|--------|
| Google OAuth Login | Student logs in with `@dnsc.edu.ph` account | JWT tokens issued, student redirected to dashboard | ✅ Pass |
| Google OAuth Login | Non-DNSC email attempted | `403 { error: 'not_dnsc' }` returned | ✅ Pass |
| Instructor Login | Email + password with pending approval | `403 { error: 'pending' }` returned | ✅ Pass |
| Assessment Submit | MCQ answer grading | Correct choices marked via `is_correct` flag | ✅ Pass |
| Assessment Submit | Identification answer — case mismatch | "CPU" matches "cpu" after normalization | ✅ Pass |
| Skill Scoring | Per-category score computation | percentage = raw/max × 100 | ✅ Pass |
| Recommendation Engine | Cosine similarity output | Higher skill alignment → higher match score | ✅ Pass |
| Excel Upload | Valid Excel file | Questions parsed and previewed before import | ✅ Pass |
| Map Rendering | Leaflet company map | Companies shown with correct GPS pins | ✅ Pass |
| Role Guard | Student accessing `/admin/dashboard` | Redirected to login | ✅ Pass |

### Implementation / Deployment

**Backend Deployment (Railway.app):**
- Git push to `main` branch triggers automatic Railway deployment
- `Procfile`: `python manage.py migrate --noinput && gunicorn core.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
- Environment variables configured via Railway dashboard (DB credentials, SECRET_KEY, ALLOWED_HOSTS)
- Live URL: `https://skillbridge-production-1e3c.up.railway.app`

**Frontend Deployment (Vercel):**
- Git push to `main` triggers automatic Vercel deployment
- `vercel.json` handles SPA routing (all paths → `index.html`)
- Environment variables: `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`
- Live URL: `https://skill-bridge-six-psi.vercel.app`

**Database (Supabase PostgreSQL):**
- 14 tables migrated via Django's migration system
- Connection via Session Mode (IPv4-compatible pooler) — required for Railway compatibility
- Admin seeded via Django shell

**User Training:**
- Students: login via Google button on main page → guided 4-step profile setup wizard
- Instructors: receive credentials from admin → can immediately create batches and assessments
- Admin: seeded account — manages companies, positions, and user approvals

---

## SECTION 11 — SYSTEM MAINTENANCE

### System Security Plan (ISO/IEC 27001)

| Security Domain | Control Area | Implementation in SkillBridge |
|----------------|-------------|-------------------------------|
| A.5 Information Security Policies | Security Policy | System enforces formal policies: JWT auth, RBAC, domain restriction, HTTPS |
| A.6 Organization of Information Security | Roles & Responsibilities | Three roles (Admin, Instructor, Student) with distinct access privileges enforced via JWT claims and `PrivateRoute` guards |
| A.9 Access Control | User Access Management | Role-Based Access Control (RBAC) — all API endpoints validate JWT role; all frontend routes guarded by `PrivateRoute.jsx` |
| A.9 Access Control | Authentication Mechanism | JWT access tokens (8-hour), refresh tokens (7-day); Google OAuth for students; email+password for admin/instructor |
| A.10 Cryptography | Data Encryption | All traffic over HTTPS (Vercel + Railway enforce TLS); JWT tokens signed with SECRET_KEY |
| A.12 Operations Security | Data Processing Integrity | Input validation on all API endpoints; Django form validation; unique constraints on all critical tables |
| A.12 Operations Security | Logging & Monitoring | Railway and Vercel provide deployment logs; Django request/response logging available |
| A.13 Communications Security | Network Security | CORS restricted to authorized origins only (`http://localhost:5173`, `https://skill-bridge-six-psi.vercel.app`) |
| A.9 Access Control | Rate Limiting | Login endpoint throttled to 10 requests/minute; user endpoints to 200 requests/minute (DRF throttling) |
| A.17 Business Continuity | Data Backup | Supabase provides automated daily PostgreSQL backups |
| A.16 Incident Management | Incident Response | Known issues documented (IPv6/IPv4 fix, JWT user model config) with resolution procedures |
| A.14 System Acquisition | Secure Development | Input validation, secure JWT configuration, environment variables for all secrets (never hardcoded) |

### System Maintenance Plan (ISO/IEC 25010)

| ISO 25010 Attribute | Maintenance Activity | Description | Frequency |
|--------------------|---------------------|-------------|-----------|
| Reliability | System Monitoring | Monitor Railway deployment status, API response rates, and database connection health | Daily |
| Performance Efficiency | API Optimization | Review and optimize slow endpoints; improve database query efficiency (indexing) | As needed |
| Usability | Interface Improvement | Update dashboard design and UX based on user feedback from UAT | Periodically |
| Security | Security Updates | Apply Django/DRF security patches, rotate JWT SECRET_KEY, review CORS settings | Regularly |
| Maintainability | Code Refactoring & Debugging | Fix bugs, refactor views.py and scoring.py for readability, improve test coverage | As needed |
| Compatibility | System Updates | Ensure compatibility with updated browsers, React versions, and Tailwind CSS updates | Periodically |
| Reliability | Database Backup Verification | Verify Supabase automated backups and test restoration procedures | Monthly |
| Performance Efficiency | Database Optimization | Clean up orphaned records, add indexes on frequently queried foreign keys | Weekly |
| Scalability | Capacity Planning | Monitor Railway resource usage; plan upgrade path if student population grows significantly | Quarterly |

### Known Issues Resolved During Development

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| `OperationalError` on Railway — backend couldn't connect to Supabase | Railway does not support IPv6; `db.*.supabase.co` resolves to IPv6 | Use Supabase Session Mode (port 5432) IPv4-compatible pooler URL for `DB_HOST` |
| `401 user_not_found` on JWT authentication | Django JWT was looking up users in the wrong model | `AUTH_USER_MODEL = 'api.User'` must be set in `settings.py` before first migration |
| Leaflet map z-index bleeds above modals and NavBar | CSS stacking context conflict | Apply `isolation: isolate` to map wrapper element |
| `corsheaders.E014` error | Trailing slash in CORS allowed origins | Remove trailing slash from all URLs in `CORS_ALLOWED_ORIGINS` |

---

## QUICK REFERENCE TABLE FOR AI WRITING

| Chapter 2 Section | SkillBridge Content |
|-------------------|---------------------|
| System name | SkillBridge — Web-Based OJT Placement Decision Support System |
| Institution | Davao del Norte State College (DNSC), Panabo City, Davao del Norte |
| Methodology | Hybrid (Waterfall + Agile), PADIM Framework |
| Framework used (project mgt) | PADIM (Planning, Analysis, Design, Implementation, Maintenance) |
| Team size | 3 authors + 1 adviser |
| Development duration | 7 weeks (April–May 2026) |
| Architecture type | 3-tier client-server (Presentation + Application + Data layers) |
| Frontend | React 19 + Vite + Tailwind CSS v4 — hosted on Vercel |
| Backend | Python + Django 6.0.4 + DRF 3.17.1 — hosted on Railway |
| Database | PostgreSQL via Supabase — 14 tables |
| NLP Techniques | Text Normalization, TF-IDF (scikit-learn), Cosine Similarity (scikit-learn) |
| Recommendation Algorithm | Cosine Similarity (vector space model) |
| Authentication | JWT (simplejwt) + Google OAuth 2.0 (DNSC domain restricted) |
| Map library | Leaflet (CDN) + Nominatim geocoding + Haversine distance |
| Address data | PSGC API (Philippine Standard Geographic Code) |
| Excel upload | SheetJS (CDN) — client-side parsing |
| Number of DB tables | 14 |
| Number of pages/screens | 16 |
| Number of API endpoints | ~20+ |
| User roles | Student, Instructor (OJT Coordinator), Admin |
| Quality standard (non-functional) | ISO/IEC 25010 |
| Security standard | ISO/IEC 27001 |
| DSS classification | Yes — recommends but does not automate placement; OJT coordinator retains final decision |
| Live frontend URL | https://skill-bridge-six-psi.vercel.app |
| Live backend URL | https://skillbridge-production-1e3c.up.railway.app |
