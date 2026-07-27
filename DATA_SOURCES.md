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
