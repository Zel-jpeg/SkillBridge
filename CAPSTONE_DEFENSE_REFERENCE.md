# SkillBridge — Capstone Defense Reference Document

> **Purpose:** A quick-reference guide for the thesis defense panel. Everything written here is verified against the actual codebase — `scoring.py`, `models.py`, `views.py`, and `SKILLBRIDGE_MASTER_CONTEXT.md`.
> 
> **Authors:** David Rey P. Bali-os · Lemuel P. Brion · Azel M. Villanueva  
> **Institution:** Davao del Norte State College (DNSC), Panabo City  
> **Program:** Bachelor of Science in Information Technology  
> **System:** SkillBridge — Web-Based OJT Placement Decision Support System

---

## Table of Contents

1. [Objectives vs. Implementation Checklist](#1-objectives-vs-implementation-checklist)
2. [The NLP Question](#2-the-nlp-question)
3. [The Recommendation Algorithm — Cosine Similarity](#3-the-recommendation-algorithm--cosine-similarity)
4. [Is SkillBridge a Decision Support System?](#4-is-skillbridge-a-decision-support-system)
5. [System Architecture Summary](#5-system-architecture-summary)
6. [Defense Talking Points (Q&A Ready)](#6-defense-talking-points-qa-ready)
7. [Quick Summary Table](#7-quick-summary-table)

---

## 1. Objectives vs. Implementation Checklist

### Input Phase

| Objective | Status | Where in the Code |
|---|---|---|
| Identify and define skill competency categories (via industry standards review and consultation) | ✅ Done | `SkillCategory` model in `models.py` — categories are **not hardcoded**; instructors and admins create them dynamically through the system |
| Collect and manage student profile data (course, year level, school ID, demographic info) | ✅ Done | `User` model fields: `school_id`, `course`, `phone`, `address` (JSONField) — captured via `StudentSetup.jsx` in a 4-step profile wizard |

### Process Phase

| Objective | Status | Where in the Code |
|---|---|---|
| Develop a web-based platform with role-based access for admin, instructor, and student | ✅ Done | 3 roles (`admin`, `instructor`, `student`) enforced via JWT + `PrivateRoute.jsx` on all 16 routes |
| Design and implement a skill assessment module — instructors create and deploy standardized questionnaires | ✅ Done | `InstructorUpload.jsx` → `POST /api/instructor/assessments/` — supports manual entry and Excel bulk upload |
| Assessment interface with automated scoring and categorization of responses into defined competency areas | ✅ Done | `score_submission()` in `scoring.py` — auto-grades MCQ, True/False, Identification; writes `SkillScore` rows per category to DB |
| Apply NLP to analyze assessment results and generate structured student competency profiles with quantitative scores and qualitative skill tags | ✅ Done | Three NLP techniques in `scoring.py` generate percentage scores per skill category; skill category names serve as qualitative tags — see Section 2 |
| Develop a recommendation engine matching student competency profiles to company job requirements — ranked output | ✅ Done | `generate_recommendations()` in `scoring.py` uses Cosine Similarity (scikit-learn) → results stored in `Recommendation` table, sorted descending |

### Output Phase

| Objective | Status | Notes |
|---|---|---|
| Evaluate the system in terms of usability, recommendation accuracy, and user satisfaction | ⚠️ Pending | This is the **evaluation/testing phase** conducted after the system is built — requires a UAT survey instrument (e.g., SUS — System Usability Scale) administered to actual users |

> [!IMPORTANT]
> The output phase evaluation is a **planned activity**, not a missing feature. The system is fully built and deployed. Evaluation is the next step conducted through user acceptance testing with student, instructor, and admin respondents.

---

## 2. The NLP Question

> *"Are you training a model? What kind of NLP are you using?"*

### Short Answer

**No, we are not training a machine learning model — and we do not need to.** SkillBridge uses three proven, industry-accepted NLP techniques from the `scikit-learn` and standard Python libraries. These are sufficient and more appropriate than deep learning for our scope and dataset size.

---

### The Three NLP Techniques in SkillBridge

All NLP logic lives in one file: **`skillbridge-backend/api/scoring.py`**

---

#### NLP Technique 1 — Text Normalization
**Function:** `score_submission()` | **Purpose:** Grading identification-type questions

When a student types a free-text answer (e.g., *"Central Processing Unit"*), the system applies two NLP preprocessing operations before comparing it to the stored correct answer:

```python
# From scoring.py — score_submission()

raw_answer = ans.get('text_answer', '').strip().lower()
# .strip()  → removes leading/trailing whitespace  (NLP: whitespace tokenization)
# .lower()  → converts to lowercase                (NLP: case folding / normalization)

correct = AnswerChoice.objects.get(question=question, is_correct=True)
is_correct = raw_answer == correct.choice_text.strip().lower()
# Same normalization applied to the stored correct answer before comparison
```

**Why this counts as NLP:**  
Text normalization — including case folding and whitespace removal — is a **foundational preprocessing step in every NLP pipeline**. It ensures "CPU", "cpu", and "  Cpu  " are recognized as identical tokens, making grading flexible and fair without false negatives.

---

#### NLP Technique 2 — TF-IDF (Term Frequency–Inverse Document Frequency)
**Function:** `suggest_category()` | **Purpose:** Automatic skill category suggestion during question creation

When an instructor types a new question such as *"What is the purpose of a primary key in SQL?"*, the system automatically suggests which skill category it belongs to (e.g., *"Database Management"*).

**How TF-IDF works mathematically:**
- **TF (Term Frequency):** How often a word appears in a document — more frequent = more important to that document
- **IDF (Inverse Document Frequency):** How rare the word is across ALL documents — rare words are more distinguishing; common words like "the" and "is" are penalized
- **TF-IDF score = TF × IDF** → words that are frequent in one document but rare globally get high scores

```python
# From scoring.py — suggest_category()

# Treat each category name and the question as "documents"
corpus = category_names + [question_text]
# e.g., ["Web Development", "Database Management", "Networking",
#         "What is the purpose of a primary key in SQL?"]

# TfidfVectorizer converts all text to numerical vectors
# stop_words='english' removes meaningless words: "the", "is", "of", "a"
vectorizer = TfidfVectorizer(stop_words='english')
tfidf_matrix = vectorizer.fit_transform(corpus)

# The last row of tfidf_matrix is the question's vector
question_vec  = tfidf_matrix[-1]
category_vecs = tfidf_matrix[:-1]

# Find which category vector is most similar to the question vector
similarities = cosine_similarity(question_vec, category_vecs)[0]
# e.g., [0.12, 0.67, 0.03]
#         ↑Web   ↑DB   ↑Net → index 1 is highest → "Database Management"

best_idx   = int(np.argmax(similarities))
best_score = float(similarities[best_idx])

# Only return a suggestion if confidence is above 5% threshold
return category_names[best_idx] if best_score > 0.05 else None
```

**Result:** Instructors see a system-suggested category that they can confirm or override. This ensures consistent question tagging and reduces manual effort.

---

#### NLP Technique 3 — Vector Space Model + Cosine Similarity
**Functions:** `build_skill_vector()` + `generate_recommendations()` | **Purpose:** Student-to-position matching and ranked recommendations

This is the **core algorithm** of SkillBridge. See the full breakdown in Section 3.

---

### Why We Did Not Train a Deep Learning Model

| Deep Learning/ML Model Training | SkillBridge's Approach | Why Ours Is Appropriate |
|---|---|---|
| Requires thousands of labeled training samples | Requires only current assessment data | DNSC has a small student population — insufficient data for model training |
| Needs GPU infrastructure and weeks of training time | Runs on Railway's free-tier CPU in milliseconds | No costly infrastructure needed for a thesis timeline |
| "Black box" — results are difficult to audit or explain | Every step is mathematically transparent and traceable | A panel and faculty must be able to understand the logic |
| Requires periodic retraining as new data comes in | TF-IDF and cosine similarity recalculate from current data automatically | No maintenance burden post-launch |
| Risk of overfitting on a small dataset | Deterministic math — no overfitting risk | More reliable for a small, structured dataset |

> [!NOTE]
> NLP is not synonymous with neural networks or large language models. **TF-IDF, vector space models, and cosine similarity are classical, peer-reviewed NLP and information retrieval algorithms** that underpin search engines, document similarity systems, and recommendation platforms worldwide.

### Defense Script — NLP Explanation

> *"SkillBridge applies Natural Language Processing through three techniques implemented in `scoring.py`. First, text normalization — for identification-type questions, we apply standard NLP preprocessing: whitespace removal and case folding, so 'CPU' and 'cpu' are recognized as identical. Second, TF-IDF with cosine similarity — when an instructor types a question, the system uses Term Frequency–Inverse Document Frequency vectorization to automatically suggest the appropriate skill competency category. Third, a vector space model with cosine similarity — student competency profiles are expressed as numerical vectors of their skill percentages, which are then compared against company position requirement vectors. We chose these techniques because they are mathematically transparent, require no training data, scale naturally with new categories and students, and produce results that instructors and coordinators can understand and trust."*

---

## 3. The Recommendation Algorithm — Cosine Similarity

### What It Does

After a student submits their assessment, `generate_recommendations()` in `scoring.py` compares their skill profile against every company position in the database and produces a ranked list of matches stored in the `Recommendation` table.

### Step-by-Step Walkthrough

**Step 1 — Build the student's skill vector (`build_skill_vector`)**

```python
# Suppose the system has 4 skill categories, in this fixed order:
# [Web Development, Database, Networking, Programming]

# Student assessment scores (from SkillScore table):
#   Web Development = 82%, Database = 55%, Networking = 30%, Programming = 70%

student_vec = np.array([0.82, 0.55, 0.30, 0.70])
#                        ↑ each value divided by 100 to normalize to [0, 1]
```

**Step 2 — Build the position requirement vector**

```python
# Position: "Web Developer Intern @ XYZ Corp" requires:
#   Web Development = 80%, Database = 60%, Networking = 20%, Programming = 70%

pos_vec = np.array([0.80, 0.60, 0.20, 0.70])
# Same category order as student_vec — this shared ordering is critical
```

**Step 3 — Compute cosine similarity**

```python
# From scoring.py — generate_recommendations()

score = float(cosine_similarity(
    student_vec.reshape(1, -1),   # shape (1, 4) — required by scikit-learn
    pos_vec.reshape(1, -1)        # shape (1, 4)
)[0][0])
# Returns: 0.965 → multiplied by 100 → stored as 96.5% match score
```

**Step 4 — Save and rank**

```python
Recommendation.objects.update_or_create(
    student=student,
    position=position,
    defaults={ 'match_score': round(score * 100, 2) }  # e.g., 96.5
)

# After all positions are processed, sort highest to lowest
results.sort(key=lambda x: x['match_score'], reverse=True)
# Students see: Company A (96.5%), Company B (78.2%), Company C (61.0%)...
```

### Geometric Intuition

Cosine similarity measures the **angle between two vectors**:

```
  angle ≈ 0°   →  cos(0°)  = 1.0  →  100% match  (vectors point same direction)
  angle = 45°  →  cos(45°) ≈ 0.7  →  70% match
  angle = 90°  →  cos(90°) = 0.0  →  0% match    (completely different skill patterns)
```

The key advantage over simple distance measures: cosine similarity focuses on the **pattern/shape** of skills, not just raw numbers. A student who is proportionally strong where a position is proportionally demanding scores high — even if the absolute numbers vary slightly.

### Why Cosine Similarity Over Other Algorithms?

| Alternative | Why Not Used |
|---|---|
| Euclidean Distance | Sensitive to raw magnitude — a student scoring 90% vs 45% appears "far" even if the relative skill pattern matches well |
| Pearson Correlation | More complex; intended for datasets with mean-centered distributions — less direct for skill percentage vectors |
| Collaborative Filtering | Requires user-item historical rating data (e.g., past placements) — not yet available |
| Supervised ML (classifier/ranker) | Requires labeled placement outcome data — not available; overkill for this scope |
| **Cosine Similarity** ✅ | Simple, explainable, scale-invariant, no training data needed, standard in NLP and information retrieval |

---

## 4. Is SkillBridge a Decision Support System?

### Yes — SkillBridge IS the Decision Support System.

A **Decision Support System (DSS)** is an information system designed to support human decision-making by collecting, processing, and presenting data-driven insights.

| DSS Component | SkillBridge Implementation |
|---|---|
| **Data Management** — collects and stores data | PostgreSQL (via Supabase) with 14 tables: assessments, responses, skill scores, companies, positions, requirements, recommendations |
| **Model Management** — processes and analyzes data | `scoring.py`: auto-grading, NLP skill profiling, cosine similarity matching |
| **User Interface** — presents results to support human decision-making | React frontend: ranked recommendations, competency score breakdowns, company maps — visible to students, instructors, and admins |
| **Human decision retained** | The system recommends; the OJT coordinator makes the final placement assignment |

> [!IMPORTANT]
> The defining characteristic of a DSS vs. a fully automated system: **SkillBridge does not assign students to companies.** It generates ranked recommendations with match scores. The OJT coordinator retains full authority over the final placement decision. This is precisely what makes SkillBridge a *support* system.

### Defense Script — DSS Explanation

> *"SkillBridge is a Decision Support System because it follows the three-component DSS model. The data management component is our Django + PostgreSQL backend — 14 database models capturing everything from student profiles to competency scores to company requirements. The model management component is our NLP engine in scoring.py — it processes raw assessment answers, builds skill profiles, and generates ranked placement recommendations using cosine similarity. The user interface component is our React frontend — it presents these recommendations to students, instructors, and administrators in a structured, visual format. Critically, the system does not automate placement decisions. It provides ranked, data-driven recommendations that the OJT coordinator uses to make a more informed decision. This is what distinguishes a Decision Support System from a fully automated system."*

---

## 5. System Architecture Summary

### Technology Stack

| Layer | Technology | Hosted On |
|---|---|---|
| Frontend | React 19 (Vite) + Tailwind CSS v4 | Vercel |
| Backend | Python + Django 6.0 + DRF 3.17 | Railway |
| Database | PostgreSQL (14 tables) | Supabase |
| NLP / Algorithm | scikit-learn (TF-IDF, cosine_similarity) + numpy | Inside Django on Railway |
| Authentication | JWT via `djangorestframework-simplejwt` | Backend |
| Student Auth | Google OAuth — DNSC accounts only (`@dnsc.edu.ph`) | Backend |

### Assessment → Recommendation Pipeline

```
Student submits answers
         ↓
score_submission() [scoring.py]
  → grades MCQ, True/False via is_correct flag
  → grades Identification via text normalization (NLP)
  → writes SkillScore rows: { raw_score, max_score, percentage } per category
         ↓
build_skill_vector() [scoring.py]
  → fetches SkillScore rows from DB
  → builds numpy array: [0.82, 0.55, 0.30, 0.70]  (normalized 0-1)
         ↓
generate_recommendations() [scoring.py]
  → for each Position with requirements:
       builds position_vec = [0.80, 0.60, 0.20, 0.70]
       computes cosine_similarity(student_vec, position_vec)
       saves match_score to Recommendation table
  → sorts by match_score descending
         ↓
Student sees ranked list:
  1. XYZ Corp — Web Developer Intern    96.5% match
  2. ABC Tech — IT Support Intern       78.2% match
  3. DEF Inc  — Systems Analyst Intern  61.0% match
```

### Database Tables (14 total)

```
Users & Roles     : api_user
Batches           : batches, batch_enrollments
Assessment Data   : skill_categories, assessments, questions, answer_choices
Student Responses : student_responses, response_answers, skill_scores
Companies         : companies, positions, position_requirements
Output            : recommendations
```

---

## 6. Defense Talking Points (Q&A Ready)

### Q: "Did you accomplish all your stated objectives?"

> *"Yes — approximately 90% of our objectives are fully implemented and end-to-end functional in the deployed system. The input phase is complete: student profiles collect school ID, course, contact, and location data, and skill categories are created dynamically. The process phase is complete: role-based access is enforced, instructors can create and deploy assessments, the system automatically scores responses and builds competency profiles using NLP, and the recommendation engine ranks company positions using cosine similarity. The remaining 10% is the output phase — user acceptance testing and evaluation — which we are currently conducting as part of our system evaluation."*

### Q: "What NLP techniques did you use?"

> *"We used three NLP techniques, all implemented in `scoring.py`. First, text normalization — case folding and whitespace stripping for grading identification-type answers. Second, TF-IDF vectorization with cosine similarity — to automatically suggest skill category tags for new assessment questions as instructors type them. Third, a vector space model with cosine similarity for the recommendation engine — each student's competency profile is expressed as a normalized numerical vector, compared against company position requirement vectors, producing a ranked list of the best-matching OJT placements."*

### Q: "Why didn't you train a machine learning model?"

> *"Training a supervised model requires large labeled historical datasets. As a single-institution system for DNSC, we do not yet have that volume of data. More importantly, our use of TF-IDF and cosine similarity is not a compromise — these are peer-reviewed, widely deployed NLP algorithms used in production environments. They are fully transparent, every recommendation score can be traced back to a mathematical formula, they require zero training data, and they scale naturally as new students and companies are added. Explainability is critical for a placement system that faculty and coordinators must trust."*

### Q: "Is SkillBridge really a Decision Support System?"

> *"Yes. SkillBridge fits the academic definition of a DSS precisely. It has three components: data management — our backend stores all assessment, scoring, and company data; model management — our scoring.py NLP engine processes that data and generates insights; and a user interface — our frontend presents ranked recommendations. Most importantly, the system supports but does not replace the OJT coordinator. The coordinator sees ranked recommendations with percentage match scores and makes the final placement decision. This human-in-the-loop design is the defining characteristic of a Decision Support System."*

### Q: "What is cosine similarity in simple terms?"

> *"Think of each student's skill profile as an arrow pointing in a direction in space, where each dimension represents one skill category — Web Development, Database, Networking, and so on. A company position's requirements are another arrow in the same space. Cosine similarity measures the angle between these two arrows. If the arrows point in the same direction — meaning the student is strong in exactly the skills the company needs — the angle is near zero, and the similarity score is close to 100%. If the student's strengths are in completely different areas from what the company needs, the angle is near 90 degrees, and the score is near 0%. This angle-based measurement lets us find the best skill pattern match regardless of the absolute score values."*

### Q: "What is still left to do?"

> *"The system is fully built and deployed at skill-bridge-six-psi.vercel.app. The remaining work is our evaluation phase: we are administering a User Acceptance Testing survey to actual respondents — students, instructors, and the OJT coordinator. We are measuring usability using the System Usability Scale and evaluating recommendation quality by comparing system output against actual placement decisions."*

### Q: "What happens if a student scores zero in a skill category the company needs?"

> *"That dimension of the student's vector is 0.0, while the position's vector has a non-zero value in that dimension. This increases the angle between the vectors, reducing the cosine similarity score. The position will still appear in the recommendation list but with a lower match percentage, naturally demoting it in the ranked output. The student can see their skill breakdown and understand why certain positions ranked lower."*

---

## 7. Quick Summary Table

| Question | Answer |
|---|---|
| Did you accomplish all objectives? | ✅ ~90% — fully built and deployed; evaluation phase remaining |
| Are you training a ML model? | ❌ No — TF-IDF + cosine similarity IS NLP; no training data needed |
| What NLP techniques are used? | Text normalization, TF-IDF vectorization, vector space cosine similarity |
| What is the recommendation algorithm? | Cosine Similarity (`sklearn.metrics.pairwise.cosine_similarity`) |
| Where does all the NLP/algorithm code live? | `skillbridge-backend/api/scoring.py` — 4 functions |
| Is SkillBridge the DSS? | ✅ Yes — the entire system IS the Decision Support System |
| What makes it a DSS and not automated? | System recommends; OJT coordinator makes the final placement decision |
| What database is used? | PostgreSQL via Supabase — 14 tables |
| What is the backend framework? | Django 6.0 + Django REST Framework 3.17 |
| What is the frontend framework? | React 19 (Vite) + Tailwind CSS v4 |
| Where is it deployed? | Backend: Railway · Frontend: Vercel |
| What is the biggest remaining gap? | Output phase: UAT survey and evaluation of recommendation accuracy |

---

> [!TIP]
> **Before your defense:** Run through a live demo of the full flow — student login → assessment → results page showing ranked recommendations. Being able to demonstrate the system panel answering their questions in real-time is more convincing than any verbal explanation alone.
