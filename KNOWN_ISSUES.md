# Known Issues

정책·출시 기준: **[Development & Compliance Charter](./docs/DEVELOPMENT_COMPLIANCE_CHARTER.md)**.  
Historical Odds 사전 감사: **[MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDIT_V1.md](./MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDIT_V1.md)**.

## Bullpen Role Classifier v1

| Issue | Status in v1.1 |
|-------|----------------|
| MIDDLE underclassification (score capped, absorbed by HL/LONG) | Addressed: independent MIDDLE score |
| LONG overclassification via avgOuts alone | Addressed: multi-factor LONG + starter exclusion |
| Traditional starter slot0 included in avgOuts | Addressed: exclude outs≥9 slot0 |
| Opener removed if all slot0 excluded | Addressed: short slot0 kept as opener |
| Confirmed LONG with sample &lt; 3 (47 in audit) | Addressed: 0–2 → INSUFFICIENT_SAMPLE/UNKNOWN |
| Single-label priority bias / multi-role loss | Addressed: roleScores + secondaryRoles |
| No disk cache; 733 Stats API calls per run | Addressed: raw + derived research cache |
| Engine connection risk | Still PROHIBITED |

## Open

- Availability (IL/option) still unknown → `availabilityUnknown=true`
- Official closer/setup roster field still absent → inferred only
- 14-game sample remains too small for predictive claims
- MIDDLE/LONG thresholds are design constants, not performance-tuned

## Starter Dataset v1

| Issue | Status |
|-------|--------|
| Confirmed starter not available pre-game (Preview) | By design: `PROBABLE_ONLY` / `MISSING` only |
| `qualityStarts` absent from gameLog path | Not implemented (forbidden as invented feature) |
| Prediction snapshot lacks probable identity | Separate research artifact; snapshot untouched |
| `baselineGameId` / schedule join can be UNLINKED | `joinQuality` recorded; stats omitted when cutoff missing |
| Late scratch after freeze | `postGameReview.STARTER_CHANGED` annotation only; pre-game row immutable |
| MLB Stats API commercial use unconfirmed | `INTERNAL_RESEARCH_ONLY`; Engine PROHIBITED |
| Sample &lt; 100 games | COLLECTING — do not claim PROMISING |
| Accumulation pipeline | Date-arg orchestrator + immutable pre-game + Final-gated postgame |
| Non-Final postgame | `AWAITING_RESULT` only (no MATCHED/CHANGED) |
| 07-27 embedded postGameReview in pre-game rows | Frozen legacy; new dates keep postGameReview null in pre-game |

## Lineup Dataset v1

| Issue | Status |
|-------|--------|
| Pre-game lineup collection cadence undefined | Open — near-cutoff re-fetch policy not fixed |
| Official lineup announcement timestamp absent from Stats API | Open — only `fetchedAt` / research `cutoffTime` recordable |
| Historical 2026-07-27 pre-game snapshots | `NOT_COLLECTED` by design; no backfill from Final boxscore |
| battingSide not in boxscore person | Deferred — people API mass-fetch forbidden in v1 |
| `team.battingOrder` ≠ starting lineup | Documented; builder uses `players[].battingOrder` `*00` only |
| MLB Stats API commercial use unconfirmed | `INTERNAL_RESEARCH_ONLY`; Engine PROHIBITED |
| Sample &lt; 100 games | COLLECTING — do not claim PROMISING |
| Lineup Score / absence score | Not implemented (forbidden in v1) |
| Pre-game lineup availability probe | Manual `research:lineup-probe` only; no scheduler; append-only observations |
| Official lineup announcement timestamp | Absent from Stats API — only `fetchedAt` / `probedAt` / research `cutoffTime` recordable |
| Probe uses schedule `hydrate=lineups` only | Post-game boxscore never used as pre-game; started/Final games excluded from lineup probe |

## Pre-game Lineup Availability Probe v1

## Weather Dataset v1 (pre-design audit)

| Issue | Status |
|-------|--------|
| Prediction snapshot lacks `gamePk` / `venueId` | Open — venue join requires starter dataset + Stats API schedule |
| Schedule cache venue has no coordinates | Open — requires `/venues?hydrate=location,fieldInfo` or static registry |
| Retractable roof open/closed pre-game | Unavailable — use `ROOF_STATUS_UNKNOWN`; do not infer from forecast |
| No weather Provider wired (`WEATHER_*` env absent) | Open — operator must select NWS / Open-Meteo / paid tier before builder |
| Canadian MLB venues | Open — NWS US-only; non-US path needed when Toronto on slate |
| Dome outdoor forecast misuse risk | Documented — `weatherAvailability=NOT_APPLICABLE` for fixed dome |

## Travel / Rest Dataset v1 (pre-design audit)

| Issue | Status |
|-------|--------|
| Prediction snapshot lacks `gamePk` / venue | Open — same starter + schedule join as other MLB datasets |
| No schedule `gameEndTime` | Open — pre-game rest uses scheduled-start deltas; actual-end is POST_GAME or unavailable |
| `previousGameInnings` requires linescore | Open — POST_GAME_ACTUAL_CONTEXT only when previous game Final before cutoff |
| Timezone not in schedule cache | Open — requires `/venues?hydrate=timezone` |
| Coordinates not in schedule cache | Open — requires `/venues?hydrate=location` or static registry |
| Season-first / cache boundary | Open — `joinQuality=MISSING_PREVIOUS`; no inference |
| KST slate vs `officialDate` for rolling windows | Open — window policy needed for `gamesInLastNDays` |

## KBO Research Pipeline v1

| Issue | Status |
|-------|--------|
| Schedule/Result Identity v1 | **COLLECTING** — Provider/Service/Builder layered; API-BASEBALL `5` primary + legacy TheSportsDB artifact preserved |
| Pipeline architecture | Provider → Service → Builder; file cache only; no Redis/WebSocket/polling |
| Feature flag | `KBO_IDENTITY_COLLECTION_ENABLED` — collection CLI only, not Engine admission |
| KBO Prediction / Starter / Bullpen / Lineup | Not implemented (by design) |
| Stable research `gameId` | `kbo-{providerGameId}` in identity v1 |
| Betman scope matching | `NOT_CHECKED` in KBO v1; **multi-sport Daily Slate v1** via `research:betman-slate` (operator input required) |
| Probable starter / lineup / bullpen / injury Providers | Open — API-BASEBALL lacks those endpoints per repo probe |
| Korea weather Provider | Open — NOAA US-only insufficient |
| Grade taxonomy for draw / no-game / suspended | Open — identity v1 stores normalized status; MLB grader not extended |
| Provider commercial / public display rights | `UNCONFIRMED` — no forced selection |
| Today slate completeness | Resolved for 2026-07-28 via API-BASEBALL full-slate provider; legacy TheSportsDB still limited to 3 games |
| Betman target scope input | Manual operator input only; default `NOT_ENTERED` — see [BETMAN_DAILY_FULL_SLATE_COVERAGE_V1.md](./BETMAN_DAILY_FULL_SLATE_COVERAGE_V1.md) |
| Proto odds input | Manual operator input only; default `NOT_ENTERED` |
| Operator input verified state | `VERIFIED_FOR_RESEARCH_INPUT` does not imply Prediction/Engine/public use approval |
| Integrated operator market input v2 | 2026-07-28 draft is `READY_FOR_OPERATOR_REVIEW`; review state still `DRAFT` |
| Full-slate identity coverage | Resolved for 2026-07-28 with API-BASEBALL; public/commercial rights remain unconfirmed |
| Postgame result identity | Scripted result-region update; 2026-07-28 all 5 games FINAL (provider `FT`) via postgame identity pass |
| KBO market result feedback v1 | Post-game observation only; domestic DRAFT + overseas MARKET_RULE_UNVERIFIED — no ROI or prediction |
| KBO starter pre-game source | API-BASEBALL / TheSportsDB — no starter fields; operator input v1 validator: `research:kbo-starter-input` |
| Multi-sport Historical Odds | Documented-only audit; The Odds API paid Historical not probed; Volleyball/KBL `NOT_SUPPORTED` on Odds API; all compliance gates `NOT_PASSED` → Builder not recommended |
| Historical Odds Timeline Dataset v1 | Pre-design only (`DESIGN_ONLY`); normalized raw rows + derived summary recommended; no Builder/API/types yet |
| MLB h2h Historical minimal probe | `PLAN_BLOCKED` on free Odds API plan (`HISTORICAL_UNAVAILABLE_ON_FREE_USAGE_PLAN`); 0 credits consumed; Schema fit pending paid plan |
| Historical Odds paid plan decision | **HOLD** — do not buy production Historical yet; optional time-boxed $30 probe only after operator approval ([business audit](./HISTORICAL_ODDS_PAID_PROVIDER_BUSINESS_DECISION_AUDIT_V1.md)) |
| Market Intelligence Hypothesis Registry | Pre-design only; `MI-*` namespace separate from Prediction `H-*`; no auto promotion; Engine default PROHIBITED |
| KBO odds comparison v1 | `MONEYLINE_2WAY` only; overseas market rules remain `MARKET_RULE_UNVERIFIED`, so raw odds are shown without numeric comparison |
| `/games` duplicate React key warning | Root cause was `buildGameId(league-home-away)` collision risk for same-matchup provider rows; `/api/games` now dedupes by real-game identity and `GameList` uses provider-backed composite render key |

## Soccer Research Pipeline v1 (pre-design)

| Issue | Status |
|-------|--------|
| Soccer research Dataset artifacts | Not implemented — pre-design only |
| Stable research `gameId` | Recommend `soccer-{providerFixtureId}`; do not use Betman id or team/date slug as primary |
| Result / grade taxonomy | Draw, extra time, penalties, and abandoned states require soccer-specific contract |
| Starting XI / formation availability | Provider coverage depends on league/season and near-kickoff timing |
| Injury / suspension reliability | Competition-dependent; post-game backfill leakage risk high |
| League table / form leakage | Must preserve cutoff and avoid post-match recompute contamination |
| Non-major Betman league coverage | Candidate only after lawful provider coverage and mapping validation |
| Provider commercial / public display rights | `NEEDS_LEGAL_REVIEW` / `COMMERCIAL_LICENSE_REQUIRED` depending on provider |
