# Football V3.1 Prospective Postgame Append-Only Run Receipt V1

BASE_SHA: `3c7aa1adc8169ecf6685864ed9f160cc45fafce7`

One-shot postgame refresh must not reread a single fixed scorecard file. Fixture `postgame-v1.json` stays append-only. Each `--run` now writes a new sealed receipt under:

`batches/FIRST_REAL_ONE_SHOT_V1/postgame-runs/<runId>.json`

`writeSeal` `wx` semantics are unchanged. A second write to the same run id fails.

## Legacy receipt

`batches/FIRST_REAL_ONE_SHOT_V1/postgame-scorecard-v1.json` is leftover evidence. It is never updated or deleted.

Read-only diagnosis: `VALID` | `INVALID_SEAL_HASH` | `ABSENT`.

An invalid legacy seal does not block a new refresh.

## First real validation

Command: `npx tsx scripts/football-v31-r1-prospective-postgame-v1/run-v1.ts --run`

Exit code 0.

Existing four grades (`1550119`, `1575161`, `1575162`, `1575163`) returned `ALREADY_GRADED_IMMUTABLE`.

Two additional FT fixtures appended new `postgame-v1.json` only: `1575158`, `1575160`.

## Governance

LEGACY_RECEIPT_MUTATED = NO  
PREGAME_FILES_MUTATED = NO  
EXISTING_POSTGAME_FILES_MUTATED = NO  
MODEL_CHANGED = NO  
FORWARD_CHANGED = NO  
RECOMMENDATION_ENGINE_CHANGED = NO  
WATCH_STARTED = NO  

FOOTBALL_V31_POSTGAME_APPEND_ONLY_RUN_RECEIPT_V1_READY_FOR_CTO_REVIEW

STOP.
