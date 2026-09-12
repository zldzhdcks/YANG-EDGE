# Football V3.1 Internal Research Console V1

BASE_SHA: `a67cfa22db1fa5bcdd8e97bd2767ea7f5cb328f6`

This mission adds a local-only research viewer for already sealed Football V1 / H2 / R1 prospective evidence and append-only `postgame-v1.json` grades.

It is a **RESEARCH VIEWER ONLY**. It does not generate or recalculate predictions, refit a model, change map/beta, connect a recommendation engine, create EDGE PICK or stake advice, change Official Forward, expose a public homepage, call a network provider, start a watch/daemon, or attach round-108 domestic odds.

## Route

`/internal/football/research`

Server Component. `dynamic = "force-dynamic"`. `runtime = "nodejs"`. `robots: noindex`.

Production (`NODE_ENV === production`) fail-closes with `INTERNAL_RESEARCH_DISABLED` and no fixture probabilities.

Missing private store fail-closes with `LOCAL_RESEARCH_DATA_UNAVAILABLE`.

Snapshot / input / postgame hash mismatch fail-closes that fixture as `INTEGRITY_BLOCKED`. Probabilities are not shown as valid data.

## Local source

`LOCAL_ONLY = YES`. No provider fallback.

Default root (server-only, relative to process cwd):

`../YANG-EDGE-INBOX/football-v31-r1-prospective-shadow-v1`

Override with server env `FOOTBALL_V31_INTERNAL_RESEARCH_ROOT`. The browser client files do not contain that path.

The last path component must remain `football-v31-r1-prospective-shadow-v1`. Namespace: `V31_R1_PROSPECTIVE_SHADOW`.

## What the screen shows

Top cards:

- SEALED TARGETS
- R1 PREDICTED
- R1 PASS
- RESULT PENDING
- RESULT GRADED
- RESULT BLOCKED
- First checkpoint: `R1 graded PREDICTED / 25`

Banner:

`Prospective research evidence — not a validated recommendation model`

`MODEL_PROMOTED = NO`  
`R1_ROLE = UNPROMOTED_PROSPECTIVE_SHADOW`

Middle: Upcoming / Pending  
Bottom: Graded / Historical prospective results

Per sealed fixture: kickoff KST, league, home, away, V1/H2/R1 status + HOME/DRAW/AWAY % + predicted class from the sealed snapshot only.

Consensus (read-only classification, not a pick):

1. All three PREDICTED and same class → `TRIPLE_CONSENSUS`
2. Else H2 and R1 PREDICTED and same class → `H2_R1_CONSENSUS`
3. Else any PASS → `PASS`
4. Else → `SPLIT`

If `postgame-v1.json` exists and verifies: actual result, actual class, per-model correct / log loss / Brier. PASS grades stay `PREGAME_PASS_PRESERVED`. If the artifact is absent: `RESULT_PENDING`.

Team/league labels are display-only. Identity remains provider IDs.

## Governance

PREGAME_FILES_MUTATED = NO  
MODEL_CHANGED = NO  
FORWARD_CHANGED = NO  
RECOMMENDATION_ENGINE_CHANGED = NO  
MARKET_CONNECTED = NO  
PUBLIC_EXPOSED = NO  
WATCH_STARTED = NO

FOOTBALL_V31_INTERNAL_RESEARCH_CONSOLE_V1_READY_FOR_CTO_REVIEW

STOP.
