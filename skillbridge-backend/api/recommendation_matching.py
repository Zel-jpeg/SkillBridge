"""Position-relevant text matching without changing numerical competency evidence.

The full generated profile and compatible roles define one common TF-IDF space.
Filtered student views are transformed, never independently fitted per role.
Model loading remains lazy and uses the existing preprocessing/fallback policy.
"""
from dataclasses import dataclass
from typing import Any

from . import recommendation_nlp as nlp


MATCHING_INPUT_VERSION = 'position-required-common-idf-v1'


@dataclass
class PositionTextSimilarity:
    scores: Any
    model_used: str
    fallback_reason: str | None
    vectorizer: Any
    reference_matrix: Any
    student_matrix: Any
    student_texts: tuple
    relevant_category_ids: tuple
    positive_evidence: tuple

    def overlap_matrix(self, index):
        """The exact normalized pair used for this role's supporting similarity."""
        if self.reference_matrix is None:
            return None
        from scipy.sparse import vstack

        return vstack((self.student_matrix.getrow(index),
                       self.reference_matrix.getrow(index + 1)), format='csr')

    def input_metadata(self, index):
        return {
            'matching_input_version': MATCHING_INPUT_VERSION,
            'student_profile_scope': 'position_required_categories',
            'relevant_assessed_category_ids': list(self.relevant_category_ids[index]),
            'has_positive_relevant_evidence': self.positive_evidence[index],
            'student_matching_word_count': len(self.student_texts[index].split()),
            'uses_common_tfidf_space': True,
        }


def position_specific_similarity(profile_text, skill_scores, positions,
                                 category_mapping, requested_model, *, position_texts=None,
                                 allow_fallback=True):
    """Return per-role cosine values and the actual fitted vectors for explanations.

    Callers supply the existing numerical category mapping: exact IDs for scoped
    frameworks, canonical-equivalent IDs only on the unscoped compatibility path.
    Unknown IDs fail closed instead of importing another program's vocabulary.
    No category, score, profile, requirement, model setting or record is modified.
    """
    import numpy as np
    from sklearn.feature_extraction.text import TfidfVectorizer

    positions = list(positions)
    rows = nlp.assessed_scores(skill_scores)
    for row in rows:
        if row.skill_category_id not in category_mapping:
            raise ValueError('Assessed category is outside the matching catalog.')
    texts, identities, positive = [], [], []
    for position in positions:
        required = set()
        for requirement in position.requirements.all():
            if requirement.skill_category_id not in category_mapping:
                raise ValueError('Position requirement is outside the matching catalog.')
            if requirement.required_percentage > 0:
                required.add(category_mapping[requirement.skill_category_id])
        relevant = [row for row in rows if category_mapping[row.skill_category_id] in required]
        texts.append(nlp.build_student_profile(relevant))
        identities.append(tuple(sorted({row.skill_category_id for row in relevant})))
        positive.append(any(float(row.percentage) > 0 for row in relevant))

    if position_texts is None:
        position_texts = [nlp.build_position_description(position) for position in positions]
    else:
        position_texts = list(position_texts)
    if len(position_texts) != len(positions):
        raise ValueError('Every candidate must have exactly one position text.')
    if not positions:
        return PositionTextSimilarity(np.zeros(0), '', None, None, None, None,
                                      tuple(texts), tuple(identities), tuple(positive))

    count = len(positions)
    inputs = [profile_text] + position_texts + texts
    # Keep production callers compatible; read-only comparison explicitly opts
    # into strict execution so one model cannot borrow another model's metrics.
    if allow_fallback:
        processed, model_used, fallback_reason = nlp.preprocess_texts(inputs, requested_model)
    else:
        processed, model_used, fallback_reason = nlp.preprocess_texts(inputs, requested_model, allow_fallback=False)
    if len(processed) != 1 + count * 2:
        raise ValueError('Preprocessed matching documents do not match the candidate set.')
    vectorizer = TfidfVectorizer(ngram_range=(1, 3), min_df=1, sublinear_tf=True)
    try:
        reference = vectorizer.fit_transform(processed[:count + 1])
    except ValueError as exc:
        if 'empty vocabulary' not in str(exc).lower():
            raise
        return PositionTextSimilarity(np.zeros(count), model_used, fallback_reason,
                                      None, None, None, tuple(texts), tuple(identities), tuple(positive))

    student_matrix = vectorizer.transform(processed[count + 1:])
    # Template/category-name overlap is not positive evidence. Zero those rows
    # before both calculation and explanation, retaining numeric missing/zero
    # distinctions in the existing requirement-coverage policy.
    student_matrix = student_matrix.multiply(np.asarray(positive, dtype=float)[:, None]).tocsr()
    student_matrix.eliminate_zeros()
    # TF-IDF defaults to L2 normalization. Rowwise dot products are diagonal
    # cosines; avoid allocating an unnecessary candidate-by-candidate matrix.
    scores = np.asarray(student_matrix.multiply(reference[1:]).sum(axis=1)).ravel()
    scores = np.clip(scores, 0.0, 1.0)
    return PositionTextSimilarity(scores, model_used, fallback_reason, vectorizer,
                                  reference, student_matrix, tuple(texts), tuple(identities), tuple(positive))
