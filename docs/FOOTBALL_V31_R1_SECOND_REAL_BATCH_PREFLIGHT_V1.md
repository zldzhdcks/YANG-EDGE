# FOOTBALL V31 R1 SECOND REAL BATCH PREFLIGHT V1

BASE_SHA: e33c40ecc2aa871f183e09950155eaefa20fc358

RESULT_COMMIT_SHA: f8a3d7081b9888a66644848649bb43fd6c3205a7

BRANCH: agent/cursor/football-v31-second-real-batch-preflight-v1

This mission is preflight only. It discovers, validates identity, and classifies readiness for a second prospective batch. It does not seal predictions. V1, H2, and R1 stay frozen. First-batch grades are evaluation evidence only and were not used to change the model, map, beta, selector, PASS rule, or weights.

R1_ROLE = UNPROMOTED_PROSPECTIVE_SHADOW

MODEL_PROMOTED = NO

PREDICTION_SEAL_EXECUTED = NO

FIRST_BATCH_PERFORMANCE_USED_FOR_TUNING = NO

## Window

The first real batch used a one-shot 24-hour window: `windowEnd = executedAt + 86400000`, and a census target is inside the window when `kickoffUtc <= windowEnd`. That convention is reused unchanged.

discoveryAt = 2026-09-12T16:39:58.999Z

windowEnd = 2026-09-13T16:39:58.999Z

scope = ONE_SHOT_24H_NO_RETRY

Discovery source is the sealed foundation census (`READY_CENSUS.json`, hash `5503411bd08384993a81487f516214b55c70f8750030d815e1dd4bfac60c3ec8`). That census was not rewritten. MODEL_FORWARD was not refreshed. `prepare --prepare` was not run.

## Counts

TOTAL_DISCOVERED = 66

WITHIN_WINDOW = 28

READY_FOR_TRIPLE_SEAL = 4

PASS_PRECHECK = 4

IDENTITY_BLOCKED = 0

OUTSIDE_WINDOW = 38

ALREADY_SEALED = 20

NOT_NS_OR_DEADLINE = 0

V1_READY = 4

H2_READY = 4

R1_READY = 4

earliest kickoff (within window) = 2026-09-12T13:00:00.000Z

latest kickoff (within window) = 2026-09-13T16:30:00.000Z

minimum lead time (READY only) = 75001001 ms (~20.83 h)

API rechecks = 66

unverified = 0

The 20 first-batch seals remain ALREADY_SEALED. They are not second-batch triple-seal candidates. First-batch correct / logLoss / Brier / actualClass values were not read.

## READY_FOR_TRIPLE_SEAL

Exact identity, NS, future, deadline ≥ 60s, and causal history potentially satisfiable. V1/H2/R1 share that census gate because this preflight does not run predictions.

- fixtureId=1575159; leagueId=78; season=2026; kickoffUtc=2026-09-13T13:30:00.000Z; homeTeamId=173; awayTeamId=175
- fixtureId=1570376; leagueId=140; season=2026; kickoffUtc=2026-09-13T14:15:00.000Z; homeTeamId=539; awayTeamId=529
- fixtureId=1557404; leagueId=39; season=2026; kickoffUtc=2026-09-13T15:30:00.000Z; homeTeamId=33; awayTeamId=50
- fixtureId=1550123; leagueId=135; season=2026; kickoffUtc=2026-09-13T16:00:00.000Z; homeTeamId=492; awayTeamId=500

## PASS_PRECHECK

Inside the window, identity verified, NS, future, deadline ok, but required causal history is not yet sufficient. First-batch selection also did not drop these at window time; they would be PASS if sealed now. They are not READY_FOR_TRIPLE_SEAL.

- fixtureId=1550122; leagueId=135; season=2026; kickoffUtc=2026-09-13T13:00:00.000Z; homeTeamId=867; awayTeamId=1579
- fixtureId=1557400; leagueId=39; season=2026; kickoffUtc=2026-09-13T13:00:00.000Z; homeTeamId=1346; awayTeamId=51
- fixtureId=1575166; leagueId=78; season=2026; kickoffUtc=2026-09-13T15:30:00.000Z; homeTeamId=1660; awayTeamId=157
- fixtureId=1570375; leagueId=140; season=2026; kickoffUtc=2026-09-13T16:30:00.000Z; homeTeamId=546; awayTeamId=544

## Causal history

History is observation records whose `providerFetchedAt` and completion observation time are strictly before discovery/cutoff. The target fixture is excluded. Future fixture results are not read. `postgame-v1.json` is not an input. API recheck uses `/fixtures?id=` identity, kickoff, and NS status only. Score, goals, events, lineups, statistics, and predictions are not accessed.

## Frozen parameters

V1_HASH = 6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf

ADAPTER_HASH = 125f715c85a5199b7f5725949c4b1ff6f12b1e5d6ef65095c5af0d0673682b6b

H2_HASH = fab9d235b885207a0feba198f1e777f0a8ee0577e50d14f317613e7dcfef0aea

MAP_HASH = 244c2ef4f930855271744e39f0de44598ec6c929ac18edd4c6f72965eb8a4a26

BETA_HASH = dc8f9faa4a09429ddfdd46631502375540e25fdbb37f84a1f92f6ceeb21e2ab4

MODEL_CHANGED = NO

MAP_CHANGED = NO

BETA_CHANGED = NO

SELECTOR_CHANGED = NO

MARKET_INPUT_USED = NO

POSTGAME_INPUT_USED = NO

FORWARD_CHANGED = NO

RECOMMENDATION_ENGINE_CHANGED = NO

## Tests

Second-batch preflight tests: 10 PASS (after-discovery READY, before-cutoff reject, exact identity only, no market import, no postgame-grade input, no result input, frozen hashes unchanged, same 24h eligibility convention, classification split, import firewall).

Regression: comparator + prospective + postgame grader/receipt suites, 78 PASS.

## Local evidence

Private discovery JSON is LOCAL_ONLY under `YANG-EDGE-INBOX/football-v31-r1-second-real-batch-preflight-v1` and is not committed. Hash: 274b5266e0c898279890e26644305187b4e2a725462c1f60f65d9890e142cccc

Audit SHA256 (canonical payload): 2fd09298fcf44340bf5818bcde6d19549201b6e803c82db1f24a4da62a638680

A later authorized mission may seal the four READY fixtures. This mission does not.

FOOTBALL_V31_R1_SECOND_REAL_BATCH_PREFLIGHT_V1_READY_FOR_CTO_REVIEW

STOP.
