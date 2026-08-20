# YANG EDGE Matchup & Environment Framework v1

Design only. No matchup probability. No weather weight. Market stays outside Independent P.

---

## 1. Matchup is not “player quality”

Independent research needs:

```
Player today
    × opponent player / handedness / pitch mix / position
    × lineup slot / role
```

not a single season average.

---

## 2. MLB pitcher × confirmed lineup (design)

Long-term cell (no computation now):

```
For starter S and confirmed batters B1..B9:
  cell[i] = {
    battingOrder,
    playerId,
    bats,                 // join people.batSide — not stored today
    throws: S.throws,     // stored
    platoonFlag,          // after bats exist
    batterBase,           // dataset missing
    batterRecent,         // not fetched
    pitcherRecent,        // recentStarts stored, unused
    pitchTypeOverlap,     // NOT_AVAILABLE in current Stats API gameLog
    sampleSize,
    reliability,
    shrinkRequired
  }
```

Allowed near-term research (still not Engine):

- Count platoon advantage/disadvantage once `batSide` is joined
- Compare starter recent K-BB proxy (SO, BB, BF already in raw gameLog) vs lineup K/BB once hitting counts exist

Forbidden until reliability exists:

- 9-cell weighted “matchup score”
- pitch-type RAP / run value
- calling anyone a RAIN_SPECIALIST or LEFTIE_KILLER from a handful of PA

---

## 3. MLB environment as interaction

Observed / stored:

| Signal | Where | Stored? |
|---|---|---|
| dayNight | schedule hydrate cache | No (drop on schedule-v1) |
| roofType | venue fieldInfo → weather-dataset | Yes (July samples); roof open/closed UNKNOWN |
| elevation, turfType, dimensions | venue cache | No |
| team travel/rest | travel-rest-dataset-v1 | Yes (July) |
| forecast weather | weather-dataset | Explicitly NOT_COLLECTED |

Interaction candidates (not main effects):

- batter × dayNight
- pitcher × dayNight
- fly-ball pitcher × wind (wind not collected)
- venue elevation × HR rate (elevation not stored; HR/9 in raw gameLog only)

Every interaction inherits **split sample** rules from the research framework.

---

## 4. Football matchup / environment (design)

Current artifacts: schedule identity + 1x2 odds freeze. No XI, no player stats.

Target later:

```
Confirmed XI slot
    × opponent slot / role
    × formation (if lineup payload includes it)
    × rest from schedule
```

Positional stories (winger vs fullback, set piece, press) stay **UNKNOWN** until event/lineup schemas are persisted. Do not import dummy UI copy (PPDA, xGA) as features.

Environment: home/away and rest can be derived from schedule; weather/travel/surface are not collected. Football reuse matrix already marks travel/weather as `LATER`.

---

## 5. Other sports

Basketball: B2B + minutes restriction as workload/availability, not as a weather analog.

Volleyball: rotation / lineup combination is the batting-order analog; replacementDelta still requires a bench replacement level.

Same shells: Base → Condition → Availability → Lineup/rotation → Matchup → Workload → Environment → TodayAdjusted (weights UNDEFINED) → Independent P → Market benchmark.
