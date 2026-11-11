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
from collections import OrderedDict
from threading import RLock


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
    ROLE_ALIASES, BROAD_POSITION_CATEGORIES, canonical_category, suggestion_category, is_generic_tag, key as taxonomy_key,
)
from collections import Counter

TEXT_GENERATION_VERSION = 'general-category-context-v4'
DEFINITION_CHAR_LIMIT = 160
DEFINITION_WORD_LIMIT = 12

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
    canonical = suggestion_category(name)
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
    padded = f' {normalized} '
    role_tags = []
    for role, tags in POSITION_TAGS.items():
        aliases = [role, *ROLE_ALIASES.get(role, [])]
        if any(f' {taxonomy_key(alias)} ' in padded for alias in aliases):
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
    specific_requirements = [item for item in requirements or []
                             if suggestion_category(item.get('name') or item.get('category') or '')
                             not in BROAD_POSITION_CATEGORIES]
    for item in sorted(specific_requirements, key=percentage, reverse=True)[:2]:
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
    return [tag for tag in normalize_tags(tags) if tag.casefold() != category_name.casefold()][:count]


def category_definition(category):
    """One bounded contextual definition, shared by both text inputs/freshness."""
    value = getattr(category, 'description', '')
    if not isinstance(value, str):
        return ''
    return ' '.join(value[:DEFINITION_CHAR_LIMIT].split()[:DEFINITION_WORD_LIMIT])


def assessed_scores(skill_scores):
    result = []
    for row in skill_scores:
        try:
            score = float(row.percentage)
            maximum = getattr(row, 'max_score', None)
            if isinstance(row.percentage, bool) or not math.isfinite(score) or not 0 <= score <= 100:
                continue
            if maximum is not None and (not math.isfinite(float(maximum)) or float(maximum) <= 0):
                continue
            result.append(row)
        except (TypeError, ValueError, AttributeError):
            continue
    return result


def _evidence_parts(entries):
    """Symmetric category evidence for students and positions, no labels/roles.

    Shared tags are repeated less within this profile/requirement set. TF-IDF
    still supplies corpus-wide inverse-document frequency. Category tags are
    illustrative category vocabulary, not claims of separately tested skills.
    """
    entries = sorted(entries, key=lambda pair: (-pair[1], pair[0].name.casefold()))
    selected = [(category, score, _selected_tags(category.tags, score, category.name)) for category, score in entries]
    frequency = Counter(taxonomy_key(tag) for _, _, tags in selected for tag in set(tags))
    fragments, evidence = [], []
    for category, score, tags in selected:
        name = category.name
        band = competency_label(score)
        fragments.append(f'{band} {name} competency ({score:g} percent); category vocabulary: {", ".join(tags) or "no specific tags"}'
                         if score > 0 else f'{name}: no positive category evidence ({score:g} percent)')
        if score <= 0:
            continue
        definition = category_definition(category)
        if definition:
            # Once on each side, outside repeated score-weighted vocabulary.
            # The definition describes the category, never individual mastery.
            fragments.append(f'Contextual category definition for {name}: {definition}')
        weight = score_weight(score)
        # Same skill + band phrase on both sides makes strengths comparable;
        # expected positions and archetype names are never inputs here.
        evidence.extend([f'{name} {band} competency'] * weight)
        for tag in tags:
            evidence.extend([f'{name} {tag}'] * max(1, weight // frequency[taxonomy_key(tag)]))
    return fragments, evidence


def build_student_profile(skill_scores):
    skill_scores = assessed_scores(skill_scores)
    fragments, evidence = _evidence_parts([(s.skill_category, float(s.percentage)) for s in skill_scores])
    if not fragments:
        return 'No assessed competency evidence is available.'
    introduction = 'The student demonstrates' if any(float(s.percentage) > 0 for s in skill_scores) else 'Assessment results:'
    return (f"{introduction} {'; '.join(fragments)}. Skill evidence: {' '.join(evidence)}. "
            'Category vocabulary is contextual; these terms were not separately assessed.')


def generate_competency_insights(skill_scores):
    """Describe saved category results without inferring a discipline or career."""
    ranked = sorted(assessed_scores(skill_scores), key=lambda row: (-float(row.percentage), row.skill_category.name.casefold()))
    if not ranked:
        return {
            'orientation_label': '', 'orientation_summary': '',
            'competency_profile_text': 'No assessed competency evidence is available.',
            'development_suggestions': [], 'supporting_categories': [],
        }
    maximum = float(ranked[0].percentage)
    leaders = [row for row in ranked if float(row.percentage) == maximum]
    orientation_label = ('Highest-scoring assessed area' if len(leaders) == 1 else 'Highest-scoring assessed areas (tied)') if maximum > 0 else ''
    if maximum > 0:
        orientation_summary = 'Assessment category results are highest in ' + '; '.join(
            f'{row.skill_category.name} ({float(row.percentage):g}%)' for row in leaders) + '. These results do not establish a career orientation or practical mastery.'
    else:
        orientation_summary = 'No assessed category scored above zero. Further guided practice and assessment are needed.'
    focus = [row for row in ranked if float(row.percentage) < 80]
    suggestions = []
    # Keep every assessed category, including exact ties; no arbitrary two-row cut.
    for row in sorted(focus or ranked, key=lambda row: (float(row.percentage), row.skill_category.name.casefold())):
        category = row.skill_category
        score = float(row.percentage)
        tags = normalize_tags(category.tags)[:4]
        message = (f'Review incorrect or unanswered items in {category.name} with your instructor and practise the concepts assessed.' if score < 80 else
                   f'Build on your assessed results in {category.name} through further guided practice and applied activities.')
        if tags:
            message += f' Contextual topics for review: {", ".join(tags)}. These topics were not individually assessed.'
        suggestions.append({'category': category.name, 'percentage': round(score, 1),
                            'competency_label': competency_label(score), 'message': message})
    return {
        'orientation_label': orientation_label, 'orientation_summary': orientation_summary,
        # Presentation labels/orientations are not matching evidence.
        'competency_profile_text': build_student_profile(ranked),
        'development_suggestions': suggestions,
        'supporting_categories': [{'category': row.skill_category.name,
            'category_id': getattr(row.skill_category, 'id', None),
            'framework_id': getattr(row.skill_category, 'framework_id', None),
            'text_generation_version': TEXT_GENERATION_VERSION,
            'matching_context': {'definition': category_definition(row.skill_category) if float(row.percentage) > 0 else '',
                                 'tags': _selected_tags(row.skill_category.tags, float(row.percentage), row.skill_category.name)},
            'percentage': round(float(row.percentage), 1), 'competency_label': competency_label(float(row.percentage)),
            'tags': normalize_tags(row.skill_category.tags)[:6]} for row in ranked],
    }


def position_role_context(description):
    return ' '.join(description[:1200].split()[:100]) if isinstance(description, str) else ''


def build_position_description(position):
    """Current saved requirements/tags, generated on demand without writes."""
    requirements = list(position.requirements.all())
    fragments, evidence = _evidence_parts([(r.skill_category, float(r.required_percentage)) for r in requirements])
    position_tags = [t for t in normalize_tags(position.tags) if not is_generic_tag(t)]
    # Role-specific tags remain visible but cannot overwhelm assessed skill
    # evidence with six repetitions of unassessed role vocabulary.
    role_evidence = [tag for tag in position_tags[:12] for _ in range(2)]
    role_context = position_role_context(getattr(position, 'description', ''))
    return (
        f'{position.title} at {position.company.name}. Required skill percentages: '
        + '; '.join(f'{r.skill_category.name}: {float(r.required_percentage):g} percent' for r in requirements)
        + f". Competency requirements: {'; '.join(fragments) or 'not specified'}. "
        + f"Role-specific vocabulary: {', '.join(position_tags) or 'no saved role tags'}. "
        + f"Requirement evidence: {' '.join(evidence + role_evidence)}."
        + (f' Role description: {role_context}' if role_context else '')
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
            dir=str(stanza_resources_dir()),
            use_gpu=False, verbose=False, download_method=None,
        )
    raise ValueError(f'Unsupported NLP model: {model_id}')


def stanza_resources_dir():
    """Use the installed Stanza version's default, or one explicit override.

    Older Stanza used ~/stanza_resources; newer releases use a versioned platform
    cache. Status, runtime and build-time provisioning must use the same path.
    This function never creates directories or downloads resources.
    """
    configured = os.environ.get('STANZA_RESOURCES_DIR', '').strip()
    if configured:
        return Path(configured).expanduser()
    packaged = Path(__file__).resolve().parents[1] / '.nlp' / 'stanza'
    if (packaged / 'resources.json').is_file():
        return packaged
    from stanza.resources.common import DEFAULT_MODEL_DIR
    current = Path(DEFAULT_MODEL_DIR).expanduser()
    previous = Path.home() / 'stanza_resources'
    if not (current / 'resources.json').is_file() and (previous / 'resources.json').is_file():
        return previous
    return current


# Cache only successful document lemmas, never corpus TF-IDF or match scores.
# Exact text/model-instance keys make catalog/profile/model changes miss naturally.
_PREPROCESS_CACHE_LIMIT = 512
_PREPROCESS_TEXT_LIMIT = 16384
_preprocess_cache = OrderedDict()
_preprocess_cache_lock = RLock()
_stanza_inference_lock = RLock()


def clear_preprocessing_cache():
    with _preprocess_cache_lock:
        _preprocess_cache.clear()


def _spacy_texts(texts, model_id, model):
    texts = list(texts)
    resolved, missing, missing_seen = {}, [], set()
    for text in texts:
        if text in resolved or text in missing_seen:
            continue
        key = (model_id, id(model), text)
        with _preprocess_cache_lock:
            entry = _preprocess_cache.get(key)
            if entry is not None and entry[0] is model:
                _preprocess_cache.move_to_end(key)
                resolved[text] = entry[1]
                continue
        missing.append(text)
        missing_seen.add(text)
    if missing:
        # Do not cache partial output when a pipeline fails; normal fallback and
        # strict diagnostics must still observe the actual resource/error state.
        processed = [' '.join(
            token.lemma_.casefold().strip() for token in doc
            if not token.is_stop and not token.is_punct and not token.is_space and token.lemma_.strip()
        ) for doc in model.pipe(missing, batch_size=64)]
        if len(processed) != len(missing):
            raise ValueError('Preprocessor returned an invalid document count.')
        resolved.update(zip(missing, processed))
        with _preprocess_cache_lock:
            for text, value in zip(missing, processed):
                if len(text) <= _PREPROCESS_TEXT_LIMIT and len(value) <= _PREPROCESS_TEXT_LIMIT:
                    key = (model_id, id(model), text)
                    _preprocess_cache[key] = (model, value)
                    _preprocess_cache.move_to_end(key)
            while len(_preprocess_cache) > _PREPROCESS_CACHE_LIMIT:
                _preprocess_cache.popitem(last=False)
    return [resolved[text] for text in texts]


def preprocess_texts(texts, model_id, *, allow_fallback=True):
    """Return processed text, actual model id, and an optional fallback reason.

    Evaluation passes allow_fallback=False so missing models cannot inherit
    another model's metrics. Existing production callers retain fallback.
    """
    try:
        model = _load_model(model_id)
        if model_id.startswith('spacy_'):
            return _spacy_texts(texts, model_id, model), model_id, None

        # The same bounded successful-document cache is used for both engines.
        # Load before checking it so strict errors cannot be hidden by old text.
        output = []
        with _stanza_inference_lock:
            for text in texts:
                key = (model_id, id(model), text)
                with _preprocess_cache_lock:
                    entry = _preprocess_cache.get(key)
                    if entry is not None and entry[0] is model:
                        _preprocess_cache.move_to_end(key)
                        output.append(entry[1])
                        continue
                doc = model(text)
                tokens = []
                for sentence in doc.sentences:
                    for word in sentence.words:
                        lemma = (word.lemma or word.text).casefold().strip()
                        if lemma and lemma.isalpha() and lemma not in STOP_WORDS:
                            tokens.append(lemma)
                processed = ' '.join(tokens)
                output.append(processed)
                if len(text) <= _PREPROCESS_TEXT_LIMIT and len(processed) <= _PREPROCESS_TEXT_LIMIT:
                    with _preprocess_cache_lock:
                        _preprocess_cache[key] = (model, processed)
                        _preprocess_cache.move_to_end(key)
                        while len(_preprocess_cache) > _PREPROCESS_CACHE_LIMIT:
                            _preprocess_cache.popitem(last=False)
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


def model_status(model_id, *, verify=False):
    """Separate installed resources from strict execution on this server.

    A normal GET avoids expensive cold model loads. An explicit admin recheck,
    model save or build smoke check processes a small input without fallback.
    """
    if model_id not in MODEL_OPTIONS:
        return {'available': False, 'verified': False, 'readiness': 'unavailable', 'error': 'Unsupported NLP model.'}
    if verify:
        try:
            documents, actual, reason = preprocess_texts(
                ['Students maintain accurate records and communicate with visitors.'], model_id, allow_fallback=False)
            if actual != model_id or reason or len(documents) != 1 or not documents[0].strip():
                raise ValueError('Strict processing did not produce valid text with the requested model.')
            return {'available': True, 'verified': True, 'readiness': 'verified', 'error': None}
        except Exception as exc:
            # Do not expose server filesystem paths or tracebacks in the API.
            return {'available': False, 'verified': False, 'readiness': 'unavailable',
                    'error': f'{MODEL_OPTIONS[model_id]["label"]} could not process text ({type(exc).__name__}). Check installed resources and server configuration.'}
    if model_id in ('spacy_sm', 'spacy_md'):
        package = MODEL_OPTIONS[model_id]['package']
        available = importlib.util.find_spec('spacy') is not None and importlib.util.find_spec(package) is not None
        return {
            'available': available,
            'verified': False, 'readiness': 'installed' if available else 'unavailable',
            'error': None if available else f'{package} is not installed.',
        }
    if model_id == 'stanza_en':
        try:
            installed = importlib.util.find_spec('stanza') is not None
            resources_root = stanza_resources_dir() if installed else None
            available = bool(resources_root and (resources_root / 'resources.json').is_file()
                and any((resources_root / 'en' / 'tokenize').glob('*.pt'))
                and any((resources_root / 'en' / 'lemma').glob('*.pt')))
        except (ImportError, OSError, ValueError):
            available = False
        return {
            'available': available,
            'verified': False, 'readiness': 'installed' if available else 'unavailable',
            'error': None if available else 'Stanza English tokenize/lemma resources were not found. Check STANZA_RESOURCES_DIR on this server.',
        }


def valid_coordinates(lat, lng):
    """A complete finite latitude/longitude pair; invalid legacy data is missing."""
    if any(isinstance(value, bool) or value is None or not isinstance(value, (str, int, float)) or
           (isinstance(value, str) and not value.strip()) for value in (lat, lng)):
        return None
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError, OverflowError):
        return None
    if not math.isfinite(lat) or not math.isfinite(lng) or abs(lat) > 90 or abs(lng) > 180:
        return None
    return lat, lng


def company_address_text(address):
    """Display legacy text or structured address without changing stored data."""
    if isinstance(address, str):
        return address.strip() or None
    if not isinstance(address, dict):
        return None
    return ', '.join(value.strip() for key in ('barangay', 'city', 'province')
                     if isinstance(value := address.get(key), str) and value.strip()) or None


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
        coordinates = valid_coordinates(lat, lng)
        if coordinates is not None:
            return coordinates
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
    return radius_km * 2 * math.asin(math.sqrt(min(1.0, max(0.0, a))))


def location_similarity(student_address, company_lat, company_lng, max_distance_km=80.0):
    """Return (0..1 score, distance); missing coordinates use neutral 0.5."""
    student_coordinates = extract_coordinates(student_address)
    company_coordinates = valid_coordinates(company_lat, company_lng)
    if student_coordinates is None or company_coordinates is None:
        return 0.5, None
    try:
        student_lat, student_lng = student_coordinates
        distance = haversine_distance_km(
            student_lat, student_lng, *company_coordinates
        )
    except (TypeError, ValueError):
        return 0.5, None
    return max(0.0, 1.0 - distance / max_distance_km), distance
