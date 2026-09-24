# V4 Pregame Result-field Isolation P0

Date: 2026-09-24. Base: `4c646442a52112108d9b2580854a7e7214406505`.
Scope: local synthetic storage-isolation implementation only. No real collection.

## Result

`UNFILTERED_RAW_TARGET_FIELDS`: previous FAIL → PASS for the new v2 write path.
The previous `data/audits/2026-09-20-v4-xi-partial-readiness-recheck-v1.json`
remains unchanged historical evidence. This document does not retroactively
certify v1 payloads or establish overall V4 collection readiness.

## Exact storage contract

New envelopes use `football-v4-prospective-evidence-v2`, collector version
`football-v4-pregame-isolation-v2`. `Receipt.raw` is transient in memory only.
There is no `payload.raw` in new artifacts.

`payload` contains exactly:

- `pregame`: the discriminated, positively constructed object described below.
- `validation`: existing validator output with a strict diagnostic schema.
- `rightsEvidenceHash`, `registryHash`: SHA-256 bindings.
- `season`: four-digit year.
- `paging`: null or positive safe-integer `current` and `total` only.

Source-specific `pregame` schemas:

- XI: `sourceType`, `fixtureId`, `teams`. Each team has `teamId`, `side`,
  `formation`, `starters`, `substitutes`. Each player has `playerId`, `teamId`
  and optional `position` (`G`, `D`, `M`, `F`). IDs are positive safe numeric
  identifiers; invalid provider IDs become empty strings and cannot validate
  as legitimate players/teams. Formation is null or numeric lines summing to
  ten outfield players. Provider names, coach objects, status objects and
  arbitrary player/metadata extensions are not copied.
- INJURY: `sourceType`, `rows`. Each row has `fixtureId`, `teamId`, `playerId`,
  `type`, `reason`. Types are `Injury`, `Missing Fixture`, `Suspension`, or
  `UNKNOWN`. The only retained reason token is `Suspended`; other reasons
  become `UNKNOWN`. Free-text diagnoses are intentionally not retained.
  Existing type-based absence semantics remain; normalized duplicate/conflict
  comparisons operate on these projected observations, not discarded text.
- PLAYER_STATS: exactly `sourceType: PLAYER_STATS`, `status: UNRESOLVED`.
  No player statistics or cumulative numbers are admitted by the current
  pregame/data-through contract, so none are retained.

Provider clocks are parsed to canonical ISO strings, or null when invalid.
The pregame temporal gate still rejects unsafe clocks. Envelope, payload,
player, paging and validation objects reject additional fields at serialization
and v2 read-back. Positive construction is the primary protection; canary and
forbidden-key scans are secondary tests.

The existing XI validator receives the same `pregame` object that is stored.
The injury validator receives the same `pregame.rows` that is stored.
`sourceArtifactSha256` in v2 is SHA-256 of canonical `payload.pregame`, not a
hash claiming to represent an archived provider response. The outer receipt
hash still covers the complete serialized envelope.

## Quarantine

Temporal rejection stores only `event` (internal hashed job identifier),
canonical/null clocks, safe `pregame`, fixed `role: NOT_PREGAME` and fixed
`status: TEMPORAL_UNVERIFIED`. It stores no raw response. Malformed projection
input fails closed before any pregame/quarantine response write; a durable
claim/reservation may remain and the existing no-blind-retry policy applies.
No unrelated raw-cache subsystem changed.

## Compatibility and immutability

`exactEvidence` supports both versioned envelopes. Legacy v1 source hashes
remain verified against legacy raw content, without rewriting files. The XI
consumer verifies those hashes then projects legacy content in memory; a
legacy read is not v2 isolation certification. V2 reads reject unknown fields
and verify the projected hash. XI identity/completeness, starter/substitute
roles, formation, deterministic replay and existing probability values are
covered by synthetic consumer tests. No Public UI connection was added.

`put` and `get` storage primitives are unchanged: fsync, atomic no-replace
hard link, identical-byte replay, conflict detection and SHA verification.
Existing event IDs and no-refetch claims remain unchanged.

## Readiness

The CLI now awaits `collectionReadiness`, which retains the registry gate and
runs `provePregameIsolation` before PLAN_ONLY success or a real collect branch.
The proof runs the actual collector/serializer/store/read-back for three
sources, both normal and quarantine paths, entirely in a disposable temp
store using synthetic fetch callbacks. Any failure aborts readiness.
PLAN_ONLY therefore now performs temporary synthetic disk writes and cleanup;
it never writes production evidence or calls a provider.

The default remains PLAN_ONLY. Existing explicit `--collect`, manifest rights,
collection authorization, binding, temporal and budget gates remain required.
This mission does not enable collection or alter an OS service. Registry-only
READY is not an overall readiness verdict.

## Actual validation

Commands run without env-file loading or package installation:

```sh
node --import tsx --test --test-reporter=dot scripts/test-v4-pregame-isolation-p0.ts scripts/test-football-v4-prospective-evidence-v1.ts scripts/test-priority-registry-readiness-v1.ts
node --import tsx scripts/audit-v4-xi-partial-readiness-v1.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
git diff --check
```

- 82 tests passed, zero failures; typecheck exit 0; diff check clean.
- Canary audit: 6 synthetic paths, 27 stored files scanned, canary matches 0.
- Committed manifest identity/registry/rights references: 42/42 hashes match.
- All 2,414 pre-existing tracked `data/` files match pre-edit SHA-256 hashes.
- V1 normalized model SHA-256 remains
  `6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf`.
- The external rich-preview integration suite was not run: its local INBOX
  fixtures are absent. The changed XI consumer has independent synthetic v1/v2,
  injury, hash-tamper and deterministic-replay coverage. Its existing synthetic
  legacy fixture now explicitly declares the v1 schema.

```text
PREGAME_RESULT_FIELD_ISOLATION=PASS
CANARY_MATCH_COUNT=0
PROVIDER_CALLS=0
RESULT_DATA_PERSISTED=false
LIVE_DATA_PERSISTED=false
POSTGAME_DATA_PERSISTED=false
QUARANTINE_RAW_CONTAMINATION=false
XI_CONTRACT_REGRESSION=NONE_IN_EXECUTED_TESTS
IMMUTABLE_STORE_REGRESSION=NONE_IN_EXECUTED_TESTS
REAL_V4_COLLECTION_RUN=false
EXISTING_SEALED_EVIDENCE_REWRITTEN=false
FIRST_REAL_V4_PROSPECTIVE_EVIDENCE=NONE
```

Next step: owner review of this P0 diff. No collection, backfill, scheduler,
Mac mini deployment, prediction/grade or feature work is authorized by this
PASS. Provider publication/data-through, suspension completeness, current
quota, a future authoritative scope and broader operational readiness are
not established by synthetic isolation validation.

## ENGINE STATUS

```text
OFFICIAL_ENGINE=V1
OFFICIAL_MODEL=football-poisson-research-v1
OFFICIAL_ENGINE_CHANGED=NO
RESEARCH_V2_H2_STATUS=RESEARCH_UNPROMOTED_LAST_RECORDED
V3_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_FEATURES=xG / Total Shots / Shots on Goal
V3_PROMOTED=NO
V3_1_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_1_HOLDOUT=SCREEN_NO_LAST_RECORDED
V3_1_PROMOTED=NO
V4_STATUS=P0_ISOLATION_PASS_NO_REAL_COLLECTION
V4_PHASE=0.5_OWNER_PROGRESS_LABEL
V4_IMPLEMENTED_COMPONENTS=Existing registry/membership/temporal/XI/availability/store; safe projection and serialization isolation
V4_ENGINE_IMPLEMENTED=false
V4_ADMISSION_ALLOWED=false
REAL_PREDICTION_COUNT=45_LAST_RECORDED_OFFICIAL_CANONICAL
GRADED_PREDICTION_COUNT=15_LAST_RECORDED_OFFICIAL_FORWARD
CURRENT_SAMPLE_SIZE=15_LAST_RECORDED_ELIGIBLE_GRADED
LATEST_BACKTEST=EXISTING_SEALED_RESEARCH_NOT_RERUN; GLOBAL_LATEST_UNKNOWN
LATEST_HOLDOUT=V3/V3.1_SCREEN_NO_LAST_RECORDED_NOT_RERUN
PROMOTION_GATE_STATUS=NO_PROMOTION
ENGINE_WEIGHTS_CHANGED=NO
ENGINE_THRESHOLDS_CHANGED=NO
FEATURE_SET_CHANGED=NO
```

Count references: canonical-registry.json under the round-111 canonicalization
folder (2026-09-20T04:47:58.342Z; 45 unique predictions, 47 seals); existing
football-forward-cumulative-evaluation-v1.json (2026-09-17T00:27:32.147Z;
15 graded, N=15). These are unchanged recorded scopes, not refreshed totals.
Status references: ENGINE_STATUS_REPORTING_RULE_V1.md and
V4_XI_PARTIAL_EVIDENCE_CONTRACT_FIX_V1.md. New mission predictions/grades: zero.

## PROGRESS

```text
TODAY_PROGRESS=P0_IMPLEMENTATION_AND_LOCAL_VALIDATION_COMPLETE
OVERALL_PROGRESS=72%_OWNER_SET_BASELINE_UNCHANGED
TODAY_DELTA=+0%p_THIS_MISSION
CURRENT_PHASE=V4_PHASE_0.5_P0_ISOLATION_REVIEW
CURRENT_ENGINE=V1
NEXT_ENGINE=V4_DIRECTION_ONLY
NEXT_MILESTONE=OWNER_REVIEW_OF_P0_RESULT
COMPLETED_TODAY=Safe contract; quarantine isolation; consumer compatibility; offline proof gate; 82 tests; typecheck; integrity comparison
BLOCKED_BY=NO_REMAINING_ISOLATION_FAILURE_IN_EXECUTED_TESTS
WAITING_FOR=OWNER_REVIEW; future collection readiness and authorization not part of this mission
```
