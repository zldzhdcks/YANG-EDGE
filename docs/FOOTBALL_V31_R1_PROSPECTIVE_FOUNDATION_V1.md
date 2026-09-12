# FOOTBALL V31 R1 PROSPECTIVE FOUNDATION V1

LAUNCH_READINESS = PROSPECTIVE_SHADOW_READY. This is foundation readiness, not authorization to generate the first real shadow prediction. PROSPECTIVE_SHADOW_EXECUTED = NO.

BASE_SHA = 26ee539eb69409935cfc70737f6d344028e80e06

SOURCE_COMMIT_SHA = abb99da3ec93271d6aecafe951c9085eb580031c

AUDIT_SHA256 = 2578cdec692f366b90f77dc7decdbc1f44007ec86479a6bfd25233bd84581e15

## Binding research status and warm-up role

R1 remains HISTORICAL_RESEARCH_CLOSED_PRIMARY_METRICS_CONFIRMED_SCREEN_NO; MODEL_PROMOTED=NO. Official Forward remains football-poisson-research-v1. R1 is never an Official prediction, Recommendation, Pick, Strong Pick or Edge Pick.

WARMUP_GOVERNANCE_DECISION = ALLOWED_PROSPECTIVE_INPUT_HISTORY_ONLY.

The exposed 2025/26 cohort is not a new confirmation cohort. Its raw observations may supply prior-match history only for a genuinely future season-2026 target whose cutoff is after actual feature/FT retrieval and registry sealing. Every record retains original fixture/team/league/season identity, original providerFetchedAt and raw hash; sealCreatedAt is the actual new registry registration time. No invented earlier storage/retrieval time is used. HOLDOUT_REUSE_FOR_CONFIRMATION=NO.

Import selected no fixtures by wins/losses, goals, prior probabilities or metrics. Past FT scores are retained only to support the future H2 base-history input. No 2025 predictions, metrics, candidate comparison, feature selection, calibration, map/beta refit or class/DRAW repair was executed.

## Append-only observation store

Private root: C:\Users\TCTCTC\YANG-EDGE\YANG-EDGE-INBOX\football-v31-r1-prospective-shadow-v1\V31_R1_PROSPECTIVE_SHADOW

Namespace: V31_R1_PROSPECTIVE_SHADOW. The default root is a sibling inbox, outside the public application and official MODEL_FORWARD store. Official/owner/external namespace roots are rejected. Runtime imports contain no metric evaluator, recommendation or official Forward module.

Each observation has observationId, exact fixture identity, Regular Season FT and completion provenance, original providerFetchedAt, xG/Total Shots/Shots on Goal values and per-team presence/null states, rawResponseSha256, endpoint, collectorVersion, sealCreatedAt and role. The canonical envelope sha256 is its observationHash. Exclusive writes prevent overwrite. Raw references are rehashed on read, and valid projected features are rechecked against the raw response. Old raw bytes were referenced without copying or editing; newly fetched raw bytes are content-addressed in private storage. Identical raw hashes with distinct receipt times remain distinct observation events but one fixture for sample counts.

Registry records=1570: 2025=1446, 2026=124 covering 122 unique current fixtures. Registry SHA256=2028e390b86e64aebf5a7bf05a71aefcc2e38d8392f1ea6971012d674ecc749e.

## 2025 warm-up eligibility census

Actual shared cutoff: 2026-09-12T12:12:49.592Z. Window is inclusive at cutoff minus 365 days; no synthetic 48-hour lag. Counts use one earliest stored future target per league. They describe prior-history availability, not predictions or performance. Team counts refer to the historical observed league universe; they do not imply every current promoted team has sufficient history.

| League | Eligible complete 2025 fixtures | Teams >=5 xG | Teams >=5 Shots | Teams >=5 SOT | Teams all required |
|---|---:|---:|---:|---:|---:|
| EPL | 350 | 20 | 20 | 20 | 20 |
| La Liga | 349 | 20 | 20 | 20 | 20 |
| Serie A | 360 | 20 | 20 | 20 | 20 |
| Bundesliga | 288 | 18 | 18 | 18 | 18 |

2025_WARMUP_ELIGIBLE_FIXTURES = 1347 across the four league-specific census populations. This count will change as the real cutoff/window advances; never hard-code it into prediction.

## Current-season collection

The bounded collector used the retained inventory of 122 season-2026 Regular Season FT fixtures. It preserved 12 already-observed fixtures (including known xG missingness) and made 110 new statistics requests, one per unobserved fixture. It did not requery known missing values to make coverage appear better. Current observation records total 124 because the previous two rechecks remain preserved.

CURRENT_2026_XG_COMPLETE = 118/122

CURRENT_2026_SHOTS_COMPLETE = 122/122

CURRENT_2026_SOT_COMPLETE = 122/122

Missing xG fixture IDs: 1575154, 1570381, 1575164, 1570366. API_ERROR=0; IDENTITY_INVALID=0. Missing/absent/null/errors are receipts, not zeroes. Observation availability must still be selected at each future cutoff; a newer missing response cannot be bypassed with an older complete one.

The official API-Football statistics endpoint was used with current actual response time; raw values stay LOCAL_ONLY. A further four official fixture identity/status checks confirmed eligible genuinely future NS targets. Total API requests=114; no subscription change, scrape, alternate provider or market endpoint.

## Actual-time adapter and matched-input equivalence

The public prediction entry rejects target season 2025 before model access. Season-2025 observations have a history-only role. The prospective selector requires actual providerFetchedAt, completion observation time and sealCreatedAt <= cutoffAt <= predictionCreatedAt < target kickoff. Only prior same-league FT fixtures in the 365-day window are selected. It does not fabricate kickoff+48h timestamps. Same-time conflicting observations are UNKNOWN and excluded; post-cutoff receipts and same/future kickoff rows are excluded. Exact target-own fields and cross-league histories cannot enter.

Feature-specific counts are returned for both teams. Fewer than five valid observations for any required feature returns PASS_INSUFFICIENT_OBSERVED_FEATURE_HISTORY. The frozen feature state, H2 ridge estimator and probability routines are copied with source provenance; only season/temporal contracts differ. The projection/residual arithmetic follows the same ordered frozen equations. No R1 map/beta fitting exists in the prospective path.

Synthetic matched eligible inputs tested q, residual representation, H2 offset, rates and 1X2 probabilities against frozen historical routines (tolerance 1e-12). The test uses the same numeric/base/feature identities; a synthetic target-season metadata change admits the prospective entry while keeping numeric inputs identical. This is an implementation equivalence check, not a 2025 rerun or real forward prediction. H2 fitting occurred only on synthetic test data; no real R1/H2 prediction computation occurred during intake/census.

FINAL_R1_MAP_HASH = 244c2ef4f930855271744e39f0de44598ec6c929ac18edd4c6f72965eb8a4a26

FINAL_R1_BETA_HASH = dc8f9faa4a09429ddfdd46631502375540e25fdbb37f84a1f92f6ceeb21e2ab4

## Pregame and grading foundation

Implemented schema/writers cover target identity, creation/cutoff/seal times, R1 status/probabilities/class, input fixture/observation IDs and hashes, feature counts, H2 provenance, adapter/map/beta hashes and optional read-only official snapshot reference. Target result/stat fields are rejected. Pregame writes are exclusive and must be completed at least 60 seconds before kickoff. A later observation never modifies a sealed input/prediction.

Grades are separate append-only files linked to predictionHash. Only FT with postgame observation time is accepted; PASS correctness=null. Corrections use a new revision with previous hash and reason, preserving all earlier files. These operations were tested in temporary synthetic stores only. Real private fixtures/snapshot and grade directories do not exist. The foundation exposes no first-run CLI; --prepare performs intake/census only and an existing start marker prevents accidental duplicate preparation.

The previously frozen milestone protocol (25/50/100/200 graded PREDICTED targets) remains in force. No milestone is reached here, no performance is reported, and no official/recommendation integration is added.

## Readiness evidence and limits

OBSERVATION_STORE_STATUS=IMPLEMENTED_APPEND_ONLY_HASH_VERIFIED

COLLECTOR_STATUS=OPERATIONAL

ADAPTER_STATUS=IMPLEMENTED_ACTUAL_OBSERVED_TIME

EQUIVALENCE_STATUS=PASS_WITHIN_1e-12_SYNTHETIC_MATCHED_INPUT

TEST_STATUS=PASS (212 tests; strict TypeScript and ESLint PASS).

At census time, 66 still-future stored targets were inspected without calculating probabilities; 48 meet the feature and base-history sample-count gates. Four representative qualifying targets were freshly checked as NS with unchanged exact identity/kickoff: 1557397, 1570377, 1550121, 1575160. Their receipt times/hashes and counts are in the audit. Readiness is point-in-time: first-run code must recheck future status, cutoff, evidence hashes and deadline, and preserve any PASS/numerical failure. No claim is made that all 66 targets will produce a prediction.

All minimum readiness gates passed. PROSPECTIVE_SHADOW_READY does not revoke SCREEN_NO, authorize a first run, promote R1, or predict future performance. Separate CTO first-run authorization is still required.

## Integrity and handoff

3841 pre-existing tracked files and 513 official Forward cache files are byte-unchanged. 1570 observation raw references were verified. Existing untracked access-gate doc preserved. Source hash=a20c9a29d2764cd8dff1b254d48b326793ef73bc3beba381f9e9af2ceee32d58. No raw responses or API keys are committed; only source/tests then docs/audit.

Cursor handoff: read this report and the sealed audit, then use the private foundation READY_CENSUS.json and observation registry. Do not rerun --prepare or historical/holdout evaluators. Continue only after CTO first-run authorization; revalidate current target status and frozen source/parameter hashes at that time. Local verification/work receipts are at C:\Users\TCTCTC\YANG-EDGE\YANG-EDGE-INBOX\football-v31-r1-foundation-work-v1.

PROSPECTIVE_SHADOW_EXECUTED=NO

MODEL_PROMOTED=NO

FORWARD_MODEL_CHANGED=NO

RECOMMENDATION_ENGINE_CHANGED=NO

HOLDOUT_REUSE_FOR_CONFIRMATION=NO

FOOTBALL_V31_R1_PROSPECTIVE_FOUNDATION_V1_READY_FOR_CTO_REVIEW
