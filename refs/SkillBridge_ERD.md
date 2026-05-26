# Entity Relationship Diagram (ERD) — SkillBridge
**Web-Based OJT Placement Decision Support System**

---

## Database Overview

SkillBridge uses **PostgreSQL** (hosted on Supabase) with **14 application tables** organized into four logical groups:

| Group | Tables | Purpose |
|-------|--------|---------|
| **User Management** | User, Batch, BatchEnrollment | User accounts, student groupings, and enrollment records |
| **Assessment Engine** | SkillCategory, Assessment, Question, AnswerChoice | Skill taxonomy, test content, and answer keys |
| **Response & Scoring** | StudentResponse, ResponseAnswer, SkillScore | Student submissions, individual answers, and computed scores |
| **Placement Matching** | Company, Position, PositionRequirement, Recommendation | Company profiles, job requirements, and cosine similarity results |

---

## Entity Relationship Diagram

```mermaid
erDiagram
    %% ═══════════════════════════════════════════════════
    %% USER MANAGEMENT GROUP
    %% ═══════════════════════════════════════════════════

    User {
        int8 id PK
        varchar email UK "Unique"
        varchar password
        varchar name
        varchar role "student | instructor | admin"
        varchar school_id
        varchar course
        varchar phone
        jsonb address "Nullable - Home/Boarding/Pin"
        text photo_url
        bool is_approved
        bool is_active
        bool is_staff
        bool is_superuser
        timestamptz last_login "Nullable"
        timestamptz created_at
    }

    Batch {
        int8 id PK
        varchar name
        varchar status "active | archived"
        timestamptz archived_at "Nullable"
        timestamptz created_at
        int8 instructor_id FK "References User"
    }

    BatchEnrollment {
        int8 id PK
        timestamptz enrolled_at
        int8 batch_id FK "References Batch"
        int8 student_id FK "References User"
    }

    %% ═══════════════════════════════════════════════════
    %% ASSESSMENT ENGINE GROUP
    %% ═══════════════════════════════════════════════════

    SkillCategory {
        int8 id PK
        varchar name
        text description
        timestamptz created_at
        int8 created_by_id FK "Nullable - References User"
    }

    Assessment {
        int8 id PK
        varchar title
        int4 duration_minutes
        bool is_active
        timestamptz created_at
        int8 batch_id FK "Nullable - References Batch"
        int8 created_by_id FK "References User"
    }

    Question {
        int8 id PK
        text question_text
        varchar question_type "mcq | truefalse | identification"
        int4 question_order
        int8 assessment_id FK "References Assessment"
        int8 skill_category_id FK "Nullable - References SkillCategory"
    }

    AnswerChoice {
        int8 id PK
        text choice_text
        bool is_correct
        int8 question_id FK "References Question"
    }

    %% ═══════════════════════════════════════════════════
    %% RESPONSE & SCORING GROUP
    %% ═══════════════════════════════════════════════════

    StudentResponse {
        int8 id PK
        timestamptz started_at "Nullable - Timer anti-cheat"
        timestamptz submitted_at "Nullable - Null means in progress"
        bool retake_allowed
        int8 student_id FK "References User"
        int8 assessment_id FK "References Assessment"
    }

    ResponseAnswer {
        int8 id PK
        text text_answer "For identification type"
        int8 response_id FK "References StudentResponse"
        int8 question_id FK "References Question"
        int8 selected_choice_id FK "Nullable - References AnswerChoice"
    }

    SkillScore {
        int8 id PK
        int4 raw_score
        int4 max_score
        float8 percentage
        int8 student_id FK "References User"
        int8 assessment_id FK "References Assessment"
        int8 skill_category_id FK "References SkillCategory"
    }

    %% ═══════════════════════════════════════════════════
    %% PLACEMENT MATCHING GROUP
    %% ═══════════════════════════════════════════════════

    Company {
        int8 id PK
        varchar name
        jsonb address "Nullable - province/city/barangay"
        float8 location_lat "Nullable"
        float8 location_lng "Nullable"
        timestamptz created_at
        int8 added_by_id FK "Nullable - References User"
    }

    Position {
        int8 id PK
        varchar title
        int4 slots_available
        int8 company_id FK "References Company"
    }

    PositionRequirement {
        int8 id PK
        float8 required_percentage
        int8 position_id FK "References Position"
        int8 skill_category_id FK "References SkillCategory"
    }

    Recommendation {
        int8 id PK
        float8 match_score "Cosine similarity 0-100"
        timestamptz generated_at
        int8 student_id FK "References User"
        int8 position_id FK "References Position"
    }

    %% ═══════════════════════════════════════════════════
    %% RELATIONSHIPS
    %% ═══════════════════════════════════════════════════

    %% User Management
    User ||--o{ Batch : "creates (as instructor)"
    User ||--o{ BatchEnrollment : "enrolled in (as student)"
    Batch ||--o{ BatchEnrollment : "contains"

    %% Assessment Engine
    User ||--o{ Assessment : "creates (as instructor)"
    User ||--o{ SkillCategory : "creates"
    Batch ||--o{ Assessment : "has"
    Assessment ||--o{ Question : "contains"
    SkillCategory ||--o{ Question : "categorizes"
    Question ||--o{ AnswerChoice : "has"

    %% Response & Scoring
    User ||--o{ StudentResponse : "takes (as student)"
    Assessment ||--o{ StudentResponse : "responded to"
    StudentResponse ||--o{ ResponseAnswer : "contains"
    Question ||--o{ ResponseAnswer : "answered in"
    AnswerChoice ||--o{ ResponseAnswer : "selected in"
    User ||--o{ SkillScore : "scored (as student)"
    Assessment ||--o{ SkillScore : "generates"
    SkillCategory ||--o{ SkillScore : "measured by"

    %% Placement Matching
    User ||--o{ Company : "adds (as admin)"
    Company ||--o{ Position : "offers"
    Position ||--o{ PositionRequirement : "requires"
    SkillCategory ||--o{ PositionRequirement : "defines"
    User ||--o{ Recommendation : "recommended for (as student)"
    Position ||--o{ Recommendation : "matched with"
```

---

## Relationship Summary Table

| # | Parent Entity | Child Entity | Cardinality | Foreign Key | Constraint |
|---|---------------|-------------|-------------|-------------|------------|
| 1 | User | Batch | One-to-Many | `instructor_id` | CASCADE |
| 2 | User | BatchEnrollment | One-to-Many | `student_id` | CASCADE |
| 3 | Batch | BatchEnrollment | One-to-Many | `batch_id` | CASCADE |
| 4 | User | Assessment | One-to-Many | `created_by_id` | CASCADE |
| 5 | Batch | Assessment | One-to-Many | `batch_id` | SET_NULL |
| 6 | User | SkillCategory | One-to-Many | `created_by_id` | SET_NULL |
| 7 | Assessment | Question | One-to-Many | `assessment_id` | CASCADE |
| 8 | SkillCategory | Question | One-to-Many | `skill_category_id` | SET_NULL |
| 9 | Question | AnswerChoice | One-to-Many | `question_id` | CASCADE |
| 10 | User | StudentResponse | One-to-Many | `student_id` | CASCADE |
| 11 | Assessment | StudentResponse | One-to-Many | `assessment_id` | CASCADE |
| 12 | StudentResponse | ResponseAnswer | One-to-Many | `response_id` | CASCADE |
| 13 | Question | ResponseAnswer | One-to-Many | `question_id` | CASCADE |
| 14 | AnswerChoice | ResponseAnswer | One-to-Many | `selected_choice_id` | SET_NULL |
| 15 | User | SkillScore | One-to-Many | `student_id` | CASCADE |
| 16 | Assessment | SkillScore | One-to-Many | `assessment_id` | CASCADE |
| 17 | SkillCategory | SkillScore | One-to-Many | `skill_category_id` | CASCADE |
| 18 | User | Company | One-to-Many | `added_by_id` | SET_NULL |
| 19 | Company | Position | One-to-Many | `company_id` | CASCADE |
| 20 | Position | PositionRequirement | One-to-Many | `position_id` | CASCADE |
| 21 | SkillCategory | PositionRequirement | One-to-Many | `skill_category_id` | CASCADE |
| 22 | User | Recommendation | One-to-Many | `student_id` | CASCADE |
| 23 | Position | Recommendation | One-to-Many | `position_id` | CASCADE |

---

## Unique Constraints

| Table | Columns | Purpose |
|-------|---------|---------|
| User | `email` | Prevents duplicate accounts |
| BatchEnrollment | `(batch_id, student_id)` | Prevents double enrollment |
| StudentResponse | `(student_id, assessment_id)` | One response per student per assessment |
| SkillScore | `(student_id, assessment_id, skill_category_id)` | One score per student per category per assessment |
| PositionRequirement | `(position_id, skill_category_id)` | One requirement per category per position |
| Recommendation | `(student_id, position_id)` | One recommendation per student per position |

---

## JSONField Structures

### User.address
```json
{
  "stayingAt": "home | boarding",
  "travelWilling": "yes | no",
  "home": {
    "province": "Davao del Norte",
    "city": "Panabo City",
    "barangay": "San Francisco"
  },
  "boarding": {
    "province": "...",
    "city": "...",
    "barangay": "..."
  },
  "pinLat": 7.3087,
  "pinLng": 125.6841
}
```

### Company.address
```json
{
  "province": "Davao del Norte",
  "city": "Tagum City",
  "barangay": "Poblacion"
}
```
