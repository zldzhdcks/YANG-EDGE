# V4 identity / membership contract reconciliation v1

Base: `2caa8b74bf62fb4f7b07bc09a57e134822127ccf`.
Branch: `agent/cursor/v4-identity-membership-contract-v1`.
This is isolated development for deployment review, not live Authority activation.

## Authoritative semantics

`football-v4-player-identity-membership-v2` distinguishes:

- Provider identity: exact provider + numeric player ID; display names never join.
- Observed membership: team and actual observation time, source hash and knowledge time.
- Canonical mapping: unresolved/null unless a separate provider/player/canonical/evidence-hash/recordedAt mapping proof is supplied. Conflicting mappings fail closed; a copied provider key or numeric ID is rejected.

Squad league/season values remain caller context (`sourceProven=false`).
No squad observation supplies competition registration, future membership, transfer
start/end or feature admission. Effective intervals are deliberately unsupported:
`resolveEffectiveMembership` always returns UNRESOLVED. Later roster observations
append; simultaneous incompatible team observations conflict. No inferred transfer
or supersession is introduced. Mapping proof hashes are evidence references: a
caller must retain the separately verified mapping evidence. This mission creates
no real mapping records.

## Legacy compatibility

The 133 historical rows and all historical receipts/snapshots remain unchanged.
`interpret` produces an in-memory view only. A legacy canonical label (including
`api-football:<id>`) does not establish mapping, even if its old flag says EXACT.
Legacy open intervals are not effective membership proof. The deprecated combined
`resolvePlayer` fails closed; consumers use the three independent resolvers.
Legacy `appendPlayer` remains only for historical-format validation/tests, not new
squad population or production identity resolution.

## Consumers and envelopes

XI and injury validate provider-scoped IDs independently of canonical mapping.
Team/fixture binding is supplied directly by the observation, never inferred from
a historical roster's open interval. Unknown provider identities remain unresolved;
conflicting identities cannot confirm XI. Empty XI remains UNKNOWN, partial XI
INCOMPLETE, and valid 11/11 CONFIRMED_COMPLETE. Missing injury rows never mean healthy.
The collector limits registry knowledge to the response observation time.

New envelopes use `football-v4-prospective-evidence-v3` and collector
`football-v4-identity-membership-v3`, with explicit provider identity scope,
canonical UNRESOLVED and effective membership UNRESOLVED. Features stay false.
The projected source hash and append-only event identity remain unchanged in
purpose. Existing claims prevent recollection; upgrades never backfill old events.
Both v1 and v2 remain readable with their original bytes/hashes. All complete
serialized envelopes retain the P0 positive allowlist boundary.

Readiness returns PROVIDER_ROSTER_OBSERVATION_READY with separate boolean flags:
providerIdentityReady and observedRosterEvidenceReady; canonicalMappingReady,
effectiveMembershipReady and competitionRegistrationVerified remain false.
This is observation infrastructure readiness, not confirmed future XI, admission,
collection authorization, or a claim of current roster freshness.

## Validation and operational limits

See the adjacent reconciliation audit JSON for exact executed counts and protected
artifact hashes. Synthetic/local tests only, with outbound fetch/http/socket blocked.
No Provider calls, no real observations, no new canonical mappings, no V4 collection.
Brighton team 51 / league 39 / season 2026 remains zero compatible rows.
V4-A availability development is CONDITIONAL on separately authorized evidence and
scope. A2 stays LOCKED. V1, weights, thresholds and prediction logic are untouched.
Mac deployment, merge, collection and feature admission require separate review.
