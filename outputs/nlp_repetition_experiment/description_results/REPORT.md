# Concise description experiment

Same 60 synthetic development cases and six positions. Actual spaCy Medium; no fallback, new model, new facts, application edits or database access. All numerical category inputs are unchanged; hybrid stays 60/25/15 with neutral location. TF-IDF fits per student.

Structured category/location control: **90.0% Top-1**.

| Text | Matcher | NLP Top-1 | NLP Top-3 | Hybrid Top-1 | Hybrid helped / hurt vs current |
|---|---|---:|---:|---:|---:|
| current | tfidf | 65.0% | 100.0% | 80.0% | 0 / 0 |
| current | native_vectors | 81.7% | 100.0% | 88.3% | 0 / 0 |
| previous_readable | tfidf | 61.7% | 96.7% | 86.7% | 4 / 0 |
| previous_readable | native_vectors | 33.3% | 80.0% | 90.0% | 1 / 0 |
| concise_bands | tfidf | 68.3% | 96.7% | 80.0% | 3 / 3 |
| concise_bands | native_vectors | 63.3% | 86.7% | 90.0% | 1 / 0 |
| concise_topics | tfidf | 65.0% | 96.7% | 80.0% | 4 / 4 |
| concise_topics | native_vectors | 65.0% | 88.3% | 90.0% | 1 / 0 |

## Fixed comparison plan

- **current:** Exact production-generated text with repeated evidence.
- **previous_readable:** Previous narrative-only input; unchanged reference.
- **concise_bands:** Canonical category, competency band and unchanged selected tags, once. No title/company/orientation; position vocabulary once; numbers remain numerical.
- **concise_topics:** Same concise input with bands removed; numerical component retains scores. Selected-tag counts still depend on scores as in production.

The new matching text renders each category and its selected vocabulary once. Shared terms can legitimately occur in multiple categories. It drops titles, companies, orientation sentences and numeric percentages. Display descriptions retain exact percentages and distinguish contextual vocabulary from individually assessed technology skills. Bands are tested separately. The existing score-dependent tag selection is preserved, so this does not remove all score influence from text.

## What the test can establish

It measures wording/representation effects using existing category tags and position vocabulary. It does not test confirmed duties or question-level skill evidence: those are absent, and none were invented. Improving prose cannot supply missing evidence. Student text receives no expected or inferred position title. Position vocabulary is retained as context, not asserted as confirmed duties.

TF-IDF is the current system method. Native vectors are a separate exploratory comparator, using raw Doc.vector cosine with negatives clipped only for hybrid scoring. Neither model nor weights were tuned after results. These familiar synthetic labels are not independent real placement validation.

Compare each result with both its current matcher baseline and the 90% structured control. A hybrid gain alone does not establish better NLP. results.json contains per-role metrics, helped/hurt cases, score dispersion and integrity checks; rankings.csv contains every candidate score.

## Example display text

**Student:** Assessment results: Programming 95% (excellent); Database 90% (excellent); Networking 45% (basic); Web Development 80% (strong); Cybersecurity 55% (basic). Category vocabulary is contextual and does not establish separately assessed technology skills.

**Position:** Backend Developer Intern at ABC Software Solutions. Required category percentages: Programming 92%; Database 84%; Networking 38%; Web Development 76%; Cybersecurity 52%. Position vocabulary: backend, server-side, REST API, Django, Flask, authentication, database integration, business logic, API endpoint. Vocabulary does not confirm specific job duties.

## Example matching inputs

### concise_bands

**Student:** cybersecurity basic. Contextual vocabulary: authentication, encryption. database management excellent. Contextual vocabulary: SQL, PostgreSQL, MySQL, ERD, normalization, indexing, query optimization, database design. networking basic. Contextual vocabulary: TCP/IP, routing. programming excellent. Contextual vocabulary: Python, Java, JavaScript, OOP, algorithms, data structures, debugging, Git. web development strong. Contextual vocabulary: HTML, CSS, JavaScript, React, responsive design, web API, frontend, DOM.

**Position:** cybersecurity basic. Contextual vocabulary: authentication, encryption. database management strong. Contextual vocabulary: SQL, PostgreSQL, MySQL, ERD, normalization, indexing, query optimization, database design. networking basic. Contextual vocabulary: TCP/IP, routing. programming excellent. Contextual vocabulary: Python, Java, JavaScript, OOP, algorithms, data structures, debugging, Git. web development proficient. Contextual vocabulary: HTML, CSS, JavaScript, React, responsive design. Position vocabulary: backend, server-side, REST API, Django, Flask, authentication, database integration, business logic, API endpoint.

### concise_topics

**Student:** cybersecurity. Contextual vocabulary: authentication, encryption. database management. Contextual vocabulary: SQL, PostgreSQL, MySQL, ERD, normalization, indexing, query optimization, database design. networking. Contextual vocabulary: TCP/IP, routing. programming. Contextual vocabulary: Python, Java, JavaScript, OOP, algorithms, data structures, debugging, Git. web development. Contextual vocabulary: HTML, CSS, JavaScript, React, responsive design, web API, frontend, DOM.

**Position:** cybersecurity. Contextual vocabulary: authentication, encryption. database management. Contextual vocabulary: SQL, PostgreSQL, MySQL, ERD, normalization, indexing, query optimization, database design. networking. Contextual vocabulary: TCP/IP, routing. programming. Contextual vocabulary: Python, Java, JavaScript, OOP, algorithms, data structures, debugging, Git. web development. Contextual vocabulary: HTML, CSS, JavaScript, React, responsive design. Position vocabulary: backend, server-side, REST API, Django, Flask, authentication, database integration, business logic, API endpoint.

## Verification

- Same dataset and production generator hashes as earlier test
- Expected-label permutation leaves text/category inputs unchanged
- Zero-score category supplies no positive vocabulary
- New text uses no expanded evidence repetitions
- Stable category ordering
- Prior Medium TF-IDF baseline metrics reproduced exactly
- No Django database imports; source/data unchanged; no fallback/downloads
