# Data Sources

## Supported sports (product scope)

YANG EDGE targets **four sports only**: baseball (야구), soccer (축구), basketball (농구), volleyball (배구).

- **Tennis and all other sports** are out of support scope until an explicit operator decision and legal/data review.
- **League list is not fame-fixed.** A Betman (배트맨)–scheduled league — including non-major competitions (e.g. Norwegian football) — may become a research **candidate** after activation gates (schedule confirmation, lawful data, ID mapping, snapshot/grade/review support, legal clearance). See [PROJECT_MEMORY.md](./PROJECT_MEMORY.md) §24.
- Games **not** scheduled on Betman are out of public analysis / recommendation scope.
- **Betman schedule confirmation ≠ Betman as a sports data Provider.** Official Provider calendars and Betman schedules are matched separately.

## Priority order (research sourcing)

1. API-BASEBALL (commercial subscription in use)
2. The Odds API
3. SportsDataIO (non-scrambled only; Scrambled permanently prohibited)
4. MLB Stats API
5. Other sources (case-by-case legal review) — for non-MLB sports, choose Providers only after legal review; never Betman HTML

## The Odds API

```text
REFERENCE_ODDS_PROVIDER
PER_USE_LEGAL_REVIEW_REQUIRED
```

The Odds API may be used for research and reference odds where plan terms allow. Display, caching, redistribution, and commercial product use still require explicit clearance per deployment.

## Korean Proto / Sports Toto odds

```text
SOURCE_RIGHTS_NOT_CONFIRMED
NO_PUBLIC_OR_COMMERCIAL_FEATURE_DEPENDENCY
LONG_TERM_CANDIDATE_ONLY
```

- Korean proto (스포츠토토/프로토) odds for Value Edge is a **long-term candidate only**
- Official rights to **use, store, and redistribute** proto odds are **not confirmed**
- Until cleared: no public UI, no commercial feature, no marketing claim based on proto Value Edge

### Manual and OCR operator input

Operator manual entry or future OCR-assisted entry:

- Does **not** imply public or commercial use permission for the underlying odds source
- Must record **source**, **inputTime**, **operator**, and **revision history**
- OCR output requires operator review before persistence; never auto-finalized

### Betman (배트맨) schedule vs data Providers

| Concern | Rule |
|---------|------|
| Game / league **scope** | Align with Betman-scheduled fixtures (operator-confirmed or other lawful path) |
| Schedule / results / stats **data** | Lawful sports data Providers only (API-BASEBALL, Odds API, etc. after clearance) |
| Betman site | **Not** a crawlable data API |

Schedule confirmation (when recorded in future admin tooling) should store **source**, **confirmedAt**, **operator**, and **revision history**.

### Permanently prohibited (proto / Betman)

```text
NO_BETMAN_HTML_CRAWLING
NO_LOGIN_AUTOMATION
NO_HTML_PARSING_OF_BETMAN
NO_AUTOMATED_SCREEN_CAPTURE_AT_SCALE
NO_BULK_REDISTRIBUTION_OF_UNLICENSED_ODDS
NO_TREATING_BETMAN_AS_OFFICIAL_SPORTS_API
```

## MLB Stats API

```text
INTERNAL_RESEARCH_ONLY
NO_PUBLIC_RUNTIME_CONNECTION
NO_COMMERCIAL_RUNTIME_CONNECTION
COMMERCIAL_USE_NOT_CONFIRMED
```

Allowed:

- Internal research scripts under `scripts/`
- Research disk cache under `data/cache/research/mlb/`
- Derived bullpen features for audits and datasets under `data/research/` and `data/audits/`
- Derived starter dataset features under `data/research/mlb/*-starter-dataset-v1.json` and `data/cache/research/mlb/derived/starter/` (INTERNAL_RESEARCH_ONLY)
- Derived lineup dataset features under `data/research/mlb/*-lineup-dataset-v1.json` (INTERNAL_RESEARCH_ONLY; post-game actual starting lineups; Engine PROHIBITED)
- Pre-game lineup availability probes under `data/research/mlb/*-pregame-lineup-availability-probes-v1.json` (INTERNAL_RESEARCH_ONLY; schedule `hydrate=lineups` at probe time only; append-only; no post-game backfill; H-LU-003 observation)
- Travel/Rest dataset design inputs: schedule + venue endpoints only; haversine distance is a labeled derivative from venue coordinates (not route inference); pre-design audit: `data/audits/travel-rest-dataset-v1-pre-design-audit.json` · design: `TRAVEL_REST_DATASET_V1_DESIGN.md` — builder not implemented

Prohibited:

- Import into public Next.js runtime / API routes serving customers
- Commercial product features that depend on Stats API payloads
- MLB.com HTML crawling
- SportsDataIO Scrambled data

Research cache must not store API keys. Prefer derived fields; raw cache is research-only and must remain offline from public runtime.

## NOAA National Weather Service API (`api.weather.gov`)

```text
INTERNAL_RESEARCH_ONLY
PUBLIC_CANDIDATE (US product features — after legal review)
NOAA_PUBLIC_DOMAIN_DATA
```

- Official US Government forecast API; free; User-Agent header required
- Attribution requested (e.g. "Data source: NOAA"); no false endorsement
- **US coverage only** — not sufficient alone for Canadian MLB venues
- Pre-design audit: `data/audits/weather-dataset-v1-pre-design-audit.json` · design: `WEATHER_DATASET_V1_DESIGN.md`
- Not wired in codebase; no builder implemented

## Open-Meteo

```text
INTERNAL_RESEARCH_ONLY (free non-commercial API tier)
COMMERCIAL_REQUIRES_PAID_SUBSCRIPTION
PUBLIC_CANDIDATE_HOLD
```

- Official API at `open-meteo.com`; free tier limited to non-commercial use (10k calls/day)
- Output data CC-BY-4.0; attribution required
- Commercial / public product use requires paid plan and separate legal review
- Global coverage including Canada — candidate supplement for non-US venues
- Historical Forecast API requires Professional+ paid tier
- Not wired in codebase; no builder implemented

## SportsDataIO Scrambled

```text
PERMANENTLY_PROHIBITED
```

Scrambled or obfuscated SportsDataIO data must not be used in any context.

## KBO (Schedule / Result Identity v1 — collecting)

```text
INTERNAL_RESEARCH_ONLY
KBO_SCHEDULE_RESULT_IDENTITY_V1_COLLECTING
PUBLIC_DISPLAY_UNCONFIRMED
COMMERCIAL_USE_UNCONFIRMED
```

- First KBO research Dataset: `kbo-schedule-result-identity`.
- Primary provider default: API-BASEBALL league `5` (`legalStatus=NEEDS_LEGAL_REVIEW`, `researchUse=INTERNAL_RESEARCH_ONLY`).
- Legacy provider preserved: TheSportsDB league `4830` artifact remains read-only and is not silently overwritten.
- Build: `npm run research:kbo-identity -- YYYY-MM-DD` · spec: [KBO_SCHEDULE_RESULT_IDENTITY_V1.md](./KBO_SCHEDULE_RESULT_IDENTITY_V1.md) · architecture: [KBO_IDENTITY_PIPELINE_ARCHITECTURE.md](./KBO_IDENTITY_PIPELINE_ARCHITECTURE.md)
- Slate readiness: `npm run research:kbo-slate-readiness -- YYYY-MM-DD` · spec: [KBO_TODAY_SLATE_READINESS_V1.md](./KBO_TODAY_SLATE_READINESS_V1.md)
- Operator input validator: `npm run research:kbo-operator-input -- YYYY-MM-DD` · spec: [KBO_OPERATOR_INPUT_V1.md](./KBO_OPERATOR_INPUT_V1.md)
- Operator market v2 validator: `npm run research:kbo-operator-markets -- YYYY-MM-DD` · spec: [KBO_OPERATOR_MARKET_INPUT_V2.md](./KBO_OPERATOR_MARKET_INPUT_V2.md)
- Feature flag `KBO_IDENTITY_COLLECTION_ENABLED` controls **collection CLI only** (not Engine/Prediction/UI).
- Product schedule path maps TheSportsDB KBO league `4830` for UI calendars (plan limits apply).
- Prediction / Viewer research cards / Engine are **not** wired for KBO.
- Betman scope and proto odds are manual operator inputs only; no crawling / automated extraction.
- v2 market input keeps Betman market ids and screenshot transcriptions in `DRAFT` until operator review.
- Full-slate identity coverage audit (`2026-07-28`) recommends a provider-backed alternative over invented IDs: [KBO_FULL_SLATE_IDENTITY_COVERAGE_AUDIT_V1.md](./KBO_FULL_SLATE_IDENTITY_COVERAGE_AUDIT_V1.md)
- API-BASEBALL provider implementation and migration notes: [KBO_API_BASEBALL_IDENTITY_PROVIDER_V1.md](./KBO_API_BASEBALL_IDENTITY_PROVIDER_V1.md) · [KBO_IDENTITY_PROVIDER_MIGRATION.md](./KBO_IDENTITY_PROVIDER_MIGRATION.md)
- KBO odds comparison v1 uses operator-entered domestic proto odds + The Odds API overseas `baseball_kbo` `h2h` market only: [KBO_ODDS_COMPARISON_V1.md](./KBO_ODDS_COMPARISON_V1.md)
- **Do not** treat Betman or KBO official-site HTML as a data Provider.

## The Odds API (KBO odds comparison v1)

```text
INTERNAL_RESEARCH_ONLY
NEEDS_LEGAL_REVIEW
PUBLIC_DISPLAY_UNCONFIRMED
COMMERCIAL_USE_UNCONFIRMED
```

- Verified current active KBO sport key: `baseball_kbo`
- Current comparison policy uses `markets=h2h`, `regions=eu`, decimal odds
- KBO domestic/overseas comparison v1 stores raw decimal odds only
- No implied probability / margin removal / fair odds / value edge calculation

## Soccer (pre-design — no Dataset yet)

```text
RESEARCH_CANDIDATE_LEAGUE
SOCCER_PRE_DESIGN_ONLY
NO_SOCCER_DATASET_REGISTERED
```

- Current codebase has API-Football fixture schedule wiring, partial team mapping, and optional The Odds API listing enrichment only.
- Research Dataset / Prediction / Grade / Viewer integration for soccer are **not** wired.
- Recommended first Dataset: `Soccer Schedule / Result Identity Dataset v1`.
- Provider candidates and audit: [SOCCER_RESEARCH_PIPELINE_V1_DESIGN.md](./SOCCER_RESEARCH_PIPELINE_V1_DESIGN.md) · [MLB_KBO_SOCCER_COMMON_DIFFERENCE_AUDIT.md](./MLB_KBO_SOCCER_COMMON_DIFFERENCE_AUDIT.md)
- **Do not** treat Betman or football official-site HTML as a data Provider.
