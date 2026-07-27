# MLB Travel / Rest Dataset v1 — Pre-design

Read-only feasibility audit. **No builder, no Fatigue/Travel/Rest Score, no Engine, no Viewer UI.**

**Machine-readable audit:** `data/audits/travel-rest-dataset-v1-pre-design-audit.json`

**Registry:** `mlb-travel` remains `NOT_STARTED` (unchanged).

**Venue reference (read-only):** `WEATHER_DATASET_V1_DESIGN.md` §2.2 venue join — not modified by this audit.

**Official conclusion:** `READY_FOR_MINIMAL_TRAVEL_REST_DATASET_DESIGN`

**Implementation decision:** `HOLD` — minimal schema design approved; builder blocked until schedule-window policy and PRE_GAME vs POST_GAME phase scope are signed off.

---

## 1. Research purpose

Collect **factual pre-game schedule context** per team per game:

- Rest: days/hours since previous game, games in rolling windows, consecutive home/away/day streaks, doubleheader status
- Travel: venue change, straight-line distance between previous and current venue, timezone offset change, transition type (home→away, away→away, away→home)

This is **not** fatigue scoring, route planning, or transport inference. Derived distance is a haversine approximation on official venue coordinates — not flight time or driving duration.

---

## 2. Previous-game mapping (A)

### 2.1 Join path

```text
prediction.gameId
  → starter-dataset-v1 row (gamePk, teamId, side, cutoffTime)
  → Stats API schedule cache (team timeline sorted by gameDate UTC)
  → immediate prior row for same teamId
```

### 2.2 Audited mapping rates

| Date | Games | Team slots | Previous game found |
|------|------:|-----------:|:-------------------:|
| 2026-07-27 | 15 | 30 | **30/30** |
| 2026-07-28 | 12 | 24 | **24/24** |

### 2.3 Available identifiers per row

| Field | Source | Pre-game |
|-------|--------|:--------:|
| `gameId` | prediction | ✓ |
| `gamePk` | starter | ✓ |
| `teamId` | schedule teams | ✓ |
| `side` | home/away | ✓ |
| `scheduledStart` | schedule `gameDate` (UTC) | ✓ |
| `startTimeKst` | prediction | ✓ (display) |
| `previousGamePk` | team timeline | ✓ |
| `previousOfficialDate` | schedule | ✓ |
| `previousScheduledStart` | schedule | ✓ |
| `previousVenueId` | schedule | ✓ |

### 2.4 Missing previous game

When no prior game exists in cache window (season opener, cache boundary, join failure):

- **Do not infer**
- `joinQuality = MISSING_PREVIOUS`
- Rest/travel numeric fields → `null` + listed in `missingFields`

### 2.5 Cutoff guard

Information updated **after** row `cutoffTime` must not alter a frozen PRE_GAME row. Schedule snapshots should be hashed at collection (`inputHash`).

---

## 3. Rest field availability (B)

| Field | Pre-game | Post-game only | Unavailable / gated |
|-------|:--------:|:--------------:|-------------------|
| `daysSincePreviousGame` | ✓ (officialDate delta) | | |
| `hoursSincePreviousScheduledStart` | ✓ | | |
| `hoursSincePreviousFinal` | | ✓ | ✗ if previous not Final before cutoff |
| `gamesInLast2Days` | ✓ | | cutoff + date-window policy |
| `gamesInLast3Days` | ✓ | | |
| `gamesInLast7Days` | ✓ | | |
| `consecutiveGameDays` | ✓ | | |
| `consecutiveHomeGames` | ✓ | | |
| `consecutiveAwayGames` | ✓ | | |
| `doubleheaderStatus` | ✓ | | from `doubleHeader` + `gameNumber` |
| `previousGameInnings` | | ✓ | linescore when previous Final |
| `previousGameExtraInnings` | | ✓ | innings.length > scheduledInnings |

### Scheduled vs actual end

- **Pre-game rest** should prefer **scheduled-start** deltas (`hoursSincePreviousScheduledStart`) — stable at prediction freeze.
- **Actual end** (`hoursSincePreviousFinal`) requires a reliable end timestamp. Schedule rows reviewed **do not** expose `gameEndTime`. Optional sources:
  - `GET /game/{gamePk}/linescore` — innings count (POST_GAME)
  - `playByPlay` last `endTime` — heavy; accuracy audit only
- If previous game not **Final** before target `cutoffTime`, do not populate actual-end fields.

---

## 4. Travel field availability (C)

| Field | Source | Notes |
|-------|--------|-------|
| `previousVenueId` / `currentVenueId` | schedule | Pre-game |
| `previousVenueName` / `currentVenueName` | schedule | Pre-game |
| `venueChanged` | derived | `previousVenueId !== currentVenueId` |
| `latitude` / `longitude` | `/venues/{id}?hydrate=location` | Not in schedule cache |
| `straightLineDistanceKm` | haversine(coords) | **Approximate** — not travel time |
| `previousTimezone` / `currentTimezone` | `/venues/{id}?hydrate=timezone` | e.g. `America/New_York`, `offsetAtGameTime` |
| `timezoneOffsetChangeHours` | derived | Pre-game |
| `transitionType` | derived | `HOME_TO_AWAY`, `AWAY_TO_AWAY`, `AWAY_TO_HOME`, `HOME_TO_HOME` |
| `consecutiveRoadGames` | derived team timeline | Pre-game |

### Not collected (forbidden)

- Actual route, flight, bus, hotel
- Travel duration estimates
- Map/directions scraping
- Transport mode inference

### Distance principle

```text
straightLineDistanceKm = haversine(previousVenue.coords, currentVenue.coords)
```

Record as **observation label** in schema — not “miles traveled by team.”

---

## 5. Special games (D)

| Case | Detection | Policy |
|------|-----------|--------|
| **Doubleheader** | `doubleHeader=Y`, `gameNumber` 1/2 | Same-day previous game allowed; `doubleheaderStatus=GAME1\|GAME2` |
| **Postponed** | status Postponed, not Final | Do not chain as previous unless Final; warn `PREVIOUS_POSTPONED` |
| **Suspended** | Suspended / resume fields | No partial innings in PRE_GAME; POST_GAME after Final |
| **Rescheduled** | `rescheduledFrom`, `rescheduledFromDate` | Store original + actual schedule; versioned snapshot |
| **Neutral / temporary venue** | e.g. Sutter Health Park | `warnings: NEUTRAL_OR_TEMPORARY_VENUE` |
| **Overseas / special** | non-USA venue, special gameType | `warnings: INTERNATIONAL_VENUE` |
| **Same-day previous** | prev.officialDate = cur.officialDate | Rest hours may be < 24 |
| **Previous missing** | no timeline row | `joinQuality=MISSING_PREVIOUS`; no imputation |

Audit sample: **0 doubleheaders** on 2026-07-27/28; **6 postponed/suspended** rows exist elsewhere in season cache — policies documented but need scale validation.

---

## 6. Data phases & leakage (E)

| Phase | `collectionPhase` | Engine candidate | Use |
|-------|-------------------|:----------------:|-----|
| Pre-game schedule context | `PRE_GAME_SCHEDULE_CONTEXT` | Future (after validation) | Scheduled rest/travel facts at cutoff |
| Post-game actual context | `POST_GAME_ACTUAL_CONTEXT` | **No** | Innings, actual-end rest — forecast accuracy / audit |

### Rules

1. Engine may only use facts knowable **at or before** `cutoffTime`
2. **No backfill** of POST_GAME fields into PRE_GAME rows
3. **No** `predictionHit`, grades, recommendation, or result fields as features
4. Schedule changes → append-only / versioned collection; do not rewrite historical snapshots from late API fetches
5. Postponement → distinguish `scheduledStartTimeKst` vs `actualStartTimeKst` when rescheduled

---

## 7. Minimal schema draft (F)

**Granularity:** one row per **team** per **game** (home + away rows).

### Metadata

`datasetId`, `schemaVersion`, `builderVersion`, `gameDate`, `gameId`, `gamePk`, `teamId`, `teamName`, `side`, `generatedAt`, `cutoffTime`, `collectionPhase`, `researchOnly`, `legalStatus`, `source`, `sourceTimestamp`, `inputHash`, `resultHash`, `cacheUsage`, `warnings`, `missingFields`, `joinQuality`, `engineAdmission`

### Rest payload (candidates)

`previousGameId`, `previousGamePk`, `previousGameDate`, `previousScheduledStart`, `previousActualEnd` (optional POST_GAME), `daysSincePreviousGame`, `hoursSincePreviousScheduledStart`, `hoursSincePreviousFinal`, `gamesInLast2Days`, `gamesInLast3Days`, `gamesInLast7Days`, `consecutiveGameDays`, `consecutiveHomeGames`, `consecutiveAwayGames`, `doubleheaderStatus`, `previousGameInnings`, `previousGameExtraInnings`

### Travel payload (candidates)

`previousVenueId`, `currentVenueId`, `previousVenueName`, `currentVenueName`, `venueChanged`, `previousLatitude`, `previousLongitude`, `currentLatitude`, `currentLongitude`, `straightLineDistanceKm`, `previousTimezone`, `currentTimezone`, `timezoneOffsetChangeHours`, `transitionType`

Unconfirmed fields → optional or `missingFields` — never invented.

---

## 8. Candidate hypotheses (G) — not registered

| ID | Statement |
|----|-----------|
| H-TR-001 | Short rest interval may relate to game volatility |
| H-TR-002 | Long travel before first game may relate to game flow |
| H-TR-003 | Consecutive road games may explain more than single distance |
| H-TR-004 | Timezone change may have effect independent of distance |
| H-TR-005 | Doubleheader or extra-inning prior game fatigue patterns |

No registry update. No Engine admission.

---

## 9. API volume & cache (H)

**100-game estimate (single slate, ~30 teams):**

| Operation | Cold calls | Warm rerun |
|-----------|----------:|----------:|
| Schedule date-range fetch | 1–7 (reused per day) | 0 |
| Venue coords + timezone | ~25–30 unique | 0 |
| Team timeline derived index | 0 (from cache) | 0 |
| Linescore (POST_GAME only) | up to ~200 | 0 |

**Cache pattern (aligned with Starter/Bullpen):**

| Layer | Path |
|-------|------|
| Raw schedule | existing `schedule_sportId_1_startDate_*_endDate_*` |
| Raw venue | `venues/{venueId}.json` |
| Raw linescore | `game/{gamePk}/linescore.json` |
| Derived timeline | `derived/travel/{teamId}-timeline-{season}.json` (candidate) |
| Artifact | `{date}-travel-rest-dataset-v1.json` |

**No** polling or scheduler.

---

## 10. Legal status (I)

- **Allowed:** MLB Stats API schedule + venue endpoints (`INTERNAL_RESEARCH_ONLY`)
- **Allowed:** Haversine on official venue coordinates (derived, labeled approximate)
- **Blocked:** airline/map/team-site crawling; route duration inference
- **Public display:** computed distance + schedule facts require separate product legal review
- **Betman:** schedule scope only — independent from travel data Provider

---

## 11. Multi-Sport boundary (J)

- **MLB-only** design
- `candidate common`: `gameId`, `gameDate`, `teamId`, `side`, `cutoffTime`, `daysSincePreviousGame`, `hoursSincePreviousScheduledStart`, `venueChanged`, `straightLineDistanceKm`, `collectionPhase`, `joinQuality`
- Do **not** force MLB doubleheader/innings concepts on other sports
- Do **not** finalize cross-sport Travel schema until second sport exists

---

## 12. Open questions

1. Schedule rolling window size for previous-game search
2. Ship POST_GAME_ACTUAL_CONTEXT in v1 or defer to v1.1
3. Shared static venue registry with Weather dataset (document-only coordination)
4. KST vs `officialDate` for `gamesInLastNDays` on boundary slates

---

## 13. Implementation gate

| Gate | Status |
|------|--------|
| Minimal schema design | **GO** |
| Builder | **HOLD** |
| Hypothesis registration | **BLOCKED** |
| Engine | **BLOCKED** |
| Registry status | **BLOCKED** (stay NOT_STARTED) |

---

## Regression

- [x] Weather files unchanged
- [x] Code change 0
- [x] `mlb-travel` NOT_STARTED
- [x] H-TR not registered
- [x] No artifacts, no route inference, no backfill
- [x] Prediction hash untouched
