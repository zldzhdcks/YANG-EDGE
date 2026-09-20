# V1 Pregame Probability Coverage Expansion V1

Audit time: 2026-09-20T10:24:12.865Z (19:24:12.865 KST).
Base: `3876e0f243d7d031169b950b5dfac161dcf2c6f6`.
Batch: `round-111-odds-new-v1`, date: `2026-09-20`.

## Outcome

All 31 authoritative football targets were audited before product wiring.
Seven already have valid global canonical V1 predictions; only two had been
visible because the loader previously required a rich preview to expose a
probability. The new read-only projection links five more existing predictions.
No real prediction, refit, PASS, revision or terminal decision was generated.
Global canonical count stays 45, with 47 physical prediction artifacts and two
pre-existing noncanonical duplicates; do not count the five new UI links as new
predictions. Probability coverage in the product increases 2/31 → 7/31 (22.58%).

Eligibility categories are mutually exclusive:

- EXISTING_CANONICAL: 7
- ELIGIBLE_TO_GENERATE: 0
- KICKOFF_ALREADY_PASSED: 15
- IDENTITY_UNRESOLVED: 1
- V1_INPUT_INSUFFICIENT: 0
- UNSUPPORTED_COMPETITION: 6
- TEMPORAL_EVIDENCE_INCOMPLETE: 0
- OTHER_EXPLICIT_BLOCKER: 2 (existing immutable PASS)

Precedence: existing valid canonical first, then current kickoff deadline,
identity, supported league, existing immutable seal and temporal/input gate.
An expired unresolved/unsupported target is counted once as kickoff passed;
its actual identity state and competition remain in the per-target audit.
Reusing a pregame seal after kickoff does not create a retrospective prediction.

## Why the two supported non-predicted fixtures were not regenerated

Getafe–Málaga (1570398) and Frosinone–Como (1550131) already have immutable
Official V1 PASS snapshots. The first was sealed with away-venue sample 2;
the second with home-venue sample 2. Both are below the frozen minimum of 5.
Those are 2026-09-13 snapshot counts, not a newly fetched history census.
The primary current blocker is preserving the existing immutable PASS, hence
OTHER_EXPLICIT_BLOCKER rather than counting each fixture again as insufficient.
No new history was fetched to revise those sealed decisions. No revision policy
was invented. Their missing probabilities remain null.

## Product admission

`canonical-research-probability.ts` consumes the committed identity audit and its
SHA-256-pinned identity-only schedule. It checks target, scope, source home/away,
competition, provider team IDs, season and exact kickoff before joining the
existing global canonical selector. The selector verifies pregame input and
receipt provenance. The projection also checks probability bounds and mass.
Duplicate artifacts never become alternate UI probabilities.

The connection runs before existing team research presentation so the narrative
can correctly say a separately sealed V1 probability is available. The original
research tier calculation is unchanged. Football STANDARD remains 17 and BASIC
14. All 50 sport research lines remain visible; Pick stays null.

The product still requires the existing local owner gate. Missing optional
identity evidence fails closed without deleting research lines. Conflicting
canonical/identity evidence suppresses the probability and records a technical
quality flag. No probability is generated or filled with zero by this module.
Explorer and detail pages display readable missing-probability copy; technical
model blocker status is available in the analysis-details disclosure.

## V4 and immutable evidence protection

The audit pins existing snapshot/input/receipt file bytes, V4 poll job index,
poll manifests, player registry and rights manifest. The focused tests recheck
every pinned hash. V4_RESERVED_BUDGET_USED=0; no V4 collection, service, schedule
or budget mutation occurred. The existing configuration is preserved:

- City: 21:00, 21:20, 21:30, 21:40 KST; kickoff 22:00.
- Atlético: 22:15, 22:35, 22:45, 22:55 KST; kickoff 23:15.

Readiness here means existing manifests are intact and the windows are future
at audit time. It does not claim a watcher/service was started or provider
availability was tested. This mission starts neither.

## Validation

131/131 tests passed: new coverage/projection tests plus canonical duplicate
policy, frozen Forward runner, dashboard, full slate, identity, research depth,
recency, showcase, rich preview and season boundaries. Full TypeScript check
passed. Generation/deadline/insufficient-input safety was exercised only with
synthetic fixtures in temporary test directories, never real fixture seals.

Real browser: homepage dynamically displays linked Bournemouth–Liverpool
probability; Explorer shows 50 lines and seven probability cards; its detail
page renders the exact canonical values. Existing Atlético and City analysis
routes retain 42.20/25.79/32.01 and 72.36/18.07/9.57 percent respectively.
No target result/live/postgame, grade body or provider API was accessed.

Primary audit:
`data/audits/2026-09-20-v1-pregame-probability-coverage-v1.json`.
The append-only audit script rejects a second write to the same audit path.

ENGINE_CHANGED=false; WEIGHTS_CHANGED=false; THRESHOLDS_CHANGED=false;
FEATURE_SET_CHANGED=false; NEW_PREDICTIONS=0; PROVIDER_CALLS=0.

## Engine and progress reporting basis

Official engine remains V1 / football-poisson-research-v1. V2 H2 remains research
unpromoted; V3 and V3.1 remain closed unpromoted (SCREEN_NO); V4 remains Phase 0.5
prospective evidence foundation, engine/admission false, no admitted feature.
Canonical prediction count 45 is rechecked outcome-blind in this mission.
Graded artifact count 15 remains last verified at 2026-09-20T04:28:57.536Z;
eligible graded sample N=15 remains the 2026-09-17T00:27:32.147Z evaluation
reference. No fresh outcome evaluation was performed.

Executable mission complete. Owner overall baseline remains 72%; this product
connection does not warrant an invented percentage-point increment. Further
model work depends on its separately governed evidence and admission gates.
