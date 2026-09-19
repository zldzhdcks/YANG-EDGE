# YANG EDGE — FOOTBALL V3 CLOSURE + V4 RESEARCH ADMISSION DESIGN V1

Protocol version: V1. Status: V4_RESEARCH_PROTOCOL_READY.
This seals a research governance design, not an algorithm, model admission, data acquisition, shadow launch, or Official promotion. Proposed numerical prospective policy below requires a separate ratification before enrollment. No engine implementation is authorized by this artifact.

## 1. Recovery and closure

Base HEAD: aa28b4241d8b72f6c62c9a0369aa65ca46ffa34b.
Branch: agent/cursor/football-v31-third-real-batch-preflight-v1.
Existing dirty files and prior local revalidation evidence are preserved. No commit/push in this mission.

OFFICIAL_ENGINE=V1; OFFICIAL_MODEL=football-poisson-research-v1.
V3_STATUS=RESEARCH_CLOSED_UNPROMOTED; V3_1_STATUS=RESEARCH_CLOSED_UNPROMOTED.
V3_FINAL=V3_HOLDOUT_FAIL; F1=SCREEN_NO; F2=SCREEN_NO; F3=SCREEN_NO.
V3_1_R1=SCREEN_NO; V3_1_R3=SCREEN_NO. Neither line is promoted.

Closure evidence:
- `data/audits/football-v3-revalidation-gate-v1.json`: 2023/2024 fixed-parameter predictions and metrics reproduced, 24/24 combinations. Its original-runtime SEASON_FIREWALL finding is a preflight state superseded by the isolated evaluation path.
- `data/audits/football-v3-revalidation-execution-freeze-v1.json`: source sealed before execution.
- `data/audits/football-v3-2025-revalidation-holdout-v1.json`: one evaluation, 1,446 fixed targets, 1,343 paired and 103 preserved PASS per candidate; all three global SCREEN_NO. SHA256 payload `0d8355651a6d3c419a01ea8a2a5ede51e2ab25b1bc14fd9bb00aa87accfb5533`.
- `data/audits/football-v31-2025-independent-holdout-evaluation-v1.json`: R1/R3 SCREEN_NO; original screen objects independently rechecked in the V3 reproduction audit.
- `docs/research/FOOTBALL_V3_REVALIDATION_GATE_V1.md`: per-league/class evidence and temporal limitations.

Temporal publication/revision provenance remains unresolved. The 2025 cohort is exposed, including through V3.1. No V3 feature retuning, threshold change, optimization on the same 2025 cohort, or renaming V3 as V4 is permitted. Preserve all existing snapshots, source hashes, fitted parameters, results, and failures. This closure does not mutate previously sealed evidence or retroactively alter any separately sealed shadow record.

## 2. Preserved knowledge, not admitted features

Retain xG, Total Shots and Shots on Goal research as descriptive evidence. V3 improved pooled LL/Brier versus V1, but failed all-league and class guards, often versus H2. Retain league-specific behavior, DRAW Brier and calibration failures, and La Liga F2's isolated league pass. That pass does not justify selecting a league after seeing results. Historical final/revised feature availability cannot be treated as actual pregame observation.

These findings inform questions only. They do not automatically admit V3 features, coefficients, thresholds, or a V3 baseline into V4.

## 3. V4 purpose and scope

V4 is a separate frozen research candidate line studying Starting XI, player availability, Injury/Suspension, and eventually player/lineup strength changes. Official V1 is the required baseline. H2 and V3 can be descriptive references only; they are not newly promoted baselines.

Target scope is the four leagues 39/140/135/78. Any expansion requires a new pre-outcome protocol version. No weights, player-impact scores, probability mappings, optimizers, or engine are defined or implemented here.

## 4. Phase 0 audit

Evidence: `docs/FOOTBALL_V4_PHASE0_IMPLEMENTATION_V1.md`, its audit JSON, and source under `src/lib/football/{v4-phase0-foundation-v1,pregame-player-xi-foundation-v1,player-context-foundation-v1}/`.

- PLAYER_IDENTITY=IMPLEMENTED_PARTIAL. Provider ID, unresolved and explicit mapped states exist. Names are display-only. A caller must supply a verified canonical mapping for MATCHED. Normalizers do not supply it; a production canonical player registry is missing.
- TEAM_PLAYER_MAPPING=PROVIDER_ATTACHMENT_PRESENT_CANONICAL_MAPPING_UNPROVEN. Provider team/player IDs and squad records are preserved; transfer-effective identity and canonical registry evidence are not established.
- LINEUP_NORMALIZATION=IMPLEMENTED. startXI/substitutes and raw positions are preserved. Empty response means NOT_AVAILABLE. CONFIRMED_XI requires caller-supplied OFFICIAL_CONFIRMED semantics; payload presence alone is insufficient. Admission must verify exactly 11 distinct starters per side even though the current normalizer can accept 11 or more.
- STARTING_XI=REPRESENTATION_IMPLEMENTED_REAL_COMPLETE_EVIDENCE_NOT_ESTABLISHED. Do not infer confirmed XI from predicted XI or an unclassified feed. Existing Phase 0 audit records nonempty XI capture as outstanding; no new live capture was made here.
- INJURY_NORMALIZATION=IMPLEMENTED. Raw reason/type retained; UNKNOWN remains unknown; absent injury rows do not mean available.
- SUSPENSION_MODEL=REPRESENTATION_ONLY. Explicit suspension/red-card mapping exists; fixture-effective eligibility, complete suspension coverage and any suspension impact model are not established.
- PLAYER_AVAILABILITY=PARTIAL_STATUS_REPRESENTATION. Not a complete healthy/available roster.
- TEMPORAL_PROVENANCE=CLASSIFIER_IMPLEMENTED_ADMISSION_INCOMPLETE. observedAt, fetchedAt and optional publication clocks exist. Current helper checks kickoff, not a distinct earlier model cutoff; it does not establish complete clock ordering or per-section provenance.
- SNAPSHOT=BUILDER_AND_APPEND_ONLY_WRITER_IMPLEMENTED. engineAdmission remains false; caller-supplied clocks must not be fabricated. No persistence/capture operation is launched here.
- COVERAGE=STRUCTURAL_EVALUATOR_IMPLEMENTED. READY/PARTIAL/MISSING/BLOCKED categories are not measured league-level admission percentages.
- PLAYER_IMPACT_MODEL=NOT_IMPLEMENTED. Score/strength/penalty fields remain null. `/fixtures/players` client remains unimplemented.

## 5. Data source and rights gate

Planned primary source is API-Football official API. Existing adapters, not endpoint existence alone, determine implementation status. No provider API calls or scraping occur in this mission. Official documentation: https://www.api-football.com/documentation-v3 ; terms checked: https://www.api-football.com/terms . The documentation page was not text-extractable in this check; endpoint implementation/field claims below are grounded in repository adapters, not a new live availability test.

Common LICENSE_STATUS=CONDITIONAL_INTERNAL_USE, not formal rights clearance. Retention guidance is owner-reported dashboard Chat AI only; HUMAN_SUPPORT_CONFIRMATION=NO; FORMAL_WRITTEN_LICENSE=NO. That prior guidance does not establish new player-data-specific rights. Each feature's usage/retention scope must be documented before admission. Public/commercial rights remain UNRESOLVED; provider terms do not grant third-party competition publication/commercial rights. No public raw player-data release.

For each type, OFFICIAL_API=YES as a proposed source route; COLLECTION_METHOD=authorized API fetch into private immutable evidence, never HTML scraping. Actual pregame coverage and per-feature temporal proof are NOT_ESTABLISHED:

- Starting XI: `/fixtures/lineups`; existing client/normalizer. PREGAME_AVAILABLE=CONDITIONAL_NOT_GUARANTEED. TEMPORAL_PROVENANCE_AVAILABLE=LOCAL_FETCH_ONLY_PARTIAL; providerPublishedAt null. Require verified official lineup semantics.
- Injury: `/injuries`; existing client/normalizer. PREGAME_AVAILABLE=CONDITIONAL; absence not health. Temporal status as above; observe record and applicable fixture before cutoff.
- Suspension: explicit status/reason through `/injuries`; separate comprehensive suspension feed not verified. PREGAME_AVAILABLE=UNVERIFIED_FOR_COMPLETE_COVERAGE; temporal and fixture-effective scope required.
- Player minutes: `/players` season aggregates available in existing normalization; fixture-level `/fixtures/players` route not implemented. Past completed matches only. Latest season total cannot reconstruct an earlier cutoff. PREGAME_AVAILABLE=ONLY_IF_ACTUALLY_ARCHIVED_BEFORE_CUTOFF; temporal proof not established.
- Player rating: `/players` normalization preserves rating; provider methodology and time window not established for admission. Target-match rating forbidden. PREGAME_AVAILABLE=PRIOR_OBSERVATIONS_ONLY; TEMPORAL_PROVENANCE_AVAILABLE=NOT_ESTABLISHED.
- Player statistics: `/players`, with `/players/squads` for context; existing adapters. Historical season-final totals not pregame evidence. Only cutoff-bounded immutable observations may qualify; missing fields stay missing.
- Team statistics: existing `/teams/statistics` client. Current aggregates can contain later matches; must archive their actual time and define the included match population. Neither automatic V4 feature adoption nor historical reconstruction is allowed.

## 6. Temporal and identity admission

Every admitted feature must carry source/provider/endpoint, provider fixture/team/player identity, raw and normalized hashes, observedAt, collectedAt (actual fetch completion), asOf, scheduledStart, model cutoffAt, snapshotCreatedAt, and revision/source version. Timestamps are UTC instants; scheduledStart is the locked authoritative kickoff version.

Require actual collection/observation <= asOf <= cutoffAt < scheduledStart, and pregame snapshot/prediction creation <= cutoffAt with at least the existing 60-second kickoff margin. asOf is the latest justified input-availability bound, never an invented provider publication time. Snapshot creation cannot predate collection. Cache hits retain the original fetchedAt. Validate clocks per source section, not just a top-level envelope.

Provider publication time is retained separately when available. Current Phase 0 strict verification requires it; missing publication clocks remain TEMPORAL_PARTIAL and do not qualify under this protocol. A future alternative proof using authenticated fetch receipts would require a separate explicit temporal-contract amendment before admission; do not silently relax the existing classifier here.

Any unproven clock, target-result field, post-cutoff revision, future history, fabricated observedAt, identity mismatch, fuzzy mapping, or post-kickoff input bars admission. Unknown proof is TEMPORAL_UNVERIFIED. Historical later-fetched data cannot be backdated. Target score/rating/minutes are not pregame features. Historical results may only enter a future defined training design when actually observable by its cutoff.

## 7. Feature admission record

Required record per version/league/source: FEATURE_NAME, SOURCE, TEMPORAL_SAFE, COVERAGE numerator/denominator and period, MISSING_RATE, IDENTITY_SAFE, REPRODUCIBLE, rightsEvidenceHash, inputSchemaHash, transformVersion, ADMISSION_STATUS and reasons.

Coverage denominator is every authoritative in-scope fixture in the predeclared capture interval, including provider outages and missing records. Report by league and feature; unknown coverage is null, never zero or 100%. No selection on results. A complete unit requires both teams and all required player fields. Coverage and missingness are complementary only for the same binary unit; unresolved identity/time are separately counted.

ADMIT requires documented rights scope, verified exact identity, temporal proof for every used observation, hash-reproducibility, and the candidate's predeclared coverage/missingness contract. REJECT applies to forbidden/post-cutoff/incorrect-source inputs. MORE_DATA_REQUIRED applies to missing proof or unmeasured coverage. Missing required candidate data yields a recorded research PASS; never default zero or healthy. Candidate quantitative coverage thresholds must be frozen in its algorithm contract before results; none are invented as existing Phase 0 measurements.

Current registry: Starting XI, injury, suspension, minutes, rating, player statistics, team statistics all MORE_DATA_REQUIRED. COVERAGE=null; MISSING_RATE=null; TEMPORAL_SAFE=UNPROVEN; IDENTITY_SAFE=PARTIAL; REPRODUCIBLE=ADAPTER_PRESENT_RUNTIME_EVIDENCE_INCOMPLETE. ADMITTED_FEATURE_COUNT=0.

## 8. Player impact research design

Permitted design inputs to investigate are provider-observed minutes, position/role tokens, confirmed lineup inclusion, explicitly reported injury/suspension, and historical team-player membership with effective dates. These are observations, not impact weights. Provider rating is a provider statistic, not a validated causal impact score.

Starting probability, replacement quality, recent-minute aggregation windows and player-strength change are NOT_DEFINED / NOT_ADMITTED. They need a separately frozen estimator, training-only population, missingness handling and reproducible evidence. No arbitrary star-player, goalkeeper, injury penalty, or availability multiplier. This protocol does not fabricate a new metric from an example list.

## 9. Candidate registry and versioning

Design-only IDs follow the existing football-v4 naming family:
- football-v4-a-xi-v1: confirmed Starting XI availability/representation only.
- football-v4-b-availability-v1: A plus explicitly evidenced injury/suspension availability.
- football-v4-c-player-impact-v1: A plus a separately specified, admitted historical player-impact layer; does not inherit B implicitly.

All are DESIGN_ONLY, admission=false, implementation=false. These scopes are frozen; exact transformations, training rules, cutoffs, numerical algorithms and missing-data thresholds remain execution blockers requiring a later pre-outcome algorithm freeze. Do not claim these are executable candidates. A failed candidate does not authorize adjusting another candidate or silently changing the same ID. New source/feature/weight/threshold/estimator requires a new version and new untouched evaluation cohort. Preserve old output and declare the multiple-candidate family.

## 10. Baseline, metrics and league guards

Same target, same cutoff, same identity and input-snapshot envelope for V1 Official and candidate Shadow. V1 only consumes its permitted inputs; it must not ingest player or market fields from the shared envelope. H2/V3 references have no promotion veto or baseline status under V4.

Reuse the frozen V3 metric definitions (multiclass LogLoss/Brier, accuracy, HOME/DRAW/AWAY recall, precision, OVR Brier, fixed-bin ECE and calibration counts). Record the exact evaluator hash at algorithm freeze. Do not introduce adaptive bins or replacement metrics after outcomes.

Proposed V4 numerical review screen against V1, separately in ALL FOUR leagues: LogLoss and Brier delta < -1e-12; class recall delta >= -0.05-1e-12; class ECE delta <= 0.01+1e-12; class OVR Brier delta <= 1e-12; all actual classes present; null required metric => INSUFFICIENT. Accuracy and precision are reported, not substituted for these guards. Zero integrity INVALID and numerical FAIL. Every denominator ID retained. No pooled-average or isolated-league promotion.

Historical U>=100 per league and U/N>=80% are CONFIRMED_HISTORICAL_SCREEN conditions only. They are not a pre-existing prospective Official rule. This protocol proposes their numerical reuse for the prospective final review below, explicitly as a NEW proposal.

## 11. Prospective sample proposal

OFFICIAL_MIN_SAMPLE_FOUND=false. Existing N=25/50/100/200 Forward checkpoints are review-only. N<100 does not support engine changes; N=100 internal research review; N=200 is not automatic validation.

NEW_PROPOSED_POLICY, NOT_AN_EXISTING_OFFICIAL_RULE: retain pooled distinct paired graded fixture checkpoints 25/50/100/200 for descriptive review with league breakdown. No tuning or early success declaration. Proposed final evidence floor: at least 100 paired graded fixtures in each of the four leagues (therefore total >=400), with candidate coverage >=80% of all locked in-scope fixtures per league and all required class metrics defined. PASS, duplicates, revisions and grades from other versions do not increase N. One fixture can contribute once per candidate; candidate counts cannot be summed as independent samples.

Enroll consecutive authoritative fixtures after the fully frozen candidate/admission/training/cutoff policy, before their kickoff, and follow complete locked daily slates. Final review boundary is the first completed slate prefix meeting the grade-based count floors for each candidate; outcomes cannot choose the stopping point. Pending/ungradable records remain visible; grade-completion policy and any maximum collection duration must be frozen before enrollment. No result-dependent exclusion or favorable-boundary search. A withdrawn/changed candidate cannot reuse this exposed sample for a fresh success claim.

This floor is a feasibility/review proposal, not a power calculation or proof of efficacy. Before launch, the independent reviewer must ratify the sample plan, dependence/uncertainty analysis and multiple-candidate handling using no final-holdout outcomes. Until then PROSPECTIVE_ENROLLMENT_ALLOWED=false. Passing the numerical screen makes a candidate eligible for CTO review only. Official promotion additionally requires rights, identity/time, reproducibility, holdout and operational safety review, and explicit owner/CTO decision. No automatic promotion N exists.

## 12. Holdout policy

HOLDOUT_STATUS=HOLDOUT_NOT_AVAILABLE_YET. The exposed 2023/2024/2025 cohorts are not a new V4 independent holdout. No verified untouched alternative cohort has been located or opened in this mission.

Order: data rights/provenance audit -> outcome-blind feature admission -> training-only development and algorithm/parameter/threshold/source freeze -> prospective policy ratification -> seal a new unseen enrollment rule/cohort -> pregame shadow -> separate grading -> single final evaluation.

A future prospective cohort is eligible only for fixtures first enrolled after all freezes. No optimization on its results. Development, exploratory monitoring and final evaluation access must have separate roles/artifacts; interim descriptive exposure must be disclosed and cannot be relabeled blind. Source/hash mismatch invalidates execution. Corrections retain original evidence and require documented independent integrity adjudication, not favorable reruns.

## 13. Shadow separation and operations

Design namespaces: OFFICIAL_PREDICTION and V4_SHADOW_PREDICTION. Candidate/version-specific private research artifacts contain target identity, cutoff, input/source/model/parameter hashes, predictionCreatedAt, status/reason/probabilities and immutable snapshot hash. Postgame labels/grades join in separate artifacts by identity and prediction hash. No overwrite or post-kickoff backfill.

Shadow is not a user-facing Pick, not an Official terminal decision, and must not satisfy Official coverage. Official target -> exactly one legitimate Official Prediction/PASS remains separate. Shadow maintains its own full target denominator, PASS/missed/pending counts. No model or market input crosses layers. Preserve the Official V1 schedule; no V4 launch today or on the next slate while admission is false.

## 14. Prohibitions and next exact mission

No engine implementation, fitting, backtest, prediction, grade, provider capture, weight/threshold/feature mutation, public UI work, V4 graduation, V3 retuning/renaming, outcome-based selection, fabricated clocks, scraping or fuzzy identity. No engine/source file is changed by this protocol.

Next mission: V4 outcome-blind evidence admission audit. Establish player-data usage scope, exact fixture/team/player mappings, nonempty officially confirmed XI evidence, fixture-effective injury/suspension semantics, and per-section cutoff-safe provenance. Measure coverage/missingness on a predeclared authoritative capture scope without model outcomes. Live capture requires a separately scoped capture mission; this document does not execute it. Return feature ADMIT/REJECT/MORE_DATA_REQUIRED records and blockers. Only after admission should a numerical algorithm-design freeze be commissioned.

## 15. ENGINE STATUS

OFFICIAL_ENGINE=V1
OFFICIAL_MODEL=football-poisson-research-v1
OFFICIAL_ENGINE_CHANGED=false
RESEARCH_V2_H2_STATUS=RESEARCH_UNPROMOTED
V3_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_FEATURES=xG / Total Shots / Shots on Goal (closed research)
V3_PROMOTED=false
V3_1_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_1_HOLDOUT=R1_SCREEN_NO; R3_SCREEN_NO
V3_1_PROMOTED=false
V4_STATUS=RESEARCH_ADMISSION_PROTOCOL_READY_FOUNDATION_PARTIAL
V4_PHASE=0
V4_CANDIDATE=A/B/C_DESIGN_ONLY
V4_FEATURE_SET=NONE_ADMITTED
V4_IMPLEMENTED_COMPONENTS=identity states; lineup/injury normalization; temporal classifier; snapshot/coverage foundation
V4_ENGINE_IMPLEMENTED=false
V4_ADMISSION_ALLOWED=false
V4_SHADOW_SAMPLE_N=0 (admitted A/B/C candidates; not Phase 0 records)
V4_GRADED_SAMPLE_N=0 (same scope)
REAL_PREDICTION_COUNT=45 (last audited Official Forward)
GRADED_PREDICTION_COUNT=15 (same audit)
CURRENT_SAMPLE_SIZE=15
OFFICIAL_SAMPLE_N=15
COUNTS_AS_OF=2026-09-17T00:27:32.147Z; NOT_REFRESHED
LATEST_BACKTEST=V3 2023/2024 reproduction; prior V3.1 2024 exposed research
LATEST_HOLDOUT=V3 2025 revalidation SCREEN_NO
PROMOTION_GATE_STATUS=BLOCKED
PROMOTION_GATE=NO_ADMITTED_V4_FEATURES_OR_UNSEEN_HOLDOUT
ENGINE_CHANGED=false
ENGINE_WEIGHTS_CHANGED=false
WEIGHTS_CHANGED=false
ENGINE_THRESHOLDS_CHANGED=false
THRESHOLDS_CHANGED=false
FEATURE_SET_CHANGED=false
FINAL=V4_RESEARCH_PROTOCOL_READY
