# YANG EDGE Prediction Methodology Audit v1

Status: **AUDIT ONLY**. This document does not change Engine weights, prediction snapshots, or recommendation gates.

Source of truth: Repository code + frozen artifacts + Git. Chat history is not evidence.

Independent Statistical Model sample: **0**.

---

## 0. Immutable rules observed

This audit did not:

- rewrite any `data/predictions/**` snapshot
- regenerate historical predictions
- change `src/lib/mlb/prediction-v0/config.ts` weights
- change recommendation / official-pick thresholds
- add Provider calls to prediction
- load Result/Postgame artifacts as pregame features
- rewrite Scorecard numbers
- track local `리포트/`

---

## 1. Current state recovery (mission start)

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `877fdc0e419da3dc1a60385608ce97133cec9daa` (`data: close mlb 2026-08-20 postgame research`) |
| origin/main | `877fdc0e419da3dc1a60385608ce97133cec9daa` |
| Ahead / behind | 0 / 0 |
| Status | untracked `리포트/` only |

Recent prediction-related commits (Git):

- `e7ffe7c` data: freeze 2026-08-20 pregame predictions
- `f275518` data: freeze 2026-08-19 pregame predictions
- `3b1f1f1` data: freeze football 2026-08-18 prediction input snapshot
- `f515911` feat: add football market baseline prediction v0
- `1abfe90` feat: add football prediction snapshot v0
- `f257569` feat(mlb): add daily pregame prediction line v0
- `023191d` feat(mlb): add postgame prediction scorecard v0

Two MLB freeze paths coexist in the repo:

1. `npm run predict:mlb-v0` / daily pregame stage `PREDICTION_V0` → `RESEARCH_BASELINE_V0`
2. `npm run predict:mlb` (`scripts/build-mlb-prediction-snapshot-v1.ts`) → `LEGACY_V1` Edge Engine `rule-v1`

Football issued predictions are only Market Baseline v0.

---

## 2. What “Prediction” currently is

### MLB

**A. Research Baseline v0** (`mlb-baseline-prediction-v0.1.0`, status `RESEARCH_BASELINE_V0`)

Formula (model card + `compute-moneyline.ts`):

```
logit = starter*0.55 + bullpen*0 + lineup*0 + homeAdvantage*0.08 + marketPrior*0.25
homeP = clamp(shrink(sigmoid(logit)), 0.35, 0.65)
```

- Starter score uses **ERA + WHIP**, shrunk by innings pitched.
- Strikeouts, walks, throws are copied onto `StarterFeature` and **not used** in `starterScoreFromStats`.
- Confirmed lineup is converted to completeness only. **Weight = 0**.
- Bullpen feature is always `DISABLED`. **Weight = 0**.
- `marketPrior` is `logit(de-vig home moneyline) * 0.25`. This is a **probability input**, not display-only.
- `officialPick` is disabled (`enableOfficialPick=false`). Official pick count on all frozen v0 days: **0**.

**B. Legacy Edge Engine** (`rule-v1`, snapshot contract `LEGACY_V1`)

- `runEdgeEngine(analysisData)` → `winProbability` from weighted team heuristics + starter ERA/WHIP.
- Current prediction consumer (`load-mlb-prediction-consumer-input.ts`) fills AnalysisData with **empty/NaN team form**, and only probable-starter ERA/WHIP when present. `injuries` and `streak` are marked available even when empty (score 0).
- Early 2026-07-27 snapshot was sourced from `mlb-baseline-analysis-v1` and records team-form `usedFactors` (recent form, scoring, defense, standings, H2H, rest) **without starter**.
- Market is attached **after** the engine via `buildMarketComparison`. Market is **not** inside `winProbability`.
- Value Edge is used later as a **betting-line review gate**, not to rewrite probability.

Neither A nor B is an Independent Sports Research Model (Player → Lineup → Matchup → Team Context, then compare to market).

### Football

**Prediction Snapshot v0** freezes Schedule + 1x2 Odds. `meta.prediction = NONE`, `meta.engine = NONE`. Classification: `INSUFFICIENT_INPUT` (input freeze, not a model).

**Market Baseline Prediction v0** consumes that freeze and sets:

- `predictionClass = MARKET_BASELINE`
- `baselineRule = ARGMAX_NORMALIZED_MARKET_PROBABILITY`
- `model = NONE`, `engine = NONE`, `officialPickCount = 0`

The football “prediction probability” **is** the renormalized market probability.

### Independent model

**Does not exist. Sample = 0.**

---

## 3. Historical classification

Primary daily artifacts only (no `.rev-*` files). Machine-readable rows: `data/audits/yang-edge-prediction-methodology-audit-v1.json`.

| Date | Sport | Model | Games | Official picks | Market in P() | Classification |
|---|---|---|---|---|---|---|
| 2026-07-27 | MLB | LEGACY_V1 (`mlb-baseline-analysis-v1`) | 15 | 0 | No (display/valueEdge) | LEGACY_HEURISTIC |
| 2026-07-28 | MLB | LEGACY_V1 | 12 | 0 | No | LEGACY_HEURISTIC |
| 2026-07-29 | MLB | LEGACY_V1 | 16 | 0 | No | LEGACY_HEURISTIC |
| 2026-07-30 | MLB | LEGACY_V1 | 16 | 0 | No | LEGACY_HEURISTIC |
| 2026-07-31 | MLB | LEGACY_V1 | 10 | 0 | No | LEGACY_HEURISTIC |
| 2026-08-02 | MLB | RESEARCH_BASELINE_V0 | 15 | 0 | **Yes (marketPrior)** | MARKET_ASSISTED |
| 2026-08-03 | MLB | RESEARCH_BASELINE_V0 | 15 | 0 | n/a (all BLOCKED) | BLOCKED |
| 2026-08-06 | MLB | RESEARCH_BASELINE_V0 | 15 | 0 | Yes | MARKET_ASSISTED |
| 2026-08-08 | MLB | RESEARCH_BASELINE_V0 | 15 | 0 | Yes | MARKET_ASSISTED |
| 2026-08-12 | MLB | RESEARCH_BASELINE_V0 | 15 | 0 | Yes | MARKET_ASSISTED |
| 2026-08-13 | MLB | RESEARCH_BASELINE_V0 | 15 | 0 | Yes | MARKET_ASSISTED |
| 2026-08-14 | MLB | RESEARCH_BASELINE_V0 | 9 | 0 | Yes | MARKET_ASSISTED |
| 2026-08-14 | FOOTBALL | prediction-snapshot-v0 | 13 | 0 | No (freeze only) | INSUFFICIENT_INPUT |
| 2026-08-14 | FOOTBALL | market-baseline-v0 | 13 (1 predicted) | 0 | **Yes (IS the pick)** | MARKET_BASELINE |
| 2026-08-15 | MLB | RESEARCH_BASELINE_V0 | 14 | 0 | Yes | MARKET_ASSISTED |
| 2026-08-17 | MLB | RESEARCH_BASELINE_V0 | 15 | 0 | Yes | MARKET_ASSISTED |
| 2026-08-18 | MLB | LEGACY_V1 | 11 | 0 | No | LEGACY_HEURISTIC |
| 2026-08-18 | FOOTBALL | prediction-snapshot-v0 | 1 | 0 | No | INSUFFICIENT_INPUT |
| 2026-08-18 | FOOTBALL | market-baseline-v0 | 1 (1 predicted) | 0 | Yes | MARKET_BASELINE |
| 2026-08-19 | MLB | RESEARCH_BASELINE_V0 | 15 | 0 | Yes | MARKET_ASSISTED |
| 2026-08-20 | MLB | LEGACY_V1 | 15 | 0 | No | LEGACY_HEURISTIC |

Counts (21 artifacts):

| Class | N |
|---|---|
| INDEPENDENT_STATISTICAL | **0** |
| LEGACY_HEURISTIC | 7 |
| MARKET_ASSISTED | 9 |
| MARKET_BASELINE | 2 |
| INSUFFICIENT_INPUT | 2 |
| BLOCKED | 1 |

Display vs formula (the distinction this mission requires):

- **Displayed only / benchmark:** Legacy MLB `marketProbability` + `valueEdge`. Football snapshot frozen odds. MLB v0 `oddsMovement`.
- **Entered probability:** MLB v0 `marketPrior`. Football market-baseline `baselineProbability`.

2026-08-03 note: primary snapshot `blockedCount=15`, `predictedGames=0`. Sidecar `2026-08-03.rev-...INVALID_FOR_PREGAME.json` exists and was not treated as a second primary day.

No primary MLB snapshot on 2026-08-01, 08-04, 08-05, 08-07, 08-09–08-11, 08-16.

KBO/NPB snapshots exist under `data/predictions/` and are **out of this MLB/Football audit scope**.

---

## 4. MLB feature utilization (summary)

Full matrix: `docs/research/YANG_EDGE_FEATURE_UTILIZATION_MATRIX_V1.md`.

**Actually used in a frozen MLB probability**

- Starter ERA, WHIP, IP (sample shrink)
- Fixed home advantage (v0)
- Market de-vig moneyline (v0 probability input; legacy display only)
- Legacy team heuristics when AnalysisData was populated (2026-07-27 usedFactors)

**Stored, not used in prediction**

- Starter K, BB, HR, recent starts, throws
- Confirmed lineup 1–9 identity (completeness gate / weight 0)
- Bullpen role dataset (July sample dates; v0 never loads it)
- Injury / weather / travel-rest datasets (sample dates; engineAdmission PROHIBITED)
- Odds run-line / totals rows
- Odds movement

**Not present in repository types**

- FIP, xFIP, xERA, K%, BB%, K-BB%, HR/9, GB%, pitch mix, velocity, pitch value, whiff%, CSW%
- Batter AVG/OBP/SLG/OPS/ISO/wOBA/wRC+/platoon splits
- Lineup handedness, replacement delta, weighted lineup strength, batter-vs-starter matchup
- Baserunning
- Park factors / collected weather forecasts (`provider.selected = null`, forecast `NOT_COLLECTED`)

Dummy UI copy in `src/constants/analysis.ts` (FIP, OPS, PPDA, xGA) is **not** a prediction input.

---

## 5. Football feature utilization (summary)

**Actually used in issued football probability**

- Frozen 1x2 median de-vig → renormalize → argmax
- Schedule identity / kickoff (cutoff and freeze window only)

**Provider methods exist, not used by prediction**

- `ApiFootballProvider.getLineups`
- `getInjuries`
- `getStandings`
- `getTeamStatistics` (returns `raw: unknown`; schema not persisted)

**Not present as football research datasets**

- Starting XI quality, replacement level, minutes, xG/npxG/xA, shots, PPDA, field tilt, GK PSxG-GA, rest days as a strength feature

Market Baseline must not be described as an independent sports model.

---

## 6. Market dependence

### MLB v0

| Item | Role |
|---|---|
| marketPrior | **Probability input** + Feature |
| de-vig implied probability | Feature + Probability input + Benchmark |
| modelEdge / valueEdge | Benchmark; official-pick gate (disabled) |
| oddsMovement | Display only |
| bookmaker best h2h | Source of the prior, not a movement model |

### MLB legacy

| Item | Role |
|---|---|
| marketProbability / valueEdge | Display + Benchmark |
| betting-line-filter valueEdge ≤ 0 | Recommendation **review gate** (MARKET_CONFLICT) |
| Engine winProbability | Independent of odds formula (team/starter heuristics only) |

### Football

| Item | Role |
|---|---|
| normalized 1x2 | **Probability input** (the pick) |
| snapshot frozen odds | Feature / display freeze |

Target split (not implemented):

```
Independent Sports Probability
        ↓
Market Probability
        ↓
Model vs Market Comparison
```

Today MLB v0 mixes the first two. Football market baseline **is** the second with no first.

---

## 7. Explainability gap

| Question | MLB | Football |
|---|---|---|
| Why HOME/AWAY? | PARTIAL (starter vs market vs homeAdvantage tags) | PARTIAL (argmax market) |
| Why this probability? | PARTIAL (reconstructable logit + clamp, not calibrated) | SUPPORTED (market share) |
| Which player flipped the side? | PARTIAL (starter name/ERA/WHIP only) | NOT_SUPPORTED |
| Which matchup mattered most? | PARTIAL (component direction in review-detail) | NOT_SUPPORTED |
| What if a key player is out? | NOT_SUPPORTED | NOT_SUPPORTED |
| Why disagree with market? | PARTIAL (MARKET_DISAGREEMENT after a 0.25 market pull) | NOT_SUPPORTED (cannot disagree) |

---

## 8. Historical Scorecard recommendation

Do **not** delete or rewrite existing Scorecard / graded-prediction numbers.

Split future reporting tracks:

1. Legacy Heuristic — `LEGACY_V1` days
2. Market Assisted — `RESEARCH_BASELINE_V0` days (`useMarketPrior=true`)
3. Market Baseline — football market-baseline-v0 (and any future MLB market-only baseline)
4. Independent Statistical Model — **start at sample 0**

Starting Independent sample at 0 is required. Relabeling v0 (market inside logit) or football argmax as “independent research” would falsify the track.

---

## 9. Leakage audit (read-only)

- `prediction-v0/leakage-guard.ts` blocks prediction after commence, starter target-game-in-stats, post-start odds/lineup.
- `load-and-predict.ts` does not load official-result artifacts.
- Football `official-result-v0` is postgame and is not an input to market-baseline build.
- 2026-08-03 is frozen BLOCKED (invalid for pregame), not silently reused as a clean sample.

---

## 10. Engine / weight / prediction logic changes this mission

**0.**

See also `docs/research/YANG_EDGE_INDEPENDENT_MODEL_ROADMAP_V1.md`.
