# Dataset Coverage Dashboard v1

연구 진행 현황 요약 (read-only). Engine·Score·Hypothesis 승격 없음.

근거: `data/research/dataset-coverage-dashboard-v1.json`

---

## Coverage summary

| 항목 | 값 |
|------|-----|
| dateKst | 2026-07-29 |
| COLLECTING datasets | 7 |
| NOT_STARTED datasets | 0 |
| artifacts present | 7 |
| Framework registry entries | 7 |
| graded games (asOf slate) | 16 |
| sample target | 100 |
| below minimum sample | yes |
| lineup registry gap | no |
| Engine candidate | no |

**공식 결론:** `DATASET_COVERAGE_DASHBOARD_CREATED`

---

## Datasets

| datasetId | status | games | rows | % of 100 | in registry | Engine |
|-----------|--------|------:|-----:|---------:|:-----------:|--------|
| mlb-bullpen-role | COLLECTING | 15 | 546 | 15% | yes | PROHIBITED |
| mlb-starter | COLLECTING | 16 | 32 | 16% | yes | PROHIBITED |
| mlb-lineup | COLLECTING | — | — | — | yes | PROHIBITED |
| mlb-weather | COLLECTING | — | — | — | yes | PROHIBITED |
| mlb-travel | COLLECTING | — | — | — | yes | PROHIBITED |
| mlb-odds-history | COLLECTING | — | — | — | yes | PROHIBITED |
| mlb-injury | COLLECTING | — | — | — | yes | PROHIBITED |

---

## Hypotheses (evidence counts)

| ID | dataset | status | evidence | support | contradict | contradiction ledger refs |
|----|---------|--------|---------:|--------:|-----------:|--------------------------:|
| H-BP-ROLE-001 | mlb-bullpen-role | DATA_COLLECTION | 2 | 2 | 0 | 0 |
| H-BP-ROLE-002 | mlb-bullpen-role | DATA_COLLECTION | 2 | 2 | 0 | 0 |
| H-BP-ROLE-003 | mlb-bullpen-role | DATA_COLLECTION | 2 | 2 | 0 | 0 |
| H-BP-ROLE-004 | mlb-bullpen-role | DATA_COLLECTION | 2 | 2 | 0 | 0 |
| H-BP-ROLE-005 | mlb-bullpen-role | DATA_COLLECTION | 4 | 3 | 1 | 5 |
| H-BP-ROLE-006 | mlb-bullpen-role | SURVEY_ONLY | 2 | 1 | 1 | 0 |
| H-BP-ROLE-007 | mlb-bullpen-role | DATA_COLLECTION | 2 | 0 | 2 | 0 |
| H-ST-001 | mlb-starter | DATA_COLLECTION | 2 | 2 | 0 | 5 |
| H-ST-002 | mlb-starter | DATA_COLLECTION | 1 | 1 | 0 | 0 |
| H-ST-003 | mlb-starter | DATA_COLLECTION | 1 | 1 | 0 | 0 |
| H-ST-004 | mlb-starter | DATA_COLLECTION | 3 | 0 | 3 | 4 |
| H-LU-001 | mlb-lineup | DATA_COLLECTION | 0 | 0 | 0 | 0 |
| H-LU-002 | mlb-lineup | DATA_COLLECTION | 0 | 0 | 0 | 0 |
| H-LU-003 | mlb-lineup | DATA_COLLECTION | 0 | 0 | 0 | 0 |

Evidence ledger totals: hypotheses=14 · supporting=16 · contradicting=7

---

## Contradictions

| 항목 | 값 |
|------|-----|
| events | 10 |
| unique games | 7 |
| starter | 5 |
| bullpen | 5 |
| lineup | 0 |
| severity HIGH / MEDIUM / LOW | 8 / 2 / 0 |

---

## Limitations

- Sample 15 games ≪ 100 target — do not claim PROMISING
- Dashboard is descriptive coverage only — not an Engine input

---

## Supplemental run — 2026-07-31 MLB Remaining Pregame Accumulation

**Do not add this run as incremental sample games onto the coverage table above.**  
Same-date revision / supplemental run keyed by `runId` + `gamePk` (not a new 100-sample increment).

| 항목 | 값 | 검증 |
|------|-----|------|
| runId | `2026-07-31T00-53-46-838Z` | VERIFIED |
| collectionStartedAt | `2026-07-31T00:53:46.838Z` (KST 09:53) | VERIFIED |
| Schedule slate | 10 | VERIFIED |
| PREGAME_ELIGIBLE | 3 (gamePk 824974, 823271, 823921) | VERIFIED |
| EXCLUDED_ALREADY_STARTED | 7 | VERIFIED |
| Starter | 10 games / 20 rows · probable 16 · missing/partial 4 | VERIFIED |
| Odds | COLLECTED 6 / NOT_COLLECTED 4 · Eligible collected **3/3** | VERIFIED |
| Lineup | NOT_RELEASED 10/10 · Eligible NOT_RELEASED **3/3** | VERIFIED |
| Prediction snapshot rows | 10 | VERIFIED |
| Official eligible prediction (`inputStatus=ELIGIBLE`) | **0** | VERIFIED |
| Official `BASELINE_CANDIDATE` | **0** | VERIFIED |
| Eligible PASS (remaining-pregame finalStatus) | **3** | VERIFIED |
| Research Ready | 61% | VERIFIED |
| Cutoff failures | 0 | VERIFIED |
| Leakage failures | 0 | VERIFIED |
| Engine changes | 0 | VERIFIED |
| Auto promotion | NONE | VERIFIED |

**PASS / baseline policy:** PASS is an official analysis state, not a missing run. Snapshot baseline pick strings are research observation only — **not** official predictions; do not include in official hit-rate; do not rewrite PASS → ELIGIBLE after results.

**Artifacts:** `…-remaining-pregame-v1.json`, starter/odds/lineup/daily summary, `data/predictions/mlb/2026-07-31.json`, `…-pregame-cutoff-audit-v1.json`, `…-pregame-collection-summary-v1.json`, schedule/lineup `.rev-2026-07-31T00-53-46-838Z`.

**공식 결론:** `DATA_ACCUMULATION_CONTINUES`

---

## Supplemental — Pregame Input Integrity Guards v1 (2026-07-31)

| 항목 | 값 |
|------|-----|
| Odds format contract | DECIMAL internal · American conversion · FORMAT_MISMATCH |
| 01:28 historical rewrite | **No** — audit annotation only |
| Official Pick impact | None (PASS already recorded) |
| Leakage | NONE |
| Tests | `test:odds-format` · `test:pregame-eligibility` |
| Engine | unchanged |

---

## Supplemental run — 2026-07-31 Postgame Grade & Review (partial)

**Not an official accuracy sample.** Official eligible predictions remain **0**.

| 항목 | 값 | 검증 |
|------|-----|------|
| review command | `npm run review:mlb-daily -- 2026-07-31` | VERIFIED |
| Official Result | FINAL 4 / NOT_FINAL 6 | VERIFIED |
| Remaining Pregame PENDING | gamePk 824974, 823271, 823921 | VERIFIED |
| Official eligible graded | 0 · accuracy null | VERIFIED |
| LIMITED_INPUT observation grades | 4 graded · 3 correct · 1 incorrect · 75% (**not official**) | VERIFIED |
| Success / Failure reviews | 3 / 1 (observation only) | VERIFIED |
| Leakage | WARN | VERIFIED |
| reviewStatus | PARTIAL_REVIEW | VERIFIED |
| Engine changes | 0 | VERIFIED |
| Result collector note | schedule scores preferred over stale empty boxscore runs | VERIFIED |

**Artifacts:** `…-official-results-v1.json`, `…-graded-predictions-v1.json`, `…-success-review-v1.json`, `…-failure-review-v1.json`, `…-daily-review-summary-v1.json`
