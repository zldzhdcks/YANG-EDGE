# Football 1X2 Odds Foundation v0 — Audit Note

**결론:** Contract / Gate / Fixture tests only. No Prediction · Engine · Provider calls · production artifacts.

## Existing Odds Audit (repo)

| Area | Status |
|---|---|
| Generic decimal implied prob (`src/lib/odds`) | Reusable idea for raw 1/odds |
| MLB 2-way market / remove margin | **Not** reused as Football Prediction path — draw required |
| KBO domestic comparison | Namespace idea only |
| Football Identity Foundation | **SoT** for join |
| Football Prediction | NONE |

## Separation

- OVERSEAS vs DOMESTIC never overwrite
- COLLECT_ONLY markets never Prediction-eligible
- artifact exists ≠ usable
