# YANG EDGE — ENGINE STATUS REPORTING RULE V1

Owner-required reporting contract. Applies to every major development/research
report; Pipeline status and Football Engine status must be separate.

## Mandatory block

```text
ENGINE STATUS
OFFICIAL_ENGINE=
OFFICIAL_MODEL=
OFFICIAL_ENGINE_CHANGED=
RESEARCH_V2_H2_STATUS=
V3_STATUS=
V3_FEATURES=
V3_PROMOTED=
V3_1_STATUS=
V3_1_HOLDOUT=
V3_1_PROMOTED=
V4_STATUS=
V4_PHASE=
V4_IMPLEMENTED_COMPONENTS=
V4_ENGINE_IMPLEMENTED=
V4_ADMISSION_ALLOWED=
REAL_PREDICTION_COUNT=
GRADED_PREDICTION_COUNT=
CURRENT_SAMPLE_SIZE=
LATEST_BACKTEST=
LATEST_HOLDOUT=
PROMOTION_GATE_STATUS=
ENGINE_WEIGHTS_CHANGED=
ENGINE_THRESHOLDS_CHANGED=
FEATURE_SET_CHANGED=
```

## Interpretation rules

1. Infrastructure development never implies an Engine version increase.
2. Existing code never implies Engine promotion.
3. Research Candidate / prospective shadow and Official Forward are distinct.
4. No promotion before the applicable frozen Holdout/Backtest gates pass.
5. No weight/threshold changes before sufficient samples. Sample sufficiency
   alone does not authorize changes or waive frozen governance.
6. V4 Phase 0 foundation work is not V4 Engine completion.
7. Any actual promotion must record old -> new version, explicit admission
   evidence, sample size, Holdout/Backtest results and changed features.
8. Reverify repository/artifacts at each report. If evidence is unavailable or
   stale, say UNKNOWN or LAST_VERIFIED and supply the source/time. Do not turn
   absence of a new run into a zero cumulative count.
9. Count only the declared model/cohort. Separate new mission predictions,
   Official Forward cumulative predictions, shadow predictions, PASS and grades.
   CURRENT_SAMPLE_SIZE means eligible graded evaluation denominator, not all
   scheduled fixtures or all sealed snapshots. Never pool historical/forward.
10. Changed flags refer to the reported work versus its base, not all past work.
    A docs-only rule change does not change the model, features or thresholds.

## Repository-checked baseline

Checked against HEAD aa28b4241d8b72f6c62c9a0369aa65ca46ffa34b on 2026-09-20 KST.
These are last-verified references, not permission to skip future verification.

- OFFICIAL_ENGINE=V1; OFFICIAL_MODEL=football-poisson-research-v1.
- V2 H2=RESEARCH_UNPROMOTED / UNPROMOTED_RESEARCH_BACKBONE.
- V3=RESEARCH_COMPLETE_UNPROMOTED; xG / Total Shots / Shots on Goal.
  Implementation and 2023/2024 descriptive research completed; V3 F1/F2/F3 2025
  holdout was not executed. Do not describe it as a passed holdout.
- V3.1=RESEARCH_CLOSED_UNPROMOTED; 2025 independent holdout executed once;
  R1/R3 global SCREEN_NO. R1 prospective shadow is not Official Forward.
- V4=PHASE_0; RESEARCH_FOUNDATION_PARTIAL_ENGINE_NOT_IMPLEMENTED.
  Direction: Starting XI + Player Impact + Injury/Suspension + Lineup/Player Layer.
  Implemented foundation: temporal provenance, player identity states, lineup /
  injury normalization, local fetchedAt, append-only snapshot planning/persistence
  and coverage. Player impact/XI strength scoring and V4 Prediction engine are
  not implemented. V4_ENGINE_IMPLEMENTED=false; V4_ADMISSION_ALLOWED=false.

Evidence:
- `data/audits/football-v3-v31-closure-audit-v1.json`
- `docs/FOOTBALL_V31_R1_HOLDOUT_CLOSURE_V1.md`
- `docs/FOOTBALL_V4_PHASE0_IMPLEMENTATION_V1.md`
- `data/audits/football-v4-phase0-implementation-v1.json`
- `src/lib/football/v4-phase0-foundation-v1/`
- `data/audits/football-forward-cumulative-evaluation-v1.json`

The last referenced cumulative Official Forward audit was evaluated at
2026-09-17T00:27:32.147Z: totalPredicted=45, totalGraded=15, currentN=15,
pendingPredicted=30, SAMPLE_INSUFFICIENT=true, ENGINE_CHANGE_ALLOWED=false.
These counts are not asserted as refreshed live counts. The recent operator
production missions added zero real predictions; that is a different scope.

Latest reviewed research references: V3.1 2024 exposed descriptive check
(`data/audits/football-v31-2024-exposed-check-v1.json`) and V3.1 2025 independent
holdout (`data/audits/football-v31-2025-independent-holdout-evaluation-v1.json`).
No backtest, holdout, live grade or prediction needs to be rerun merely to report
these existing sealed statuses. Promotion remains blocked; no version is promoted
by this reporting-rule artifact.

## Subsequent V3 revalidation (2026-09-20 KST)

The baseline above describes the pre-revalidation state. The authorized V3
F1/F2/F3 2025 evaluation has now executed once with unchanged frozen parameters.
`data/audits/football-v3-2025-revalidation-holdout-v1.json` records SCREEN_NO for
all three candidates across the required four leagues. V3 remains unpromoted;
TEMPORAL_UNVERIFIED remains. Use
`docs/research/FOOTBALL_V3_REVALIDATION_GATE_V1.md` for the updated evidence.
The cohort was already exposed by V3.1 research; do not describe this as a newly
untouched holdout. Official Forward V1, V3.1 and V4 status are unchanged.

## Subsequent closure and V4 admission design

`FOOTBALL_V4_RESEARCH_ADMISSION_PROTOCOL_V1.md` now fixes both V3 and V3.1 as
RESEARCH_CLOSED_UNPROMOTED. V4 remains Phase 0, engine/admission false, with
A/B/C design-only candidate scopes and zero admitted features. A proposed
prospective sample policy is not an existing Official threshold and requires
ratification before enrollment. Protocol readiness is not shadow readiness.
