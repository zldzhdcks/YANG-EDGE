# Four-league Forward Shadow V1

Implementation ready for review; first live seal BLOCKED by the current provider plan.

Base: `f7fff5f40712f28ee18405e069ba21d7c8338398`.
Branch: `agent/astra/football-historical-source-gate-v1`. No main merge.

## Actual provider check

At 2026-09-10T14:21:18.353Z, official API-Football metadata identified EPL current season as 2026. The fixtures endpoint returned: `Free plans do not have access to this season, try from 2022 to 2024.`

The runner stopped further league queries on this plan denial. La Liga, Serie A and Bundesliga current fixture access was not independently verified. No live fixtures or past FT inputs were retrieved, no live prediction/PASS was manufactured, and no live prediction hash exists. Scheduled fixtures, nearest slate and missed count across all four leagues remain UNKNOWN, not zero. CLI exits 1 on incomplete coverage. See the committed sanitized provider execution audit.

## Pregame data flow

1. Query official current-season league metadata for 39, 140, 135, 78, then fixtures from today through seven days ahead (UTC).
2. Project target schedule identity only. Never read its score, goals, prediction, market or shadow fields. Raw upcoming fixture responses are neither passed to the model nor persisted.
3. Separately request FT history for the current and previous season within the actual 365-day window. Preserve regular-season history, exact provider IDs and regular-time `score.fulltime` goals. No fuzzy mapping or inferred kickoff identity.
4. Timestamp each completed provider response with actual `providerFetchedAt`, with source-response SHA256. Keep source counts and exclusions in the run audit. A failed history request blocks new seals for that league; it cannot be converted to an empty-history PASS.
5. Use only same-league FT observations strictly before actual cutoff, with kickoff within the frozen 365-day lookback. Target ID is rejected. Frozen v1 requires observation strictly before cutoff, which is stronger than the owner-approved <= predictionCreatedAt boundary. No historical 48-hour availability proxy is used.
6. Freeze every selected observation (provider ID, kickoff, team IDs, FT status/goals, actual fetch timestamp and source hash), target schedule evidence and cutoff into `input.json`. Its canonical SHA256 is included in `snapshot.json`.
7. Invoke the unchanged model. Preserve low-sample PASS with null probabilities and original reasons. No model adjustment for DRAW behavior, new weights, odds, owner or external inputs.

`TARGET_RESULT_DATA_USED=false` always. `PAST_COMPLETED_RESULT_DATA_USED` reflects actual selected history; it is null in a run with no prediction snapshots, not a claim that live data was used.

## Storage and deadlines

All operational data lives in gitignored `data/cache/research/football/forward-shadow-v1/`:

- `MODEL_FORWARD/fixtures/<provider fixture.id>/input.json`, `snapshot.json`, `seal-receipt.json`.
- `MODEL_FORWARD/fixtures/<id>/miss.json`: permanent MISSED_PREGAME_SNAPSHOT; cannot be backfilled even if a later schedule changes.
- `MODEL_FORWARD/coverage/<UTC date>/`: append-only daily observations, scheduled/eligible/predicted/pass/missed counts and provider coverage status.
- `MODEL_FORWARD/runs/`: projected schedules, run reports and snapshot manifests.
- `MODEL_FORWARD/postgame/<id>.json`: separate optional grade, never modifies pregame files.
- `OWNER_MANUAL_SHADOW/` and `EXTERNAL_ANALYSIS_SHADOW/`: physically separate reserved directories; schemas only, never model inputs.

Exclusive `wx` create, fsync, canonical hashes and a pre-kickoff seal receipt prevent application overwrite. Existing valid seals are reused, including after kickoff. A seal crossing kickoff is invalidated and becomes a permanent MISS. Partial seals require review and are never silently overwritten. V1 supports no revisions. Local files are application append-only, not hardware WORM: host clock, filesystem and backup integrity remain operational trust boundaries.

New seals require NS and at least 60 seconds before kickoff; kickoff is rechecked around inference and persistence. Postponed/cancelled/TBD schedules do not create a false started-game MISS. Previously discovered schedules are revisited on each run, so downtime losses are recorded after restart. Fixtures never observed because the provider was unavailable cannot be enumerated as MISS; coverage remains incomplete. UTC daily audits are recorded even with no observed fixtures, with null scheduled total on provider failure.

## Operation

From the repository root, with dependencies installed and `FOOTBALL_API_KEY` available:

```powershell
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/run-football-forward-shadow-v1.ts --run
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/run-football-forward-shadow-v1.ts --watch
```

`--watch` runs immediately, then every six hours after completion; it must remain running on an awake machine. No OS service, startup task or Codex scheduled automation was installed. Watch is NOT running because current-season access is denied. It does not restart itself after process/machine shutdown. Request ceiling is 16 per cycle, at least 6.5 seconds apart; account-wide usage by other tools must also fit the provider quota. Only the official API host is contacted, and only `/leagues` and `/fixtures`; no market, owner/external analysis or betting endpoint.

Postgame `grade()` is exported separately in `scripts/football-forward-postgame-v1.ts`; it requires an actually observed official FT result after kickoff and a valid pregame seal. It writes an exclusive separate record; PASS correctness remains null. No automatic result collector or actual grading ran in this mission.

## Validation

- 13 forward tests: forbidden-field getters, actual FT PREDICTED, observation/hash preservation, temporal/league exclusion, immutable reuse, PASS, post-kickoff MISS, late seal, input tamper, incomplete coverage, separate postgame.
- 40/40 combined forward + frozen model/protocol/backtest unit tests. Synthetic test fixtures only; no new historical performance backtest.
- Scoped strict TypeScript and ESLint; source/model hash guards.
- Actual provider denial verified; current-season successful network-to-seal integration remains unverified until access is available.

Model SHA256: `6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf`.

ENGINE_CHANGED=NO; MODEL_CHANGED=NO; WEIGHTS_CHANGED=NO; MIN_SAMPLE_CHANGED=NO; ODDS_USED=NO; MARKET_USED=NO; PROVIDER_PREDICTION_USED=NO; OWNER_SHADOW_USED=NO; EXTERNAL_SHADOW_USED=NO; TARGET_RESULT_DATA_USED=NO; STRICT_AS_OF_FABRICATED=NO.

Review status: `FOOTBALL_4_LEAGUE_FORWARD_SHADOW_V1_READY_FOR_CTO_REVIEW` applies to implementation only. Live rollout remains blocked; do not describe this as a completed first forward seal.
