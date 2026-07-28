# Research Log

Append-only research execution log. Do not rewrite past entries.

## Entry template

```text
## YYYY-MM-DD — <title>

### Purpose
-

### Scope
- Allowed:
- Forbidden:

### Inputs
-

### Outputs
-

### Results (summary)
-

### Official conclusion
-

### Engine connection
PROHIBITED

### Follow-ups
-
```

---

## 2026-07-28 — Market Intelligence Hypothesis Registry v1 Pre-design

### Purpose
- Design a Market Intelligence Hypothesis Registry separate from Prediction Research

### Scope
- Allowed: design docs + pre-design audit JSON
- Forbidden: Builder; Dataset; Registry code; Framework; Prediction; Engine; Viewer; Historical API

### Inputs
- Charter, Timeline design, Movement semantics, MI research design, existing Prediction HYPOTHESIS_REGISTRY patterns

### Outputs
- MARKET_INTELLIGENCE_HYPOTHESIS_REGISTRY_V1.md
- MARKET_INTELLIGENCE_RESEARCH_WORKFLOW.md
- data/audits/market-intelligence-hypothesis-registry-v1-pre-design.json

### Results (summary)
- Prediction vs MI: no direct influence
- Status lifecycle with manual promotion only; ENGINE_APPROVED ≠ auto-wire
- Sample targets 100/500/1000 candidates; no Confidence/Weight scores

### Official conclusion
MARKET_INTELLIGENCE_HYPOTHESIS_REGISTRY_V1_DESIGNED

### Engine connection
PROHIBITED

### Follow-ups
- Instantiate ops registry/ledger only in a later mission after evidence sources exist

---

## 2026-07-28 — Historical Odds Paid Provider Business Decision Audit v1

### Purpose
- Decide whether YANG EDGE should pay for Historical Odds now

### Scope
- Allowed: pricing/license/ROI documentation from public sources; cost estimates
- Forbidden: Historical API calls; Dataset/Builder/Prediction/Engine/Registry/Framework changes; auto billing

### Inputs
- The Odds API public pricing + terms + Historical docs
- SportsDataIO developer access page
- Prior coverage audit, timeline design, PLAN_BLOCKED probe

### Outputs
- HISTORICAL_ODDS_PAID_PROVIDER_BUSINESS_DECISION_AUDIT_V1.md
- data/audits/historical-odds-paid-provider-business-decision-audit-v1.json

### Results (summary)
- Lowest Historical paid floor: The Odds API 20K @ $30/mo
- Opening+Latest multi-baseball feasible on 20K credits; 5-min timelines escalate to 100K/5M class
- Recommendation: HOLD (not GO / not permanent NOT RECOMMENDED)

### Official conclusion
HISTORICAL_ODDS_BUSINESS_DECISION_AUDITED

### Engine connection
PROHIBITED

### Follow-ups
- Operator may later approve time-boxed $30 MLB schema-fit probe only

---

## 2026-07-28 — MLB h2h Historical Odds Minimal Probe v1

### Purpose
- Validate Timeline schema against one capped The Odds API Historical call path

### Scope
- Allowed: ≤50 credits estimate, 1 MLB game, h2h, stop on plan/cost block
- Forbidden: bulk harvest; Builder; Registry; Framework; Prediction; Engine; paid auto-upgrade

### Inputs
- Target: mlb-179589 / event 210e6566d3641ee245e8a099a1679244
- Design + coverage audit + charter

### Outputs
- MLB_H2H_HISTORICAL_ODDS_PROBE_V1.md
- data/audits/mlb-h2h-historical-odds-probe-v1.json
- scripts/probe-mlb-h2h-historical-odds-v1.ts

### Results (summary)
- Status: PLAN_BLOCKED (HISTORICAL_UNAVAILABLE_ON_FREE_USAGE_PLAN)
- Estimated credits: 40; actual header delta: 0
- Schema fit: not evaluated (no Historical payload)
- Gates remain NOT_PASSED / NEEDS_REVIEW

### Official conclusion
MLB_H2H_HISTORICAL_ODDS_MINIMAL_PROBE_COMPLETED

### Engine connection
PROHIBITED

### Follow-ups
- Re-run only after operator-approved paid Historical plan; still no Builder until all gates pass

---

## 2026-07-28 — Historical Odds Timeline Dataset v1 Pre-design

### Purpose
- Design common Historical Odds Timeline structure for Market Intelligence research

### Scope
- Allowed: design docs + pre-design audit JSON; references to coverage audit / charter
- Forbidden: Historical API calls; Builder; Dataset artifacts; Registry; Framework; Types code; Prediction; Engine

### Inputs
- MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDIT_V1.md
- MARKET_INTELLIGENCE_RESEARCH_DESIGN.md
- Current MLB Odds History + KBO Odds Comparison structures

### Outputs
- HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md
- MARKET_MOVEMENT_SEMANTICS_V1.md
- data/audits/historical-odds-timeline-dataset-v1-pre-design-audit.json

### Results (summary)
- Recommended storage: normalized raw rows + derived timeline summary
- Opening/Closing: OPENING_CANDIDATE / LATEST_PRE_GAME / CLOSING_CANDIDATE only
- Dataset status: DESIGN_ONLY; all compliance gates NOT_PASSED
- First probe contract: MLB h2h, ≤12 snapshots, ≤50 credits

### Official conclusion
HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGNED

### Engine connection
PROHIBITED

### Follow-ups
- MLB h2h Historical Coverage Probe after COST/LICENSE gates

---

## 2026-07-28 — Multi-Sport Historical Odds Coverage Audit v1

### Purpose
- Read-only feasibility audit of overseas Historical Odds across BASEBALL / SOCCER / BASKETBALL / VOLLEYBALL

### Scope
- Allowed: documentation + audit JSON; official Odds API docs review; project odds code inventory
- Forbidden: bulk Historical API calls; Dataset Builder; Registry/Framework/Prediction/Engine/Viewer changes; Betman crawl

### Inputs
- The Odds API historical + sports catalog docs
- Project odds providers / MLB odds-history / KBO odds comparison
- Development & Compliance Charter

### Outputs
- `MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDIT_V1.md`
- `MARKET_INTELLIGENCE_RESEARCH_DESIGN.md`
- `data/audits/multi-sport-historical-odds-coverage-audit-v1.json`
- `data/audits/historical-odds-cost-storage-estimate-v1.json`

### Results (summary)
- Service-wide featured historical start 2020-06-06; KBO/NPB earliest documented 2024-03-28
- Volleyball / KBL not on Odds API sports list
- All compliance gates NOT_PASSED; provider conclusion MULTI_PROVIDER_REQUIRED
- Next step recommendation: MLB h2h Historical Coverage Probe only

### Official conclusion
MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDITED

### Engine connection
PROHIBITED

### Follow-ups
- Paid-plan minimal MLB h2h probe after COST/LICENSE gates
- Volleyball licensed odds provider search

---

## 2026-07-28 — Development & Compliance Charter v1

### Purpose
- Publish YANG EDGE development principles as an official charter

### Scope
- Allowed: docs only (`docs/DEVELOPMENT_COMPLIANCE_CHARTER.md` + policy references)
- Forbidden: Prediction / Engine / Dataset / Registry / Framework / Viewer / hash changes

### Inputs
- Mission brief: Development & Compliance Charter v1

### Outputs
- `docs/DEVELOPMENT_COMPLIANCE_CHARTER.md`
- README / DATA_SOURCES / KNOWN_ISSUES / RESEARCH_LOG references

### Results (summary)
- Charter sections 1–15 created
- Compliance Dashboard example states all `NOT_STARTED`
- No code or research artifact changes

### Official conclusion
DEVELOPMENT_COMPLIANCE_CHARTER_V1_CREATED

### Engine connection
PROHIBITED

### Follow-ups
- Populate Compliance Dashboard statuses as legal/tax/security reviews complete

---

## 2026-07-28 — KBO Postgame Result Identity Update v1

### Purpose
- Refresh API-BASEBALL Identity Artifact result region for 2026-07-28 KBO slate

### Scope
- Allowed: provider status / scores / winner / scheduleChanges / resultStatus on API-BASEBALL artifact
- Forbidden: Operator Market / Odds Comparison edits; Prediction / Grade / EDGE; TheSportsDB overwrite; silent startTime overwrite

### Inputs
- Provider: API-BASEBALL league 5 (force refresh)
- Artifact: `data/research/kbo/2026-07-28-schedule-result-identity-v1-api-baseball.json`

### Outputs
- Updated same-file result region
- `data/audits/2026-07-28-kbo-postgame-result-identity-v1-audit.json`
- Docs: `KBO_POSTGAME_RESULT_IDENTITY_V1.md` + identity/readiness/README/KNOWN_ISSUES updates

### Results (summary)
- Games checked: 5
- Final: 0 (provider still `INn` → LIVE)
- Pending: 5
- Identity immutable: PASS
- Prediction / Engine: not implemented / 0

### Official conclusion
KBO_POSTGAME_RESULT_IDENTITY_UPDATED

### Engine connection
PROHIBITED

### Follow-ups
- Re-run `npm run research:kbo-postgame-identity -- 2026-07-28` after provider reports `FT`

---

## 2026-07-28 — KBO Domestic / Overseas Odds Comparison v1

### Purpose
- Compare operator-entered domestic proto odds and lawfully collected overseas odds for the 2026-07-28 KBO slate without generating picks or value judgments.

### Scope
- Allowed: MONEYLINE_2WAY-only comparison dataset, The Odds API provider audit, raw cache, internal preview UI, docs, audit
- Forbidden: Prediction, Confidence, EDGE Score, implied probability, fair odds, value edge, recommendation, Betman crawling, automatic approval

### Inputs
- `data/research/kbo/2026-07-28-schedule-result-identity-v1-api-baseball.json`
- `data/operator-input/kbo/2026-07-28-operator-markets-v2.json`
- The Odds API active KBO sport key `baseball_kbo`

### Outputs
- `data/research/kbo/2026-07-28-odds-comparison-v1.json`
- `data/audits/2026-07-28-kbo-odds-comparison-v1-audit.json`
- `src/app/kbo/odds-preview/page.tsx`
- `src/components/kbo/KboOddsComparisonCard.tsx`

### Results (summary)
- identity games: 5
- domestic games/markets: 5 / 5
- overseas games fetched/matched: 5 / 5
- supported market: MONEYLINE_2WAY only
- comparable games: 0
- market rule unverified: 5
- domestic review status: DRAFT
- warm rerun: resultHash matched, networkCalls 0 on validated cached run

### Official conclusion
- KBO_DOMESTIC_OVERSEAS_ODDS_COMPARISON_READY

### Engine connection
PROHIBITED

### Follow-ups
- Verify overseas baseball market rules before enabling numeric differences
- Keep domestic operator odds in DRAFT until explicit review

---

## 2026-07-28 — KBO Market Result Feedback v1

### Purpose
- Link finalized API-BASEBALL results with pre-game domestic proto and overseas odds for read-only post-game observation.

### Scope
- Allowed: final result + MONEYLINE_2WAY domestic/overseas odds join, direction observation, pipeline readiness report
- Forbidden: Prediction, EDGE PICK, Confidence, ROI, Engine Learning, DRAFT→VERIFIED promotion

### Inputs
- `data/research/kbo/2026-07-28-schedule-result-identity-v1-api-baseball.json` (5 FINAL)
- `data/operator-input/kbo/2026-07-28-operator-markets-v2.json` (DRAFT)
- `data/research/kbo/2026-07-28-odds-comparison-v1.json` (MARKET_RULE_UNVERIFIED)

### Outputs
- `data/research/kbo/2026-07-28-market-result-feedback-v1.json`
- `data/audits/2026-07-28-kbo-market-result-feedback-v1-audit.json`
- `KBO_MARKET_RESULT_FEEDBACK_V1.md`

### Results (summary)
- games checked: 5 / final: 5 / pending: 0
- identity immutable hash: PASS
- domestic/overseas odds: 5 / 5 / both 5
- domestic direction matched: 3 / overseas matched: 3
- domestic/overseas direction agreed: 5 / conflicted: 0
- observation: INSUFFICIENT_SAMPLE
- prediction: NOT_IMPLEMENTED

### Official conclusion
KBO_2026_07_28_MARKET_RESULT_FEEDBACK_COMPLETED

### Engine connection
PROHIBITED

---

## 2026-07-28 — KBO Starter Operator Input v1

### Purpose
- Operator-entered pre-game starter confirmation with validation, cutoff checks, and audit.

### Outputs
- `KBO_STARTER_OPERATOR_INPUT_V1.md`
- `src/lib/kbo/operator-starter/*`
- `scripts/validate-kbo-starter-operator-input-v1.ts`
- `data/operator-input/kbo/templates/starter-confirmation-v1-template.json`

### Results (summary)
- 2026-07-29: no identity → no operator file, audit NOT_ENTERED
- Validator: no auto VERIFIED promotion, stable input hash, regression unchanged

### Official conclusion
KBO_STARTER_OPERATOR_INPUT_V1_READY

### Engine connection
PROHIBITED

---

## 2026-07-28 — KBO Starter Data Source Readiness Audit v1

### Purpose
- Audit lawful pre-game starter availability before any KBO Prediction or Starter Dataset implementation.

### Scope
- Allowed: provider/code/cache audit, MLB reusability classification, operator input schema design, prediction gates
- Forbidden: Prediction, Starter Builder/Adapter, rotation guess, post-game backfill, operator file creation

### Outputs
- `KBO_STARTER_DATA_SOURCE_READINESS_AUDIT_V1.md`
- `data/audits/kbo-starter-data-source-readiness-audit-v1.json`

### Results (summary)
- API-BASEBALL games endpoint: no starter/lineup fields (cache probe 181902, 181906)
- TheSportsDB: no starter fields
- SportsDataIO KBO: unverified; commercial license required
- recommended strategy: HYBRID_PROVIDER_OPERATOR_REQUIRED
- next implementation: KBO Starter Operator Input v1
- KBO Prediction: BLOCKED

### Official conclusion
KBO_STARTER_DATA_SOURCE_READINESS_AUDITED

### Engine connection
PROHIBITED

---

## 2026-07-28 — KBO API-BASEBALL Full Slate Identity Provider v1

### Purpose
- Add a provider-backed full-slate KBO identity path for 2026-07-28 without overwriting the legacy TheSportsDB artifact.

### Scope
- Allowed: KBO identity provider adapter, raw cache, provider selection, crosswalk refs, operator-input identity remap, readiness/validator updates, audits, docs
- Forbidden: Prediction, Engine, EDGE PICK, Viewer, Betman crawling, automatic VERIFIED promotion

### Inputs
- API-BASEBALL KBO league `5`
- existing TheSportsDB KBO artifact `data/research/kbo/2026-07-28-schedule-result-identity-v1.json`
- operator market draft `data/operator-input/kbo/2026-07-28-operator-markets-v2.json`

### Outputs
- `src/lib/kbo/providers/api-baseball-kbo-schedule-provider.ts`
- `src/lib/kbo/kbo-api-baseball-cache.ts`
- `src/lib/kbo/kbo-provider-crosswalk.ts`
- `data/research/kbo/2026-07-28-schedule-result-identity-v1-api-baseball.json`
- `data/audits/2026-07-28-kbo-api-baseball-full-slate-identity-v1-audit.json`
- `data/audits/2026-07-28-kbo-operator-markets-v2-audit.json`
- `data/audits/2026-07-28-kbo-today-slate-readiness-v1.json`

### Results (summary)
- provider games fetched: 5 / dataset games created: 5
- provider IDs verified: `181902` `181903` `181904` `181905` `181906`
- team mapping: 10 matched / 0 unmatched
- providerRefs crosswalk: 3 `API_BASEBALL <-> THESPORTSDB` matches + 2 API-BASEBALL-only refs
- warm rerun: network calls 0 / resultHash matched
- operator market v2: games 5 / markets 40 / selections 90 / matched 5 / unmatched 0 / inputStatus `READY_FOR_OPERATOR_REVIEW`
- readiness: `FULL_COVERAGE` + `RESEARCH_INPUTS_PARTIAL`

### Official conclusion
- KBO_API_BASEBALL_FULL_SLATE_IDENTITY_READY

### Engine connection
PROHIBITED

### Follow-ups
- Keep provider legal status at `NEEDS_LEGAL_REVIEW`
- Do not promote operator review completion into Prediction/Engine activation

---

## 2026-07-27 — Bullpen Role Classifier v1.1

### Purpose
Improve bullpen role classification data quality, reproducibility, and auditability (not hit-rate tuning).

### Scope
- Allowed: classifier v1.1, research cache, audits, docs
- Forbidden: Engine, weights, recommendation, Confidence, EDGE, Value Edge, prediction snapshots

### Inputs
- data/predictions/mlb/2026-07-27-success-flow-review.json
- data/predictions/mlb/2026-07-27-failure-flow-review.json
- data/research/mlb/2026-07-27-bullpen-role-dataset.json (v1, read-only compare)

### Outputs
- data/research/mlb/2026-07-27-bullpen-role-dataset-v1_1.json
- data/audits/2026-07-27-bullpen-role-v1_1-audit.json
- data/audits/2026-07-27-bullpen-role-v1-vs-v1_1.json
- data/cache/research/mlb/{raw,derived}/

### Results (summary)
- rows 524 / unique ~ (see dataset summary)
- starter appearances excluded: 630
- sample&lt;3 confirmed roles: 0 · LONG under 3: 0
- re-run network calls: 0 · result hash matched
- fail bullpen warn 6/6 · success stable 2/5 (research signal only)

### Official conclusion
DATA_QUALITY_IMPROVED_BUT_INCONCLUSIVE

### Engine connection
PROHIBITED

### Follow-ups
- Accumulate more graded days before any Engine review
- Keep MLB Stats API INTERNAL_RESEARCH_ONLY

---

## 2026-07-27 — Starter Dataset v1 (minimal builder)

### Purpose
Freeze prediction-time probable starter identity + pre-cutoff season/recent starts as an internal research dataset (no Score / Engine).

### Scope
- Allowed: starter dataset builder v1, research cache derived/starter, audits, hypothesis rows, registry status→COLLECTING
- Forbidden: Engine, weights, recommendation, Confidence, EDGE, Value Edge, Bullpen v1.1 logic, prediction snapshot mutation, QS, confirmed-as-probable, live season without as-of

### Inputs
- data/predictions/mlb/2026-07-27.json (read-only)
- MLB Stats API schedule hydrate=probablePitcher + people + gameLog (research cache)

### Outputs
- data/research/mlb/2026-07-27-starter-dataset-v1.json
- data/research/mlb/2026-07-27-starter-postgame-review-v1.json
- data/audits/2026-07-27-starter-dataset-v1-audit.json
- data/cache/research/mlb/derived/starter/

### Results (summary)
- games 15 / rows 30 (home 15 + away 15)
- probable 30 / missing 0 · join MATCHED 30
- seasonStats 30 · recentStarts 30 · avg sampleSize 15.8
- target game in stats: 0 · cutoff violations: 0 · confirmed rows: 0
- STARTER_CHANGED reviews: 0 (28+ matched; all probable rows matched boxscore pitchers[0] on this slate)
- warm re-run: raw 61/0 · derived 30/0 · network 0 · resultHash matched
- prediction hash unchanged `28f3e360…`
### Official conclusion
STARTER_DATASET_V1_CREATED_DATA_COLLECTION

### Engine connection
PROHIBITED

### Follow-ups
- Accumulate ≥100 games before PROMISING discussion
- Keep postGameReview annotations separate from pre-game payload
- Do not wire Stats API into public runtime
- Investigate UNLINKED rows (2) for join robustness

---

## 2026-07-27 — Starter Dataset v1 accumulation pipeline

### Purpose
Repeatable date-arg accumulation of pre-game starter freezes + separate post-game reviews without schema/score/Engine changes.

### Scope
- Allowed: accumulation orchestrator, immutable pre-game lock, Final-only MATCHED/CHANGED, AWAITING_RESULT, audit+summary scripts
- Forbidden: schema/seasonStats logic change, Score, Engine, Bullpen, Framework structure, prediction overwrite

### Inputs
- data/predictions/mlb/2026-07-27.json, 2026-07-28.json (read-only)

### Outputs
- scripts/run-mlb-starter-accumulation-v1.ts
- scripts/summarize-mlb-starter-accumulation-v1.ts
- data/research/mlb/2026-07-28-starter-dataset-v1.json (+ postgame review)
- data/audits/2026-07-27-starter-dataset-v1-audit.json (accumulation metrics)
- data/audits/2026-07-28-starter-dataset-v1-audit.json
- data/audits/starter-dataset-v1-accumulation-summary.json

### Results (summary)
- 07-27 pre-game immutable (resultHash `5e44d0ad…`)
- 07-27 postgame: MATCHED 28 / CHANGED 0 / AWAITING 2
- 07-28 new pre-game: 12 games / 24 rows / probable 23 missing 1; warm hash matched; AWAITING 24
- cumulative (summary script, no recompute): 27 games / 54 rows
- prediction hashes unchanged

### Official conclusion
STARTER_DATA_ACCUMULATION_CONTINUES

### Engine connection
PROHIBITED

### Follow-ups
- Re-run postgame when 07-28 finishes and remaining 07-27 games are Final
- Keep accumulating toward ≥100 games before PROMISING

---

## 2026-07-27 — Framework common audit conclusion (Bullpen × Starter)

### Purpose
Record that Research Framework v1 was validated against existing Bullpen and Starter datasets without structural change.

### Results
- Framework validated against Bullpen and Starter datasets
- No structural modification required
- Domain audit schemas intentionally remain independent
- Framework expansion remains frozen

### Official conclusion
FRAMEWORK_APPROPRIATE_AS_IS

### Engine connection
PROHIBITED

---

## 2026-07-27 — Yankees @ Phillies Final pipeline refresh

### Purpose
Reflect the completed Yankees @ Phillies game (last AWAITING_RESULT on 2026-07-27) into Starter postgame, grading, Success/Failure reviews, Bullpen validation, and summaries.

### Scope
- Allowed: postgame review, grade result fields, success/failure flow reviews, bullpen v1.1 rebuild/compare (classifier frozen), validation/daily report/accumulation summaries, RESEARCH_LOG
- Forbidden: pre-game Starter Dataset overwrite, probable backfill, immutable prediction fields, classifier/threshold/Engine/Framework/weights changes

### Inputs
- Stats schedule gamePk 823433 → Final (Yankees 4 @ Phillies 11)
- data/predictions/mlb/2026-07-27.json (result fields only)
- data/research/mlb/2026-07-27-starter-dataset-v1.json (read-only pre-game)

### Outputs
- data/research/mlb/2026-07-27-starter-postgame-review-v1.json (MATCHED 30 / CHANGED 0 / AWAITING 0)
- data/predictions/mlb/2026-07-27.json + `-review.json` (graded 15/15; Yankees MISS)
- data/predictions/mlb/2026-07-27-failure-flow-review.json (Yankees: MULTIPLE_FACTORS; SIGNAL_FAILED=9)
- data/predictions/mlb/2026-07-27-success-flow-review.json (SIGNAL_WORKED=6 unchanged set)
- data/research/mlb/2026-07-27-bullpen-role-dataset-v1_1.json (warm hash `0753ad64…`)
- data/audits/bullpen-v1_1-validation-2026-07-27.json
- data/audits/bullpen-v1_1-daily-report-2026-07-27.{json,md}
- data/audits/bullpen-v1_1-validation-accumulation.json
- data/audits/starter-dataset-v1-accumulation-summary.json

### Results (summary)
- Starter Yankees home/away: STARTER_MATCHED (Will Warren / Cristopher Sánchez)
- Grade: 15 graded · hits 6 · fails 9 · hitRate 40
- Yankees: SIGNAL_FAILED (pick Yankees, winner Phillies 11-4); pitcherDirection CONFLICTS_BASELINE (observation only)
- Bullpen fail warn 7/7 · success stable 2/5 · UNKNOWN rate 51.3% (289/563)
- API-BASEBALL status lagged on IN9 after Stats Final — research results cache FT-corrected for grading only (scores already 11-4)
- pre-game starter file hash unchanged `67e34b66…`
- immutable prediction fields verified unchanged by grade script

### Official conclusion
RESEARCH_PIPELINE_UPDATED

### Engine connection
PROHIBITED

### Follow-ups
- Re-run when 07-28 finishes for cross-day Bullpen/Starter accumulation
- Keep Baseball IN9 lag note; prefer waiting for FT when possible before cache correction

---

## 2026-07-27 — Failure-flow meta.failedGames drift fix

meta.failedGames was hardcoded to 8 in `review-mlb-failed-game-flow.ts` while `games[]` already had 9 rows (incl. Yankees). Synced meta to 9; rows/classifications unchanged. Generator now derives count from `gameReviews.length`; postgame pipeline regenerates failure/success reviews after grade.

### Official conclusion
DERIVED_METADATA_REFRESH_FIXED

---

## 2026-07-27 — Lineup Dataset v1 (minimal builder)

### Purpose
Store post-game actual starting lineups for internal research/review. Separate from pre-game snapshots. No Lineup Score / Engine.

### Scope
- Allowed: boxscore `*00` starters, substitutes array (non-analysis), dataset + audit, Viewer display, H-LU registry rows, docs
- Forbidden: pre-game backfill, battingSide people mass-fetch, Engine/weights/Confidence/EDGE/Value Edge, Starter/Bullpen mutation, Framework structure change, PROJECT_MEMORY

### Inputs
- data/predictions/mlb/2026-07-27.json (read-only hash)
- data/research/mlb/2026-07-27-starter-dataset-v1.json (gamePk join only)
- data/cache/research/mlb/raw/statsapi/api/v1/game/{gamePk}/boxscore.json

### Outputs
- data/research/mlb/2026-07-27-lineup-dataset-v1.json
- data/audits/2026-07-27-lineup-dataset-v1-audit.json
- Research Analysis Viewer: 실제 선발 라인업 section (finished games only)

### Results (summary)
- 15 games / 30 team lineups / 30 COMPLETE / 270 starters
- batting slot dup=0 miss=0 · substitutesSeparated recorded · starters-as-sub=0
- preGameStatus=NOT_COLLECTED · battingSide=0 · peopleApiCalls=0
- first/second resultHash matched `af52186d2bed8e493dd012e220c6c17453570c583d7616f4c9964110d2a9aafb`
- rawHit 15 / rawMiss 0 · warm networkCalls 0
- prediction file hash unchanged
- Engine admission PROHIBITED

### Official conclusion
LINEUP_DATASET_V1_CREATED_DATA_COLLECTION

### Engine connection
PROHIBITED

### Follow-ups
- Define pre-game lineup collection cadence
- Accumulate toward ≥100 games before any PROMISING discussion

---

## 2026-07-27 — Dataset Correlation Audit v1

Dataset Correlation Audit v1: 15 games · Starter MATCHED×15 · Bullpen NEUTRAL/CONFLICTS/SUPPORTS co-occurrence only · Lineup post-game COMPLETE only (pre-game NOT_COLLECTED) · Engine candidate no · `DATASET_CORRELATION_COLLECTION_STARTED`

---

## 2026-07-27 — Contradiction Ledger v1

Contradiction Ledger v1: 7 high-value games · 10 contradiction events (starter 5 / bullpen 5 / lineup 0) · linked H-ST/H-BP only · Engine candidate no · `CONTRADICTION_EVIDENCE_COLLECTION_STARTED`

---

## 2026-07-27 — Contradiction Severity Audit v1

Contradiction Severity Audit v1: 10 events · HIGH 8 / MEDIUM 2 / LOW 0 · H-BP-ROLE-005 highest (5 events, 4 HIGH) · Engine candidate no · `CONTRADICTION_SEVERITY_COLLECTION_STARTED`

---

## 2026-07-27 — Dataset Coverage Dashboard v1

Dataset Coverage Dashboard v1: Starter/Bullpen COLLECTING (15g) · Lineup artifact COLLECTING (registry gap) · Evidence 11 hyp / Contradictions 10 · Engine candidate no · `DATASET_COVERAGE_DASHBOARD_CREATED`

---

## 2026-07-27 — Research Pipeline Automation Audit v1

Research Pipeline Automation Audit v1: 15 manual steps · 6 automation candidates · 8 intentionally manual · pipeline order verified · Engine/Dataset/Framework unchanged · `PIPELINE_AUTOMATION_AUDIT_COMPLETED`

---

## 2026-07-27 — Lineup Registry and Evidence Ledger alignment

Lineup Registry and Evidence Ledger alignment: mlb-lineup registered (registry.ts + registry.json) · H-LU-001…003 added to hypothesis-evidence-ledger (evidence=0) · Coverage Dashboard regenerated · `LINEUP_RESEARCH_REGISTRY_ALIGNED`

---

## 2026-07-27 — MLB Weather Dataset v1 Pre-design Audit

MLB Weather Dataset v1 Pre-design Audit: 27 games venue-mapped 100% via starter+Stats API · coordinates/roof via venue hydrate · NWS+Open-Meteo candidates · no Provider finalized · builder HOLD · `READY_FOR_MINIMAL_WEATHER_DATASET_DESIGN`

---

## 2026-07-27 — MLB Travel / Rest Dataset v1 Pre-design Audit

MLB Travel/Rest Dataset v1 Pre-design Audit: 27 team-slots previous-game 100% in cache window · scheduled rest/travel pre-game OK · actual-end/innings POST_GAME only · haversine distance from venue coords · builder HOLD · `READY_FOR_MINIMAL_TRAVEL_REST_DATASET_DESIGN`

---

## 2026-07-28 — KBO Research Pipeline v1 Pre-design + MLB Common/Difference Audit

### Purpose
Pre-design KBO as first non-MLB research league target without implementing builders/datasets.

### Scope
- Allowed: read-only audits, design docs
- Forbidden: KBO Dataset/Builder/Prediction/Viewer/Registry/Framework/Engine; Betman HTML crawl

### Outputs
- KBO_RESEARCH_PIPELINE_V1_DESIGN.md
- KBO_MLB_COMMON_DIFFERENCE_AUDIT.md
- data/audits/kbo-research-pipeline-v1-pre-design-audit.json
- data/audits/kbo-mlb-common-difference-audit-v1.json

### Results (summary)
- KBO schedule partial via TheSportsDB; no research prediction/datasets
- Providers audited; none finalized; official-site crawl not proposed
- Abstraction: COMMON_EXTRACTION_CANDIDATES_FOUND; Framework unchanged
- First Dataset recommendation: Schedule / Result Identity

### Official conclusion
READY_FOR_KBO_MINIMAL_RESEARCH_DATASET

### Engine connection
PROHIBITED

### Follow-ups
- Next mission: one minimal KBO Dataset after Provider mini-clearance

---

## 2026-07-28 — KBO Schedule / Result Identity Dataset v1

### Purpose
First KBO research Dataset: game identity, schedule, status, and result only.

### Scope
- Allowed: types, builder, script, artifact, audit, registry adapter, docs
- Forbidden: Prediction, Starter, Bullpen, Lineup, Engine, Viewer, Betman crawl

### Outputs
- `data/research/kbo/2026-07-24-schedule-result-identity-v1.json`
- `data/audits/2026-07-24-kbo-schedule-result-identity-v1-audit.json`
- KBO_SCHEDULE_RESULT_IDENTITY_V1.md
- Registry: `kbo-schedule-result-identity` (COLLECTING)

### Results (2026-07-24)
- Provider: TheSportsDB league 4830
- providerGamesFetched: 3 (free-tier limit warning recorded)
- datasetGamesCreated: 3
- teamMappingsMatched: 6 / unmatched: 0
- final: 3 · warm rerun hash matched · networkCalls warm: 0

### Official conclusion
KBO_SCHEDULE_RESULT_IDENTITY_V1_CREATED

### Engine connection
PROHIBITED

---

## 2026-07-28 — KBO Identity Pipeline Architecture Alignment v1

### Purpose
Align KBO Identity collection with Provider/Service/Builder separation without changing dataset semantics.

### Outputs
- Provider interface + TheSportsDB adapter
- Service layer + pure builder refactor
- Feature flag `KBO_IDENTITY_COLLECTION_ENABLED`
- KBO_IDENTITY_PIPELINE_ARCHITECTURE.md
- data/audits/kbo-identity-pipeline-architecture-alignment-v1.json

### Results
- Builder provider-specific references: 0
- 2026-07-24 resultHash regression: matched
- Warm rerun networkCalls: 0
- Redis/WebSocket/polling: not introduced

### Official conclusion
KBO_IDENTITY_PIPELINE_ARCHITECTURE_ALIGNED

### Engine connection
PROHIBITED

---

## 2026-07-28 — Soccer Research Pipeline v1 Pre-design Audit

### Purpose
Audit soccer as the first non-baseball sport research target without implementing builders, datasets, predictions, grading, engine, or viewer wiring.

### Scope
- Allowed: read-only code/doc/provider audit, design docs, audit JSON
- Forbidden: Betman crawl, Builder/Dataset/Prediction/Grade/Engine/Viewer implementation

### Outputs
- SOCCER_RESEARCH_PIPELINE_V1_DESIGN.md
- MLB_KBO_SOCCER_COMMON_DIFFERENCE_AUDIT.md
- `data/audits/soccer-research-pipeline-v1-pre-design-audit.json`
- `data/audits/mlb-kbo-soccer-common-difference-audit-v1.json`

### Results
- Current soccer code = schedule/provider/team-mapping/odds listing only
- No soccer research dataset, registry row, prediction snapshot, or grading pipeline
- Recommended first Dataset: Soccer Schedule / Result Identity v1
- Multi-sport conclusion: common lifecycle/meta design candidates found, Framework unchanged

### Official conclusion
READY_FOR_SOCCER_MINIMAL_RESEARCH_DATASET

### Engine connection
PROHIBITED

---

## 2026-07-29 — Betman Daily Full-Slate Coverage and Minimum Analysis v1

### Purpose
Register all Betman-scheduled baseball/soccer/basketball/volleyball games for a KST date in one Daily Slate; match Provider Identity; assign minimum analysis level without new Prediction Engine work.

### Scope
- Allowed: operator input schema, validator, identity matching, analysis resolver, artifact, audit, internal API
- Forbidden: Betman crawl, OCR auto-save, forced predictions, public UI, tennis support, Engine changes

### Outputs
- BETMAN_DAILY_FULL_SLATE_COVERAGE_V1.md
- `src/lib/betman/daily-slate/*`
- `src/lib/research/daily-slate/resolve-minimum-analysis-level.ts`
- `scripts/validate-betman-daily-slate-v1.ts`
- `src/app/api/research/daily-slate/route.ts`
- `data/operator-input/betman/templates/daily-slate-v1-template.json`

### Results
- Initial run without operator input: `NOT_ENTERED`, 0 games, `analysisCoverageRate = null`
- Basketball/Volleyball: `IDENTITY_PROVIDER_NOT_IMPLEMENTED`
- Viewer deferred to next phase

### Official conclusion
BETMAN_DAILY_FULL_SLATE_COVERAGE_V1_READY

### Engine connection
PROHIBITED

---

## 2026-07-28 — KBO Today Slate and Odds Readiness v1

### Purpose
Operational/readiness audit before any KBO line-making work: confirm known provider games, manual Betman scope status, proto odds input status, and current analysis blockers.

### Scope
- Allowed: identity reuse, read-only readiness audit, operator input templates, docs
- Forbidden: KBO Prediction / Engine / EDGE PICK / crawling / auto odds collection

### Outputs
- `data/audits/2026-07-28-kbo-today-slate-readiness-v1.json`
- KBO_TODAY_SLATE_READINESS_V1.md
- operator templates under `data/operator-input/kbo/templates/`

### Results
- targetDate: 2026-07-28
- providerCoverage: PARTIAL_COVERAGE
- identityGames: 3
- betmanScope: NOT_ENTERED
- protoOdds: NOT_ENTERED
- analysisReadiness: IDENTITY_ONLY

### Official conclusion
KBO_TODAY_SLATE_READINESS_CREATED

### Engine connection
PROHIBITED

---

## 2026-07-28 — KBO Operator Scope and Proto Odds Input v1

### Purpose
Validate manual Betman scope input and proto odds input against existing KBO identity artifacts without generating predictions or recommendations.

### Scope
- Allowed: JSON file schema, validator CLI, audit, readiness integration
- Forbidden: crawling, OCR auto-save, Prediction, Engine, EDGE PICK, UI wiring

### Outputs
- `src/lib/kbo/operator-input/kbo-operator-input-types.ts`
- `src/lib/kbo/operator-input/validate-kbo-operator-input.ts`
- `scripts/validate-kbo-operator-input-v1.ts`
- `data/audits/2026-07-28-kbo-operator-input-v1-audit.json`
- KBO_OPERATOR_INPUT_V1.md

### Results
- Current 2026-07-28 operator files: not entered
- inputReadyStatus: NOT_ENTERED
- readiness integration preserved max state at IDENTITY_ONLY
- no prediction or engine side effects

### Official conclusion
KBO_OPERATOR_INPUT_V1_READY

### Engine connection
PROHIBITED

---

## 2026-07-28 — KBO Operator Market Input v2

### Purpose
Unify manual KBO operator input into Game -> Market -> Selection structure and store screenshot transcriptions as DRAFT only.

### Scope
- Allowed: v2 types, validator, draft JSON input, readiness integration, docs
- Forbidden: OCR automation, Prediction, Engine, EDGE PICK, unmatched fake IDs

### Outputs
- `data/operator-input/kbo/2026-07-28-operator-markets-v2.json`
- `src/lib/kbo/operator-input-v2/kbo-operator-market-input-types.ts`
- `src/lib/kbo/operator-input-v2/validate-kbo-operator-market-input-v2.ts`
- `scripts/validate-kbo-operator-market-input-v2.ts`
- `data/audits/2026-07-28-kbo-operator-markets-v2-audit.json`
- KBO_OPERATOR_MARKET_INPUT_V2.md

### Results
- games: 5
- markets: 40
- selections: 90
- identity matched: 3
- identity unmatched: 2
- inputStatus: PARTIALLY_MAPPED

### Official conclusion
KBO_OPERATOR_MARKET_INPUT_V2_READY

### Engine connection
PROHIBITED

---

## 2026-07-28 — KBO Full Slate Identity Coverage Audit v1

### Purpose
Read-only audit to determine how to obtain provider-backed identity for the two KBO games missing from current TheSportsDB coverage.

### Scope
- Allowed: provider capability audit, direct coverage verification, docs, audit JSON
- Forbidden: identity row creation, operator input mutation, registry/framework/provider implementation

### Outputs
- KBO_FULL_SLATE_IDENTITY_COVERAGE_AUDIT_V1.md
- `data/audits/2026-07-28-kbo-full-slate-identity-coverage-audit-v1.json`

### Results
- TheSportsDB free coverage remains 3 games only
- API-BASEBALL query verified all 5 KBO games on 2026-07-28 with stable provider game ids
- Missing games verified: Samsung vs KIA, SSG vs Doosan
- Recommendation: use alternative provider-backed identity, not invented ids

### Official conclusion
KBO_FULL_SLATE_IDENTITY_COVERAGE_AUDITED

### Engine connection
PROHIBITED
