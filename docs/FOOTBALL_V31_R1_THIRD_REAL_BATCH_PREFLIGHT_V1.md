# FOOTBALL V31 R1 THIRD REAL BATCH PREFLIGHT V1

BASE_SHA: `484806e49e2f89783416639290952a159c66628d`

RESULT_COMMIT_SHA: null

BRANCH: `agent/cursor/football-v31-third-real-batch-preflight-v1`

This mission is preflight only. It discovers, validates identity, and classifies readiness for a third prospective batch. It does not seal predictions. V1, H2, and R1 stay frozen. First-batch and second-batch grades were not used to change the model, map, beta, selector, PASS rule, or weights.

R1_ROLE = UNPROMOTED_PROSPECTIVE_SHADOW

MODEL_PROMOTED = NO

PREDICTION_SEAL_EXECUTED = NO

CHECKPOINT_GAMING = NO

FIRST_SECOND_BATCH_PERFORMANCE_USED_FOR_TUNING = NO

## Why a third preflight

Sealed R1 PREDICTED so far:

- First Real Batch: 15
- Second Real Batch: 4
- CURRENT_SEALED_R1_PREDICTED = 19

The first descriptive checkpoint is 25 R1 PREDICTED graded. The pool is short by at least 6 PREDICTED seals. This preflight does not force those 6. The same 24-hour window, identity, NS/deadline, and causal-history gates are reused unchanged.

## Window

windowEnd = discoveryAt + 86,400,000 ms. Kickoff is inside the window when `kickoffUtc <= windowEnd`. No new window rule.

discoveryAt = 2026-09-12T18:02:00.933Z

windowEnd = 2026-09-13T18:02:00.933Z

scope = ONE_SHOT_24H_NO_RETRY

Source of truth is the sealed foundation census (`READY_CENSUS.json`, hash `5503411bd08384993a81487f516214b55c70f8750030d815e1dd4bfac60c3ec8`). That census was not rewritten. MODEL_FORWARD was not refreshed.

## Already sealed exclusion

First-batch audit (20 SEALED) and second-batch seal audit (4 SEALED) are hash-bound. Those 24 fixture IDs cannot be third-batch READY targets.

Second-batch IDs recognized as ALREADY_SEALED:

- 1575159
- 1570376
- 1557404
- 1550123

## Counts

TOTAL_DISCOVERED = 66

WITHIN_WINDOW = 28

READY_FOR_TRIPLE_SEAL = 0

PASS_PRECHECK = 4

IDENTITY_BLOCKED = 0

OUTSIDE_WINDOW = 38

ALREADY_SEALED = 24

NOT_NS_OR_DEADLINE = 0

V1_READY = 0

H2_READY = 0

R1_READY = 0

earliest kickoff (within window) = 2026-09-12T13:00:00.000Z

latest kickoff (within window) = 2026-09-13T16:30:00.000Z

minimum READY lead time = null (no READY row)

CURRENT_SEALED_R1_PREDICTED = 19

READY_R1_PREDICTED_CAPACITY = 0

PROJECTED_MAX_R1_PREDICTED_IF_ALL_READY_PREDICT = 19

That last number is capacity only. No prediction was run. READY = 0 is a valid result. The window was not widened, leagues were not expanded, and history/PASS gates were not relaxed to chase 25.

## PASS_PRECHECK

Inside the window, identity verified, NS, future, deadline ok, but required causal history is not sufficient. These are not READY_FOR_TRIPLE_SEAL.

- fixtureId=1550122; leagueId=135; season=2026; kickoffUtc=2026-09-13T13:00:00.000Z; homeTeamId=867; awayTeamId=1579
- fixtureId=1557400; leagueId=39; season=2026; kickoffUtc=2026-09-13T13:00:00.000Z; homeTeamId=1346; awayTeamId=51
- fixtureId=1575166; leagueId=78; season=2026; kickoffUtc=2026-09-13T15:30:00.000Z; homeTeamId=1660; awayTeamId=157
- fixtureId=1570375; leagueId=140; season=2026; kickoffUtc=2026-09-13T16:30:00.000Z; homeTeamId=546; awayTeamId=544

## Causal history

History observations must have `providerFetchedAt` and `completion.providerFetchedAt` strictly before discovery/cutoff. The target fixture is excluded. `postgame-v1.json`, grades, correct, actualClass, logLoss, and Brier are not inputs. API recheck uses `/fixtures?id=` identity and status only.

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

Third-batch preflight tests: 12 PASS (first 20 excluded, second 4 excluded, duplicate rejection, exact identity, unchanged 24h rule, NS/deadline gate, causal history only, target excluded from history, no postgame input, no market input, frozen hashes, checkpoint gaming prohibited).

Regression: comparator + prospective + grader + receipt + multi-batch grader + second preflight/seal: 126 PASS.

## Local evidence

Private discovery JSON is LOCAL_ONLY under `YANG-EDGE-INBOX/football-v31-r1-third-real-batch-preflight-v1` and is not committed. Hash: 2b69960ed65b51e96e1cbd41762456c917e62c3768e71aa567639146a77437c9

A later authorized mission may seal READY fixtures. This window has none.

FOOTBALL_V31_R1_THIRD_REAL_BATCH_PREFLIGHT_V1_READY_FOR_CTO_REVIEW

STOP.
