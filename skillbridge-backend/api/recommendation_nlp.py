"""NLP, tag suggestion, rich-text, and location helpers for recommendations.

All language models are loaded lazily and cached for the life of the process.
No model/resource download is attempted at runtime. If an optional model is not
installed, deterministic regex preprocessing keeps recommendations available.
"""

from __future__ import annotations

import math
import importlib.util
import os
import re
from functools import lru_cache
from pathlib import Path


MODEL_OPTIONS = {
    'spacy_sm': {
        'label': 'spaCy Small',
        'package': 'en_core_web_sm',
    },
    'spacy_md': {
        'label': 'spaCy Medium',
        'package': 'en_core_web_md',
    },
    'stanza_en': {
        'label': 'Stanza English',
        'package': 'stanza English resources',
    },
}

from .skill_taxonomy import (
    SKILL_TAGS as DEFAULT_SKILL_TAGS, ROLE_TAGS as POSITION_TAGS,
    canonical_category, is_generic_tag, key as taxonomy_key,
)
from collections import Counter

TEXT_GENERATION_VERSION = 'neutral-evidence-v2'

ORIENTATION_GROUPS = [
    ('Backend and data-oriented', {'programming', 'backend', 'database', 'sql', 'python', 'java', 'django', 'api'}),
    ('Web and interface-oriented', {'web', 'frontend', 'design', 'html', 'css', 'javascript', 'react', 'ui', 'ux'}),
    ('Network and infrastructure-oriented', {'network', 'routing', 'switching', 'tcp', 'lan', 'wan', 'infrastructure', 'cisco'}),
    ('Cybersecurity-oriented', {'security', 'cybersecurity', 'encryption', 'owasp', 'firewall', 'authentication'}),
    ('IT support and operations-oriented', {'support', 'helpdesk', 'hardware', 'troubleshooting', 'maintenance', 'operations'}),
    ('Data and analytics-oriented', {'analytics', 'analysis', 'statistics', 'visualization', 'reporting', 'data'}),
]

STOP_WORDS = {
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is',
    'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'with', 'intern', 'internship',
}


def normalize_tags(value, limit=30):
    """Return a stable, de-duplicated list from either a list or CSV string."""
    if value is None:
        return []
    values = re.split(r'[,\n;]+', value) if isinstance(value, str) else value
    if not isinstance(values, (list, tuple)):
        return []
    result = []
    seen = set()
    for item in values:
        tag = re.sub(r'\s+', ' ', str(item)).strip()
        key = tag.casefold()
        if tag and key not in seen:
            result.append(tag[:80])
            seen.add(key)
        if len(result) >= limit:
            break
    return result


def suggest_skill_tags(name, description=''):
    canonical = canonical_category(name)
    if canonical in DEFAULT_SKILL_TAGS:
        return list(DEFAULT_SKILL_TAGS[canonical])
    # Unknown categories use description evidence, not fragments of the name.
    phrases = re.split(r'[,;\n]+', str(description or ''))
    return normalize_tags([phrase.strip() for phrase in phrases
                           if 1 <= len(phrase.split()) <= 4 and
                           not is_generic_tag(phrase, name)], limit=12)


def suggest_position_tags(title, requirements=None):
    normalized = taxonomy_key(title)
    normalized = normalized.replace('back end', 'backend').replace('front end', 'frontend')
    normalized = normalized.replace('quality assurance', 'qa tester')
    role_tags = []
    for role, tags in POSITION_TAGS.items():
        if taxonomy_key(role) in normalized:
            role_tags.extend(tags)
    if role_tags:
        return normalize_tags(role_tags, limit=16)
    # Unknown roles: a few tags from the strongest requirements, never all of
    # every category. Admins review these suggestions before persisting them.
    if isinstance(requirements, dict):
        requirements = [{'name': name, 'percentage': value} for name, value in requirements.items()]
    def percentage(item):
        try:
            return float(item.get('percentage', item.get('required_percentage', 0)) or 0)
        except (ValueError, TypeError):
            return 0
    suggestions = []
    for item in sorted(requirements or [], key=percentage, reverse=True)[:2]:
        if percentage(item) <= 0:
            continue
        name = item.get('name') or item.get('category') or ''
        tags = item.get('tags') or suggest_skill_tags(name)
        suggestions.extend([t for t in normalize_tags(tags) if not is_generic_tag(t, name)][:4])
    return normalize_tags(suggestions, limit=12)


def competency_label(score):
    if score >= 90:
        return 'excellent'
    if score >= 80:
        return 'strong'
    if score >= 70:
        return 'proficient'
    if score >= 60:
        return 'developing'
    return 'basic'


def score_weight(score):
    if score >= 90:
        return 6
    if score >= 80:
        return 5
    if score >= 70:
        return 4
    if score >= 60:
        return 2
    return 1


def _selected_tags(tags, score, category_name=''):
    # Zero scores are not positive evidence. Retain more distinct terms in
    # strong categories without inventing knowledge of unassessed subskills.
    count = 8 if score >= 80 else 5 if score >= 60 else 2 if score > 0 else 0
    return [tag for tag in normalize_tags(tags) if not is_generic_tag(tag, category_name)][:count]


def _evidence_parts(entries):
    """Symmetric category evidence for students and positions, no labels/roles.

    Shared tags are repeated less within this profile/requirement set. TF-IDF
    still supplies corpus-wide inverse-document frequency. Category tags are
    illustrative category vocabulary, not claims of separately tested skills.
    """
    entries = sorted(entries, key=lambda pair: (-pair[1], canonical_category(pair[0].name)))
    selected = [(category, score, _selected_tags(category.tags, score, category.name)) for category, score in entries]
    frequency = Counter(taxonomy_key(tag) for _, _, tags in selected for tag in set(tags))
    fragments, evidence = [], []
    for category, score, tags in selected:
        name = canonical_category(category.name)
        band = competency_label(score)
        fragments.append(f'{band} {name} competency ({score:g} percent); category vocabulary: {", ".join(tags) or "no specific tags"}')
        if score <= 0:
            continue
        weight = score_weight(score)
        # Same skill + band phrase on both sides makes strengths comparable;
        # expected positions and archetype names are never inputs here.
        evidence.extend([f'{name} {band} competency'] * weight)
        for tag in tags:
            evidence.extend([f'{name} {tag}'] * max(1, weight // frequency[taxonomy_key(tag)]))
    return fragments, evidence


def build_student_profile(skill_scores):
    fragments, evidence = _evidence_parts([(s.skill_category, float(s.percentage)) for s in skill_scores])
    if not fragments:
        return 'No assessed competency evidence is available.'
    return f"The student demonstrates {'; '.join(fragments)}. Skill evidence: {' '.join(evidence)}."


def _category_terms(skill_score):
    category = skill_score.skill_category
    text = ' '.join([category.name] + normalize_tags(category.tags)).casefold()
    return set(re.findall(r'[a-z][a-z0-9+#.-]*', text))


def generate_competency_insights(skill_scores):
    """Create a neutral orientation and actionable advice from assessment evidence.

    The orientation never includes a company or exact position title, preventing
    the narrative from leaking the recommendation target into NLP similarity.
    """
    ranked = sorted(skill_scores, key=lambda score: score.percentage, reverse=True)
    if not ranked:
        return {
            'orientation_label': '',
            'orientation_summary': '',
            'competency_profile_text': 'No assessed competency evidence is available.',
            'development_suggestions': [],
            'supporting_categories': [],
        }

    group_scores = []
    for label, keywords in ORIENTATION_GROUPS:
        weighted_score = 0.0
        evidence_count = 0
        for skill_score in ranked:
            overlap = _category_terms(skill_score) & keywords
            if overlap:
                weighted_score += float(skill_score.percentage) * min(len(overlap), 3)
                evidence_count += 1
        group_scores.append((weighted_score, evidence_count, label))
    best_score, _evidence_count, orientation_label = max(group_scores)
    if best_score <= 0:
        names = [score.skill_category.name for score in ranked[:2]]
        orientation_label = f"{' and '.join(names)}-oriented competency profile"

    leaders = ranked[:2]
    leader_text = ' and '.join(
        f'{score.skill_category.name} ({round(score.percentage, 1)}%)'
        for score in leaders
    )
    orientation_summary = (
        f'Assessment evidence indicates a {orientation_label.lower()} competency pattern, '
        f'led by {leader_text}.'
    )

    development_suggestions = []
    for skill_score in sorted(ranked, key=lambda score: score.percentage)[:2]:
        category = skill_score.skill_category
        score = float(skill_score.percentage)
        if score >= 80:
            continue
        tags = normalize_tags(category.tags)[:4]
        focus = ', '.join(tags) if tags else category.name.lower()
        development_suggestions.append({
            'category': category.name,
            'percentage': round(score, 1),
            'competency_label': competency_label(score),
            'message': (
                f'{competency_label(score).capitalize()} competency. Strengthen {category.name.lower()} '
                f'through guided practice, review activities, and hands-on projects focused on {focus}.'
            ),
        })

    if not development_suggestions:
        development_suggestions.append({
            'category': leaders[0].skill_category.name,
            'percentage': round(float(leaders[0].percentage), 1),
            'competency_label': competency_label(float(leaders[0].percentage)),
            'message': 'Maintain this strong performance through increasingly complex practical projects and peer collaboration.',
        })

    return {
        'orientation_label': orientation_label,
        'orientation_summary': orientation_summary,
        'competency_profile_text': f'{orientation_summary} {build_student_profile(ranked)}',
        'development_suggestions': development_suggestions,
        'supporting_categories': [
            {
                'category': score.skill_category.name,
                'percentage': round(float(score.percentage), 1),
                'competency_label': competency_label(float(score.percentage)),
                'tags': normalize_tags(score.skill_category.tags)[:6],
            }
            for score in ranked
        ],
    }


def build_position_description(position):
    """Current saved requirements/tags, generated on demand without writes."""
    requirements = list(position.requirements.all())
    fragments, evidence = _evidence_parts([(r.skill_category, float(r.required_percentage)) for r in requirements])
    position_tags = [t for t in normalize_tags(position.tags) if not is_generic_tag(t)]
    # Role-specific tags remain visible but cannot overwhelm assessed skill
    # evidence with six repetitions of unassessed role vocabulary.
    role_evidence = [tag for tag in position_tags[:12] for _ in range(2)]
    return (
        f'{position.title} at {position.company.name}. Required skill percentages: '
        + '; '.join(f'{r.skill_category.name}: {float(r.required_percentage):g} percent' for r in requirements)
        + f". Competency requirements: {'; '.join(fragments) or 'not specified'}. "
        + f"Role-specific vocabulary: {', '.join(position_tags) or 'no saved role tags'}. "
        + f"Requirement evidence: {' '.join(evidence + role_evidence)}."
    )


def _simple_preprocess(texts):
    processed = []
    for text in texts:
        tokens = [
            token.casefold() for token in re.findall(r"[A-Za-z][A-Za-z0-9+#.-]*", text)
            if token.casefold() not in STOP_WORDS
        ]
        processed.append(' '.join(tokens))
    return processed


@lru_cache(maxsize=3)
def _load_model(model_id):
    if model_id in ('spacy_sm', 'spacy_md'):
        import spacy
        package = MODEL_OPTIONS[model_id]['package']
        return spacy.load(package, disable=['parser', 'ner'])
    if model_id == 'stanza_en':
        import stanza
        return stanza.Pipeline(
            'en', processors='tokenize,lemma', tokenize_no_ssplit=True,
            use_gpu=False, verbose=False, download_method=None,
        )
    raise ValueError(f'Unsupported NLP model: {model_id}')


def preprocess_texts(texts, model_id, *, allow_fallback=True):
    """Return processed text, actual model id, and an optional fallback reason.

    Evaluation passes allow_fallback=False so missing models cannot inherit
    another model's metrics. Existing production callers retain fallback.
    """
    try:
        model = _load_model(model_id)
        if model_id.startswith('spacy_'):
            output = []
            for doc in model.pipe(texts, batch_size=64):
                output.append(' '.join(
                    token.lemma_.casefold().strip()
                    for token in doc
                    if not token.is_stop and not token.is_punct and not token.is_space and token.lemma_.strip()
                ))
            return output, model_id, None

        output = []
        for text in texts:
            doc = model(text)
            tokens = []
            for sentence in doc.sentences:
                for word in sentence.words:
                    lemma = (word.lemma or word.text).casefold().strip()
                    if lemma and lemma.isalpha() and lemma not in STOP_WORDS:
                        tokens.append(lemma)
            output.append(' '.join(tokens))
        return output, model_id, None
    except Exception as exc:
        if not allow_fallback:
            raise
        if model_id != 'spacy_sm':
            processed, actual_model, nested_reason = preprocess_texts(texts, 'spacy_sm')
            reason = f'{model_id} unavailable: {exc}'
            if nested_reason:
                reason = f'{reason}; {nested_reason}'
            return processed, actual_model, reason
        return _simple_preprocess(texts), 'simple_fallback', f'spacy_sm unavailable: {exc}'


def model_status(model_id):
    if model_id in ('spacy_sm', 'spacy_md'):
        package = MODEL_OPTIONS[model_id]['package']
        available = importlib.util.find_spec('spacy') is not None and importlib.util.find_spec(package) is not None
        return {
            'available': available,
            'error': None if available else f'{package} is not installed.',
        }
    if model_id == 'stanza_en':
        resources_root = Path(os.environ.get('STANZA_RESOURCES_DIR', Path.home() / 'stanza_resources'))
        available = importlib.util.find_spec('stanza') is not None and (resources_root / 'en').exists()
        return {
            'available': available,
            'error': None if available else 'Stanza or its English resources are not installed.',
        }
    return {'available': False, 'error': 'Unsupported NLP model.'}


def extract_coordinates(address):
    """Read the coordinate shapes currently used by SkillBridge profiles."""
    if not isinstance(address, dict):
        return None
    candidates = [
        (address.get('lat'), address.get('lng')),
        (address.get('latitude'), address.get('longitude')),
        (address.get('pinLat'), address.get('pinLng')),
    ]
    pin = address.get('pin')
    if isinstance(pin, dict):
        candidates.append((pin.get('lat'), pin.get('lng')))
    for lat, lng in candidates:
        try:
            if lat is not None and lng is not None:
                return float(lat), float(lng)
        except (TypeError, ValueError):
            continue
    return None


def haversine_distance_km(lat1, lng1, lat2, lng2):
    radius_km = 6371.0
    lat1_rad, lng1_rad, lat2_rad, lng2_rad = map(
        math.radians, (lat1, lng1, lat2, lng2)
    )
    delta_lat = lat2_rad - lat1_rad
    delta_lng = lng2_rad - lng1_rad
    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lng / 2) ** 2
    )
    return radius_km * 2 * math.asin(math.sqrt(a))


def location_similarity(student_address, company_lat, company_lng, max_distance_km=80.0):
    """Return (0..1 score, distance); missing coordinates use neutral 0.5."""
    student_coordinates = extract_coordinates(student_address)
    if student_coordinates is None or company_lat is None or company_lng is None:
        return 0.5, None
    try:
        student_lat, student_lng = student_coordinates
        distance = haversine_distance_km(
            float(student_lat), float(student_lng), float(company_lat), float(company_lng)
        )
    except (TypeError, ValueError):
        return 0.5, None
    return max(0.0, 1.0 - distance / max_distance_km), distance
