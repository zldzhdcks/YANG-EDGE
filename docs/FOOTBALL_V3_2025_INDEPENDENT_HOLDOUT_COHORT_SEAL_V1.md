# FOOTBALL V3 2025 INDEPENDENT HOLDOUT COHORT SEAL V1

HOLDOUT COHORT / EXPOSURE SEAL ONLY. No model execution or performance measurement occurred. Only identity, stage, status, feature presence and hashes are disclosed. Raw provider responses remain local/private.

BASE_SHA = 2ab3eae8d1d3503d541f6f2d1b2073d0e33250d7

BRANCH = agent/astra/football-historical-source-gate-v1

Started = 2026-09-12T09:35:14.375Z

Completed = 2026-09-12T09:43:27.464Z

Artifact canonical-payload SHA256 = 7924420956e419af1a7f14b8b2eb520cc55d37b46534736d35b0fbdcf51c2581

## Frozen parents and population

- docs/FOOTBALL_V3_FEATURE_RESEARCH_PROTOCOL_V1.json: canonical SHA256 0b30bc4d41684f2797d0a8e0a2a53694ecc6d5dc8f151b45213af1f1f9dc1bb8.
- docs/FOOTBALL_V3_FEATURE_ALGORITHM_DESIGN_FREEZE_V1.json: canonical SHA256 04803e9b26acfd43de263c9b52c575ed2231d91984f82877da5e63b0cde6207a.

Both parents remain unchanged, including all feature candidates, 48h research lag, 365d window, min history 5, ridge 0.01, optimizer, missingness, promotion and both firewalls.

Season=2025 (2025/26). Scope uses only round identity matching `^Regular Season - ([1-9][0-9]*)$`. No status/result-dependent filter, fuzzy join, replacement or inferred ID. Provider counts determine the population. Identity was sealed at 2026-09-12T09:35:17.942Z before feature requests.

- EPL: 380 included / 380 provider rows. FIXTURE_IDS_SHA256=ef130bf31c641eacf61d94f188ceca915a319ec02de9112f2eb6189166612dff; LEAGUE_COHORT_SHA256=1670482ac66b0e27ed0c91c5875ab4c3958f571d4a8d89f04553bedc7267e82e.
- La Liga: 380 included / 380 provider rows. FIXTURE_IDS_SHA256=b79d357a12832dc9e778b8305de6e0c66d9a9f87d72f8fb9855d37d56c260c12; LEAGUE_COHORT_SHA256=70592ed1e99af9f04a58ca3ea4c601d7106331bf5431072c541f35e2d14c2016.
- Serie A: 380 included / 380 provider rows. FIXTURE_IDS_SHA256=059494fcb584b498afe1f37a74b424e75838a9d1fc85a813207e48b4ec925592; LEAGUE_COHORT_SHA256=3360baa777e8c6d0f4d43dccbe2aa156f0c1d72abb21a8770d40ca3d02d72fe3.
- Bundesliga: 306 included / 308 provider rows. FIXTURE_IDS_SHA256=60525ef1611e431369972f4e7a0cf554bfa8832ceb1e393d5ddbc865ba565687; LEAGUE_COHORT_SHA256=6dbcc80c6e4d34ddd09bf3c36d204d91637dd5240f52d25d0ee211119bd41d21.

TOTAL_HOLDOUT_FIXTURES=1446

FIXTURE_IDS_SHA256=15419e48f9d684207853f7b599d4160bd569292785ee4ba19bccda21b28e6fa3

FULL_COHORT_SHA256=154df97e50b624206898e19ac07ac5f2a9f2c344fcc97b541699c3d2b4b6cfec

Stage-excluded identities:

- fixture 1545417, league 78, round Final: NON_REGULAR_SEASON_STAGE.
- fixture 1545418, league 78, round Final: NON_REGULAR_SEASON_STAGE.

## Feature completeness

Counts are integrity coverage only. COMPLETE requires both exact team blocks to contain valid non-null feature values. PARTIAL means one valid side; NULL means no valid side with explicit null; MISSING means no valid side without null, including statistics unavailable. ERROR is request/identity/schema failure. Statistics-unavailable is a subset of aggregate MISSING, not an extra denominator term. No feature magnitudes are disclosed.

- EPL xG: TOTAL=380; COMPLETE=380; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.
- EPL shots: TOTAL=380; COMPLETE=380; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.
- EPL sot: TOTAL=380; COMPLETE=380; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.
- La Liga xG: TOTAL=380; COMPLETE=380; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.
- La Liga shots: TOTAL=380; COMPLETE=380; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.
- La Liga sot: TOTAL=380; COMPLETE=380; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.
- Serie A xG: TOTAL=380; COMPLETE=380; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.
- Serie A shots: TOTAL=380; COMPLETE=380; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.
- Serie A sot: TOTAL=380; COMPLETE=380; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.
- Bundesliga xG: TOTAL=306; COMPLETE=306; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.
- Bundesliga shots: TOTAL=306; COMPLETE=306; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.
- Bundesliga sot: TOTAL=306; COMPLETE=306; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.

Overall:

- xG: TOTAL=1446; COMPLETE=1446; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.
- shots: TOTAL=1446; COMPLETE=1446; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.
- sot: TOTAL=1446; COMPLETE=1446; PARTIAL=0; MISSING=0; NULL=0; ERROR=0; COVERAGE=100.000000%.

Exact missing/partial/null/unavailable/error and non-complete ID lists are included in JSON with SHA256 of compact JSON ID arrays. Non-complete lists:

- xG: IDs=[]; SHA256=4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945.
- shots: IDs=[]; SHA256=4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945.
- sot: IDs=[]; SHA256=4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945.

## Exposure and independence

EXPOSURE_AUDIT=PROJECT_UNTOUCHED

- Current repository-wide V3/2025-26 term search resolves to protocol/design/access/census documents, not V3 model execution output.
- Existing V2 evaluation season guard permits only 2023/2024; no V3 implementation directory exists.
- First-live 2026 Forward access audit records retrieval of season-2025 history. Historical result access is acknowledged; no 2025 target V3 performance was found.
- Earlier generic fixture capture has one season-2025 fixture in league 24, outside the four target leagues; no candidate performance fields found.
- Other season-2025 references are access/readiness policy, synthetic tests, dummy provider or future holdout design. MLB/OCR V3 artifacts are unrelated sports/workstreams.

Inspected 453 football/Poisson Git objects across locally reachable refs, plus repository-wide term search and current source/artifact checks. Search receipts are sealed in the JSON; no metric values are displayed. PROJECT_UNTOUCHED means no project-level performance exposure evidence found within that scope. It does not claim global or model-training epistemic independence, and cannot certify deleted unreachable history or unrecorded external activity. Prior 2025 history access for 2026 Forward is explicitly acknowledged.

HOLDOUT_INDEPENDENCE_STATUS=INDEPENDENT_HOLDOUT_SEALED

Identity/stage and full population sealed before feature inspection; completeness sealed; no project-level metric exposure evidence; no result-based scope selection; frozen parents unchanged. This is not authorization to run evaluation. Separate CTO approval remains required.

## Future use and preservation

Preserve every full-cohort ID and denominator. Comparator intersection is constructed only under the frozen design after evaluation authorization; it was not computed here. Candidate failure must never remove an ID or alter league scope. Collecting target statistics for completeness does not permit using those statistics for that same target prediction. Only prior-match evidence meeting the frozen historical temporal contract can enter later authorized research. These retrospective data are not strict replay evidence.

Raw local directory: C:/Users/TCTCTC/YANG-EDGE/YANG-EDGE-INBOX/football-v3-2025-holdout-seal-v1/2026-09-12T09-35-14-375Z. Requests=1451; max 180/minute, concurrency 4, no retry. Raw response hashes verified=1450; classifier checks=9/9. Protected existing files=642; before/after digest=4f5a3afa6014e24f25d5434149a601422405e45a607bad1d58a19691b2c5ff3d. Parent, V1/V2/H2, Forward and 2023/2024 artifacts remain unchanged. Existing untracked access-gate document preserved.

Only sanitized identity/presence/hash audit and this report are committed. API key and raw values are excluded. Existing conditional internal-use and unresolved public-use rights remain unchanged. No main merge.

Cursor handoff: collection is complete; do not repeat API calls. Local collector/source, identity seal, receipts, raw evidence and exposure scan are under the sibling inbox task directory. Read these two committed artifacts and both frozen parents before any separately authorized next task.

V3_IMPLEMENTED=NO
V3_FITTING_EXECUTED=NO
V3_BACKTEST_EXECUTED=NO
2025_HOLDOUT_PREDICTIONS_GENERATED=NO
2025_HOLDOUT_METRICS_VIEWED=NO
2025_HOLDOUT_METRICS_COMPUTED=NO
V2_CHANGED=NO
H2_CHANGED=NO
FORWARD_V1_CHANGED=NO

FOOTBALL_V3_2025_INDEPENDENT_HOLDOUT_COHORT_SEAL_V1_READY_FOR_CTO_REVIEW

STOP.
