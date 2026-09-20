# Round 111 duplicate canonicalization and first V4 evidence readiness

Base `424cbb51dd8667cbf62b01509d2e7a6472346186`; research branch only.
Policy was committed before this mission's forensic selection and before any target
result, grade, live or postgame access. All such accesses remain false.

## Canonical decision

47 PREDICTED artifacts represent 45 unique fixtures. All 47 pass pregame identity,
input provenance and immutable receipt eligibility. Canonical count is 45;
duplicate noncanonical count is 2; invalid-for-canonical count is 0.

Fixture 1557413 canonical:
`ce791ab8b4c2d466e4c6c5eb22dc11c30e5980e75ed59e74ed2e3c3348fb1e23`
created 2026-09-13T07:32:20.315Z, sealed 07:32:20.330Z.
Noncanonical:
`635ce85b3e19a4dd6df380cd96d63252191f5159f698083dab491bb8d5597ea3`.

Fixture 1570394 canonical:
`d633db9563c2108dba2f8249e514e5d5842c948099732a3c9c16854d7e6c5f3b`
created 2026-09-13T07:32:20.373Z, sealed 07:32:20.386Z.
Noncanonical:
`301569281e030352aa5440f744351171a186927fe512dd94ec7caed6d0b82e08`.

Both select the earliest valid pregame seal. No probability magnitude, market,
predicted side, result or grade success was considered. The September 13 global
seals have exact provider fixture identity and frozen inputs; they need not possess
the later September 20 operator target IDs. Operator scope and receipt information
is separately recorded for the batch copies. Neither batch terminal is rewritten.
These historical terminal records remain auditable but their referenced duplicate
Predictions are excluded from Official evaluation.

Root cause confirmed at base: `freeze` searched only its passed root's fixture
directory. The locked batch runner passed the selected batch directory, creating
GLOBAL_SCOPE_AND_BATCH_SCOPE_DUPLICATION. This was not an authorized revision chain.

## Prevention and grading

The freeze boundary now checks global plus named-batch Official stores under one
filesystem fixture lock. A valid existing seal returns
EXISTING_OFFICIAL_PREDICTION, without accessing new model inputs. Exact identity or
kickoff disagreement fails closed. A new operator scope is not automatically linked
when its temporal binding cannot establish the old prediction cutoff.

The immutable model algorithm is unchanged. Canonical grade guards run before
grade body reads, provider calls or new grade writes. Cumulative evaluation records
noncanonical exclusions; scorecards exclude them from prediction/grade counts.
Identical mirrors share one hash, and deterministic physical-path selection allows
only one grade authority. Managed production repositories discover the established
Official stores; standalone synthetic/legacy stores retain their existing validation
contract. No actual grading or performance evaluation was run during this mission.

## V4 state and next action

At 2026-09-20T04:54:47.206Z (13:54:47 KST), both committed priority manifests remain
READY in PLAN_ONLY, with zero provider calls. First windows are still future:
Manchester City 21:00/21:20/21:30/21:40 KST;
Atlético 22:15/22:35/22:45/22:55 KST.

Use only the previously committed 14 manifests in
`priority-readiness-v1/poll-job-index.json`, preserving the 16-request budget.
At the matching one-minute window, the existing CLI accepts `--collect`:

```powershell
node --env-file=.env.local --import tsx scripts/run-football-v4-prospective-evidence-v1.ts --date 2026-09-20 --batch round-111-odds-new-v1 --manifest priority-readiness-v1/poll-1557413-0-XI-50.json --collect
```

Do not run this command early or backfill missed windows. The existing 20:50
heartbeat remains a gate check, not an observation or an installed window service.
No real-evidence commit B is made before actual observation exists.

XI, injury and Player Stats observations remain zero; raw row counts are unobserved,
not evidence of no injuries or no lineup. Player Stats is first-page-only; pagination
is not complete and admission remains MORE_DATA_REQUIRED. V4 A/B/C admission false;
no V4 Engine, prediction or shadow. Conditional internal rights remain unchanged.

Preview v5 in `canonicalization-v1/mandatory-previews-v5.json` references only the
canonical IDs and their sealed probabilities. The old batch model object is not
retained as a competing Official value. Existing v3/v4 previews are preserved.
Stage remains PREVIEW_PRE_LINEUP. Append PREVIEW_XI_AVAILABLE only when actual
exact-fixture/team/11-starter/unique-player/registry validation is VALID. Empty XI
means unknown/not yet available. Never auto-correct INVALID evidence.

## Validation and handoff

104 distinct focused tests pass (102 combined, plus two added mirror/preview tests;
updated nine-test canonical suite passes). Full typecheck has zero errors. Tests use
synthetic grades only, never real target outcomes. The preservation audit verifies
47 pregame hashes and six duplicate/mirror files, prior Preview and frozen model.
No original/untracked work is discarded. Review `canonical-registry.json`,
`duplicate-forensics.json`, and `execution-audit.json` in `canonicalization-v1/`.

Do not rerun append-only packaging scripts just to recover context. At the future
window, inspect actual time and committed gates, collect through the existing
collector only, then append an evidence-referenced Preview. Preserve failed claims,
missing windows, incomplete XI and partial Player Stats honestly. Never grade,
recompute or mutate the target Predictions during this pregame mission.

```text
ENGINE STATUS
OFFICIAL_ENGINE=V1
OFFICIAL_MODEL=football-poisson-research-v1
OFFICIAL_ENGINE_CHANGED=NO
RESEARCH_V2_H2_STATUS=RESEARCH_UNPROMOTED
V3_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_FEATURES=xG / Total Shots / Shots on Goal
V3_PROMOTED=NO
V3_1_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_1_HOLDOUT=EXECUTED_ONCE_SCREEN_NO_LAST_VERIFIED
V3_1_PROMOTED=NO
V4_STATUS=PROSPECTIVE_EVIDENCE_READY
V4_PHASE=0.5
V4_IMPLEMENTED_COMPONENTS=Evidence foundation / registry / collector gates
V4_ENGINE_IMPLEMENTED=false
V4_ADMISSION_ALLOWED=false
REAL_PREDICTION_COUNT=45 CANONICAL / 47 ARTIFACTS
GRADED_PREDICTION_COUNT=15 LAST_VERIFIED_NOT_READ_THIS_MISSION
CURRENT_SAMPLE_SIZE=15 LAST_VERIFIED_NOT_REEVALUATED
LATEST_BACKTEST=SEALED_UNCHANGED_NOT_RERUN
LATEST_HOLDOUT=V3.1_2025_SCREEN_NO_NOT_RERUN
PROMOTION_GATE_STATUS=BLOCKED_UNPROMOTED
ENGINE_WEIGHTS_CHANGED=NO
ENGINE_THRESHOLDS_CHANGED=NO
FEATURE_SET_CHANGED=NO

PROGRESS
TODAY_PROGRESS=100% OF_CURRENT_EXECUTABLE_PREWINDOW_WORK
OVERALL_PROGRESS=72% OWNER_BASELINE_UNCHANGED
TODAY_DELTA=+0%p THIS_MISSION_NO_NEW_ESTIMATE
CURRENT_PHASE=V4_PHASE_0.5_PROSPECTIVE_EVIDENCE_READY
CURRENT_ENGINE=V1
NEXT_ENGINE=V4
NEXT_MILESTONE=FIRST_REAL_V4_PROSPECTIVE_EVIDENCE
COMPLETED_TODAY=Canonical policy / prevention / grade exclusion / Preview v5 / tests
BLOCKED_BY=NONE_FOR_CURRENT_PREWINDOW_SCOPE
WAITING_FOR=VALID_V4_OBSERVATION_WINDOWS
```
