---
name: skillbridge-recommendation-audit
description: Audit SkillBridge student-to-position ranking, combined competency evidence, completion gates, NLP and location components, and stale recommendation visibility. Use for unexpected ranking results, missing recommendations or eligibility explanations.
metadata:
  author: SkillBridge project team with Codex assistance
  origin: Original project skill
---

# SkillBridge Recommendation Audit

Explain why a position ranks or why recommendations are locked using the current
code and available evidence. Separate ranking similarity from placement approval
eligibility. A review request does not authorize recomputation of live records.

## When to use

Use for ranking discrepancies, missing recommendations, completion locks, model
fallbacks and reviews of recommendation changes. For individual answer grading,
use the assessment review workflow.

## Project references

Paths below are relative to this skill folder:

- [Combined competency](../../../skillbridge-backend/api/combined_competency.py): eligible evidence, weighted totals, finalization and invalidation.
- [Progress rules](../../../skillbridge-backend/api/assessment_progress.py): current enrollment and required assessment completion.
- [Scoring and ranking](../../../skillbridge-backend/api/scoring.py): category vectors, TF-IDF, component weights and stored results.
- [NLP helpers](../../../skillbridge-backend/api/recommendation_nlp.py): generated profile text, tags, preprocessing and location similarity.
- [Models](../../../skillbridge-backend/api/models.py) and [views](../../../skillbridge-backend/api/views.py): recommendation fields, serialization, visibility and placement approval.
- [Combined tests](../../../skillbridge-backend/api/test_combined_competency.py), [NLP diagnostics](../../../skillbridge-backend/api/test_nlp_diagnostics.py) and [management tests](../../../skillbridge-backend/api/test_management_step4.py): existing evidence and approval scenarios.

## Workflow

1. Identify the student's batch, required assessment progress, response states, included evidence, position requirements and recommendation timestamp. Use synthetic data or authorized local fixtures; label missing data explicitly.
2. Trace `eligible_evidence`, `required_progress` and `combined_is_unlocked`. Check submitted versus stopped/flagged responses, published versus closed evidence, inclusion settings, active batch, finalized profile and included assessment IDs. A locked result is not necessarily a ranking defect.
3. Reconstruct category totals as sums of eligible raw and maximum scores, then calculate percentages. Do not average percentages from assessments with different maximum scores. Confirm both category vectors share the same category ID ordering.
4. Read the actual ranking weights and component scales from code. At creation this uses 0.60 category + 0.25 NLP + 0.15 location, with normalized components before conversion to a percentage. Explain rounding; stored rounded components may not reproduce the last decimal of the stored total.
5. Trace generated profile/position text, selected versus actual preprocessing model, vocabulary and location handling. Inspect zero-skill evidence, positions without usable requirements, empty TF-IDF vocabulary, missing coordinates and model fallback if relevant. Reproducing NLP scores requires the same candidate corpus and preprocessing, not just a single position.
6. Trace `is_current`, batch filters, unlock checks and response limits into the displayed list. Inspect placement approval separately for current evidence, capacity and existing placement constraints; do not describe a similarity score as a probability of success or guaranteed eligibility.
7. Verify with relevant local tests or pure calculations. `ensure_combined`, recalculation and generation helpers can write to the database even when used during a read flow: do not call them merely to inspect live results. State unverified runtime behavior.

## Expected output

- Evidence summary: batch, completion state, included assessments and model used.
- Ranking table: position, category/NLP/location components, weighted total and displayed order; mark unavailable values.
- Explanation of locks, exclusions, stale evidence or approval constraints, with file and line references.
- Confirmed findings, verification results and focused next steps. Clearly distinguish computed examples from observed saved results.

## Example prompt

"Use $skillbridge-recommendation-audit to explain a synthetic position with category
similarity 80%, NLP similarity 60% and location similarity 50%. Calculate its
weighted score using current code, then explain which completion and evidence
checks are needed before it can be shown to a student. Do not write to the database."

Expected output: with the current 60/25/15 weights, compute 48 + 15 + 7.5 = 70.5%,
then explain active-batch, required-completion, finalized/current evidence and
visibility checks separately from placement approval. Do not invent a real rank
without candidate positions and saved evidence.
