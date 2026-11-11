"""Authoring assistance from draft text and authorized program definitions."""
import re
import unicodedata

from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .competencies import context, current_framework, fields, framework_payload, shared_skill_rows, staff, text
from .models import Institute
from .recommendation_nlp import normalize_tags

POLICY = 'saved-framework-tfidf-v1'
MIN_SIMILARITY = 0.12
MIN_MARGIN = 0.06
TAG_SUGGESTION_LIMIT = 12
REUSED_TAG_LIMIT = 4

# Describe what the learner does, then keep the subject of each action.
DESCRIPTION_BREAKS = re.compile(
    r'[,;.!?\n]+|(?<![\w/-])(?:and|or|then|before|after|while|when|using|in|with|from)(?![\w/-])',
    re.I,
)
INSTRUCTION_PREFIX = re.compile(
    r'^(?:students? (?:can|should|will)\s+)?(?:(?:be able to|know how to)\s+)?'
    r'(?:apply|assess|capture|check|collect|complete|conduct|confirm|create|demonstrate|deploy|describe|'
    r'document|enter|evaluate|explain|follow|handle|identify|maintain|manage|organize|perform|'
    r'prepare|process|provide|recognize|record|resolve|review|support|track|understand|use|verify|'
    r'learn)\s+(?:(?:a|an|the|accurate|accurately|appropriate|appropriately|correct|correctly|proper|properly)\s+)*',
    re.I,
)


def description_tags(name, description):
    name_words = name.casefold().split()
    phrases = []
    for fragment in DESCRIPTION_BREAKS.split(description):
        phrase = ' '.join(fragment.strip(' :-/()').split())
        words = INSTRUCTION_PREFIX.sub('', phrase).split()
        if len(words) < 2:
            words = phrase.split()
        # Drop repeated context from the title when the remaining phrase is useful on its own.
        if name_words and len(words) >= 3 and words[0].casefold() == name_words[0]:
            words = words[1:]
        tag = ' '.join(words)
        if 1 <= len(words) <= 4 and 2 <= len(tag) <= 80 and tag.casefold() != name.casefold():
            phrases.append(tag)
    return normalize_tags(phrases, limit=TAG_SUGGESTION_LIMIT)


def skill_tag_suggestions(name, description, categories=()):
    extracted = description_tags(name, description)
    available = min(REUSED_TAG_LIMIT, TAG_SUGGESTION_LIMIT - len(extracted))
    if not available or not description.strip():
        return extracted, []
    categories = [category for category in categories
                  if category.name.casefold() != name.casefold() and saved_tags(category)]
    match = rank(f'{name} {description}', categories, include_tags=False)['suggested_category']
    if not match:
        return extracted, []
    category = next(category for category in categories if category.id == match['id'])
    existing = {tag.casefold() for tag in [name, *extracted]}
    reused = [tag for tag in normalize_tags(saved_tags(category)) if tag.casefold() not in existing]
    return extracted, reused[:available]


def suggestion_definition(data):
    fields(data, ['name', 'description'], ['name', 'description'])
    return text(data['name'], 'name', 100), text(data['description'], 'description', 2000)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def suggest_description_tags(request, program_id):
    """Offer draft tags even before the program has any saved skills."""
    program = context(request.user, program_id)
    name, description = suggestion_definition(request.data)
    framework = program.competency_frameworks.filter(is_active=True).first()
    categories = framework.categories.all() if framework else ()
    extracted, reused = skill_tag_suggestions(name, description, categories)
    return Response({'suggested_tags': extracted + reused,
                     'source': 'description_and_program' if reused else 'description',
                     'method': 'description-and-program-tags-v2'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def suggest_institute_tags(request, institute_id):
    staff(request.user)
    if request.user.role != 'admin':
        raise PermissionDenied('Only administrators manage institute skills.')
    institute = get_object_or_404(Institute, pk=institute_id)
    name, description = suggestion_definition(request.data)
    extracted, reused = skill_tag_suggestions(name, description, shared_skill_rows(institute))
    return Response({'suggested_tags': extracted + reused})


def tokens(value):
    return set(re.findall(r'[^\W_]{2,}', unicodedata.normalize('NFKC', value).casefold()))


def saved_tags(category):
    return [tag for tag in category.tags if isinstance(tag, str) and tag.strip()][:30] if isinstance(category.tags, list) else []


def document(category, *, include_tags):
    definition = f'{category.name[:100]} {category.description[:1200]}'
    if include_tags:
        return f"{definition} {' '.join(saved_tags(category))[:600]}"
    return definition


def rank(query, categories, *, include_tags=True):
    if not categories:
        return {'status': 'empty_catalog', 'suggested_category': None, 'candidates': []}
    if not query.strip():
        return {'status': 'empty_text', 'suggested_category': None, 'candidates': []}
    # No global domain vocabulary, course-name inference or learned grading.
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
    except ImportError:
        return {'status': 'unavailable', 'suggested_category': None, 'candidates': []}
    try:
        vectorizer = TfidfVectorizer(stop_words='english', strip_accents='unicode', ngram_range=(1, 2), max_features=6000)
        docs = [document(category, include_tags=include_tags) for category in categories]
        matrix = vectorizer.fit_transform(docs)
        query_vector = vectorizer.transform([query])
        similarities = cosine_similarity(query_vector, matrix)[0]
        informative = set(vectorizer.get_feature_names_out())
        query_terms = tokens(query) & informative
        ranked = []
        for category, doc, score in zip(categories, docs, similarities):
            overlap = query_terms & tokens(doc)
            name_terms = tokens(category.name) & informative
            explicit_name = bool(name_terms) and name_terms <= query_terms
            if float(score) >= MIN_SIMILARITY and (len(overlap) >= 2 or explicit_name):
                ranked.append({'id': category.id, 'name': category.name, 'similarity': round(float(score), 6)})
        ranked.sort(key=lambda item: (-item['similarity'], item['id']))
        candidates = ranked[:3]
        if not candidates:
            return {'status': 'no_match', 'suggested_category': None, 'candidates': []}
        ambiguous = len(candidates) > 1 and candidates[0]['similarity'] - candidates[1]['similarity'] < MIN_MARGIN
        return {'status': 'ambiguous' if ambiguous else 'matched',
                'suggested_category': None if ambiguous else candidates[0], 'candidates': candidates}
    except ValueError:
        # Empty vocabulary/all stop words is a normal abstention case.
        return {'status': 'no_match', 'suggested_category': None, 'candidates': []}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assist_category(request, program_id, framework_id):
    program = context(request.user, program_id)
    framework = current_framework(request.user, program, framework_id)
    fields(request.data, ['question_text'], ['question_text'])
    query = text(request.data['question_text'], 'question_text', 4000, blank=True)
    categories = sorted(framework.categories.all(), key=lambda category: category.id)
    return Response({**rank(query, categories), 'method': POLICY, 'framework_id': framework.id,
                     'framework_digest': framework_payload(framework, request.user)['digest']})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assist_tags(request, program_id, framework_id):
    program = context(request.user, program_id)
    framework = current_framework(request.user, program, framework_id)
    fields(request.data, ['name', 'description'])
    name = text(request.data.get('name', ''), 'name', 100, blank=True)
    description = text(request.data.get('description', ''), 'description', 2000, blank=True)
    categories = sorted(framework.categories.all(), key=lambda category: category.id)
    exact = next((category for category in categories if category.name.casefold() == name.casefold()), None)
    ranked = rank(f'{name} {description}'.strip(), categories) if exact is None else None
    selected = exact
    if selected is None and ranked['suggested_category']:
        selected = next(category for category in categories if category.id == ranked['suggested_category']['id'])
    tags = saved_tags(selected) if selected else []
    return Response({'status': 'suggestions' if tags else ranked['status'] if ranked and selected is None else 'no_suggestions',
        'suggested_tags': tags, 'source_category': {'id': selected.id, 'name': selected.name} if selected and tags else None,
        'source': 'saved_exact_name' if exact else 'saved_framework', 'method': POLICY,
        'framework_id': framework.id, 'framework_digest': framework_payload(framework, request.user)['digest']})
