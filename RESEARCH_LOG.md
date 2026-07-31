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

## 2026-07-31 — Pregame Input Integrity Guards v1

### Purpose
Add odds format contract, schedule detailedState, timestamp separation, officialStatus schema, regression tests. Do not rewrite 01:28 Pregame artifacts.

### Scope
- Allowed: code guards, tests, historical format audit annotation, .gitignore for regenerable research raw/derived cache, docs
- Forbidden: Engine/weight/threshold, 01:28 snapshot regeneration, PASS→Pick, git commit/push

### Results (summary)
- `normalizeOddsPrice` / `inspectBookmakersFormat` / `FORMAT_MISMATCH` collection status
- Schedule stores `statusDetailed` + `codedGameState`
- Starter/lineup/odds additive timestamp fields; starter no longer copies prediction time into `sourceTimestamp`
- Prediction additive `officialStatus` / `officialPick` / `passReasons` / `researchBaseline`; summary.PASS uses officialStatus
- Historical audit: `data/audits/2026-07-31-odds-format-integrity-audit-v1.json`
- Tests: `npm run test:odds-format`, `npm run test:pregame-eligibility` PASS

### Official conclusion
CODE_GUARD_ADDED · historical official PASS unchanged · Leakage NONE

### Engine connection
PROHIBITED

### Follow-ups
- Remaining-pregame scheduler still deferred
- Full Prediction artifact backfill of officialStatus not required
- Tracked `mlb-game-results` cache policy still open

---

## 2026-07-31 — Remaining 3 Pregame Analysis Immediate Run v1

### Purpose
Re-collect Schedule → Starter → Odds → Lineup → Prediction → Pregame Audit for remaining gamePk 824974 / 823271 / 823921 before first pitch.

### Scope
- Allowed: remaining-pregame refresh, revision copies, cache content refresh (schedule/odds overwrite in place), PASS recording
- Forbidden: Engine/weight/threshold change, Dataset/Hypothesis promotion, postgame grade, git commit/push, full cache wipe, prediction backfill after start

### Inputs
- Live status at collection: Warmup (824974, 823271) / Pre-Game (823921); all `now < commenceTimeUtc`
- runId (canonical): `2026-07-31T01-28-11-004Z` · collectionStartedAt `2026-07-31T01:28:11.004Z` (KST 10:28)
- Prior morning run preserved under `*.rev-2026-07-31T00-53-46-838Z` and intermediate `*.rev-2026-07-31T01-24-23-520Z`

### Outputs
- `data/research/mlb/2026-07-31-remaining-pregame-v1.json`
- schedule / starter / odds / lineup / daily-research (+ revisions)
- `data/predictions/mlb/2026-07-31.json` (eligible 3 updated; prior 7 restored)
- cutoff audit + collection summary

### Results (summary)
- Slate: PREGAME_ELIGIBLE 3 / EXCLUDED_ALREADY_STARTED 7
- Starter: 6/6 probable for remaining 3 (Sonny Gray / Mason Barnett; Robbie Ray / JP Sears; Bryan Woo / Roki Sasaki) — PROBABLE_ONLY
- Odds independent refresh: PARTIAL (moneyline incomplete near start) for all 3 — morning COLLECTED retained only in revision
- Lineup: NOT_RELEASED / not confirmed for all 3
- Official analysis: **PASS × 3** (no officialPick) · reasons include LINEUP_NOT_CONFIRMED, MARKET_NOT_AVAILABLE, baselineStatus=INSUFFICIENT
- Observation baselinePick present but **not** official
- Cutoff/Leakage audit on remaining sample: PASS · leakageFailures=0
- Engine unchanged

### Official conclusion
PASS_RECORDED · PARTIAL_COLLECTION (odds PARTIAL; lineup NOT_RELEASED)

### Engine connection
PROHIBITED

### Follow-ups
- After FINAL: `npm run review:mlb-daily -- 2026-07-31` (postgame only)
- Remaining-pregame automation design (T-90/T-60/T-45/T-30) — design only this mission
- Stats/Odds research cache TTL / force-refresh for near-first-pitch runs

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

## 2026-07-29 — KBO Research Readiness & Betting Line Integrity v1

### Purpose
KBO 경기 전 분석 준비 상태 확인. Domestic Odds 파이프라인 감사 및 Research Lab 연동.

### Scope
- Allowed: Reader KBO artifact 로드, Presenter KBO readiness, Assistant KBO 답변 개선, Bug Board, Prediction Lock, System Detail KBO pipeline
- Forbidden: Engine, Prediction, Review, MLB artifact 변경

### Outputs
- `docs/KBO_RESEARCH_READINESS_V1.md` — specification
- Reader에 KBO odds/schedule/starter artifact 로드 추가
- Presenter에 kboReadiness 필드 추가
- OperatorHome에 KBO Ready, Bug Board, Prediction Lock UI
- SystemDetail에 KBO Betting Line Pipeline 섹션
- Assistant KBO readiness 답변이 실제 artifact 기반으로 동작

### Results
- Root cause: Reader에 KBO 로드 없었음. 해결 완료.
- 2026-07-29: Schedule 5경기, Starter 5경기, Odds Comparison 미생성 → PARTIAL
- Prediction Lock: Domestic Odds Missing
- Bug Board: domestic-odds-missing (RED for 07-29), doubleheader-lifecycle, mlb-review, starter-pipeline
- Doubleheader lifecycle: POSTPONED 상태 표시, 자동 RESCHEDULED 감지는 향후

### Conclusion
KBO Research Readiness v1 구현 완료. Build PASS. Engine/Prediction/Grade/Review/Dataset 변경 없음.

---

## 2026-07-29 — EDGE Assistant v0

### Purpose
규칙 기반 Research Operations Assistant. 현재 Artifact 상태와 Task 상태로 운영자에게 안내.

### Scope
- Allowed: Rule-based presenter, client-side question UI, Artifact/Task state reading
- Forbidden: External LLM, free-text input, Pipeline execution, Artifact modification

### Outputs
- `src/lib/internal/edge-assistant-presenter.ts` — Brief + 6 question answer builders
- `src/components/internal/research/EdgeAssistantCard.tsx` — Client UI
- `docs/EDGE_ASSISTANT_V0.md` — specification

### Results
- 6 supported questions with deterministic answers
- Task state integration (IN_PROGRESS priority boost, OPEN+COMPLETED warning)
- KBO readiness: UNKNOWN (Reader는 MLB만 지원)
- Change detection: Snapshot 비교 없어 diff 불가, 현재 상태만 표시
- Glossary for developer terms

### Conclusion
EDGE Assistant v0 구현 완료. Build PASS. Engine/Prediction/Grade/Review/Dataset 변경 없음.

---

## 2026-07-29 — Research Lab Task State Persistence v1

### Purpose
운영 홈 Task에 사용자 상태 관리 기능 추가 (localStorage 전용).

### Scope
- Allowed: localStorage persistence, client-side state, UI controls, filters, memos
- Forbidden: Server storage, DB, API routes, Engine/Prediction changes

### Outputs
- `src/lib/internal/research-task-state.ts` — localStorage CRUD
- `src/hooks/useResearchTaskState.ts` — React hook (useSyncExternalStore)
- `src/components/internal/research/OperatorTaskList.tsx` — Task list with filters, controls, memos
- `docs/RESEARCH_LAB_TASK_STATE_V1.md` — specification

### Results
- Storage key: `yang-edge:research-lab-task-state:v1`
- Task key: `targetDate:taskType:relatedEntityId`
- userStatus: TODO / IN_PROGRESS / ACKNOWLEDGED / DEFERRED / COMPLETED
- systemStatus: OPEN / RESOLVED / STALE / UNKNOWN (from artifacts)
- Filters: 전체 / 해야 할 일 / 진행 중 / 보류 / 완료 / 자동 해결
- Progress summary with completion rate
- Memo support (300 chars)
- Date separation, reset per date, corrupted storage fallback

### Conclusion
Task state persistence 구현 완료. Build PASS. Artifact reader/presenter 미변경 (taskKey 필드만 추가). Engine/Prediction/Grade/Review 영향 없음.

---

## 2026-07-29 — Research Lab Operator Home v1 + Postponed Game Audit

### Purpose
1. Add operator-friendly home view to Research Lab (운영 홈 / 시스템 상세 tabs)
2. Audit and fix mlb-179616 (Braves @ Mets) postponed status

### Scope
- Allowed: new operator view, component refactoring, postponed status update for mlb-179616
- Forbidden: Engine changes, prediction immutable field changes, Value Edge formula changes

### Outputs
- `src/app/internal/research/page.tsx` (rewritten with view tabs)
- `src/components/internal/research/OperatorHome.tsx`
- `src/components/internal/research/SystemDetail.tsx`
- `src/lib/internal/research-lab-presenter.ts`
- `src/lib/internal/research-lab-reader.ts` (updated: POSTPONED/CANCELLED counting, task rules)
- `data/predictions/mlb/2026-07-29.json` (mlb-179616: pending → postponed)
- `docs/RESEARCH_LAB_OPERATOR_HOME_V1.md`

### Results
- Operator home with 6 sections in Korean
- System detail preserves all v0 information
- mlb-179616: resultStatus=postponed, postponementReason=WEATHER_POSTPONEMENT
- 15 existing grades unchanged, prediction hash preserved
- Task generation: POSTPONED → "재편성 확인" (not "재채점")
- Build: PASS

### Official conclusion
RESEARCH_LAB_OPERATOR_HOME_V1_COMPLETE

### Engine connection
PROHIBITED

---

## 2026-07-29 — YANG EDGE Research Lab Dashboard v0

### Purpose
Internal read-only dashboard for monitoring research pipeline status at `/internal/research`.

### Scope
- Allowed: new internal route, artifact reader, summary display
- Forbidden: data modification, pipeline execution, authentication, public navigation changes

### Outputs
- `src/app/internal/research/page.tsx`
- `src/lib/internal/research-lab-reader.ts`
- `docs/RESEARCH_LAB_DASHBOARD_V0.md`

### Results
- 10 sections: header, date, summary, pipeline, tasks, missed items, starter health, review queue, commands, artifacts
- Auto-generated tasks from artifact state
- Read-only confirmed, no public navigation impact
- Build: PASS

### Official conclusion
RESEARCH_LAB_DASHBOARD_V0_COMPLETE

### Engine connection
PROHIBITED

---

## 2026-07-29 — MLB Automatic Postgame Result and Grading

### Purpose
Collect Provider results for 2026-07-29 KST MLB 16-game slate, join with existing Prediction Snapshot, and produce deterministic grades (HIT/MISS/PENDING/INCONCLUSIVE).

### Scope
- Allowed: existing `research:postgame` pipeline (grade + failure flow + success flow + feedback/learning refresh)
- Forbidden: new Prediction, Engine weight changes, automatic failure cause confirmation

### Outputs
- `data/predictions/mlb/2026-07-29.json` (graded in-place)
- `data/predictions/mlb/2026-07-29-review.json`
- `data/predictions/mlb/2026-07-29-failure-flow-review.json`
- `data/predictions/mlb/2026-07-29-success-flow-review.json`
- `data/predictions/2026-07-29-mlb-review.json` (feedback mirror)
- `data/learning/dashboard.json`

### Results
- games: 16, graded: 15, pending: 1 (Mets @ Braves)
- hits: 7, misses: 8, accuracy: 46.7%
- BASELINE_CANDIDATE: 2 (Reds HIT, Red Sox MISS)
- MARKET_CONFLICT: 2 (Padres HIT, Dodgers MISS)
- strict EDGE PICK: 0, research candidates: 0 (no TODAY EDGE PICK for this date)
- value edge source: 12/16 games have `openingOdds: null` → `VALUE_EDGE_SOURCE_UNVERIFIED` for those
- prediction hash preserved: yes (`5eeffd78…`)
- result source: API-BASEBALL (2 calls, cache reuse)
- immutable field verification: passed

### Official conclusion
MLB_2026_07_29_AUTOMATIC_POSTGAME_GRADED

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

---

## 2026-07-31 — MLB Remaining Pregame Accumulation

### Purpose
- Capture remaining pre-first-pitch MLB research inputs for KST 2026-07-31 before games start
- Preserve Schedule → Starter → Odds → Lineup → Prediction artifacts without Engine changes

### Scope
- Allowed: existing collectors; remaining-pregame eligibility; cutoff audit; collection summary; revision preservation
- Forbidden: Engine/weight changes; auto hypothesis promotion; post-start lineup backfill as pre-game; forcing official predictions when inputs incomplete

### Inputs
- collectionStartedAt: `2026-07-31T00:53:46.838Z` (KST 2026-07-31 09:53)
- runId: `2026-07-31T00-53-46-838Z`
- CLI: `npm run research:mlb-remaining-pregame -- 2026-07-31`

### Outputs
- `data/research/mlb/2026-07-31-remaining-pregame-v1.json`
- `data/research/mlb/2026-07-31-schedule-v1.json` (+ schedule/lineup `.rev-2026-07-31T00-53-46-838Z` preserved)
- `data/research/mlb/2026-07-31-starter-dataset-v1.json`
- `data/research/mlb/2026-07-31-odds-history-dataset-v1.json`
- `data/research/mlb/2026-07-31-lineup-dataset-v1.json`
- `data/research/mlb/2026-07-31-daily-research-summary-v1.json`
- `data/predictions/mlb/2026-07-31.json`
- `data/research/mlb/2026-07-31-pregame-cutoff-audit-v1.json`
- `data/research/mlb/2026-07-31-pregame-collection-summary-v1.json`

### Results (summary) — VERIFIED from artifacts
- Slate: 10 · PREGAME_ELIGIBLE: 3 · EXCLUDED_ALREADY_STARTED: 7
- Eligible gamePk: 824974 (BOS @ Athletics), 823271 (SF @ Padres), 823921 (SEA @ Dodgers)
- Starter: 10 games / 20 rows · probable 16 · missing/partial 4
- Odds: 6 COLLECTED / 4 NOT_COLLECTED · Eligible odds 3/3 COLLECTED
- Lineup: 10/10 NOT_RELEASED · Eligible lineup 3/3 NOT_RELEASED
- Prediction snapshot rows: 10 · official `inputStatus=ELIGIBLE`: 0 · `BASELINE_CANDIDATE`: 0
- Remaining-pregame audit finalStatus PASS: 3 (not official eligible predictions)
- Research Ready: 61%
- Cutoff failures: 0 · Leakage failures: 0 · Engine changes: 0 · auto promotion: NONE

### PASS / baseline pick policy
- PASS is an official analysis state (insufficient confirmed inputs), not a missing run
- Snapshot may still store a baseline pick string for research observation only
- baseline pick is **not** an official prediction and must not enter official hit-rate
- Do not rewrite PASS → ELIGIBLE after results are known

Eligible observation picks (research only):
- 824974 → Athletics (lineup unconfirmed + starter partial)
- 823921 → Seattle Mariners (lineup unconfirmed)
- 823271 → San Diego Padres (lineup unconfirmed + starter partial)

### Official conclusion
DATA_ACCUMULATION_CONTINUES

### Engine connection
PROHIBITED

### Follow-ups
- Postgame: Official Result → Grade → Success/Failure Review (official eligible prediction remains 0)
- Optional research-only baseline observation compare — never official accuracy
- Safe final re-collect window for confirmed lineups (still pre-start only)

---

## 2026-07-31 — MLB Postgame Grade & Research Review (partial)

### Purpose
- Collect official finals for 2026-07-31 slate and run Grade → Success/Failure → Leakage → Daily Review
- Validate Remaining Pregame snapshot without Engine / weight / threshold / promotion changes

### Scope
- Allowed: `result:mlb` / `grade:mlb` / `review:mlb` artifacts; Result Collector score-source fix (schedule scores vs stale empty boxscore cache)
- Forbidden: Engine weights; Dataset/Hypothesis promotion; rewriting PASS → ELIGIBLE; treating LIMITED_INPUT hits as official accuracy

### Timing
- Review run ~2026-07-31 10:13 KST (`2026-07-31T01:13Z`)
- Remaining Pregame games (824974, 823271, 823921) still NOT_FINAL at review time

### Official Result — VERIFIED
- Artifact: `data/research/mlb/2026-07-31-official-results-v1.json`
- FINAL 4 / NOT_FINAL 6
- FINAL scores (schedule gamePk source after collector fix):
  - 822946 TEX 2 @ TB 3 (HOME)
  - 823023 CHC 4 @ STL 2 (AWAY)
  - 823674 KC 3 @ MIN 4 (HOME)
  - 824568 NYY 1 @ CWS 2 (HOME)
- HIGH finding: stale boxscore cache had batting.runs=0; collector now prefers schedule scores for FINAL

### Grade — VERIFIED
- Artifact: `…-graded-predictions-v1.json`
- Official `inputStatus=ELIGIBLE`: **0** → official accuracy **N/A** (`NO_GRADED_SAMPLE` for eligible)
- Snapshot PASS/INSUFFICIENT baseline is **not** official prediction
- LIMITED_INPUT observation grades (already-started-at-collection games; **not official hit-rate**): graded 4 · correct 3 · incorrect 1 · 75%
- BLOCKED 3 · PENDING 3 (remaining pregame) · VOID 0 after score fix
- Remaining Pregame three: all PENDING / RESULT_NOT_FINAL

### Success Review — VERIFIED
- Artifact: `…-success-review-v1.json` · games: 3 (LIMITED_INPUT observation only)
- Factors: INPUT_QUALITY CONFOUNDED; MODEL_PROBABILITY INSUFFICIENT_EVIDENCE; STARTER_SIGNAL POSSIBLE_SUPPORT only
- No variable verified / no Engine recommendation

### Failure Review — VERIFIED
- Artifact: `…-failure-review-v1.json` · games: 1 (823023 STL pick, CHC won)
- possibleCauses: DATA_QUALITY POSSIBLE; BULLPEN POSSIBLE
- conclusion: INVESTIGATE_MORE · Devil’s Advocate / alternative hypothesis recorded

### Input Audit — VERIFIED
- Pregame remaining 3: LIMITED_INPUT · LINEUP_NOT_CONFIRMED (+ starter partial on 2)
- BLOCKED 3: ODDS_AFTER_CUTOFF (started before collection)
- FINAL 4 observation rows: LINEUP_NOT_CONFIRMED · MARKET_NOT_AVAILABLE (collection-time already started / odds gaps)
- predictedAt `2026-07-31T00:54:00.284Z` before remaining first pitches

### Leakage Audit — VERIFIED
- Status: **WARN** (not FAIL)
- prediction hash: PASS · predicted vs slate cutoff: PASS
- WARN: input manifest blocked/post-game style warnings (ODDS_AFTER_CUTOFF on blocked games)
- No evidence FINAL lineup/odds/stats were used as pregame features for remaining-pregame sample
- reviewStatus: **PARTIAL_REVIEW**

### Daily Review Summary — VERIFIED
- Artifact: `…-daily-review-summary-v1.json`
- Eligible: 0 · PASS/INSUFFICIENT official eligible: 0 · Graded observation: 4 · Correct 3 · Incorrect 1
- Official accuracy: null · Conclusion: **DATA_ACCUMULATION_CONTINUES**
- Engine changed: false · no auto promotion

### Official conclusion
DATA_ACCUMULATION_CONTINUES · PARTIAL_REVIEW

### Engine connection
PROHIBITED

### Follow-ups
- Re-run `review:mlb-daily -- 2026-07-31` after remaining 3 games FINAL
- Align grader messaging: official accuracy uses ELIGIBLE only; LIMITED_INPUT stays observation
- Research Log Backfill still pending for mixed 07-29 entries
- Result boxscore cache freshness / schedule-score primary path keep
