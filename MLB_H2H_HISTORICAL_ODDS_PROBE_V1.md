# MLB h2h Historical Odds Minimal Probe v1

**Official conclusion:** `MLB_H2H_HISTORICAL_ODDS_MINIMAL_PROBE_COMPLETED`  
**Probe status:** `PLAN_BLOCKED`

Audit: `data/audits/mlb-h2h-historical-odds-probe-v1.json`  
Script: `scripts/probe-mlb-h2h-historical-odds-v1.ts`

References:

- [HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md](./HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md)
- [MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDIT_V1.md](./MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDIT_V1.md)
- [docs/DEVELOPMENT_COMPLIANCE_CHARTER.md](./docs/DEVELOPMENT_COMPLIANCE_CHARTER.md)

---

## Result summary

Current account can call live The Odds API (`/sports` OK) but **Historical odds are blocked** on the free usage plan.

| Item | Value |
|------|-------|
| HTTP | `401` |
| error_code | `HISTORICAL_UNAVAILABLE_ON_FREE_USAGE_PLAN` |
| Further Historical calls | **Stopped** after first blocked response |
| Credits consumed (header delta) | `0` |
| Full raw stored | No |
| Builder / Registry / Engine | Not activated |

This is an **accurate block**, not an implementation failure.

---

## Target (selected, not harvested)

| Field | Value |
|-------|-------|
| internalGameId | `mlb-179589` |
| providerEventId | `210e6566d3641ee245e8a099a1679244` |
| Matchup | New York Yankees @ Philadelphia Phillies |
| scheduledStartTime | `2026-07-26T23:21:00Z` |
| dateKst | `2026-07-27` |
| Final score (existing prediction grade) | PHI 11 – NYY 4 |
| market | `h2h` |
| region | `us` |
| Planned snapshot pulls | 4 (24h / 6h / 1h / 5m before start) |
| Design max | 12 (not used — credit + plan gates) |
| Bookmaker limit | 10 |
| Estimated credits | 40 (≤ 50 cap) |

Identity evidence came from existing project artifacts (prediction + odds history + odds timeline), not team-name-only matching.

---

## Environment / cost

| Check | Result |
|-------|--------|
| `ODDS_API_KEY` | Present (value not logged) |
| Live `/sports` | 200 |
| Remaining credits before Historical | 139 |
| Historical plan | **Not available** (free plan) |
| Estimated credits | 40 |
| Actual credits used | 0 (remaining stayed 139) |
| COST_CAP_BLOCKED | No (estimate within cap; plan blocked first) |

Endpoint attempted:

```text
GET /v4/historical/sports/baseball_mlb/events/{eventId}/odds
  ?regions=us&markets=h2h&oddsFormat=decimal&date=2026-07-25T23:21:00Z
```

---

## Schema validation status

Because no Historical payload was returned:

| Area | Status |
|------|--------|
| Bookmaker raw preservation | NOT_EVALUATED |
| Snapshot pre-game classification | NOT_EVALUATED |
| OPENING_CANDIDATE / LATEST_PRE_GAME | NOT_EVALUATED |
| Selection HOME/AWAY mapping | NOT_EVALUATED |
| Movement observation | NOT_EVALUATED |
| Schema fit | NOT_EVALUATED_PLAN_BLOCKED |

Design policies remain unchanged:

- No official Opening / Closing claims
- No `AGGREGATE_BEST` in Timeline raw
- No full Historical raw in Git
- `CACHE_GATE` not passed → no persistent Historical raw cache written

---

## Compliance gates (post-probe)

| Gate | Status |
|------|--------|
| LEGAL_GATE | NOT_PASSED |
| LICENSE_GATE | NOT_PASSED |
| CACHE_GATE | NOT_PASSED |
| REDISTRIBUTION_GATE | NOT_PASSED |
| COST_GATE | PROBE_BUDGET_OK_BUT_PLAN_BLOCKED |
| DATA_QUALITY_GATE | NOT_PASSED |
| MARKET_RULE_GATE | NOT_PASSED |

Paid plan upgrade was **not** performed. Probe success (or plan block) does not clear legal gates.

---

## Impact

| Area | Impact |
|------|--------|
| Production Historical Builder | 0 |
| Dataset / Registry / Framework | 0 |
| MLB Prediction / Odds History artifacts | 0 |
| KBO artifacts | 0 |
| Engine / Viewer | 0 |

---

## Next step (gated)

Only after an operator-approved **paid** Odds API plan that includes Historical:

1. Re-run the same script on the same target game.
2. Keep caps (≤50 credits, ≤10 books, ≤12 snaps / practical ≤4–5 pulls).
3. Still no Builder / Engine activation until all Charter gates pass.

---

## Files

| Path | Role |
|------|------|
| `scripts/probe-mlb-h2h-historical-odds-v1.ts` | Capped probe runner |
| `data/audits/mlb-h2h-historical-odds-probe-v1.json` | Audit |
| `data/probes/.../schema-sample.json` | **Not written** (no successful payload) |
