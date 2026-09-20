# Football Research Depth V1 — 2026-09-20

Base: `7f274a341873edff08e740045524fe9d8d8aea06`. Explicit batch `round-111-odds-new-v1`. Owner-local display only; no deployment or main merge.

## Outcome and limitation

All 31 Football targets and all 50 research lines remain visible. Before and after: FULL 0, STANDARD 2, BASIC 29. BASIC→STANDARD 0; STANDARD coverage 6.45%. This mission improves verified research depth and the reusable admission path; it does not claim new target coverage or invented upgrades.

The 29 BASIC targets have no complete exact provider identity bridge in the existing committed evidence. Existing aliases, provider team catalog and the prior remaining-football-readiness audit were inspected. Several targets have only one team ID. Partial IDs, similar names, competition/kickoff slots, or known English translations do not authorize a complete fixture join. More history calls cannot resolve that identity gap safely. The old prediction pipeline's `PENDING_UNSUPPORTED_LEAGUE` does **not** establish that the provider lacks research coverage; no such claim is made here.

Next common data mission: review and admit an exact competition/team/fixture identity source for these 29 targets, then reuse the generic team-history projection. Do not repair pages individually or promote teams by label. Per-target evidence and five gap categories are in `data/audits/2026-09-20-football-research-depth-v1.json`.

## Standard contract

STANDARD requires exact identity plus nonempty verified current-season histories for both teams, from which W/D/L, GF/GA, last5/last10 and venue splits are derived. Zero venue appearances are displayed explicitly. A 2–5 sentence summary, engine availability, table UNKNOWN or separately observed table, and quality gaps complete the display. Prediction, XI, injuries, players, V4 and picks are not required. A regression test removes the canonical preview and probability and still admits valid team research via an independent exact identity proof.

FULL is not admitted by this mission. No missing advanced/player/tactical/availability evidence is inferred. SMALL_SAMPLE means fewer than five observed venue games; it is a display label only, not an engine threshold or fit rule.

## Sources, freshness and provenance

Existing local canonical preview and exact committed identity proofs are reused. A source manifest pins context and identity SHA256; raw receipt bytes are hashed again before projection. API raw files stay outside Git in the private inbox. The projection reconstructs rows from verified raw receipts rather than trusting mutable derived history fields.

Two approved API-Football calls refresh Manchester City and Sunderland: current season 2026, same league/team, FT only, January 1 through September 20. No target-fixture endpoint, standings refresh, live endpoint, retries, new provider or crawler. Both requests were observed before target kickoff. City changes from 3 to 4 current-season games; Sunderland stays at 4. The omitted City fixture is detected by exact fixture-ID set difference. Atlético/Real reuse the same-day receipt already covering six current-season games each. Standings for both showcases reuse existing hashed receipts and show their independent observation times.

Recent-form completeness means all rows returned by the season/team FT query at its actual observation time. It is not a promise that later provider corrections or matches are monitored. The UI labels this limitation. No observedAt is backdated. Current-season and previous-season context remain separate. Canonical V1 input, probabilities, and historical window remain untouched.

Provider calls for this mission: 2. Separate Preview request cap: 2. V4 reserved budget used: 0. V4 collector/job configuration changed: NO. Research observations and derived display fields are not admitted model features. Existing conditional internal-use rights remain unchanged; no public raw data rights are claimed.

## User-facing changes

Universal Football pages put research quality, model availability, current season, recent form, venue splits, table and readable summary before optional player context. Last5 shows actual historical W/D/L and score in team perspective. Current-season samples shorter than 5/10 stay short. Standings have their own time label; missing standings remain UNKNOWN.

Explorer cards show season record, recent sequence and summary where verified. Missing probabilities remain NOT_AVAILABLE. Both showcase probabilities are exactly preserved: Atlético/Real 42.20 / 25.79 / 32.01; City/Sunderland 72.36 / 18.07 / 9.57. Pick remains separate and optional. No player selection formula changed.

## Validation

80 tests across six suites PASS, including 13 depth-specific tests. Full typecheck PASS. Guards cover target-score getters, live status before score access, post-cutoff observation, previous-season exclusion, conflicting duplicates, no-Prediction/no-XI admission, missing probability, summary provenance, deterministic gaps and old showcases. Private local artifacts are required for integration tests.

Chromium desktop 1280: 31 Football rows, scrollWidth1265. Mobile390: list and detail scrollWidth375. A long technical quality code initially overflowed; wrapping was fixed and rechecked. Actual City detail shows four current-season games, separate engine/preview clocks, historical result sequence, venue sample size, timestamped table and summary. No target outcome or live information was fetched.

## Handoff

Use the source manifest and independent exact identity proof contract for further lawful data admission. Generate summary/tier with the shared projection; do not manually edit per-match output. Audit command: `node --import tsx scripts/audit-football-research-depth-v1.ts`. The attended collector is immutable and refuses an existing context; do not rerun it to overwrite evidence. No background watch/service is installed.

## ENGINE STATUS

OFFICIAL_ENGINE=V1
OFFICIAL_MODEL=football-poisson-research-v1
OFFICIAL_ENGINE_CHANGED=NO
RESEARCH_V2_H2_STATUS=RESEARCH_UNPROMOTED
V3_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_FEATURES=xG / Total Shots / Shots on Goal
V3_PROMOTED=NO
V3_1_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_1_HOLDOUT=SCREEN_NO
V3_1_PROMOTED=NO
V4_STATUS=PROSPECTIVE_EVIDENCE_READY
V4_PHASE=0.5
V4_IMPLEMENTED_COMPONENTS=Registry / Membership / Evidence Foundation
V4_ENGINE_IMPLEMENTED=false
V4_ADMISSION_ALLOWED=false
REAL_PREDICTION_COUNT=45 unique; last verified 2026-09-20T04:28:57.536Z; mission new=0
GRADED_PREDICTION_COUNT=15 artifacts, last verified at same time; no outcomes re-read
CURRENT_SAMPLE_SIZE=15 last-verified graded count; no new evaluation denominator audit
LATEST_BACKTEST=existing sealed research; no rerun
LATEST_HOLDOUT=V3.1 SCREEN_NO
PROMOTION_GATE_STATUS=NO_NEW_PROMOTION
ENGINE_WEIGHTS_CHANGED=NO
ENGINE_THRESHOLDS_CHANGED=NO
FEATURE_SET_CHANGED=NO

## PROGRESS

TODAY_PROGRESS=100% of executable depth mission; external identity admission remains waiting
OVERALL_PROGRESS=72% owner baseline
TODAY_DELTA=+0%p; research display depth is not an engine promotion
CURRENT_PHASE=V4_PHASE_0.5_PROSPECTIVE_EVIDENCE_READY
CURRENT_ENGINE=V1
NEXT_ENGINE=V4
NEXT_MILESTONE=exact identity admission for remaining 29 Football targets
COMPLETED_TODAY=shared team-depth admission; City omission recovery; existing table reuse; summaries; 31-target gap audit; tests and browser validation
BLOCKED_BY=PROVIDER_IDENTITY_UNRESOLVED for 29 targets
WAITING_FOR=verified competition/team/fixture identity evidence
