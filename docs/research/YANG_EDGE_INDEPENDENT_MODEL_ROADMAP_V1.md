# YANG EDGE Independent Model Roadmap v1

Design only. This file does not implement Engine weights, prediction snapshots, or Provider calls inside prediction.

Independent Statistical Model sample today: **0**.

---

## Problem

YANG EDGE currently issues three things that are all called “Prediction”:

1. **Legacy Heuristic** — Edge Engine `rule-v1` over incomplete AnalysisData (often starter ERA/WHIP plus empty team placeholders).
2. **Market Assisted** — MLB Baseline v0 logit that **includes** `marketPrior * 0.25`.
3. **Market Baseline** — Football ARGMAX of normalized 1x2.

None of these is:

```
Player → Availability → Starting lineup strength → Matchup → Team/context
        → Independent probability
        → Market benchmark (after)
```

Market must leave the independent probability formula.

---

## Target architecture

```
SPORT DATA (pregame, cutoff-clean)
    ↓
Player Strength
    ↓
Availability
    ↓
Starting Lineup Strength
    ↓
Matchup Features
    ↓
Team / Context Features
    ↓
INDEPENDENT SPORTS MODEL
    ↓
Independent Probability
    ↓
MARKET BENCHMARK  (display / compare only)
    ↓
Model vs Market
    ↓
Result
    ↓
Success / Failure Review
    ↓
Feature Validation
    ↓
Backtest
    ↓
Engine Admission
```

Rules:

- Market odds, implied probability, valueEdge, and odds movement **do not enter** Independent Probability.
- Result / boxscore / closing-after-start data **do not enter** pregame features.
- Feature validation and backtest **do not silently rewrite** frozen historical labels. New model days start a new track.
- Engine Admission remains a later gate. Research baseline ≠ Engine Candidate.

---

## MLB roadmap (design)

### Stage M0 — Freeze the truth (this audit)

- Keep historical Scorecards on their original tracks.
- Independent sample = 0.
- Do not retcon v0 as independent because it has ERA/WHIP.

### Stage M1 — Independent probability v0 (sports only)

Inputs allowed in the first independent formula (only if already cutoff-clean in datasets):

- Probable starter identity
- ERA / WHIP / IP sample shrink (already in starter-dataset)
- Confirmed lineup **identity list** (already stored)
- Fixed or park-agnostic home context only if documented as assumption, not as “validated park factor”

Explicitly **out** of M1:

- marketPrior
- bullpen weight (dataset not engine-admitted)
- invented FIP/xFIP/wOBA

M1 output: `independentHomeP` stored **next to** (not mixed with) `marketHomeP`.

Comparison: `modelEdge = independentP - marketP` is post-model.

### Stage M2 — Lineup strength without market

Requires new typed batter features that **do not exist today**:

- Batter identity × slot
- Handedness
- vs LHP / vs RHP or a documented proxy
- Replacement delta when a confirmed bat is missing vs expected

Until those exist, “lineup used” must remain completeness-only.

### Stage M3 — Starter advanced + matchup

Only after dataset + leakage + scorecard:

- K/BB already stored → rate features
- Then FIP-like or pitch data **if a legal Provider field is actually stored**
- Batter vs starter (not “team OPS vs ERA”)

Do not skip to pitch-tracking. Repository currently has **no** pitch mix / velo / CSW types.

### Stage M4 — Bullpen + availability shocks

Bullpen-role-dataset-v1_1 already stores fatigue/roles for some dates with `engineEligible: false`.

Admission path: Variable Scorecard → backtest → Engine Admission. Not a weight edit from one week of review.

Injury dataset is roster/IL context, not a silent “player out ⇒ ΔP” model until replacement values exist.

### Stage M5 — Context

Travel/rest and weather are incomplete (weather forecast `NOT_COLLECTED`). Park factors are absent. Do not pretend they are in the model.

---

## Football roadmap (design)

Football today has **no independent probability**. Market baseline is a benchmark that was issued as the pick.

### Stage F0 — Keep Market Baseline as benchmark

Do not delete 2026-08-14 / 2026-08-18 market-baseline artifacts. Relabel them as **Market Baseline track**, not Independent.

### Stage F1 — Persist sports inputs that the Provider already exposes

Repository already has methods:

- `getLineups`
- `getInjuries`
- `getStandings`
- `getTeamStatistics`

These must become **typed research datasets** with cutoff, identity join, and engineAdmission PROHIBITED — the MLB lineup/starter pattern — **before** any football independent formula.

Until then, calling `getLineups` from a prediction job would violate the current “prediction consumes artifacts, never Provider” rule.

`getTeamStatistics` is `raw: unknown`. Do not invent xG fields. If the payload contains xG, document the exact keys after an artifact exists. Until then: **UNKNOWN**.

### Stage F2 — Starting XI strength

- Confirmed XI identity
- Minutes / availability
- Replacement quality when a starter is out
- Position group strengths

No independent football model is honest without XI. Schedule + odds is not XI.

### Stage F3 — Matchup + team context

Only after XI:

- Attack vs defense (only metrics actually stored)
- Rest / home-away from schedule
- Still no market inside P()

### Stage F4 — Independent P vs Market Baseline

Reuse football market-baseline-v0 as the **benchmark**, not as the model.

---

## Shared architecture decisions

| Decision | Choice |
|---|---|
| Market in independent P() | Forbidden |
| Historical scorecards | Keep; split tracks |
| Official pick | Remains off until independent model + gates exist |
| Provider at predict time | Forbidden; artifacts only |
| Result in pregame | Forbidden |
| First independent day | New `modelStatus`, new sample counter starting at 0 |
| Engine Admission | After feature validation + backtest, not after one Scorecard |

---

## Suggested artifact names (future, not created here)

- `data/predictions/mlb/{date}.independent-v0.json`
- `data/research/football/{date}-independent-prediction-v0.json`
- Scorecard dimensions that never mix Market Baseline accuracy into Independent accuracy

Do not write those files in this mission.

---

## Success condition for a later implementation mission

A day can be counted as Independent Statistical Model only if:

1. Probability is computed from sports features listed in that day’s input manifest.
2. `marketPrior` / implied odds are absent from the logit / argmax.
3. Market probability is stored for comparison.
4. Lineup/XI identity used for strength is documented (or explicitly declared out of scope for that version).
5. Leakage guard still blocks post-start inputs.

Until then, Independent Model Sample stays **0**.
