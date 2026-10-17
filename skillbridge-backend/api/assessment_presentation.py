"""Display-only summaries for CSV exports; never used by scoring or NLP.

Keep wording aligned with frontend assessmentSummary.js via shared fixtures.
"""
from decimal import Decimal, InvalidOperation


def score_percentage(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        number = Decimal(str(value))
        return number if number.is_finite() and 0 <= number <= 100 else None
    except (InvalidOperation, ValueError):
        return None


def category_percentage(value):
    number = score_percentage(value)
    if number is None:
        return 'Not available'
    text = format(number, 'f')
    if '.' in text:
        text = text.rstrip('0').rstrip('.')
    return f'{text}%'


def assessment_summary(scores=None, *, scope='combined', audience='staff', locked=False):
    if locked:
        return {'highestLabel': 'Results locked', 'highestNames': '',
                'summary': 'Combined assessment results are locked until current evidence is finalized.',
                'suggestions': [], 'leaders': []}
    rows = []
    for row in scores or []:
        percentage = score_percentage(row.get('percentage'))
        if row.get('max_score') is not None and Decimal(str(row['max_score'])) <= 0:
            percentage = None
        rows.append({'category': row.get('category') or (
            f"Category {row['category_id']}" if row.get('category_id') is not None else 'Unnamed category'),
            'percentage': percentage})
    assessed = [row for row in rows if row['percentage'] is not None]
    context = 'This individual assessment' if scope == 'individual' else 'Combined assessment results'
    if not assessed:
        return {'highestLabel': 'No assessed category scores', 'highestNames': '',
                'summary': f'{context}: no assessed category scores are available.', 'suggestions': [], 'leaders': []}
    maximum = max(row['percentage'] for row in assessed)
    leaders = [row for row in assessed if row['percentage'] == maximum]
    tied = len(leaders) > 1
    label = ('No assessed category scored above zero' if maximum == 0 else
             f"Highest-scoring area{'s' if tied else ''}: {'tied at ' if tied else ''}{category_percentage(maximum)}")
    names = ' · '.join(row['category'] for row in leaders)
    subject = 'you scored' if audience == 'student' else 'the student scored'
    if maximum == 0:
        summary = f'{context}: no assessed category scored above zero. ' + '; '.join(
            f"{row['category']}: 0%" for row in assessed) + '.'
    else:
        summary = (f"{context}: {subject} "
                   + (f'equally highest in these {len(leaders)} areas' if tied else 'highest in')
                   + f"{': ' if tied else ' '}{names} ({category_percentage(maximum)}{' each' if tied else ''}).")
    others = [row for row in assessed if row['percentage'] != maximum]
    if others:
        summary += ' Other assessed scores: ' + '; '.join(
            f"{row['category']}: {category_percentage(row['percentage'])}" for row in others) + '.'
    missing = [row for row in rows if row['percentage'] is None]
    if missing:
        summary += ' No assessed score available: ' + ' · '.join(row['category'] for row in missing) + '.'
    focus = [row for row in assessed if row['percentage'] < 80]
    suggestions = [{**row, 'message': (
        f"Continue guided practice and practical activities in {row['category'].lower()}." if focus else
        f"Continue developing {row['category'].lower()} through more complex practical projects and peer collaboration.")}
        for row in focus or assessed]
    return {'highestLabel': label, 'highestNames': names, 'summary': summary,
            'suggestions': suggestions, 'leaders': leaders}


def development_text(scores, *, locked=False):
    return '; '.join(f"{row['category']}: {category_percentage(row['percentage'])}: {row['message']}"
                     for row in assessment_summary(scores, locked=locked)['suggestions'])
