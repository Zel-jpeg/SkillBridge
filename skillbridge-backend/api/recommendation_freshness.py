"""Read-only provenance checks; never regenerate recommendations during a check."""
import hashlib
import json

from .models import Position, PositionRequirement, RecommendationConfiguration, SkillCategory
from .recommendation_nlp import TEXT_GENERATION_VERSION, extract_coordinates


def _digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), default=str).encode()).hexdigest()


def catalog_fingerprint():
    """Include the entire TF-IDF candidate corpus, not just the selected position.

    Capacity and branding images do not affect scores. Description-only taxonomy
    changes are authoring hints and are likewise outside the matching inputs.
    Bulk callers share this value only within their current read operation.
    """
    positions = list(Position.objects.filter(requirements__isnull=False, archived_at__isnull=True,
                                            company__archived_at__isnull=True).order_by('id').values(
        'id', 'title', 'tags', 'company_id', 'company__name',
        'company__location_lat', 'company__location_lng',
    ).distinct())
    requirements = list(PositionRequirement.objects.filter(position_id__in=[p['id'] for p in positions])
                        .order_by('position_id', 'id').values('position_id', 'skill_category_id', 'required_percentage'))
    categories = list(SkillCategory.objects.order_by('id').values('id', 'name', 'tags'))
    model = RecommendationConfiguration.objects.filter(pk=1).values_list('active_model', flat=True).first() or 'spacy_md'
    return _digest({'version': 'ranking-inputs-v1', 'text_version': TEXT_GENERATION_VERSION,
                    'positions': positions, 'requirements': requirements, 'categories': categories, 'model': model})


def input_fingerprint(student, catalog=None):
    return _digest({'catalog': catalog if catalog is not None else catalog_fingerprint(),
                    'student_coordinates': extract_coordinates(student.address)})


def recommendations_stale(profile, student, catalog=None):
    return bool(profile and profile.is_finalized and (
        not profile.ranking_input_fingerprint or
        profile.ranking_input_fingerprint != input_fingerprint(student, catalog)))
