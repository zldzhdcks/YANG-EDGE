# MLB Pregame Player Feature Dataset v1

Research sidecar only. This is not a prediction model, Player Strength score, or Engine input.

## What it is

A point-in-time research asset that, for each scheduled game, stores what was knowable **before** first pitch:

- Confirmed batting-order identities (from PRE_GAME lineup observation / batter-pregame capture)
- Individual batter counting stats and derived rates through D-1
- Recent batter observation windows (`LAST_14_DAYS`, `LAST_30_DAYS`) ending D-1
- Platoon split rows with PA / sample size (no numeric matchup adjustment)
- Probable / confirmed starter identity and D-1 pitching counting stats
- Sample-size reliability labels for research display
- Strict temporal provenance

Artifact:

```
data/research/mlb/player-features/{dateKst}/dataset-v1.json
data/research/mlb/player-features/{dateKst}/manifest-v1.json
```

Schema identity: `mlb-pregame-player-feature-dataset-v1`.

Canonical game identity is `gamePk`. `internalGameId` is never the unique key.

## What it is not

- Not Player Strength
- Not Lineup Strength / Starter Strength / Bullpen Strength
- Not a win-probability model
- Not an Engine-admitted feature
- Not a market-derived rating
- Not a 0–100 player score
- Not a historical backfill of true live pregame captures

Independent model sample stays **0**. Engine admission stays **PROHIBITED**.

## Temporal policy

`temporalPolicy = OFFICIAL_DATE_MINUS_ONE_DAY`

Example: game `officialDate = 2026-08-25` → every statistical window ends on **2026-08-24**.

Same-day results, including doubleheader Game 1, never enter Game 2 features in v1. Both games use D-1.

`now >= commenceTimeUtc` → `BLOCKED_POST_CUTOFF`. No feature fetch for that game.

If every slate game is post-cutoff: provider calls = 0, feature fetch attempts = 0.

## Live vs future historical reconstruction

Provenance classes:

| Class | Meaning |
| --- | --- |
| `TRUE_LIVE_PREGAME_CAPTURE` | PRE_GAME lineup identity + before-cutoff + D-1 window actually supportable |
| `HISTORICAL_POINT_IN_TIME_RECONSTRUCTION` | Reserved for a later backfill mission |
| `UNKNOWN` | Provenance cannot be proven |
| `NOT_PROVABLE` | Payload exists but is not date-bounded (e.g. season platoon splits, pitch arsenal) |

UNKNOWN is never silently promoted to PRE_GAME_SAFE.

This mission builds **live-safe infrastructure only**. It does not bulk-backfill history. A reconstructed bounded-stat dataset must never be mixed with TRUE_LIVE_PREGAME_CAPTURE samples.

## Lineup requirement

Batter features attach only to a safely available PRE_GAME identity.

Preferred: immutable batter-pregame capture (`collectionPhase=PRE_GAME`, `collectionStatus=CONFIRMED`).

Fallback: latest confirmed PRE_GAME lineup observation.

- Confirmed 9+9 is ideal (`lineupStatus=CONFIRMED`)
- Partial lineup: store only known players; do not fabricate
- No lineup: `BLOCKED_NO_CONFIRMED_LINEUP`
- Postgame boxscore lineups are not treated as pregame

## Feature availability

### Batters (implemented)

Identity: `playerId`, `playerName`, `bats`, `battingOrder`, `defensivePosition`

Season-to-date through D-1 counts: PA, AB, H, 2B, 3B, HR, BB, SO, TB

Provider rates when returned from the same window: AVG, OBP, SLG, OPS, BABIP

Derived from stored counts only:

- `K_RATE = SO / PA`
- `BB_RATE = BB / PA`
- `HR_RATE = HR / PA`
- `ISO = SLG - AVG` (same window only)

Division by zero or missing parent → `null`, not `0`.

Recent windows ending D-1: LAST_14_DAYS, LAST_30_DAYS with PA + rates + derived K/BB/HR rates.

These are observed recent data. They are not “form strength”.

Platoon vs LHP / vs RHP: PA, AVG, OBP, SLG, OPS, BABIP, HR, BB, SO. The row names which split corresponds to today’s opposing starter hand (`selectedPlatoonSplit`). No numeric matchup adjustment.

wOBA / wRC+: `NOT_COLLECTED` unless a bounded point-in-time request is later proven.

### Starters (implemented)

Identity: `playerId`, `playerName`, `throws`, `starterStatus` (PROBABLE / CONFIRMED / MISSING)

Season-to-date through D-1: IP, ERA, WHIP, SO, BB, HR, BF, gamesStarted

Derived: `K_RATE = SO / BF`, `BB_RATE = BB / BF`, `K_MINUS_BB_RATE`, `HR9 = (HR * 9) / IP`

FIP / xFIP: `NOT_COLLECTED`

Pitch arsenal: stored as `NOT_PROVABLE` in v1. Current/future arsenal blobs must not leak into a historical row.

### Sample-size labels

Research display only. Not sports-performance weights. Not Prediction / Player Strength / Engine inputs.

Batter PA: &lt;20 INSUFFICIENT, &lt;50 LOW, &lt;150 MODERATE, else HIGH.

Pitcher IP: &lt;10 INSUFFICIENT, &lt;30 LOW, &lt;80 MODERATE, else HIGH.

Rates always travel with PA (batters / platoon) or IP/BF (starters).

## Deferred feature families

Bullpen individual player features (dataset `bullpenImplemented=false`)

HardHit%, Barrel%, exit velocity, xwOBA unless bounded provenance is proven

Batter vs exact pitcher career H2H

Pitch-type batter performance

Defensive metrics, WAR-based Player Strength

Injury / weather / travel numeric adjustments

Win probability, arbitrary 0–100 player rating

## Why sample size accompanies rates

A 12-PA platoon split is an observation, not a specialist claim. v1 stores the split and its PA so later research can apply shrinkage. v1 does not invent that shrinkage.

## Why no Player Strength yet

Identity ≠ ability ≠ strength. This dataset is the raw/derived feature layer. A Player Strength score would invent weights. That is a later mission, after this asset exists and can be backtested.

## Why market data is excluded

Market odds and market probability are not inputs. They must not appear in player-feature formulas. Independent player/matchup research cannot be trained on the thing it is supposed to compete with.

Prediction reads of this dataset: 0. Recommendation writes: 0. Engine weight changes: 0.

## Provider / cache

MLB Stats API only, through `research-stats-cache` (`getRawStatsJson`).

Query families: person, hitting gameLog, pitching gameLog, hitting sitCodes vl/vr.

`--dry-run`: 0 provider calls, 0 writes.

`--cache-only`: 0 network calls; may build from cache + existing identity evidence.

Write-once: existing `dataset-v1.json` is refused, not replaced. No `--force`.

Canonical dataset hash excludes `generatedAt`, `capturedAt`, `datasetHash`, `providerSummary`.

## Operator command

```
npm run ops:mlb-player-features -- YYYY-MM-DD
npm run ops:mlb-player-features -- YYYY-MM-DD --dry-run
npm run ops:mlb-player-features -- YYYY-MM-DD --cache-only
npm run ops:mlb-player-features -- YYYY-MM-DD --game-pk 776123
npm run ops:mlb-player-features -- YYYY-MM-DD --json
```

Do not run a live provider capture for a sealed post-cutoff slate (including 2026-08-24).

## Tests

```
npm run test:mlb-player-features-v1
```
