# Betman Daily Full-Slate Coverage and Minimum Analysis v1

Internal research / operator workflow for registering **all** Betman-scheduled baseball, soccer, basketball, and volleyball games for a KST date in one Daily Slate, matching Provider Identity, and recording the **minimum analysis level** currently achievable in YANG EDGE.

**Status:** `INTERNAL_RESEARCH_ONLY`  
**Marker:** `BETMAN_DAILY_FULL_SLATE_COVERAGE_V1_READY`

---

## Scope

| Allowed | Forbidden |
|---------|-----------|
| Operator manual input or OCR-reviewed input | Betman HTML crawl, login automation, hidden API |
| Provider identity matching (existing providers) | Fake games when operator input missing |
| Minimum analysis level resolution | Forced predictions, confidence, AI picks |
| Coverage metrics and audit artifacts | Public homepage wiring |
| Internal API `GET /api/research/daily-slate` | Tennis support |

**Tennis** is explicitly excluded → `UNSUPPORTED_SPORT`.

---

## Operator input

**Path:** `data/operator-input/betman/{DATE}-daily-slate-v1.json`  
**Template:** `data/operator-input/betman/templates/daily-slate-v1-template.json`

| Field | Notes |
|-------|-------|
| `schemaVersion` | `betman-daily-slate-v1` |
| `reviewStatus` | `DRAFT` (default) · `VERIFIED` · `REJECTED` |
| `sourceType` | `OPERATOR_MANUAL` · `OCR_OPERATOR_REVIEWED` |
| `games[]` | Full Betman slate for the date |

Per-game fields include `operatorSlateGameId`, `sport`, team raw names, KST start time, optional odds (`marketSelections`), and optional `providerGameId` / `providerFixtureId` / `manualIdentityReference`.

**Validator does not mutate operator files.**

---

## Analysis levels

| Level | Meaning |
|-------|---------|
| `FULL_ANALYSIS` | Formal prediction snapshot + required datasets |
| `PARTIAL_ANALYSIS` | Prediction pipeline exists; some datasets missing |
| `MARKET_BASELINE_ONLY` | Identity + verified odds; market implied prob only — **no YANG EDGE AI prediction label** |
| `IDENTITY_ONLY` | Identity confirmed; insufficient data for analysis |
| `BLOCKED` | Identity conflict, missing start time, legal block, etc. |

---

## Provider identity matching

| Sport | Provider |
|-------|----------|
| BASEBALL (KBO) | KBO identity artifact (`API_BASEBALL` default) |
| BASEBALL (MLB) | MLB prediction snapshot (`data/predictions/mlb/{DATE}.json`) |
| SOCCER | API-Football fixture cache (`data/cache/research/soccer/raw/`) |
| BASKETBALL | `IDENTITY_PROVIDER_NOT_IMPLEMENTED` |
| VOLLEYBALL | `IDENTITY_PROVIDER_NOT_IMPLEMENTED` |

Match priority:

1. Operator `providerGameId` / `providerFixtureId` / `manualIdentityReference`
2. Canonical team + KST start + competition
3. Never auto-confirm from team name string alone

Unmatched games **remain in the slate**.

---

## Commands

```bash
# KST today (default)
npm run research:betman-slate

# Specific date
npm run research:betman-slate -- 2026-07-29
```

**Outputs:**

- `data/research/daily-slates/{DATE}-betman-full-slate-v1.json`
- `data/audits/{DATE}-betman-full-slate-coverage-v1-audit.json`

When operator input is **not entered**:

- `operatorInputStatus = NOT_ENTERED`
- `totalGames = 0`
- `analysisCoverageRate = null`
- Normal exit (no fake games)

---

## Internal API

```
GET /api/research/daily-slate?date=YYYY-MM-DD
```

Returns `coverageSummary`, `sportCounts`, `games`, `warnings`.  
**Not connected to public homepage.**

Optional future viewer: `/research/daily-slate-preview?date=YYYY-MM-DD` (deferred if scope grows).

---

## Future OCR flow (not implemented)

```
Screenshot → OCR Draft → Operator Review → VERIFIED Daily Slate
  → Provider Identity Matching → Minimum Analysis
```

OCR output must **never** auto-promote to `VERIFIED`.

---

## Compliance

| Concern | Status |
|---------|--------|
| Betman scope | `MANUAL_SCOPE_ONLY` |
| Betman odds | `MANUAL_INPUT_OR_OCR_REVIEW_ONLY` |
| Public display | `LEGAL_CLEARANCE_PENDING` |
| Commercial use | `LEGAL_CLEARANCE_PENDING` |
| Feature mode | `INTERNAL_RESEARCH_ONLY` |

---

## Regression boundary

No changes to MLB Prediction, KBO Identity, KBO Starter/Odds, Soccer Schedule Provider, or Engine weights.

---

## Code map

| Path | Role |
|------|------|
| `src/lib/betman/daily-slate/betman-daily-slate-types.ts` | Types |
| `src/lib/betman/daily-slate/validate-betman-daily-slate-v1.ts` | Operator input validator |
| `src/lib/betman/daily-slate/match-betman-provider-identity.ts` | Provider identity matching |
| `src/lib/betman/daily-slate/build-betman-full-slate-v1.ts` | Full slate builder |
| `src/lib/research/daily-slate/resolve-minimum-analysis-level.ts` | Analysis level resolver |
| `scripts/validate-betman-daily-slate-v1.ts` | CLI orchestrator |
| `src/app/api/research/daily-slate/route.ts` | Internal API |
