# Football V4 Outcome-Blind Data + Feature Admission Audit V1

FINAL=V4_DATA_MORE_EVIDENCE_REQUIRED. No feature is admitted. A/B/C data-ready=false; V4 shadow remains forbidden. This is a multi-gate evidence shortage, not proof that the provider can never supply suitable data.

## Governance and access boundary

START_HEAD=aa28b4241d8b72f6c62c9a0369aa65ca46ffa34b. Protocol commit 69c63a2 was created and pushed on agent/cursor/football-v31-third-real-batch-preflight-v1 BEFORE the admission audit. Its five files contain closure/protocol/reporting governance only. Existing V3 metric-bearing audits, raw screenshots and unrelated Sep19/20 evidence were excluded. Local prior results remain preserved, not newly opened or staged. Existing closure declarations in the required protocol/reporting diff were reviewed as governance; no underlying performance, grade or match-result artifact was opened.

RESULT_DATA_ACCESSED=false; POSTGAME_ACCESSED=false; PERFORMANCE_METRICS_ACCESSED=false. Synthetic tests contain no actual match results. Provider data calls=0. Official API documentation was consulted for endpoint semantics, not match data. No fitting, prediction, holdout evaluation, live capture, or grade run.

## Source inventory

Starting XI: API-Football `/fixtures/lineups`; `ApiFootballProvider.getLineups`; historic writer `scripts/audit-2026-08-30-pregame-input-coverage-v1.ts` function persistFootballObservation. RAW_ARTIFACT=`data/research/football/raw/player-xi-v1/lineups/{fixture}/{timestamp}-v1.json`. NORMALIZED_ARTIFACT=no separate saved dataset found in this worktree's bounded football research roots; `normalizeApiFootballLineups` / replay normalizer exist.

Injury and suspension: API-Football `/injuries`; `ApiFootballProvider.getInjuries`; same historic writer; RAW_ARTIFACT=`data/research/football/raw/player-xi-v1/injuries/{fixture}/{timestamp}-v1.json`. `normalizeApiFootballInjuries` and explicit text suspension mapper exist. Separate normalized artifact not found in the bounded root.

Player Stats: API-Football `/players`; `ApiFootballProvider.getPlayers` handles paging, `buildFootballRawPlayerContextObservation` only builds an envelope (does not collect/write). `normalizeApiFootballPlayers` preserves minutes/position/rating and team-season context. Intended raw path `data/research/football/raw/player-context-v1/players/{team}/{timestamp}-v1.json`; no files found there. `/fixtures/players` client is not implemented and was not called. Squad context uses `/players/squads`, but it is not a historical effective-dated canonical registry.

IDENTITY_KEYS=provider fixture ID + provider team/player ID, league/season where present. Names are display-only. Existing XI/injury envelopes carry observedAt and fixtureKickoff; all 32 lack collectedAt, asOf and predictionCutoff. Do not fill these from filenames/mtime/observedAt. New client code offers local fetchedAt, but this does not retroactively repair older captures.

## Actual bounded artifact census

32 files, 16 distinct provider fixtures, observation timestamps on 2026-08-29; raw files hashed and checked unchanged. This is an artifact inventory, not a reconstructed authoritative slate. All 16 XI responses are empty. All 16 injury responses are nonempty: 262 raw rows, with 131 repetitions of the fixture/team/player/type/reason tuple. Preserve duplicates in raw evidence; do not count them as independent availability evidence or silently deduplicate the archive. Exact duplicate tuple does not prove every other raw field is identical.

Each injury envelope's raw fixture IDs match its wrapper. League assignment is obtained from injury row league IDs; empty XI is associated only by exact same provider fixture ID, never names/nearest time. The four-league observed subset contains six fixtures:

- EPL 39: observed targets=1; XI nonempty=0, empty=1; injury nonempty=1, empty=0.
- La Liga 140: observed targets=3; XI nonempty=0, empty=3; injury nonempty=3, empty=0.
- Serie A 135: observed targets=1; XI nonempty=0, empty=1; injury nonempty=1, empty=0.
- Bundesliga 78: observed targets=1; XI nonempty=0, empty=1; injury nonempty=1, empty=0.

For that observed subset only, XI envelope presence=0%, injury envelope presence=100%. These are NOT admission-safe coverage rates. Other ten fixtures are outside the four-league subset and stay inventoried. Suspension completeness is unknown; matching a suspension text row cannot prove complete disciplinary coverage. Player-stat observations=0 in the intended root, not a claim of provider unavailability.

For EACH feature and EACH league: authoritative TOTAL_TARGETS=null, AVAILABLE=null, MISSING=null, UNKNOWN=null, COVERAGE_RATE=null, MISSING_RATE=null. No locked collection denominator/time window exists for this audit. Unknown counts must not be fabricated from the observed subset. Admission-safe observed fixtures=0 because mandatory rights, identity/time and exact-consumption proof are absent. No join to results was used. Full per-file hashes/clocks/counts and per-league records are in the matching JSON.

## Rights gate

For Starting XI, injury, suspension and player statistics independently:
INTERNAL_RESEARCH_ALLOWED=UNCONFIRMED; PUBLIC_DISPLAY_ALLOWED=UNCONFIRMED; COMMERCIAL_USE_CONFIRMED=false; REDISTRIBUTION_ALLOWED=UNCONFIRMED_NOT_AUTHORIZED; WRITTEN_CONFIRMATION_EXISTS=false.

Prior owner-reported dashboard Chat AI guidance is supporting context only, not formal licensing or player-data-specific written confirmation. API access does not establish redistribution rights. Official terms prohibit unauthorized resale and reserve third-party publication/commercial permissions; no broader rights inferred here. Source: https://www.api-football.com/terms . Written scope should address each data type, private raw/derived retention and post-subscription retention. No email was sent or license purchased.

## XI timing and exact consumption

The provider's official guide describes typical lineup availability around 20–40 minutes before kickoff, with competition variation and some post-match-only coverage. This is guidance, not a guaranteed first-availability timestamp for any audited fixture. Source: https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide . Actual first availability was not measured by the existing single empty captures.

XI_TEMPORAL_SAFE=false: current helper checks kickoff only, accepts caller clocks, and does not take predictionCutoff. A synthetic observation after a hypothetical cutoff but before kickoff is still TEMPORAL_VERIFIED if all three clocks exist. Required observedAt<=collectedAt<=asOf<cutoff<=kickoff-60s is clarified in the separate prospective policy; no times are imputed. Missing publication evidence retains the parent blocker.

XI_VERSIONED=TIMESTAMPED_PATHS_ONLY; XI_APPEND_ONLY=NOT_PROVEN; XI_EXACT_SNAPSHOT_CONSUMPTION=false. The old capture writer uses normal writeFile and may overwrite the same path. Phase 0's later writer checks existence then uses nonexclusive writeFile: sequential overwrite is refused, but concurrent calls can race. Neither declaration proves atomic immutability. There is no V4 engine consuming a pinned snapshot hash. Corrections must create new immutable revisions with previous hash; never replace old capture. These are blockers, not fixes claimed complete in this audit.

## Normalization and identity findings

Synthetic focused tests confirm: duplicate starter IDs survive; 12 starters can be marked CONFIRMED_XI; substitutes remain separate; goalkeeper is the original G position token; missing IDs remain unresolved. Position is preserved, not semantically validated. Team attachment resolves a provider team through a catalog, but does not itself enforce two distinct expected fixture teams/home-away roles. Exact two-side identity and exactly 11 unique starters, no bench overlap, no cross-side duplicate, valid IDs and explicit official semantics are future admission checks.

Injury normalization retains reason/type and UNKNOWN, does not infer AVAILABLE from absence, and can represent explicit suspension text. However it assigns the wrapper fixture ID without validating raw row fixture identity; duplicates are retained; update/event time, return/resolved state, stale-record bounds and conflicts lack admission enforcement. Payload mismatches and repeated rows were reproduced with synthetic data. This audit's actual raw fixture IDs do match wrappers; that does not repair the general validator gap. Injury coverage does not imply suspension completeness. Per-league completeness and fixture-effective disciplinary eligibility remain unproved.

PLAYER_IDENTITY=PARTIAL. A provider ID emits PROVIDER_ID_ONLY; MATCHED requires externally supplied canonical mapping. No canonical registry was found in these foundations. Team-season metadata is not an effective transfer history. Name aliases, duplicate names and team changes cannot be resolved by text matching.

## Minimal registry design (not implemented)

Canonical player entity is stable across transfers and seasons. A verified binding maps (provider, providerPlayerId) to canonicalPlayerId, independently from effective-dated membership rows. Preserve displayNameRaw only for audit/UI; never a join key.

Membership fields: provider, providerPlayerId, canonicalPlayerId, displayNameRaw, teamProviderId, competitionProviderId, season, validFrom, validTo (exclusive/null open), verificationStatus, sourceArtifactSha256, observedAt and evidence/verification timestamp. Canonical ID assignment requires a recorded verified registry action, not copying a provider ID. Reject conflicting provider bindings, duplicate active bindings and incompatible overlaps; allow explicitly evidenced club/national-team contexts rather than merging them. Retain old rows across transfers. Unknown effective dates remain unresolved, not guessed. Fixture joins require exact IDs and cutoff-valid membership. No aliases/fuzzy name mapping, rating or impact formula.

## Player stats as-of

The current `/players` adapter queries season/team/league and paginates; it has no historical cutoff query or certified data-through watermark. Current seasonal totals can include later games. `observedAt` is supplied to a builder and does not prove the underlying fetch or included match boundary. No local player-stat receipt chain is available in the intended root. PLAYER_STATS_TEMPORAL_SAFE=false; AS_OF_SAFE=false. Do not fetch now and relabel as a past pregame snapshot; historical backfill is CURRENTLY_RETRIEVED_HISTORICAL_DATA and not admission-safe without contemporaneous proof. Minutes/role/rating presence does not equal Player Impact admission.

## Feature and candidate decisions

All four feature records: SOURCE=official API route as above; LICENSE_STATUS=UNCONFIRMED; TEMPORAL_SAFE=false (unproved); IDENTITY_SAFE=false (incomplete); COVERAGE_RATE=null; MISSING_RATE=null; REPRODUCIBLE=normalizer code exists, full evidence chain unproved; APPEND_ONLY_EVIDENCE=not atomically enforced; EXACT_SNAPSHOT_CONSUMPTION=false; ADMISSION=MORE_DATA_REQUIRED.

A_DATA_READY=false: XI empty plus rights/time/identity/immutability gaps.
B_DATA_READY=false: A gaps plus incomplete injury/suspension semantics.
C_DATA_READY=false: A gaps plus missing canonical registry and cutoff-safe player stats; Player Impact unimplemented.
This is not a performance judgment. No rejection/promotion is based on match outcomes.

## Prospective collection and dataset registry plan

PROSPECTIVE_COLLECTION_REQUIRED=true; collection not executed. Before a separately scoped capture run, freeze the exact authoritative target scope, actual cutoff and request schedule. Keep explicit request failure/empty/unknown records. A lineup capture schedule must accommodate provider timing without guaranteeing arrival; a fixture with no timely confirmed XI remains unavailable. Enforce actual cutoff, no late backfill.

Dataset registry row/session fields: DATE, TARGET_ID, provider fixture/team/player IDs, COMPETITION, season, FEATURE_SET_VERSION, SOURCE_ARTIFACTS, SOURCE_HASHES, OBSERVED_AT, COLLECTED_AT, AS_OF, PREDICTION_CUTOFF, SCHEDULED_START, TEMPORAL_SAFE, IDENTITY_SAFE, ADMISSION_VERSION, verificationStatus, previousHash and revision reason. Raw and normalized hashes are distinct. Require atomic exclusive writes, replay-by-hash, verified source receipt, per-section clocks and coverage denominators. No outcome/grade/result fields or model probabilities are allowed in this registry. No registry rows or mock real players were created here.

## Policy, tests and limitations

Prospective policy is documented and hash-bound before any collection. RATIFIED=false: independent ratification, dependence/uncertainty and multiple-candidate details remain outstanding; thresholds are proposals, not old Official standards. Review checkpoints 25/50/100/200 differ from the proposed final per-league 100 / total 400 floor plus all guards. No automatic promotion.

Focused tests: 15/15 PASS, including deliberate characterization of unsafe acceptance. PASS here means findings reproduced, NOT data admission. Focused TypeScript check passed for the audit test and Phase 0 modules. No production helper was changed; only audit/test/docs added. Raw hash checks preserve all 32 files. No broad engine test or model rerun.

## ENGINE STATUS

OFFICIAL_ENGINE=V1
OFFICIAL_MODEL=football-poisson-research-v1
OFFICIAL_ENGINE_CHANGED=false
RESEARCH_V2_H2_STATUS=RESEARCH_UNPROMOTED
V3_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_FEATURES=xG / Total Shots / Shots on Goal (closed)
V3_PROMOTED=false
V3_1_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_1_HOLDOUT=CLOSED_UNPROMOTED (governance declaration only; not reopened)
V3_1_PROMOTED=false
V4_STATUS=DATA_MORE_EVIDENCE_REQUIRED
V4_PHASE=0
V4_FEATURE_SET=NONE_ADMITTED
V4_A_DATA_ADMISSION=MORE_DATA_REQUIRED
V4_B_DATA_ADMISSION=MORE_DATA_REQUIRED
V4_C_DATA_ADMISSION=MORE_DATA_REQUIRED
V4_IMPLEMENTED_COMPONENTS=existing identity/normalization/temporal/snapshot/coverage foundation
V4_ENGINE_IMPLEMENTED=false
V4_ADMISSION_ALLOWED=false
V4_SHADOW_ALLOWED=false
REAL_PREDICTION_COUNT=45 LAST_VERIFIED_GOVERNANCE_REFERENCE_ONLY
GRADED_PREDICTION_COUNT=15 LAST_VERIFIED_GOVERNANCE_REFERENCE_ONLY
CURRENT_SAMPLE_SIZE=15 LAST_VERIFIED_2026-09-17_NOT_REFRESHED
LATEST_BACKTEST=NOT_ACCESSED_IN_THIS_MISSION
LATEST_HOLDOUT=NOT_ACCESSED_IN_THIS_MISSION
PROMOTION_GATE_STATUS=BLOCKED
ENGINE_CHANGED=false
ENGINE_WEIGHTS_CHANGED=false
WEIGHTS_CHANGED=false
ENGINE_THRESHOLDS_CHANGED=false
THRESHOLDS_CHANGED=false
FEATURE_SET_CHANGED=false
FINAL=V4_DATA_MORE_EVIDENCE_REQUIRED
