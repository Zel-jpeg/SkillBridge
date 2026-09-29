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
    scores = list(SkillScore.objects.filter(
        student=student, assessment_id__in=assessment_ids, max_score__gt=0,
        raw_score__lte=F('max_score'),
    ).select_related('skill_category').order_by('assessment_id', 'skill_category_id'))
    scored_ids = {score.assessment_id for score in scores}
    included_ids = [assessment_id for assessment_id in assessment_ids if assessment_id in scored_ids]
    return included_ids, [score for score in scores if score.assessment_id in scored_ids]


def combined_is_unlocked(student, batch, profile=None, progress=None, source_ids=None):
    progress = progress or required_progress(student, batch)
    if not (progress['has_required_assessments'] and progress['all_required_completed']):
        return False
    if batch.status != 'active':
        return False
    profile = profile or CombinedCompetencyProfile.objects.filter(student=student, batch=batch).first()
    if profile is None or not profile.is_finalized:
        return False
    if source_ids is None:
        source_ids, _ = eligible_evidence(student, batch)
    return profile.included_assessment_ids == source_ids


def recalculate_combined(student, batch):
    """Replace current batch totals from assessment rows, then rank if unlocked."""
    from .scoring import generate_combined_recommendations

    progress = required_progress(student, batch)
    included_ids, assessment_scores = eligible_evidence(student, batch)
    grouped = defaultdict(lambda: {'raw': 0, 'max': 0, 'source_ids': set(), 'category': None})
    for score in assessment_scores:
        row = grouped[score.skill_category_id]
        row['raw'] += score.raw_score
        row['max'] += score.max_score
        row['source_ids'].add(score.assessment_id)
        row['category'] = score.skill_category

    ready = progress['has_required_assessments'] and progress['all_required_completed'] and batch.status == 'active'

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
        requested_model = RecommendationConfiguration.get_active().active_model
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
            },
        )

    if not ready:
        Recommendation.objects.filter(student=student, batch=batch).update(is_current=False)
        return profile, progress, []

    categories = list(SkillCategory.objects.all().order_by('id'))
    recommendations = generate_combined_recommendations(
        student, batch, combined_scores, profile, categories,
    )
    profile.is_finalized = True
    profile.finalized_at = timezone.now()
    profile.model_used = recommendations[0]['model_used'] if recommendations else requested_model
    profile.save(update_fields=['is_finalized', 'finalized_at', 'model_used', 'generated_at'])
    return profile, progress, recommendations


def ensure_combined(student, batch):
    """One-student backfill/recovery for legacy data; stable reads do no scoring."""
    progress = required_progress(student, batch)
    profile = CombinedCompetencyProfile.objects.filter(student=student, batch=batch).first()
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
