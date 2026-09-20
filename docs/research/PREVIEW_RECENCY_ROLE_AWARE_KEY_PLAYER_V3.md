# Preview Recency + Role-Aware Key Player V3

Preview/product revision only. Official V1 and V3/V3.1/V4 research remain frozen. BASE_HEAD=791b2e7ee3f7aac9a7ded4ae8ffc95f82d9e8472. Private immutable preview edition is v5; the product policy name V3 is not an engine version.

## Two clocks and recency

ENGINE_AS_OF=2026-09-13T07:32:20.373Z (16:32 KST). PREVIEW_AS_OF=2026-09-20T07:17:15.940Z (16:17 KST). Target cutoff=2026-09-20T23:15:00+09:00. The latter is the target boundary, not an observation time. Actual fixture observations were 16:11:59 and 16:12:06 KST. Existing player context was observed 14:20 KST. No claim of continuous updates or future evidence is made.

The old current-season form, last5/last10, venue form and GF/GA were derived from September 13 frozen input. Two official `/fixtures` FT-only requests for team/league/season refreshed the descriptive context. Target identity, FT status, past kickoff and team/league/season are checked before reading scores. Responses, query parameters, actual fetchedAt and SHA-256 are retained locally. No target result, live or postgame endpoint was queried. Past completed results are intentionally used.

Three missing team matches were recovered: Atlético away at Real Sociedad (1570380, September 13 19:00 UTC, 3–0), Atlético home to Osasuna (1570384, September 16 17:00 UTC, 4–0), Real away at Elche (1570388, September 15 19:30 UTC, 3–2). Their KST dates are September 14, September 17 and September 16 respectively. Osasuna was absent from the old Preview. No individual goalscorer, appearance or award is inferred from these scores.

Atlético current season: 6 matches, W4 D1 L1, GF14 GA6; home 3, W2 D1 L0, GF8 GA2. Real: 6, W5 D0 L1, GF17 GA6; away 3, W2 D0 L1, GF5 GA4. Last5 and last10 display actual available counts (last10 has only six). Current/previous seasons are not merged. Previous-season context and MODEL HISTORICAL WINDOW remain the original sealed descriptions. Match flow uses the refreshed team counts without tactical or availability claims.

## Selector and limitations

Old selector: top three by season minutes, G/A tie-break, then ID. Supported biases: SEASON_MINUTES_BIAS and ROLE_BLINDNESS; RECENCY_GAP affected team form. G/A was a tie-break, so G/A dominance is not established. Whether a recent-impact player was missed is NOT_DETERMINABLE without fixture-level player evidence.

Six role-axis contracts are defined: ST/CF, WINGER/AM, CM/DM, FB/WB, CB and GK. No numerical weights or impact scores exist. Existing provider data supplies broad Attacker/Midfielder/Defender/Goalkeeper positions. GK is exact; the five detailed outfield groups remain UNRESOLVED. A midfielder is not silently labelled CM/DM and a defender is not silently labelled CB/FB. Fine-role assignment needs provenance-safe evidence.

Season Core: nondominated minutes/starts within the same provider position. Structural Key: nondominated observed basic counters within the same position, requiring a nonzero structural counter. These are descriptive candidates, not validated player-quality ranks. Zero/absent G/A does not penalize CM/DM or GK. Goals/assists do not select candidates. No fixed top-three quota or hand-picked player is used.

Only existing cached `/players` counters are projected: passes.total, tackles.total and goalkeeper goals.saves. Raw hashes and exact active registry membership are checked. Total passes are passing involvement, not proof of progressive passing or build-up quality; tackles are not pressure impact; saves are not adjusted shot-stopping quality. These internal basic-stat uses remain subject to the existing conditional provider/legal gate and do not expand public rights. No rating, third-party source, advanced metric or new player endpoint was introduced.

Atlético Season Core candidates: A. Lookman, D. Hancko, J. Oblak, Lee Kang-In, Álex Baena. Structural candidates: G. Simeone, Álex Grimaldo, D. Hancko, J. Oblak, Koke. The previous three were re-evaluated, not hardcoded: all remain somewhere in the broader evidence set. Koke is a structural candidate based on observed 267 passes and 12 tackles, not a claim of MVP or tactical causality.

Real Season Core: Kylian Mbappé, I. Konaté, D. Huijsen, T. Courtois, Vinícius Júnior. Structural: Kylian Mbappé, Y. Diomande, I. Konaté, Marc Cucurella, D. Huijsen, T. Courtois, F. Valverde. Names are registry display values; identity matching uses IDs.

Recent Impact for both teams=NOT_ENOUGH_VERIFIED_EVIDENCE. Existing season totals cannot locate a contribution in the latest 1–3 matches. The new `/fixtures/players` path is not introduced; LEGAL_REVIEW_REQUIRED remains before expansion. Synthetic selector tests permit verified official awards only alongside actual recent minutes and role contribution; an award alone never qualifies. No real award was used. MVP_STATUS=UNVERIFIED. Historical MVP database=false. Existing OFFICIAL_MOM_INTERNAL/PUBLIC=LEGAL_CONDITIONAL and HISTORICAL_DB=LEGAL_REVIEW_REQUIRED remain unchanged.

Match Key Player=WAITING_FOR_XI for both teams. Confirmed XI, replacement quality and lineup deltas are not invented. Future match-key admission needs its own validated evidence path; the current preview selector must never feed official model input.

## Artifacts and validation

Private v5 JSON/Markdown and manifest-v5 were exclusively created alongside v2–v4; prior manifests' six referenced versions were rehashed successfully. Manchester City remains on its prior edition. Canonical V1 probabilities and canonical input hash are unchanged. SHA256 of private v5: a33c6582503caa3cce62888fcd7b059c7aa75ebff7f8c1547fe46874da898415.

Machine-readable audit: `data/audits/2026-09-20-preview-recency-role-aware-v3.json`. Raw responses and player records are local-only; no API keys in Git.

Full typecheck PASS. Focused tests: 42/42 PASS, including 13 new recency/selector/render tests. Integration tests require local private evidence. Actual Chromium desktop 1280 and mobile 390 rendering PASS; scrollWidth 1265 and 375, no horizontal overflow; fresh tab console errors none. The actual page displays separate KST clocks, six-game form and role-context sections. Engine Lab continues to show V4 NOT IMPLEMENTED.

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
REAL_PREDICTION_COUNT=45 canonical (previous verified count, no new prediction)
GRADED_PREDICTION_COUNT=15 (previous verified count, no target outcome re-audit)
CURRENT_SAMPLE_SIZE=15 graded, carried forward
LATEST_BACKTEST=existing sealed research, no rerun
LATEST_HOLDOUT=V3.1 SCREEN_NO
PROMOTION_GATE_STATUS=NO_NEW_PROMOTION
ENGINE_WEIGHTS_CHANGED=NO
ENGINE_THRESHOLDS_CHANGED=NO
FEATURE_SET_CHANGED=NO

## PROGRESS

TODAY_PROGRESS=100% of executable preview work
OVERALL_PROGRESS=72% owner baseline unchanged
TODAY_DELTA=+0%p; UI/product work is not engine progress
CURRENT_PHASE=V4_PHASE_0.5_PROSPECTIVE_EVIDENCE_READY
CURRENT_ENGINE=V1
NEXT_ENGINE=V4
NEXT_MILESTONE=provenance-safe real XI / player evidence
COMPLETED_TODAY=two clocks, refreshed FT context, role-aware candidates, immutable edition, tests and browser validation
BLOCKED_BY=fine-role and recent fixture-level player evidence gaps
WAITING_FOR=approved recent player evidence / verified official MVP if available / confirmed XI
