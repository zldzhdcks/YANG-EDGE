# Football Provider Identity Resolution Batch V1

Date: 2026-09-20. Batch: `round-111-odds-new-v1`. Base: `1a9b739da71d3ae23ed71ae3648a293bd3313728`. Current research branch only; no main merge or public deployment.

## Result

31 Football lines retained. Of the 29 previously unresolved targets: EXACT18, AMBIGUOUS4, CONFLICT5, TEAM_ID_UNRESOLVED2. UNSUPPORTED_COMPETITION0, FIXTURE_NOT_FOUND0, SOURCE_EVIDENCE_INCOMPLETE0. The two existing exact showcases are regression-only and excluded from these 29 counts.

Research STANDARD2→17, BASIC29→14; BASIC→STANDARD15; FULL0; coverage54.84%; targetWithoutLine0. Identity alone did not upgrade a target. Three newly exact Japanese fixtures had already started, so no fresh pregame history observation was manufactured; they remain BASIC with PREGAME_OBSERVATION_WINDOW_CLOSED. No target results were checked to decide this.

## Evidence and review method

Existing Competition Registry, team aliases, provider ID catalog, frozen source/scope and previous exact bridges were inspected first. Unlike the previous readiness script's four-league whitelist, identity lookup uses registered competition labels and provider IDs. K League2=293 and J2 League=99 are separately evidenced by the current provider-reported competition names; this does not alter engine league admission.

One approved API-Football date/timezone schedule call produced an allowlist projection of fixture ID, competition ID/name, season, team IDs/names and kickoff. The projection never reads or saves fixture.status, score, goals, winner, live, events or postgame statistics. Full raw schedule response was not stored. Projected schedule SHA256: `5773d935671804feee1571d916dc4cf8c831323a0138ff16648a5dadb1f6267f`. Its actual observation timestamp is preserved in the audit.

35 new reusable, competition-scoped spelling/transliteration/nickname aliases were explicitly reviewed by Astra against the human-verified operator labels and provider-reported names/IDs. This is **ASTRA_EDITORIAL_REVIEW**, not a new human confirmation. No similarity score or normalization algorithm approves aliases. The runtime matcher accepts only literal, verified registry entries. Each entry carries source label, canonical name, provider ID, competition, evidence hash and actual review time. Team IDs are obtained from unique provider observations, not entered per fixture.

Registry contains 39 aliases: 35 newly reviewed spellings plus four literal existing operator aliases. During admission, 27 distinct IDs were new to the prior matched team catalog and 12 reused matched catalog IDs. These counts describe the reusable identity registry, not predictions. ONE_OFF_HARDCODE_COUNT=0 means no target-specific fixture/provider-ID assignment; explicit alias review records are reusable registry data.

Resolution order: competition → home alias → away alias → fixture IDs → exact kickoff instant/date → direction. Kickoff tolerance remains zero. No nearest-time guess. Multiple fixture candidates remain AMBIGUOUS. A verified alias with mismatched B/U21/Women class is rejected. Only a full conjunction can produce EXACT.

## Remaining blockers

- Five targets conflict with existing K League provider IDs/names: 57,58,59,69,70. Target59 observes Ansan Greeners at2758 while the existing catalog assigns2758 to Daegu. Existing K League1 mappings similarly conflict with current provider identities. No catalog or sealed history was rewritten.
- Four Asian Games targets45,54,68,76 use source labels ending in M, while provider candidates are U23. The source label does not independently establish the age class. These remain AMBIGUOUS, not adult-national-team matches.
- Two targets60,71 need evidence for renamed/reconstituted clubs: Yongin FC versus Yongin City, and Gimhae/Paju current brands versus provider city/citizen labels. They remain TEAM_ID_UNRESOLVED.
- Three exact targets62,63,64 lack a reusable pre-cutoff research observation at this run. Their schedule identities are retained, and Research remains BASIC.

The full target IDs, source values, provider fields, stage statuses, confidence, provenance, failure reasons and before/after research tiers are in `data/audits/2026-09-20-football-provider-identity-resolution-v1.json`. No remaining target is hidden under UNKNOWN.

## Existing Research activation

15 still-upcoming exact targets use the existing `buildTeamResearch` / `applyFootballDepth` projection. No new analysis formula or prediction was added. Seven European league FT requests are shared across teams/fixtures. Two K League2 team-specific requests avoid retrieving earlier same-day slate targets. Total history calls9; schedule call1; total10. Separate Research cap9 and V4_RESERVED_BUDGET_USED0. No retries or background watch were installed.

All FT identity/status/time checks happen before score access or persistence. Any returned slate-target fixture ID rejects collection before scores are read. Future target kickoff bounds both request and observation time. All raw history responses remain local-only. New context/identity hashes are in an additive source manifest; the previous depth source manifest, old preview editions, canonical predictions and input hashes are unchanged.

Prediction remains NOT_AVAILABLE for all15 newly STANDARD targets. XI is not required. Current-season W/D/L, GF/GA, Last5/Last10, home/away and readable summaries use observed completed history. Missing standings/player/XI/availability remain explicit. No odds or provider predictions feed this path.

## Regression and validation

Atlético fixture1570394 retains42.20/25.79/32.01 and six-game current-season context. City fixture1557413 retains72.36/18.07/9.57 and the four-game current-season correction. Tests94/94 PASS across seven files. Full typecheck PASS. Tests include competition/direction/time conflicts, same-name collisions, B/U21/Women rejection, fuzzy-only rejection, forbidden-field getters, reusable aliases, no-Prediction STANDARD admission and all31/50 lines retained.

Real Chromium Explorer: STANDARD17, including new lines with NOT_AVAILABLE probability and populated team summaries. Desktop1280 scrollWidth1265; mobile390 scrollWidth375. No horizontal overflow. Public data exposure, engine feature admission and promotion were not performed.

## Handoff

Reuse `provider-identity-batch-v1/alias-registry.json` with the shared resolver for future slates. Prioritize a versioned K League catalog reconciliation supported by official/provider identity evidence; do not overwrite historical IDs. Separately confirm national-team age class and renamed clubs. New exact identity still needs valid pre-kickoff history before STANDARD. A closed collection window must not be backfilled.

## ENGINE STATUS

OFFICIAL_ENGINE=V1
OFFICIAL_MODEL=football-poisson-research-v1
OFFICIAL_ENGINE_CHANGED=NO
RESEARCH_V2_H2_STATUS=RESEARCH_UNPROMOTED
V3_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_FEATURES=xG / Total Shots / Shots on Goal
V3_PROMOTED=NO
V3_1_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_1_HOLDOUT=SCREEN_NO
V3_1_PROMOTED=NO
V4_STATUS=PROSPECTIVE_EVIDENCE_READY
V4_PHASE=0.5
V4_IMPLEMENTED_COMPONENTS=Registry / Membership / Evidence Foundation
V4_ENGINE_IMPLEMENTED=false
V4_ADMISSION_ALLOWED=false
REAL_PREDICTION_COUNT=45 unique; last verified 2026-09-20T04:28:57.536Z; mission new0
GRADED_PREDICTION_COUNT=15 artifacts, same last-verified count; no target outcome access
CURRENT_SAMPLE_SIZE=15 last-verified graded count; no new evaluation
LATEST_BACKTEST=existing sealed results; no rerun
LATEST_HOLDOUT=V3.1 SCREEN_NO
PROMOTION_GATE_STATUS=NO_NEW_PROMOTION
ENGINE_WEIGHTS_CHANGED=NO
ENGINE_THRESHOLDS_CHANGED=NO
FEATURE_SET_CHANGED=NO

## PROGRESS

TODAY_PROGRESS=100% of executable identity mission
OVERALL_PROGRESS=72% owner baseline
TODAY_DELTA=+0%p; identity and Research coverage are not engine promotion
CURRENT_PHASE=V4_PHASE_0.5_PROSPECTIVE_EVIDENCE_READY
CURRENT_ENGINE=V1
NEXT_ENGINE=V4
NEXT_MILESTONE=K League identity conflict reconciliation and unresolved age/club evidence
COMPLETED_TODAY=18 exact identities;15 STANDARD upgrades;35 reusable aliases;94 tests;browser verification
BLOCKED_BY=5 catalog conflicts;4 age-class ambiguities;2 club identity gaps;3 expired observation windows
WAITING_FOR=authoritative ID conflict/age/rebranding evidence and future eligible slate for expired windows
