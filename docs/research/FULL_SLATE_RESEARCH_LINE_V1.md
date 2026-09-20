# 2026-09-20 Full Slate Research Line V1

PRODUCT_CORE=SPORTS_RESEARCH_AND_ANALYSIS. Research first, prediction second, pick optional. LOCAL_OWNER_ONLY; no public deployment.

## Authoritative scope and coverage

Explicit batch `round-111-odds-new-v1`, date `2026-09-20`. Scope SHA256 `ee07df7cc50a0ab21ed7d228cd585f22777c92a5c5ab0cc7e43fe8cbce87ccbd`. Batch manifest and scope/source bytes are checked against committed evidence. Source hash and each target identity are reconciled. No date-only batch discovery.

50 targets = Soccer31 + Baseball11 + Basketball3 + Volleyball5. Research lines50, FULL0, STANDARD2, BASIC48, BLOCKED0, targetWithoutLine0. This is research-display coverage, not terminal prediction/PASS completion. One existing sealed PASS remains visible; this task creates no Prediction or PASS. Unsupported leagues and already-started targets remain visible without fetching their results.

Quality is deterministic from connected evidence. FULL needs every declared layer, including lineup and availability. STANDARD requires current/recent context, venue/player evidence and engine state. BASIC retains authoritative identity, explicit missing fields, model state and observed market evidence. Null probability remains NOT_AVAILABLE. Optional enrichment failure cannot silently drop targets: unavailable market/player evidence produces quality warnings and preserves all 50 lines. Invalid authoritative source/scope fails the gate instead of inventing identity.

## Routes and product

Owner homepage renders Today's Research counts, Featured Research, the complete Explorer, Engine Research, then Optional Pick. The old public/non-owner homepage remains gated from private data. `/research?batch=round-111-odds-new-v1&date=2026-09-20` is the standalone Explorer. Detail links retain batch and date explicitly. The existing `/analysis/BETMAN-20260920-91?fromDate=2026-09-20` and City route also use the common template under the explicitly configured active batch; this is a fixed batch selection, not a date search.

Filters: sport, competition, tier. Sort: kickoff ascending, or canonical HOME/DRAW/AWAY descending with missing values last. Probability sorting does not create a Pick. Clearing filters restores all50. The interface says “공식 선택 의견: 없음” and describes model probability as research output, not a guaranteed outcome.

Every Soccer target uses the same template: header, model probability, separate engine/preview clocks, current season, recent form, venue form, player/core/recent/structural/match context, lineup/availability, flow, Engine Lab, quality and separate official pick. Missing sections explicitly say NOT_AVAILABLE; no team stereotypes fill gaps. Baseball/basketball/volleyball use sport status and missing/available evidence, not fabricated football player/lineup records.

## Canonical and evidence boundaries

Only two exact identity bridges currently connect usable canonical V1 evidence to this batch. Atlético/Real displays 42.20/25.79/32.01; City/Sunderland 72.36/18.07/9.57. Canonical resolver, input hash, private Preview manifest SHA, exact committed-scope bridge and target direction are checked. No names or nearest kickoff guesses. Absence of a connection is reported, not filled by other fixtures.

Atlético's v5 latest Preview remains six current-season matches per team; City retains its existing season-separated context. Model inputs, all old preview editions and research snapshots are unchanged. ENGINE_AS_OF and PREVIEW_AS_OF remain independent. Engine Lab labels V1 official, H2 research unpromoted, V3/V3.1 closed unpromoted (xG/Shots/SOT), V4 in development with prediction not implemented. No new version-specific probabilities are generated.

All50 targets have existing market evidence, totaling253 rows. Admission source SHA and exact committed evidence-ID links are checked. Screen left/middle/right values and unresolved selection mapping are retained. Blank quotes remain null, not zero. No odds are used by a model or player selector. The source transcription's old DRAFT metadata is not rewritten or retroactively upgraded; human-verified target identity comes from the source freeze and scope.

## Player-safety correction

GOALS_ASSISTS_EXCLUDED=false; GOALS_ASSISTS_ONLY=false. The new display projection retains goals/assists/shots/creation for attackers and broadly labelled midfielders, alongside continuity. Attacker raw tackles cannot select Structural Key. Total passes alone cannot select Structural Key. Defensive structural context requires multiple observed defensive counters; GK uses observed saves and starting continuity. This is descriptive candidate presentation, not a player impact model or engine feature admission.

Fine role remains UNKNOWN unless evidenced (provider GK is explicit). Midfielder is not guessed to be DM or AM; defender is not guessed to be CB or FB. Current recent fixture-level individual evidence remains unavailable; no official MVP or match-key claim is invented. No new player source/endpoint or external rating was used. All player statistics come from existing hashed internal receipts and exact active membership records. Archived v3 selectors/editions are preserved for reproducibility; live research pages use the corrected display projection.

## Validation and handoff

Full typecheck PASS. Five focused test files, 67/67 PASS, including 25 Explorer tests and existing Preview regressions. Tests cover all31 Soccer renders, exactly50 unique lines, sport/tier/sort contracts, null odds/probabilities, independent pick state, both showcases, owner gate, target getters, and injected optional-cache failures. Integration tests require the local private evidence; no claim of clean-checkout CI portability.

Actual Chromium: homepage50 lines at desktop1280 (scrollWidth1265) and mobile390 (scrollWidth375), no horizontal overflow. Sport SOCCER selects31; LaLiga selects2; HOME sort starts City, AWAY sort starts Atlético/Real. Actual detail routes for both showcases and a baseball BASIC line checked. Browser evidence supplements render tests. No provider/network data calls, result/live/target postgame access, model recalculation or grading in this task.

Audit: `data/audits/2026-09-20-full-slate-research-line-v1.json`. Current research branch only; unrelated pre-existing untracked files excluded. Main merge and public deployment forbidden. Run local owner UI with `npm run dev:owner-preview` on127.0.0.1:4198. Next work can enrich BASIC lines from separately approved provenance-safe evidence; do not mistake display coverage for a model admission or terminal-decision seal.

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
REAL_PREDICTION_COUNT=45 canonical (previous verified global count); 2 connected to this batch's Explorer
GRADED_PREDICTION_COUNT=15 (previous verified global count; not re-audited from outcomes)
CURRENT_SAMPLE_SIZE=15 graded, carried forward
LATEST_BACKTEST=existing sealed research, no rerun
LATEST_HOLDOUT=V3.1 SCREEN_NO
PROMOTION_GATE_STATUS=NO_NEW_PROMOTION
ENGINE_WEIGHTS_CHANGED=NO
ENGINE_THRESHOLDS_CHANGED=NO
FEATURE_SET_CHANGED=NO

## PROGRESS

TODAY_PROGRESS=100% of executable Full Slate mission
OVERALL_PROGRESS=72% owner baseline unchanged
TODAY_DELTA=+0%p; product/UI coverage is not engine progress
CURRENT_PHASE=V4_PHASE_0.5_PROSPECTIVE_EVIDENCE_READY
CURRENT_ENGINE=V1
NEXT_ENGINE=V4
NEXT_MILESTONE=approved evidence enrichment / real XI evidence
COMPLETED_TODAY=50 research lines, common template, filters/sorts, player-safety correction, tests/browser audit
BLOCKED_BY=none for line coverage; 48 lines have limited connected context
WAITING_FOR=provenance-safe additional context / confirmed XI / role evidence
