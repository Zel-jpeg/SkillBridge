# Local NLP runtime and fallback verification

## Comparison request timeout (21 October 2026)

A database-free prepared comparison in the normal Windows environment completed
all three models in 137.06 seconds. spaCy Small/Medium finished preprocessing by
14.63 seconds; Stanza loaded by 24.48 seconds and finished preprocessing at
136.96 seconds. These are one-run diagnostic timings, not performance acceptance
measurements. The previous browser limit of 120 seconds abandoned the response
before completion and displayed a misleading backend-connection error.

The comparison request now waits up to 300 seconds, with loading text explaining
the wait. Axios timeout errors explicitly identify the five-minute limit and
warn that server evaluation may still be running; network failures and HTTP
errors retain separate safe messages. No retry is automatic. Comparison still
does not save recommendations or select a model. Local model resources can
differ from the sandbox environment, where this probe completed with Stanza
unavailable rather than evaluating it.

## Earlier model and fallback verification

The existing `RecommendationConfiguration` default remains `spacy_md`. The
continuous system checklist does not change the active production selection or
the research evaluation plan. A local, database-free probe loaded the actual
spaCy Medium resource with strict fallback disabled and processed synthetic text.

Observed runtime on 18 October 2026: spaCy 3.8.16 and `en_core_web_md` 3.8.0;
requested and actual model were both `spacy_md`. The first load plus three texts
took 9.0896 seconds in that one probe, including import/load time; this is not
web latency or an accepted performance claim. Small/medium packages were present;
Stanza English resources were absent. All comparison models are not required in
the live ranking runtime. No startup/request-time download is added.

Production preprocessing falls back from a failed selected medium/Stanza model
to installed spaCy Small, then deterministic regex if Small also fails. The
actual returned/saved model ID identifies that fallback. Strict comparison mode
raises a model/resource failure instead of substituting another model's metrics.
Existing comparison tests confirm unavailable/failed models have error status
and no fabricated accuracy values. This task verifies runtime mechanics, not
an accuracy target or a new research model-selection decision.

Ranking handles an empty processed vocabulary with zero text similarity. With no
usable positions or all-zero evidence it produces no current recommendations.
Combined profiles now leave `model_used` empty when no recommendation result
supplies an actual model ID; configured intent is kept in `active_model`.
Previously that empty-result path falsely copied the requested model into
`model_used`. The student view now shows “No model result available” for that
absence, while a real fallback ID remains visible. Existing real history is not
silently regenerated or repaired.

Evidence: `work/defense_audit/probe_nlp_runtime.py` and its `n01-runtime.json`;
`api.test_nlp_runtime`, existing evaluation/diagnostic/combined/management suites
and `tests/nlp_model_reporting_playwright.py`. The continuous checklist stores
the exact passing commands and any broader acceptance work still pending.
