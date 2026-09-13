import secrets


def build_question_layout(assessment):
    """Create an opaque, correctness-free layout for one student attempt."""
    rng = secrets.SystemRandom()
    questions = list(
        assessment.questions.prefetch_related('choices').order_by('question_order', 'id')
    )

    question_ids = [question.id for question in questions]
    rng.shuffle(question_ids)

    mcq_choice_ids = {}
    for question in questions:
        if question.question_type != 'mcq':
            continue
        choice_ids = list(question.choices.order_by('id').values_list('id', flat=True))
        rng.shuffle(choice_ids)
        mcq_choice_ids[str(question.id)] = choice_ids

    return {
        'version': 1,
        'question_ids': question_ids,
        'mcq_choice_ids': mcq_choice_ids,
    }


def ordered_questions(assessment, layout):
    """Return assessment questions in the stored order, safely handling edits."""
    questions = list(
        assessment.questions.select_related('skill_category')
        .prefetch_related('choices')
        .order_by('question_order', 'id')
    )
    by_id = {question.id: question for question in questions}

    ordered = []
    seen = set()
    for question_id in (layout or {}).get('question_ids', []):
        try:
            question_id = int(question_id)
        except (TypeError, ValueError):
            continue
        question = by_id.get(question_id)
        if question is not None and question_id not in seen:
            ordered.append(question)
            seen.add(question_id)

    # A question added after an attempt began is appended rather than making the
    # stored portion of that student's layout jump around.
    ordered.extend(question for question in questions if question.id not in seen)
    return ordered


def ordered_choices(question, layout):
    """Shuffle MCQ choices only; keep True/False in the required fixed order."""
    if question.question_type == 'identification':
        return []

    choices = list(question.choices.all())
    if question.question_type == 'truefalse':
        rank = {'true': 0, 'false': 1}
        return sorted(
            choices,
            key=lambda choice: (rank.get(choice.choice_text.strip().casefold(), 2), choice.id),
        )

    by_id = {choice.id: choice for choice in choices}
    stored_ids = (layout or {}).get('mcq_choice_ids', {}).get(str(question.id), [])
    ordered = []
    seen = set()
    for choice_id in stored_ids:
        try:
            choice_id = int(choice_id)
        except (TypeError, ValueError):
            continue
        choice = by_id.get(choice_id)
        if choice is not None and choice_id not in seen:
            ordered.append(choice)
            seen.add(choice_id)

    ordered.extend(sorted(
        (choice for choice in choices if choice.id not in seen),
        key=lambda choice: choice.id,
    ))
    return ordered
