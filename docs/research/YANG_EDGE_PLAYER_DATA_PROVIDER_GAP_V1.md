# YANG EDGE Player Data Provider Gap v1

Repository + local Stats API research cache only. Full commercial catalogs that we never fetched: **UNKNOWN** or **NEEDS_PROVIDER_DOC_REVIEW**.

---

## MLB Stats API (used)

Called today:

- `/api/v1/schedule` (probablePitcher, lineups hydrate)
- `/api/v1/people/{id}`
- `/api/v1/people/{id}/stats?stats=gameLog&group=pitching`
- `/api/v1/game/{pk}/boxscore`
- `/api/v1/venues/{id}?hydrate=location,fieldInfo`
- `/api/v1/teams/{id}/roster?rosterType=40Man` (+ transactions)

**Observed in pitching gameLog.stat (cached), not stored as starter features:**  
BF, K/9, BB/9, HR/9, GO/AO, strike%, strikes, pitchesPerInning, inherited runners, OBP/OPS allowed, etc.

**Observed on people:** `batSide`, `pitchHand`. Lineup builder does not call people for batters (`peopleApiCalls: 0`).

**Observed on schedule games:** `dayNight`. Not written to `mlb-schedule-v1`. `weather` was **null** in the sampled hydrate (weather not requested).

**Observed in pregame boxscore `stats.batting`:** counting stats (PA, AB, H, HR, BB, SO, …). No AVG/OBP/SLG/OPS in that object. `seasonStats.hitting` empty in the sampled pregame boxscore.

**Not observed / not fetched:**

| Gap | Classification |
|---|---|
| `group=hitting` gameLog | UNKNOWN (endpoint unused) |
| `stats=statSplits` vs L/R, day/night | UNKNOWN (unused) |
| FIP / xFIP / xERA / SIERA / wOBA / wRC+ | NOT_AVAILABLE in observed payloads |
| velocity, pitch mix, CSW, whiff, Statcast | NOT_AVAILABLE in observed payloads |
| `/injuries` (Stats API) | unused; IL inferred from 40-man D* codes |
| forecast weather | provider NOT_SELECTED |

---

## SportsDataIO MLB

Code: games, probable pitchers, lineups, injuries. Research datasets set `sportsDataIoScrambled: false` and 2026-07-27 baseline recorded `sportsDataIoUsed: false`. **Not** the player-stat source of truth.

---

## The Odds API

Moneyline (and collect-only RL/totals). **Forbidden** as a player-strength input. Out of this catalog.

---

## API-Football

Wired methods: fixtures, fixture-by-id, standings, **team statistics (raw unknown)**, injuries (raw), lineups (raw).

Not wired: `/players`, `/fixtures/players`, player season stats.

| Data | Gap |
|---|---|
| Player minutes/xG/xA/shots/def/GK | NEEDS_PROVIDER_DOC_REVIEW |
| Starting XI | AVAILABLE_PROVIDER (method), not stored |
| Injuries | AVAILABLE_PROVIDER (method), not stored |
| Team advanced (PPDA, xGD) | UNKNOWN / untyped raw |
| Weather / travel | NOT_AVAILABLE |

Do not treat `src/constants/analysis.ts` dummy football copy as provider coverage.

---

## Implication

The shortest path to a real player layer, without guessing fields:

1. Join `batSide` from `/people` onto confirmed lineup slots (endpoint already used for pitchers).
2. Persist extra **pitching gameLog keys already in cache** (BF, K/9, HR/9, pitches) with sampleSize — still not Engine.
3. Fetch **hitting gameLog** the same cutoff way as pitching, or do not claim batter AVG exists.
4. Persist `dayNight` + venue elevation already returned by Stats API.
5. Football: persist typed `getLineups` / `getInjuries` artifacts **before** any XI strength formula; document team-statistics / players JSON keys before storing xG.

Until those artifacts exist, TodayAdjustedPlayerStrength stays a **schema**, not a number.
