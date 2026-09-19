# Pre-cutoff decision lifecycle and next-slate handoff

## Frozen evidence

2026-09-20 remains 42 targets, 0 predictions, 42 terminal PASS: 1 missed window,
6 identity, 15 required pregame provenance, 20 unsupported engine. The previous
early PASS operation is preserved, not reinterpreted as corrupt data. No replay,
deletion, conversion, or replacement is authorized. Scope commit 8395bdc and
terminal commit 6ebf0cd were pushed to the current research branch.

## Future operation

Use `advancePregame` in the existing terminal-decision module. It validates the
committed scope and current coverage, reads the actual clock, preserves existing
terminal evidence, and applies: reached kickoff -> missed-window PASS; ready
reference -> existing strict terminal validator; recoverable blocker -> WAIT.
Hard engine/provider limitations require an explicit final-for-date declaration
and evidence explanation. Do not use these reasons to disguise a temporary gap.

PENDING, IDENTITY_BLOCKED, AS_OF_BLOCKED, INPUT_WAITING, PIPELINE_BLOCKED are
operational states only. WAIT creates no terminal directory. The production
`sealTerminalDecision` also rejects new identity/competition/input-missing PASS,
so bypassing the orchestrator does not reinstate the prior early-PASS behavior.
Existing historical PASS remains readable and idempotent. `createTerminalWriter`
is the low-level injected-clock test primitive, not the future operational entry.

`npm run research:precutoff-status -- --date YYYY-MM-DD` is read-only. It does not
assess provider readiness: unknown rows remain PENDING. Incomplete coverage with
only future unresolved targets exits successfully; invalid evidence or unresolved
overdue targets require attention. The original final coverage CLI is unchanged.
No watch, service, automatic collector or scheduled job was installed.

## Soccer bridge contract

The existing Betman identity area now exports `resolveExactPregameIdentity`.
It has no legacy partial-name matcher, combined postgame identity loader, network
call, time tolerance, or inferred alias fallback. A reviewed binding must name
the exact operator target and scope hash, raw directed labels, provider fixture,
team IDs, league, season, exact kickoff, review time and schedule evidence hash.
The schedule projection allows only pregame identity fields and NS status.

For future terminal references an optional identityEvidenceHash points to the
hashed envelope at:
`data/research/football/operator-identity-bridges/<scopeSha256>/<sha256(targetId)>.json`.
Payload keys are binding and sourceUtf8 (the exact schedule projection bytes as
UTF-8). This is a reviewed sidecar to the existing identity system, not a new
canonical fixture registry. No bridge file or VERIFIED binding is fabricated.
The reference validator checks one-to-one provider mapping, hash links, directed
IDs/names, exact kickoff and identity observation no later than model cutoff.
All existing Forward model/input/receipt/deadline validation remains in force.
Future bridge evidence must be retained immutably with its referenced seal.

Six September 20 rows are shadow identity candidates only. They still have no
verified provider fixture/team IDs. No date-specific committed schedule was
available at its standard path. EXACT_READY=0, BLOCKED=6, AMBIGUOUS=0 (not a claim
that unknown matches are unique). See the companion JSON for every raw row.
No official September 20 prediction was attempted. Next-slate identity readiness
requires actual schedule-only evidence and reviewed exact bindings, not just code.

## MLB provenance finding and collection boundary

The legacy consumer derives predictedAt from aggregate generatedAt metadata;
the predictor separately rereads artifacts. Starter sourceTimestamp is not proof
of row collection time. Missing times can evade the old finite-only checks; both
starters need independently bound evidence. A timestamp added now to an old row
cannot establish an earlier observation. Existing historical rows remain UNKNOWN.

Required evidence covers Schedule, HomeStarter, AwayStarter, Lineup, Odds for the
existing market-aware MLB baseline. This does not add odds to football or change
MLB inputs/weights. The date-specific MLB summary is absent at its standard path;
no raw datasets, results or live payloads were opened to fill missing provenance.

`pregame-provenance.ts` supplies a future acquisition boundary. It records actual
collectedAt before acquisition and observedAt after acquisition, target identity,
source identity, asOf, target-exclusion assertion and SHA256 of the acquired bytes.
Publication is exclusive. Partial/late bundles fail closed; no repair or backfill.
Loading validates all five distinct required inputs, same target/start, finite
timestamp order and the real execution cutoff, returning the same verified bytes.
It never substitutes mtime or aggregate generatedAt for observation evidence.

LIMIT: a provider-specific adapter must validate that the acquired source really
matches the declared target, has no target/live/postgame data, and excludes the
target from historical features. Hashes prove byte binding, not the truth of an
adapter's assertions. The generic collector is not wired to a live provider or
the legacy predictor. The predictor must consume these exact buffers without
rereading legacy files, then recheck clock before and after prediction/sealing.
No raw historical payload was stamped retroactively. Engine approval and a MLB
terminal-reference adapter also remain unresolved. FUTURE_COLLECTION_READY=false
for production, despite the tested collection primitive. No real acquisition ran.

## Next authorized implementation work

1. For a new human-verified slate, obtain schedule-only observations and explicit
   reviewed provider-ID bindings. Freeze/lock and keep recoverable rows pending.
2. Supply existing Forward v1 inputs with genuine pre-cutoff observation evidence,
   invoke its unchanged runner, and pass its sealed reference through lifecycle.
3. Integrate MLB acquisition adapters and receipt-backed byte consumption, prove
   both starter exclusions and lineup status, and resolve engine approval plus
   immutable terminal-reference support before any real MLB prediction.
4. At actual cutoff, resolve still-pending rows with the official missed-window
   reason. Never revisit the already sealed September 20 decisions.

No outcome research, model changes, threshold changes, R1 graduation or main merge.
FINAL=PARTIAL_UNBLOCK. Code readiness is not live-data or model readiness.

## Verification

All original 84 regression tests passed; two terminal integration tests were added
(86 total across the existing suites). The dedicated suite passed 29 tests:
10 lifecycle, 10 identity and 9 provenance/clock/collection checks. Total 115/115.
Focused TypeScript compilation passed. The read-only operational command returned
PRESERVE for all 42 real decisions. All 84 original decision/receipt file hashes
matched the pre-change inventory. No real collection or prediction was executed.
