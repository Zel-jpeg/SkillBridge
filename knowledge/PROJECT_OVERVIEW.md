# SkillBridge Project Overview

SkillBridge is a web-based On-the-Job Training placement decision support system
for Davao del Norte State College (DNSC). Students complete skill assessments;
instructors manage assessments and batches; admins manage companies, positions,
users and placement workflows. Recommendations support placement decisions.

## Architecture

| Area | Implementation | Entry points |
| --- | --- | --- |
| Frontend | React 19, Vite, Tailwind CSS v4, React Router, Axios | [App.jsx](../skillbridge-frontend/src/App.jsx), [Axios client](../skillbridge-frontend/src/api/axios.js) |
| API and authentication | Django 6, DRF, JWT, Google authentication integration | [Routes](../skillbridge-backend/api/urls.py), [views](../skillbridge-backend/api/views.py) |
| Persistence | PostgreSQL; Django models and migrations | [Models](../skillbridge-backend/api/models.py), [settings](../skillbridge-backend/core/settings.py) |
| Assessment scoring | MCQ, true/false and identification; per-category raw, maximum and percentage scores | [Scoring](../skillbridge-backend/api/scoring.py) |
| Combined competency | Batch-scoped totals from eligible assessment evidence and required completion gates | [Combined competency](../skillbridge-backend/api/combined_competency.py), [progress rules](../skillbridge-backend/api/assessment_progress.py) |
| Recommendations | Category cosine similarity, NLP TF-IDF similarity and location similarity | [Ranking](../skillbridge-backend/api/scoring.py), [NLP helpers](../skillbridge-backend/api/recommendation_nlp.py) |

Dependency manifests are [package.json](../skillbridge-frontend/package.json),
[requirements.txt](../skillbridge-backend/requirements.txt) and
[optional NLP requirements](../skillbridge-backend/requirements-nlp.txt).

## Main data flow

1. An instructor creates batch assessments, questions, answer choices and skill categories.
2. An enrolled student starts and submits an assessment; backend access and attempt-state checks control submission.
3. The backend grades answers and stores assessment-level `SkillScore` rows.
4. Combined competency aggregates eligible category raw and maximum totals across assessments; it does not simply average percentages.
5. Required completion and active-batch gates control finalization and recommendation visibility.
6. Ranking combines category, NLP and location similarity. The current implementation uses weights of 60%, 25% and 15%; inspect current code when auditing rather than assuming these remain fixed.
7. Placement approval applies additional rules and saves snapshots. A high recommendation score alone does not establish approval eligibility.

NLP models are optional and loaded lazily. The implementation has deterministic
regex preprocessing when optional models are unavailable; record the actual model
and fallback when explaining results.

## Existing knowledge

- [Master project context](../refs/SKILLBRIDGE_MASTER_CONTEXT.md): Broad background and historical status; some details predate the current code.
- [Entity relationship reference](../refs/SkillBridge_ERD.md): Database design reference.
- [Data flow reference](../refs/SkillBridge_DataFlowDiagram.md): System process reference.
- [Capstone defense reference](../refs/CAPSTONE_DEFENSE_REFERENCE.md): Presentation context.
- [Skill sources and demonstration prompts](SKILL_SOURCES.md): Original versus downloaded skills, provenance and examples.
- [Agent instructions](../AGENTS.md): Development conventions and verification commands.

## Assignment deliverables

The five skills are two original SkillBridge review workflows and three downloaded
skills from Vercel Labs and Anthropic, including the additional `frontend-design`
skill for UI work. `AGENTS.md` and the knowledge files are
supporting documentation, separate from the minimum four-skill requirement. Original workflows
were generated with Codex for the SkillBridge project; external workflows retain
their original authorship. This setup changes documentation and skill packages,
not application code.
