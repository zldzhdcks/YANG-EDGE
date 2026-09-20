# Atlético Real Showcase V1

2026-09-20. Local owner presentation only; no public deployment or model promotion.

## Render correction

The owner-enabled server on port 4198 loaded the private Rich Preview. The server on port 3000 without the owner flag reproduced the legacy “공식 상세 분석 미제공” fallback. This demonstrates a server/owner-mode routing mismatch; it does not establish which origin produced every earlier user screenshot. The exact showcase route now stops before the legacy reader when owner evidence is unavailable and displays an explicit local-preview notice. Start the dedicated loopback server with `npm run dev:owner-preview`.

Route: `/analysis/BETMAN-20260920-91?fromDate=2026-09-20`.
Read path: owner manifest → SHA verification → canonical fixture resolver → Rich Preview → showcase. Production excludes the private loader. Private raw responses and immutable previews remain outside Git.

## Evidence and presentation

Canonical V1 remains HOME 42.20%, DRAW 25.79%, AWAY 32.01%. Current 2026/27 form, previous 2025/26 context and MODEL HISTORICAL WINDOW are separate. Atlético current form: 4 matches, 2/1/1 W/D/L, GF7 GA6; home 2 matches, 1/1/0, GF4 GA2. Real current form: 5 matches, 4/0/1, GF14 GA4; away 2 matches, 1/0/1, GF2 GA2. These are September 13 observed inputs, not a claim of complete September 20 current form. Separately observed September 20 standings are labelled accordingly.

Six registry-verified players have provider positions, minutes, goals/assists and contextual reasons. No player is represented as a confirmed starter. LINEUP=NOT_CONFIRMED; AVAILABILITY=UNKNOWN. Data quality is consolidated at the bottom. Existing immutable XI append path is retained.

Engine Lab distinguishes official V1 from H2 research and closed/unpromoted V3/V3.1. Known pregame artifact stores contain no safe H2/V3/V3.1 prediction for this target; no probabilities were generated. Search scope and source hashes are in the companion availability audit. V4 registry/evidence foundations are ready; its prediction engine is not implemented. Homepage adds a showcase and research section, preserving BEST PICK below them.

## Verification

- Full TypeScript check: PASS (`npx tsc --noEmit --incremental false`).
- Six focused test files: 77/77 PASS (showcase, season split, rich preview, narrative, priority, public quick preview).
- These integration tests require the existing local private evidence/cache; this is not a claim of clean-checkout CI portability.
- Actual Chromium browser: detail and homepage desktop PASS; detail and homepage 390px mobile PASS. Measured detail width 390 / document scrollWidth 375; desktop 1280 / scrollWidth 1265. No horizontal overflow.
- Old fallback absent, canonical probabilities visible, season blocks, players, Engine Lab and status visible. Owner-disabled route shows launch notice.
- Repeated data-quality strings caused duplicate React keys during development; render-only deduplication fixed them without mutating evidence. Latest navigations produced no new console errors; historical console entries remain.
- No target result/live/postgame reads, no prediction generation, no sealed prediction overwrite, no engine/weight/threshold/feature changes. No provider calls in the showcase mission. The earlier Rich Preview collection included in this commit used 10 official calls, documented separately.

## Handoff

Keep owner preview on localhost; do not deploy private fields publicly. Future XI updates must use the existing exact-evidence, pregame-only immutable append script. No refit or probability recalculation is authorized by this UI work. The two browser tabs are left open. Unrelated pre-existing audits/scripts are excluded from this commit.

## ENGINE STATUS

OFFICIAL_ENGINE=V1; OFFICIAL_MODEL=football-poisson-research-v1; OFFICIAL_ENGINE_CHANGED=NO.
RESEARCH_V2_H2_STATUS=RESEARCH_UNPROMOTED.
V3_STATUS=RESEARCH_CLOSED_UNPROMOTED; V3_FEATURES=xG/Total Shots/Shots on Goal; V3_PROMOTED=NO.
V3_1_STATUS=RESEARCH_CLOSED_UNPROMOTED; V3_1_HOLDOUT=SCREEN_NO; V3_1_PROMOTED=NO.
V4_STATUS=PROSPECTIVE_EVIDENCE_READY; V4_PHASE=0.5; V4_IMPLEMENTED_COMPONENTS=REGISTRY/MEMBERSHIP/EVIDENCE_FOUNDATION; V4_ENGINE_IMPLEMENTED=false; V4_ADMISSION_ALLOWED=false.
REAL_PREDICTION_COUNT=45 canonical (47 artifacts), last verified; GRADED_PREDICTION_COUNT=15, last verified; CURRENT_SAMPLE_SIZE=15 graded, not re-audited from outcomes in this mission.
LATEST_BACKTEST=existing sealed research, not rerun; LATEST_HOLDOUT=V3.1 SCREEN_NO; PROMOTION_GATE_STATUS=NO_NEW_PROMOTION.
ENGINE_WEIGHTS_CHANGED=NO; ENGINE_THRESHOLDS_CHANGED=NO; FEATURE_SET_CHANGED=NO.

## PROGRESS

TODAY_PROGRESS=100% (this executable mission); OVERALL_PROGRESS=72% (owner baseline, not re-estimated); TODAY_DELTA=+0%p (UI is not engine progress).
CURRENT_PHASE=V4_PHASE_0.5_PROSPECTIVE_EVIDENCE_READY; CURRENT_ENGINE=V1; NEXT_ENGINE=V4.
NEXT_MILESTONE=VALIDATED_REAL_XI_EVIDENCE; COMPLETED_TODAY=RICH_PREVIEW/SEASON_SPLIT/SHOWCASE/ENGINE_LAB/HOMEPAGE/TESTS.
BLOCKED_BY=NO_CONFIRMED_XI_EVIDENCE_FOR_THIS_PREVIEW; WAITING_FOR=PROVENANCE_SAFE_PREGAME_XI_EVIDENCE.
