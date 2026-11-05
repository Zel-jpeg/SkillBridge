# General category result and NLP text — F08

This feature replaces automatic computing/career orientations with the student's
actual highest-scoring assessed categories. It does not infer suitability for IT,
IS, Tourism or another program from keywords. Exact highest ties are retained;
assessed zero is distinct from missing/invalid evidence. See the
[tracker](MULTI_INSTITUTE_IMPLEMENTATION_TRACKER.md) for delivery status.

## Result guidance

New profiles use **Highest-scoring assessed area** or **Highest-scoring assessed
areas (tied)**, with category names/percentages in the summary. All-zero profiles
have no positive orientation. Nonfinite, out-of-range or missing percentages and
rows with a nonpositive known maximum are omitted rather than converted to zero.
No scores, answers, retakes or history are changed.

Student/staff practice advice uses the program's course materials, explaining the
approach, checking the expected result and discussion with an instructor. Support
levels follow the existing bands. Display names no longer automatically select
computing-specific tasks. The old `developmentActivities.json` is historical
reference content, not a runtime authority for arbitrary programs. Topic tags stay
optional review examples, separate from individually measured skills or mastery.

## Actual inputs and provenance

Text policy is `general-category-context-v4`. Student matching text excludes the
display orientation summary. Both student evidence and position requirements use
the same saved names/bands/vocabulary and one **Contextual category definition**
per positive category. Definitions use the first **160 characters and at most 12
words**, whitespace normalized, without score-weighted repetition. Long tails
cannot increase contribution simply by adding words. Zero/missing evidence gets
no positive definition/tag expansion. Definitions describe the category, not which
individual topics a student answered correctly. Advice is not an NLP input.

New `supporting_categories` JSON snapshots retain category/framework IDs, selected
matching-context tags/definition and text version; no schema change. Older saved
profiles remain untouched. Diagnostics distinguish a known saved version from an
unknown legacy version/current preview. Previews never write or rerun rankings.
Combined profiles retain their text version. Ranking provenance includes the
version and effective bounded legacy definitions: changes inside the used prefix
invalidate rankings; excluded-tail, branding and capacity changes do not become
text changes. Scores and historical placement snapshots remain intact.

Before F09/F10, framework evidence absent from the legacy catalog yields no new
recommendation rows. Valid category results still finalize/display; they must not
enter an unrelated catalog or fail a result read. F10 supplies compatible scoped
categories/candidates. This feature does not claim complete program matching.
Current assessment-led numerical priorities and exact answer grading stay intact.

## Verification and limits

- Four real browser groups passed, no page errors:
  `work/organization-browser-si6brsva/results.json`. Entrepreneurship/Tourism
  **examples** and an arbitrary third program use identical code, ten questions
  and two categories each. Two cases score 4/5 (80%) in both, exact ties; the third
  scores 0/5 in both. Student results, actual raw/max, phone/light/dark/no-overflow,
  authorized symmetric NLP previews/version and actual CSV reports passed. Phone
  result and zero screenshots were visually read.
- `work/f08-definition-ablation.json` records three synthetic cases under current
  neutral templates with/without definitions and deterministic regex/TF-IDF.
  Intended categories remain the largest text similarity; about 0.896 becomes
  0.917–0.928. This demonstrates inputs, not academic accuracy, actual DNSC
  curriculum validity, population outcomes or a trained-model improvement.
- Earlier checks exposed percentage-only fixtures without denominators, obsolete
  computing-label/case expectations, and a real scoped-result failure in legacy
  ranking. Fixtures/contracts were updated; the guarded ranking boundary has an
  API regression. An accidentally removed compatibility re-export failed Django
  check and was restored. Final counts follow after all gates pass.

## Final verification receipt

- **710 backend tests passed**, `work/organization-postgres-__wu8wku/tests.txt`;
  focused 92 passed at `work/organization-postgres-q4ze8dva/` before the final
  ID-only score compatibility fix, which the complete run covers.
- **274 frontend tests**, lint/build, Django check/drift and 149 document links
  passed. One obsolete built-in alias activity test was replaced by arbitrary
  program guidance coverage; no failing test was waived.
- Final cross-program/results/actual CSV-download browser: **five groups passed**,
  no page errors, `work/organization-browser-1siirutz/results.json`.
- Retained result navigation/accessibility: **four groups passed** at 320/375/
  768/1440 pixels, `work/organization-browser-k9v423i8/browser.txt`; no page errors,
  exact score precision, answer disclosure, keyboard and no-overflow checks.
- Additional F01 catalog/browser regression: **11 groups passed**,
  `work/organization-browser-cj19pqor/results.json`. Its first invocation selected
  the default catalog suite before the new navigation flag was wired; the actual
  navigation suite was explicitly rerun above.
- No owned test/database/browser helpers remain. No migration, configured-data
  write, real rerun, GitHub push or deployment. Local commit is in the tracker.

Implementation `faa4c6b` was fast-forward merged into local main after all gates
passed. No GitHub push or deployment.
