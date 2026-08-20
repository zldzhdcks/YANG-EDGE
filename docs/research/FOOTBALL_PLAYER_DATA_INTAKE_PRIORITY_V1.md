# Football Player Data Intake Priority v1

Intake = **pregame research datasets**. Not Engine weights. Football market-baseline remains **MARKET_BASELINE**, not Independent.

Join key: **API-Football player id** (same family as fixtures). Odds API event ids stay on the market side only.

Quota: `/players?league&season` is paginated (20/page). Design a cap before any harvest. This mission makes **zero** paid calls.

---

## P0 — cannot start a player model without these

| Dataset | Source | Why |
|---|---|---|
| Typed starting XI | existing `getLineups` (`/fixtures/lineups`) | Who actually plays |
| Formation + bench | same payload | Role / replacement |
| Injuries / absences | existing `getInjuries` | Availability ≠ minutes |
| Player identity + basic counting | `/players` (not wired) | minutes, goals, assists, shots |
| Team result profile | existing `getTeamStatistics` (raw → typed) | Team context, not xG |

Missing lineup before the documented 20–40 minute window = `NOT_RELEASED`, not “expected XI from a second vendor.”

---

## P1 — important expansion

- `/fixtures/players` after full time → minutes last 3/5, consecutive starts
- Team rest / congestion derived from schedule-v1 kickoffs
- Key passes, tackles, interceptions, duels from the same player endpoints
- GK saves / goals conceded once shots-faced fields are confirmed in a **single** schema probe (operator-approved, not done here)

---

## P2 — matchup / advanced

- Derived winger-vs-FB etc. only after XI + player datasets exist
- xG / xA / PSxG / PPDA: **NOT_AVAILABLE** on documented API-Football fields → other provider **later**, no purchase now

---

## P3 — environment

- Venue already on fixtures
- Weather / travel / altitude: not collected; no new vendor this mission

---

## Leakage rules

- Player season stats must be reconstructable as-of kickoff (completed fixtures only).
- Live `/fixtures/players` during the match is not a pregame feature.
- Do not use 1x2 implied probability inside player strength.
- Dummy `src/constants/analysis.ts` copy is not provider evidence.

---

## First dataset to build next

**`football-lineup-dataset-v0`** from `getLineups` with lineupStatus `CONFIRMED | NOT_RELEASED | AFTER_CUTOFF`, fixtureId, playerId, position, startXI flag, formation.

Then **`football-player-counting-v0`** from `/players` for those IDs only (not a league-wide 25-page scrape).

`engineUseAllowed: false`. Independent sample stays 0.
