# YANG EDGE Player Condition Research Framework v1

Status: **AUDIT + DATA DESIGN**. No Engine weights. No prediction snapshot writes. Market probability is not a player-strength input.

Previous methodology audit: `48c9ac8` (`docs/research/YANG_EDGE_PREDICTION_METHODOLOGY_AUDIT_V1.md`). Independent Statistical Model sample remains **0**.

---

## Target chain

```
BASE PLAYER STRENGTH
    ↓
RECENT CONDITION
    ↓
AVAILABILITY
    ↓
EXPECTED / CONFIRMED LINEUP
    ↓
OPPONENT MATCHUP
    ↓
WORKLOAD / FATIGUE
    ↓
WEATHER / VENUE / ENVIRONMENT
    ↓
TODAY ADJUSTED PLAYER STRENGTH   (weights = UNDEFINED)
    ↓
TEAM MATCHUP FEATURES
    ↓
INDEPENDENT SPORTS MODEL
    ↓
INDEPENDENT PROBABILITY
    ↓
MARKET BENCHMARK                 (after, never inside)
```

---

## Common concepts

### A. Base strength

Long-run ability in sport-native units (per PA / per BF / per 90). Question: *what kind of player is this in a large sample?*

Today MLB actually has this only for **probable pitchers** (ERA/WHIP/IP/K/BB/HR). Batters and football players do not have a stored base-strength dataset.

### B. Recent condition

Not team W/L. Player performance in last 5/10 games or 14/30 days, always with `sampleSize` + `window` + `playerBaseline` + `baselineDelta`.

Today: starter `recentStarts[]` (up to 5) is **stored and unused**. Batter and football recent windows are not fetched.

### C. Availability

Roster presence ≠ able to produce baseline performance.

Statuses (design): `CONFIRMED_STARTER | EXPECTED_STARTER | BENCH | INJURED | SUSPENDED | QUESTIONABLE | LIMITED | RETURN_FROM_INJURY | MINUTES_OR_PITCH_RESTRICTION | REST_POSSIBILITY | UNKNOWN`.

Today: MLB IL listed players stored on injury-dataset-v1 (sample dates). Confirmed vs expected lineup are separate artifacts. Football injuries/lineups methods exist, no dataset.

### D. Workload / fatigue

Player rest, recent appearances, previous outing load, travel as context.

Today: bullpen fatigue snapshots exist (July). Starter last outing date stored. Team travel-rest exists (July). Football rest not derived.

### E. Opponent matchup

*Good player* ≠ *good today against this opponent*.

Today: pitcher `throws` stored; batter `batSide` exists on `/people` cache but is **not joined** to confirmed lineup (`battingSideCollected: 0`). Pitch-type matchup **not available** in observed Stats API gameLogs. Football XI/tactical matchup untyped.

### F. Environment

Day/night, venue, roof, elevation, weather, travel. Sport-specific. Weather is an **interaction candidate**, never a standalone weight.

Today: roof type stored (July weather dataset). Forecast `NOT_COLLECTED`. `dayNight` and `elevation` observed in raw cache, not stored on schedule/weather rows.

---

## Sample / shrinkage policy

```
Observed Split
    ↓
Sample Reliability (INSUFFICIENT / PROVISIONAL / USABLE)
    ↓
Shrink toward player or league mean
    ↓
Adjusted Split Feature
```

- Rain + 10 PA OPS 1.200 is **not** RAIN_SPECIALIST.
- Every split feature should carry `SplitReliabilityMeta` (`sampleSize`, `populationBaseline`, `playerBaseline`, `splitValue`, `reliability`, `shrinkRequired`).
- `shrinkCoefficient` stays **undefined**. Bullpen already has sample buckets (0–2 insufficient, 3–5 provisional, 6+ classified) as a **role classifier**, not as a condition score.

---

## Today Adjusted Player Strength (design only)

```
TodayAdjustedPlayerStrength =
    BaseStrength
    + RecentConditionAdjustment
    + MatchupAdjustment
    + AvailabilityAdjustment
    + WorkloadAdjustment
    + EnvironmentAdjustment
```

All adjustment weights = **UNDEFINED**. No numeric scoring in this mission. Market odds are forbidden in this identity.

---

## Explainability contract (future independent prediction)

`keyDrivers[]` must be able to name:

| Field | Purpose |
|---|---|
| playerId / playerName | which person |
| category | BASE / CONDITION / AVAILABILITY / LINEUP / MATCHUP / WORKLOAD / ENVIRONMENT |
| direction | HOME / AWAY / NEUTRAL |
| feature / baseline / todayValue | what moved |
| matchup | opponent context |
| sampleSize / reliability | whether it is usable |
| explanation | one sentence, no market prior |

Questions the future model must answer: why this team; which player; which matchup; which absence/return; condition change; fatigue; environment; **why different from market** (comparison after independent P).

Current MLB v0 can name a starter ERA/WHIP edge and a market pull. It cannot attribute a batter, a replacement, or a weather interaction. Football market baseline cannot disagree with the market.

---

## What this framework does not do

- Does not change `mlb-baseline-prediction-v0` weights
- Does not fetch new Provider fields into prediction
- Does not create batter or football player datasets yet
- Does not admit bullpen/lineup/weather to Engine

See also:

- `YANG_EDGE_PLAYER_CONDITION_FEATURE_MATRIX_V1.md`
- `YANG_EDGE_MATCHUP_ENVIRONMENT_FRAMEWORK_V1.md`
- `YANG_EDGE_PLAYER_DATA_PROVIDER_GAP_V1.md`
- `data/audits/yang-edge-player-condition-feature-audit-v1.json`
