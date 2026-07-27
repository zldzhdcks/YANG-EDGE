# MLB Weather Dataset v1 — Pre-design

Read-only feasibility audit. **No builder, no Score, no Engine, no Viewer UI.**

**Machine-readable audit:** `data/audits/weather-dataset-v1-pre-design-audit.json`

**Registry:** `mlb-weather` remains `NOT_STARTED` (unchanged).

**Official conclusion:** `READY_FOR_MINIMAL_WEATHER_DATASET_DESIGN`

**Implementation decision:** `HOLD` — design approved for minimal v1 schema; builder blocked until operator selects canonical weather Provider and venue-cache policy.

---

## 1. Research purpose

Collect **pre-game weather forecast** variables as research-only inputs linked to frozen prediction snapshots. Weather is a **candidate explanatory variable**, not an Engine factor until hypothesis validation and legal clearance.

Goals:

- Join forecast to `gameId` / `gamePk` / venue at a documented **cutoffTime**
- Exclude leakage (no post-game observation in pre-game rows)
- Handle dome/retractable venues without treating indoor games as outdoor weather exposure
- Follow existing Starter/Bullpen/Lineup patterns: raw cache, derived dataset, `resultHash`, `engineAdmission: PROHIBITED`

---

## 2. Current game & venue data availability

### 2.1 Prediction snapshot (`data/predictions/mlb/{DATE}.json`)

| Field | Available | Notes |
|-------|:---------:|-------|
| `gameId` | ✓ | e.g. `mlb-179589` |
| `externalId` | ✓ | API-BASEBALL id |
| `dateKst` | ✓ | Slate date |
| `startTimeKst` | ✓ | `HH:mm` KST; timezone implied Asia/Seoul |
| `homeTeam` / `awayTeam` | ✓ | |
| `gamePk` | ✗ | Not in snapshot |
| `venueId` / `venueName` | ✗ | Not in snapshot |

Prediction hash and immutable fields are **unchanged** by this audit.

### 2.2 Join path (verified on 2026-07-27 / 2026-07-28)

```text
prediction.gameId
  → starter-dataset-v1 row.gamePk  (15/15 and 12/12)
  → Stats API schedule cache game.venue { id, name }
  → optional GET /api/v1/venues/{id}?hydrate=location,fieldInfo
```

| Date | Games | gamePk join | venue id+name |
|------|------:|:-----------:|:---------------:|
| 2026-07-27 | 15 | 15/15 | 15/15 |
| 2026-07-28 | 12 | 12/12 | 12/12 |

**Dependency:** Weather collection currently **requires** starter dataset (or equivalent gamePk map). Prediction-only dates without starter rows cannot resolve venue.

### 2.3 API-BASEBALL (grading source)

Current `parseGameRows` extracts scores/status only — **no venue, no coordinates, no weather**. Not sufficient as weather or venue source without extending parse scope (out of v1 audit scope).

### 2.4 Coordinates

- Schedule cache: `venue` = `{ id, name, link }` only — **no lat/lon**
- MLB Stats API venue endpoint **does** provide `location.defaultCoordinates` and `fieldInfo.roofType` when hydrated (live-verified: Globe Life Field, Tropicana Field, Fenway Park)
- **Static venue registry recommended** (document-only): immutable per-season snapshot of venueId → coordinates/roofType to avoid repeated network calls and to pin research reproducibility

### 2.5 Special / neutral venues

- **2026-07-28:** `Sutter Health Park` (venueId 2529) — temporary Athletics home; static registry must version temporary venues explicitly
- Neutral-site exhibitions (Field of Dreams, etc.): map via Stats API `venue.id`; flag `warnings` when not standard home park

### 2.6 Calendar alignment risk

KST slate date vs MLB `officialDate` can diverge (documented in `2026-07-28-provider-coverage-audit.json`). Weather `forecastValidAt` must use **UTC `gameDate` from Stats API** plus KST display fields, not KST date alone.

---

## 3. Indoor & dome handling

### 3.1 Available from MLB Stats API

| Field | Source | Example values |
|-------|--------|----------------|
| `roofType` | `fieldInfo.roofType` | `Open`, `Dome`, `Retractable` |
| `turfType` | `fieldInfo.turfType` | `Grass`, `Artificial Turf` |
| Coordinates | `location.defaultCoordinates` | lat/lon |

### 3.2 Not available pre-game

- **Roof open/closed status** at first pitch — not in schedule or venue endpoints reviewed
- **Recommendation:** default `roofStatus = ROOF_STATUS_UNKNOWN` for all retractable roofs; never infer from forecast

### 3.3 Policy

| roofType | weatherAvailability | Engine-relevant outdoor forecast |
|----------|--------------------|---------------------------------|
| `Open` | `AVAILABLE` (if provider returns data) | Yes (research only) |
| `Dome` | `NOT_APPLICABLE` | **No** — do not attach outdoor wind/precip as in-game weather |
| `Retractable` | `CONDITIONAL` | Only if authoritative pre-game roof status exists; else `UNKNOWN` → exclude from outdoor weather slice |

**Error to avoid:** Using external temperature/wind at a retractable or dome venue as if the game were played outdoors when roof status is unknown.

---

## 4. Candidate weather providers

No **final** Provider selected. Tiered research approach only.

### 4.1 NOAA NWS — `api.weather.gov`

| | |
|--|--|
| Official API | Yes (US Government) |
| Cost | Free |
| Commercial use | Public domain; attribution requested ("Data source: NOAA") |
| Historical forecast archive | No — current/short-range forecast only |
| Storage | Allowed with attribution; no endorsement implication |
| Rate limit | Undisclosed; User-Agent header required |
| Korea | N/A (US API) |
| Classification | `INTERNAL_RESEARCH_ONLY` · `PUBLIC_CANDIDATE` after product legal review |
| Coverage gap | **US only** — Rogers Centre (Toronto) not covered |

Fields: temperature, precip probability/amount, wind, humidity, pressure, condition, forecast valid/issued times (via grid forecast endpoints).

### 4.2 Open-Meteo — `api.open-meteo.com`

| | |
|--|--|
| Official API | Yes |
| Free tier | Non-commercial only; 10k calls/day |
| Commercial | Paid plans (`customer-api.open-meteo.com`) |
| Historical forecast | Professional+ plan (Historical Forecast API) |
| Data license | CC-BY-4.0 output |
| Classification | `INTERNAL_RESEARCH_ONLY` on free tier |
| Coverage | Global including Canada — supplement for non-US venues |

Fields: temperature, apparent_temperature (feelsLike), precip, wind, humidity, pressure, weather codes; `forecastIssuedAt` via model run metadata.

### 4.3 OpenWeatherMap One Call

| | |
|--|--|
| Official API | Yes |
| Commercial | Paid self-service |
| License | ODbL on standard plans — share-alike on derivatives |
| Classification | `NEEDS_LEGAL_REVIEW` for YANG EDGE product data model |
| Status | Do not connect until legal review of ODbL vs proprietary artifacts |

### 4.4 Blocked

| Source | Status |
|--------|--------|
| HTML page scraping | `BLOCKED` |
| Search result scraping | `BLOCKED` |
| Unclear-license aggregators | `BLOCKED` until terms verified |

### 4.5 Recommended provider (audit)

**None finalized.**

Proposed tier for v1 **design** only:

1. **Venue metadata:** MLB Stats API `/venues` (INTERNAL_RESEARCH_ONLY) — not a weather source
2. **US forecast:** NOAA NWS (primary candidate)
3. **Non-US / fallback research:** Open-Meteo free tier (INTERNAL_RESEARCH_ONLY)

Operator must pick one canonical weather source before builder implementation.

---

## 5. Available vs unavailable fields

### 5.1 Likely available (with Provider + venue join)

| Field | Pre-game forecast | Post-game observation |
|-------|:-----------------:|:--------------------:|
| temperature | ✓ | ✓ (separate phase) |
| feelsLike | ✓ (provider-dependent) | ✓ |
| precipitationProbability | ✓ | partial |
| precipitationAmount | ✓ | ✓ |
| windSpeed / windDirection | ✓ | ✓ |
| humidity | ✓ | ✓ |
| pressure | ✓ | ✓ |
| weatherCondition | ✓ | ✓ |
| forecastIssuedAt | ✓ (must record at collection) | N/A |
| forecastValidAt | ✓ | N/A |
| sourceTimestamp | ✓ | ✓ |
| latitude / longitude | ✓ (venue endpoint) | static |
| roofType | ✓ (venue endpoint) | static |
| venueType | derived from roofType | static |

### 5.2 Unavailable or uncertain

| Field | Status |
|-------|--------|
| `roofStatus` (open/closed) | **Unavailable** pre-game → `ROOF_STATUS_UNKNOWN` |
| `gamePk` in prediction | Join via starter only |
| Coordinates in schedule cache | **Unavailable** without venue hydrate |
| Historical forecast replay | Requires live snapshot at collection or paid archive |
| Betman-derived weather | **N/A** — Betman is not a weather Provider |

---

## 6. Pre-game / post-game boundary

| Phase | `collectionPhase` | Engine candidate | Backfill into pre-game |
|-------|-------------------|:----------------:|:----------------------:|
| Pre-game forecast snapshot | `PRE_GAME_FORECAST` | Yes (future, after validation) | — |
| Post-game observed weather | `POST_GAME_OBSERVED` | **No** | **FORBIDDEN** |

Rules:

1. `forecastIssuedAt > cutoffTime` → row rejected or `joinQuality = CUTOFF_VIOLATION`
2. Multiple forecasts → append-only / versioned; never overwrite earlier pre-game snapshot
3. Postponement → store `scheduledStartTimeKst` and `actualStartTimeKst`; new forecast window for actual start
4. Post-game observation used only for forecast accuracy audits (H-WX-004), not Engine input

---

## 7. Leakage & missing-data risks

### Leakage (major)

1. **Post-game weather in pre-game row** — CRITICAL; separate phases and immutable pre-game write
2. **Late forecast after prediction freeze** — HIGH; cutoff guard
3. **Dome game with outdoor forecast attached** — HIGH; `weatherAvailability` gate
4. **KST vs UTC game time for validAt** — MEDIUM; use Stats API `gameDate`

### Missing data (major)

1. No `gamePk`/venue in prediction — starter dependency
2. No coordinates in schedule cache — venue fetch or static registry
3. No roof status API — retractable games excluded from outdoor slice
4. No weather package/env in repo today (`BASEBALL_API_KEY` exists; no `WEATHER_*`)
5. Canadian venues need non-NWS path when on slate

---

## 8. Minimal schema draft (document only)

### 8.1 Row metadata (aligned with Starter/Bullpen/Lineup patterns)

```json
{
  "datasetId": "mlb-weather",
  "schemaVersion": "mlb-weather-dataset-v1",
  "builderVersion": "weather-dataset-builder-v1",
  "gameDate": "2026-07-27",
  "gameId": "mlb-179589",
  "gamePk": 823433,
  "venueId": 2681,
  "venueName": "Citizens Bank Park",
  "generatedAt": "ISO-8601",
  "cutoffTime": "ISO-8601",
  "collectionPhase": "PRE_GAME_FORECAST",
  "researchOnly": true,
  "legalStatus": "INTERNAL_RESEARCH_ONLY",
  "source": "noaa-nws-api",
  "sourceTimestamp": "ISO-8601",
  "inputHash": "sha256",
  "resultHash": "sha256",
  "warnings": [],
  "missingFields": [],
  "engineAdmission": "PROHIBITED"
}
```

### 8.2 Weather payload

```json
{
  "venueType": "OUTDOOR",
  "roofType": "Open",
  "roofStatus": "ROOF_STATUS_UNKNOWN",
  "latitude": 39.905,
  "longitude": -75.166,
  "forecastIssuedAt": "ISO-8601",
  "forecastValidAt": "ISO-8601",
  "temperature": { "value": 28, "unit": "C" },
  "precipitationProbability": { "value": 20, "unit": "percent" },
  "precipitationAmount": { "value": 0.1, "unit": "mm" },
  "windSpeed": { "value": 15, "unit": "km/h" },
  "windDirection": { "value": 180, "unit": "degrees" },
  "humidity": { "value": 65, "unit": "percent" },
  "pressure": { "value": 1013, "unit": "hPa" },
  "condition": "partly_cloudy",
  "weatherAvailability": "AVAILABLE",
  "joinQuality": "MATCHED"
}
```

Optional/unavailable fields must be omitted or explicitly listed in `missingFields` — never invented.

---

## 9. Candidate hypotheses (not registered)

| ID | Statement | Status |
|----|-----------|--------|
| H-WX-001 | Strong wind may relate to scoring distribution | Design candidate only |
| H-WX-002 | Precipitation/humidity may relate to pitching/defense volatility | Design candidate only |
| H-WX-003 | Weather explanatory power for outdoor games only | Design candidate only |
| H-WX-004 | Forecasts closer to game time may reduce observation error | Design candidate only |

Do **not** register in `HYPOTHESIS_REGISTRY.md` until builder + sample accumulation plan exists.

---

## 10. API volume & cache (100-game estimate)

Assumptions: one KST slate, ~30 unique venues, some doubleheaders.

| Scenario | Calls |
|----------|------:|
| Venue metadata (cold, per unique venueId) | ~30 |
| Weather per game (no dedupe) | ~100 |
| Weather per venue + start-hour bucket | ~35–45 |
| NWS two-step (grid point + forecast) | ~70–90 |

**Cache layout (matches existing MLB research pattern):**

| Layer | Path pattern |
|-------|--------------|
| Raw venue | `data/cache/research/mlb/raw/statsapi/api/v1/venues/{venueId}.json` |
| Raw weather | `data/cache/research/mlb/raw/{provider}/weather/{lat}_{lon}_{validHour}.json` |
| Derived dataset | `data/research/mlb/{date}-weather-dataset-v1.json` |

Dedupe key: `venueId + forecastValidAt` (hour bucket) or NWS `gridId + validTime`.

**No** automatic polling or scheduler in v1 design — manual builder invocation only.

Open-Meteo: one coordinate per request; no multi-venue batch in documented v1 API.

---

## 11. Legal status

- **Betman schedule ≠ weather Provider.** Betman confirms game scope; weather comes from independent lawful APIs.
- **Approved candidates:** NOAA NWS (US public data), Open-Meteo (terms documented), OpenWeather (needs legal review).
- **Blocked:** web scraping, unclear licenses.
- **MLB Stats API:** venue/roof/coordinates only — existing `INTERNAL_RESEARCH_ONLY` policy applies.
- **Public runtime:** all weather Providers remain `INTERNAL_RESEARCH_ONLY` or `NEEDS_LEGAL_REVIEW` until product legal clearance.

---

## 12. MLB-only vs Multi-Sport

| Area | Scope |
|------|-------|
| This design | **MLB only** |
| Framework change | **None** |
| `candidate common` fields | `gameId`, `gameDate`, `cutoffTime`, `forecastIssuedAt`, `forecastValidAt`, `temperature`, `precipitationProbability`, `windSpeed`, `collectionPhase`, `legalStatus` |
| Do not finalize | Cross-sport Weather schema until a second sport dataset exists |

---

## 13. Open questions before builder v1

1. Operator selection of canonical weather Provider (NWS-only vs NWS+Open-Meteo split)
2. Canada/Toronto policy when Rogers Centre on slate
3. Pre-game probe cadence: single freeze vs manual T-24/T-6 re-probes
4. Static venue registry format and temporary-venue versioning
5. Whether any authoritative retractable roof status feed will be added later

---

## 14. Implementation gate

| Gate | Status |
|------|--------|
| Minimal schema design | **GO** |
| Builder script | **HOLD** |
| Hypothesis registration | **BLOCKED** |
| Engine connection | **BLOCKED** |
| Registry status change | **BLOCKED** (stay NOT_STARTED) |

---

## Regression checklist (audit)

- [x] Code change: 0 (docs + audit JSON only)
- [x] `mlb-weather` NOT_STARTED unchanged
- [x] No hypothesis registered
- [x] No dataset artifact created
- [x] No post-game → pre-game backfill
- [x] No web crawl candidates
- [x] Prediction hash untouched
- [x] Starter/Bullpen/Lineup unaffected
- [x] Framework/Engine unaffected
