# Rich Match Preview V2

Base: `2596943b6a907a9b79adee8d8da15b9ff913c1c4`.

The two priority matches now have Korean pregame articles with canonical V1,
last-5/last-10 form, venue splits, current-season standings, and three verified
players per team. Generic missing-data paragraphs no longer dominate the page.
Data Quality is one collapsed disclosure. Quality remains LIMITED, not COMPLETE:
confirmed XI, complete availability, and human-confirmed odds selection mapping
are still missing. No team-reputation tactical claims or player impact model.

## Evidence and clocks

Recent form is computed only from the already sealed canonical input: same-league
FT rows actually observed before the September 13 prediction cutoff. Latest-first
fixture IDs, source hashes, reception times, venue, goals and W/D/L remain in the
private article JSON. The screen explicitly labels the September 13 observation
basis; this is not advertised as newly collected September 20 last-five form.

Preview-only collection made 10 official API-Football requests: two `/standings`
queries and eight paginated `/players` queries for league/season/team-exact context.
All requests and responses were before the target kickoff. No target fixture,
result, live, postgame, odds or provider prediction endpoint was called. The
provider roster registry is joined by player/team/league/season IDs and validity
times, never names. Editorial ranking is minutes descending, tied goal+assist
contribution, then provider ID. This is not a prediction of starters.

All raw responses, season/player projections and articles are LOCAL_ONLY under:
`../YANG-EDGE-INBOX/rich-preview-v2/2026-09-20/`.
Receipt SHA256s are checked before generation; immutable manifests pin article
JSON/Markdown hashes and canonicalPredictionId. V1 articles in the repository
are unchanged. Market numbers retain their existing human-verified provenance;
the unresolved selection mapping prevents favorite/agreement assertions.

Preview receipt timestamps are today's actual reception, distinct from the older
V1 cutoff. Preview context cannot flow into Engine or Forward inputs. V4's poll
budget, evidence store, collector and admission rules were not changed, and this
collection does not count as a V4 XI observation or shadow sample.

## Local screen

Rich articles are loaded server-side only with `YANG_EDGE_OWNER_PREVIEW=1` and
NODE_ENV other than production. The local homepage and exact-ID analysis routes
resolve the current canonical seal, verify its hash and probabilities, then show
the editorial article. They bypass the stale Daily C fallback for these matches.
No name-only, reversed-side, or date-free join is introduced.

Public/commercial display rights remain unresolved. This mission did not deploy
the private articles or enable their production rendering. Existing public pages
keep their existing contract outside this local owner mode.

Run in PowerShell:

```powershell
$env:YANG_EDGE_OWNER_PREVIEW='1'
node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 4198
```

The separate `.next-owner-preview` directory avoids disturbing the existing
development server. Webpack is used because this worktree's external node_modules
link is rejected by Turbopack. No firewall/service/startup task was installed.

## Verified XI update

`scripts/append-rich-preview-xi-v2.ts` consumes an explicit existing V4 evidence
ID and SHA256. It does not collect data. `exactEvidence`, temporal/identity checks
and the existing registry XI validator must pass. It refuses post-kickoff updates.
It writes a new JSON/Markdown pair and new manifest with previous hashes, retaining
v1/v2 files and identical V1 probabilities. Optional injury ID/hash must also pass
the existing prospective validation. Missing Fixture / explicit suspension can
be OUT; absent evidence never means AVAILABLE. A starter/OUT conflict is rejected.

```text
node --import tsx scripts/append-rich-preview-xi-v2.ts <TARGET_ID> <XI_EVIDENCE_ID> <XI_SHA256> [INJURY_EVIDENCE_ID INJURY_SHA256]
```

No real XI update ran during this mission. Formation/starters/bench may be shown
after valid evidence. Position codes alone do not establish left/right matchups;
no such matchup or unexpected-change claim is fabricated. Old editorial rankings
remain in the old version; new versions mark verified starters separately.

## Validation

- Focused and existing Preview regression tests: 63/63 PASS.
- Full `tsc --noEmit --incremental false`: PASS.
- Desktop browser: homepage has both canonical probability sets, forms, players,
  flow narrative and closed Data Quality. No stale unavailable-Prediction text.
- 390px mobile: no horizontal overflow; both cards rendered; disclosure closed.
- Previous structured/narrative files match their committed bytes.
- Engine, Forward V1, V4 collector and canonical evidence paths have no diff.
- Integration tests require the local private evidence folder; no network tests.

ENGINE STATUS

```text
OFFICIAL_ENGINE=V1
OFFICIAL_MODEL=football-poisson-research-v1
OFFICIAL_ENGINE_CHANGED=NO
RESEARCH_V2_H2_STATUS=RESEARCH_UNPROMOTED
V3_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_FEATURES=xG / Total Shots / Shots on Goal
V3_PROMOTED=NO
V3_1_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_1_HOLDOUT=SCREEN_NO_LAST_VERIFIED
V3_1_PROMOTED=NO
V4_STATUS=PROSPECTIVE_EVIDENCE_READY
V4_PHASE=0.5
V4_IMPLEMENTED_COMPONENTS=Evidence foundation / registry / collector gates
V4_ENGINE_IMPLEMENTED=false
V4_ADMISSION_ALLOWED=false
REAL_PREDICTION_COUNT=45_CANONICAL_LAST_VERIFIED_NOT_RECOUNTED
GRADED_PREDICTION_COUNT=15_LAST_VERIFIED_NOT_READ
CURRENT_SAMPLE_SIZE=15_LAST_VERIFIED_NOT_REEVALUATED
LATEST_BACKTEST=SEALED_UNCHANGED_NOT_RERUN
LATEST_HOLDOUT=V3.1_2025_SCREEN_NO_NOT_RERUN
PROMOTION_GATE_STATUS=BLOCKED_UNPROMOTED
ENGINE_WEIGHTS_CHANGED=NO
ENGINE_THRESHOLDS_CHANGED=NO
FEATURE_SET_CHANGED=NO
```

PROGRESS

```text
TODAY_PROGRESS=100%_CURRENT_RICH_PREVIEW_MISSION
OVERALL_PROGRESS=72%_OWNER_BASELINE_UNCHANGED
TODAY_DELTA=+0%p_ENGINE_PROGRESS
CURRENT_PHASE=V4_PHASE_0.5_PROSPECTIVE_EVIDENCE_READY
CURRENT_ENGINE=V1
NEXT_ENGINE=V4
NEXT_MILESTONE=FIRST_REAL_V4_PROSPECTIVE_EVIDENCE
COMPLETED_TODAY=Two_rich_articles / canonical_UI / context / immutable_XI_path / tests
BLOCKED_BY=NONE_FOR_CURRENT_LIMITED_PREVIEW
WAITING_FOR=VALID_XI_INJURY_EVIDENCE / HUMAN_ODDS_MAPPING / PUBLIC_DISPLAY_RIGHTS
```
