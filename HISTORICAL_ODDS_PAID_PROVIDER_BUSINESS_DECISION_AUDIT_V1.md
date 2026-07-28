# Historical Odds Paid Provider Business Decision Audit v1

**Official conclusion:** `HISTORICAL_ODDS_BUSINESS_DECISION_AUDITED`  
**Recommendation:** **HOLD**

Historical API was **not** called in this mission.  
Dataset / Builder / Prediction / Engine / Viewer / Registry / Framework: **unchanged**.

## References

- [MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDIT_V1.md](./MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDIT_V1.md)
- [HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md](./HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md)
- [MLB_H2H_HISTORICAL_ODDS_PROBE_V1.md](./MLB_H2H_HISTORICAL_ODDS_PROBE_V1.md) (`PLAN_BLOCKED` on free plan)
- [docs/DEVELOPMENT_COMPLIANCE_CHARTER.md](./docs/DEVELOPMENT_COMPLIANCE_CHARTER.md)
- Official: [The Odds API pricing](https://the-odds-api.com/) · [Terms](https://the-odds-api.com/terms-and-conditions.html) · [Historical](https://the-odds-api.com/historical-odds-data/)
- Official: [SportsDataIO developer access](https://sportsdata.io/developers)
- Project: [DATA_SOURCES.md](./DATA_SOURCES.md)

Audit JSON: `data/audits/historical-odds-paid-provider-business-decision-audit-v1.json`

---

## 1. Decision question

Should YANG EDGE **pay now** for Historical Odds access?

Answer in this audit: **HOLD** — do not subscribe for production/multi-sport harvest yet; keep design + free live odds; reconsider only after Charter gates and a narrow paid probe budget are approved.

---

## 2. Compared providers

| Provider | Historical odds | Self-serve price floor | Commercial path |
|----------|-----------------|------------------------|-----------------|
| **The Odds API** | Yes on **paid** plans only | **$30/mo** (20K credits) | Terms allow app/analytics commercial use; **no** standalone redistribution |
| **SportsDataIO** | Vault / odds history via **sales**; Discovery Lab odds self-serve | Discovery Lab Odds **$99/mo** ($599/yr); Vault **quote** | Commercial Leagues/Vault = sales agreement; Discovery Lab **not** for commercial redistribution |
| **API-SPORTS** (API-Baseball/Football/Basketball/Volleyball) | Schedule/results historical strong; **odds timeline archive parity with Odds API = NOT_VERIFIED** | Marketing from ~$10–$19/mo (plan pages vary); already used for KBO/MLB schedule research | Product T&C / commercial display **NEEDS_LEGAL_REVIEW** per deployment |
| **Other licensed feeds** | Case-by-case | Quote | Usually `COMMERCIAL_LICENSE_REQUIRED` |

Provider is **not** locked into code by this audit.

---

## 3. The Odds API — pricing & Historical

Source: public pricing page (2026) + Historical guide + Terms.

| Plan | Monthly USD | Credits / mo | Historical included |
|------|-------------|--------------|---------------------|
| Free / Starter | $0 | 500 | **No** (confirmed by project probe `PLAN_BLOCKED`) |
| 20K | **$30** | 20,000 | **Yes** (lowest paid Historical floor) |
| 100K | $59 | 100,000 | Yes |
| 5M | $119 | 5,000,000 | Yes |
| 15M | $249 | 15,000,000 | Yes |

- Annual (if paid monthly continuously): 20K ≈ **$360/yr**; 100K ≈ **$708/yr** (no separate public annual discount documented here → UNKNOWN if annual discount exists).
- Historical quota: **10 credits × regions × markets** (featured sport snapshot); event endpoint **10 × regions × markets × event**.
- Rate limit: documented 429 / guidance behavior; cache encouraged for slow-changing endpoints.

### License matrix (The Odds API Terms — documented)

| Topic | Status | Notes |
|-------|--------|-------|
| Research / analytics tools | Conditionally allowed | Encouraged for dashboards / analytical tools |
| Commercial use in own app | Conditionally allowed | Allowed if data is **not** the primary product sold |
| Redistribution / resale as data feed | **Forbidden** | No standalone API/feed/downloadable raw product for others |
| Public display | Conditionally allowed | User-facing apps OK under restrictions; still `PER_USE_LEGAL_REVIEW` for YANG EDGE public launch |
| Internal cache | Encouraged (docs) | For performance; retention vs redistribution still distinct |
| Raw odds storage | Conditionally allowed for own product/research | Must not become redistribution; Git full archive discouraged by project policy |
| Bookmaker display / trademarks | Identification allowed | Brands remain owners; no endorsement implication |
| Attribution | Not a rigid mandatory footer in Terms excerpt | Affiliate/monetize guides separate; treat as **NEEDS_REVIEW** for product UX |
| Responsible gambling | Encouraged if promoting wagering | Jurisdiction-specific duty on user |

Project stance remains: `PER_USE_LEGAL_REVIEW_REQUIRED` until operator + counsel sign-off.

---

## 4. SportsDataIO — pricing & Historical

| Access | Price | Historical / odds | Restrictions |
|--------|-------|-------------------|--------------|
| Free Trial | Free | Scrambled — **not** for analysis | No real data |
| Discovery Lab Odds | **$99/mo** / **$599/yr** | Real odds, **next-day delayed**; personal/hobby | **Not licensed for commercial redistribution**; no Soccer etc. in Lab sports list |
| Discovery Lab Fantasy+Odds | $149/mo / $899/yr | Same delay constraints | Same |
| Vault | Contact sales | 10+ years research/backtest | Sales-enabled |
| Leagues API | Contact sales | Live + odds commercial | Quote; production SLA |

**Fit for YANG EDGE Historical Timeline:** possible long-term for US-centric backtests, but **not** the cheapest self-serve Historical path; KBO/NPB/soccer/volleyball coverage for odds timeline is **not** confirmed as Odds-API-equivalent on Discovery Lab.

Scrambled data remains **BLOCKED** for research claims (existing project rule).

---

## 5. API-SPORTS family

| Topic | Assessment |
|-------|------------|
| Already in project | API-Baseball for KBO/MLB schedule identity |
| Odds | Pre-match/live odds marketed; **Historical Odds Timeline depth NOT_VERIFIED** vs The Odds API snapshots |
| Volleyball | Schedule/stats candidate (Odds API lacks volleyball) |
| Price floor | Public marketing ~$10–$39/mo class (third-party summaries vary) — treat exact SKU as **confirm on dashboard** |
| Commercial / cache / redistribution | **NEEDS_LEGAL_REVIEW** — do not assume Odds API terms apply |

API-SPORTS is a **schedule/results** strength today, not a proven substitute for Odds API Historical bookmaker timelines.

---

## 6. Cost model (usage estimates)

Assumptions (documented, not measured):

- 1 region, `h2h` only, featured Historical cost unit = **10 credits**
- **Slate-day method:** 1 sport-day Historical `/odds` pull = 10 credits (entire slate)
- **Event method:** 10 credits × events (expensive for dense slates)
- Prefer slate-day for Opening+Latest research harvest estimates
- USD prices from The Odds API public table only

### A. Opening + Latest only (2 slate pulls / sport-day)

| League | Approx sport-days / year | Credits / year | Fits 20K plan? | Fits 100K plan? |
|--------|--------------------------|----------------|----------------|-----------------|
| MLB | ~162 | ~3,240 | Yes | Yes |
| KBO | ~144 | ~2,880 | Yes | Yes |
| NPB | ~143 | ~2,860 | Yes | Yes |
| Soccer (multi-league Betman mix) | UNKNOWN / HIGH day count | **HIGH** | Maybe not | Likely if capped leagues |
| Basketball (NBA) | ~82 | ~1,640 | Yes | Yes |
| **MLB+KBO+NPB+NBA** | — | ~10,600 | Yes | Yes |

**Plan floor for this mode:** **$30/mo ($360/yr)** may suffice for baseball+NBA opening/latest only — if soccer expansion stays limited.

### B. 5-minute Timeline (illustrative 4h pre-game window)

48 snapshots × 10 credits = **480 credits / sport-day**

| League | Credits / year (order of magnitude) | Plan implication |
|--------|-------------------------------------|------------------|
| MLB | ~78,000 | Needs **≥100K** ($59/mo) for one league; multi-league → **5M** ($119/mo) class |
| KBO | ~69,000 | Same |
| NPB | ~69,000 | Same |
| Soccer multi | **VERY HIGH** | 5M+ or impossible under budget |
| NBA | ~39,000 | 100K borderline alone |

**Storage (order-of-magnitude):**

| Mode | Rows / game (h2h, ~8 books, 2 selections) | Season class |
|------|-------------------------------------------|--------------|
| Opening+Latest | LOW (~tens) | LOW–MEDIUM JSON |
| 5-min × 4h | HIGH (hundreds–thousands) | HIGH; keep out of Git |

Volleyball: **not costed** on The Odds API (NOT_SUPPORTED).

---

## 7. ROI — research value only (no hit-rate claim)

Historical Odds enables **verifiable research variables**, not guaranteed accuracy gains.

| Research variable | Needs Historical? | Notes |
|-------------------|-------------------|-------|
| Opening drift (OPENING_CANDIDATE → LATEST_PRE_GAME) | Yes | Price language only |
| Late move / movement speed candidates | Yes (dense timeline) | Formula unset |
| Bookmaker disagreement / dispersion | Yes (raw books) | Not AGGREGATE_BEST |
| Consensus candidates | Yes | Formula not selected |
| CLV candidates | Yes + decision timestamp + VERIFIED rules | Not official Closing |
| Market confidence proxies | Partial | Must not equal win probability |
| Prediction vs market probability | Partial (live freeze may suffice) | Historical expands sample |
| Domestic vs overseas gap | No Historical required for forward archive | Operator input separate |

**Explicit non-conclusion:**  
Historical availability **does not** imply higher Prediction hit rate. Any link to outcomes requires cutoff-safe joins, verified market rules, sample thresholds, and backtests — per Charter Evidence First.

---

## 8. Risk summary

| Risk | Level | Why |
|------|-------|-----|
| Legal | MEDIUM–HIGH until review | Public/commercial display, bookmaker marks, gambling advertising rules |
| Business | MEDIUM | Paying before product monetization; credit burn on 5-min multi-sport |
| Technical | MEDIUM | Volleyball/KBL gap; market-rule UNVERIFIED; schema fit not validated on paid Historical yet |
| Compliance gates | All still NOT_PASSED / NEEDS_REVIEW | Probe proved plan block only |

---

## 9. Recommendation

### HOLD

**Meaning:** Do **not** purchase a paid Historical plan for production harvest or Engine wiring now.

**Why HOLD (not GO):**

1. Project stage is Private Research — no public release requirement for Historical yet.
2. Free plan cannot run Historical (`PLAN_BLOCKED` already recorded).
3. Schema fit against real Historical payload is still **unproven** on a paid key.
4. Charter gates (legal/license/cache/redistribution/market-rule) are not cleared.
5. Dense 5-min multi-sport timelines jump cost into $59–$119+/mo quickly.
6. Paying does not solve volleyball / KBL coverage.
7. No evidence package yet that market-movement features beat current research baselines.

**Why not NOT RECOMMENDED forever:**

1. Lowest paid Historical floor ($30/mo) is modest for a **time-boxed MLB Opening+Latest probe**.
2. Terms appear compatible with internal analytical tools if redistribution is avoided.
3. Design docs are ready for a capped re-probe after operator approval.

**What HOLD allows next (optional, operator-gated):**

- Approve a **temporary** 20K plan for **MLB h2h schema-fit probe only** (credit cap still ≤50–few hundred).
- Cancel if probe fails schema/license needs.
- Still no Builder / Engine / public display until gates pass.

**What HOLD forbids:**

- Auto-upgrade / automatic billing from agents
- Season-wide 5-min harvest now
- Engine weight from odds movement
- Claiming hit-rate improvement from buying Historical

---

## 10. GO / HOLD / NOT RECOMMENDED

```text
HOLD
```

---

## 11. Impact

| Area | Impact |
|------|--------|
| Dataset / Builder | 0 |
| Prediction / Engine / Viewer | 0 |
| Registry / Framework | 0 |
| Historical API calls this mission | 0 |

---

## 12. Remaining issues

1. Operator decision: whether to fund a time-boxed $30 plan for schema-fit only.
2. Counsel review of Odds API Terms vs Korean public product ambitions.
3. SportsDataIO Vault quote if US-only deep history becomes a priority.
4. Volleyball / KBL licensed odds provider still open.
5. Market-rule verification still blocking Backtest/Engine use.
