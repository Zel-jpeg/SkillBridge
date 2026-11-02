"""Explain existing fitted text vectors without changing the NLP calculation.

Pure helper: no Django, database, model loading, fitting, transformations or writes.
The default exposes words rather than unverified cross-fragment n-grams. Callers
may supply contextual phrases already preprocessed with the same NLP pipeline to
allow multiword features supported by those phrases. A term is contextual text
evidence; its presence or absence does not establish assessed subskill mastery.
"""
import math


_TEMPLATE_WORDS = frozenset('''
    student students demonstrate demonstrates demonstration assessment assessments
    assessed assess result results evidence evidences category categories vocabulary
    contextual context term terms separately competency competencies competence
    requirement requirements required require skill skills percentage percentages
    percent positive excellent strong proficient developing basic available specific
    no none not from the and or of to at as is are for with this these that those
    indicates indicate led oriented pattern profile further guided practice needed
    current expected introduction description information
'''.split())


def _empty(status):
    return dict(
        explanation_status=status,
        shared_terms=[],
        role_only_terms=[],
        shared_context_term_count=0,
        role_only_context_term_count=0,
        text_similarity_semantics=(
            'Similarity of generated assessment-context and position text; '
            'not an assessment grade, qualification or confidence.'
        ),
        shared_term_meaning='Appears in both generated texts; not separately assessed subskill mastery.',
        role_only_term_meaning='Appears in position text only; absence is not proof of student inability.',
        uses_same_fitted_text_vectors=True,
        changes_source_scores=False,
        claims_individual_subskill_mastery=False,
    )


def explain_overlap(vectorizer, matrix, position_index, topn=6, *, context_terms=None):
    """Describe a role using the existing one-student/all-roles TF-IDF matrix.

    ``position_index`` is zero-based among positions: row0 is the student and
    row(position_index+1) is the role. ``None`` vectorizer/matrix means the scoring
    path encountered an empty vocabulary. ``context_terms``, when supplied, must
    contain phrases preprocessed with the SAME selected NLP pipeline; this helper
    only uses the already fitted vectorizer's analyzer, not a model or transform.

    By default, only non-template unigrams are displayable. With context phrases,
    n-grams must occur within a supplied phrase rather than across joined generated
    fragments. Filtering changes the explanation only, never the similarity score.
    """
    if type(position_index) is not int or position_index < 0:
        raise ValueError('Position index must be a nonnegative integer')
    if type(topn) is not int or not 0 <= topn <= 20:
        raise ValueError('Explanation term limit must be an integer from zero to twenty')
    if vectorizer is None or matrix is None:
        result = _empty('empty_vocabulary')
        result['term_selection'] = 'No fitted vocabulary was available.'
        return result

    names = list(vectorizer.get_feature_names_out())
    if len(matrix.shape) != 2 or matrix.shape[0] <= position_index + 1 or matrix.shape[1] != len(names):
        raise ValueError('Text vectors do not match the requested position and fitted vocabulary')
    student = matrix.getrow(0)
    role = matrix.getrow(position_index + 1)
    student_weights = {int(k): float(v) for k, v in zip(student.indices, student.data)}
    role_weights = {int(k): float(v) for k, v in zip(role.indices, role.data)}
    if not all(math.isfinite(v) and v >= 0 for v in [*student_weights.values(), *role_weights.values()]):
        raise ValueError('Expected finite nonnegative fitted text weights')

    allowed = None
    if context_terms is not None:
        if isinstance(context_terms, (str, bytes)):
            raise ValueError('Context terms must be a collection of preprocessed phrases')
        analyzer = vectorizer.build_analyzer()
        allowed = set()
        for phrase in context_terms:
            if not isinstance(phrase, str):
                raise ValueError('Every contextual phrase must be text')
            allowed.update(analyzer(phrase))

    def displayable(index):
        term = str(names[index])
        words = term.casefold().split()
        # Exclude numeric grades and any n-gram containing generated boilerplate.
        if not words or any(w in _TEMPLATE_WORDS or not any(c.isalpha() for c in w) for w in words):
            return False
        return term in allowed if allowed is not None else len(words) == 1

    shared = [k for k, value in role_weights.items() if value > 0 and student_weights.get(k, 0) > 0 and displayable(k)]
    role_only = [k for k, value in role_weights.items() if value > 0 and student_weights.get(k, 0) <= 0 and displayable(k)]
    shared.sort(key=lambda k: (-student_weights[k] * role_weights[k], str(names[k])))
    role_only.sort(key=lambda k: (-role_weights[k], str(names[k])))
    result = _empty('available' if shared or role_only else 'no_contextual_terms')
    result.update(
        shared_terms=[dict(term=str(names[k]), evidence_kind='contextual_text_match') for k in shared[:topn]],
        role_only_terms=[dict(term=str(names[k]), evidence_kind='position_text_only') for k in role_only[:topn]],
        shared_context_term_count=len(shared),
        role_only_context_term_count=len(role_only),
        term_selection=(
            'Only features occurring within supplied same-pipeline contextual phrases; generated boilerplate excluded.'
            if allowed is not None else
            'Non-template words from the fitted text vectors; multiword fragments require contextual phrase provenance.'
        ),
    )
    return result
