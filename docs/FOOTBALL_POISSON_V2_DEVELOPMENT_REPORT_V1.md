# FOOTBALL POISSON V2 DEVELOPMENT REPORT V1

DESCRIPTIVE DEVELOPMENT RESULT. DEVELOPMENT_SCREEN is execution validity, not performance superiority, hypothesis success, or promotion eligibility. MECHANISM_STATUS is separate and never overrides it.

## Provenance and pre-result freeze

- BASE_SHA: 585aa8f959010a0e50477f7d01f825823233792d
- Branch: agent/astra/football-historical-source-gate-v1
- Clarification-only commit: 08239505e203e3d6665ef59eacced5de8df1ebd2 (pushed before implementation).
- Source-freeze commit: cf38d6cbf8bdef00262519ad84819a088d09f11c (pushed before development execution).
- Source seal created: 2026-09-12T04:51:02.697Z
- Single execution: 2026-09-12T04:52:54.451Z to 2026-09-12T04:53:07.161Z
- Source seal SHA256: b3667a8af0e205797b89c550a09ad456923760cf0d146f7ad14bdcb19ad49436
- Development audit SHA256 (canonical payload): b6f63a65a74a8b8fa77479f8f92aca51baff15c4ecf2d5e1558f046b624bfa39
- Local full report SHA256: 9a3aee30df5489816fc0a99fd3115345fd1083e4cd6fe350abf0c780d50b166b
- Protocol SHA256: 0299f98fd28d1c3f4dc1c5153c5ddb6d614da6f0fbff09be295d68de51cfc69f
- Design SHA256: 03ad74710019082428fce6dbd2dd234aa4f0d21c009e715ae27ecb027b490945
- H1_SOURCE_SHA256: 421a421885f9bc0703321b7d0bf0dc1ce1814e14ad3c671fdf2716fe49112100
- H2_SOURCE_SHA256: 5a5431f11b4852d16fb3483f6c0ecd9fec75cf296f051f17fa64a35933cb14af
- H3_SOURCE_SHA256: f20705d667ec3dc9901aae5c9710d3e4018844039a81e6f3941a6a23b8615466
- COMMON_RUNNER_SHA256: e585aab06d6a0271b65af39bfa7858e043ddb0d88aa40d7ad0c9bf6b85d65b66

Source hashes normalize CRLF to LF. Canonical JSON hashes sort object keys. Authoritative filenames are h1-dixon-coles-v1.ts, h2-ridge-rates-v1.ts, and h3-temperature-v1.ts. No frozen source was edited after execution.

## Scope and execution status

DEVELOPMENT_TARGETS = 1446; DEVELOPMENT_FIT_TARGETS = 699; DEVELOPMENT_CHECK_TARGETS = 747. Only season 2023 (2023/24) was projected for fitting/checking. Initial-fit boundary: 2024-01-01T00:00:00.000Z. Initial parameters remain fixed during check; no final-development refit. Shared archive bytes contain multiple seasons, but the loader filters season metadata before accessing score fields; no evaluation label was projected or used.

Execution order: frozen v1 reference for all leagues, H1 for all leagues, H2 for all leagues, H3 for all leagues. All 12 league-hypothesis combinations: FIT_STATUS = FITTED; CHECK_STATUS = COMPLETED; DEVELOPMENT_SCREEN = PASS. All 747 check fixtures per hypothesis produced predictions, with zero row PASS/FAIL/INVALID. Fit eligibility counts below retain frozen history/48-hour gates; they are not retrospective exclusions. Normal row PASS remains a recorded gate outcome.

## Frozen v1 development reference

V1_REFERENCE_STATUS = COMPLETE. Across 1446 development targets: 1037 PREDICTED and 409 PASS (initial history warmup); fit predictions 290, check predictions 747. This is a new development reference, not a rerun or replacement of the sealed 2024/25 baseline. Historical and Forward scorecards remain separate.

- League 39: fit targets 196, check targets 184; check log loss 0.954433, Brier 0.562225, DRAW predictions 0.
- League 140: fit targets 180, check targets 200; check log loss 1.002985, Brier 0.600346, DRAW predictions 1.
- League 135: fit targets 180, check targets 200; check log loss 1.017263, Brier 0.613309, DRAW predictions 1.
- League 78: fit targets 143, check targets 163; check log loss 0.999964, Brier 0.599466, DRAW predictions 0.

## H1

- Premier League (39): FIT_STATUS FITTED; CHECK_STATUS COMPLETED; DEVELOPMENT_SCREEN PASS; fit eligible 83, check 184. KEY_PARAMETERS: {"rho":0.009999999899999999}. LOG_LOSS 0.954947; BRIER 0.562433; accuracy 0.586957; DRAW_PREDICTIONS 0; DRAW recall 0.000000; DRAW precision null. MECHANISM_STATUS NOT_SUPPORTED.
- La Liga (140): FIT_STATUS FITTED; CHECK_STATUS COMPLETED; DEVELOPMENT_SCREEN PASS; fit eligible 74, check 200. KEY_PARAMETERS: {"rho":-0.09999999899999999}. LOG_LOSS 1.004447; BRIER 0.601912; accuracy 0.505000; DRAW_PREDICTIONS 6; DRAW recall 0.020000; DRAW precision 0.166667. MECHANISM_STATUS NOT_SUPPORTED.
- Serie A (135): FIT_STATUS FITTED; CHECK_STATUS COMPLETED; DEVELOPMENT_SCREEN PASS; fit eligible 68, check 200. KEY_PARAMETERS: {"rho":-0.09999999899999999}. LOG_LOSS 1.010292; BRIER 0.609677; accuracy 0.480000; DRAW_PREDICTIONS 2; DRAW recall 0.031746; DRAW precision 1.000000. MECHANISM_STATUS SUPPORTED.
- Bundesliga (78): FIT_STATUS FITTED; CHECK_STATUS COMPLETED; DEVELOPMENT_SCREEN PASS; fit eligible 51, check 163. KEY_PARAMETERS: {"rho":-0.09999999899999999}. LOG_LOSS 0.992242; BRIER 0.595694; accuracy 0.484663; DRAW_PREDICTIONS 1; DRAW recall 0.000000; DRAW precision 0.000000. MECHANISM_STATUS SUPPORTED.

## H2

- Premier League (39): FIT_STATUS FITTED; CHECK_STATUS COMPLETED; DEVELOPMENT_SCREEN PASS; fit eligible 188, check 184. KEY_PARAMETERS: {"b":0.2626475275824708,"h":0.22330908690777343,"teamCount":20,"teamUniverseHash":"948d8a41ffcd928b43725a41798701189b82185dd8ea16b9089e4e947451b6f1","coefficientVectorHash":"06e6bbd97eba34ce3ea1d9b267c9b36b73ddcb617c4d8644c293a0d8b164b071","attackSum":-1.1102230246251565e-16,"defenceSum":-2.7755575615628914e-17}. LOG_LOSS 0.931496; BRIER 0.548510; accuracy 0.554348; DRAW_PREDICTIONS 0; DRAW recall 0.000000; DRAW precision null. MECHANISM_STATUS NOT_SUPPORTED.
- La Liga (140): FIT_STATUS FITTED; CHECK_STATUS COMPLETED; DEVELOPMENT_SCREEN PASS; fit eligible 180, check 200. KEY_PARAMETERS: {"b":0.0862347856483359,"h":0.23192463244509384,"teamCount":20,"teamUniverseHash":"167b9d0dc293cca4b2421fdd6fb3af64bfd20c9db152e5b921408b5a2386ddd4","coefficientVectorHash":"b3abdebc3a37eb701a8bb3ca5498792fbbf815c63577996cd3d81e7ebccdb68a","attackSum":1.6653345369377348e-16,"defenceSum":1.3183898417423734e-16}. LOG_LOSS 0.992803; BRIER 0.593850; accuracy 0.550000; DRAW_PREDICTIONS 4; DRAW recall 0.040000; DRAW precision 0.500000. MECHANISM_STATUS SUPPORTED.
- Serie A (135): FIT_STATUS FITTED; CHECK_STATUS COMPLETED; DEVELOPMENT_SCREEN PASS; fit eligible 174, check 200. KEY_PARAMETERS: {"b":0.012410958061304348,"h":0.2667749145717141,"teamCount":20,"teamUniverseHash":"37d29a8ce816ea6a3fe0cc97cbcf9da8aa95d22b735ac67a3dd1c28d04f33154","coefficientVectorHash":"caf93e883cf98a6a1aa55eedfac90fd2567c9fd3a9e9a7db4c7f2cf65954b8d9","attackSum":-1.6653345369377348e-16,"defenceSum":1.3877787807814457e-16}. LOG_LOSS 1.003899; BRIER 0.603994; accuracy 0.500000; DRAW_PREDICTIONS 3; DRAW recall 0.015873; DRAW precision 0.333333. MECHANISM_STATUS NOT_SUPPORTED.
- Bundesliga (78): FIT_STATUS FITTED; CHECK_STATUS COMPLETED; DEVELOPMENT_SCREEN PASS; fit eligible 143, check 163. KEY_PARAMETERS: {"b":0.24262383682120306,"h":0.3328949115067033,"teamCount":18,"teamUniverseHash":"6fd3944dfed76b59fa3c7a52357391af7f5cbfd2807705a3705731f7a423b0ce","coefficientVectorHash":"9823de6a8d5ff0e5474529a51d2ea5eda9717cb854eaa1ce18477ca7d99f84d9","attackSum":1.1102230246251565e-16,"defenceSum":1.0408340855860843e-17}. LOG_LOSS 1.004400; BRIER 0.603084; accuracy 0.515337; DRAW_PREDICTIONS 0; DRAW recall 0.000000; DRAW precision null. MECHANISM_STATUS NOT_SUPPORTED.

## H3

- Premier League (39): FIT_STATUS FITTED; CHECK_STATUS COMPLETED; DEVELOPMENT_SCREEN PASS; fit eligible 83, check 184. KEY_PARAMETERS: {"beta":0.6752051531337202,"T":1.4810313507811101}. LOG_LOSS 0.975078; BRIER 0.577602; accuracy 0.586957; DRAW_PREDICTIONS 0; DRAW recall 0.000000; DRAW precision null. MECHANISM_STATUS NOT_SUPPORTED.
- La Liga (140): FIT_STATUS FITTED; CHECK_STATUS COMPLETED; DEVELOPMENT_SCREEN PASS; fit eligible 74, check 200. KEY_PARAMETERS: {"beta":1.193602540413849,"T":0.8377998254370984}. LOG_LOSS 1.005264; BRIER 0.601389; accuracy 0.515000; DRAW_PREDICTIONS 1; DRAW recall 0.000000; DRAW precision 0.000000. MECHANISM_STATUS NOT_SUPPORTED.
- Serie A (135): FIT_STATUS FITTED; CHECK_STATUS COMPLETED; DEVELOPMENT_SCREEN PASS; fit eligible 68, check 200. KEY_PARAMETERS: {"beta":1.2977893471252173,"T":0.7705410760345184}. LOG_LOSS 1.035891; BRIER 0.625501; accuracy 0.475000; DRAW_PREDICTIONS 1; DRAW recall 0.015873; DRAW precision 1.000000. MECHANISM_STATUS NOT_SUPPORTED.
- Bundesliga (78): FIT_STATUS FITTED; CHECK_STATUS COMPLETED; DEVELOPMENT_SCREEN PASS; fit eligible 51, check 163. KEY_PARAMETERS: {"beta":0.7992599377874283,"T":1.2511574179087162}. LOG_LOSS 0.995790; BRIER 0.595741; accuracy 0.490798; DRAW_PREDICTIONS 0; DRAW recall 0.000000; DRAW precision null. MECHANISM_STATUS NOT_SUPPORTED.

## Interpretation limits

H1 reaches the frozen rho boundary in all four leagues. These are constrained fit outcomes; bounds were not expanded. Its joint-score/low-cell mechanism diagnostics support Serie A and Bundesliga only. H2's required marginal-rate mechanism diagnostics support La Liga only; full attack/defense vectors and optimizer diagnostics remain local, with hashes in the audit. H3 has zero argmax changes in every league and no supported mechanism under the frozen diagnostic contract. These statuses do not select a winner or authorize promotion. Full precision metrics, class confusion/calibration bins, paired comparisons, and diagnostic deltas are retained in data/audits/football-poisson-v2-development-v1.json.

No performance metric was used to determine DEVELOPMENT_SCREEN. No new sample threshold, paired coverage threshold, multiplier, or post-result rule was introduced. Evaluation-only promotion rules were not applied to development.

## Tests and preservation

- 88 tests passed: 14 new synthetic contract tests and 74 existing football regression tests. These include leakage/input isolation, numerical contracts, deterministic identity/hash, freeze checks, and existing Forward protections.
- Strict TypeScript and ESLint passed before source freeze. ESLint emitted only the shared React package-detection environment warning.
- An existing cross-league protocol suite initially hit a CJS/top-level-await loader error before test execution. Its 10 tests passed using byte-identical copies of nine existing dependencies/artifacts in an ignored local ESM test-support directory. No existing source was changed to resolve the loader mismatch. Synthetic test fixtures are not actual evaluation execution.
- Post-run read-only verification: 65 JSON envelopes matched their canonical hashes; all nine frozen TypeScript source hashes matched. No fitting or prediction was repeated for this verification.
- Protected files: 528; before and after digest: 39cbe8c5432cdede555af6df0182ab3df800d42291ba12f0fe747bc55e86a4ae. All four historical archive hashes, existing sealed backtest results, v1 model, and Forward files unchanged.

## Storage and Cursor handoff

Source freeze audit and sanitized development audit are Git artifacts. Raw archives, fixture-level inputs/predictions/labels, full parameter vectors, optimizer traces and execution markers remain LOCAL_ONLY under data/cache/research/football/poisson-v2-draw-research/. No API calls or keys were used by this execution.

Exact local run root: data/cache/research/football/poisson-v2-draw-research/protocol-v1/; run ID 2026-09-12T04-52-54-451Z. The persistent DEVELOPMENT_V1_EXECUTION_STARTED.json marker must remain. Do not delete it or rerun --run. Local pregame artifacts were sealed before check-label joins. Existing untracked docs/FOOTBALL_CURRENT_SEASON_DATA_ACCESS_GATE_V1.md is preserved and excluded.

Next action is CTO review of this report, the sealed audit, and existing frozen protocol/design. No evaluation, refit, tuning, model promotion, or Forward migration is authorized by this report. If a source defect is discovered, STOP and require a new version; do not silently edit the frozen implementation or replace this run.

## Governance

EVALUATION_EXECUTED = NO
FINAL_DEVELOPMENT_REFIT_EXECUTED = NO
PARENT_PROTOCOL_CHANGED = NO
ALGORITHM_DESIGN_CHANGED = NO
HYPERPARAMETERS_CHANGED = NO
COHORT_CHANGED = NO
METRICS_CHANGED = NO
PROMOTION_RULE_CHANGED = NO
FORWARD_V1_CHANGED = NO
MODEL_CHANGED = NO (existing frozen v1)
ENGINE_CHANGED = NO
ODDS_USED = NO
PROVIDER_PREDICTION_USED = NO
PROMOTION_EXECUTED = NO
MAIN_MERGED = NO

FOOTBALL_POISSON_V2_DEVELOPMENT_V1_READY_FOR_CTO_REVIEW
