# Research Log

Append-only research execution log. Do not rewrite past entries.

## Entry template

```text
## YYYY-MM-DD — <title>

### Purpose
-

### Scope
- Allowed:
- Forbidden:

### Inputs
-

### Outputs
-

### Results (summary)
-

### Official conclusion
-

### Engine connection
PROHIBITED

### Follow-ups
-
```

---

## 2026-07-27 — Bullpen Role Classifier v1.1

### Purpose
Improve bullpen role classification data quality, reproducibility, and auditability (not hit-rate tuning).

### Scope
- Allowed: classifier v1.1, research cache, audits, docs
- Forbidden: Engine, weights, recommendation, Confidence, EDGE, Value Edge, prediction snapshots

### Inputs
- data/predictions/mlb/2026-07-27-success-flow-review.json
- data/predictions/mlb/2026-07-27-failure-flow-review.json
- data/research/mlb/2026-07-27-bullpen-role-dataset.json (v1, read-only compare)

### Outputs
- data/research/mlb/2026-07-27-bullpen-role-dataset-v1_1.json
- data/audits/2026-07-27-bullpen-role-v1_1-audit.json
- data/audits/2026-07-27-bullpen-role-v1-vs-v1_1.json
- data/cache/research/mlb/{raw,derived}/

### Results (summary)
- rows 524 / unique ~ (see dataset summary)
- starter appearances excluded: 630
- sample&lt;3 confirmed roles: 0 · LONG under 3: 0
- re-run network calls: 0 · result hash matched
- fail bullpen warn 6/6 · success stable 2/5 (research signal only)

### Official conclusion
DATA_QUALITY_IMPROVED_BUT_INCONCLUSIVE

### Engine connection
PROHIBITED

### Follow-ups
- Accumulate more graded days before any Engine review
- Keep MLB Stats API INTERNAL_RESEARCH_ONLY

---

## 2026-07-27 — Starter Dataset v1 (minimal builder)

### Purpose
Freeze prediction-time probable starter identity + pre-cutoff season/recent starts as an internal research dataset (no Score / Engine).

### Scope
- Allowed: starter dataset builder v1, research cache derived/starter, audits, hypothesis rows, registry status→COLLECTING
- Forbidden: Engine, weights, recommendation, Confidence, EDGE, Value Edge, Bullpen v1.1 logic, prediction snapshot mutation, QS, confirmed-as-probable, live season without as-of

### Inputs
- data/predictions/mlb/2026-07-27.json (read-only)
- MLB Stats API schedule hydrate=probablePitcher + people + gameLog (research cache)

### Outputs
- data/research/mlb/2026-07-27-starter-dataset-v1.json
- data/research/mlb/2026-07-27-starter-postgame-review-v1.json
- data/audits/2026-07-27-starter-dataset-v1-audit.json
- data/cache/research/mlb/derived/starter/

### Results (summary)
- games 15 / rows 30 (home 15 + away 15)
- probable 30 / missing 0 · join MATCHED 30
- seasonStats 30 · recentStarts 30 · avg sampleSize 15.8
- target game in stats: 0 · cutoff violations: 0 · confirmed rows: 0
- STARTER_CHANGED reviews: 0 (28+ matched; all probable rows matched boxscore pitchers[0] on this slate)
- warm re-run: raw 61/0 · derived 30/0 · network 0 · resultHash matched
- prediction hash unchanged `28f3e360…`
### Official conclusion
STARTER_DATASET_V1_CREATED_DATA_COLLECTION

### Engine connection
PROHIBITED

### Follow-ups
- Accumulate ≥100 games before PROMISING discussion
- Keep postGameReview annotations separate from pre-game payload
- Do not wire Stats API into public runtime
- Investigate UNLINKED rows (2) for join robustness

---

## 2026-07-27 — Starter Dataset v1 accumulation pipeline

### Purpose
Repeatable date-arg accumulation of pre-game starter freezes + separate post-game reviews without schema/score/Engine changes.

### Scope
- Allowed: accumulation orchestrator, immutable pre-game lock, Final-only MATCHED/CHANGED, AWAITING_RESULT, audit+summary scripts
- Forbidden: schema/seasonStats logic change, Score, Engine, Bullpen, Framework structure, prediction overwrite

### Inputs
- data/predictions/mlb/2026-07-27.json, 2026-07-28.json (read-only)

### Outputs
- scripts/run-mlb-starter-accumulation-v1.ts
- scripts/summarize-mlb-starter-accumulation-v1.ts
- data/research/mlb/2026-07-28-starter-dataset-v1.json (+ postgame review)
- data/audits/2026-07-27-starter-dataset-v1-audit.json (accumulation metrics)
- data/audits/2026-07-28-starter-dataset-v1-audit.json
- data/audits/starter-dataset-v1-accumulation-summary.json

### Results (summary)
- 07-27 pre-game immutable (resultHash `5e44d0ad…`)
- 07-27 postgame: MATCHED 28 / CHANGED 0 / AWAITING 2
- 07-28 new pre-game: 12 games / 24 rows / probable 23 missing 1; warm hash matched; AWAITING 24
- cumulative (summary script, no recompute): 27 games / 54 rows
- prediction hashes unchanged

### Official conclusion
STARTER_DATA_ACCUMULATION_CONTINUES

### Engine connection
PROHIBITED

### Follow-ups
- Re-run postgame when 07-28 finishes and remaining 07-27 games are Final
- Keep accumulating toward ≥100 games before PROMISING

---

## 2026-07-27 — Framework common audit conclusion (Bullpen × Starter)

### Purpose
Record that Research Framework v1 was validated against existing Bullpen and Starter datasets without structural change.

### Results
- Framework validated against Bullpen and Starter datasets
- No structural modification required
- Domain audit schemas intentionally remain independent
- Framework expansion remains frozen

### Official conclusion
FRAMEWORK_APPROPRIATE_AS_IS

### Engine connection
PROHIBITED

---

## 2026-07-27 — Yankees @ Phillies Final pipeline refresh

### Purpose
Reflect the completed Yankees @ Phillies game (last AWAITING_RESULT on 2026-07-27) into Starter postgame, grading, Success/Failure reviews, Bullpen validation, and summaries.

### Scope
- Allowed: postgame review, grade result fields, success/failure flow reviews, bullpen v1.1 rebuild/compare (classifier frozen), validation/daily report/accumulation summaries, RESEARCH_LOG
- Forbidden: pre-game Starter Dataset overwrite, probable backfill, immutable prediction fields, classifier/threshold/Engine/Framework/weights changes

### Inputs
- Stats schedule gamePk 823433 → Final (Yankees 4 @ Phillies 11)
- data/predictions/mlb/2026-07-27.json (result fields only)
- data/research/mlb/2026-07-27-starter-dataset-v1.json (read-only pre-game)

### Outputs
- data/research/mlb/2026-07-27-starter-postgame-review-v1.json (MATCHED 30 / CHANGED 0 / AWAITING 0)
- data/predictions/mlb/2026-07-27.json + `-review.json` (graded 15/15; Yankees MISS)
- data/predictions/mlb/2026-07-27-failure-flow-review.json (Yankees: MULTIPLE_FACTORS; SIGNAL_FAILED=9)
- data/predictions/mlb/2026-07-27-success-flow-review.json (SIGNAL_WORKED=6 unchanged set)
- data/research/mlb/2026-07-27-bullpen-role-dataset-v1_1.json (warm hash `0753ad64…`)
- data/audits/bullpen-v1_1-validation-2026-07-27.json
- data/audits/bullpen-v1_1-daily-report-2026-07-27.{json,md}
- data/audits/bullpen-v1_1-validation-accumulation.json
- data/audits/starter-dataset-v1-accumulation-summary.json

### Results (summary)
- Starter Yankees home/away: STARTER_MATCHED (Will Warren / Cristopher Sánchez)
- Grade: 15 graded · hits 6 · fails 9 · hitRate 40
- Yankees: SIGNAL_FAILED (pick Yankees, winner Phillies 11-4); pitcherDirection CONFLICTS_BASELINE (observation only)
- Bullpen fail warn 7/7 · success stable 2/5 · UNKNOWN rate 51.3% (289/563)
- API-BASEBALL status lagged on IN9 after Stats Final — research results cache FT-corrected for grading only (scores already 11-4)
- pre-game starter file hash unchanged `67e34b66…`
- immutable prediction fields verified unchanged by grade script

### Official conclusion
RESEARCH_PIPELINE_UPDATED

### Engine connection
PROHIBITED

### Follow-ups
- Re-run when 07-28 finishes for cross-day Bullpen/Starter accumulation
- Keep Baseball IN9 lag note; prefer waiting for FT when possible before cache correction

---

## 2026-07-27 — Failure-flow meta.failedGames drift fix

meta.failedGames was hardcoded to 8 in `review-mlb-failed-game-flow.ts` while `games[]` already had 9 rows (incl. Yankees). Synced meta to 9; rows/classifications unchanged. Generator now derives count from `gameReviews.length`; postgame pipeline regenerates failure/success reviews after grade.

### Official conclusion
DERIVED_METADATA_REFRESH_FIXED
