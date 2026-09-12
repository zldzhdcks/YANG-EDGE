# POISSON V2 EVALUATION EXECUTION PATH V1 — PRE-EXECUTION REPORT

BASE_SHA = 351db25ddacdfbe34f8c6400cbe56c2f6ad77acd
SOURCE_COMMIT_A = ee804550a925bde978d657359512ceadbe440b7f
SOURCE_FREEZE_CREATED_AT = 2026-09-12T05:30:25.303Z
SOURCE_FREEZE_SHA256 = a4752de618dfa550a167df715aaf47b064f3769bc897566054528a59ad1b0a32

DEV_SOURCE_HASHES_UNCHANGED = YES
DEVELOPMENT_COMMON_RUNNER_SHA256 = e585aab06d6a0271b65af39bfa7858e043ddb0d88aa40d7ad0c9bf6b85d65b66
PROTOCOL_SHA256 = 0299f98fd28d1c3f4dc1c5153c5ddb6d614da6f0fbff09be295d68de51cfc69f
DESIGN_SHA256 = 03ad74710019082428fce6dbd2dd234aa4f0d21c009e715ae27ecb027b490945

- contracts-evaluation-v1.ts: 60ea5b524b6976610b140fa16383d67de325d82ff258c1e8c6ccc00ba3854a81
- evaluator-evaluation-v1.ts: 9330bf604ecf9c7016799ce874917f2e41582d7e62e0679820cb0758178c7966
- evidence-evaluation-v1.ts: 9c9045d6e0e87a4fbdc79b79d5e5acb5ec917c8e0c88a5b0947720711d510565
- h1-dixon-coles-v1.ts: 2ddc65a93b7d0a399866ba79e404dae5845fccecc0e78be600b3e50d93c4f5bf
- h2-ridge-rates-v1.ts: fab9d235b885207a0feba198f1e777f0a8ee0577e50d14f317613e7dcfef0aea
- h3-temperature-v1.ts: d0127b13340cd14f7b7f09c256e27aa4003fc019e7adb03e04460a67323ae51d
- numerics-v1.ts: 59fb0fb80c8ab56eda51ec58d6b951d9a5022f9c4978e1eb6bfa6e5420725859
- run-evaluation-v1.ts: 56db783d93ae4ca651dbe09721d66db2da8ef43f5b34be6660f777f762510fae
- test-evaluation-v1.ts: 81145d480c8b9b2a98736a820c5ffb90a83b32ca45a7ce18a1626ecfc1c1e67c
- v1-readonly-adapter.ts: 58e521a8897b9e15dc04713f427edc7ce23dd02eca64e52dcaf4ac23f7f74349

SEASON_2023_ACCEPTED = YES
SEASON_2024_ACCEPTED = YES
SEASON_2025_REJECTED = YES
H1_EQUIVALENCE = EXACT
H2_EQUIVALENCE = EXACT
H3_EQUIVALENCE = EXACT

103 tests passed: existing 88 plus 15 evaluation-specific tests. Strict TypeScript and ESLint passed (shared React package-detection warning only). The existing 10-test ESM protocol suite used the same previously verified byte-identical local test-support copies; original files were not edited.

LEAKAGE_TESTS = PASS: target/future/other-league rejection; strict 48-hour availability; inclusive 365-day history boundary; no evaluation labels in final development fit; real season identity; no target-score read during metadata projection.

Algorithm, numerics, optimizer, initialization and constants are exact source copies after reversing only the contract import path. Tests additionally confirm exact synthetic 2023 fit/output equality. The original nine Development TypeScript files remain byte-preserved. Evaluation is isolated in its own subdirectory and does not enter the Development common-runner hash.

FINAL_FITTING_EXECUTED = NO
EVALUATION_EXECUTED = NO

This is a timestamped pre-execution statement, not the eventual result status. Commit A contains source/tests only. Commit B seals this report and source manifest; both must be pushed and verified before --run. The authorized subsequent run performs final 2023 fits, seals every final parameter hash, then executes the exposed 2024/25 comparison once. No actual promotion or Forward replacement is authorized.

Command (repository root, with local tsx loader configured): node --import=<tsx-loader> scripts/football-poisson-v2-draw-research/evaluation-v1/run-evaluation-v1.ts --verify; then --run. --run requires HEAD=origin/Astra and the source manifest committed at HEAD. It writes an exclusive execution marker; any failure remains recorded and cannot be retried under this version.

Evaluation records and full coefficient/optimizer traces remain in ignored local cache. Only sanitized audit/report outputs may be committed. Preserve the untracked access-gate document. No main merge.

ALGORITHM_CHANGED = NO
HYPERPARAMETERS_CHANGED = NO
PROMOTION_RULE_CHANGED = NO
DEVELOPMENT_RESULT_CHANGED = NO
FORWARD_V1_CHANGED = NO
EVALUATION_EXECUTION_INFRA_CHANGED = YES
