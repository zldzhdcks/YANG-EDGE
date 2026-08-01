# MLB Daily Pregame Prediction Line v0

Single CLI that wires Schedule → Starter → Odds → Lineup → Input Audit → Prediction v0 → Snapshot Verify for **MLB MONEYLINE_2WAY** only.

## Stage order (fixed)

1. `SCHEDULE`
2. `STARTER`
3. `ODDS`
4. `LINEUP`
5. `INPUT_AUDIT`
6. `PREDICTION_V0`
7. `SNAPSHOT_VERIFY`

Existing runners are reused (spawn / in-process). Model math is **not** duplicated.

| Stage | Runner / module |
| --- | --- |
| SCHEDULE | `research:mlb-schedule` → `build-mlb-schedule-artifact-v1.ts` |
| STARTER | `research:starter` |
| ODDS | `research:mlb-odds` |
| LINEUP | `research:mlb-lineup` |
| INPUT_AUDIT | read-only artifact audit + daily summary if needed (`research:mlb-daily`) |
| PREDICTION_V0 | `loadAndPredictMlbV0` / `buildPredictionSnapshotV0` (`predict:mlb-v0`) |
| SNAPSHOT_VERIFY | in-process verify + hash reproduce |

## Required / optional inputs

**Required for READY_FOR_PREGAME_RUN**

- Schedule artifact (`data/research/mlb/{date}-schedule-v1.json`) — primary only; no auto `*.rev-*`
- Starter dataset
- Odds history dataset (decimal MONEYLINE both sides)
- Daily research summary (prediction consumer)

**Optional (v0)**

- Lineup dataset (weight=0; recorded for completeness / cutoff)
- Bullpen (disabled in prediction v0)

**Not implemented markets**

- `TOTALS`
- `RUN_LINE`

## Cutoff / leakage

- Per-game cutoff from commence time
- Features must be `statsAsOf` / `fetchedAt` / `marketLastUpdate` before start
- After-cutoff odds/starter/lineup → game `BLOCKED`
- Result artifacts are never loaded by Prediction v0

## Quota / retry

Odds provider gate (real run):

- remaining &lt; 20 → WARN
- remaining &lt; 10 → Provider call BLOCK
- quota unknown → prefer cache/artifact

Dry-run / `--no-provider`: **providerCalls = 0**, **writesPerformed = 0**.

## Commands

Dry-run readiness (no mutation):

```bash
npm run daily:mlb-pregame-v0 -- --date 2026-08-02 --dry-run --no-provider --json
```

Historical replay:

```bash
npm run daily:mlb-pregame-v0 -- --date 2026-07-30 --dry-run --no-provider --json
```

Approved real run (writes prediction snapshot; revision-preserve on change):

```bash
npm run daily:mlb-pregame-v0 -- --date YYYY-MM-DD --json
```

Compute without write:

```bash
npm run daily:mlb-pregame-v0 -- --date YYYY-MM-DD --no-write --no-provider --json
```

Useful flags: `--stop-after`, `--resume-from`, `--game-id`, `--skip-lineup`, `--observation-only`, `--no-market-prior`.

## Failure recovery

| Blocker | nextAction |
| --- | --- |
| `SCHEDULE_ARTIFACT_MISSING` | `RUN_SCHEDULE_COLLECTION` |
| `DAILY_SUMMARY_MISSING` | `RUN_DAILY_SUMMARY` |
| `SCHEDULE_DATE_MISMATCH` | Fix artifact / CLI date |
| Partial starter/odds | Prediction emits per-game `PASS` / `BLOCKED`; no fake inputs |
| Snapshot verify fail | Do not treat snapshot as frozen |

One stage failure does not invent predictions.

## Postgame

After snapshot is frozen and games finish:

```bash
npm run result:mlb -- YYYY-MM-DD
npm run review:mlb-daily -- YYYY-MM-DD
```

`review:mlb-daily` = result → `grade:mlb` → review. Official pick accuracy is **N/A** when `officialPickCount=0`.

Research overlay helper: `buildMlbResearchGradeAdapterV0` (Brier / log loss readiness, research correct/incorrect, pending/blocked/cancelled buckets).

## Snapshot path

`data/predictions/mlb/{dateKst}.json`

Idempotent skip when `predictionHashSha256` + `configHash` + `inputManifestHash` unchanged. Otherwise write after copying previous to `*.rev-*.json`.

## Domestic operator markets (comparison namespace)

Path: `data/operator-input/mlb/{dateKst}-domestic-markets-v1.json`

- Separate from overseas Odds API prior (`doesNotReplaceOverseasPrior=true`)
- Intake: `npm run intake:mlb-domestic-markets -- YYYY-MM-DD`
- Daily INPUT_AUDIT additive fields: `domesticMarketHash`, `domesticMoneylineAvailable`, `domesticTotalsAvailable`, `domesticRunLineAvailable`
- Prediction v0 formula unchanged; domestic MONEYLINE is comparison-only until a later mission

## Known limitations


- MLB only; KBO/NPB/UI out of scope
- MONEYLINE_2WAY only
- Lineup / bullpen performance weight = 0
- Odds quota headers not queried in dry-run
- OS automation / schedulers not created by this line
- Real Provider collection requires explicit non-dry-run approval

## Tests

```bash
npm run test:mlb-daily-pregame-v0
npm run test:mlb-prediction-v0
```
