# Real prediction input chain V1

Base: faa1f6712b978ec71688e713d12a3425ac2c90a3. Existing September 20 terminal
evidence stays unchanged. Only September 19 and 20 scope locks existed during
this mission. No future slate, human verification, real provider observation,
real prediction, outcome or grading artifact was invented. All executions below
were synthetic, including historical scores used by the synthetic Poisson test.

## Provider and identity architecture

API-Football is the existing permitted football source. Configuration is
FOOTBALL_API_KEY with the official v3.football.api-sports.io endpoint. Keys are
never part of artifacts. Existing ApiFootballProvider supports cached fixture
retrieval; the new narrow collector explicitly requests future-date NS fixtures,
one permitted league/season, and projects only identity fields. It refuses a
date whose KST day has started. Collection and prediction are separate commands.

The foundation team registry stores provider IDs and advisory aliases; it is not
permission to infer unknown screenshot abbreviations. The foundation competition
registry has exact owner labels. The strict resolver extends the existing Betman
identity module and requires verified directed IDs, competition and kickoff.
Fixture ID has priority, then exact team IDs/league/time. Similar text alone
returns NO_PROVIDER_EVIDENCE. Duplicate candidates return AMBIGUOUS; reversal,
time conflict or non-pregame observation returns CONFLICT. Neutral venue never
changes designated home/away. Only EXACT_MATCH can advance.

Collector output records collectedAt, observedAt, source URL, league/season,
fixture/team IDs, names and kickoff in a hashed immutable envelope. Raw provider
score/result fields are discarded, never supplied to the model. The new local
runner binds that entire envelope hash plus the previously reviewed exact binding
and its source projection hash. No actual six-game provider IDs were fabricated.

## Soccer execution path

1. On a future human-verified scope, collect identity evidence:
   `npm run research:collect-football-pregame-evidence -- --date DATE --league ID --season YEAR --output NEW_LOCAL_PATH`
2. Existing collection runner now supports
   `node --import tsx --env-file=.env.local scripts/run-football-forward-shadow-v1.ts --collect-only`.
   It seals actual observed historical-input envelopes and exits before model
   invocation, prediction sealing, or coverage processing. This is a collector,
   not the production prediction command. Its ordinary legacy --run remains
   available but is not the new operator production entry point. No collector
   command was executed against real providers in this mission.
3. Pin the fixture envelope path/hash, history envelope path/hash and reviewed
   ExactBinding in a local references JSON. No “latest” discovery is permitted.
4. Execute
   `npm run research:football-locked-sealed-forward -- --date DATE --target OPERATOR_ID --inputs REFERENCES_JSON`.

The local runner validates committed scope, unresolved target, >60-second window,
exact identity, actual observation timestamps and input hashes. It preserves the
existing Forward model and immutable format. A PREDICTED snapshot is admitted
through the existing terminal writer and exact bridge. A model PASS is not
relabeled as a prediction; the target remains INPUT_WAITING. Once Forward has
sealed a fixture, that snapshot is never overwritten. Existing terminal evidence
blocks the runner before reading model input. Invalid input leaves the operational
target unresolved, not early terminal PASS. Provider calls from this consumer = 0.

The synthetic integration created a genuine frozen-model PREDICTED snapshot and
one terminal Prediction in a temporary authoritative repository, with global
fetch configured to throw. All temporary data was removed by the test harness.
This demonstrates code-path readiness, not a live performance sample or provider
account/coverage certification. A real future authoritative slate and reviewed
provider binding are still prerequisites for the first real execution.

## MLB exact-byte contract

Native Schedule, Starter (both directed rows), Odds and Lineup documents are the
actual predictor requirements. Summary is derived once during collection, not
rebuilt during prediction. `collectMlbInputManifest` acquires each document inside
the observation boundary, writes it exclusively under a content-hashed filename,
then seals one mlb-pregame-input-manifest-v1 per target/scope. A failed acquisition
does not publish a valid manifest. Existing output paths are never overwritten.

Each entry binds path, raw byte SHA256, schema, source identity, collectedAt,
observedAt, sourceAsOf and asOf. Here asOf is the manifest availability cutoff:
collectedAt <= observedAt <= asOf < kickoff. sourceAsOf separately retains the
statistical/source cutoff, which must be <= observedAt. These are different
meanings, not reversed timestamps or backfilled old observations.

The loader verifies manifest hash, target, scope, all five entries, path containment,
schemas, exact artifact hashes and timestamps. Schedule gamePk/team IDs/kickoff,
both starter/lineup sides and team IDs, odds names/gamePk, each row's timestamp,
cutoff, target exclusion and outcome-field exclusion are validated. Missing away
starter provenance fails closed. Prediction reads each referenced artifact once
into memory. Consumer and enrichment parse those same verified byte strings;
no provider, builder, directory scan or latest-file lookup occurs. Changed files
fail at load; changes after load cannot alter the already captured byte strings.
The actual clock is checked before calculation and again before returning.

`loadAndPredictMlbV0` now requires sealedInput by default. Without it the function
returns SEALED_INPUT_MANIFEST_REQUIRED. The explicit legacyOfflineResearch option
exists only for offline compatibility/equivalence audits; no production CLI sets
it. This deliberately blocks the former unsealed CLI from silently reading daily
files. Model/features/weights/thresholds/pick selection are unchanged. A synthetic
same-byte comparison produced identical legacy and sealed prediction fingerprints.

`npm run research:mlb-sealed-input-check -- --date DATE --target OPERATOR_ID --manifest REL_PATH --hash SHA256 --dry-run`
validates the authoritative target/provider game ID and names before calculation.
It is a dry-run consumer, not an MLB graduation or terminal publisher.

## Remaining MLB limitation

The native-data acquisition callback must be supplied by an approved collection
adapter, not by stamping existing historical files as previously observed. The
old builders can contain optional postgame review or cached-source behavior; they
were inspected, not blindly wired into this boundary. A live adapter still needs
to prove provider game/team mapping and exclude those fields before sealing.
No real acquisition or legacy artifact conversion occurred. The existing MLB
model still disables official picks, and the terminal adapter still supports
FOOTBALL_FORWARD_V1 only. These are explicit remaining gates, not waived by a
successful byte-integrity test. NEXT_REAL_MLB_PREDICTION_READY=NO.

## Verification and disposition

Previous regression: 115/115. New tests: 22/22 (11 soccer/Forward including a
recoverable-blocker lifecycle assertion; 11 MLB). Unique total 137, failed 0.
Relevant TypeScript typecheck passed. Existing 84 September 20 decision/receipt
byte hashes match. Frozen scoring files and the Poisson source hash are unchanged.
No real provider/result/live access, no retroactive prediction, no R1 graduation.

FINAL=SOCCER_READY_MLB_BLOCKED (Soccer code-path readiness; no real future input
has been acquired or approved yet). Preserve the exact pre-cutoff lifecycle:
recoverable blockers wait; cutoff produces the official missed-window PASS.
