"""Optional lexical assistance from one authorized saved definition set only."""
import re
import unicodedata

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .competencies import context, current_framework, fields, framework_payload, text

POLICY = 'saved-framework-tfidf-v1'
MIN_SIMILARITY = 0.12
MIN_MARGIN = 0.06


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def suggest_description_tags(request, program_id):
    """Offer short phrases from the supplied definition, without a domain dictionary."""
    context(request.user, program_id)
    fields(request.data, ['name', 'description'], ['name', 'description'])
    name = text(request.data['name'], 'name', 100)
    description = text(request.data['description'], 'description', 2000)
    # Conservative, language-independent punctuation plus common English function
    # words. Unsupported wording can abstain; no discipline expertise is invented.
    fragments = re.split(r'[,;.!?\n]+|\b(?:and|or|in|on|at|to|of|for|from|with|the|a|an|'
                         r'be|is|are|can|should|students|student|know|able|organize|recognize|'
                         r'understand|explain|demonstrate|apply|use)\b', description, flags=re.I)
    tags, seen = [], {name.casefold()}
    for fragment in fragments:
        tag = ' '.join(fragment.strip(' :-/').split())
        if tag.casefold() not in seen and 1 <= len(tag.split()) <= 4 and 2 <= len(tag) <= 80:
            tags.append(tag)
            seen.add(tag.casefold())
        if len(tags) == 12:
            break
    return Response({'suggested_tags': tags, 'source': 'description', 'method': 'description-phrases-v1'})


def tokens(value):
    return set(re.findall(r'[^\W_]{2,}', unicodedata.normalize('NFKC', value).casefold()))


def saved_tags(category):
    return [tag for tag in category.tags if isinstance(tag, str) and tag.strip()][:30] if isinstance(category.tags, list) else []


def document(category):
    return ' '.join([category.name[:100], category.description[:1200], ' '.join(saved_tags(category))[:600]])


def rank(query, categories):
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
        docs = [document(category) for category in categories]
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
