# Multi-Sport Historical Odds Coverage Audit v1

읽기 전용 사전 감사. Historical Odds 대량 수집·Dataset Builder·Prediction/Engine 연결 **금지**.

**Official conclusion:** `MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDITED`

**Charter:** [docs/DEVELOPMENT_COMPLIANCE_CHARTER.md](./docs/DEVELOPMENT_COMPLIANCE_CHARTER.md)  
**Boundary:** [MULTI_SPORT_RESEARCH_BOUNDARY.md](./MULTI_SPORT_RESEARCH_BOUNDARY.md)  
**Sources:** [DATA_SOURCES.md](./DATA_SOURCES.md)  
**Design companion:** [MARKET_INTELLIGENCE_RESEARCH_DESIGN.md](./MARKET_INTELLIGENCE_RESEARCH_DESIGN.md)

**Audit artifacts:**

- `data/audits/multi-sport-historical-odds-coverage-audit-v1.json`
- `data/audits/historical-odds-cost-storage-estimate-v1.json`

---

## 0. Scope

| In scope | Out of scope |
|----------|--------------|
| BASEBALL · SOCCER · BASKETBALL · VOLLEYBALL | TENNIS and all other sports |
| Overseas Historical Odds feasibility | Betman auto-collection / HTML crawl |
| Documented provider coverage | Bulk Historical API harvest |
| Cost / license / market-rule gates | Engine weight / Prediction wiring |

League scope follows Betman-scheduled fixtures as product candidates, but this audit **does not** collect Betman data.

---

## 1. Current project odds code audit

### Runtime / research usage today

| Area | Finding |
|------|---------|
| Primary odds provider | The Odds API (`src/lib/odds/the-odds-api-provider.ts`) |
| Env | `ODDS_API_KEY`, `ODDS_API_BASE_URL` (default `https://api.the-odds-api.com/v4`) |
| Live markets used | Primarily `h2h`; regions often `eu` |
| Sport key resolution | Dynamic via `/sports` + title/description hints (`sport-key-resolver.ts`) — no hard-coded key inventing |
| Baseball keys in practice | `baseball_mlb`, `baseball_kbo`, `baseball_npb` (when active) |
| Soccer keys | Resolved from football league display names (EPL, La Liga, …) |
| Basketball / Volleyball | No dedicated historical research pipeline; basketball not in sport-key baseball/football resolver |
| Historical endpoint `/v4/historical/...` | **Not used** in production or research builders |
| MLB Odds History Dataset v1 | Pre-game opening/latest from **prediction snapshot** + optional live odds timeline cache — **not** Historical Odds API |
| KBO odds comparison v1 | Current `/odds` for `baseball_kbo` `h2h` only; `MARKET_RULE_UNVERIFIED` |
| Memory cache | 5-minute in-process (`src/lib/odds/cache.ts`) |
| Disk raw cache | MLB research: `data/cache/research/mlb/raw/the-odds-api/`; KBO: `data/cache/research/kbo/raw/` (The Odds API helper) |
| Closing / post-game odds | Explicitly **not collected** in MLB Odds History legal meta |

### Snapshot timing currently stored

| Label in project | Source | Maps to audit timing |
|-------------------|--------|----------------------|
| `openingOdds` | Prediction freeze / research snapshot | OPENING-like (product-defined, not provider Opening) |
| `latestOdds` | Later pre-game capture when available | LATEST_PRE_GAME candidate |
| Closing | Not collected | — |
| Historical API snapshots | Not collected | — |

---

## 2. Provider candidates (not selected for code wiring)

| Provider | historicalOddsSupported | supportedSports (relevant) | legalStatus | Notes |
|----------|-------------------------|----------------------------|-------------|-------|
| **The Odds API** | Yes (paid plans) | Baseball, Soccer, Basketball leagues listed; **Volleyball not listed** | `PER_USE_LEGAL_REVIEW` / `NEEDS_LEGAL_REVIEW` | Documented earliest timestamps per sport key; featured markets from 2020-06-06 service-wide |
| **API-SPORTS family** (API-Baseball / Football / Basketball / Volleyball) | Schedule/results strong; odds historical **NOT_VERIFIED** in this audit | All four sports candidates via separate products | `NEEDS_LEGAL_REVIEW` | Used today for KBO/MLB schedule research; do not assume odds history |
| **SportsDataIO** | Plan-dependent; Scrambled **BLOCKED** | MLB-centric historically in this repo | `NEEDS_LEGAL_REVIEW` / Scrambled `BLOCKED` | Not probed for multi-sport historical odds |
| Official league / licensed feeds | UNKNOWN per league | League-specific | `COMMERCIAL_LICENSE_REQUIRED` likely | Case-by-case |

**Provider is not locked in code by this audit.**

---

## 3. The Odds API official documentation (source of truth)

Sources:

- https://the-odds-api.com/historical-odds-data/
- https://the-odds-api.com/liveapi/guides/v4/ (GET historical odds)
- https://the-odds-api.com/sports-odds-data/sports-apis.html

### Documented service-wide facts

| Topic | Documented value |
|-------|------------------|
| Featured markets historical start | **2020-06-06** |
| Featured snapshot interval | **10 minutes** from start; **5 minutes** from **September 2022** |
| Additional markets (props, periods, …) | From **2023-05-03**, 5-minute snapshots |
| Plan requirement | **Paid usage plans only** |
| Featured historical endpoint | `GET /v4/historical/sports/{sport}/odds?date=...` |
| Event historical endpoint | `GET /v4/historical/sports/{sport}/events/{eventId}/odds?date=...` |
| Closest snapshot rule | Returns closest snapshot **≤** requested `date` |
| Featured historical quota cost | **10 credits × regions × markets** |
| Event historical quota cost | **10 credits × regions × markets × event** (docs) |
| Empty snapshot cost | Snapshots with no events do not count (per public guide notes) |
| Official Closing field | **Not documented** as a named Closing product — treat as snapshot timeline only |

### Critical distinction

**Service-wide historical availability (2020-06-06)** ≠ **each sport key’s earliest data**.

Official per-key earliest timestamps (excerpt, from Odds API “Earliest Historical Timestamps”):

| Sport | League | Sport key | Earliest documented |
|-------|--------|-----------|---------------------|
| Baseball | MLB | `baseball_mlb` | `2020-06-30T20:55:00Z` |
| Baseball | KBO | `baseball_kbo` | `2024-03-28T21:10:40Z` |
| Baseball | NPB | `baseball_npb` | `2024-03-28T21:10:40Z` |
| Soccer | EPL | `soccer_epl` | `2020-06-06T10:05:00Z` |
| Soccer | La Liga | `soccer_spain_la_liga` | `2020-06-06T10:05:00Z` |
| Soccer | Bundesliga | `soccer_germany_bundesliga` | `2020-06-06T10:05:00Z` |
| Soccer | Serie A | `soccer_italy_serie_a` | `2020-06-06T10:05:00Z` |
| Soccer | Ligue 1 | `soccer_france_ligue_one` | `2020-07-16T00:55:00Z` |
| Soccer | K League 1 | `soccer_korea_kleague1` | `2020-06-06T10:05:00Z` |
| Soccer | Norway Eliteserien | `soccer_norway_eliteserien` | `2020-06-06T10:05:00Z` |
| Soccer | UCL | `soccer_uefa_champs_league` | `2020-07-10T16:15:00Z` |
| Basketball | NBA | `basketball_nba` | `2020-06-27T03:55:00Z` |
| Basketball | EuroLeague | `basketball_euroleague` | `2020-09-24T00:25:00Z` |
| Basketball | KBL / WKBL | — | **NOT_SUPPORTED** on sports list |
| Volleyball | any | — | **NOT_SUPPORTED** on sports list (no volleyball group) |

Do **not** claim KBO history exists from 2020. Documented KBO start is **2024-03-28**.

---

## 4. Sport-by-sport coverage

### A. BASEBALL

| League | providerSportKey | coverageStatus | markets (featured docs) | Notes |
|--------|------------------|----------------|-------------------------|-------|
| MLB | `baseball_mlb` | `DOCUMENTED_AVAILABLE_NOT_PROBED` | h2h, spreads, totals | Longest baseball history among YANG EDGE candidates |
| KBO | `baseball_kbo` | `DOCUMENTED_AVAILABLE_NOT_PROBED` | h2h (+ spreads/totals if returned) | Earliest 2024-03-28; draw market uncommon for baseball h2h |
| NPB | `baseball_npb` | `DOCUMENTED_AVAILABLE_NOT_PROBED` | same | Earliest 2024-03-28 |
| Other Betman baseball | UNKNOWN | `NOT_VERIFIED` / `NOT_SUPPORTED` until key exists | — | Only if Odds API lists an active key |

**Settlement / rule notes (UNVERIFIED until market-rule audit):**

- Extra innings inclusion for moneyline/spreads/totals: bookmaker-dependent → `marketRuleStatus=UNVERIFIED`
- Postponed / cancelled / doubleheader: schedule identity must be joined separately; odds snapshots alone insufficient

### B. SOCCER

| League | providerSportKey | coverageStatus | Earliest documented |
|--------|------------------|----------------|---------------------|
| EPL | `soccer_epl` | `DOCUMENTED_AVAILABLE_NOT_PROBED` | 2020-06-06 |
| La Liga | `soccer_spain_la_liga` | `DOCUMENTED_AVAILABLE_NOT_PROBED` | 2020-06-06 |
| Bundesliga | `soccer_germany_bundesliga` | `DOCUMENTED_AVAILABLE_NOT_PROBED` | 2020-06-06 |
| Serie A | `soccer_italy_serie_a` | `DOCUMENTED_AVAILABLE_NOT_PROBED` | 2020-06-06 |
| Ligue 1 | `soccer_france_ligue_one` | `DOCUMENTED_AVAILABLE_NOT_PROBED` | 2020-07-16 |
| K League 1 | `soccer_korea_kleague1` | `DOCUMENTED_AVAILABLE_NOT_PROBED` | 2020-06-06 |
| Norway Eliteserien | `soccer_norway_eliteserien` | `DOCUMENTED_AVAILABLE_NOT_PROBED` | 2020-06-06 |
| UCL / UEL | `soccer_uefa_champs_league` / `soccer_uefa_europa_league` | `DOCUMENTED_AVAILABLE_NOT_PROBED` | 2020-07-10 / 2020-06-22 |

**Market notes:**

| Market | Status |
|--------|--------|
| h2h 3-way | Featured; draw outcome expected for soccer |
| spreads / asian handicap | Featured spreads key exists; Asian handicap semantics **UNVERIFIED** |
| totals | Featured |
| draw no bet / double chance / btts / 1H | Often additional markets → from 2023-05-03 if available; **NOT_VERIFIED** per league |

**Period separation required:** regulation time vs extra time vs penalties. Do not mix settlement rules across sports.

### C. BASKETBALL

| League | providerSportKey | coverageStatus | Earliest documented |
|--------|------------------|----------------|---------------------|
| NBA | `basketball_nba` | `DOCUMENTED_AVAILABLE_NOT_PROBED` | 2020-06-27 |
| EuroLeague | `basketball_euroleague` | `DOCUMENTED_AVAILABLE_NOT_PROBED` | 2020-09-24 |
| KBL | — | `NOT_SUPPORTED` (not on Odds API sports list) | — |
| WKBL | — | `NOT_SUPPORTED` | — |
| Other Betman basketball | UNKNOWN | `NOT_VERIFIED` | — |

OT inclusion for h2h/spreads/totals: **UNVERIFIED**.

### D. VOLLEYBALL

| League | coverageStatus |
|--------|----------------|
| V-League M/W | `NOT_SUPPORTED` on The Odds API sports list |
| International | `NOT_SUPPORTED` / `NOT_VERIFIED` elsewhere |
| Markets (match winner, set handicap, totals) | `UNKNOWN` until another licensed provider is audited |

**Implication:** Four-sport Historical Odds parity **cannot** be satisfied by The Odds API alone.

---

## 5. Probe design (not executed in this mission)

Allowed later: 1–2 dates per sport key, read-only, paid-plan gated.

| Candidate date class | Purpose |
|----------------------|---------|
| Recent in-season day | Current coverage sanity |
| ~1 year earlier | Continuity |
| ~3 years / ~5 years | Depth (only if earliest timestamp allows) |

**This audit did not call Historical endpoints** (credit cost + paid-plan gate + no bulk policy).

Probe statuses remain `DOCUMENTED_AVAILABLE_NOT_PROBED` or `PLAN_BLOCKED` until a gated probe mission runs.

---

## 6. Historical timing model

| Timing label | Meaning | Use in pre-game research |
|--------------|---------|--------------------------|
| OPENING | Earliest useful pre-game snapshot (research-defined) | Allowed if `snapshotTime < scheduledStartTime` |
| INTERMEDIATE | Mid-timeline snapshots | Allowed under cutoff |
| LATEST_PRE_GAME | Last snapshot before start | Allowed |
| CLOSING_CANDIDATE | Last pre-start snapshot **candidate** only | Do **not** rename to official CLOSING |
| POST_START | After commence | **Forbidden** for pre-game Prediction research |
| POST_GAME | After final | Forbidden for pre-game; separate postgame analytics only |

Provider does not document an official “Closing Odds” product in the Historical guide. YANG EDGE must use `LATEST_PRE_GAME` / `CLOSING_CANDIDATE`.

### Cutoff rule

```text
snapshotTime < scheduledStartTimeAtSnapshot
```

Schedule changes: keep **observed schedule at snapshot** separate from **final schedule**.

---

## 7. Market-rule status summary

| Sport | Featured h2h | Spreads | Totals | Cross-sport compare |
|-------|--------------|---------|--------|---------------------|
| Baseball | `UNVERIFIED` | `UNVERIFIED` | `UNVERIFIED` | Forbidden until verified |
| Soccer | `UNVERIFIED` (3-way draw) | `UNVERIFIED` | `UNVERIFIED` | Forbidden |
| Basketball | `UNVERIFIED` | `UNVERIFIED` | `UNVERIFIED` | Forbidden |
| Volleyball | `UNKNOWN` | `UNKNOWN` | `UNKNOWN` | Forbidden |

Unverified markets must not enter domestic↔overseas comparison or backtest scoring.

---

## 8. Storage schema candidates (design only — not implemented)

See [MARKET_INTELLIGENCE_RESEARCH_DESIGN.md](./MARKET_INTELLIGENCE_RESEARCH_DESIGN.md) for row + timeline candidates.

---

## 9. Korean proto Historical boundary

| Action | Policy |
|--------|--------|
| Bulk historical restore | **Forbidden** without licensed source |
| Betman crawl / HTML / login automation | **Forbidden** |
| Operator manual input | Allowed |
| OCR draft + operator review | Allowed |
| Forward archive after storage start | Allowed (own archive) |
| Past proto odds | Only after licensed source review |

---

## 10. Common field applicability (no Framework change)

| Field | Classification |
|-------|----------------|
| gameId, sport, league, provider | `COMMON_CANDIDATE` |
| bookmaker, marketType, selectionCode, odds, snapshotTime, startTime | `COMMON_CANDIDATE` |
| period, line | `MARKET_SPECIFIC` / `SPORT_SPECIFIC` |
| marketRuleStatus, legalStatus | `COMMON_CONFIRMED` (policy) |
| cacheUsage, inputHash, resultHash, warnings, missing | `COMMON_CONFIRMED` (research governance) |

---

## 11. Cost & storage

See `data/audits/historical-odds-cost-storage-estimate-v1.json`.

Summary (The Odds API featured historical, credits = documented formula only; USD price **UNKNOWN** without current plan invoice):

| Scenario | Rough credit shape |
|----------|--------------------|
| A. Opening + Latest only (1 event path via sport snapshot ×2) | `2 × 10 × regions × markets` per sport-day pull (whole-slate endpoint), or event endpoint if used |
| B. 30-min timeline (~pre-game window) | HIGH credits if paging every interval |
| C. 5-min timeline | HIGH / very HIGH |
| D. One league one season | HIGH |
| E. All four sports | **Not feasible** on Odds API alone (volleyball gap) + HIGH cost |

Storage class for multi-sport historical archive: **HIGH** if full timeline + multi-bookmaker.

---

## 12. Legal / license gates (Charter-linked)

| Gate | Status |
|------|--------|
| LEGAL_GATE | `NOT_PASSED` |
| LICENSE_GATE | `NOT_PASSED` (`PER_USE_LEGAL_REVIEW_REQUIRED`) |
| CACHE_GATE | `NOT_PASSED` (archive duration / redistribution unconfirmed) |
| REDISTRIBUTION_GATE | `NOT_PASSED` |
| COST_GATE | `NOT_PASSED` (paid Historical; budget not approved) |
| DATA_QUALITY_GATE | `NOT_PASSED` (not probed) |
| MARKET_RULE_GATE | `NOT_PASSED` |

**Recommendation:** Do **not** implement Historical Odds Builder until all gates pass or are explicitly waived for a narrow internal research probe.

---

## 13. Provider conclusion

```text
MULTI_PROVIDER_REQUIRED
```

- The Odds API is the **primary documented overseas historical candidate** for MLB / KBO / NPB / major soccer / NBA / EuroLeague.
- Volleyball (and KBL/WKBL) lack Odds API sport keys → another licensed provider is required for four-sport parity.
- Sub-label: `THE_ODDS_API_PRIMARY_CANDIDATE` for baseball+soccer+NBA research slice only.

---

## 14. First implementation recommendation

```text
A. MLB h2h Historical Coverage Probe
```

Why:

1. Longest documented baseball earliest timestamp (`2020-06-30`).
2. Existing MLB Odds History research path (non-Historical) for join patterns.
3. Single market (`h2h`) + single region keeps credit cost minimal.
4. Avoids multi-sport bulk collection.

**Not recommended now:** multi-sport season harvest, KBO-first depth claims pre-2024, Closing-as-fact labeling.

Probe input contract / Timeline schema: [HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md](./HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md) (`DESIGN_ONLY`).

Minimal probe result (2026-07-28): **`PLAN_BLOCKED`** — free Odds API plan rejects Historical (`HISTORICAL_UNAVAILABLE_ON_FREE_USAGE_PLAN`). Details: [MLB_H2H_HISTORICAL_ODDS_PROBE_V1.md](./MLB_H2H_HISTORICAL_ODDS_PROBE_V1.md).

Paid provider business decision: **HOLD** — [HISTORICAL_ODDS_PAID_PROVIDER_BUSINESS_DECISION_AUDIT_V1.md](./HISTORICAL_ODDS_PAID_PROVIDER_BUSINESS_DECISION_AUDIT_V1.md).

---

## 15. Regression / impact

| Area | Impact |
|------|--------|
| Code / Builder / API routes | 0 |
| Framework / Registry | 0 |
| Prediction / Engine / Viewer | 0 |
| MLB / KBO datasets | 0 |

---

## 16. Remaining issues

1. Paid-plan Historical probe not run → no `VERIFIED_AVAILABLE` rows yet.
2. Volleyball + KBL Historical provider still open.
3. Market settlement rules unverified across sports.
4. Commercial / public display / redistribution rights uncleared.
5. Korean proto historical restore remains blocked without license.
