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

def validate_submission_answers(answers_data, questions):
    """Validate the complete payload before any writes, including cleared inputs.

    IDs must be positive JSON integers. Null choice IDs and empty text represent
    unanswered questions. Unknown questions/choices and duplicate question IDs
    are errors rather than silently discarded evidence.
    """
    from rest_framework.exceptions import ValidationError

    def invalid(index, message):
        raise ValidationError({'answers': f'Answer {index + 1}: {message}'})

    if not isinstance(answers_data, list):
        raise ValidationError({'answers': 'Must be a list.'})
    by_id = {question.id: question for question in questions}
    validated = {}
    for index, answer in enumerate(answers_data):
        if not isinstance(answer, dict):
            invalid(index, 'Must be an object.')
        question_id = answer.get('question_id')
        if type(question_id) is not int or question_id <= 0:
            invalid(index, 'question_id must be a positive integer.')
        if question_id not in by_id:
            invalid(index, 'Question does not belong to this assessment.')
        if question_id in validated:
            invalid(index, 'Duplicate question_id.')
        choice_id = answer.get('selected_choice_id')
        if choice_id is not None and (type(choice_id) is not int or choice_id <= 0):
            invalid(index, 'selected_choice_id must be a positive integer or null.')
        text_answer = answer.get('text_answer', '')
        if not isinstance(text_answer, str):
            invalid(index, 'text_answer must be a string.')
        question = by_id[question_id]
        choices = {choice.id: choice for choice in question.choices.all()}
        if choice_id is not None and (question.question_type == 'identification' or choice_id not in choices):
            invalid(index, 'Choice does not belong to this question or question type.')
        if question.question_type != 'identification' and text_answer.strip():
            invalid(index, 'Choice questions require a selected_choice_id, not text.')
        validated[question_id] = {'choice': choices.get(choice_id), 'text': text_answer}
    return validated


def score_submission(student_response, answers_data, categories):
    """Grade each authoritative question once; omissions contribute zero.

    Empty submissions are accepted as zero against all categorized questions.
    Persist only completed answers, preserving integrity-stop evidence semantics.
    Identification remains exact after trimming and lowercasing; NLP ranking
    does not influence grading. Existing finalized records are never backfilled.
    Callers hold the attempt lock and finalize only after this atomic write.
    """
    from django.db import transaction
    from .models import ResponseAnswer, SkillScore

    questions = list(student_response.assessment.questions.select_related(
        'skill_category',
    ).prefetch_related('choices'))
    answers = validate_submission_answers(answers_data, questions)
    tally = {}
    with transaction.atomic():
        completed_answers = []
        for question in questions:
            answer = answers.get(question.id, {'choice': None, 'text': ''})
            choice, text_answer = answer['choice'], answer['text']
            is_correct = False
            if question.question_type in ('mcq', 'truefalse'):
                if choice is not None:
                    is_correct = choice.is_correct
                    completed_answers.append(ResponseAnswer(
                        response=student_response, question=question,
                        selected_choice=choice, text_answer='',
                    ))
            elif question.question_type == 'identification' and text_answer.strip():
                correct = [choice for choice in question.choices.all() if choice.is_correct]
                is_correct = len(correct) == 1 and text_answer.strip().lower() == correct[0].choice_text.strip().lower()
                completed_answers.append(ResponseAnswer(
                    response=student_response, question=question,
                    selected_choice=None, text_answer=text_answer,
                ))

            if question.skill_category_id is not None:
                row = tally.setdefault(question.skill_category_id, {
                    'raw': 0, 'max': 0, 'name': question.skill_category.name,
                })
                row['max'] += 1
                row['raw'] += int(is_correct)

        # The caller locks the attempt. Fetch existing completed answers once,
        # then batch inserts/updates without changing IDs or omitted-answer
        # behavior. Per-answer get_or_create savepoints dominate concurrent
        # submissions; these rows have no save hooks or auto-updated fields.
        existing = {}
        if completed_answers:
            for saved in ResponseAnswer.objects.filter(
                response=student_response,
                question_id__in=[answer.question_id for answer in completed_answers],
            ):
                if saved.question_id in existing:
                    raise ResponseAnswer.MultipleObjectsReturned('Existing answers must be unique per question.')
                existing[saved.question_id] = saved
        creates, updates = [], []
        for answer in completed_answers:
            saved = existing.get(answer.question_id)
            if saved is None:
                creates.append(answer)
            else:
                saved.selected_choice_id = answer.selected_choice_id
                saved.text_answer = answer.text_answer
                updates.append(saved)
        if creates:
            ResponseAnswer.objects.bulk_create(creates)
        if updates:
            ResponseAnswer.objects.bulk_update(updates, ['selected_choice', 'text_answer'])

        results = {}
        for category_id, row in tally.items():
            percentage = round(row['raw'] / row['max'] * 100, 2)
            SkillScore.objects.update_or_create(
                student=student_response.student,
                assessment=student_response.assessment,
                skill_category_id=category_id,
                defaults={'raw_score': row['raw'], 'max_score': row['max'], 'percentage': percentage},
            )
            results[row['name']] = {'raw': row['raw'], 'max': row['max'], 'pct': percentage}
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
    """Generate explainable 60/25/15 hybrid recommendations.

    Category alignment uses cosine similarity over assessment percentages and
    position requirements. Rich profile/position text is preprocessed by the
    configured spaCy/Stanza model, then compared with TF-IDF cosine similarity.
    Location uses an 80 km linear decay; missing coordinates receive a neutral
    50% location score so unavailable data does not crash or dominate ranking.
    """
    from .models import (
        SkillScore, StudentCompetencyProfile,
    )
    from .recommendation_nlp import generate_competency_insights

    categories = list(categories)
    skill_scores = list(
        SkillScore.objects.filter(student=student, assessment=assessment)
        .select_related('skill_category')
    )
    insights = generate_competency_insights(skill_scores)
    StudentCompetencyProfile.objects.update_or_create(
        student=student,
        assessment=assessment,
        defaults=insights,
    )
    return _rank_recommendations(student, skill_scores, categories, insights, batch=None)


def update_assessment_profile(student, assessment):
    """Keep the existing assessment-level narrative independent of final scoring."""
    from .models import SkillScore, StudentCompetencyProfile
    from .recommendation_nlp import generate_competency_insights

    scores = list(SkillScore.objects.filter(
        student=student, assessment=assessment,
    ).select_related('skill_category'))
    profile, _ = StudentCompetencyProfile.objects.update_or_create(
        student=student, assessment=assessment,
        defaults=generate_competency_insights(scores),
    )
    return profile


def generate_combined_recommendations(student, batch, combined_scores, profile, categories):
    """Use persisted weighted category totals and combined text for one batch."""
    insights = {'competency_profile_text': profile.competency_profile_text}
    return _rank_recommendations(student, combined_scores, categories, insights, batch=batch)


def _rank_recommendations(student, skill_scores, categories, insights, batch):
    from django.db import transaction
    from sklearn.feature_extraction.text import TfidfVectorizer
    from .models import Position, Recommendation, RecommendationConfiguration
    from .recommendation_nlp import (build_position_description, location_similarity, preprocess_texts,
                                     company_address_text, valid_coordinates)

    categories = list(categories)
    score_lookup = {score.skill_category_id: score.percentage for score in skill_scores}
    student_vec = np.array([score_lookup.get(category.id, 0.0) / 100.0 for category in categories], dtype=float)

    if student_vec.sum() == 0:
        Recommendation.objects.filter(student=student, batch=batch).update(is_current=False)
        return []

    positions = list(
        Position.objects.filter(archived_at__isnull=True, company__archived_at__isnull=True).order_by('id').select_related('company').prefetch_related(
            'requirements', 'requirements__skill_category'
        )
    )
    positions = [position for position in positions if position.requirements.all()]
    if not positions:
        Recommendation.objects.filter(student=student, batch=batch).update(is_current=False)
        return []

    profile_text = insights['competency_profile_text']
    position_texts = [build_position_description(position) for position in positions]
    requested_model = RecommendationConfiguration.get_active().active_model
    processed, model_used, _fallback_reason = preprocess_texts(
        [profile_text] + position_texts,
        requested_model,
    )

    try:
        tfidf = TfidfVectorizer(ngram_range=(1, 3), min_df=1, sublinear_tf=True)
        matrix = tfidf.fit_transform(processed)
        nlp_scores = cosine_similarity(matrix[:1], matrix[1:])[0]
    except ValueError:
        # Empty vocabulary is possible when all text is stop words.
        nlp_scores = np.zeros(len(positions), dtype=float)

    results = []
    pending = []
    for index, position in enumerate(positions):
        reqs = {
            requirement.skill_category_id: requirement.required_percentage / 100.0
            for requirement in position.requirements.all()
        }
        pos_vec = np.array([reqs.get(category.id, 0.0) for category in categories], dtype=float)
        if pos_vec.sum() == 0:
            continue

        category_score = float(cosine_similarity(
            student_vec.reshape(1, -1), pos_vec.reshape(1, -1)
        )[0][0])
        nlp_score = float(nlp_scores[index])
        location_score, distance_km = location_similarity(
            student.address,
            position.company.location_lat,
            position.company.location_lng,
        )
        final_score = 0.60 * category_score + 0.25 * nlp_score + 0.15 * location_score

        component_values = {
            'is_current': True,
            'match_score': round(final_score * 100, 2),
            'category_score_component': round(category_score * 100, 2),
            'nlp_score_component': round(nlp_score * 100, 2),
            'location_score_component': round(location_score * 100, 2),
            'model_used': model_used,
            'distance_km': round(distance_km, 2) if distance_km is not None else None,
            'generated_at': timezone.now(),
        }
        pending.append((position, component_values))
        coordinates = valid_coordinates(position.company.location_lat, position.company.location_lng)
        results.append({
            'position_id': position.id,
            'position_title': position.title,
            'company_id': position.company.id,
            'company_name': position.company.name,
            'company': position.company.name,
            'position': position.title,
            'slots': position.slots_available,
            **component_values,
            'requested_model': requested_model,
            'lat': coordinates[0] if coordinates else None,
            'lng': coordinates[1] if coordinates else None,
            'address': company_address_text(position.company.address),
            'tags': list(dict.fromkeys(
                [requirement.skill_category.name for requirement in position.requirements.all()]
                + list(position.tags or [])
            )),
        })

    # A batch has a unique (student, batch, position) key. Update in place so
    # placement links keep the same recommendation IDs, without one savepoint
    # and round trip per candidate. Nullable legacy batches retain their old
    # lookup/ambiguity behavior because SQL NULL does not enforce that key.
    with transaction.atomic():
        Recommendation.objects.filter(student=student, batch=batch).update(is_current=False)
        if batch is not None and pending:
            Recommendation.objects.bulk_create(
                [Recommendation(student=student, batch=batch, position=position, **values)
                 for position, values in pending],
                update_conflicts=True,
                unique_fields=['student', 'batch', 'position'],
                update_fields=list(pending[0][1]),
            )
        else:
            for position, values in pending:
                Recommendation.objects.update_or_create(
                    student=student, batch=batch, position=position, defaults=values,
                )

    results.sort(key=lambda item: (-item['match_score'], item['position_id']))
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

    NLP TECHNIQUE USED — Keyword Match + TF-IDF:
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

    1. Option A (Keyword Match): Check if exact category names appear in the question.
       If yes, return it instantly.
    
    2. Build corpus (combined text list):
       corpus = ["Web Development", "Database Management", "Networking",
                 "What is the purpose of a primary key in SQL?"]

    3. TfidfVectorizer converts each item into a vector of word weights.
       "primary", "key", "SQL" appear only in the question and are close to
       "Database" — so the question vector is most similar to "Database Management".

    4. Cosine similarity picks "Database Management" → returned as suggestion.

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
    category_names = [cat.name for cat in categories]
    
    # ── DOMAIN KNOWLEDGE BASE ─────────────────────────────────────────────────
    # Preserve existing category keyword sets. Broader authoring vocabulary is
    # advisory only; it does not change answer grading or recommendation scoring.
    DOMAIN_KNOWLEDGE = {
        "database": "sql query relational nosql primary key foreign key join index table dbms mongodb mysql postgres oracle data",
        "database management": "sql query relational nosql primary key foreign key join index table dbms mongodb mysql postgres oracle data",
        "web development": "html css javascript frontend backend react angular vue nodejs dom hyperlink website web app browser",
        "networking": "tcp ip router switch subnet osi model protocol packet lan wan internet firewall routing port",
        "programming": "java python c++ c# syntax loop array variable function object oriented algorithm logic compile code",
        "cloud": "aws azure gcp google cloud serverless docker kubernetes virtual machine ec2 s3 compute storage vps",
        "operating systems": "linux windows macos kernel bash shell terminal thread process memory cpu os ubuntu file system",
        "devops": "ci cd pipeline jenkins gitlab github actions deployment automation ansible terraform infrastructure monitoring",
        "version control": "git github gitlab bitbucket commit merge branch pull request repository clone push repo",
        "computer hardware": "cpu ram motherboard gpu hard drive ssd power supply component architecture peripheral input output",
        "cybersecurity": "security hack threat vulnerability encryption firewall malware virus phishing attack defense authentication",
        "tools": "ide vscode visual studio figma trello jira slack postman api testing debugging",
    }
    
    # Extract names + descriptions + domain knowledge to give TF-IDF maximum vocabulary
    category_docs = []
    from .skill_taxonomy import SKILL_TAGS, suggestion_category
    for cat in categories:
        builtin_keywords = DOMAIN_KNOWLEDGE.get(cat.name.lower(), "")
        if not builtin_keywords:
            builtin_keywords = ' '.join(SKILL_TAGS.get(suggestion_category(cat.name), []))
        category_docs.append(f"{cat.name} {cat.description} {builtin_keywords}")

    # -- Option A: Simple Keyword Matching (Exact Substring) --
    question_lower = question_text.lower()
    import re
    mentions = [name for name in category_names
                if re.search(r'(?<!\w)' + re.escape(name.lower()) + r'(?!\w)', question_lower)]
    if mentions:
        return mentions[0] if len(mentions) == 1 else None

    # ── STEP 1: Build the corpus ───────────────────────────────────────────────
    # The corpus is the full collection of "documents" TF-IDF will analyze.
    # We put the question as the LAST item so we can reference it easily.
    corpus = category_docs + [question_text]

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
        # Equal evidence is ambiguous; category/query order must not select a winner.
        tied = np.count_nonzero(np.isclose(similarities, best_score, rtol=0, atol=1e-12)) > 1
        return category_names[best_idx] if best_score > 0.05 and not tied else None

    except Exception:
        # If anything goes wrong (e.g., vocabulary is empty), return None
        # so the instructor can still manually select a category.
        return None
