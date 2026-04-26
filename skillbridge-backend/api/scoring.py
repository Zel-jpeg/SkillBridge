"""
================================================================================
api/scoring.py — SkillBridge NLP & Scoring Engine
================================================================================

This file contains ALL of the Natural Language Processing (NLP) and algorithmic
logic used by SkillBridge. It is the core "intelligence" of the system.

There are FOUR functions in this file, each serving a specific purpose:

  FUNCTION 1: score_submission()
  ─────────────────────────────
  PURPOSE : Automatically grade a student's assessment answers.
  NLP USED: Text normalization (lowercasing, stripping whitespace) for
            Identification-type questions — a basic but valid NLP preprocessing
            technique that allows flexible, case-insensitive answer matching.

  FUNCTION 2: build_skill_vector()
  ────────────────────────────────
  PURPOSE : Convert a student's skill scores into a mathematical vector
            (a list of numbers) that can be used for comparison.
  NLP USED: Feature extraction — transforming categorical skill data into a
            numerical vector representation, a standard step in NLP/ML pipelines.

  FUNCTION 3: generate_recommendations()
  ───────────────────────────────────────
  PURPOSE : Match each student's skill vector against every company position's
            requirement vector and produce a ranked list of recommendations.
  ALGORITHM: Cosine Similarity (from scikit-learn)
  NLP USED: Vector Space Model — both student profiles and job requirements are
            represented as vectors in a shared skill-category space. Cosine
            similarity measures how "aligned" these two vectors are.

  FUNCTION 4: suggest_category()
  ───────────────────────────────
  PURPOSE : When an instructor writes a new question, automatically suggest
            which skill category that question belongs to.
  NLP USED: TF-IDF (Term Frequency–Inverse Document Frequency) + Cosine
            Similarity — a classic NLP technique for text similarity matching.

Libraries used:
  - numpy       : For building and manipulating numerical arrays (vectors)
  - scikit-learn: For TfidfVectorizer (TF-IDF) and cosine_similarity
  - django.utils: For timezone-aware timestamps
================================================================================
"""

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from django.utils import timezone


# ══════════════════════════════════════════════════════════════════════════════
# FUNCTION 1: score_submission()
# ══════════════════════════════════════════════════════════════════════════════

def score_submission(student_response, answers_data, categories):
    """
    WHAT THIS DOES:
    ───────────────
    Automatically grades ALL answers submitted by a student for one assessment.
    It handles three question types — MCQ, True/False, and Identification —
    and then tallies scores per skill category (e.g., "Web Development",
    "Database Management", etc.).

    After grading, it writes a SkillScore record into the database for each
    skill category found in the assessment. These SkillScore records are what
    build the student's competency profile.

    NLP TECHNIQUE USED — Text Normalization:
    ─────────────────────────────────────────
    For Identification questions, the student types a text answer (e.g., "CPU"
    or "central processing unit"). We apply two NLP preprocessing steps:
       1. .strip()  → removes leading/trailing whitespace
       2. .lower()  → converts to lowercase for case-insensitive comparison
    This is called "text normalization" — a foundational NLP technique that
    ensures "CPU", "cpu", and "  Cpu  " are all treated as the same answer.

    PARAMETERS:
    ───────────
    student_response : The StudentResponse object (links student + assessment)
    answers_data     : List of answer dicts — e.g.:
                         [{ 'question_id': 1, 'selected_choice_id': 5 },   ← MCQ/True-False
                          { 'question_id': 2, 'text_answer': 'CPU' }]       ← Identification
    categories       : All SkillCategory objects (for reference)

    RETURNS:
    ────────
    A dict summarizing scores per category:
    { 'Web Development': { 'raw': 7, 'max': 10, 'pct': 70.0 }, ... }
    """
    from .models import Question, AnswerChoice, ResponseAnswer, SkillScore

    # ── STEP 1: Tally correct answers per skill category ──────────────────────
    # We use a dictionary to count:
    #   - 'raw': how many the student got correct in this category
    #   - 'max': total number of questions in this category
    # Example: { 3: {'raw': 7, 'max': 10}, 5: {'raw': 3, 'max': 5} }
    #            ^ skill_category_id
    tally = {}

    for ans in answers_data:
        # Retrieve the Question from the database, ensuring it belongs to
        # the correct assessment (prevents answer injection attacks)
        try:
            question = Question.objects.select_related('skill_category').get(
                id=ans.get('question_id'),
                assessment=student_response.assessment
            )
        except Question.DoesNotExist:
            continue  # Skip if question ID is invalid

        # Initialize the tally for this skill category if not yet seen
        cat_id = question.skill_category_id
        if cat_id not in tally:
            tally[cat_id] = {'raw': 0, 'max': 0}
        tally[cat_id]['max'] += 1  # Count this question toward the max

        # ── STEP 2: Determine if the answer is correct ────────────────────────
        is_correct = False

        if question.question_type in ('mcq', 'truefalse'):
            # ── MCQ / True-False Grading ──────────────────────────────────────
            # The student selected a choice (by ID). We look up that choice
            # and check its is_correct flag (stored in the database).
            # This is straightforward — no NLP needed here.
            choice_id = ans.get('selected_choice_id')
            if choice_id:
                try:
                    choice = AnswerChoice.objects.get(id=choice_id, question=question)
                    is_correct = choice.is_correct
                    # Save the student's selected choice to ResponseAnswer
                    ResponseAnswer.objects.update_or_create(
                        response=student_response,
                        question=question,
                        defaults={'selected_choice': choice, 'text_answer': ''},
                    )
                except AnswerChoice.DoesNotExist:
                    pass

        elif question.question_type == 'identification':
            # ── Identification Grading (NLP: Text Normalization) ──────────────
            # The student typed a free-text answer. We apply NLP preprocessing:
            #   Step 1 — .strip()  : removes spaces at the edges of the string
            #   Step 2 — .lower()  : converts all characters to lowercase
            # This ensures "Central Processing Unit" == "central processing unit"
            # The correct answer is stored in the DB as ONE AnswerChoice row
            # where is_correct=True.
            raw_answer = ans.get('text_answer', '').strip().lower()
            try:
                correct = AnswerChoice.objects.get(question=question, is_correct=True)
                # Apply the same normalization to the stored correct answer
                is_correct = raw_answer == correct.choice_text.strip().lower()
            except AnswerChoice.DoesNotExist:
                is_correct = False
            # Save the student's raw text answer to ResponseAnswer
            ResponseAnswer.objects.update_or_create(
                response=student_response,
                question=question,
                defaults={'selected_choice': None, 'text_answer': ans.get('text_answer', '')},
            )

        # Increment the raw score if the answer was correct
        if is_correct:
            tally[cat_id]['raw'] += 1

    # ── STEP 3: Write SkillScore records to the database ─────────────────────
    # For each skill category, compute the percentage score and save it.
    # Formula: percentage = (correct answers / total questions) × 100
    # Example: 7 correct out of 10 questions = 70.00%
    #
    # These SkillScore rows are the student's COMPETENCY PROFILE —
    # the output of the assessment that drives the recommendation engine.
    results = {}
    for cat_id, scores in tally.items():
        pct = round(scores['raw'] / scores['max'] * 100, 2) if scores['max'] > 0 else 0.0
        SkillScore.objects.update_or_create(
            student=student_response.student,
            assessment=student_response.assessment,
            skill_category_id=cat_id,
            defaults={
                'raw_score': scores['raw'],
                'max_score': scores['max'],
                'percentage': pct,
            }
        )
        try:
            from .models import SkillCategory
            cat = SkillCategory.objects.get(id=cat_id)
            results[cat.name] = {'raw': scores['raw'], 'max': scores['max'], 'pct': pct}
        except Exception:
            pass

    return results


# ══════════════════════════════════════════════════════════════════════════════
# FUNCTION 2: build_skill_vector()
# ══════════════════════════════════════════════════════════════════════════════

def build_skill_vector(student, assessment, categories):
    """
    WHAT THIS DOES:
    ───────────────
    Converts a student's SkillScore records into a single numerical vector
    (a list of numbers between 0 and 1).

    This is an NLP/ML concept called FEATURE EXTRACTION — turning real-world
    data (skill scores) into a mathematical format that an algorithm can
    process and compare.

    NLP TECHNIQUE USED — Vector Representation / Feature Extraction:
    ────────────────────────────────────────────────────────────────
    In NLP and machine learning, data must be converted into numbers before
    any algorithm can work with it. Here, each skill category becomes one
    "dimension" (one position) in the vector.

    EXAMPLE:
    Suppose there are 4 skill categories in this order:
      [Web Development, Database, Networking, Programming]

    If a student scored:
      - Web Development : 82%
      - Database        : 55%
      - Networking      : 30%
      - Programming     : 70%

    Then their skill vector is:
      student_vec = [0.82, 0.55, 0.30, 0.70]
                     ↑ normalized to 0–1 by dividing by 100

    WHY NORMALIZE TO 0–1?
    Cosine similarity works with any scale, but normalizing to [0, 1] keeps
    the values consistent and makes the match_score output intuitive (0–100%).

    The ORDER of categories in the vector must be IDENTICAL for both the
    student vector and the position vector (see generate_recommendations).
    This shared ordering is what makes the comparison meaningful.

    PARAMETERS:
    ───────────
    student    : The User object (student)
    assessment : The Assessment object
    categories : Ordered list/queryset of SkillCategory objects
                 (MUST be the same order used when building position vectors)

    RETURNS:
    ────────
    A numpy array of shape (len(categories),) with values between 0.0 and 1.0
    Example: array([0.82, 0.55, 0.30, 0.70])
    """
    from .models import SkillScore

    # Fetch all SkillScore records for this student + assessment from the DB
    # Build a lookup dict: { skill_category_id → percentage }
    scores = {
        ss.skill_category_id: ss.percentage
        for ss in SkillScore.objects.filter(student=student, assessment=assessment)
    }

    # Build the vector by iterating over ALL categories in a fixed order.
    # If the student has no score for a category, default to 0.0 (absent skill).
    # Divide by 100 to normalize from percentage (0–100) to proportion (0–1).
    vector = np.array([
        scores.get(cat.id, 0.0) / 100.0
        for cat in categories
    ], dtype=float)

    return vector


# ══════════════════════════════════════════════════════════════════════════════
# FUNCTION 3: generate_recommendations()
# ══════════════════════════════════════════════════════════════════════════════

def generate_recommendations(student, assessment, categories):
    """
    WHAT THIS DOES:
    ───────────────
    This is the CORE RECOMMENDATION ENGINE of SkillBridge.

    It compares the student's skill profile (a vector of their assessment
    scores) against every company position's skill requirements (also a vector)
    and computes a match score for each position. The results are ranked highest
    to lowest and stored in the Recommendation table.

    ALGORITHM USED — Cosine Similarity:
    ────────────────────────────────────
    Cosine similarity is a mathematical method from NLP and information
    retrieval used to measure how similar two vectors are, regardless of
    their magnitude (size).

    INTUITION:
    Imagine each vector as an arrow pointing in a direction in multi-dimensional
    space (one dimension per skill category). Cosine similarity measures the
    ANGLE between the two arrows:
      - Angle = 0°  → cos(0°) = 1.0 → PERFECT MATCH (100%)
      - Angle = 90° → cos(90°) = 0.0 → NO MATCH (0%)

    This is especially useful because it focuses on the PATTERN of skills,
    not just raw numbers:
    - A student with [0.80, 0.60, 0.70] matches well with a position
      requiring [0.80, 0.60, 0.70] — high similarity.
    - A student with [0.80, 0.10, 0.10] matches poorly with a position
      requiring [0.10, 0.80, 0.80] — different skill pattern, low similarity.

    STEP-BY-STEP PROCESS:
    ─────────────────────
    1. Call build_skill_vector() → get the student's skill vector
       Example: student_vec = [0.82, 0.55, 0.30, 0.70]

    2. For each Position in the database that has requirements defined:
         a. Build the position's requirement vector using the same category order
            Example: pos_vec = [0.80, 0.60, 0.20, 0.70]
         b. Compute:
               score = cosine_similarity(student_vec, pos_vec)
               # Returns a value between 0.0 and 1.0
         c. Multiply by 100 to convert to percentage (e.g., 0.96 → 96%)

    3. Save each match score to the Recommendation table in the database.

    4. Sort all results from highest to lowest match score.

    5. Return the sorted list — students see the best-matching companies first.

    WHY COSINE SIMILARITY AND NOT OTHER ALGORITHMS?
    ────────────────────────────────────────────────
    - It is mathematically simple and results are easy to explain to a panel.
    - It is widely used in document similarity, search engines, and
      recommendation systems (Netflix, Spotify, etc. use similar approaches).
    - It does NOT require training data — it works directly on the vectors.
    - It handles sparse vectors well (when a student has 0 in some categories).
    - Provided by scikit-learn, a trusted, industry-standard Python library.

    PARAMETERS:
    ───────────
    student    : The User object (student)
    assessment : The Assessment object
    categories : Ordered queryset of SkillCategory objects
                 (same ordering used in build_skill_vector and position vectors)

    RETURNS:
    ────────
    A list of dicts sorted by match_score descending:
    [
      { 'position_title': 'Web Developer', 'company_name': 'XYZ Corp',
        'match_score': 96.5, 'tags': ['Web Development', 'Programming'], ... },
      ...
    ]
    """
    from .models import Position, PositionRequirement, Recommendation

    # ── STEP 1: Build the student's skill vector ──────────────────────────────
    student_vec = build_skill_vector(student, assessment, categories)

    # Safety check: if the student has no scores yet (all zeros), skip.
    # A zero vector has no direction, so cosine similarity is undefined.
    if student_vec.sum() == 0:
        return []

    # ── STEP 2: Iterate over all Positions and compute match scores ───────────
    positions = Position.objects.prefetch_related('requirements', 'company').all()
    results = []

    for position in positions:
        # Build a lookup for this position's requirements:
        # { skill_category_id → required_percentage (normalized 0–1) }
        reqs = {r.skill_category_id: r.required_percentage / 100.0
                for r in position.requirements.all()}

        # Skip positions with no requirements defined — we can't compare
        # against an empty requirement set (no direction = no angle)
        if not reqs:
            continue

        # ── STEP 3: Build the position requirement vector ─────────────────────
        # Build the vector using the SAME category ordering as the student vector.
        # If the position doesn't require a particular skill, that dimension = 0.
        # Example: pos_vec = [0.80, 0.60, 0.00, 0.70]
        #                      ^ Web Dev  ^ DB  ^ No networking req  ^ Programming
        pos_vec = np.array([
            reqs.get(cat.id, 0.0) for cat in categories
        ], dtype=float)

        # Safety check: skip if position vector is all zeros (no requirements set)
        if pos_vec.sum() == 0:
            continue

        # ── STEP 4: Compute Cosine Similarity ─────────────────────────────────
        # .reshape(1, -1) converts the 1D array into a 2D row matrix,
        # which is the format scikit-learn's cosine_similarity expects.
        # Result is a 2D array [[score]]; we extract the scalar with [0][0].
        # score is between 0.0 (no match) and 1.0 (perfect match).
        score = float(cosine_similarity(
            student_vec.reshape(1, -1),   # shape: (1, n_categories)
            pos_vec.reshape(1, -1)        # shape: (1, n_categories)
        )[0][0])

        # ── STEP 5: Save the recommendation to the database ───────────────────
        # update_or_create means: if a recommendation already exists for this
        # student + position, UPDATE it. Otherwise, CREATE a new one.
        # match_score is stored as a percentage (0–100).
        Recommendation.objects.update_or_create(
            student=student,
            position=position,
            defaults={
                'match_score': round(score * 100, 2),  # e.g., 0.965 → 96.5
                'generated_at': timezone.now(),
            }
        )

        # ── STEP 6: Append result for return value ────────────────────────────
        results.append({
            'position_id':    position.id,
            'position_title': position.title,
            'company_id':     position.company.id,
            'company_name':   position.company.name,
            'company':        position.company.name,
            'position':       position.title,
            'slots':          position.slots_available,
            'match_score':    round(score * 100, 2),
            'lat':            position.company.location_lat,
            'lng':            position.company.location_lng,
            'address': ', '.join(filter(None, [
                (position.company.address or {}).get('barangay', ''),
                (position.company.address or {}).get('city', ''),
                (position.company.address or {}).get('province', ''),
            ])) or None,
            # skill tags: names of all the skill categories this position requires
            'tags': [req.skill_category.name for req in position.requirements.select_related('skill_category').all()],
        })

    # ── STEP 7: Sort results by match_score, highest first ────────────────────
    # This is the "ranked" part of "ranked recommendations" — the company
    # that best matches the student's skills appears at the top of the list.
    results.sort(key=lambda x: x['match_score'], reverse=True)
    return results


# ══════════════════════════════════════════════════════════════════════════════
# FUNCTION 4: suggest_category()
# ══════════════════════════════════════════════════════════════════════════════

def suggest_category(question_text, categories):
    """
    WHAT THIS DOES:
    ───────────────
    When an instructor is creating questions in the assessment builder and
    types a question (e.g., "What is the purpose of a primary key in SQL?"),
    this function automatically suggests which skill category that question
    belongs to (e.g., "Database Management").

    This helps instructors tag their questions quickly and consistently.

    NLP TECHNIQUE USED — TF-IDF + Cosine Similarity:
    ──────────────────────────────────────────────────
    TF-IDF stands for Term Frequency–Inverse Document Frequency. It is one of
    the most classic and widely-used techniques in Natural Language Processing.

    HOW TF-IDF WORKS:
      - TF (Term Frequency): How often does a word appear in a document?
        More frequent = more important to that document.
      - IDF (Inverse Document Frequency): How rare is the word across ALL
        documents? Rare words are more distinguishing; common words (like
        "the", "is") get penalized.
      - TF-IDF score = TF × IDF

    IN THIS CONTEXT:
      - Each skill category name (e.g., "Web Development", "Database") is
        treated as a short "document".
      - The question text is also treated as a document.
      - TfidfVectorizer converts ALL of these into numerical vectors based
        on the words they contain.
      - Then we use cosine_similarity to find which category name is most
        textually similar to the question text.

    STEP-BY-STEP EXAMPLE:
    ──────────────────────
    Categories: ["Web Development", "Database Management", "Networking"]
    Question  : "What is the purpose of a primary key in SQL?"

    1. Build corpus (combined text list):
       corpus = ["Web Development", "Database Management", "Networking",
                 "What is the purpose of a primary key in SQL?"]

    2. TfidfVectorizer converts each item into a vector of word weights.
       "primary", "key", "SQL" appear only in the question and are close to
       "Database" — so the question vector is most similar to "Database Management".

    3. Cosine similarity picks "Database Management" → returned as suggestion.

    CONFIDENCE THRESHOLD:
    ─────────────────────
    If the best similarity score is below 0.05 (5%), we return None instead
    of a low-confidence guess. This prevents the system from suggesting
    irrelevant categories when the question text has no clear keyword overlap.

    PARAMETERS:
    ───────────
    question_text : The text of the new question being written by the instructor
    categories    : QuerySet of all SkillCategory objects

    RETURNS:
    ────────
    The name of the best-matching category (str), or None if confidence is low.
    Example: "Database Management"
    """
    if not categories:
        return None

    from sklearn.feature_extraction.text import TfidfVectorizer

    # Extract just the names of all skill categories
    # These are treated as short "documents" in TF-IDF
    category_names = [cat.name for cat in categories]

    # ── STEP 1: Build the corpus ───────────────────────────────────────────────
    # The corpus is the full collection of "documents" TF-IDF will analyze.
    # We put the question as the LAST item so we can reference it easily.
    # corpus = [cat1_name, cat2_name, ..., catN_name, question_text]
    corpus = category_names + [question_text]

    try:
        # ── STEP 2: Apply TF-IDF Vectorization ────────────────────────────────
        # TfidfVectorizer converts all text in the corpus into a matrix of
        # TF-IDF scores. Each row = one document; each column = one word.
        # stop_words='english' removes common words like "the", "is", "of"
        # that carry no meaning for category matching.
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(corpus)
        # tfidf_matrix shape: (len(corpus), vocabulary_size)

        # ── STEP 3: Separate the question vector from the category vectors ─────
        # The last row of tfidf_matrix is the question's TF-IDF vector.
        # The earlier rows are the category name vectors.
        question_vec   = tfidf_matrix[-1]          # shape: (1, vocab_size)
        category_vecs  = tfidf_matrix[:-1]         # shape: (n_categories, vocab_size)

        # ── STEP 4: Compute Cosine Similarity ─────────────────────────────────
        # Compare the question vector against each category vector.
        # similarities is an array of scores, one per category.
        # Example: [0.12, 0.67, 0.03] → highest is index 1 → "Database Management"
        similarities = cosine_similarity(question_vec, category_vecs)[0]

        # ── STEP 5: Find the best matching category ────────────────────────────
        best_idx   = int(np.argmax(similarities))   # index of the highest score
        best_score = float(similarities[best_idx])  # the actual similarity score

        # ── STEP 6: Apply confidence threshold ────────────────────────────────
        # Only return a suggestion if the best score is above 0.05 (5%).
        # Below this threshold, the match is too weak to be useful.
        return category_names[best_idx] if best_score > 0.05 else None

    except Exception:
        # If anything goes wrong (e.g., vocabulary is empty), return None
        # so the instructor can still manually select a category.
        return None
