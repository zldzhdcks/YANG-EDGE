# Football V4 Phase 0 Implementation V1

IMPLEMENTATION + ATTENDED VALIDATION. Not an engine admission.

- Official Forward remains V1 (`football-poisson-research-v1`)
- V3 / V3.1 remain CLOSED / UNPROMOTED
- `V4_ENGINE_IMPLEMENTED = false`
- `V4_ENGINE_ADMISSION_ALLOWED = false`
- `V4_PHASE0_CODE_STATUS = V4_PHASE0_VALIDATED`
- `VALIDATION_STATUS = PASS`

Unattended implementation mission: commands 0, tests not executed, API 0.

Attended validation: three foundation tests PASS, API_CALLS 0, LIVE_WRITES 0. Player-context first run failed on a Phase 0-only trailing comma in `normalize-players.ts`; after that syntax fix the same test PASS.

Current research state:

`V4_CURRENT_STATE = RESEARCH_FOUNDATION_PARTIAL_ENGINE_NOT_IMPLEMENTED`

---

## Implementation scope

Phase 0 extends existing player/XI and player-context foundations so that:

- temporal provenance can be classified without fabricating clocks
- player identity can express `PROVIDER_ID_ONLY` / `PLAYER_ID_UNRESOLVED` / optional `MATCHED`
- empty provider lineups are `NOT_AVAILABLE`, not confirmed-empty
- injury absence still does not imply `AVAILABLE`
- local `fetchedAt` can be carried on `getLineups` / `getInjuries`
- a research snapshot can be planned for append-only persistence
- coverage can be evaluated without player scores

Out of scope (not started):

- V4 Prediction engine, weights, player impact / XI strength scores
- `/fixtures/players` client
- canonical player registry
- public UI wiring for raw lineup/injury/player data
- Official Forward / Poisson / V3 / V3.1 changes

---

## Modified files

- `src/lib/football/pregame-player-xi-foundation-v1/types.ts`
- `src/lib/football/pregame-player-xi-foundation-v1/temporal.ts`
- `src/lib/football/pregame-player-xi-foundation-v1/player-identity.ts`
- `src/lib/football/pregame-player-xi-foundation-v1/normalize-lineups.ts`
- `src/lib/football/pregame-player-xi-foundation-v1/normalize-injuries.ts`
- `src/lib/football/pregame-player-xi-foundation-v1/replay.ts`
- `src/lib/football/pregame-player-xi-foundation-v1/expected-xi.ts`
- `src/lib/football/pregame-player-xi-foundation-v1/player-feature.ts`
- `src/lib/football/pregame-player-xi-foundation-v1/test-fixtures.ts`
- `src/lib/football/types.ts`
- `src/lib/football/api-football-provider.ts`
- `src/lib/football/dummy-football-provider.ts`
- `src/lib/football/player-context-foundation-v1/identity.ts`
- `src/lib/football/player-context-foundation-v1/paths.ts`
- `src/lib/football/player-context-foundation-v1/normalize-players.ts`
- `src/lib/football/player-context-foundation-v1/normalize-squads.ts`
- `scripts/test-football-pregame-player-xi-foundation-v1.ts`
- `scripts/test-football-player-context-foundation-v1.ts`
- `package.json` (script entry only; not executed)

## New files

- `src/lib/football/v4-phase0-foundation-v1/types.ts`
- `src/lib/football/v4-phase0-foundation-v1/temporal` is not duplicated; V4 temporal lives in the existing XI temporal helper
- `src/lib/football/v4-phase0-foundation-v1/persist.ts`
- `src/lib/football/v4-phase0-foundation-v1/snapshot.ts`
- `src/lib/football/v4-phase0-foundation-v1/coverage.ts`
- `src/lib/football/v4-phase0-foundation-v1/index.ts`
- `scripts/test-football-v4-phase0-v1.ts`
- `docs/FOOTBALL_V4_PHASE0_IMPLEMENTATION_V1.md`
- `data/audits/football-v4-phase0-implementation-v1.json`

Protected trees were not modified: Poisson, Forward shadow, V3/V3.1 research scripts, MODEL_FORWARD, Astra UI, prediction logic.

---

## New types

Existing schema reused first. Additive types:

- `FootballV4TemporalStatus`: `TEMPORAL_VERIFIED` | `TEMPORAL_PARTIAL` | `TEMPORAL_EVIDENCE_MISSING` | `POST_KICKOFF_OBSERVATION`
- `FootballXiAvailabilityStatus`: `CONFIRMED_XI` | `PREDICTED_XI` | `PARTIAL_XI` | `NOT_AVAILABLE` | `UNCLASSIFIED_PROVIDER_LINEUP`
- `FootballPlayerIdentityStatus` now `PLAYER_ID_UNRESOLVED`; `canonicalPlayerId: string | null`
- Optional temporal clocks on raw observations: `providerFetchedAt`, `providerPublishedAt`, `snapshotCreatedAt`
- Dataset flags: `engineAdmission: false`, `PUBLIC_DISPLAY_RIGHTS: "UNRESOLVED"`
- `FootballV4PlayerContextSnapshotV1` and `FootballV4CoverageReportV1`

`engineInput: false` and `engineConnected: false` keep their previous meaning. `engineAdmission: false` is the V4 gate and is never true in this mission.

---

## Temporal contract

Pure helper: `classifyFootballV4TemporalProvenance`.

Inputs (caller-supplied only; no `Date.now()`):

- `observedAt`
- `kickoffUtc`
- optional `providerFetchedAt`
- optional `providerPublishedAt`

Rules:

| Condition | `temporalStatus` | `pregameEligible` | `strictReplayEligible` |
|---|---|---|---|
| `observedAt >= kickoff` | `POST_KICKOFF_OBSERVATION` | false | false |
| pre-kickoff and fetched/published absent | `TEMPORAL_PARTIAL` | true | false |
| observed + fetched + published all present and all before kickoff | `TEMPORAL_VERIFIED` | true | true |
| optional clock present but unparseable | `TEMPORAL_EVIDENCE_MISSING` | true | false |

Missing clocks are not invented. `providerPublishedAt` remains null for API-Football lineup/injury payloads.

Existing `classifyFootballObservationPhase` is unchanged in meaning (`observedAt < kickoff` ⇒ pregame).

---

## Identity contract

`resolveFootballPlayerIdentity`:

- no `providerPlayerId` → `PLAYER_ID_UNRESOLVED`, `canonicalPlayerId = null`
- `providerPlayerId` present, no verified mapping → `PROVIDER_ID_ONLY`, `canonicalPlayerId = null`
- `MATCHED` only when the caller sets `canonicalMappingPresent: true` **and** supplies a non-empty `canonicalPlayerId`
- `canonicalPlayerId` is never copied from `providerPlayerId`
- `playerName` is display-only
- no fuzzy name matching

Normalizers do not pass a canonical mapping, so live normalize paths cannot emit `MATCHED`.

`PLAYER_IDENTITY_REVIEW_REQUIRED` remains expressible via `identityReviewRequired: true`.

---

## Lineup semantics

`normalizeApiFootballLineups` / `replayNormalizeFootballLineups`:

- empty raw `[]` → `quality = NOT_AVAILABLE`, `xiAvailabilityStatus = NOT_AVAILABLE`
- this is **not** a confirmed empty XI
- nonempty provider `startXI` / `substitutes` are preserved
- default observation type remains `UNCLASSIFIED_PROVIDER_LINEUP`
- `CONFIRMED_XI` only if the collector supplied `lineupSemantic: "OFFICIAL_CONFIRMED"` and both sides have 11+ starters
- `PREDICTED_XI` is never inferred from `/fixtures/lineups`
- goalkeeper: raw `pos` token stored as-is (`G` stays `G`); no name/number GK guess

---

## Injury semantics

`normalizeApiFootballInjuries` / existing mapper:

- enum unchanged: `OUT` | `DOUBTFUL` | `QUESTIONABLE` | `SUSPENDED` | `UNKNOWN` (`AVAILABLE` remains in the type union but is not generated)
- empty feed → zero rows; **absence ≠ AVAILABLE**
- `UNKNOWN` stays `UNKNOWN`; `reasonRaw` / `typeRaw` preserved
- suspension still only from explicit mapper (`suspend` / `red card`); no extra heuristics

---

## Provider `fetchedAt` support

`FootballProvider.getLineups` / `getInjuries` now return:

- `fetchedAt: string | null` — **local client fetch clock**, reused on cache hits
- `providerPublishedAt: null` — source does not publish a clock

Comments on the client state this is not provider publication time. Dummy provider returns `fetchedAt: null` (no fetch occurred).

---

## Persistence

`planFootballV4PlayerContextPersist` / `persistFootballV4PlayerContextSnapshot`:

- path convention reuses `data/research/football/raw/player-context-v1/snapshots/{scope}/{stamp}-v1.json`
- payload includes schema/version, clocks, fixture/team, source, raw/normalized sections, identity/temporal/coverage, `engineInput=false`, `engineAdmission=false`, `researchOnly=true`, `PUBLIC_DISPLAY_RIGHTS=UNRESOLVED`
- append-only, overwrite forbidden
- **this mission did not execute a write**. Default `executeWrite` is false. The writer exists for attended validation only.

---

## Snapshot builder

`buildFootballV4PlayerContextSnapshot` joins lineup, injury, player-season, and squad sections.

Missing input → `NOT_AVAILABLE` (no fill). Nonempty but incomplete → `PARTIAL`. Confirmed complete → `AVAILABLE`.

`engineAdmission` is hardcoded `false`. No Prediction type imports.

---

## Coverage evaluator

`evaluateFootballV4Phase0Coverage` returns:

- `lineupCoverage` / `injuryCoverage` / `identityCoverage` / `temporalCoverage` / `contextCoverage`
- states: `READY` | `PARTIAL` | `MISSING` | `BLOCKED`

It does not create `playerImpactScore`, `playerStrengthScore`, `lineupStrength`, `injuryPenalty`, `goalkeeperWeight`, `starPlayerWeight`, or `availabilityWeight`. Those keys exist only as explicit `null` prohibition fields.

---

## Public rights

New V4 research snapshots and XI/availability datasets set `PUBLIC_DISPLAY_RIGHTS = UNRESOLVED`.

No public UI wiring was added for raw lineup / injury / player data.

---

## `/fixtures/players`

Not implemented. Design TODO only on `api-football-provider.ts`: post-match player stats, pregame leakage risk, do not auto-wire.

---

## Tests

Unattended implementation wrote `scripts/test-football-v4-phase0-v1.ts` and did **not** execute it.

Attended validation later executed all three commands. Results:

- `npm run test:football-v4-phase0-v1` PASS
- `npm run test:football-pregame-player-xi-foundation-v1` PASS
- `npm run test:football-player-context-foundation-v1` PASS after Phase 0-only trailing-comma syntax fix in `normalize-players.ts`

Cases (Phase 0 file):

1. empty lineup → `NOT_AVAILABLE`
2. synthetic nonempty startXI → normalized starters
3. missing providerPlayerId → `PLAYER_ID_UNRESOLVED`
4. providerPlayerId only → `PROVIDER_ID_ONLY`
5. observedAt ≥ kickoff → `POST_KICKOFF_OBSERVATION`, `pregameEligible=false`
6. fetched/published missing → `TEMPORAL_PARTIAL`
7. all temporal fields valid → `TEMPORAL_VERIFIED`
8. empty injury does not create `AVAILABLE`
9. `UNKNOWN` preserved
10. suspension existing mapping only
11. goalkeeper `pos` preserved
12. context snapshot `engineAdmission=false`
13. static assertion: Phase 0 module has no Poisson / Forward / V3 / Prediction imports

Existing foundation tests that asserted missing player id as `PLAYER_IDENTITY_REVIEW_REQUIRED` were updated to `PLAYER_ID_UNRESOLVED`. Those tests now PASS under attended validation.

---

## Remaining blockers

- `NONEMPTY_XI_STILL_REQUIRED` — stored research lineups are still empty envelopes
- `TEMPORAL_PUBLISHED_AT_STILL_MISSING` — API-Football lineup/injury JSON has no publication clock
- `CANONICAL_PLAYER_REGISTRY_STILL_MISSING` — `MATCHED` cannot occur on live normalize paths
- `PUBLIC_RIGHTS_STILL_UNRESOLVED`
- nonempty XI capture still required before any later V4 engine discussion
- `/fixtures/players` remains blocked for pregame use

---

## Attended validation commands (executed)

```text
npm run test:football-v4-phase0-v1
npm run test:football-pregame-player-xi-foundation-v1
npm run test:football-player-context-foundation-v1
```

Do not call `persistFootballV4PlayerContextSnapshot({ executeWrite: true })` until an attended persist review.

Do not call `getLineups` / `getInjuries` live from this Phase 0 code until an attended capture mission.

Do not admit any snapshot to Official Forward / `predictFootball`.
