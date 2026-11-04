"""Offline synthetic definition ablation; no database, downloads or accuracy claim."""
import copy
import json
from pathlib import Path
import sys
from types import SimpleNamespace as Obj
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'skillbridge-backend'))
from api.recommendation_nlp import build_student_profile, build_position_description, _simple_preprocess, TEXT_GENERATION_VERSION

definitions = [
    ('Service procedures', 'Explains booking records, arrival reservations and visitor service procedures.'),
    ('Record interpretation', 'Interprets experiment observations, sampling records and laboratory measurements.'),
    ('Resource planning', 'Explains revenue costs, cash records and enterprise resource planning.'),
]
categories = [Obj(id=index + 1, name=name, description=description, tags=[]) for index, (name, description) in enumerate(definitions)]
company = Obj(name='Synthetic partner')
rows = []
for index in range(3):
    score = Obj(skill_category=categories[index], percentage=80, raw_score=8, max_score=10)
    def inputs(include_definitions):
        copied = copy.deepcopy(categories)
        if not include_definitions:
            for category in copied:
                category.description = ''
        student = build_student_profile([Obj(skill_category=copied[index], percentage=80, raw_score=8, max_score=10)])
        positions = [build_position_description(Obj(title='Synthetic opportunity', company=company, tags=[],
            requirements=Obj(all=lambda category=category: [Obj(skill_category=category, required_percentage=80)]))) for category in copied]
        return [student, *positions]
    measures = {}
    for name, enabled in [('without_definitions', False), ('bounded_definitions', True)]:
        texts = inputs(enabled)
        matrix = TfidfVectorizer(stop_words='english', ngram_range=(1, 2)).fit_transform(_simple_preprocess(texts))
        scores = cosine_similarity(matrix[:1], matrix[1:])[0]
        measures[name] = {'cosines': [round(float(value), 6) for value in scores],
            'text_lengths': [len(text) for text in texts], 'largest_similarity_index': int(scores.argmax())}
    rows.append({'synthetic_assessed_category': score.skill_category.name, **measures})
out = ROOT / 'work/f08-definition-ablation.json'
out.write_text(json.dumps({'text_version': TEXT_GENERATION_VERSION, 'preprocessing': 'deterministic regex',
    'scope': 'Synthetic text ablation only; no database, ranking-policy changes or academic accuracy claim.', 'cases': rows}, indent=2), encoding='utf-8')
print(json.dumps({'evidence': str(out), 'cases': rows}))
