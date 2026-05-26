# Data Flow Diagram (DFD) — SkillBridge
**Web-Based OJT Placement Decision Support System**

---

## 1. System Overview
SkillBridge is a specialized web-based decision support system designed specifically for the Davao del Norte State College (DNSC) OJT placement program. Its primary goal is to digitize and improve the manual assessment process used to place IT students into appropriate internship roles. The system allows OJT coordinators to upload skill-based questionnaires, which are automatically scored via the platform when completed by students.

Using Natural Language Processing (NLP) text normalization and algorithms like TF-IDF, the system processes responses dynamically. Finally, the system builds student skill vectors and runs a cosine similarity matching algorithm against company position demands to provide accurate and highly ranked placement recommendations without taking away the final assignment autonomy of the instructors.

---

## 2. Identified Components

### 2.1 External Entities
| Entity | Description |
|--------|-------------|
| **Student** | DNSC students (with `@dnsc.edu.ph` email) seeking OJT placements. They register via Google OAuth, complete profile setup (address, school ID, course), take skill assessments, and view ranked placement recommendations. |
| **Instructor (OJT Coordinator)** | Faculty members who create student batches, enroll students, upload/create assessments (via Excel or manual entry), manage skill categories, toggle retakes, and review student performance and placement recommendations. |
| **Administrator** | System administrator who approves instructor registrations, manages company profiles and position requirements, views system-wide statistics, and can re-run recommendation algorithms. |
| **Google OAuth Service** | External authentication provider (`googleapis.com/oauth2/v3/userinfo`) that validates student and instructor identities, restricting access to verified `@dnsc.edu.ph` Google accounts only. |
| **External Geographical APIs (PSGC / Nominatim)** | Philippine Standard Geographic Code (PSGC) API for cascading Province → City → Barangay address dropdowns; Nominatim for geocoding addresses to latitude/longitude coordinates for distance-based company proximity calculations. |
| **Brevo Email API** | Transactional email service used to send approval notification emails to instructors when their accounts are approved by the administrator. |

### 2.2 Processes
| Process | Description |
|---------|-------------|
| **1.0 User Authentication & Registration** | Authenticates users via Google OAuth (students/instructors) or email+password credentials (admin/instructor). Manages JWT session tokens (access + refresh), role selection, account approval workflows, and enrollment verification. |
| **2.0 Assessment Management** | Enables instructors to create, upload (Excel/manual), and manage skill assessments. Handles question creation (MCQ, True/False, Identification), answer choice storage, TF-IDF-based skill category suggestion, and assessment activation/deactivation. |
| **3.0 Batch & Enrollment Management** | Allows instructors to create student batches, enroll students (auto-creating accounts if needed), manage student rosters (remove/retake), and archive completed batches. |
| **4.0 Assessment Execution** | Manages the student assessment-taking flow: session initialization with timer tracking (`started_at`), answer collection with autosave, and final submission with timestamp recording (`submitted_at`). |
| **5.0 Scoring & Matching Engine** | The core NLP/algorithmic engine that: (a) auto-grades submitted answers using text normalization for identification questions, (b) computes per-category skill score percentages, (c) builds numerical skill vectors, and (d) executes cosine similarity matching against position requirement vectors to generate ranked placement recommendations. |
| **6.0 Dashboard & Visualization** | Synthesizes system data into role-specific dashboards: student skill profiles with radar charts and ranked recommendations, instructor batch analytics with student progress tracking, and admin system-wide statistics with company management views. Includes real-time SSE updates. |

### 2.3 Data Stores
| Data Store | Tables | Description |
|------------|--------|-------------|
| **D1: Users** | `api_user` | Stores user credentials, roles (`student`/`instructor`/`admin`), school ID, course, phone, address (JSONField with home/boarding/pin coordinates), photo URL, approval status, and timestamps. |
| **D2: Batches & Enrollments** | `batches`, `batch_enrollments` | Represents student groupings created by instructors. Tracks batch status (active/archived), instructor ownership, and student-to-batch enrollment records with timestamps. |
| **D3: Skill Categories** | `skill_categories` | Dynamically created taxonomy of competency areas (e.g., "Web Development", "Database Management"). Created by instructors/admins, used to tag assessment questions and define position requirements. |
| **D4: Assessments** | `assessments`, `questions`, `answer_choices` | Stores assessment metadata (title, duration, active status), individual questions (text, type, category mapping, ordering), and answer choices with correctness flags (`is_correct`). |
| **D5: Responses & Scores** | `student_responses`, `response_answers`, `skill_scores` | Archives assessment sessions (start/submit timestamps, retake flags), individual answer selections (choice ID or text answer), and computed per-category skill score percentages. |
| **D6: Companies & Positions** | `companies`, `positions`, `position_requirements` | Stores company profiles (name, address JSONField, GPS coordinates), internship positions (title, available slots), and per-position skill category requirement percentages. |
| **D7: Recommendations** | `recommendations` | Preserves cosine similarity match scores (0–100%) between each student and each position, with generation timestamps. |

---

## 3. Data Flow Narrative

The data flows across SkillBridge in six logical stages:

1. **Authentication Flow:** Students and instructors authenticate via Google OAuth — the system validates tokens against the Google API, checks for `@dnsc.edu.ph` domain restriction, and issues JWT session tokens. Administrators authenticate with email/password credentials. New users select a role (student/instructor) during first-time registration. Students must be pre-enrolled by an instructor before login is permitted.

2. **Batch & Enrollment Flow:** Instructors create named batches (e.g., "AY 2025-2026") and enroll students by email. If a student account does not exist, the system auto-creates one with an unusable password (student will log in via Google). Enrollment records link students to batches.

3. **Assessment Creation Flow:** Instructors create assessments with questions via manual entry or Excel upload. During question creation, the TF-IDF function analyzes question text against existing skill category names to suggest appropriate category tags. Upon confirmation, questions, answer choices, and category links are saved.

4. **Assessment Execution Flow:** Students receive their batch's active assessment. Starting an assessment records `started_at` for timer anti-cheat. Answers are autosaved client-side and submitted to the server, which records `submitted_at` and all selected choices/text answers.

5. **Scoring & Recommendation Flow:** Upon submission, the Scoring Engine: (a) grades each answer — MCQ/TrueFalse via `is_correct` flag lookup, Identification via NLP text normalization (`.strip().lower()`) for case-insensitive matching; (b) computes per-category skill score percentages; (c) builds a numerical skill vector `[0.82, 0.55, 0.30, ...]`; (d) constructs position requirement vectors in the same dimensional space; (e) computes cosine similarity scores via scikit-learn; and (f) stores ranked recommendations in the database.

6. **Visualization & Analytics Flow:** Role-specific dashboards render the processed data: students see their skill profile radar charts and ranked company recommendations with distance calculations; instructors view batch-level student progress, scores, and top placement matches; administrators access system-wide statistics, company/position management, and can re-run recommendation algorithms. Real-time SSE streams notify admin and instructor panels of data changes.

---

## 4. Level 0 DFD — Context Diagram

The Context Flow Diagram depicts the SkillBridge system as a single process, showing how it interacts with all external entities and the data each interaction requires and produces.

```mermaid
flowchart TB
    subgraph External Entities
        STU["👨‍🎓 Student"]
        INS["👩‍🏫 Instructor / OJT Coordinator"]
        ADM["🔑 Administrator"]
        GOA["☁️ Google OAuth API"]
        GEO["🌐 External Geo APIs\n(PSGC, Nominatim)"]
        BRV["📧 Brevo Email API"]
    end

    SYS(("0\nSkillBridge\nOJT Placement\nDecision Support\nSystem"))

    STU -->|"Google OAuth Token\nRole Selection\nProfile Data (Address, School ID, Course)\nAssessment Answers (MCQ/TF/Identification)"| SYS
    SYS -->|"JWT Session Tokens\nSkill Profile (Radar Chart Data)\nRanked Placement Recommendations\nCompany Distance Data"| STU

    INS -->|"Google OAuth Token / Login Credentials\nBatch Definitions & Student Emails\nAssessment Questions (Excel/Manual)\nSkill Category Names\nRetake Toggles"| SYS
    SYS -->|"JWT Session Tokens\nStudent Metric Progression\nBatch Student Lists & Scores\nPlacement Recommendation Output\nReal-time SSE Updates"| INS

    ADM -->|"Login Credentials (Email/Password)\nCompany Profiles & GPS Coordinates\nPosition Titles & Slot Counts\nPosition Skill Requirements (%)\nInstructor Approval Decisions"| SYS
    SYS -->|"JWT Session Tokens\nSystem-wide Statistics\nUser Management Data\nRecommendation Reports\nReal-time SSE Updates"| ADM

    SYS -->|"OAuth Token Validation Request"| GOA
    GOA -->|"Verified User Identity\n(Email, Name, Photo URL)\nDomain Validation (@dnsc.edu.ph)"| SYS

    SYS -->|"Province/City/Barangay Queries\nAddress Geocoding Requests"| GEO
    GEO -->|"PSGC Address Hierarchies\nGPS Coordinates (lat/lng)\nFormatted Addresses"| SYS

    SYS -->|"Approval Email Request\n(Instructor Name, Details)"| BRV
    BRV -->|"Email Delivery Confirmation"| SYS

    style SYS fill:#16a34a,stroke:#15803d,color:#ffffff,stroke-width:3px
    style STU fill:#3b82f6,stroke:#2563eb,color:#ffffff
    style INS fill:#8b5cf6,stroke:#7c3aed,color:#ffffff
    style ADM fill:#ef4444,stroke:#dc2626,color:#ffffff
    style GOA fill:#f59e0b,stroke:#d97706,color:#ffffff
    style GEO fill:#06b6d4,stroke:#0891b2,color:#ffffff
    style BRV fill:#ec4899,stroke:#db2777,color:#ffffff
```

### Level 0 DFD Data Flow Summary Table

| # | Source → Destination | Data Flow | Direction |
|---|---------------------|-----------|-----------|
| 1 | Student → System | Google OAuth Token, Role Selection, Profile Data (address, school ID, course, phone, map pin), Assessment Answers (selected choices, typed text) | Inbound |
| 2 | System → Student | JWT Tokens (access + refresh), Skill Score Profile, Ranked Company/Position Recommendations with Match Scores, Nearby Company Distances | Outbound |
| 3 | Instructor → System | Google OAuth Token / Email+Password, Batch Names, Student Emails for Enrollment, Assessment Questions (Excel/Manual), Skill Category Names, Retake Toggles | Inbound |
| 4 | System → Instructor | JWT Tokens, Student Progress Data (submitted/pending), Per-category Skill Scores, Top Placement Recommendations per Student, SSE Real-time Updates | Outbound |
| 5 | Administrator → System | Email + Password Credentials, Company Profiles (name, address, GPS coords), Positions (title, slots), Position Requirements (skill category → percentage), Instructor Approval/Rejection | Inbound |
| 6 | System → Administrator | JWT Tokens, System Statistics (user counts, submission counts), User Lists, Full Recommendation Reports, SSE Real-time Updates | Outbound |
| 7 | System ↔ Google OAuth API | Token Validation Request → Verified Identity (email, name, photo), `@dnsc.edu.ph` Domain Check | Bidirectional |
| 8 | System ↔ External Geo APIs | Province/City/Barangay Queries → PSGC Hierarchies; Address Text → GPS Coordinates (Nominatim) | Bidirectional |
| 9 | System → Brevo Email API | Instructor Approval Notification Email → Delivery Confirmation | Outbound |

---

## 5. Level 1 DFD — Decomposed Sub-Processes

The Level 1 DFD decomposes the single Level 0 process into six sub-processes, showing internal data flows between processes and data stores while retaining all external entities and data flows from the Context Diagram.

```mermaid
flowchart TB
    %% ── External Entities ──
    STU["👨‍🎓 Student"]
    INS["👩‍🏫 Instructor / OJT Coordinator"]
    ADM["🔑 Administrator"]
    GOA["☁️ Google OAuth API"]
    GEO["🌐 External Geo APIs\n(PSGC, Nominatim)"]
    BRV["📧 Brevo Email API"]

    %% ── Processes ──
    P1(("1.0\nUser Auth &\nRegistration"))
    P2(("2.0\nAssessment\nManagement"))
    P3(("3.0\nBatch &\nEnrollment\nManagement"))
    P4(("4.0\nAssessment\nExecution"))
    P5(("5.0\nScoring &\nMatching\nEngine"))
    P6(("6.0\nDashboard &\nVisualization"))

    %% ── Data Stores ──
    D1[("D1: Users\n(api_user)")]
    D2[("D2: Batches &\nEnrollments")]
    D3[("D3: Skill\nCategories")]
    D4[("D4: Assessments\n(Questions, Choices)")]
    D5[("D5: Responses\n& Scores")]
    D6[("D6: Companies\n& Positions")]
    D7[("D7: Recommendations")]

    %% ══════════════════════════════════════════════════
    %% Process 1.0 — User Authentication & Registration
    %% ══════════════════════════════════════════════════

    STU -->|"Google OAuth Token\nRole Selection"| P1
    INS -->|"Google OAuth Token /\nEmail + Password"| P1
    ADM -->|"Email + Password"| P1
    P1 -->|"Token Validation\nRequest"| GOA
    GOA -->|"Verified Identity\n(Email, Name, Photo)"| P1
    P1 <-->|"Read/Write User Records\nUpdate Photo & Name\nCheck Approval Status"| D1
    P1 -->|"Check Enrollment\nStatus"| D2
    P1 -->|"JWT Access & Refresh\nTokens + User Profile"| STU
    P1 -->|"JWT Tokens +\nUser Profile"| INS
    P1 -->|"JWT Tokens +\nUser Profile"| ADM

    %% ══════════════════════════════════════════════════
    %% Process 2.0 — Assessment Management
    %% ══════════════════════════════════════════════════

    INS -->|"Assessment Title & Duration\nQuestions (Excel/Manual)\nAnswer Choices & Correct Flags\nQuestion Types (MCQ/TF/ID)"| P2
    P2 -->|"Question Text for\nTF-IDF Suggestion"| D3
    D3 -->|"Existing Category Names\nSuggested Category Match"| P2
    P2 -->|"Write Assessments,\nQuestions & Answer Choices"| D4

    %% ══════════════════════════════════════════════════
    %% Process 3.0 — Batch & Enrollment Management
    %% ══════════════════════════════════════════════════

    INS -->|"Batch Names\nStudent Emails for Enrollment\nArchive/Retake Commands"| P3
    P3 -->|"Write Batch Records\nWrite Enrollment Records"| D2
    P3 -->|"Auto-create Student\nAccounts (if needed)"| D1
    P3 -->|"Batch Confirmation\nStudent Roster"| INS

    %% ══════════════════════════════════════════════════
    %% Process 4.0 — Assessment Execution
    %% ══════════════════════════════════════════════════

    STU -->|"Start Assessment Request\nSubmit Answers (Choices/Text)"| P4
    P4 -->|"Fetch Active Assessment\nfor Student's Batch"| D2
    D4 -->|"Assessment Structure\n(Questions without Solutions)"| P4
    P4 -->|"Log started_at Timestamp\nWrite Selected Answers\nLog submitted_at"| D5
    P4 -->|"Assessment Interface\n(Questions, Timer Context)"| STU
    P4 -->|"Trigger Auto-scoring\nAPI on Submit"| P5

    %% ══════════════════════════════════════════════════
    %% Process 5.0 — Scoring & Matching Engine
    %% ══════════════════════════════════════════════════

    D4 -->|"Read Answer Keys\n(is_correct Flags)"| P5
    D5 -->|"Read Submitted\nText Answers"| P5
    P5 -->|"NLP Text Normalization:\nstrip() + lower()\nGrade Correct/Incorrect"| P5
    P5 -->|"Write SkillScore Records\n(raw, max, percentage)"| D5
    D6 -->|"Read Position\nRequirement Vectors"| P5
    P5 -->|"Build Student Skill Vector\nBuild Position Vector\nCosine Similarity Computation\n(scikit-learn)"| P5
    P5 -->|"Write Match Scores\n(0–100%)"| D7
    P5 -->|"Scoring Complete\nNotification"| STU

    %% ══════════════════════════════════════════════════
    %% Process 6.0 — Dashboard & Visualization
    %% ══════════════════════════════════════════════════

    STU -->|"Profile Data\n(Address, Pin Location)"| P6
    STU -->|"Fetch Dashboard /\nResults Request"| P6
    INS -->|"View Batch Analytics\nRequest"| P6
    ADM -->|"View System Stats\nManage Companies\nApprove Instructors\nRe-run Recommendations"| P6

    P6 -->|"Read Student\nLocation Data"| D1
    D5 -->|"Fetch Skill Score\nArrays (Radar Chart)"| P6
    D7 -->|"Extract Ranked\nRecommendations"| P6
    D6 -->|"Read Company\nLocations & Positions"| P6
    D2 -->|"Read Batch &\nEnrollment Data"| P6

    P6 -->|"Skill Profile + Radar Chart\nRanked Recommendations\nCompany Distances (Haversine)"| STU
    P6 -->|"Student Progress Grid\nBatch Scores & Rankings\nSSE Real-time Updates"| INS
    P6 -->|"System Statistics\nUser Management Views\nFull Recommendation Reports\nSSE Real-time Updates"| ADM

    ADM -->|"Company/Position Data\nGPS Coordinates"| D6
    ADM -->|"Instructor Approval\nDecision"| D1
    P6 -->|"Approval Email\nRequest"| BRV
    BRV -->|"Delivery Confirmation"| P6

    GEO -->|"PSGC Address Hierarchies\nGPS Coordinates"| P6
    P6 -->|"Province/City Queries\nGeocode Requests"| GEO

    %% ── Styling ──
    style P1 fill:#16a34a,stroke:#15803d,color:#ffffff
    style P2 fill:#16a34a,stroke:#15803d,color:#ffffff
    style P3 fill:#16a34a,stroke:#15803d,color:#ffffff
    style P4 fill:#16a34a,stroke:#15803d,color:#ffffff
    style P5 fill:#16a34a,stroke:#15803d,color:#ffffff
    style P6 fill:#16a34a,stroke:#15803d,color:#ffffff

    style STU fill:#3b82f6,stroke:#2563eb,color:#ffffff
    style INS fill:#8b5cf6,stroke:#7c3aed,color:#ffffff
    style ADM fill:#ef4444,stroke:#dc2626,color:#ffffff
    style GOA fill:#f59e0b,stroke:#d97706,color:#ffffff
    style GEO fill:#06b6d4,stroke:#0891b2,color:#ffffff
    style BRV fill:#ec4899,stroke:#db2777,color:#ffffff

    style D1 fill:#fef3c7,stroke:#d97706,color:#92400e
    style D2 fill:#fef3c7,stroke:#d97706,color:#92400e
    style D3 fill:#fef3c7,stroke:#d97706,color:#92400e
    style D4 fill:#fef3c7,stroke:#d97706,color:#92400e
    style D5 fill:#fef3c7,stroke:#d97706,color:#92400e
    style D6 fill:#fef3c7,stroke:#d97706,color:#92400e
    style D7 fill:#fef3c7,stroke:#d97706,color:#92400e
```

### Level 1 DFD — Process-to-Data Store Flow Matrix

This matrix shows which processes read from (R) or write to (W) each data store:

| Data Store | P1.0 Auth | P2.0 Assessment Mgt | P3.0 Batch Mgt | P4.0 Execution | P5.0 Scoring | P6.0 Dashboard |
|:----------:|:---------:|:-------------------:|:--------------:|:--------------:|:------------:|:--------------:|
| **D1: Users** | R/W | — | W | — | — | R |
| **D2: Batches** | R | — | R/W | R | — | R |
| **D3: Categories** | — | R/W | — | — | — | — |
| **D4: Assessments** | — | W | — | R | R | — |
| **D5: Responses & Scores** | — | — | — | W | R/W | R |
| **D6: Companies** | — | — | — | — | R | R/W |
| **D7: Recommendations** | — | — | — | — | W | R |

### Level 1 DFD — External Entity Interactions Retained from Level 0

| External Entity | Interacts With Process(es) | Data In | Data Out |
|----------------|---------------------------|---------|----------|
| **Student** | P1.0, P4.0, P5.0, P6.0 | OAuth Token, Role, Profile, Answers | JWT, Skill Profile, Recommendations, Distances |
| **Instructor** | P1.0, P2.0, P3.0, P6.0 | OAuth/Password, Questions, Batches, Student Emails | JWT, Student Progress, Scores, Rankings, SSE |
| **Administrator** | P1.0, P6.0, D1, D6 | Password, Companies, Positions, Requirements, Approvals | JWT, Stats, User Lists, Reports, SSE |
| **Google OAuth API** | P1.0 | Token Validation Request | Verified Identity (email, name, photo) |
| **External Geo APIs** | P6.0 | Province/City/Address Queries | PSGC Hierarchies, GPS Coordinates |
| **Brevo Email API** | P6.0 | Approval Email Payload | Delivery Confirmation |

---

## 6. Key Algorithms Referenced in the DFD

The following algorithms are the core intelligence within **Process 5.0 (Scoring & Matching Engine)** and are central to the system's Decision Support functionality:

### 6.1 Text Normalization (NLP Preprocessing)
- **Where:** Process 5.0 → Identification question grading
- **How:** `.strip().lower()` applied to both student answer and stored correct answer
- **Purpose:** Ensures "CPU", "cpu", and "  Cpu  " are treated as identical answers
- **Library:** Python built-in string methods

### 6.2 TF-IDF (Term Frequency–Inverse Document Frequency)
- **Where:** Process 2.0 → Category suggestion during question creation
- **How:** `TfidfVectorizer` converts question text and category names into weighted vectors; cosine similarity identifies the best-matching category
- **Purpose:** Automatically suggests which skill category a new question belongs to
- **Library:** `scikit-learn` (`TfidfVectorizer`)
- **Threshold:** Returns `None` if similarity < 0.05 (5%)

### 6.3 Cosine Similarity (Vector Space Model)
- **Where:** Process 5.0 → Recommendation generation
- **How:** Student skill percentages are normalized to `[0, 1]` vectors; position requirements form corresponding vectors in the same dimensional space; `cosine_similarity()` measures angular similarity
- **Purpose:** Produces ranked match scores (0–100%) between students and internship positions
- **Library:** `scikit-learn` (`cosine_similarity`), `numpy`

### 6.4 Haversine Distance
- **Where:** Process 6.0 → Dashboard distance calculations
- **How:** Frontend computes great-circle distance between student pin location and company GPS coordinates
- **Purpose:** Shows nearby companies and distance-based filtering on student dashboards

---

## 7. Summary for Defense/Documentation

This DFD mapping guarantees no conceptual abstraction represents a "black box." Every external entity, process, data store, and data flow has been traced directly to the actual codebase implementation:

- **Level 0** establishes the system boundary, identifying six external entities and documenting all data crossing that boundary.
- **Level 1** decomposes the system into six sub-processes, revealing internal data pathways and the seven data stores that persist system state.
- All external entities and their data flows from Level 0 are **retained** in Level 1, as required by DFD conventions.

The strict structure highlights why SkillBridge functions specifically as a structured **Decision Support System (DSS)**. It elegantly utilizes Information Retrieval (IR) heuristics — such as Cosine Similarity vector computations and TF-IDF term-document calculations — without outright forcing automation, granting actionable knowledge to the DNSC OJT Coordinator while preserving their final placement decision authority.
