# Football V3.1 Internal Market Comparison V1

BASE_SHA: `a6611d9628888a8dde4a90c9946dfba9642c9aa1`

This mission adds an owner-only domestic 1X2 market comparison layer under the existing Internal Research Console.

Order is fixed:

Independent model → prediction freeze → Market comparison

Market odds are never V1 / H2 / R1 prediction input.

## Route

`/internal/football/research`

Same server-only research console. `dynamic = force-dynamic`. `runtime = nodejs`. `robots: noindex`. Production still fail-closes with `INTERNAL_RESEARCH_DISABLED`.

## Market source

Owner-only screenshot evidence is not OCR'd again and is not committed.

Local JSON export (gitignored, outside this repo):

`../YANG-EDGE-INBOX/football-v31-internal-market-comparison-v1/owner-only-1x2-v1.json`

Override with server env `FOOTBALL_V31_INTERNAL_MARKET_EVIDENCE`. Client files do not contain that path or screenshot files.

Each 1X2 row carries `fixtureId`, `observedAt`, `marketType`, `line`, `selection`, `odds`, `sourceSha256`, `roundIdentityConfirmed`, plus sealed identity fields (`leagueId`, `season`, `kickoffUtc`, `homeTeamId`, `awayTeamId`).

Join is exact identity only. Team-name fuzzy join is forbidden. If fixture identity / league / scheduled kickoff do not match: `MARKET_IDENTITY_UNCERTAIN`.

## Comparison V1

`MARKET_COMPARISON_V1 = 1X2_ONLY`

Totals remain raw-evidence-capable in the local file, but are not rendered as value comparison. `TOTALS_RECOMMENDATION_ENABLED = NO` because prospective totals calibration is not verified.

Handicap is excluded. Model-derived handicap probability is not a sealed research contract. `HANDICAP_COMPARISON_ENABLED = NO`.

For each sealed fixture with a matched 1X2 row the console shows:

- market `observedAt`
- Home / Draw / Away odds
- market implied raw `1 / odds`
- 3-way proportional margin removal: `normalized = raw / sum(raw)`
- `FAIR_ODDS = 1 / MODEL_PROBABILITY` when the model is PREDICTED
- V1 / H2 / R1 probability difference versus normalized market, labeled **Probability difference · Model vs normalized market**

EV / EDGE / 추천 / 베팅 가치 / 수익 / Top pick / Best value / A/B/C grade are not shown.

## Warnings

`ROUND_IDENTITY_CONFIRMED = NO` remains.

Banner: `Market screenshot evidence; not current live odds.`

`CAPTURE_TIME_UNVERIFIED` is always shown for this evidence. These are not current live odds.

## Governance

MARKET_INPUT_TO_MODEL = NO  
ROUND_IDENTITY_CONFIRMED = NO  
MARKET_TYPE = 1X2_ONLY  
TOTALS_RECOMMENDATION_ENABLED = NO  
HANDICAP_COMPARISON_ENABLED = NO  
PREGAME_FILES_MUTATED = NO  
MODEL_CHANGED = NO  
FORWARD_CHANGED = NO  
RECOMMENDATION_ENGINE_CHANGED = NO  
PUBLIC_EXPOSED = NO

FOOTBALL_V31_INTERNAL_MARKET_COMPARISON_V1_READY_FOR_CTO_REVIEW

STOP.
