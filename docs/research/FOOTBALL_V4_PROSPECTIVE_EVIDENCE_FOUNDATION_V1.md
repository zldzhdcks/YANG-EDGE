# Football V4 Prospective Evidence Foundation V1

Foundation only. Official V1 unchanged; V3/V3.1 closed/unpromoted. V4 Phase 0, no admitted features, no scoring/weights/Player Impact, no shadow. No actual provider request, result, live score, postgame, grade or performance artifact was accessed in this mission. Tests use synthetic identities and schedules. Existing unrelated local files remain untouched.

## Governance

Start HEAD d82d9a8db393f6e419e4d35982a7ab5da6a99a78 matched remote tracking. Policy ratification was committed first in `research: ratify football v4 prospective evaluation policy`.
`football-v4-prospective-evaluation-policy-ratification-v1.json` records owner authorization in this mission. POLICY_RATIFIED=true for review checkpoints 25/50/100/200 and the NEW final minimum of 100 per league / 400 total plus all frozen guards. This is not an old Official rule, power certification or automatic promotion. No conflicting approved minimum found in the reviewed governance. Remaining uncertainty/multiple-candidate and operational evaluation details still require pre-shadow freeze; feature admission and launch are separate gates.

The new envelope follows the user's explicit ordering: observedAt <= collectedAt; asOf <= collectedAt; collectedAt < predictionCutoff <= scheduledStart. This expressly supersedes the earlier proposal's asOf ordering for NEW envelopes only. Prior sealed evidence/documents remain unchanged. Collector additionally preserves the existing 60-second kickoff margin. Provider publication/update clocks are separate; missing values remain null. Local fetch completion establishes availability of these received bytes, not historical publication or a provider data-through watermark. SAFE in this foundation means clock-chain validation, not satisfying every frozen feature-admission condition.

## Implementation boundary

New isolated module: `src/lib/football/v4-prospective-evidence-v1/`:
- contracts.ts: common envelope, normalized deterministic event IDs and strict timezone-aware clocks.
- registry.ts: provider-first registry, immutable append/revision, exact resolution at event and knowledge times.
- store.ts: exclusive snapshot publication and explicit ID+SHA lookup.
- validate.ts: XI/injury validation and frozen absence classification.
- collector.ts: committed scope chain, exact bridge binding, scheduling, persistent request reservations, receipts, availability registry and coverage.
- provider.ts: sole network layer, three approved endpoint families only.

Existing Phase 0 helpers and Engine/Forward modules were not edited. Their old permissive behavior remains isolated; future evidence uses these new strict validators. No automatic wiring into predictions.

## Canonical identity

Registry records contain recordId, provider, providerPlayerId, canonicalPlayerId, displayNameRaw, teamProviderId, competitionProviderId, season, validFrom/validTo, verificationStatus, recordedAt, sourceSha256 and optional supersedesId. Names never join records. Only EXACT resolves for validation; other states remain UNRESOLVED/CONFLICT.

Same-name provider IDs resolve separately. A provider-player binding cannot silently change canonical identity. Same competition/season membership intervals cannot overlap. Transfer closure adds a new record superseding only an open membership; original rows remain immutable. Then append the new team's membership. Historical queries apply both effective time and what registry revisions were known at that time. Different seasons/competition contexts remain explicit. Registry source hashes are required; they do not themselves verify human/source identity evidence. No real player has been assigned a fabricated canonical ID.

Persist registry versions through the same append-only store or committed append-only record arrays. The runner pins the registry file hash and replays every append validation. Historical evidence retains registryHash; consumers must use that version, not a later registry.

## Snapshot mechanics

Store root is private local inbox `football-v4-prospective-evidence-v1`, outside public data routes. Separate pregame, quarantine, claims, budget, receipts and availability namespaces. Evidence IDs are SHA256 over exact scope/target/source/team/planned event time; equivalent UTC timestamp spellings produce the same ID. Player-stat pages have separate page-specific IDs.

Write bytes to a unique same-directory exclusive temporary file, fsync/close, then atomically publish by no-replace hard link. A competing writer cannot replace the destination. Existing identical bytes => IDEMPOTENT_REPLAY; different bytes => CONFLICT. Verify exact bytes after publication. File systems lacking hard-link support fail closed, never fall back to overwrite. This provides process/concurrency-safe publication, not a promise against disk corruption or privileged manual modification. Hash verification detects later corruption. Unpublished pending files after a crash are not evidence.

get requires explicit evidenceId and expected SHA. exactEvidence also validates embedded ID/schema and the canonical raw-source hash. No latest lookup. sourceArtifactSha256 hashes the canonical stored response array, not the original HTTP wire bytes; the entire envelope has its own exact-byte SHA. Neither API secrets nor authorization headers enter the artifact.

## XI validation

Exact provider fixture, both expected teams and HOME/AWAY mapping; precisely two sides, exactly 11 unique starters per team; no repeated player across starters, bench or sides. Missing IDs, wrong team/fixture, 12+ starters, duplicate and starter/sub overlap are blocked. Fewer than 11 or unresolved registry => INCOMPLETE. Empty => INCOMPLETE with EMPTY_PROVIDER_RESPONSE / UNKNOWN_AVAILABILITY, not NO_LINEUP_EXISTS. A raw position token does not create an inferred goalkeeper identity. VALID structure alone is not official-confirmation semantics or feature admission; future admission must also establish that provenance.

## Injury and suspension

The 16 existing injury observations contain 262 rows and 131 identical serialized repeated rows inside captures. Existing client returns response directly; inspected capture path persists it without pagination/concatenation; repetition is already in stored raw before normalization. Upstream-response duplication is supported, but original HTTP wire evidence is absent, so definitive provider-versus-transport causality remains unproven. Different timestamp observations are not deduplicated together. No old raw file was changed.

Within one observation, deterministic complete normalized row identity is fixture/team/player/type/reason. Exact duplicate rows are retained in raw and reduced in the derived view with count and DUPLICATE_OBSERVATION status. Conflicting type/reason for one fixture/team/player => CONFLICT; fixture/team/missing ID => INVALID; unknown registry/status => UNRESOLVED. No empty/unknown-to-healthy conversion. Stale/return semantics still need admission evidence; absence rows do not establish complete roster availability.

Frozen classifier exact tokens only: type Suspension or reason Suspended => EXPLICIT_SUSPENSION; type Injury => INJURY; Missing Fixture => OTHER_ABSENCE; otherwise UNKNOWN. No substring guessing or assumption that red-card mentions prove suspension. SUSPENSION_COMPLETENESS=UNVERIFIED; V4-B admission remains blocked.

## Player statistics

Each capture retains target/fixture context, source/team/season, all clock fields, raw player IDs/stat rows, paging metadata and hashes. Explicit page jobs are independently budgeted/versioned; no unlimited automatic pagination. Aggregated data-through and full page-set verification remain UNRESOLVED; do not call a partial page a complete roster. The provider only supplies current cumulative statistics through this route; future receipts do not make historical reconstruction safe. HISTORICAL_BACKFILL_SAFE=false. No backfill collector is implemented; late responses are quarantined as NOT_PREGAME, never admitted.

## Scope, collection and timing

Real runner: `scripts/run-football-v4-prospective-evidence-v1.ts`. Default plan-only. Inputs --date and --manifest are mandatory. A real run additionally needs --collect, a committed manifest with collectionAuthorized=true, exact identity proof, registry and internal collection rights receipt, all SHA-bound. This mission created none of those real permissions and made no provider calls.

Scope loader verifies committed operator/source-freeze/target-lock files, schema/date/hash chain, human VERIFIED/COMPLETE, per-game verification and denominator uniqueness. Bridge verifies exact raw team directions, provider IDs, kickoff and source evidence; no fuzzy or guessed mapping. Real capture requires a future target with current time before its frozen cutoff.

Polling proposal implemented as explicit jobs at T-60/T-40/T-30/T-20 minutes, only points before the target cutoff, with a one-minute dispatch window; no missed-point catch-up. This is a new availability research schedule, not a changed Official six-hour runner. Existing request-spacing practice 6,500ms is retained. A filesystem network mutex serializes processes; provider HTTP error/429 aborts with no retry. A crash leaves the lock fail-closed for attended recovery. Shared foundation UTC-day durable reservation cap is configurable downward, never above 16 requests. It does not certify account-wide remaining quota: operator must allocate available provider quota after Official needs before authorizing a manifest. If insufficient, do not collect. Each player-stat page costs a reservation.

Scope/rights/job checks precede network. A durable claim precedes a budget reservation and request. An uncertain/crashed job is not automatically refetched; inspect receipt and recover explicitly. Rerun verifies any sealed evidence hash and preserves it. Changed inputs for the same job conflict. New planned observation times create new versions. Late or unproved clocks go to quarantine; failed requests get failure receipts. No prediction produced.

Availability entries: target, competition, scheduledStart, actual pollTime, responseEmpty, xiValid, playerCount, evidenceId, hash, source. These support future availability-lead-time research; none were created from live fixtures here.

Coverage denominator is the authoritative Scope Lock, not a directory scan. Unmapped soccer targets stay in UNRESOLVED_LEAGUE. Per league/source report targets, validEvidence, notAvailableYet, invalid, unresolved and coverage. coverageFromRefs reads only explicitly pinned hashes; duplicate observations do not enlarge the target denominator. Coverage is evidence presence/validation, not feature admission or performance. Snapshot consumers must select their predeclared cutoff/version policy explicitly; no latest-file selection.

## Future real-evidence procedure

1. Obtain a genuinely future human-verified operator slate, Source Freeze and Target Scope Lock through existing tooling; commit them.
2. Produce and verify exact bridge evidence, append-only canonical memberships and data-use authorization; commit a source-specific manifest referencing their byte hashes.
3. Freeze target cutoff and allowed job times; budget jobs within actual account quota. Plan-only first.
4. Execute an authorized job before cutoff; pin returned evidence ID/SHA. Preserve failure/empty/invalid receipts. Do not remove evidence to improve coverage.
5. Review source/identity/time/complete-page/official-XI semantics separately. No V4 feature becomes admitted automatically; no shadow launch until its separate gate.

Real future scope/identity/rights authorization bundle was not supplied for this run, so REAL_PROVIDER_CALLS=0. Historical scopes were not reused as future targets.

## Validation and engine status

Focused synthetic tests cover identity, transfers, XI, injury, clocks, concurrent storage, exact hash, idempotency, restart, late quarantine and durable budget. Existing Phase 0 regression and relevant typecheck run. Test outputs are not sports outcomes. No engine performance test.

OFFICIAL_ENGINE=V1
OFFICIAL_MODEL=football-poisson-research-v1
OFFICIAL_ENGINE_CHANGED=false
RESEARCH_V2_H2_STATUS=RESEARCH_UNPROMOTED
V3_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_FEATURES=xG / Total Shots / Shots on Goal (closed)
V3_PROMOTED=false
V3_1_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_1_HOLDOUT=NOT_REOPENED; prior closure declaration retained
V3_1_PROMOTED=false
V4_STATUS=EVIDENCE_PIPELINE_READY_AWAITING_REAL_EVIDENCE
V4_PHASE=0
V4_IMPLEMENTED_COMPONENTS=registry; clocks; immutable store; validators; collector; coverage
V4_ENGINE_IMPLEMENTED=false
V4_ADMISSION_ALLOWED=false
V4_SHADOW_ALLOWED=false
V4_FEATURE_SET=NONE_ADMITTED
REAL_PREDICTION_COUNT=45 LAST_VERIFIED_GOVERNANCE_ONLY
GRADED_PREDICTION_COUNT=15 LAST_VERIFIED_GOVERNANCE_ONLY
CURRENT_SAMPLE_SIZE=15 LAST_VERIFIED_2026-09-17_NOT_REFRESHED
LATEST_BACKTEST=NOT_ACCESSED
LATEST_HOLDOUT=NOT_ACCESSED
PROMOTION_GATE_STATUS=BLOCKED_PENDING_ADMISSION_AND_SEPARATE_SHADOW_GATE
ENGINE_WEIGHTS_CHANGED=false
ENGINE_THRESHOLDS_CHANGED=false
FEATURE_SET_CHANGED=false
FINAL=V4_EVIDENCE_FOUNDATION_READY
