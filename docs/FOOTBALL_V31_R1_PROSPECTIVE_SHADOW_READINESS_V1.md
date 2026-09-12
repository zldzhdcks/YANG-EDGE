# FOOTBALL V31 R1 PROSPECTIVE SHADOW READINESS V1

PROSPECTIVE_SHADOW_READINESS = PROSPECTIVE_SHADOW_PARTIAL (B only).

The stored evidence supports a partial data foundation, not an operational launch. LAUNCH_READY = NO. The historical R1 runner cannot be used directly for prospective prediction. This mission audits existing data and fixes a prospective protocol; it does not implement or run it.

BASE_SHA = feef9492a15035d0a25be56c4234de6b5f5150d1

AUDIT_OBSERVED_AT = 2026-09-12T11:47:16.552Z

AUDIT_SHA256 = 108d914b39b48c413585b27635efbc4df170831fdc625a6ff9488158aed4f09b

## Actual stored current-season evidence

At the retained provider inventory times on 2026-09-12 around 06:02–06:03 UTC, 122 Regular Season FT fixtures existed in the four season-2026 inventories (1,446 total scheduled fixture records). These are stored observations, not a fresh provider count at this audit time. No API call was made.

There are 12 unique current fixtures with feature responses: 14 retrieval events because two fixtures were checked twice. Only 12 unique raw hashes exist. xG is valid on both teams in 10/12 sampled fixtures; Total Shots and Shots on Goal in 12/12. The other 110 FT fixtures have no locally identified feature observation in this scope; that is not proof the provider lacks their statistics.

| League | FT in stored inventory | Unique feature fixtures | xG complete | Shots complete | SOT complete | Not locally collected |
|---|---:|---:|---:|---:|---:|---:|
| EPL | 30 | 3 | 3 | 3 | 3 | 27 |
| La Liga | 42 | 3 | 2 | 3 | 3 | 39 |
| Serie A | 31 | 3 | 3 | 3 | 3 | 28 |
| Bundesliga | 19 | 3 | 2 | 3 | 3 | 16 |

Each league has only three distinct sampled fixtures. Even a team appearing in all three cannot meet the frozen minimum of five valid matches per team per required feature. Current-2026 samples alone therefore cannot support a PREDICTED R1 target. This is a sufficiency bound, not a model execution or an assertion about uninspected full 365-day history. No 2025 holdout raw data was repurposed as warm-up.

## Temporal provenance and immutability

Raw response bytes, exact fixture-request binding, both team IDs, linked league/season/kickoff/FT metadata and actual providerFetchedAt can be joined and hash-verified for all 14 events. Original collection used exclusive writes; two later rechecks retain separate receipt times. Existing manifests hash-bind evidence. This establishes recoverable, tamper-evident observations; it does not claim WORM storage or an implemented prospective feature store.

The 67 existing official snapshots were created between 2026-09-12T03:19:33.939Z and 03:19:35.301Z. Initial current features were fetched between 06:02:47.295Z and 06:03:21.175Z, with two rechecks at 06:30. Every sampled receipt therefore postdates the old official cutoff. None may be retroactively inserted into those predictions, even if the target kickoff is still in the future. No R1 past snapshot was created.

The JSON includes per-prior-fixture/per-feature states for all 122 stored FT fixtures and per-official-target temporal counts. OBSERVED_BEFORE_TARGET means complete verified evidence available by the locked cutoff; OBSERVED_AFTER_TARGET means all receipts are later; MISSING distinguishes not-collected from actual absent/null; UNKNOWN covers unresolvable timestamp/identity/provenance. Field availability and receipt timing are separate. Missing seen later cannot prove missing at an earlier time.

For statusAtAudit, the audit timestamp is only a reference for checking already retained data. It is not a fabricated predictionCreatedAt and does not generate a prospective prediction. Original publication time and unrecorded earlier revisions remain unknown.

## Known xG gaps and fail-closed behavior

- La Liga 1570381: both team xG fields absent at 06:03:01.873Z and 06:30:52.971Z on 2026-09-12. SHA256 d9496e7c03bc32d1544727990e41106e689b954c5843a86f2865708a4f2d5a26 at both observations.
- Bundesliga 1575164: both team xG fields absent at 06:03:21.175Z and 06:30:53.354Z. SHA256 26b28e39bdfab359741d523972c0439a6b16b59e48a4ec9443696b312e381321 at both observations.

Shots and SOT are present in these responses. The repeat hashes are unchanged evidence, not additional training matches. Two missing observations establish neither permanent absence nor a general release delay.

The frozen feature code returns null for absent/null fields, removes only that feature's unavailable rows, and requires five observations for both teams before computing the feature state. There is no imputation. One missing prior xG row is not automatically a whole-target PASS if enough other valid rows exist. If actual observed required history is insufficient, the prospective adapter must emit PASS_INSUFFICIENT_OBSERVED_FEATURE_HISTORY with per-feature/team counts and excluded observation IDs.

Runtime prospective fail-closed behavior is NOT_IMPLEMENTED_NOT_TESTED. The historical code's PASS_INSUFFICIENT_FEATURE_HISTORY and synthetic temporal selector are not proof that the requested observed-time PASS path works. This audit confirms missing raw evidence and the historical missingness logic by inspection; it does not execute R1 on current data.

## Prospective protocol: observation and input contract

Namespace: V31_R1_PROSPECTIVE_SHADOW. Proposed private sibling-inbox root: football-v31-r1-prospective-shadow-v1. Do not write through the official MODEL_FORWARD namespace or an existing official writer. References to official snapshots are read-only. Separate envelopes may expose officialForwardPrediction and r1ShadowPrediction to an internal research comparison only; never feed them into recommendations or public picks.

Each prior feature observation must retain fixtureId, leagueId, season, both team IDs, kickoffUtc, FT status evidence, actual feature/status providerFetchedAt, exact endpoint, xG/Total Shots/Shots on Goal values and absence states, raw response hash, observation ID and evidence seal timestamp/hash. Raw values remain private. Re-fetches append new observations; no overwritten or backdated values. Conflicting identities/timestamps fail closed.

Set cutoffAt at actual input lock, no later than predictionCreatedAt. Select only same-league Regular Season FT prior matches inside the unchanged 365-day window measured from cutoff, with actual FT and feature observations <= cutoffAt. Prior kickoff must precede cutoff and target kickoff. No synthetic kickoff+48h eligibility rule is permitted. The target's score, xG, Shots and SOT never enter input. Same-kickoff targets use an immutable evidence view.

Select the latest receipt at/before cutoff per fixture, preserving missingness. Do not use an older non-null value to bypass a newer missing response. Same-timestamp conflicts are UNKNOWN and excluded pending review. Input snapshots fix exact feature values, observation IDs, hashes and selected fixture IDs before calculation; later observations cannot revise past predictions.

Keep three required features, all-venue per-feature pools, minimum five team observations, the frozen projection/residual formulas and every numerical/base-history/rate gate. Final R1 map/beta remain unchanged. A separate observed-time adapter is required because the current historical source has a 2026 season firewall and a synthetic 48-hour temporal contract. Test numerical equivalence on identical eligible inputs; document the deliberate actual-observation selector separately. Do not relabel historical synthetic timestamps as actual observations.

H2 remains an unpromoted backbone. Future shadow use may calculate its frozen causal offset from actual eligible FT history; this is distinct from refitting R1 map/beta. No H2 fit or R1 computation occurred here.

FINAL_R1_MAP_HASH = 244c2ef4f930855271744e39f0de44598ec6c929ac18edd4c6f72965eb8a4a26

FINAL_R1_BETA_HASH = dc8f9faa4a09429ddfdd46631502375540e25fdbb37f84a1f92f6ceeb21e2ab4

No refit, recalibration, class/DRAW repair, parameter update or candidate substitution.

## Pregame seal, coverage and grade

Only season-2026 future NS targets in the same four leagues are in scope. Require calculation and completed seal at least 60 seconds before kickoff. Keep one initial snapshot per target in this protocol; no routine revision or post-kickoff backfill. Record predictionCreatedAt, cutoffAt, seal time, target identity, PREDICTED/PASS and reasons, probabilities/class, feature-specific sample counts, input/observation/source hashes, R1/adapter hashes, final map/beta hashes, H2 provenance and optional read-only official snapshot reference. A missing official reference is reported, never fabricated.

Audit scheduled, eligible, predicted, pass, missed, first-seen-after-kickoff, provider outage, graded and pending. MISS applies only to previously pregame-observed targets without a valid seal when kickoff passes. Do not invent MISS for fixtures unseen during an outage.

After pregame seal and actual FT completion, store a separate grade with fixtureId, shadow prediction hash, official reference hash, actualScore/class, correct1X2, gradedAt, providerFetchedAt and sourceHash. PASS correctness is null. No pregame file mutation. Corrections append grade revisions with previous hash/reason; previously sealed checkpoints are not overwritten.

## Milestones and promotion firewall

Formal checkpoints: 25, 50, 100, 200 graded R1 PREDICTED targets, deduplicated by fixture ID. Seal exact prefixes ordered by gradedAt then fixtureId, including every boundary crossed by a batch. PASS remains in coverage but does not advance milestone N.

At each checkpoint report R1 vs existing official v1 LL, Brier, Accuracy, HOME/DRAW/AWAY recall, OVR Brier and ECE. Use the frozen metric definitions. Keep the full milestone denominator, then disclose the exact paired set where both pregame snapshots are PREDICTED and valid. Official PASS or absent snapshots are not silently removed from coverage or replaced by later official predictions. Undefined class metrics remain null. Report per-league and pooled prospective-only counts; never combine historical and forward accuracy.

Intermediate results are operational only. Market performance/ROI is not a research metric. Market odds, owner/external analysis and recommendation logic are excluded. Below 100 graded predictions, no Forward change, recommendation connection or engine promotion is permitted. At or above 100, a separate protocol and CTO review remain necessary; no automatic promotion at 100 or 200. Current SCREEN_NO remains valid.

## Readiness gaps and next bounded mission

The partial classification recognizes valid current observation evidence and identifiable missingness. It does not mean the collector/adapter/feature store is ready. Remaining work needs separate authorization:

1. Build a private append-only current feature observation store/collector, with missing/error receipts and actual timestamps; no provider changes or imputation.
2. Establish actual-observed eligible history coverage for the 365-day input window. Current samples alone are insufficient. Previous-season warm-up requires an explicit provenance/scope decision and must not reuse the exposed holdout for confirmation or tune from its metrics.
3. Implement a separate prospective observation adapter and matched-input equivalence, temporal leakage, missingness PASS, immutable seal, namespace isolation and grading/checkpoint tests. Preserve frozen formulas/parameters and official v1.
4. Obtain separate first-run authorization; then seal only genuinely future targets. This mission starts no runner or watch.

This audit inherits the prior conditional internal-use evidence level; it adds no legal clearance or public/commercial right. No API account check, purchase, re-fetch, model fitting, prediction or grade was performed.

## Verification and Cursor handoff

Six metadata-only classification cases cover before/equal, after, missing, unknown time and late correction exclusion. Current raw hashes/identities and final parameters verified. All 3838 pre-existing tracked files and 513 official Forward cache files are included in before/after preservation checks. The local audit source/computed receipt are at C:\Users\TCTCTC\YANG-EDGE\YANG-EDGE-INBOX\football-v31-r1-prospective-readiness-v1; never run historical or holdout evaluators to resume this audit. Only these two docs and the readiness JSON are committed. Preserve the untracked access-gate doc; no main merge.

R1_REFIT = NO

R1_PARAMETER_CHANGED = NO

MODEL_PROMOTED = NO

FORWARD_MODEL_CHANGED = NO

RECOMMENDATION_ENGINE_CHANGED = NO

2025_HOLDOUT_REUSED = NO

PROSPECTIVE_SHADOW_EXECUTED = NO

FOOTBALL_V31_R1_PROSPECTIVE_SHADOW_READINESS_V1_READY_FOR_CTO_REVIEW
