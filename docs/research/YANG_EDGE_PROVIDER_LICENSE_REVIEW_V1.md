# YANG EDGE Provider License Review v1

Not legal advice. No final commercial clearance. Unclear items stay **NEEDS_WRITTEN_PROVIDER_CONFIRMATION**.

---

## Classes used

| Class | Meaning |
|---|---|
| PRIVATE_RESEARCH_OK | Internal research artifacts appear consistent with current project use |
| PUBLIC_DISPLAY_REQUIRES_REVIEW | Showing stats/odds/logos in a public product needs extra review |
| REDISTRIBUTION_RESTRICTED | Reseller / standalone data product forbidden or tightly limited |
| COMMERCIAL_LICENSE_REQUIRED | Production/commercial league use likely needs a sales agreement |
| UNKNOWN | Terms not fully retrieved this mission |

---

## Provider notes (official or project-confirmed only)

### MLB Stats API

- Public HTTP, no key.
- Research artifacts already stamp `MLB_STATSAPI_COMMERCIAL_USE_UNVERIFIED`.
- Public display of MLB-derived box/lineup/stat lines: **PUBLIC_DISPLAY_REQUIRES_REVIEW**.
- Bulk republishing of Stats API payloads: treat as **REDISTRIBUTION_RESTRICTED** until counsel reviews MLB terms.
- Written confirmation needed before a paid public product claims “official MLB stats.”

### API-Sports family (API-Football, API-Baseball, API-Basketball, API-Volleyball)

Official terms excerpt (api-sports.io/terms, search fetch 2026-08-20): provider **does not grant a commercial license** to publish league data; users must obtain rights from leagues/federations; **resale of the feed** is not allowed; betting/TV/fantasy/mass media may need extra licenses.

- Private research with a subscribed key: likely **PRIVATE_RESEARCH_OK** under current internal-only stance, still **PER_USE** if public.
- Public YANG EDGE product: **PUBLIC_DISPLAY_REQUIRES_REVIEW** + **NEEDS_WRITTEN_PROVIDER_CONFIRMATION**.
- Redistribution of raw API dumps: **REDISTRIBUTION_RESTRICTED**.

Cloudflare blocked a full terms re-fetch in-session; do not treat the excerpt as a complete contract.

### SportsDataIO

- Trial **scrambled** data: permanently **BLOCKED** for research claims.
- Discovery Lab (prior odds audit): not licensed for commercial redistribution.
- Vault / Leagues: sales-quoted → **COMMERCIAL_LICENSE_REQUIRED**.
- Current workspace plan: **CURRENT_PLAN_UNKNOWN**.

### The Odds API

Prior audit + official pricing/terms:

- Analytics/apps allowed if odds are **not** the product sold.
- Standalone redistribution **forbidden** → **REDISTRIBUTION_RESTRICTED**.
- Public display: **PUBLIC_DISPLAY_REQUIRES_REVIEW**.
- Historical: paid plans only; project decision **HOLD**.

Odds remain **forbidden** as Independent Probability inputs.

### TheSportsDB

PROVIDER_POLICY: **REVIEW_REQUIRED**. Free-tier limits exist in code. Attribution/display: **UNKNOWN** pending written check.

### Weather candidates

Not selected. NOAA vs OpenWeather ToS differ. **UNKNOWN** until a provider is chosen. Forecast vs observed weather must stay separated.

### Betman

**BLOCKED** as a crawlable Provider (scope only).

---

## Public / paid product — ask in writing before launch

1. MLB: may we display Stats API derived player lines in a public analytics product in Korea?  
2. API-Sports: may we display football XI, injuries, and counting stats in a public product under our current plan?  
3. Odds API: may we display implied probabilities as a *benchmark* (not a sold odds feed)?  
4. SportsDataIO: is any non-scrambled key we hold licensed for commercial analytics, or trial-only?  

Until answers exist, public claims stay internal-research.

---

## Redistribution

Do not ship git dumps of raw Provider caches as a product. Research cache under `data/cache/research/` is gitignored and **INTERNAL_RESEARCH_ONLY**.
