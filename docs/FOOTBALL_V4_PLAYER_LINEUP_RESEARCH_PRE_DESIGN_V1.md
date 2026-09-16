# Football V4 Player / Lineup Research Pre-Design V1

AUDIT + DESIGN + PRE-DESIGN ONLY. Not an implementation approval.

Source of truth: this document plus `data/audits/football-v4-player-lineup-pre-design-audit-v1.json`.

- Branch: `agent/cursor/football-v31-third-real-batch-preflight-v1`
- HEAD at audit: `955a3ab23aea0ee5e78864a473b00539911e17d2`
- origin/main: `1b90cdd3d406dd2991f79fe0836c32d8ba08e4b9`
- Official Forward unchanged: `football-poisson-research-v1`
- V4 engine / weights / player scores: **not built, not started**

## Verdict

`V4_PRE_DESIGN_READY`

V4 is the protocol stage for lineup / injury / suspension / player identity. Repository **data-collection and normalize foundations exist**. A V4 **Prediction engine does not exist**. Empty `/fixtures/lineups` envelopes are stored; nonempty injury observations exist for a 16-fixture 2026-08-29 capture. Engine admission remains forbidden.

---

## 1. Engine lineage (repository)

| Line | Status in repo | Evidence |
|---|---|---|
| V1 Official Forward | Live sealed Poisson 1X2 | `docs/FOOTBALL_FORWARD_SHADOW_V1.md`, `src/lib/football/poisson-research-v1/index.ts`, `MODEL_FORWARD` |
| V2 / H2 | Unpromoted research backbone | `docs/FOOTBALL_POISSON_V2_ALGORITHM_DESIGN_FREEZE_V1.md`, SCREEN_NO |
| V3 | xG / Total Shots / Shots on Goal research closed | `docs/FOOTBALL_V3_FEATURE_RESEARCH_PROTOCOL_V1.md` |
| V3.1 | R1 / R3 independent holdout SCREEN_NO | `docs/FOOTBALL_V31_INCREMENTAL_FEATURE_RESEARCH_PROTOCOL_V1.md`, holdout evaluation artifacts |
| V4 | Protocol = lineups / injuries / suspensions. Engine **not implemented** | Same V3/V3.1 protocols: “라인업·부상·징계는 V4이다.” UI contract: V4 = FUTURE / NOT IMPLEMENTED |

`predictFootball` input is `{ target, cutoffAt, history }` of completed regulation scores only. No lineup, playerId, injury, or XI field.

`src/lib/proto-round-ocr-v4-design-v0/` is proto-round OCR, not Football V4.

---

## 2. Existing Football player / lineup inventory

MLB/KBO/NPB lineup trees are **out of Football V4 scope** (`src/lib/mlb/*`, `scripts/build-mlb-lineup-dataset-v1.ts`, etc.).

| PATH | SPORT | PURPOSE | SOURCE | USED_BY_PREDICTION | USED_BY_RESEARCH | TEMPORAL_STATUS | CURRENT_STATUS |
|---|---|---|---|---|---|---|---|
| `src/lib/football/pregame-player-xi-foundation-v1/` | football | Pregame XI + availability normalize/replay | API-Football contracts | false | true | observedAt &lt; kickoff gate | RESEARCH_FOUNDATION |
| `src/lib/football/player-context-foundation-v1/` | football | /players /squads /coachs normalize | API-Football contracts | false | true (code only) | observedAt gate; RESEARCH_WITHOUT_TARGET_FIXTURE | CODE_ONLY_NO_RAW |
| `src/lib/football/api-football-provider.ts` | football | Provider methods | API-Football | false | true | fetch time not persisted as providerFetchedAt | WIRED |
| `data/research/football/raw/player-xi-v1/lineups/` | football | Immutable lineup observations | getLineups 2026-08-29 | false | true | PRE_GAME envelopes | 16 files, **raw=[]** |
| `data/research/football/raw/player-xi-v1/injuries/` | football | Immutable injury observations | getInjuries 2026-08-29 | false | true | PRE_GAME | 16 files, **nonempty** |
| `data/research/football/raw/player-context-v1/` | football | Players/squads/coaches raw | designed path | false | false | n/a | **directory missing** |
| `data/audits/football-pregame-player-xi-foundation-v1.json` | football | Foundation seal | 2026-08-26 | false | true | n/a | SEALED |
| `data/audits/football-player-stats-squad-coach-foundation-v1.json` | football | Stats/squad/coach seal | 2026-08-26 | false | true | n/a | SEALED |
| `scripts/audit-2026-08-30-pregame-input-coverage-v1.ts` | football+mlb | Coverage collector | live getLineups/getInjuries | false | true | capture observedAt | USED_ONCE |
| `docs/research/FOOTBALL_PLAYER_DATA_INTAKE_PRIORITY_V1.md` | football | Intake priority | design | false | true | n/a | DESIGN |
| `src/constants/dummyAnalysisData.ts` | mixed dummy | Public analysis copy | not provider | false | false | n/a | DUMMY_NOT_EVIDENCE |
| `src/lib/public-analysis/project-*.ts` | football public | lineup/injuries projected **null** | fail-closed | false | false | n/a | NOT_WIRED |

Collection layer ≠ engine input. Foundations set `predictionInput: false` and `engineInput: false` on every row.

---

## 3. Provider / data source inventory

Provider: **API-Football (API-Sports)**. Client: `src/lib/football/api-football-provider.ts`. No new provider. No live calls in this audit.

| Capability | Endpoint / method | In code | Persisted research raw | Notes |
|---|---|---|---|---|
| Lineups | `GET /fixtures/lineups` `getLineups({fixtureId})` | yes | 16 empty envelopes | startXI, substitutes, formation, coach in schema; payloads empty at capture |
| Injuries | `GET /injuries` `getInjuries({fixtureId\|leagueId\|teamId})` | yes | 16 nonempty | player.id, type, reason, team.id, fixture.date |
| Players season | `GET /players` `getPlayers` | yes (after later foundation) | none | Capability audit text “no getPlayers” is stale vs current code |
| Squad | `GET /players/squads` `getPlayerSquad` | yes | none | roster ≠ XI |
| Coaches | `GET /coachs` `getCoaches` | yes | none | no tactical score |
| Fixture player stats | `GET /fixtures/players` | **not implemented** | none | needed for as-of minutes |
| Dedicated suspensions | none | no | inferred from injury type/reason | `mapApiFootballInjuryAvailability` |
| Confirmed vs predicted XI | collector `lineupSemantic` | default UNPROVEN | empty | `/fixtures/lineups` is **not** auto CONFIRMED |
| Timestamps | `observedAt` on raw observation | yes | yes | `providerPublishedAt` / `providerFetchedAt` **absent**. Usage meta is quota only (`requestsRemaining`) |
| Legal | `PUBLIC_DISPLAY_REQUIRES_REVIEW` | audit | n/a | `src/lib/research/provider-capability-audit-v1/inventory.ts` |

`FootballUsageMeta` does not store fetch clock. Observation `observedAt` is collector clock, not bookmaker/provider publishedAt.

---

## 4. Temporal contract (proposed)

Reuse `classifyFootballObservationPhase`: `observedAt < fixtureKickoff` ⇒ PRE_GAME / `pregameEligible=true`. Equal or after ⇒ `POST_KICKOFF_INVALID_FOR_PREGAME`. No `Date.now()` in normalizers.

V4 fail-closed additions (not implemented):

| Field | Role |
|---|---|
| `providerPublishedAt` | Provider claim of when the XI/injury was published. Missing ⇒ `TEMPORAL_EVIDENCE_MISSING` |
| `providerFetchedAt` | YANG fetch instant. Missing ⇒ same |
| `observedAt` | Must be &lt; `kickoffUtc` |
| `snapshotCreatedAt` | Immutable observation write time. Must be &lt; `kickoffUtc` for pregame |
| `kickoffUtc` | Official fixture kickoff |

Eligibility (all required):

- `providerPublishedAt <= cutoffAt` when publishedAt exists
- `observedAt < kickoffUtc`
- `snapshotCreatedAt < kickoffUtc`
- missing publishedAt ⇒ **not** PREGAME_VERIFIED for engine; research may keep `PREGAME_UNVERIFIED`

**Forbidden:** using postgame actual XI as pregame prediction input. Postgame XI / `/fixtures/players` after FT = review/label only (`strictReplayEligible` separate from `pregameEligible`).

---

## 5. Player identity contract (proposed)

Existing module: `resolveFootballPlayerIdentity`.

Priority:

1. `providerPlayerId` (API-Football player id, string)
2. `canonicalPlayerId` (always `null` today; MATCHED unused until registry exists)
3. `providerTeamId` + `providerPlayerId`

Names are display/legacy only. Fuzzy match forbidden. Results must not repair identity.

| Existing status | V4 readout alias |
|---|---|
| `PROVIDER_ID_ONLY` | `PLAYER_ID_VERIFIED` at provider grain only — **not** YANG canonical |
| `PLAYER_IDENTITY_REVIEW_REQUIRED` | `PLAYER_ID_REVIEW_REQUIRED` |
| no providerPlayerId | `PLAYER_ID_UNRESOLVED` |
| `MATCHED` | reserved until canonical registry |

`providerPlayerId` is never silently equal to `canonicalPlayerId`.

---

## 6. Starting XI data contract (proposed)

Align with `FootballXiObservationV1` / `FootballXiPlayerV1`. Do not invent a second schema.

Minimum pregame row:

- `fixtureId` ← `providerFixtureId`
- `teamId` ← `providerTeamId` (+ `canonicalTeamId` when identity gate PASS)
- `playerId` ← `providerPlayerId`
- `playerName`
- `position` ← provider `pos`
- `starter` ← member of `startingXI` vs `substitutes`
- `goalkeeper` ← derived only if `position` is documented GK token (`G` / `GK`); else null, not guessed
- `formation`
- `lineupStatus` ← observation type below
- `sourceProvider` = `api-football`
- `providerPublishedAt` (new; optional until provider supplies it)
- `providerFetchedAt` (new)
- `observedAt`
- `pregameEligible` / `strictReplayEligible` / `engineAdmission=false`

Lineup states (do not mix in one dataset):

| State | Meaning |
|---|---|
| `CONFIRMED_XI` | collector semantic `OFFICIAL_CONFIRMED` only |
| `PREDICTED_XI` | expected XI from allowed expected sources; **empty in v1** (`NOT_COLLECTED_IN_V1`) |
| `PARTIAL_XI` | some starters, identity review, or one team missing |
| `NOT_AVAILABLE` | empty provider response (`raw: []`) — current stored lineups |

Default of `/fixtures/lineups` without collector proof = `UNCLASSIFIED_PROVIDER_LINEUP`, not CONFIRMED, not EXPECTED.

---

## 7. Injury / suspension contract (proposed)

Reuse `FootballAvailabilityStatus`:

`AVAILABLE | OUT | DOUBTFUL | QUESTIONABLE | SUSPENDED | UNKNOWN`

Map V4 labels: `INJURED` → existing `OUT` plus `reasonRaw` (do not add a parallel enum in v1). `AVAILABLE` is **not** implied by absence from the injuries feed.

`mapApiFootballInjuryAvailability` today: suspend/red card → SUSPENDED; Missing Fixture → OUT; doubtful/questionable mapped; other wording → **UNKNOWN** (raw preserved). UNKNOWN must not become 0 impact.

Optional fields if provider supplies them: `reasonRaw`, `typeRaw`. `expectedReturn` is **not** on current injury payload — do not require it.

No dedicated suspension endpoint. Suspension is a normalized status on the injuries observation.

---

## 8. Player strength (research requirements only)

Do not build weights or Player Score in this mission.

| Signal | Data layer | Feature candidate | Engine admitted |
|---|---|---|---|
| minutes / starts / goals / assists | `/players` typed; `/fixtures/players` missing | yes after as-of harvest | no |
| xG / xA | API-Football beginner fields **NOT_AVAILABLE** | blocked without new provider/legal review | no |
| GK role | lineup `pos` / squad position | yes as identity | no |
| team dependency | XI + minutes | later | no |
| historical sample | as-of completed matches only | required before any model | no |

`FootballPlayerFeatureContractV1.filled = false`. `XI_STRENGTH_PROHIBITED = true`. No “famous player +20%”.

---

## 9. Goalkeeper / key player

Goalkeeper: provider `pos` on lineup players and squad `position`. No `goalkeeper: boolean` on `FootballXiPlayerV1`. Treat GK as a **concept candidate** once position tokens are enumerated from nonempty lineups (currently impossible: all lineup raw empty).

Key player: not manual label, popularity, or market value. Future metric candidates only (minutes share, starts share) after identity + temporal gates. Not V4 engine input now.

---

## 10. Missing data / fail-closed

Codes: `V4_REQUIRED_DATA_MISSING` | `LINEUP_NOT_CONFIRMED` | `PLAYER_IDENTITY_UNRESOLVED` | `TEMPORAL_EVIDENCE_MISSING`

**Recommended governance:**

- **V1 Official Forward** continues on schedule + historical scores. Missing V4 data does **not** force V1 PASS.
- **V4** is RESEARCH_ONLY / SHADOW_ONLY. Missing V4 inputs ⇒ V4 research PASS / no V4 output, not a silent V1 mutation.
- No automatic promotion from V4 shadow to Official Forward.

---

## 11. V4 research architecture (aligned to YANG EDGE)

| Phase | Name | Matches existing protocol |
|---|---|---|
| 0 | Data collection only | player-xi raw append-only; fill nonempty lineups; persist player-context-v1 |
| 1 | Coverage / identity / temporal audit | like V3 census + this pre-design |
| 2 | Feature candidate research | unfilled player-feature contract; no weights |
| 3 | Retrospective backtest | as-of completed history; no postgame XI leakage |
| 4 | Independent holdout | separate from 2025 V3.1 holdout unless newly sealed |
| 5 | Prospective shadow | OWNER_MANUAL / EXTERNAL shadow layers — **not** MODEL_FORWARD |
| 6 | Promotion review | SCREEN rules; no auto promotion |

---

## 12. Official Forward separation

- Do not change `poisson-research-v1` or MODEL_FORWARD envelopes.
- Do not backfill V4 player data into sealed Predictions.
- Do not rewrite V1 historical grades because V4 exists.

---

## 13. Rights / compliance

API-Football: `licenseClass = PUBLIC_DISPLAY_REQUIRES_REVIEW`. Internal research vs public display vs commercial display are separate. Rights for raw lineup/player/injury payloads: **UNRESOLVED** for public/commercial. Public UI must not auto-show raw provider XI/injury.

Dummy `src/constants/dummyAnalysisData.ts` injuries are not licensed provider data.

---

## 14. UI future contract

Keep V4 node: **FUTURE RESEARCH / NOT IMPLEMENTED**. Friday Astra prototype must not present player names, injuries, or XI as Official Prediction reasons. `/analysis/[gameId]` lineup ≠ V4. Public projection already sets `lineup: null`, `injuries: null`.

---

## 15. Gap matrix

| Item | Status | Evidence |
|---|---|---|
| Starting XI | PARTIAL | 16 envelopes, all `raw: []` |
| Player Identity | PARTIAL | providerPlayerId; canonical registry NOT_BUILT |
| Player Stats | PARTIAL | getPlayers code; zero player-context raw files |
| Injury | PARTIAL | 16 nonempty research observations; not engine |
| Suspension | PARTIAL | inferred from injuries text; no endpoint |
| Goalkeeper | PARTIAL | `pos` field in normalizer; no nonempty XI to audit tokens |
| Temporal Evidence | PARTIAL | observedAt &lt; kickoff only; no providerPublishedAt |
| Rights | BLOCKED | PUBLIC_DISPLAY_REQUIRES_REVIEW / UNRESOLVED public |
| Storage | PARTIAL | player-xi-v1 yes; player-context-v1 missing |
| Builder | PARTIAL | 2026-08-30 coverage script; no ongoing harvest |
| Research Feature | MISSING | contracts unfilled |
| Backtest | MISSING | no V4 backtest |
| Shadow | MISSING | no V4 shadow layer |
| Engine Admission | BLOCKED | `engineAdmission` false; `ENGINE_ADMISSION_ALLOWED=false` |

---

## 16. P0 / P1 / P2

### P0 — before any V4 model work

| Work | Purpose | Likely files | Risk | Prerequisite |
|---|---|---|---|---|
| Keep Official V1 frozen | no leakage | none | accidental Forward edit | this pre-design |
| Confirm nonempty lineup harvest window | know when XI appears | player-xi-v1 lineups | quota; treating empty as confirmed-absent | existing getLineups |
| Do not mix CONFIRMED/PREDICTED | semantics | types already | mislabel expected XI | foundation audit |
| Rights remain UNRESOLVED | no public raw XI | UI contract | dummy analysis mistaken for evidence | capability audit |

### P1 — V4 data layer

| Work | Purpose | Likely files | Risk | Prerequisite |
|---|---|---|---|---|
| Append-only nonempty lineups | actual startXI | `data/research/football/raw/player-xi-v1/lineups/` | post-kickoff capture | P0 temporal |
| Persist player-context-v1 | minutes/starts | `data/research/football/raw/player-context-v1/` | season stats not as-of | getPlayers |
| Optional `/fixtures/players` read-only contract | per-match minutes | api-football-provider only if existing client pattern | live-match leakage | legal + quota |
| Canonical player registry design | MATCHED status | new registry later | fuzzy names | provider ids |

### P2 — feature research / backtest after data

| Work | Purpose | Likely files | Risk | Prerequisite |
|---|---|---|---|---|
| Fill player-feature candidates | research projection | player-feature.ts | invented weights | P1 as-of stats |
| Retrospective V4 shadow | compare to V1 | new shadow root, not MODEL_FORWARD | rewriting V1 history | holdout protocol |
| Promotion review | SCREEN | audit | auto-promote | independent sample |

---

V4_CURRENT_STATE = `RESEARCH_FOUNDATION_PARTIAL_ENGINE_NOT_IMPLEMENTED`  
ENGINE_ADMISSION_ALLOWED = false  
Do not start V4 engine implementation from this document.
