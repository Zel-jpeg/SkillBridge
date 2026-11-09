"""Read-only provenance checks; never regenerate recommendations during a check."""
import hashlib
import json
from dataclasses import dataclass
from types import SimpleNamespace

from django.db.models import Prefetch

from .models import PositionRequirement, RecommendationConfiguration, SkillCategory
from .recommendation_nlp import (TEXT_GENERATION_VERSION, build_position_description, category_definition,
                                 extract_coordinates, position_role_context, valid_coordinates)
from .recommendation_policy import VERSION as RANKING_POLICY_VERSION
from .recommendation_matching import MATCHING_INPUT_VERSION
from .opportunity_scope import active_positions, for_programs, legacy_positions


def _digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), default=str).encode()).hexdigest()


@dataclass(frozen=True)
class ScopedRankingCatalog:
    scope: dict
    categories: list
    positions: list
    position_texts: list
    requested_model: str
    fingerprint: str


def load_scoped_catalog(batch):
    """Capture only the compatible corpus used for this batch's ranking."""
    framework = batch.framework
    framework = framework if framework and framework.program_id == batch.program_id else None
    categories, positions = [], []
    if framework:
        categories = list(SkillCategory.objects.filter(framework=framework).order_by('id'))
        category_ids = {category.id for category in categories}
        openings = for_programs(active_positions(), [batch.program_id]).filter(
            requirements__skill_category_id__in=category_ids, requirements__required_percentage__gt=0,
        ).distinct().order_by('id').select_related('company').prefetch_related(Prefetch('requirements',
            queryset=PositionRequirement.objects.select_related('skill_category').order_by('skill_category_id')))
        for position in openings:
            requirements = list(position.requirements.all())
            if requirements and all(row.skill_category_id in category_ids and 0 < row.required_percentage <= 100
                                    for row in requirements):
                positions.append(position)
    texts = [build_position_description(position) for position in positions]
    scope = {'program_id': batch.program_id, 'framework_id': framework.id if framework else None,
             'framework_version': framework.version if framework else None}
    model = RecommendationConfiguration.objects.filter(pk=1).values_list('active_model', flat=True).first() or 'spacy_md'
    fingerprint = _digest({'version': 'scoped-ranking-inputs-v1', 'scope': scope, 'model': model,
        'text_version': TEXT_GENERATION_VERSION,
        'matching_input_version': MATCHING_INPUT_VERSION,
        'categories': [(row.id, row.name, row.tags, category_definition(row)) for row in categories],
        'positions': [(position.id, position.company_id, text,
                       valid_coordinates(position.company.location_lat, position.company.location_lng),
                       [(row.skill_category_id, row.required_percentage) for row in position.requirements.all()])
                      for position, text in zip(positions, texts)],
    })
    return ScopedRankingCatalog(scope, categories, positions, texts, model, fingerprint)


def catalog_fingerprint(batch=None):
    """Include the entire TF-IDF candidate corpus, not just the selected position.

    Capacity and branding images do not affect scores. The bounded category
    definition now participates on both sides of the generated matching text.
    Bulk callers share this value only within their current read operation.
    """
    if batch and batch.program_id:
        return load_scoped_catalog(batch).fingerprint
    positions = list(legacy_positions().filter(requirements__isnull=False).order_by('id').values(
        'id', 'title', 'description', 'tags', 'company_id', 'company__name',
        'company__location_lat', 'company__location_lng',
    ).distinct())
    for position in positions:
        description = position_role_context(position.pop('description'))
        if description:
            position['description'] = description
    requirements = list(PositionRequirement.objects.filter(position_id__in=[p['id'] for p in positions])
                        .order_by('position_id', 'id').values('position_id', 'skill_category_id', 'required_percentage'))
    categories = list(SkillCategory.objects.filter(framework__isnull=True).order_by('id').values('id', 'name', 'tags', 'description'))
    for category in categories:
        category['description'] = category_definition(SimpleNamespace(description=category['description']))
    model = RecommendationConfiguration.objects.filter(pk=1).values_list('active_model', flat=True).first() or 'spacy_md'
    return _digest({'version': 'ranking-inputs-v1', 'text_version': TEXT_GENERATION_VERSION,
                    'matching_input_version': MATCHING_INPUT_VERSION,
                    'positions': positions, 'requirements': requirements, 'categories': categories, 'model': model})


def cached_catalog_fingerprint(batch, cache):
    """Reuse each catalog once per operation without sharing across programs."""
    key = (batch.program_id, batch.framework_id if batch.program_id else None)
    if key not in cache:
        cache[key] = catalog_fingerprint(batch) if batch.program_id else catalog_fingerprint()
    return cache[key]


def input_fingerprint(student, catalog=None, *, batch=None):
    return _digest({'ranking_policy': RANKING_POLICY_VERSION,
                    'catalog': catalog if catalog is not None else catalog_fingerprint(batch),
                    'student_coordinates': extract_coordinates(student.address)})


def recommendations_stale(profile, student, catalog=None, *, batch=None):
    if not profile or not profile.is_finalized:
        return False
    if catalog is None and batch is None:
        batch = profile.batch
    return profile.ranking_input_fingerprint != input_fingerprint(student, catalog, batch=batch)
