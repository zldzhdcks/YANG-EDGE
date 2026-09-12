# FOOTBALL_POISSON_V2_DEVELOPMENT_EXECUTION_CLARIFICATION_V1

Approved by the owner before implementation, fitting, development-result inspection or evaluation. BASE_SHA=585aa8f959010a0e50477f7d01f825823233792d.

This resolves execution ambiguity only. Parent protocol and algorithm design remain read-only, with canonical hashes respectively `0299f98fd28d1c3f4dc1c5153c5ddb6d614da6f0fbff09be295d68de51cfc69f` and `03ad74710019082428fce6dbd2dd234aa4f0d21c009e715ae27ecb027b490945`.

## Authoritative paths

- H1: scripts/football-poisson-v2-draw-research/h1-dixon-coles-v1.ts
- H2: scripts/football-poisson-v2-draw-research/h2-ridge-rates-v1.ts
- H3: scripts/football-poisson-v2-draw-research/h3-temperature-v1.ts

The sealed design paths take precedence over the erroneous filenames in the earlier execution request. No design file is renamed.

## DEVELOPMENT_SCREEN

This classifies execution validity per league × hypothesis, never performance superiority. Precedence:

1. INVALID: hash/identity mismatch, cohort contamination, temporal/evaluation leakage, forbidden input, invalid probability mass or integrity-contract violation.
2. FAIL: no INVALID, but required fit/check has numerical/optimizer failure, nonconvergence, nonfinite parameter/output, or another design-defined FAIL.
3. INSUFFICIENT: no INVALID/FAIL, but existing design fit eligibility/sufficiency gates prevent required fit/check. No new sample or paired-coverage threshold is added.
4. PASS: otherwise frozen fit/check completes, integrity is verified and results/diagnostics are recorded. This may hold even when metrics deteriorate.

Normal row-level frozen-gate PASS is retained and does not make the experiment FAIL. A league-level initial fit blocked by its frozen sufficiency gate makes the experiment INSUFFICIENT. Retain every row-level PASS reason. Do not classify ordinary row exclusions as a new experiment-level coverage gate.

MECHANISM_STATUS is separate: SUPPORTED / NOT_SUPPORTED / INSUFFICIENT. It never overrides DEVELOPMENT_SCREEN. PASS with NOT_SUPPORTED is permitted. Metric gains/losses do not enter DEVELOPMENT_SCREEN. Parent promotion rules apply to evaluation, not development; no promotion or evaluation authorization is produced here.

## Freeze timing and continuation

At this clarification: CODE_CHANGED=NO; FITTING_EXECUTED=NO; DEVELOPMENT_RESULTS_VIEWED=NO; EVALUATION_EXECUTED=NO. This is not post-result adaptation.

After this docs-only commit/push, continue the authorized implementation/development mission: implement all three hypotheses and common runner, pass synthetic/contracts and existing regressions, seal all source hashes before development. Then execute FROZEN_V1_REFERENCE → H1_ALONE → H2_ALONE → H3_ALONE on season 2023 only. Freeze initial parameters for the development check. Do not execute final refit/evaluation, modify frozen source after results, touch Forward state or merge main.

PARENT_PROTOCOL_CHANGED=NO; ALGORITHM_DESIGN_CHANGED=NO; HYPERPARAMETERS_CHANGED=NO; COHORT_CHANGED=NO; METRICS_CHANGED=NO; PROMOTION_RULE_CHANGED=NO; FORWARD_V1_CHANGED=NO.

FOOTBALL_POISSON_V2_DEVELOPMENT_EXECUTION_CLARIFICATION_V1_APPROVED
