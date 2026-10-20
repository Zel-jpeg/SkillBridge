# NLP improvement rollback

20 October 2026. The user cancelled the NLP improvement work and explicitly
selected deletion of all experiment storage from configured Supabase after the
four tables and six position fields were explained. This supersedes the original
continuous implementation request. Do not resume the phases on CONTINUE.

The original ranking text, model selection, 60/25/15 weights and persistence path
are restored exactly from HEAD. The new matching comparison, suggestion catalog,
position duty/tool previews, question annotations and assessed-evidence panels,
their endpoints, mutation hooks and invalidation additions are removed. Original
editable position tags, category requirements and existing NLP diagnostics remain.
The paper/design files are restored to their earlier proposal state.

## Database cleanup

Historical migrations 0016–0018 remain so installed databases keep a coherent
migration history. New Django migration
[0019_remove_nlp_experiment](../skillbridge-backend/api/migrations/0019_remove_nlp_experiment.py)
removes only:

- api_suggestionrole, api_suggestionskill, api_suggestioncatalogrevision.
- api_questionskillannotation.
- Position confirmed_duties, confirmed_technologies, duty_revision,
  duty_generation_version, duty_reviewed_by and duty_reviewed_at.

It does not remove the Position table or original company/position data. Original
student accounts, questions, answer choices, responses, scores, combined evidence,
recommendations, configuration and placements are preserved. Removing this storage
loses its experiment contents; reversing schema migration cannot recover those
contents. No original production recommendation regeneration is needed.

Migration status and final verification are recorded in
[the checkpoint](NLP_IMPLEMENTATION_CHECKPOINT.md). After application/schema cleanup,
restart any already-running local backend and refresh the frontend. No deployment
is part of this rollback.

## Preservation and recovery

Before editing, NLP source/documents/offline outputs and the complete tracked diff
were copied to ignored work/defense_audit/nlp-rollback-2026-10-20/. The archive
contains source only, not an export of real student or Supabase records. Other
workspace changes, including enrollment, name formatting, address, responsive UI
and independent defense-review work, are preserved. Nothing is staged or committed.

Logs: ignored work/defense_audit/nlp-rollback-*.
