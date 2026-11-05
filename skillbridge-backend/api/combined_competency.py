"""Persist weighted batch competency evidence without changing SkillScore history."""

from collections import defaultdict

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .assessment_progress import required_progress
from .models import (
    Assessment, BatchEnrollment, CombinedCategoryScore, CombinedCompetencyProfile,
    Recommendation, RecommendationConfiguration, SkillCategory, SkillScore,
    StudentResponse,
)
from .recommendation_nlp import TEXT_GENERATION_VERSION, generate_competency_insights
from .recommendation_freshness import input_fingerprint, load_scoped_catalog, recommendations_stale


def compatible_scores(rows, batch):
    if not batch.program_id:
        return rows
    if not batch.framework_id:
        return rows.none()
    return rows.filter(assessment__framework_id=batch.framework_id, skill_category__framework_id=batch.framework_id,
                       skill_category__framework__program_id=batch.program_id)


def eligible_evidence(student, batch):
    """Final submitted evidence; closed history qualifies, drafts and stops do not."""
    responses = list(StudentResponse.objects.filter(
        student=student, assessment__batch=batch,
        assessment__include_in_competency=True,
        assessment__publication_status__in=[
            Assessment.PUBLICATION_PUBLISHED, Assessment.PUBLICATION_CLOSED,
        ],
        status=StudentResponse.STATUS_SUBMITTED,
        submitted_at__isnull=False,
        is_flagged=False,
    ).select_related('assessment').order_by('assessment_id'))
    assessment_ids = [response.assessment_id for response in responses]
    scores = list(compatible_scores(SkillScore.objects.filter(
        student=student, assessment_id__in=assessment_ids, max_score__gt=0,
        raw_score__lte=F('max_score'),
    ), batch).select_related('skill_category').order_by('assessment_id', 'skill_category_id'))
    scored_ids = {score.assessment_id for score in scores}
    included_ids = [assessment_id for assessment_id in assessment_ids if assessment_id in scored_ids]
    return included_ids, [score for score in scores if score.assessment_id in scored_ids]


_PROFILE_NOT_LOADED = object()


def combined_is_unlocked(student, batch, profile=_PROFILE_NOT_LOADED, progress=None, source_ids=None, catalog=None, review_required=None, *, require_current_ranking=True):
    if review_required is None:
        enrollment = BatchEnrollment.objects.filter(student=student, batch=batch)
        review_required = (enrollment.values_list('profile_review_required', flat=True).first() is not False
                           if batch.program_id else enrollment.filter(profile_review_required=True).exists())
    if review_required:
        return False
    progress = progress or required_progress(student, batch)
    if not (progress['has_required_assessments'] and progress['all_required_completed']):
        return False
    if batch.status != 'active':
        return False
    # Bulk callers pass None when their grouped read has already proved absence.
    if profile is _PROFILE_NOT_LOADED:
        profile = CombinedCompetencyProfile.objects.filter(student=student, batch=batch).first()
    if profile is None or not profile.is_finalized:
        return False
    if source_ids is None:
        source_ids, _ = eligible_evidence(student, batch)
    return profile.included_assessment_ids == source_ids and (
        not require_current_ranking or not recommendations_stale(profile, student, catalog, batch=batch))


def recalculate_combined(student, batch):
    """Replace current batch totals from assessment rows, then rank if unlocked."""
    if not batch.program_id:
        return _recalculate_combined(student, batch)
    with transaction.atomic():
        # Serializing on the enrollment keeps scoped profile and recommendation
        # writes together when result reads and explicit refreshes overlap.
        review_required = BatchEnrollment.objects.select_for_update().filter(
            student=student, batch=batch).values_list('profile_review_required', flat=True).first()
        return _recalculate_combined(student, batch, can_rank=review_required is False)


def _recalculate_combined(student, batch, *, can_rank=True):
    from .scoring import generate_combined_recommendations
    from .change_events import combined_changed

    progress = required_progress(student, batch)
    included_ids, assessment_scores = eligible_evidence(student, batch)
    grouped = defaultdict(lambda: {'raw': 0, 'max': 0, 'source_ids': set(), 'category': None})
    for score in assessment_scores:
        row = grouped[score.skill_category_id]
        row['raw'] += score.raw_score
        row['max'] += score.max_score
        row['source_ids'].add(score.assessment_id)
        row['category'] = score.skill_category

    ready = can_rank and progress['has_required_assessments'] and progress['all_required_completed'] and batch.status == 'active'
    catalog = load_scoped_catalog(batch) if ready and batch.program_id else None
    # Capture before ranking. A concurrent catalog change must not label a
    # ranking produced from earlier inputs as current.
    ranking_fingerprint = input_fingerprint(student, catalog.fingerprint if catalog else None) if ready else ''

    with transaction.atomic():
        CombinedCategoryScore.objects.filter(student=student, batch=batch).exclude(
            skill_category_id__in=grouped.keys(),
        ).delete()
        for category_id, row in grouped.items():
            CombinedCategoryScore.objects.update_or_create(
                student=student, batch=batch, skill_category_id=category_id,
                defaults={
                    'raw_score': row['raw'],
                    'max_score': row['max'],
                    'percentage': round(row['raw'] / row['max'] * 100, 2),
                    'source_assessment_ids': sorted(row['source_ids']),
                },
            )
        combined_scores = list(CombinedCategoryScore.objects.filter(
            student=student, batch=batch,
        ).select_related('skill_category').order_by('skill_category_id'))
        insights = generate_competency_insights(combined_scores) if ready else {}
        requested_model = catalog.requested_model if catalog else RecommendationConfiguration.get_active().active_model
        profile, _ = CombinedCompetencyProfile.objects.update_or_create(
            student=student, batch=batch,
            defaults={
                **insights,
                'included_assessment_ids': included_ids,
                'is_finalized': False,
                **({'finalized_at': None} if ready else {}),
                **({'text_generation_version': TEXT_GENERATION_VERSION} if ready else {}),
                'active_model': requested_model,
                'model_used': '',
                'ranking_input_fingerprint': '',
            },
        )

    if not ready:
        Recommendation.objects.filter(student=student, batch=batch).update(is_current=False)
        combined_changed(student, batch)
        return profile, progress, []

    categories = catalog.categories if catalog else list(SkillCategory.objects.filter(framework__isnull=True).order_by('id'))
    recommendations = generate_combined_recommendations(
        student, batch, combined_scores, profile, categories, scoped_catalog=catalog,
    )
    profile.is_finalized = True
    profile.finalized_at = timezone.now()
    # A configured model is not evidence it produced a recommendation result.
    profile.model_used = recommendations[0]['model_used'] if recommendations else ''
    profile.ranking_input_fingerprint = ranking_fingerprint
    profile.save(update_fields=['is_finalized', 'finalized_at', 'model_used', 'ranking_input_fingerprint', 'generated_at'])
    if recommendations_stale(profile, student, batch=batch):
        Recommendation.objects.filter(student=student, batch=batch).update(is_current=False)
        recommendations = []
    combined_changed(student, batch)
    return profile, progress, recommendations


def ensure_combined(student, batch):
    """One-student backfill/recovery for legacy data; stable reads do no scoring."""
    progress = required_progress(student, batch)
    profile = CombinedCompetencyProfile.objects.filter(student=student, batch=batch).first()
    if batch.program_id and not BatchEnrollment.objects.filter(student=student, batch=batch, profile_review_required=False).exists():
        return profile, progress, False
    included_ids, _ = eligible_evidence(student, batch)
    if progress['has_required_assessments'] and progress['all_required_completed'] and batch.status == 'active':
        if profile is None or not profile.is_finalized or profile.included_assessment_ids != included_ids:
            profile, progress, _ = recalculate_combined(student, batch)
    return profile, progress, combined_is_unlocked(
        student, batch, profile=profile, progress=progress, source_ids=included_ids,
    )


def recalculate_enrolled_students(batch):
    for enrollment in BatchEnrollment.objects.filter(batch=batch).select_related('student'):
        recalculate_combined(enrollment.student, batch)


def serialize_combined_scores(student, batch):
    return [{
        'category_id': score.skill_category_id,
        'category': score.skill_category.name,
        'raw_score': score.raw_score,
        'max_score': score.max_score,
        'percentage': score.percentage,
        'source_assessment_ids': score.source_assessment_ids,
    } for score in CombinedCategoryScore.objects.filter(
        student=student, batch=batch,
    ).select_related('skill_category').order_by('skill_category__name', 'skill_category_id')]
