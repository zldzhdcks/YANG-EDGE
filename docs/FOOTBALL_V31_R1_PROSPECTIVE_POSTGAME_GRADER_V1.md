# FOOTBALL V31 R1 PROSPECTIVE POSTGAME GRADER V1

BASE_SHA: `21ff4f7d22152fd16b10149042c318e6295be802`

This mission adds an append-only triple-envelope postgame grader. It does not recalculate predictions, mutate pregame files, refit R1/H2/V1, change map/beta, reuse holdout confirmation, connect the recommendation engine, change Official Forward, or start a watch/daemon.

The old single-result foundation grader (`scripts/football-v31-r1-prospective-v1/sealing-v1.ts#appendGrade`) is retained for regression provenance only. It is not applied to the first-real triple envelope.

## Why a new grader

The first real batch sealed 20 private fixtures as `{input.json, snapshot.json}` under `football-v31-r1-prospective-shadow-v1`. Each snapshot is a same-cutoff triple:

- `sameCutoffV1` — frozen football-poisson-research-v1
- `sameCutoffH2` — frozen H2 backbone
- `r1` — prospective R1 adapter

Each model has its own prediction hash. A consumer must bind those hashes and grade independently. The old grade reader expected one prediction hash equal to the whole snapshot hash and is therefore incompatible.

Canonical per-fixture artifact name: `postgame-v1.json` (does not collide with `input.json`, `snapshot.json`, or the unused foundation `grades/` revision files).

## Result → Grade only

Implementation: `scripts/football-v31-r1-prospective-postgame-v1/`.

`gradeFixture(root, expectedSeal, resultObservation)`:

1. If `postgame-v1.json` already exists, verify it and return `ALREADY_GRADED_IMMUTABLE`. No overwrite.
2. Re-read sealed `snapshot.json` / `input.json`. Fail closed on snapshot hash, input hash, target identity, cutoff, creation time, or any of V1/H2/R1 prediction hashes.
3. Require exact provider fixture identity (fixtureId, league, season, both team IDs, kickoff). No nearest-kickoff matching and no team-name guessing. Uncertain identity → `RESULT_IDENTITY_UNCERTAIN` / `RESULT_BLOCKED`. No grade file.
4. Accept only official API-Football **FT** regular-time scores. Unfinished statuses (`NS`, `1H`, `HT`, `2H`, `ET`, `BT`, `P`, `LIVE`, `INT`, `SUSP`, `TBD`) remain `RESULT_PENDING`. `AET`/`PEN` and other non-FT terminals are `RESULT_BLOCKED` (`RESULT_STATUS_NOT_FT`), matching the prospective FT-only observation contract and Official Forward postgame FT gate. Research 1X2 is regular-time-only, but this V1 does not remap AET/PEN into a grade.
5. Record actual `resultObservedAt` / `providerFetchedAt` from the fetch clock. No backdating. No synthetic +48h lag.

Each model is graded independently:

- `PREDICTED` → `GRADED` with `predictedClass`, `actualClass`, `correct`, pregame `{HOME,DRAW,AWAY}`, per-fixture log loss (`-log max(p_actual, 1e-15)`), and multiclass Brier (`sum_k (p_k - y_k)^2`).
- `PASS` → `PREGAME_PASS_PRESERVED`. No new prediction. `correct`, probabilities, log loss and Brier remain null.

One-shot collector: `run-v1.ts --run`. Future kickoffs stay pending without an API call. Kickoff-passed fixtures are fetched once. No watch.

## First sealed batch scorecard

Private root (LOCAL_ONLY): `C:\Users\TCTCTC\YANG-EDGE\YANG-EDGE-INBOX\football-v31-r1-prospective-shadow-v1`

Pregame `input.json` / `snapshot.json` were re-bound to the first-real-batch audit hashes after execution. They were not modified. No `postgame-v1.json` was written because no fixture was FT yet.

One-shot execution 2026-09-12T14:17:10.208Z → 2026-09-12T14:18:27.265Z:

- TOTAL_SEALED = 20
- RESULT_AVAILABLE = 0
- RESULT_PENDING = 20
- RESULT_BLOCKED = 0
- R1_PREDICTED_GRADED = 0
- R1_PASS_PRESERVED = 0
- V1_PREDICTED_GRADED = 0
- H2_PREDICTED_GRADED = 0
- API requests = 12 (in-progress only: 2H/1H/HT)
- Remaining 8 were still before kickoff (`NS`) and were not fetched
- interpretation = EARLY_DESCRIPTIVE_ONLY
- checkpoint next = 25 graded R1 PREDICTED
- MODEL_PROMOTED = NO

Local scorecard (not committed): `V31_R1_PROSPECTIVE_SHADOW/batches/FIRST_REAL_ONE_SHOT_V1/postgame-scorecard-v1.json`  
SHA256: `b407708c808529bbf5d4e005f24b5024a7b7046e686969956d8becd9022f74c2`

Performance numbers, if later computed before N=25, remain EARLY_DESCRIPTIVE_ONLY. They cannot promote a model.

## Governance

PREGAME_FILES_MUTATED = NO  
MODEL_CHANGED = NO  
FORWARD_CHANGED = NO  
RECOMMENDATION_ENGINE_CHANGED = NO  
WATCH_STARTED = NO  
MARKET_INPUT = NO  
HOLDOUT_REUSE = NO  
MAIN_MERGED = NO

FOOTBALL_V31_R1_PROSPECTIVE_POSTGAME_GRADER_V1_READY_FOR_CTO_REVIEW

STOP.
