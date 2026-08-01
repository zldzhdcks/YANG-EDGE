# MLB Baseline Prediction v0 — Model Card

Status: `RESEARCH_BASELINE_V0` (not an Engine Candidate)

## Supported market

- `MONEYLINE_2WAY` (HOME / AWAY)

## Not implemented

- TOTALS, RUN_LINE, HANDICAP, FIRST_5_INNINGS, PLAYER_PROPS, PARLAY → `NOT_IMPLEMENTED`

## Formula

```
logit = starter*w_s + bullpen*w_b + lineup*w_l + homeAdvantage + marketPrior*w_m
homeP = clamp(shrink(sigmoid(logit)), 0.35, 0.65)
awayP = 1 - homeP
```

All weights are `BASELINE_ASSUMPTION`. Bullpen and lineup performance weights are `DISABLED` (0).

## Official vs research

- `researchBaseline` stored when computation succeeds
- `officialPick` default **null** (`enableOfficialPick=false`)
- PASS/ELIGIBLE/BLOCKED via leakage, cutoff, input quality

## Leakage policy

Forbidden: target boxscore, post-start lineup/odds, target outing in starter stats, result-driven weights.
Result artifacts may exist on disk but are **not loaded** during prediction.

## Known limitations

- No calibrated probabilities
- Starter ERA/WHIP only (+ small home prior + mild market prior)
- Bullpen/lineup performance unused
- Clamp 35–65% — intentionally conservative

## CLI

```bash
npm run predict:mlb-v0 -- --date YYYY-MM-DD --dry-run
npm run test:mlb-prediction-v0
```
