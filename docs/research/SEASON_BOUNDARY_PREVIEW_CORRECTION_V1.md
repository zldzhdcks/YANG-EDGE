# Season boundary Preview correction V1

Preview-only correction. Official V1 input and probability envelopes unchanged.
No provider, target result, live, postgame, fitting or Prediction calls.

The original September 13 run report binds each historical result's sourceHash,
league and actual providerFetchedAt to an explicit provider query season. The
report envelope hash is verified. Dates are not used to guess season membership.
Unknown or conflicting season provenance blocks the correction.

Current form is now 2026/27 only. Previous context is 2025/26 only, labeled as the
subset within the frozen rolling input, not the complete previous season. The
separate September 20 standings observation retains its own visible date; it is
not merged with September 13 current-season fixture form.

## Model-window audit

Full team-related window: CURRENT / PREVIOUS / TOTAL.

- Manchester City: 3 / 35 / 38.
- Sunderland: 4 / 35 / 39.
- Atletico Madrid: 4 / 35 / 39.
- Real Madrid: 5 / 35 / 40.

The previously described venue-specific 20-row samples are all 2 current-season
plus 18 previous-season fixtures: City HOME, Sunderland AWAY, Atletico HOME,
Real Madrid AWAY. They are labeled MODEL_HISTORICAL_WINDOW, never current form.

Verified venue statistics below use W-D-L; GF-GA.

- City current HOME: 2-0-0; 3-1. AWAY: 1-0-0; 4-1.
  Previous HOME: 14-3-1; 45-12. AWAY: 8-6-3; 27-19.
- Sunderland current HOME: 1-0-1; 1-2. AWAY: 0-1-1; 2-3.
  Previous HOME: 7-6-4; 20-19. AWAY: 5-6-7; 17-26.
- Atletico current HOME: 1-1-0; 4-2. AWAY: 1-0-1; 3-4.
  Previous HOME: 15-0-3; 38-16. AWAY: 6-4-7; 21-24.
- Real current HOME: 3-0-0; 12-2. AWAY: 1-0-1; 2-2.
  Previous HOME: 14-1-2; 42-15. AWAY: 10-4-4; 29-19.

## Storage and UI

Existing articles are preserved. The current immutable edition is v4: v3 split
the season samples; v4 also removed residual generic 5/10-match wording. The
read model rejects old unsplit editions. Both home and detail views show separate
CURRENT_SEASON_FORM, PREVIOUS_SEASON_CONTEXT and MODEL_HISTORICAL_WINDOW blocks.

Private JSON audit with fixture-level traceability:
`../YANG-EDGE-INBOX/rich-preview-v2/2026-09-20/previews/season-boundary-audit-manifest-v4.json`.
The same directory contains immutable v2/v3/v4 manifests and articles.

Checks: season partitions sum to the frozen input; current form has only 3/4/4/5
matches respectively; venue split is 2+18; old article bytes and V1 values are
unchanged. Missing season proof is rejected. See focused test
`scripts/test-preview-season-split-v1.ts` and existing Rich Preview regressions.

```text
CURRENT_SEASON_AND_PREVIOUS_SEASON_MERGED_IN_PREVIEW=false
PREVIEW_CURRENT_SEASON_SEPARATED=true
PREVIOUS_SEASON_CONTEXT_SEPARATED=true
PREVIEW_SEASON_SPLIT=true
OFFICIAL_V1_INPUT_CHANGED=false
OFFICIAL_V1_CHANGED=false
```

Engine remains V1 / football-poisson-research-v1. H2 unpromoted; V3 and V3.1 closed
unpromoted; V4 remains Phase 0.5 evidence foundation, not an implemented/admitted
engine. No weights, thresholds or features changed. Counts remain last-verified
45 canonical / 15 graded, not reread or reevaluated for this correction.
Overall engine progress remains owner baseline 72%, delta 0 percentage points.
