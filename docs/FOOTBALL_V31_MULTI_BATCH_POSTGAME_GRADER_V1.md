# FOOTBALL V31 MULTI-BATCH POSTGAME GRADER V1

BASE_SHA: `45e29ac74cdd6ec7d6f9584aa20ad71434ecdbeb`

RESULT_COMMIT_SHA: null

BRANCH: `agent/cursor/football-v31-multi-batch-postgame-grader-v1`

This mission adds a multi-batch postgame grader and collector so First Real Batch and Second Real Batch can be scored with the same Result → Grade contract. It does not recompute predictions, mutate sealed pregame files, refit V1/H2/R1, change map/beta/selector, import market quotes, connect the recommendation engine, change Official Forward, or start a watch/daemon.

MODEL_PROMOTED = NO

## Binding

Each batch is bound to its own sealed audit. A hash mismatch fails closed as `BATCH_AUDIT_HASH_MISMATCH`.

| batchId | audit | audit SHA256 | TARGET_COUNT |
| --- | --- | --- | --- |
| FIRST_REAL_ONE_SHOT_V1 | `data/audits/football-v31-r1-first-real-batch-v1.json` | `f959518751631281723006d71d66516685fcc62896334ec477e2ca0b6fc29dcd` | 20 |
| SECOND_REAL_ONE_SHOT_V1 | `data/audits/football-v31-r1-second-real-batch-seal-v1.json` | `405145c492935fc9c789e17e37af3758d77db528ef6a62b034c07ea0fe7fd8d5` | 4 |

Second-batch ExpectedSeal fields are restored from that seal audit only: fixture identity, cutoffAt, predictionCreatedAt, inputHash, snapshotHash, V1/H2/R1 prediction hashes, and status. Non-SEALED outcomes are not grade targets. TARGET_COUNT must be 4.

Existing first-batch grader, one-shot runner, and append-only receipts were left in place. New adapter files live beside them:

- `scripts/football-v31-r1-prospective-postgame-v1/registry-v1.ts`
- `scripts/football-v31-r1-prospective-postgame-v1/resolve-v1.ts`
- `scripts/football-v31-r1-prospective-postgame-v1/load-v1.ts`
- `scripts/football-v31-r1-prospective-postgame-v1/fingerprint-batch-v1.ts`
- `scripts/football-v31-r1-prospective-postgame-v1/aggregate-v1.ts`
- `scripts/football-v31-r1-prospective-postgame-v1/run-multibatch-v1.ts`

## Artifact layout

Private pregame files were inspected on disk. Both batches store `input.json` and `snapshot.json` under the prospective shadow namespace fixtures directory:

`resolvePregameArtifact(batchId, fixtureId)` → `fixtures/<fixtureId>/{input.json,snapshot.json,postgame-v1.json}`

Layout name: `NAMESPACE_FIXTURES_DIR`.

The collector does not guess nearest files under `batches/<BATCH_ID>/targets`. Absolute local paths are not committed.

`postgame-v1.json` remains the canonical per-fixture artifact name. It is append-only (`wx`). An existing valid grade returns `ALREADY_GRADED_IMMUTABLE`. Batch receipts are split:

`batches/<BATCH_ID>/postgame-runs/<runId>.json`

Legacy first-batch `postgame-scorecard-v1.json` is not rewritten.

## Grading contract

Unchanged triple-envelope rules from the first-batch grader:

- official FT regular time only (`HOME` / `DRAW` / `AWAY`)
- exact six-field fixture identity
- V1, H2, and R1 graded independently
- PASS → `PREGAME_PASS_PRESERVED`
- AET / PEN and other non-FT terminals → `RESULT_BLOCKED`

No prediction recompute. No fuzzy fixture matching. No nearest-kickoff matching.

## Command

```
npx tsx scripts/football-v31-r1-prospective-postgame-v1/run-multibatch-v1.ts --run
npx tsx scripts/football-v31-r1-prospective-postgame-v1/run-multibatch-v1.ts --run --batch all
npx tsx scripts/football-v31-r1-prospective-postgame-v1/run-multibatch-v1.ts --run --batch FIRST_REAL_ONE_SHOT_V1
npx tsx scripts/football-v31-r1-prospective-postgame-v1/run-multibatch-v1.ts --run --batch SECOND_REAL_ONE_SHOT_V1
```

`--run` with no `--batch` grades both sealed batches once. Watch is not implemented.

## Validation run

One-shot multi-batch run after implementation:

- startedAt = 2026-09-12T17:43:22.671Z
- first-batch completedAt = 2026-09-12T17:44:26.782Z
- second-batch completedAt = 2026-09-12T17:44:26.927Z
- first-batch requests = 10
- second-batch requests = 0

Aggregate current artifact state:

- TOTAL_BATCHES = 2
- TOTAL_SEALED = 24
- RESULT_AVAILABLE = 12
- RESULT_PENDING = 12
- RESULT_BLOCKED = 0
- R1_PREDICTED_GRADED = 8
- R1_PASS_PRESERVED = 4
- V1_PREDICTED_GRADED = 8
- H2_PREDICTED_GRADED = 8
- NEW_POSTGAME_APPENDED = 6
- checkpoint next = 25
- INTERPRETATION = EARLY_DESCRIPTIVE_ONLY

First batch (20 sealed):

- 6 existing grades remained `ALREADY_GRADED_IMMUTABLE`: 1550119, 1575158, 1575160, 1575161, 1575162, 1575163
- 6 new `postgame-v1.json` files appended: 1557397, 1557398, 1557399, 1557401, 1557403, 1570377
- 8 still pending (4 in 2H, 4 NS)

Second batch (4 sealed, still before kickoff):

- 1575159, 1570376, 1557404, 1550123 → `RESULT_PENDING` / NS
- no second-batch postgame files written

Receipt hashes (LOCAL_ONLY files, relative batch paths only):

- `batches/FIRST_REAL_ONE_SHOT_V1/postgame-runs/2026-09-12T17-43-22-671Z-2cc01128-d7e4-40f0-9827-e9f2aeb9e985.json` SHA256 `5a262c98523fa7a864efd4db4d86a016ce4e38de0a8cf66bf191e264988b6491`
- `batches/SECOND_REAL_ONE_SHOT_V1/postgame-runs/2026-09-12T17-44-26-803Z-463e7cef-bf0e-4eaf-aba6-d167c2e224c4.json` SHA256 `4b6c0cf5ed9c7deb4dd9cae6c0f75151d56d51aa2b12385a3fc9322e4e89e6f3`

N = 8 R1 PREDICTED graded, which is below the checkpoint of 25. These numbers are descriptive only. They cannot promote a model.

## Tests

21 new multi-batch tests PASS, covering audit binding, wrong-hash fail-closed, exact identity, both layout resolvers, immutable existing grades, second-batch pending/FT/duplicate, independent V1/H2/R1 grades, PASS preservation, AET/PEN block, no recompute/market/refit, first-batch byte identity, per-batch append-only receipts, aggregate coverage, and EARLY_DESCRIPTIVE_ONLY while N < 25.

Existing grader, receipt, comparator, prospective, preflight, and second-batch seal regressions: 105 PASS.

## Governance

SUPPORTED_BATCHES = 2  
FIRST_BATCH_AUDIT_BOUND = YES  
SECOND_BATCH_AUDIT_BOUND = YES  
FIRST_BATCH_FILES_MUTATED = NO  
SECOND_BATCH_PREGAME_FILES_MUTATED = NO  
EXISTING_POSTGAME_FILES_MUTATED = NO  
MODEL_CHANGED = NO  
FORWARD_CHANGED = NO  
RECOMMENDATION_ENGINE_CHANGED = NO  
MARKET_INPUT_USED = NO  
WATCH_STARTED = NO  
MODEL_PROMOTED = NO  
MAIN_MERGED = NO

FOOTBALL_V31_MULTI_BATCH_POSTGAME_GRADER_V1_READY_FOR_CTO_REVIEW

STOP.
