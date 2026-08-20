# YANG EDGE Provider Capability Audit v1

Status: **AUDIT ONLY**. Independent Statistical Model sample = **0**. Engine admission **PROHIBITED**. Market probability is not an Independent feature.

Supersedes player-condition “hitting gameLog never fetched = UNKNOWN” for **provider capability** only. It does **not** rewrite prediction snapshots or the player-condition audit JSON.

Previous commits: methodology `48c9ac8`, player-condition `639694c`.

---

## Target chain

```
SPORT / PLAYER DATA  (this audit)
    ↓
Independent Sports Model     (NOT IMPLEMENTED)
    ↓
Independent Probability
    ↓
Market Probability           (benchmark only)
    ↓
Independent vs Market
```

Existing predictions remain LEGACY_HEURISTIC / MARKET_ASSISTED / MARKET_BASELINE / BLOCKED / INSUFFICIENT.

---

## Core finding

YANG EDGE is **not** blocked on a new paid Statcast/xG feed to *start* a player layer.

The public **MLB Stats API** already returns, on unused endpoints:

- batter gameLog: PA, AVG, OBP, SLG, OPS, BABIP
- sabermetrics: wOBA, wRC, wRC+, FIP, xFIP
- expectedStatistics: avg / slg / woba / wobaCon
- statSplits: vs L/R, home/away, day/night (with PA)
- pitchArsenal: pitch type, usage %, average speed

Football **API-Football** already documents XI, injuries, minutes, goals, shots, key passes, tackles — methods for lineups/injuries/team stats are wired and unused; `/players` is not wired.

What **does** require another provider (do **not** purchase in this mission):

- Barrel% / EV / launch angle / spin / CSW / pitch run value
- Football xG / xA / PSxG / PPDA

Money already connected is mostly spent on **schedule + odds**, not on player research artifacts.

---

## Provider inventory (repository only)

| ID | Integration | Research SoT | Player stats | Notes |
|---|---|---|---|---|
| MLB Stats API | Yes | **Yes** (starter/lineup/bullpen) | Pitching stored; hitting/saber unused | Public, no key |
| API-Baseball | Yes | Schedule identity | `/players` observed **missing** (2026-07-27) | CURRENT_PLAN_UNKNOWN |
| SportsDataIO | Yes | **No** (`sportsDataIoUsed=false`) | Dictionary has wOBA/FIP; not fetched | Trial scrambled blocked |
| API-Football | Yes | Schedule | `/players` documented, not wired | CURRENT_PLAN_UNKNOWN |
| The Odds API | Yes | Odds | **None** | Independent-forbidden as player input |
| TheSportsDB | Yes | KBO/NPB fallback | No | Free 3-events/day in code |
| Weather candidates | Named only | No | No | Forecast NOT_COLLECTED |
| API-Basketball / Volleyball | No | No | Preview | Family marketed, not wired |

Dummy providers are test-only.

---

## MLB capability (evidence)

Public probe 2026-08-20: **13** HTTP attempts to `statsapi.mlb.com`, **12** success, **1** HTTP 500 (`metricAverages`). **0** paid calls.

### Batter

| Item | Verdict |
|---|---|
| PA/AB/H/HR/RBI/BB/SO, AVG/OBP/SLG/OPS, BABIP | AVAILABLE_DIFFERENT_ENDPOINT (gameLog). Grade **B** |
| ISO, K%/BB% | seasonAdvanced + derive. Grade **B** |
| wOBA / wRC+ | sabermetrics. Grade **B**. Not FanGraphs-certified; store provider fields as-is |
| OPS+ | UNKNOWN / not observed |
| HardHit / Barrel / EV / LA | NOT_AVAILABLE on observed paths. tracking empty |
| expected avg/slg/woba | expectedStatistics. Do not silently rename to xwOBA |
| batSide | AVAILABLE on `/people`, not joined to lineup |

### Batter splits

`statSplits` + sitCodes `vl,vr,h,a,d,n` returned six splits with **plateAppearances**. `d7` / `d30` / `l10` exist on situationCodes. Small-sample shrink coefficient stays **undefined**.

### Pitch type (batter)

Not in gameLog/statSplits. `pitchLog` / `playLog` listed on `/statTypes` (Grade **C** for payload). Pitcher `pitchArsenal` is **not** batter vs pitch.

### Starter

ERA/WHIP **STORED** and **PREDICTION_USED**. Extra gameLog rates sit in raw cache unused. FIP/xFIP available via sabermetrics. SIERA/xERA names **not** in observed saber keys.

### Starter condition

`recentStarts[]` stored, unused. Rest days sitCodes exist (`dr2`…`dr5`) — payload not built. Velocity trend needs start-level arsenal, not only season mix.

### Bullpen

Role + fatigue **STORED** (July samples). Season quality vs today availability **can** be separated with current schema. Reliever FIP/platoon unused.

### Lineup / availability

Confirmed 1–9 **STORED** (Stats API person ids — joinable to Stats API stats without a new vendor). Expected lineup is operator observation. SportsDataIO lineups wired, not SoT; **ID map required** if dual-sourced. IL listed stored (July).

### Environment

`dayNight`, elevation, turf in raw cache. Roof type stored. Forecast **NOT_COLLECTED**. Park factor **NOT_AVAILABLE**. SportsDataIO marketing lists weather forecasts; not wired; plan unknown.

---

## Football capability

Official source: API-Football getting-started guide (Grade **A**). Full `/documentation-v3` was Cloudflare-blocked this mission.

| Layer | Verdict |
|---|---|
| XI / formation / bench | AVAILABLE_CURRENT_PROVIDER (`getLineups`), not stored |
| Injuries | AVAILABLE_CURRENT_PROVIDER (`getInjuries`), not stored |
| Minutes / goals / assists / shots / key passes / tackles | AVAILABLE_DIFFERENT_ENDPOINT (`/players`, `/fixtures/players`), not wired |
| xG / npxG / xA | **NOT_AVAILABLE** in documented fields |
| Progressive carries / PPDA / field tilt | **NOT_AVAILABLE** |
| GK saves / penalties saved | Documented enough to ingest; save% needs shots-faced confirmation |
| PSxG | **NOT_AVAILABLE** |
| Team W/D/L, goals, clean sheets, form | `/teams/statistics` wired raw |
| Team xG / xGD | **NOT_AVAILABLE** |
| Rest / congestion | DERIVE from schedule + future minutes |
| Weather / travel / altitude | NOT_AVAILABLE |

Expected vs confirmed XI: API-Football does not document a durable “expected XI” feed. Missing pre-release lineups = `NOT_RELEASED`, not a second provider.

---

## Basketball / volleyball preview

Not this week's implementation. API-Sports family exists; repository stubs do not fetch them. Odds API still lacks volleyball (prior odds audit). Capability = **NEEDS_PROVIDER_DOC_REVIEW**.

---

## Probe

| API | Executed? | Why |
|---|---|---|
| MLB Stats API (public) | **Yes** — 13 attempts, keys only | No key, no quota contract, representative single players |
| API-Football / API-Baseball / SportsDataIO / Odds | **No** | CURRENT_PLAN_UNKNOWN; no bulk; no `/status` (would consume unknown quota) |

Secrets were not printed. Full payloads were not committed.

---

## What this audit does not do

- No Engine weight
- No snapshot rewrite
- No plan purchase
- No historical backfill
- Independent sample remains 0
