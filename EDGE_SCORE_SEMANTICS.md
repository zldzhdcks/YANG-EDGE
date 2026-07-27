# EDGE Score Semantics

Read-only reference for **display and audit** — does not change Engine calculation.

## Formula (Engine)

From `src/lib/edge/calculate-edge.ts`:

1. Factor scores are computed **home-relative** (−1 ~ +1 per factor).
2. Weighted sum → normalized −1 ~ +1.
3. `EDGE Score = clamp(normalized × 30, −30, +30)`.

**Reference side: HOME**

| Sign | Meaning |
|------|---------|
| **> 0** | Home team advantage |
| **< 0** | Away team advantage |
| **0** | No directional edge |

`pickFromEdgeScore(edgeScore, home, away)`:

- `edgeScore >= 0` → pick **home**
- `edgeScore < 0` → pick **away**

Prediction snapshots store this **home-side signed value** in `edgeScore`.
`baselinePick` is the predicted team name aligned with that sign.

## Predicted-side display (not Math.abs)

For UI aimed at the predicted team:

```
predictedSideEdge = baselinePick === homeTeam ? edgeScore : -edgeScore
```

Examples (2026-07-28):

| Match | baselinePick | Raw (home-side) | Predicted-side |
|-------|--------------|-----------------|----------------|
| SEA @ TEX | Texas Rangers | **+8.7** | **+8.7** |
| ARI @ PIT | Arizona Diamondbacks | **−2.8** | **+2.8** |

Arizona’s **−2.8** is not “no edge” — it means away (Arizona) is favored on the home-side scale.

## Negative semantics (confirmed)

| Code | When |
|------|------|
| `EDGE_POSITIVE` | predictedSideEdge > 0 |
| `EDGE_ZERO` | predictedSideEdge === 0 |
| `PREDICTED_SIDE_BELOW_BASELINE` | Pick is home but home-side edge < 0 |
| `OPPOSITE_SIDE_ADVANTAGE` | Pick is away but home-side edge > 0 |
| `NO_POSITIVE_EDGE` | predictedSideEdge < 0 (general) |
| `MARKET_CONFLICT` | baselineStatus === MARKET_CONFLICT |

## Display policy

- **Technical / Research Viewer (기술 정보):** raw home-side signed value (e.g. `-2.8`).
- **General UI:** if predictedSideEdge > 0 → `+N.N` + “Baseline 대비 우위”; else “우위 없음” + optional “원본 EDGE: −2.8”.
- **Never** use `Math.abs(edgeScore)` to force positive display of unfavorable edges.

## TODAY EDGE PICK

- **EDGE_PICK:** requires predictedSideEdge > 0; Value Edge > 0 when present.
- **RESEARCH_CANDIDATE:** may include non-positive predicted-side edge; show “Baseline 기준 우위 없음” (`EDGE_NO_POSITIVE`).

Implementation: `src/lib/edge/edge-score-semantics.ts`

Audit: `scripts/audit-edge-score-direction-semantics.ts` → `data/audits/edge-score-direction-semantics-audit.json`
