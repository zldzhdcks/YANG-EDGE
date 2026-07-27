# Dataset Coverage Dashboard v1

연구 진행 현황 요약 (read-only). Engine·Score·Hypothesis 승격 없음.

근거: `data/research/dataset-coverage-dashboard-v1.json`

---

## Coverage summary

| 항목 | 값 |
|------|-----|
| dateKst | 2026-07-27 |
| COLLECTING datasets | 3 |
| NOT_STARTED datasets | 2 |
| artifacts present | 3 |
| Framework registry entries | 5 |
| graded games (asOf slate) | 15 |
| sample target | 100 |
| below minimum sample | yes |
| lineup registry gap | no |
| Engine candidate | no |

**공식 결론:** `DATASET_COVERAGE_DASHBOARD_CREATED`

---

## Datasets

| datasetId | status | games | rows | % of 100 | in registry | Engine |
|-----------|--------|------:|-----:|---------:|:-----------:|--------|
| mlb-bullpen-role | COLLECTING | 15 | 563 | 15% | yes | PROHIBITED |
| mlb-starter | COLLECTING | 15 | 30 | 15% | yes | PROHIBITED |
| mlb-lineup | COLLECTING | 15 | 30 | 15% | yes | PROHIBITED |
| mlb-weather | NOT_STARTED | — | — | — | yes | PROHIBITED |
| mlb-travel | NOT_STARTED | — | — | — | yes | PROHIBITED |

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
