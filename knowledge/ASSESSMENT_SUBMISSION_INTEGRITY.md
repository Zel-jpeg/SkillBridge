# Assessment submission integrity

New submissions and integrity stops grade every question currently belonging to
the assessment exactly once. Each categorized question contributes one to its
category maximum, even if omitted or cleared. Empty submissions are accepted:
they finalize with zero raw scores against the full category maxima. Integrity
stops save only completed answers and remain flagged/stopped; they do not count
as eligible combined evidence or satisfy required completion.

Both endpoints validate the complete `answers` list before writing answers,
scores or finalization. Entries must be objects with unique positive JSON integer
`question_id` values belonging to the assessment. A non-null
`selected_choice_id` must be a positive JSON integer belonging to that question;
identification questions use string `text_answer` values. Missing/null choices
and empty text represent unanswered inputs. Malformed, duplicate and foreign
entries return HTTP 400 with an `answers` field describing the error. Cleared
inputs are validated before deciding whether there is completed evidence to save.

MCQ/true-false use the stored choice flag. Identification is exact after trimming
and lowercasing both strings; synonyms, extra words and NLP similarities do not
affect grading. Questions without a category cannot produce a category score.
Publication validation still requires categories for normal authored questions.

The grader validates first and writes atomically within the endpoint's locked
attempt transaction. Finalization occurs only after grading succeeds. The
existing approved-retake path snapshots finalized evidence, clears current
answers/scores and invalidates combined results. Combined evidence continues to
sum eligible assessment raw/max values, rather than averaging percentages.

This corrects future submissions only. Existing real score, attempt and placement
records are not recalculated or migrated. Any historical repair would require a
separate reviewed plan and explicit authorization.

Regression coverage: `api.test_submission_integrity`, `api.tests`,
`api.test_multiple_assessments`, and `api.test_combined_competency`. SQLite checks
exercise validation, arithmetic, rollback and lifecycle behavior; PostgreSQL
locking/concurrency requires separate verification and is not inferred from them.

## Attempt duration and retake identity

`/start/` now returns `attempt_started_at`, server time, duration deadline, grace
deadline and `remaining_seconds`. Submit and integrity-stop requests must include
the exact `attempt_started_at` value for the current attempt; the response row ID
alone is insufficient because approved retakes reuse that row. Missing or stale
identity returns 400 without modifying the attempt. The frontend persists this
identity with its integrity marker and uses server remaining time plus
`performance.now()` for the active countdown. Changing the browser wall clock
does not extend a server deadline.

The accepted local policy (18 October 2026) allows submission through exactly
30 seconds after the attempt duration ends. A later request saves validated
answers and category scores as stopped, flagged review evidence with reason
`attempt_expired`. The response truthfully reports `review_required: true`; it
does not count as required completion or unlock combined recommendations. Staff
can inspect the recorded attempt and grant a retake using the existing workflow.
No late answer is silently converted into ordinary accepted evidence. Due dates,
publication and batch availability remain separate existing access gates.

Submit/stop use the same row lock. Retrying a stopped attempt does not rescore or
append integrity events; a submit after finalization returns conflict. Retake
history snapshots preserve late-review evidence. The browser keeps local answers
when a write cannot be confirmed and offers explicit recovery without claiming
success. Browser evidence uses an isolated SQLite API and blocked remote requests;
it does not establish PostgreSQL concurrency behavior.

## Slow submission acknowledgements

The assessment submit request allows 120 seconds for grading and recommendation
generation, including first-use NLP model loading. Other API requests retain the
shared 30-second timeout. A client timeout does not roll back a server save.
After a failed submit or integrity-stop request, the frontend reads the assessment
list directly and checks the same assessment and exact attempt start identity
(including fractional seconds). A confirmed submitted attempt opens its results;
a confirmed stopped attempt shows its recorded stop. This avoids retrying a saved
submission or presenting a finalized-attempt conflict as an unreachable server.
Unconfirmed saves retain local answers. Recovery also clears stale local markers
for finalized attempts without posting another stop. Active-attempt focus,
fullscreen and visibility rules remain in force.

`tests/assessment_submission_timeout_playwright.py` passed all six cases with
zero page errors on 20 October 2026. It exercises synthetic API
responses in headless Chrome: a 31-second successful response, a saved write with
an actual browser timeout, a stop conflict for a submitted attempt, an unsaved
write, a stale finalized marker and a different retake identity. This browser
coverage does not measure live model loading or operate the real database.
