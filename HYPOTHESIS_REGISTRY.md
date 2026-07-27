# Hypothesis Registry

Research hypotheses for YANG EDGE. Operational registry only — does not change Dataset builders, Engine, or Research Framework code.

### Registry vs Evidence Ledger

| Document | Role |
|----------|------|
| **This Registry** | Current hypothesis status and short sample/evidence **summary** |
| **Evidence Ledger** | Append-only **individual** supporting/contradicting evidence events |

Ledger (no status promotion): [`data/research/hypothesis-evidence-ledger.json`](data/research/hypothesis-evidence-ledger.json)

Rules:

- `autoApply` is always **false** until backtest clearance.
- Do not mark **PROMISING** from a single slate or from &lt;100 graded games.
- Engine admission default: **PROHIBITED**.
- Framework contract: `DATASET_FRAMEWORK.md`, `src/lib/research/`.
- Dataset ids must exist in `RESEARCH_DATASET_REGISTRY` / `data/research/registry.json`.
- **Current** cumulative figures must cite `asOfDate` / source artifact. **Historical** figures keep their date or audit label and are not overwritten by later totals.

Status vocabulary (operations):

| Status | Meaning |
|--------|---------|
| DATA_COLLECTION | Linked dataset accumulating; hypothesis not scored for Engine |
| SURVEY_ONLY | Feasibility / source survey only; no production collector |
| REVIEW_PENDING | Awaiting human/Engine-admission review (none currently) |
| REJECTED | Discarded (see Discarded section) |

Engine usage column: `PROHIBITED` | `REVIEW` | `ALLOWED`.

---

## Active hypotheses

### Bullpen Role Classifier (`mlb-bullpen-role`)

Dataset status: **COLLECTING** · Classifier: `bullpen-role-classifier-v1.1` (frozen) · Engine: **PROHIBITED**

**Current cumulative** (asOfDate **2026-07-27** Final slate · source: `data/audits/bullpen-v1_1-validation-2026-07-27.json`, compare `data/audits/2026-07-27-bullpen-role-v1-vs-v1_1.json`):

- Graded games: **15** · Pitcher rows: **563** · UNKNOWN: **289** (51.3%) · CLASSIFIED: **205** (36.4%)
- failPregameWarn **7**/7 · successStable **2**/5 · falsePositive **2** · falseNegative **0**

**Historical (preserved — do not overwrite):**

- Pre-Yankees-Final partial slate (phase `PRE_YANKEES_FINAL`): rows **524** · UNKNOWN **269** (51.3%) — `h-bp-role-007-unknown-decline-observation.json`
- v1 baseline roleCounts (same-day compare input): LONG **110** · MIDDLE **1** · CLOSER **31** · UNKNOWN **81**

| ID | 제목 | Dataset | 현재 상태 | 표본 수 (current) | 현재 근거 | Engine 사용 | 다음 액션 |
|----|------|---------|-----------|-------------------|-----------|-------------|-----------|
| H-BP-ROLE-001 | Excluding traditional starter appearances from role features reduces LONG overclassification | mlb-bullpen-role | DATA_COLLECTION | asOf 2026-07-27: **15** graded · **563** rows · target ≥100 | Historical: v1 LONG 110 → v1.1 LONG 28. Current Final: LONG **28**; starterAppearancesExcluded **675** (partial-era figure 630 preserved in older log only) | PROHIBITED | Accumulate finished slates; no Engine review until ≥100 graded |
| H-BP-ROLE-002 | Minimum sample policy (0–2 → UNKNOWN) eliminates confirmed roles under sample size 3 | mlb-bullpen-role | DATA_COLLECTION | asOf 2026-07-27: **15** graded · **563** rows · target ≥100 | confirmedRolesUnderSample3 **0**; longUnderSample3 **0**; INSUFFICIENT_SAMPLE **289** | PROHIBITED | Keep sample policy frozen; re-check counters on each finished slate |
| H-BP-ROLE-003 | Independent MIDDLE score (not fallback) increases MIDDLE primaryRole share without inventing closers | mlb-bullpen-role | DATA_COLLECTION | asOf 2026-07-27: **15** graded · **563** rows · target ≥100 | Historical: v1 MIDDLE 1. Current Final: MIDDLE **121**; CLOSER **31** (no closer inflation vs v1 CLOSER 31) | PROHIBITED | Track MIDDLE/CLOSER share across additional days |
| H-BP-ROLE-004 | Multi-factor LONG score (multiInningRate, medianOuts, earlyEntry, HL cap) is more stable than avgOuts-only | mlb-bullpen-role | DATA_COLLECTION | asOf 2026-07-27: **15** graded · **563** rows · target ≥100 | Historical: LONG 110→28. Current: LONG **28** · longUnderSample3 **0**; OPENER/MOP_UP primary still **0** | PROHIBITED | Observe LONG stability on new finished games; classifier frozen |
| H-BP-ROLE-005 | primaryRole + secondaryRoles preserves multi-role signals better than single-label priority | mlb-bullpen-role | DATA_COLLECTION | asOf 2026-07-27: **15** graded · **563** rows · target ≥100 | withSecondaryRoles **164** / 563; fail pregame warn **7**/7 · success stable **2**/5 (research signal only); FP **2** | PROHIBITED | Accumulate Success/Failure flow days before any admission review |
| H-BP-ROLE-006 | Bullpen availability (IL/option/DFA) is collectible pre-game for research | mlb-bullpen-role | SURVEY_ONLY | Survey only (not a graded-game sample): 1 team probe (TB Rays, teamId 139) · collector finished-slates **0** | Feasibility **PARTIAL_COLLECTIBLE**; primary source `rosterType=40Man` status.code; `/api/v1/injuries` **404**; collector **not** implemented; `availabilityUnknown` remains true | PROHIBITED | Research-only 40Man collector later; do **not** wire into classifier/Engine |
| H-BP-ROLE-007 | UNKNOWN rate declines naturally under frozen classifier v1.1 as samples accumulate | mlb-bullpen-role | DATA_COLLECTION | asOf 2026-07-27 Final: UNKNOWN **51.3%** (289/563) · Historical partial: **51.3%** (269/524) · 07-28 cross-day delta: awaiting | Observation: delta vs partial baseline **0**; verdict **UNKNOWN_RATE_STABLE_OR_INCONCLUSIVE**; classifier frozen | PROHIBITED | Record UNKNOWN delta when next finished slate (e.g. 07-28) exists |

Notes (Bullpen):

- Linked in `registry.json` today: `H-BP-ROLE-001`…`005`. `006`/`007` are research-ops rows documented here from existing survey/observation artifacts (Framework registry code unchanged).
- Artifact refs: `data/research/mlb/h-bp-role-006-availability-survey.json`, `data/research/mlb/h-bp-role-007-unknown-decline-observation.json`.

### Starter Dataset (`mlb-starter`)

Dataset status: **COLLECTING** · Builder: `starter-dataset-builder-v1` · Engine: **PROHIBITED** · No Starter Score in v1

**Current cumulative** (asOfDate **2026-07-27** summary generatedAt · source: `data/audits/starter-dataset-v1-accumulation-summary.json`):

- **27** games / **54** rows · probable **53** / missing **1** · STARTER_MATCHED **30** · STARTER_CHANGED **0** · AWAITING_RESULT **24**

**Per-day (historical / dated — preserved):**

- 2026-07-27 postgame (`…-starter-postgame-review-v1.json`): MATCHED **30** · CHANGED **0** · AWAITING **0** (Yankees@Phillies Final → STARTER_MATCHED ×2)
- 2026-07-28 pre-game freeze: MATCHED **0** · AWAITING **24** (slate unfinished)

| ID | 제목 | Dataset | 현재 상태 | 표본 수 (current) | 현재 근거 | Engine 사용 | 다음 액션 |
|----|------|---------|-----------|-------------------|-----------|-------------|-----------|
| H-ST-001 | Pre-cutoff ERA gap vs baseline pick aligns with SIGNAL_WORKED more than chance | mlb-starter | DATA_COLLECTION | asOf accumulation: **27** games / **54** rows · target ≥100 | Pre-game freeze only; seasonStats available **53**; no PROMISING evaluation | PROHIBITED | Accumulate games + graded outcomes; no score/Engine |
| H-ST-002 | WHIP gap adds independent pre-game information beyond ERA gap | mlb-starter | DATA_COLLECTION | asOf accumulation: **27** games / **54** rows · target ≥100 | WHIP present in seasonStats payload; independent-signal test not run (collection phase) | PROHIBITED | Keep collecting; evaluate only after ≥100 games |
| H-ST-003 | Recent-3 form as auxiliary signal reduces false confidence when season sample is thin | mlb-starter | DATA_COLLECTION | asOf accumulation: **27** games / **54** rows · day avg sampleSize 15.8 (07-27) / 14.3 (07-28) | recentStarts available **53**; thin-sample auxiliary test pending more days | PROHIBITED | Continue accumulation; do not invent confidence score |
| H-ST-004 | Probable→actual starter changes (STARTER_CHANGED) explain a measurable share of failures | mlb-starter | DATA_COLLECTION | Cumulative: MATCHED **30** · CHANGED **0** · AWAITING **24** · 07-27 day: MATCHED **30** / AWAITING **0** | Yankees@Phillies Final → STARTER_MATCHED (not CHANGED); no STARTER_CHANGED cases yet on finished 07-27 slate; 07-28 still AWAITING | PROHIBITED | Re-run Final-only postgame when 07-28 finishes; never overwrite probable |

Notes (Starter):

- Probable ≠ confirmed. Never backfill pre-game artifacts.
- Do not mark PROMISING from one slate.

---

## Discarded hypotheses

| ID | 제목 | Dataset | 폐기 사유 | 폐기일 | 비고 |
|----|------|---------|-----------|--------|------|
| — | — | — | — | — | (empty — none discarded) |

---

## Operational counts (this registry pass)

| Metric | Count |
|--------|------:|
| Total active H-* | 11 |
| Bullpen (H-BP-ROLE-*) | 7 |
| Starter (H-ST-*) | 4 |
| DATA_COLLECTION | 10 |
| SURVEY_ONLY | 1 |
| REVIEW_PENDING | 0 |
| Engine Candidate (REVIEW or ALLOWED) | 0 |
| Discarded | 0 |

Numbers reuse existing audits/summaries / ledger citations only — **no new calculations**. Statuses unchanged this pass.

---

### Field template (link objects)

```text
hypothesisId
title
datasetId
currentStatus: DATA_COLLECTION | SURVEY_ONLY | REVIEW_PENDING | REJECTED | …
sampleCount (with asOfDate / source for current totals)
currentEvidence
engineUsage: PROHIBITED | REVIEW | ALLOWED
nextAction
requiredFields
supportingCount
contradictingCount
inconclusiveCount
minimumSampleTarget
autoApply: false
lastEvaluatedAt
```
