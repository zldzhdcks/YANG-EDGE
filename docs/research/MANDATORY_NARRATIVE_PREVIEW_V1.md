# Mandatory narrative preview V1

Base: 8a5abbf83757288e887d691cefd9aa81e153f86d. Official Engine remains V1.

The two priority targets now have separate Korean Markdown articles and JSON
narratives in `data/research/slate-batches/round-111-odds-new-v1/previews/`.
Each contains ten paragraph sections, the canonical reference, actual creation
time, evidence IDs/hashes, version 1 and PREVIEW_PRE_LINEUP status. Word counts
are whitespace tokens/Korean eojeol including section headings: City 526, Atlético
523. These are not English word counts. File hashes are pinned in the narrative
audit. Structured Preview v5 and all earlier previews remain unchanged.

The owner's example probabilities were the noncanonical September 20 batch values.
The explicit instruction to use current canonical evidence takes precedence:
City 72.3577737 / 18.0690238 / 9.5732025 percent;
Atlético 42.2039097 / 25.7865607 / 32.0095295 percent. No model was rerun.
Descriptive means are computed from the permitted historical FT inputs, not target
outcomes, xG or newly estimated expected-goal rates. The frozen model source was
read only to explain its existing mechanism.

Human-confirmed market values are preserved. Original image hashes were verified.
The generic rows have blank market labels and unresolved selection mapping in the
sealed structured source. The prose identifies the lowest numeric column and makes
HOME/DRAW/AWAY market comparison conditional on that mapping; it never silently
upgrades this uncertainty or declares value betting/profit. No external requests.

Manchester City remains permanently mandatory, including its exact existing
operator label 맨체스C. Missing/PASS Prediction does not suppress narrative.
The existing presentation priority contract now carries a ten-paragraph limited
Korean narrative; the Quick Preview stays a separate two-sentence summary to
preserve its 2–4 sentence contract. Detailed current private articles are not
automatically published or injected into the public view. No private data loader
or provider import was added to that metadata-only presentation path.

No confirmed XI, injuries, suspensions or tactical dataset was available. The text
distinguishes “not verified here” from “not yet announced” and never infers health
from absent evidence. Tactical detail remains LIMITED. A future valid XI observation
requires an appended v2, with explicit evidence and changes, rather than modifying
v1. Unexpected starters require a verified comparison baseline; key absences require
actual absence evidence. Merely appearing in a roster cannot establish either.
Editorial updates must not recalculate or replace the canonical Prediction.

Validation: 48/48 focused tests, full repository typecheck zero errors. Tests cover
mandatory City/matchup text, unavailable Prediction fallback, canonical-only values,
forbidden target-field getters, preserved versions and existing presentation rules.
An initial Quick Preview length regression was corrected by keeping the short
summary separate from the long narrative; final regressions pass.

No result/live/postgame/grade access, provider call, new Prediction, V4 observation,
Engine, weight, threshold or feature change occurred in this mission.

```text
ENGINE STATUS
OFFICIAL_ENGINE=V1
OFFICIAL_MODEL=football-poisson-research-v1
OFFICIAL_ENGINE_CHANGED=NO
RESEARCH_V2_H2_STATUS=RESEARCH_UNPROMOTED
V3_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_FEATURES=xG / Total Shots / Shots on Goal
V3_PROMOTED=NO
V3_1_STATUS=RESEARCH_CLOSED_UNPROMOTED
V3_1_HOLDOUT=EXECUTED_ONCE_SCREEN_NO_LAST_VERIFIED
V3_1_PROMOTED=NO
V4_STATUS=PROSPECTIVE_EVIDENCE_READY
V4_PHASE=0.5
V4_IMPLEMENTED_COMPONENTS=Evidence foundation / registry / collector gates
V4_ENGINE_IMPLEMENTED=false
V4_ADMISSION_ALLOWED=false
REAL_PREDICTION_COUNT=45_CANONICAL_LAST_VERIFIED
GRADED_PREDICTION_COUNT=15_LAST_VERIFIED_NOT_READ
CURRENT_SAMPLE_SIZE=15_LAST_VERIFIED_NOT_REEVALUATED
LATEST_BACKTEST=SEALED_UNCHANGED_NOT_RERUN
LATEST_HOLDOUT=V3.1_2025_SCREEN_NO_NOT_RERUN
PROMOTION_GATE_STATUS=BLOCKED_UNPROMOTED
ENGINE_WEIGHTS_CHANGED=NO
ENGINE_THRESHOLDS_CHANGED=NO
FEATURE_SET_CHANGED=NO

PROGRESS
TODAY_PROGRESS=100%_CURRENT_NARRATIVE_MISSION
OVERALL_PROGRESS=72%_OWNER_BASELINE_UNCHANGED
TODAY_DELTA=+0%p_THIS_MISSION
CURRENT_PHASE=V4_PHASE_0.5_PROSPECTIVE_EVIDENCE_READY
CURRENT_ENGINE=V1
NEXT_ENGINE=V4
NEXT_MILESTONE=FIRST_REAL_V4_PROSPECTIVE_EVIDENCE
COMPLETED_TODAY=Two_Korean_articles / versioned_JSON / mandatory_fallback / tests
BLOCKED_BY=TACTICAL_AND_MARKET_MAPPING_DETAIL_UNVERIFIED
WAITING_FOR=VERIFIED_XI_INJURY_EVIDENCE_FOR_NARRATIVE_V2
```
