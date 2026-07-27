# Known Issues

## Bullpen Role Classifier v1

| Issue | Status in v1.1 |
|-------|----------------|
| MIDDLE underclassification (score capped, absorbed by HL/LONG) | Addressed: independent MIDDLE score |
| LONG overclassification via avgOuts alone | Addressed: multi-factor LONG + starter exclusion |
| Traditional starter slot0 included in avgOuts | Addressed: exclude outs≥9 slot0 |
| Opener removed if all slot0 excluded | Addressed: short slot0 kept as opener |
| Confirmed LONG with sample &lt; 3 (47 in audit) | Addressed: 0–2 → INSUFFICIENT_SAMPLE/UNKNOWN |
| Single-label priority bias / multi-role loss | Addressed: roleScores + secondaryRoles |
| No disk cache; 733 Stats API calls per run | Addressed: raw + derived research cache |
| Engine connection risk | Still PROHIBITED |

## Open

- Availability (IL/option) still unknown → `availabilityUnknown=true`
- Official closer/setup roster field still absent → inferred only
- 14-game sample remains too small for predictive claims
- MIDDLE/LONG thresholds are design constants, not performance-tuned

## Starter Dataset v1

| Issue | Status |
|-------|--------|
| Confirmed starter not available pre-game (Preview) | By design: `PROBABLE_ONLY` / `MISSING` only |
| `qualityStarts` absent from gameLog path | Not implemented (forbidden as invented feature) |
| Prediction snapshot lacks probable identity | Separate research artifact; snapshot untouched |
| `baselineGameId` / schedule join can be UNLINKED | `joinQuality` recorded; stats omitted when cutoff missing |
| Late scratch after freeze | `postGameReview.STARTER_CHANGED` annotation only; pre-game row immutable |
| MLB Stats API commercial use unconfirmed | `INTERNAL_RESEARCH_ONLY`; Engine PROHIBITED |
| Sample &lt; 100 games | COLLECTING — do not claim PROMISING |
| Accumulation pipeline | Date-arg orchestrator + immutable pre-game + Final-gated postgame |
| Non-Final postgame | `AWAITING_RESULT` only (no MATCHED/CHANGED) |
| 07-27 embedded postGameReview in pre-game rows | Frozen legacy; new dates keep postGameReview null in pre-game |

## Lineup Dataset v1

| Issue | Status |
|-------|--------|
| Pre-game lineup collection cadence undefined | Open — near-cutoff re-fetch policy not fixed |
| Official lineup announcement timestamp absent from Stats API | Open — only `fetchedAt` / research `cutoffTime` recordable |
| Historical 2026-07-27 pre-game snapshots | `NOT_COLLECTED` by design; no backfill from Final boxscore |
| battingSide not in boxscore person | Deferred — people API mass-fetch forbidden in v1 |
| `team.battingOrder` ≠ starting lineup | Documented; builder uses `players[].battingOrder` `*00` only |
| MLB Stats API commercial use unconfirmed | `INTERNAL_RESEARCH_ONLY`; Engine PROHIBITED |
| Sample &lt; 100 games | COLLECTING — do not claim PROMISING |
| Lineup Score / absence score | Not implemented (forbidden in v1) |
