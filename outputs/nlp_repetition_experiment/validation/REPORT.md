# Offline repetition experiment

60 synthetic development cases; 6 candidate positions. No live data used.

TF-IDF is fitted per student plus all positions, as in production. Category inputs are fixed; location is neutral 50% throughout. Hybrid uses 60/25/15. Ties follow position ID.

Structured category/location control Top-1: 90.0%.

| Model | Input | NLP Top-1 | NLP Top-3 | Hybrid Top-1 | Hybrid Top-3 | Hybrid winners changed | Helped / hurt |
|---|---|---:|---:|---:|---:|---:|---:|
| regex | current | 68.3% | 100.0% | 81.7% | 100.0% | 0 | 0 / 0 |
| regex | position_once | 66.7% | 100.0% | 85.0% | 100.0% | 4 | 3 / 1 |
| regex | both_once | 71.7% | 100.0% | 88.3% | 100.0% | 6 | 5 / 1 |
| regex | readable_position | 66.7% | 96.7% | 91.7% | 100.0% | 8 | 7 / 1 |
| regex | readable_both | 70.0% | 96.7% | 88.3% | 100.0% | 6 | 5 / 1 |

## Text size

| Input | Mean student words | Mean position words |
|---|---:|---:|
| current | 388.5 | 360.3 |
| position_once | 388.5 | 186.3 |
| both_once | 172.6 | 186.3 |
| readable_position | 388.5 | 102.2 |
| readable_both | 93.2 | 102.2 |

## Interpretation limits

These familiar synthetic labels are development references, not independent judgments of placement quality. The benchmark has five categories; the screenshot example has nine and is shown separately. No thresholds, tags, labels, model choices or weights were tuned after viewing results. Elapsed times include loading, preprocessing and scoring, with cache reuse; they are not a speed benchmark.

Inspect rankings.csv for every candidate and component; results.json includes macro F1, expected ranks, per-role agreement, model failures, hashes and actual before/after texts. No model fallback is silently substituted.

A cleaner input is not automatically a more accurate input. Before a system change, review helped/hurt cases with instructors and repeat on independent labeled evidence. Any production text change would need generator tests, evaluation, recommendation provenance/freshness review and an explicit refresh decision for existing results. This experiment does none of those production operations.
