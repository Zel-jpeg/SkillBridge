# SkillBridge — System Justification & NLP Implementation

This document serves as the formal justification for the algorithmic choices, Natural Language Processing (NLP) techniques, and machine learning components implemented within the SkillBridge OJT Placement System.

It explains **how scores are calculated**, **how recommendations are generated**, and **how NLP is leveraged** to make the system intelligent and robust.

---

## 1. Automated Assessment Grading & Text Normalization

**Purpose:** Automatically grade student assessments across various question types (Multiple Choice, True/False, Identification) and aggregate scores into specific Skill Categories.

**NLP Technique Used:** Text Normalization
- **Where it happens:** `score_submission()` in `api/scoring.py`
- **How it works:** For "Identification" (free-text) questions, the student's text answer must be matched against the stored correct answer. To ensure robust matching and prevent false failures due to minor formatting differences, the system applies text normalization:
  - `.strip()`: Removes any leading or trailing whitespace.
  - `.lower()`: Converts the entire string to lowercase for case-insensitive comparison.
- **Justification:** This foundational NLP step ensures that answers like `"  JavaScript  "`, `"javascript"`, and `"JavaScript"` are all correctly identified as matches. This improves the grading accuracy and prevents frustrating student experiences.

---

## 2. Feature Extraction (Building Skill Vectors)

**Purpose:** Transform the student's raw assessment scores into a mathematical format that the recommendation engine can process.

**NLP/ML Technique Used:** Feature Extraction & Vectorization
- **Where it happens:** `build_skill_vector()` in `api/scoring.py`
- **How it works:** Once a student's scores are tallied per skill category (e.g., ReactJS: 82%, Python: 60%), these qualitative scores are converted into a normalized, numerical array known as a **Skill Vector**.
  - Each skill category represents one "dimension" in a multi-dimensional space.
  - The scores are normalized from percentages (0–100) to a proportion scale (0.0–1.0) by dividing by 100.
  - Example Vector: `[0.82, 0.60, 0.45, 0.30]`
- **Justification:** Algorithms cannot inherently understand "ReactJS" or "Python". By extracting these competencies into a continuous vector space, we create a standardized profile that can be quantitatively compared against industry requirements. 

---

## 3. The Recommendation Engine (Cosine Similarity)

**Purpose:** Match student skill profiles against company position requirements and generate a ranked list of best-fit OJT placements.

**NLP/ML Technique Used:** Vector Space Model & Cosine Similarity
- **Where it happens:** `generate_recommendations()` in `api/scoring.py`
- **How it works:** 
  1. The system builds the student's skill vector (as explained above).
  2. It builds a corresponding requirement vector for every open company position using the exact same skill category dimensions.
  3. It applies **Cosine Similarity** (`sklearn.metrics.pairwise.cosine_similarity`) to measure the angle between the student's vector and the position's vector.
  4. The result is a score between 0.0 (no match) and 1.0 (perfect match), which is multiplied by 100 to yield a percentage.
- **Justification:** 
  - **Why Cosine Similarity?** Unlike simple Euclidean distance or raw percentage comparisons, cosine similarity focuses on the *direction* and *pattern* of the profile. A student who scores strongly in the same specific areas a company needs will match highly, regardless of the overall magnitude of their scores.
  - **Explainability:** It is computationally efficient, widely adopted in industry (used in search engines and recommendation systems), and produces a mathematically sound score that is easy to explain to academic panels and end-users.
  - **Match Thresholds:** The resulting score translates directly to match confidence (e.g., ≥80% is a Strong Match, ≥60% is a Fair Match).

---

## 4. Question Auto-Tagging (TF-IDF Category Suggestion)

**Purpose:** Assist instructors during assessment creation by automatically suggesting the correct Skill Category for a newly written question.

**NLP Technique Used:** TF-IDF (Term Frequency–Inverse Document Frequency)
- **Where it happens:** `suggest_category()` in `api/scoring.py`
- **How it works:** 
  - **TF-IDF Vectorization:** The system treats the names of all skill categories (e.g., "Web Development", "Database Management") and the newly typed question as individual "documents" in a corpus.
  - `TfidfVectorizer` (from `scikit-learn`) analyzes the corpus. It assigns high weights to rare, distinguishing terms and low weights to common stop-words (like "is", "the").
  - **Similarity Matching:** It computes the cosine similarity between the question's TF-IDF vector and the vectors of all available skill categories.
  - The category with the highest similarity score (above a 5% confidence threshold) is suggested to the instructor.
- **Justification:** This drastically speeds up assessment creation and ensures consistent tagging. Instead of relying on manual categorization, the system intelligently infers the context of the question using standard NLP document-similarity techniques.

---

## 5. Accuracy & System Reliability

The recommendation and matching algorithms in SkillBridge are highly reliable for the following reasons:
1. **Scale Immunity:** By using cosine similarity, the system is immune to scale differences. It rewards students whose skill distributions accurately mirror a company's requested skill distribution.
2. **Standardized Implementations:** The system relies on `numpy` and `scikit-learn`, which are industry-standard, heavily optimized, and mathematically proven libraries for data science and machine learning.
3. **Data Quality Checks:** The algorithms are deterministic and depend directly on validated input data (instructor-graded assessments and company-defined requirements). 
4. **On-Demand Recalculation:** The engine is dynamic. If a company updates its requirements or a student retakes an assessment, the similarity matrices are immediately recalculated, ensuring recommendations are always up to date.

---
**Summary Statement:** 
SkillBridge is more than just a tracking tool; it is an intelligent placement engine. By applying core Natural Language Processing (text normalization, TF-IDF) and Machine Learning algorithms (Feature Extraction, Cosine Similarity), it removes bias from OJT placements and provides data-driven, mathematically justified recommendations for every student.
