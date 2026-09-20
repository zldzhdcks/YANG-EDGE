# YANG EDGE — V4 XI PARTIAL EVIDENCE CONTRACT FIX V1

## Outcome

XI classification fixed and tested. READINESS_FINAL=FAIL; production collection was not started.
The original one-team TEAM_COUNT blocker is resolved. A separate offline negative-input probe proved that the existing collector stores unexpected target-result/live/postgame fields unchanged inside payload.raw. This violates the mission's contamination-exclusion contract. No actual target result/live/postgame data was accessed. The response-filter/provider implementation was not changed because this mission authorizes only XI contract/types/tests/readiness changes.

## Recovery

BRANCH=agent/cursor/football-v31-third-real-batch-preflight-v1
HEAD_START=6122b0ed17818cccacde1f3384d074a1927037b4
REMOTE_HEAD_START=6122b0ed17818cccacde1f3384d074a1927037b4
WORKTREE_START=Tracked clean; pre-existing unrelated untracked files preserved

## Root cause and fix

OLD_BEHAVIOR=One-team XI returned INVALID/TEAM_COUNT
CONTRACT_CONFLICT=Valid partial observation must remain INCOMPLETE
REPRODUCED=YES
UNKNOWN_DEFINED=YES; no observed starter/substitute evidence and no identity/structural error
INCOMPLETE_DEFINED=YES; partial/missing team or unresolved membership
CONFIRMED_COMPLETE_DEFINED=YES; exact 11+11, valid identity, no duplicates/conflicts
INVALID_DEFINED=YES; structural/fixture/team/orientation/player conflicts remain rejected

New writes use the four explicit XI statuses. Collector envelope identity, availability flag and coverage consumers recognize CONFIRMED_COMPLETE. Read-only legacy VALID evidence remains compatible. The preview XI validator adapter accepts both stored legacy/new labels but always revalidates to CONFIRMED_COMPLETE; this is status compatibility only, not a V1 calculation or UI change. No historical artifact was rewritten.

FILES_CHANGED=
- src/lib/football/v4-prospective-evidence-v1/validate.ts
- src/lib/football/v4-prospective-evidence-v1/collector.ts (status consumers only)
- src/lib/football/official-canonical-v1/rich-preview-xi.ts (XI status compatibility only)
- scripts/test-football-v4-prospective-evidence-v1.ts
FILES_CREATED=
- scripts/audit-v4-xi-partial-readiness-v1.ts
- data/audits/2026-09-20-v4-xi-partial-readiness-recheck-v1.json
- docs/research/V4_XI_PARTIAL_EVIDENCE_CONTRACT_FIX_V1.md

## Test matrix

ZERO_ZERO=PASS_UNKNOWN
ELEVEN_ZERO=PASS_INCOMPLETE
ZERO_ELEVEN=PASS_INCOMPLETE
ELEVEN_SEVEN=PASS_INCOMPLETE
PARTIAL_PARTIAL=PASS_INCOMPLETE
ELEVEN_ELEVEN=PASS_CONFIRMED_COMPLETE
COUNT_OVER_11=PASS_INVALID
DUPLICATE=PASS_INVALID_DUPLICATE_PLAYER
WRONG_TEAM=PASS_INVALID
WRONG_FIXTURE=PASS_INVALID
ORIENTATION_CONFLICT=PASS_INVALID
TYPECHECK=PASS
TESTS=84/84_PASS

Commands:

    node --import tsx --test scripts/test-football-v4-prospective-evidence-v1.ts scripts/test-priority-registry-readiness-v1.ts scripts/test-rich-preview-v2.ts scripts/test-atletico-showcase-v1.ts
    node node_modules/typescript/bin/tsc --noEmit
    node --import tsx scripts/audit-v4-xi-partial-readiness-v1.ts

The third command is a separate readiness diagnostic, not a passing isolation regression: forbiddenFieldsPersisted=true, readiness=FAIL. It uses a temporary synthetic store and deletes it. It does not fetch a provider, use real results or create production evidence. Original 215 protected artifacts match their prior SHA256 values. Partial-to-complete append-only preservation and late-window rejection tests pass.

## Readiness

MAN_CITY_READY=IDENTITY_REGISTRY_MANIFEST_PASS_COLLECTION_BLOCKED
ATLETICO_READY=IDENTITY_REGISTRY_MANIFEST_PASS_COLLECTION_BLOCKED
XI_VALIDATOR_READY=YES
TEMPORAL_VALIDATOR_READY=YES
IMMUTABLE_STORE_READY=YES
MEMBERSHIP_READY=YES
REGISTRY_READY=YES
MANIFEST_READY=YES_14_OF_14_PLAN_ONLY
BUDGET_READY=YES_14_PLANNED_16_LIMIT_0_RESERVED_16_REMAINING
API_KEY_AVAILABLE=YES_VALUE_NOT_DISCLOSED
APPROVED_PROVIDER_ONLY=YES_NO_ENDPOINT_CHANGE
READINESS_FINAL=FAIL
BLOCKER=UNFILTERED_RAW_PROVIDER_FIELDS_PERSISTED_TO_PREGAME_EVIDENCE

Plan-only CLI validated all 14 committed manifests, identity proofs, registry hashes, rights and poll plans. Membership counts: City 25, Sunderland 37, Atlético 33, Real Madrid 38. This is registry coverage, not confirmed XI. Existing plan-only READY does not check payload contamination, so it is not an overall readiness pass.

## Window status

AUDIT_TIME_KST=2026-09-20T19:58:48.8228638+09:00
MAN_CITY_21_00=FUTURE_READINESS_BLOCKED
MAN_CITY_21_20=FUTURE_READINESS_BLOCKED
MAN_CITY_21_30=FUTURE_READINESS_BLOCKED
MAN_CITY_21_40=FUTURE_READINESS_BLOCKED
ATLETICO_22_15=FUTURE_READINESS_BLOCKED
ATLETICO_22_35=FUTURE_READINESS_BLOCKED
ATLETICO_22_45=FUTURE_READINESS_BLOCKED
ATLETICO_22_55=FUTURE_READINESS_BLOCKED
COLLECTION_STARTED=false
PROVIDER_CALLS=0
NEW_EVIDENCE=0_PRODUCTION
WINDOWS_MISSED=0_AS_OF_AUDIT
WINDOWS_EXECUTED=0
SCHEDULE_STARTED=false

## Integrity

BACKFILL_USED=false
TARGET_RESULT_ACCESSED=false
LIVE_DATA_ACCESSED=false
POSTGAME_DATA_ACCESSED=false
OLD_EVIDENCE_OVERWRITTEN=false
PROTECTED_ARTIFACT_HASHES=215/215_UNCHANGED
OFFICIAL_ENGINE=V1
V1_CHANGED=false
V4_ENGINE_IMPLEMENTED=false
V4_ADMISSION_ALLOWED=false
FEATURE_SET_CHANGED=false
PLAYER_IMPACT_PROMOTED=false
LINEUP_STRENGTH_DELTA_PROMOTED=false

FINAL=XI_CONTRACT_FIXED_READINESS_BLOCKED_RESULT_FIELD_ISOLATION

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
V4_STATUS=XI_CONTRACT_FIXED_COLLECTION_READINESS_BLOCKED
V4_PHASE=0.5
V4_IMPLEMENTED_COMPONENTS=Registry / Membership / Temporal / XI / Availability / Immutable store
V4_ENGINE_IMPLEMENTED=false
V4_ADMISSION_ALLOWED=false
REAL_PREDICTION_COUNT=45_LAST_VERIFIED
GRADED_PREDICTION_COUNT=15_LAST_VERIFIED
CURRENT_SAMPLE_SIZE=15_LAST_VERIFIED
COUNT_REFERENCE=ENGINE_STATUS_REPORTING_RULE_V1.md; 2026-09-17T00:27:32.147Z; not refreshed by reading results
LATEST_BACKTEST=EXISTING_SEALED_RESEARCH_NO_RERUN
LATEST_HOLDOUT=V3/V3.1_SCREEN_NO_EXISTING_STATUS
PROMOTION_GATE_STATUS=NO_PROMOTION
ENGINE_WEIGHTS_CHANGED=NO
ENGINE_THRESHOLDS_CHANGED=NO
FEATURE_SET_CHANGED=NO

## PROGRESS

TODAY_PROGRESS=XI_FIX_AND_RECHECK_COMPLETE_COLLECTION_BLOCKED; overall daily percentage not reestimated
OVERALL_PROGRESS=72%_OWNER_BASELINE
TODAY_DELTA=+0%p_THIS_MISSION
CURRENT_PHASE=V4_PHASE_0.5_COLLECTION_READINESS_BLOCKED
CURRENT_ENGINE=V1
NEXT_ENGINE=V4
NEXT_MILESTONE=FIRST_REAL_V4_PROSPECTIVE_EVIDENCE
COMPLETED_TODAY=XI four-state contract / 84 tests / typecheck / 14 manifest checks / protected hash audit
BLOCKED_BY=UNFILTERED_RAW_TARGET_FIELDS
WAITING_FOR=Separate payload-isolation correction and readiness revalidation; no collection scheduled
