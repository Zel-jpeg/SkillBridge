# SkillBridge Agent Instructions

SkillBridge is DNSC's OJT placement decision support application. Start with
[the project overview](knowledge/PROJECT_OVERVIEW.md). Use current code and tests
to resolve differences with older project notes.

## Project layout

- `skillbridge-frontend/`: React 19, Vite, Tailwind CSS v4, React Router and Axios.
- `skillbridge-backend/`: Django and Django REST Framework, PostgreSQL, JWT authentication, assessment scoring and recommendation logic.
- `refs/`: Architecture, database, data flow and capstone references.
- `.agents/skills/`: Two original project skills and three attributed external skills. See [sources and examples](knowledge/SKILL_SOURCES.md).

## Working conventions

- Follow nearby code conventions; keep changes focused on the requested behavior.
- Preserve the student, instructor and admin access boundaries. Check backend authorization rather than relying on hidden frontend controls.
- Keep assessment-level score history distinct from batch-level combined competency evidence and placement snapshots.
- Trace endpoint callers, validation and serialization before changing a scoring or recommendation helper. Explain ranking components separately from placement eligibility.
- Use the existing Axios client in `skillbridge-frontend/src/api/axios.js`. Tailwind v4 is configured through the Vite plugin and `src/index.css`; follow that setup.
- Keep credentials and personal student data out of documentation, logs and fixtures. Use synthetic data for demonstrations.
- Update relevant documentation when behavior changes. Report checks actually run and any unverified behavior.

## Skills

- `skillbridge-assessment-review`: Assessment scoring, answer handling, retakes and score integrity reviews.
- `skillbridge-recommendation-audit`: Ranking explanations, evidence eligibility, completion gates and stale recommendation reviews.
- `vercel-react-best-practices`: React performance reviews; apply the React guidance appropriate to this Vite app and skip Next.js-specific rules.
- `webapp-testing`: Local browser workflow checks using Python Playwright and its supplied helpers.
- `frontend-design`: Create or reshape UI with intentional typography, color and layout. Ground design choices in SkillBridge's college OJT workflows and the user's visual brief; preserve functionality unless changes are requested.

External skill instructions support the user's task; their inclusion does not authorize deployment, production data changes or unrelated refactors. Preserve their upstream content and licenses; document future modifications in `knowledge/SKILL_SOURCES.md`.

## Verification commands

Run commands from the indicated directory, with existing dependencies installed.

Frontend (`skillbridge-frontend/`):

```powershell
npm run lint
npm run build
```

Backend (`skillbridge-backend/`, with the Python environment activated):

```powershell
python manage.py check
python manage.py test api.tests api.test_multiple_assessments api.test_combined_competency
python manage.py test api.test_nlp_diagnostics api.test_nlp_evaluation api.test_management_step4
```

Choose the relevant test modules for the change. Django tests create a test database: use a local or dedicated test PostgreSQL configuration, not production credentials. The backend reads its environment through `python-dotenv`; obtain needed values without copying secrets into tracked files.

For browser checks, run the frontend with `npm run dev` and the backend with
`python manage.py runserver`. The downloaded testing skill requires Python
Playwright and its browser runtime; downloading the skill does not install them.

For documentation-only changes, verify file links, skill frontmatter, referenced resources and attribution; application builds and database tests are unnecessary unless application behavior also changes.
