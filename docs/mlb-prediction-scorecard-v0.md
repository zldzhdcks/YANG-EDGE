# MLB Prediction Scorecard v0

Postgame additive scorecard for frozen `RESEARCH_BASELINE_V0` (and legacy-adapted) prediction snapshots.

## Official vs Research

| Track | Source | When graded |
|-------|--------|-------------|
| Official | `officialPick` / ELIGIBLE | Production path via `grade:mlb`; scorecard reports **N/A** while `officialPickCount=0` |
| Research | `marketPredictions[].researchBaseline` | Observational; PASS included, **BLOCKED excluded** from accuracy denominators |

Accuracy alone is a weak signal on small samples. Prefer Brier / Log Loss / calibration with `INSUFFICIENT_SAMPLE` when n is small.

## CLI

```bash
npm run scorecard:mlb-v0 -- --date YYYY-MM-DD --dry-run --json
npm run scorecard:mlb-v0 -- --date YYYY-MM-DD --json
npm run scorecard:mlb-v0 -- --date YYYY-MM-DD --game-id <gamePk> --allow-partial-results
```

- `--dry-run` → write 0
- Provider calls = 0
- Prediction snapshot mutation = 0

## Artifact

`data/research/mlb/{date}-prediction-scorecard-v0.json`

Does **not** replace:

- official-results
- graded-predictions
- success/failure review
- daily-review-summary

## Grading unit

`gamePk + marketType` — v0 supports **MONEYLINE_2WAY** only.

Unsupported markets (TOTALS, RUN_LINE, FIRST_5, DOMESTIC_THREE_WAY_SPECIAL, SUM) are excluded from denominators.

## Probability metrics

- **Brier (HOME outcome):** `(modelHomeP - actualHomeWin)^2`
- **Log Loss:** `-ln(homeP)` or `-ln(awayP)` with epsilon clamp
- VOID / PENDING / BLOCKED excluded from research metric denominators
- Requires finite probs, `0 < p < 1`, `homeP + awayP ≈ 1`

## Calibration

Buckets on **selected-side** probability:

`0.500–0.525`, `0.525–0.550`, `0.550–0.575`, `0.575–0.600`, `0.600–0.650`

Statuses: `EMPTY` | `INSUFFICIENT_SAMPLE` | `OBSERVATION_ONLY`

## Confidence

Separate buckets (`0–39` … `80–100`). Not a win-rate calibration proxy.

## Most Likely vs Value

- **mostLikelySelection** — higher model probability
- **selectedSideEdge** — modelP − marketP on mostLikely side (may be negative)
- **valueSelection** — side with larger strictly positive model−market edge
- ROI / realizedReturn is **null** until settled prices exist

## Market Agreement

`MODEL_AND_MARKET_AGREE` | `MODEL_MARKET_DISAGREE` | `NEAR_EVEN` | `MARKET_MISSING`

Config thresholds live in `scorecard-v0/config.ts`. Single-day conclusions stay `INSUFFICIENT_SAMPLE` / `OBSERVATION_ONLY`.

## Components

Directional association only (`DIRECTIONAL_ASSOCIATION_ONLY`):

- starter, marketPrior, homeAdvantage
- bullpen / lineup → `DISABLED`

Do **not** change weights from one date’s scorecard.

## BLOCKED counterfactual

Logged under `blockedPolicyReview` with `includedInResearchDenominator=false`. Never backfill PASS after seeing results.

## Postgame order (after all games FINAL)

1. `npm run result:mlb -- YYYY-MM-DD`
2. `npm run review:mlb-daily -- YYYY-MM-DD`
3. `npm run scorecard:mlb-v0 -- --date YYYY-MM-DD --json`
4. `npm run audit:mlb-prediction-identity-v0 -- --date YYYY-MM-DD --json`

## Insufficient sample policy

Do not promote thresholds, weights, or BLOCKED policy from a single slate.
