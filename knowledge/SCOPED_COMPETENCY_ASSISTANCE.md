# Scoped competency assistance

F06 adds optional category checks and saved-tag reuse to the F05 program library.
This feature does not connect the new library to assessment authoring or ranking;
those integrations remain F07 and F10 in the
[implementation tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md).

## Instructor workflow

1. Open Program competencies, select an assigned program and open a version.
2. Write category names, clear descriptions and tags manually. Review definitions
   against the actual curriculum or an applicable published competency standard.
3. In a category editor, optionally choose **Find saved tags**. An exact saved
   category name takes precedence over description similarity. Otherwise a clear
   match can offer that saved category's tags. Empty or uncertain results leave
   manual entry available. The system never invents discipline-specific tags.
4. **Add suggested tags** explicitly merges reviewed vocabulary after existing
   tags, preserving manual spelling/order, removing case-insensitive duplicates
   and respecting the remaining 30-tag allowance. An already over-limit manual
   draft is not truncated; normal save validation still applies.
5. **Check a question against saved categories** compares sample wording to this
   version's definitions. It displays a suggested name or ambiguous alternatives;
   it does not save a question, choose a grading category or change evidence.

Suggestions never fill fields automatically or save without form submission.
Cancel/discard preserves saved records. Editing the request text, switching
program/version or closing the editor invalidates pending/previous responses.
The view tracks a saved framework digest; a response from changed definitions is
withheld rather than presented against an older open draft. Failed assistance
does not prevent manual writing or saving. Normal stale-write protection still
applies independently when saving category definitions.

Optional source-based examples and attribution remain in the
[research document](DNSC_PROGRAM_AND_COMPETENCY_RESEARCH.md). Entrepreneurship and
Tourism examples are editable starting points for review, not required catalogs,
verified current DNSC curricula or product-specific branches. No live scrape or
external service is required to create categories.

## API and matching boundary

Approved instructors with a current assignment and admins can POST to:

- `management/programs/{program}/frameworks/{version}/assist/category/` with
  `question_text` (at most 4,000 characters).
- `management/programs/{program}/frameworks/{version}/assist/tags/` with optional
  `name` (100 characters) and `description` (2,000 characters).

The backend resolves the program and version through current access checks.
Same-program colleagues may reuse saved content; foreign programs, students and
revoked assignments cannot use guessed IDs. Archived/retired definitions remain
readable to authorized staff, consistent with F05. Assistance creates no rows,
audit/change events, questions, scores or recommendations and sends no text to
third parties.

`saved-framework-tfidf-v1` fits TF-IDF only to this version's saved categories.
Each document contains its name (100 characters), description (first 1,200) and
saved tags (first 600 joined characters, at most 30). The vectorizer uses English
stop words, Unicode accent normalization, unigrams/bigrams and up to 6,000
features. Query text does not fit the vocabulary. No global IC taxonomy, role
dictionary, program-name inference or cross-program corpus participates.

Cosine similarity must be at least 0.12 with two informative overlapping tokens,
or all informative name tokens. The top two candidates less than 0.06 apart
require manual review; up to three candidates can be shown. These conservative
heuristics are not calibrated accuracy/confidence or academic validity claims.
Single incidental words, empty catalogs, unknown vocabulary and ambiguous text
can abstain. Missing scikit-learn reports unavailable; exact-name saved-tag reuse
still works without it. Short or differently worded/non-English definitions can
miss relevant categories; manual selection remains necessary.

Every response identifies its method, framework and definition digest. Frontend
contracts reject malformed tags/matches or a different framework identity before
use. No global legacy suggestion behavior, recommendation formula, raw/max
grading, existing IC data or database schema changes in F06.

## Verification receipt

- Branch `codex/scoped-category-assistance`, base `ef3f603`.
- Full isolated PostgreSQL regression: **684 passed**,
  `work/organization-postgres-t71hpuxj/tests.txt`. Focused assistance/catalog run:
  **25 passed**, `work/organization-postgres-zxs8hcsc/tests.txt`.
- Frontend: **274 tests passed**, lint and production build passed. Django check,
  migration drift and whitespace checks passed. No migration was created/applied;
  configured migration 0036 and existing data remain unchanged by this feature.
- Final real-API production-build browser run: **seven groups passed**, no page
  errors, `work/organization-browser-_wtk56to/results.json`. Coverage includes
  description-only matching, unknown/ambiguous abstention, explicit tag merge,
  no save before submit, held responses after input/program changes, changed
  definition digests, unavailable HTTP/network assistance, successful manual
  saving, phone/dark layout, modal keyboard focus and Escape.
- Retained F05 catalog browser acceptance: **six groups passed**, no page errors,
  `work/organization-browser-yuia3zww/results.json`. Creator/peer access, search,
  pagination, stale edits, freeze, clone lost-response retry, retire and revoke
  remain intact. Desktop/phone images in `work/organization-browser-miif63f1/`
  were visually reviewed; final images are in the final run above.
- Earlier browser harness issues were corrected: explicitly await the held API
  response, scope suggestion assertions away from description fields and native
  dialog toasts, and use the actual program-radio accessible name. Final checks
  passed; no application failure remains open in F06.
- Owned database/server/browser helpers stopped. Browser SSE is disabled in the
  fixture; current scope checks and F05 invalidation have separate API/unit tests.
  No hosted behavior, arbitrary curriculum validity or matching accuracy claim.

Local implementation/merge commit is recorded in the tracker after commit.
No GitHub push or deployment.
