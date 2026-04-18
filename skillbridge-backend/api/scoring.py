"""
api/scoring.py — SkillBridge NLP & Scoring Engine

Three NLP touchpoints:
  1. score_submission()        → auto-grade MCQ, True/False, Identification answers
  2. build_skill_vector()      → convert SkillScore rows to a normalized numpy array
  3. generate_recommendations() → cosine similarity matching (sklearn) → Recommendation table
  4. suggest_category()        → TF-IDF keyword match → suggest a SkillCategory for a question
"""

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from django.utils import timezone


# ── 1. Auto-scoring ──────────────────────────────────────────────────────────

def score_submission(student_response, answers_data, categories):
    """
    Grade all answers for a StudentResponse and write SkillScore rows.

    answers_data: list of dicts  [
        { 'question_id': 1, 'selected_choice_id': 5 },          # MCQ / True-False
        { 'question_id': 2, 'text_answer': 'Central Processing Unit' },  # Identification
    ]

    categories: queryset of all SkillCategory objects

    Returns: dict { category_name: { raw, max, pct } }
    """
    from .models import Question, AnswerChoice, ResponseAnswer, SkillScore

    # Group questions by category
    tally = {}  # { skill_category_id: { 'raw': int, 'max': int } }

    for ans in answers_data:
        try:
            question = Question.objects.select_related('skill_category').get(
                id=ans.get('question_id'),
                assessment=student_response.assessment
            )
        except Question.DoesNotExist:
            continue

        cat_id = question.skill_category_id
        if cat_id not in tally:
            tally[cat_id] = {'raw': 0, 'max': 0}
        tally[cat_id]['max'] += 1

        # ── Determine correctness ────────────────────────────────────────────
        is_correct = False

        if question.question_type in ('mcq', 'truefalse'):
            choice_id = ans.get('selected_choice_id')
            if choice_id:
                try:
                    choice = AnswerChoice.objects.get(id=choice_id, question=question)
                    is_correct = choice.is_correct
                    # Record the answer
                    ResponseAnswer.objects.update_or_create(
                        response=student_response,
                        question=question,
                        defaults={'selected_choice': choice, 'text_answer': ''},
                    )
                except AnswerChoice.DoesNotExist:
                    pass

        elif question.question_type == 'identification':
            raw_answer = ans.get('text_answer', '').strip().lower()
            # Correct answer stored as the single AnswerChoice with is_correct=True
            try:
                correct = AnswerChoice.objects.get(question=question, is_correct=True)
                is_correct = raw_answer == correct.choice_text.strip().lower()
            except AnswerChoice.DoesNotExist:
                is_correct = False
            # Record the text answer
            ResponseAnswer.objects.update_or_create(
                response=student_response,
                question=question,
                defaults={'selected_choice': None, 'text_answer': ans.get('text_answer', '')},
            )

        if is_correct:
            tally[cat_id]['raw'] += 1

    # ── Write SkillScore rows ────────────────────────────────────────────────
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


# ── 2. Build Skill Vector ────────────────────────────────────────────────────

def build_skill_vector(student, assessment, categories):
    """
    Build a numpy vector of skill percentages for a student.

    categories: ordered list/queryset of SkillCategory objects
                (defines the dimension ordering — must match position vectors)

    Returns: numpy array shape (len(categories),)
    """
    from .models import SkillScore

    scores = {
        ss.skill_category_id: ss.percentage
        for ss in SkillScore.objects.filter(student=student, assessment=assessment)
    }

    vector = np.array([
        scores.get(cat.id, 0.0) / 100.0   # normalise to [0, 1]
        for cat in categories
    ], dtype=float)

    return vector


# ── 3. Cosine Similarity Recommendation ─────────────────────────────────────

def generate_recommendations(student, assessment, categories):
    """
    NLP Touchpoint 2: Cosine Similarity Matching

    For each Position that has requirements:
      1. Build position requirement vector (using same category order)
      2. Compute cosine_similarity(student_vector, position_vector)
      3. Store in Recommendation table

    Returns: list of { position, company, match_score } sorted desc.
    """
    from .models import Position, PositionRequirement, Recommendation

    student_vec = build_skill_vector(student, assessment, categories)

    # If student has no scores yet, skip
    if student_vec.sum() == 0:
        return []

    positions = Position.objects.prefetch_related('requirements', 'company').all()
    results = []

    for position in positions:
        reqs = {r.skill_category_id: r.required_percentage / 100.0
                for r in position.requirements.all()}

        if not reqs:
            continue  # Skip positions with no requirements set

        pos_vec = np.array([
            reqs.get(cat.id, 0.0) for cat in categories
        ], dtype=float)

        # Avoid div-by-zero on zero vectors
        if pos_vec.sum() == 0:
            continue

        score = float(cosine_similarity(
            student_vec.reshape(1, -1),
            pos_vec.reshape(1, -1)
        )[0][0])

        # Write / update recommendation row
        Recommendation.objects.update_or_create(
            student=student,
            position=position,
            defaults={
                'match_score': round(score * 100, 2),
                'generated_at': timezone.now(),
            }
        )

        results.append({
            'position_id':    position.id,
            'position_title': position.title,
            'company_id':     position.company.id,
            'company_name':   position.company.name,
            'slots':          position.slots_available,
            'match_score':    round(score * 100, 2),
        })

    results.sort(key=lambda x: x['match_score'], reverse=True)
    return results


# ── 4. Category Suggestion (TF-IDF) ─────────────────────────────────────────

def suggest_category(question_text, categories):
    """
    NLP Touchpoint 1: TF-IDF keyword matching

    Given the text of a question and a list of SkillCategory objects,
    returns the best-matching category name (or None if confidence is low).

    Used in the frontend preview step: system suggests category → instructor confirms.
    """
    if not categories:
        return None

    from sklearn.feature_extraction.text import TfidfVectorizer

    category_names = [cat.name for cat in categories]

    # Build corpus: each category name is treated as a "document"
    corpus = category_names + [question_text]

    try:
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(corpus)

        # Query vector = last item in corpus
        question_vec = tfidf_matrix[-1]
        category_vecs = tfidf_matrix[:-1]

        similarities = cosine_similarity(question_vec, category_vecs)[0]
        best_idx = int(np.argmax(similarities))
        best_score = float(similarities[best_idx])

        # Only suggest if reasonably confident
        return category_names[best_idx] if best_score > 0.05 else None

    except Exception:
        return None
