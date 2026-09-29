---
name: skillbridge-assessment-review
description: Review SkillBridge assessment grading, answer validation, category scores, submission integrity and retake behavior. Use when checking unexpected assessment scores or reviewing changes to the assessment workflow.
metadata:
  author: SkillBridge project team with Codex assistance
  origin: Original project skill
---

# SkillBridge Assessment Review

Review the full assessment path and report evidence-backed findings with expected
versus actual behavior. Use synthetic fixtures or an authorized test database for
reproduction; a review request alone does not require changing application code.

## When to use

Use for scoring discrepancies, assessment submission reviews, question-type
handling, category totals, retakes and integrity stops. For final batch ranking,
use the recommendation audit workflow instead.

## Project references

Paths below are relative to this skill folder:

- [Scoring](../../../skillbridge-backend/api/scoring.py): `score_submission` and saved category totals.
- [Views](../../../skillbridge-backend/api/views.py): assessment start, submit, stop and instructor retake endpoints.
- [Models](../../../skillbridge-backend/api/models.py): question, answer, response and score constraints.
- [Progress rules](../../../skillbridge-backend/api/assessment_progress.py): batch visibility and required completion.
- [Combined evidence](../../../skillbridge-backend/api/combined_competency.py): downstream inclusion and invalidation.
- [Assessment tests](../../../skillbridge-backend/api/tests.py) and [multiple assessment tests](../../../skillbridge-backend/api/test_multiple_assessments.py): existing fixtures and behavior checks.

## Workflow

1. Identify the assessment, question types, category IDs, submitted payload and attempt status relevant to the request. If records are unavailable, state that limitation and review code or synthetic fixtures without inventing student results.
2. Trace the endpoint into grading. Inspect access checks, assessment membership, choice-to-question ownership and attempt finalization. Compare omitted questions, duplicate question IDs and foreign choices against the intended contract and existing tests; do not assume the helper validates the entire payload.
3. Compute expected category totals from the intended question set: raw correct count, maximum count and `round(raw / max * 100, 2)`. Compare the denominator with what the implementation actually counts, and flag mismatches with a concrete payload.
4. Check MCQ and true/false choice handling. For identification, verify current normalization against the stored correct answer; do not infer synonym matching or semantic grading from the word NLP.
5. Trace answer and score persistence, repeat submissions, concurrent submit/stop finalization, approved retake reset and stale category rows. Follow resulting required-progress and combined-evidence changes without conflating historical scores with final batch totals.
6. Use relevant existing tests or a minimal local reproduction when available. Record the exact command, observed result and untested cases. Do not run scoring functions against production: they persist answers and scores.

## Expected output

- Scope: reviewed endpoint, assessment scenario and evidence available.
- A table: case, expected raw/max/percentage or state, actual result, evidence and impact.
- Actionable findings with file and line references; distinguish confirmed defects from unverified concerns.
- Verification commands and results, plus a focused next step for each confirmed issue. If none are confirmed, say so and explain coverage limits.

## Example prompt

"Use $skillbridge-assessment-review to review an assessment containing 10 MCQ
questions in one category. Seven answers are correct and three questions are
omitted. Compare the expected full-assessment score with the actual submission
path, then check duplicate question IDs and retake behavior. Do not change code."

Expected output: compare the intended 7/10 = 70% with the observed denominator,
trace any discrepancy to the endpoint and helper, and report duplicate/retake
checks with evidence. Treat 70% as the scenario's expected full-assessment rule,
not a claim that the current implementation necessarily returns it.
