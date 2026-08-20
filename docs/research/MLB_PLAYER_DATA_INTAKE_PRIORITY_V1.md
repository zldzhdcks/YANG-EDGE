# MLB Player Data Intake Priority v1

Intake = **pregame research datasets**. Not Engine weights. Weights stay **UNDEFINED** until backtest.

Join key: **MLB Stats API `person.id`** already on confirmed lineup and starter rows. Do not introduce SportsDataIO PlayerID as a second SoT.

---

## P0 — cannot start a player model without these

| Dataset | Source | Why |
|---|---|---|
| Batter identity on lineup | `/people` `batSide` joined to lineup-dataset slots | Platoon and “who is batting” |
| Batter season/gameLog as-of cutoff | `stats=gameLog&group=hitting` | Base strength in PA units |
| Confirmed lineup ↔ batter stats join | existing playerId | Lineup context is useless without ability |
| Starter full counting profile | copy BF, K/9, BB/9, HR/9 from **already cached** pitching gameLog | ERA/WHIP is not the whole pitcher |
| Starter recent starts | already stored `recentStarts[]` | Condition window (unused today) |
| Bullpen today availability | already stored role+fatigue (expand dates) | Season ERA ≠ today’s available arms |

P0 does **not** include wRC+, Statcast, or weather.

---

## P1 — important expansion

- `statSplits` sitCodes `vl,vr` (always store PA)
- `lastXGames` / `d7` / `d30` hitting and pitching
- `sabermetrics` hitting (wOBA, wRC+) and pitching (FIP, xFIP)
- `pitchArsenal` (type, %, avg speed) for probable starter
- IL listed → availabilityStatus map
- Player rest from last outing vs team travel-rest

Shrinkage coefficients remain undefined. Reliability buckets first.

---

## P2 — matchup

- Pitcher × lineup handedness counts after bats exist
- `expectedStatistics` (store field names `avg/slg/woba`; do not relabel)
- Optional later: one-player `playLog` schema probe (no bulk) for batter vs pitch type
- Reliever saber/platoon

No 9-cell matchup probability.

---

## P3 — environment / niche

- Persist `dayNight`, elevation, turf
- Pregame forecast only after a weather provider is selected (not this mission)
- Park factor from a dated external table only after license review
- Barrel/EV/spin: **BUY later**, not P0

---

## Leakage rules for intake builders

- Hitting/pitching gameLog: include only games with start < slate commence cutoff.
- Splits: season-to-date as-of cutoff, never including the slate game.
- Postgame of game N is legal pregame of game N+1.
- Expected lineup ≠ confirmed.
- Do not call Providers from Prediction.

---

## First dataset to build next

**`mlb-batter-dataset-v0`** (design name only): per probable-game confirmed (or missing) lineup slot → playerId, bats, season counting + rates, sampleSize, asOfCutoff, inputHash.

Then join onto existing lineup-dataset. Still `engineUseAllowed: false`.
