# SkillBridge research and documentation follow-up

Separated on 18 October 2026 from the system completion checklist after the user clarified the goal: complete and test all agreed features locally, then host and verify before the defense.

These are retained research, manuscript, progress-report and formal UAT prompts from the earlier broader plan. They do not count toward the system feature completion percentage. IDs and descriptions here are historical; the [system checklist](SkillBridge_Completion_Checklist_and_Prompts.md) controls application work. Some historical entries also contain runtime considerations now covered by the revised system tasks. Do not execute overlapping work twice.

### N01 Reconcile selected NLP model and timing evidence

**Basis:** Objective 3 and functional requirement 10. Paper selects spaCy small; saved final-hybrid notebook selects medium; current model configuration defaults to medium. Hybrid notebook times are 5.948392 / 5.350007 / 138.789032 seconds, whereas paper Table 5 uses 6.092 / 6.114 / 159.761. NLP-only timings differ as well.

**Acceptance:** Identify authoritative experiment/run, dataset version, model/toolkit versions, hardware, timer boundaries and repeated timings. Explain the selection rule; record requested and actual runtime model and fallback. Local Stanza resources were unavailable in the audit, but all three preprocessors do not necessarily need to be installed in production. Do not choose a model simply to match an existing paragraph.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md and the recommendation-audit skill. Read N01 in outputs/defense-review/SkillBridge_Research_and_Documentation_Backlog.md. Reconcile the paper, both supplied notebooks, model configuration and actual preprocessing resources. Explain the conflicting timing runs and model selections, then establish a reproducible experiment and justified selection using recorded hardware, versions, workload and repeated measurements. Keep notebook/source originals intact and label any new run. Do not change the production model setting or download/install large model resources without task authorization. Prepare corrected selection and timing text based on evidence.
```

### N02 Align experiment descriptions with actual ranking

**Basis:** Objectives 3-4; functional requirements 9-11. The notebook fits TF-IDF over the generated cohort and positions; current runtime fits over one student and candidate positions. Both use text preprocessing and TF-IDF/cosine, rather than directly ranking with spaCy medium's dense vectors.

**Acceptance:** Document actual corpus, generated text, weights, candidate pool, zero/missing evidence and location behavior. Clearly distinguish batch timing from end-to-end latency, hybrid scores from isolated NLP performance, and Hit Rate@3 from Precision@3. Preserve completion/eligibility gates. Decide whether to adapt the evaluation or implementation only after the difference is understood; do not alter weights to improve reported scores.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md and the recommendation-audit skill. Read N02 in outputs/defense-review/SkillBridge_Research_and_Documentation_Backlog.md. Compare the notebook evaluation pipeline with actual runtime text generation, TF-IDF corpus, category/location components, weights and eligibility gates. Build a reproducible synthetic comparison and explain which saved metrics describe which pipeline. Correct misleading methodology/metric descriptions. Propose any needed alignment before changing ranking behavior; preserve 60/25/15 unless an explicit project decision authorizes a change. Do not modify expected labels to fit predictions or rewrite live recommendations.
```

### N03 Agree independent placement evaluation and NLP ablations

**Type:** Research decision and additional evidence, not a wholly missing system module. Required evidence depends on the claims and adviser-approved study design. Existing 300-profile results are synthetic; NLP-only Top-1 is 93%, hybrid is 89.33%.

**Acceptance:** Agree independent evaluation/labeling and held-out design; compare assessment+location, text-only and complete hybrid under the same conditions. Report Top-1, Hit Rate@3, macro P/R/F1, per-role diagnostics and timing. Add Precision@3 only with appropriate relevance judgments. Do not claim universal passing percentages, independent validation from recommender-influenced approvals, or real-world success from synthetic labels.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md and the recommendation-audit skill. Read N03 in outputs/defense-review/SkillBridge_Research_and_Documentation_Backlog.md. Prepare an adviser-reviewable plan for independent placement relevance evaluation and same-condition no-NLP, NLP-only and hybrid comparisons. Specify labels, data separation, candidate pool, metrics, baselines and timing. Identify what can be tested now with synthetic data and what needs independent human judgments. Do not invent labels, participants, outcomes or a universal acceptable accuracy threshold. Use real records or collect human data only within the authorization available for that work.
```

### V08 Conduct user acceptance testing and analyze results

**Basis:** Paper's UAT section and non-functional usability. No completed participant responses were supplied.

**Acceptance:** Adviser-approved participant approach, task scripts, rating scale and interpretation. Include student, instructor and administrator tasks; record completion, critical errors and feedback. Analyze only genuine supplied responses; distinguish task correctness from perception ratings and UAT from NLP accuracy. Apply the institution's applicable consent/privacy process without inventing approvals.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read V08 in outputs/defense-review/SkillBridge_Research_and_Documentation_Backlog.md and the paper's User Acceptance Evaluation section. Prepare role-specific task scripts, an adviser-reviewable questionnaire, scoring/interpretation rules and an issue log for the selected quality characteristics. Once genuine authorized responses are supplied, analyze them reproducibly and report limitations and failed tasks. Do not invent participants, answers, approval signatures or successful acceptance. Collect or contact participants only when explicitly authorized for that activity.
```

### D01 Reconcile the complete capstone manuscript

**Basis:** Paper/code/experiment mismatches and panel document revisions.

**Acceptance:** Align the five objectives and 13 FR/eight NFR with actual behavior; reconcile staff login, sessions, NLP selection, pipeline/timing, synthetic evaluation, UAT status, backup/failover and maintenance claims. Explain exact-normalized identification rather than semantic free-text grading. Preserve system-generated recommendations versus human placement decisions. Replace unsupported superiority, bias-elimination or real-world-effectiveness claims. Check figures, captions, references and current page numbering; preserve original sources.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read D01 and the completed evidence in outputs/defense-review/SkillBridge_Research_and_Documentation_Backlog.md. Review the latest full capstone manuscript against current code and verified tests. Prepare accurate revisions for objectives/IPO, functional/non-functional requirements, authentication/session behavior, NLP model and pipeline, timing/results, synthetic-data limitations, UAT, deployment, backups/failover and maintenance. Preserve evidence and distinguish planned from completed activities. Check figures/captions/page references and unsupported performance or bias claims. Do not invent study results or declare unresolved requirements complete; preserve the original manuscript.
```

### D02 Update all 17 defense-minute action items

**Acceptance:** Each panel comment has actual action, status, evidence and current paper page if applicable. Existing implemented features should no longer be described only as planned once verified. Mark pending LMS samples, agency-demand interpretation and acceptance evidence honestly. Do not add signatures, backdate approvals or claim a visual correction without comparing the intended figure.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read D02 in outputs/defense-review/SkillBridge_Research_and_Documentation_Backlog.md. Reconcile every one of the 17 visible panel comments in the supplied defense minutes against current implementation, the latest paper and completed verification records. Prepare concise Actions Taken text with evidence and current page references. Separate implemented, verified, pending and adviser-decision items; preserve unresolved institutional-format questions. Do not invent signatures, dates of approval, prior-version comparisons or completed tests.
```

### D03 Refresh the October 19 progress report

**Deadline:** 19 October 2026. This task need not wait for every release task; disclose incomplete work and update its status as of the real reporting date.

**Acceptance:** Follow Introduction/Gantt Chart, Project Status, Work Completed, Work in Progress and Conclusion. Include actual recent accomplishments, evidence, challenges, remaining corrections and realistic targets. Reconcile names, adviser/reporting dates and schedule with the team. Do not use model accuracy as the project's completion percentage or claim 100% readiness without accepted evidence.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read D03 in outputs/defense-review/SkillBridge_Research_and_Documentation_Backlog.md and the existing October 19 progress report draft. Update the report using actual task outcomes and the school's supplied format. Keep completed work, open defects, verification gaps and proposed dates distinct. Include the Gantt chart, evidence, challenges/responses, work in progress and next steps toward the first-week-of-November defense. Do not invent historical completion dates, UAT results or an overall completion percentage. Produce a reviewable report and flag only material team/adviser details still needing confirmation.
```

### D04 Perform final readiness review and defense rehearsal

**Dependency:** Required corrections, acceptance criteria and material adviser decisions must be closed or explicitly accepted. Target readiness review 30 October and rehearsal/contingency 31 October, subject to the actual defense schedule.

**Acceptance:** One checklist maps all objectives, FR/NFR and panel items to current release evidence. Repeat relevant regression/build checks on the release being demonstrated; show tested commit and known limitations. Rehearse all three roles, scoring, ranking explanations, locations, company-first suggestions, capacity/approval/history, reports and failure recovery using synthetic records. Prepare sample exports, operator guidance and a contingency demo. Zero future defects or 100% NLP accuracy are not valid release promises.

**Copyable prompt:**

```text
Follow SkillBridge AGENTS.md. Read D04 and the completed task evidence in outputs/defense-review/SkillBridge_Research_and_Documentation_Backlog.md. Perform a final readiness review of the exact release intended for defense, mapping all five objectives, 13 functional requirements, eight non-functional requirements and 17 panel comments to observed evidence. Run relevant release checks and rehearse the complete three-role demo with synthetic data, sample reports and a contingency plan. Report ready, conditionally ready or not ready with explicit remaining blockers; do not force a 100% result. Prepare deployment steps without publishing or changing production records unless separately authorized.
```
