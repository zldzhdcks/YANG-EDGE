# Football Poisson cross-league baseline V1

Independent league results; EPL is the previously sealed reference and was not rerun. No pooled accuracy or automatic model promotion.

| League | Targets | Predicted | PASS | Coverage | Accuracy | LogLoss | Brier | DrawPredicted | DrawActual | DrawRecall | ComparatorAccuracy | ComparatorLogLoss | ComparatorBrier | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EPL | 380 | 353 | 27 | 0.928947 | 0.518414 | 1.007318 | 0.602727 | 0 | 85 | 0 | 0.405099 | 1.082381 | 0.656573 | BASELINE_MEASURED |
| La Liga | 380 | 352 | 28 | 0.926316 | 0.511364 | 1.000107 | 0.596235 | 1 | 90 | 0 | 0.440341 | 1.075104 | 0.650323 | BASELINE_MEASURED |
| Serie A | 380 | 351 | 29 | 0.923684 | 0.535613 | 0.991505 | 0.593166 | 3 | 99 | 0.020202 | 0.396011 | 1.093296 | 0.662918 | BASELINE_MEASURED |
| Bundesliga | 306 | 286 | 20 | 0.934641 | 0.475524 | 1.044690 | 0.627999 | 1 | 74 | 0 | 0.388112 | 1.089474 | 0.661000 | BASELINE_MEASURED |

## EPL

Classification: BASELINE_MEASURED. Probabilities/calibration below use the PREDICTED cohort only.

| Outcome | Predicted | Actual | Correct |
| --- | --- | --- | --- |
| HOME | 228 | 143 | 114 |
| DRAW | 0 | 85 | 0 |
| AWAY | 125 | 125 | 69 |

Mean pHome/pDraw/pAway: 0.436033 / 0.220008 / 0.343959. Confusion rows actual, columns predicted HOME/DRAW/AWAY: [[114,0,29],[58,0,27],[56,0,69]].

| Outcome | Bin | N | Mean predicted | Observed | Low sample |
| --- | --- | --- | --- | --- | --- |
| HOME | [0,0.1) | 8 | 0.076484 | 0 | true |
| HOME | [0.1,0.2) | 26 | 0.158237 | 0.153846 | false |
| HOME | [0.2,0.3) | 51 | 0.255230 | 0.254902 | false |
| HOME | [0.3,0.4) | 54 | 0.357229 | 0.351852 | false |
| HOME | [0.4,0.5) | 94 | 0.448787 | 0.425532 | false |
| HOME | [0.5,0.6) | 56 | 0.558808 | 0.482143 | false |
| HOME | [0.6,0.7) | 41 | 0.640516 | 0.585366 | false |
| HOME | [0.7,0.8) | 21 | 0.738492 | 0.666667 | false |
| HOME | [0.8,0.9) | 2 | 0.818882 | 1 | true |
| HOME | [0.9,1] | 0 | null | null | true |
| DRAW | [0,0.1) | 0 | null | null | true |
| DRAW | [0.1,0.2) | 83 | 0.171377 | 0.192771 | false |
| DRAW | [0.2,0.3) | 270 | 0.234958 | 0.255556 | false |
| DRAW | [0.3,0.4) | 0 | null | null | true |
| DRAW | [0.4,0.5) | 0 | null | null | true |
| DRAW | [0.5,0.6) | 0 | null | null | true |
| DRAW | [0.6,0.7) | 0 | null | null | true |
| DRAW | [0.7,0.8) | 0 | null | null | true |
| DRAW | [0.8,0.9) | 0 | null | null | true |
| DRAW | [0.9,1] | 0 | null | null | true |
| AWAY | [0,0.1) | 10 | 0.081727 | 0.100000 | true |
| AWAY | [0.1,0.2) | 66 | 0.159548 | 0.227273 | false |
| AWAY | [0.2,0.3) | 84 | 0.251829 | 0.250000 | false |
| AWAY | [0.3,0.4) | 80 | 0.346530 | 0.275000 | false |
| AWAY | [0.4,0.5) | 45 | 0.440809 | 0.488889 | false |
| AWAY | [0.5,0.6) | 38 | 0.544498 | 0.578947 | false |
| AWAY | [0.6,0.7) | 18 | 0.640661 | 0.722222 | true |
| AWAY | [0.7,0.8) | 8 | 0.738048 | 0.750000 | true |
| AWAY | [0.8,0.9) | 4 | 0.807586 | 0.750000 | true |
| AWAY | [0.9,1] | 0 | null | null | true |

## La Liga

Classification: BASELINE_MEASURED. Probabilities/calibration below use the PREDICTED cohort only.

| Outcome | Predicted | Actual | Correct |
| --- | --- | --- | --- |
| HOME | 236 | 155 | 125 |
| DRAW | 1 | 90 | 0 |
| AWAY | 115 | 107 | 55 |

Mean pHome/pDraw/pAway: 0.441177 / 0.250692 / 0.308131. Confusion rows actual, columns predicted HOME/DRAW/AWAY: [[125,0,30],[60,0,30],[51,1,55]].

| Outcome | Bin | N | Mean predicted | Observed | Low sample |
| --- | --- | --- | --- | --- | --- |
| HOME | [0,0.1) | 1 | 0.052882 | 0 | true |
| HOME | [0.1,0.2) | 22 | 0.163646 | 0.227273 | false |
| HOME | [0.2,0.3) | 49 | 0.250823 | 0.224490 | false |
| HOME | [0.3,0.4) | 88 | 0.354027 | 0.318182 | false |
| HOME | [0.4,0.5) | 76 | 0.448523 | 0.434211 | false |
| HOME | [0.5,0.6) | 49 | 0.547911 | 0.612245 | false |
| HOME | [0.6,0.7) | 35 | 0.655684 | 0.657143 | false |
| HOME | [0.7,0.8) | 24 | 0.740692 | 0.750000 | false |
| HOME | [0.8,0.9) | 8 | 0.816949 | 0.875000 | true |
| HOME | [0.9,1] | 0 | null | null | true |
| DRAW | [0,0.1) | 1 | 0.093330 | 0 | true |
| DRAW | [0.1,0.2) | 58 | 0.164113 | 0.155172 | false |
| DRAW | [0.2,0.3) | 230 | 0.254036 | 0.286957 | false |
| DRAW | [0.3,0.4) | 63 | 0.320690 | 0.238095 | false |
| DRAW | [0.4,0.5) | 0 | null | null | true |
| DRAW | [0.5,0.6) | 0 | null | null | true |
| DRAW | [0.6,0.7) | 0 | null | null | true |
| DRAW | [0.7,0.8) | 0 | null | null | true |
| DRAW | [0.8,0.9) | 0 | null | null | true |
| DRAW | [0.9,1] | 0 | null | null | true |
| AWAY | [0,0.1) | 21 | 0.078298 | 0.047619 | false |
| AWAY | [0.1,0.2) | 65 | 0.152020 | 0.184615 | false |
| AWAY | [0.2,0.3) | 94 | 0.251872 | 0.212766 | false |
| AWAY | [0.3,0.4) | 93 | 0.350515 | 0.354839 | false |
| AWAY | [0.4,0.5) | 41 | 0.444457 | 0.512195 | false |
| AWAY | [0.5,0.6) | 24 | 0.548712 | 0.541667 | false |
| AWAY | [0.6,0.7) | 11 | 0.631948 | 0.363636 | true |
| AWAY | [0.7,0.8) | 2 | 0.737483 | 1 | true |
| AWAY | [0.8,0.9) | 1 | 0.844337 | 1 | true |
| AWAY | [0.9,1] | 0 | null | null | true |

## Serie A

Classification: BASELINE_MEASURED. Probabilities/calibration below use the PREDICTED cohort only.

| Outcome | Predicted | Actual | Correct |
| --- | --- | --- | --- |
| HOME | 208 | 139 | 111 |
| DRAW | 3 | 99 | 2 |
| AWAY | 140 | 113 | 75 |

Mean pHome/pDraw/pAway: 0.415819 / 0.248719 / 0.335462. Confusion rows actual, columns predicted HOME/DRAW/AWAY: [[111,0,28],[60,2,37],[37,1,75]].

| Outcome | Bin | N | Mean predicted | Observed | Low sample |
| --- | --- | --- | --- | --- | --- |
| HOME | [0,0.1) | 6 | 0.079701 | 0 | true |
| HOME | [0.1,0.2) | 25 | 0.158807 | 0.080000 | false |
| HOME | [0.2,0.3) | 66 | 0.250824 | 0.242424 | false |
| HOME | [0.3,0.4) | 71 | 0.352494 | 0.239437 | false |
| HOME | [0.4,0.5) | 67 | 0.451898 | 0.507463 | false |
| HOME | [0.5,0.6) | 62 | 0.548802 | 0.564516 | false |
| HOME | [0.6,0.7) | 46 | 0.646964 | 0.608696 | false |
| HOME | [0.7,0.8) | 8 | 0.732411 | 0.875000 | true |
| HOME | [0.8,0.9) | 0 | null | null | true |
| HOME | [0.9,1] | 0 | null | null | true |
| DRAW | [0,0.1) | 0 | null | null | true |
| DRAW | [0.1,0.2) | 38 | 0.176036 | 0.184211 | false |
| DRAW | [0.2,0.3) | 277 | 0.248836 | 0.277978 | false |
| DRAW | [0.3,0.4) | 36 | 0.324536 | 0.416667 | false |
| DRAW | [0.4,0.5) | 0 | null | null | true |
| DRAW | [0.5,0.6) | 0 | null | null | true |
| DRAW | [0.6,0.7) | 0 | null | null | true |
| DRAW | [0.7,0.8) | 0 | null | null | true |
| DRAW | [0.8,0.9) | 0 | null | null | true |
| DRAW | [0.9,1] | 0 | null | null | true |
| AWAY | [0,0.1) | 3 | 0.083881 | 0 | true |
| AWAY | [0.1,0.2) | 81 | 0.156200 | 0.123457 | false |
| AWAY | [0.2,0.3) | 89 | 0.250771 | 0.157303 | false |
| AWAY | [0.3,0.4) | 64 | 0.352962 | 0.375000 | false |
| AWAY | [0.4,0.5) | 55 | 0.448681 | 0.527273 | false |
| AWAY | [0.5,0.6) | 39 | 0.547449 | 0.589744 | false |
| AWAY | [0.6,0.7) | 11 | 0.651091 | 0.545455 | true |
| AWAY | [0.7,0.8) | 8 | 0.739086 | 0.750000 | true |
| AWAY | [0.8,0.9) | 1 | 0.832632 | 1 | true |
| AWAY | [0.9,1] | 0 | null | null | true |

## Bundesliga

Classification: BASELINE_MEASURED. Probabilities/calibration below use the PREDICTED cohort only.

| Outcome | Predicted | Actual | Correct |
| --- | --- | --- | --- |
| HOME | 180 | 111 | 84 |
| DRAW | 1 | 74 | 0 |
| AWAY | 105 | 101 | 52 |

Mean pHome/pDraw/pAway: 0.450134 / 0.218707 / 0.331158. Confusion rows actual, columns predicted HOME/DRAW/AWAY: [[84,1,26],[47,0,27],[49,0,52]].

| Outcome | Bin | N | Mean predicted | Observed | Low sample |
| --- | --- | --- | --- | --- | --- |
| HOME | [0,0.1) | 3 | 0.095371 | 0 | true |
| HOME | [0.1,0.2) | 13 | 0.146838 | 0 | true |
| HOME | [0.2,0.3) | 42 | 0.261264 | 0.333333 | false |
| HOME | [0.3,0.4) | 64 | 0.351811 | 0.265625 | false |
| HOME | [0.4,0.5) | 56 | 0.444087 | 0.321429 | false |
| HOME | [0.5,0.6) | 43 | 0.540290 | 0.511628 | false |
| HOME | [0.6,0.7) | 39 | 0.646773 | 0.641026 | false |
| HOME | [0.7,0.8) | 20 | 0.733996 | 0.550000 | false |
| HOME | [0.8,0.9) | 5 | 0.829311 | 0.800000 | true |
| HOME | [0.9,1] | 1 | 0.902526 | 0 | true |
| DRAW | [0,0.1) | 3 | 0.083215 | 0 | true |
| DRAW | [0.1,0.2) | 80 | 0.172846 | 0.287500 | false |
| DRAW | [0.2,0.3) | 196 | 0.235987 | 0.255102 | false |
| DRAW | [0.3,0.4) | 7 | 0.317090 | 0.142857 | true |
| DRAW | [0.4,0.5) | 0 | null | null | true |
| DRAW | [0.5,0.6) | 0 | null | null | true |
| DRAW | [0.6,0.7) | 0 | null | null | true |
| DRAW | [0.7,0.8) | 0 | null | null | true |
| DRAW | [0.8,0.9) | 0 | null | null | true |
| DRAW | [0.9,1] | 0 | null | null | true |
| AWAY | [0,0.1) | 13 | 0.072229 | 0.076923 | true |
| AWAY | [0.1,0.2) | 53 | 0.149399 | 0.188679 | false |
| AWAY | [0.2,0.3) | 63 | 0.252781 | 0.349206 | false |
| AWAY | [0.3,0.4) | 63 | 0.346976 | 0.349206 | false |
| AWAY | [0.4,0.5) | 54 | 0.445241 | 0.444444 | false |
| AWAY | [0.5,0.6) | 24 | 0.539337 | 0.500000 | false |
| AWAY | [0.6,0.7) | 9 | 0.652846 | 0.444444 | true |
| AWAY | [0.7,0.8) | 7 | 0.743815 | 0.857143 | true |
| AWAY | [0.8,0.9) | 0 | null | null | true |
| AWAY | [0.9,1] | 0 | null | null | true |

CROSS_LEAGUE_STATUS=ALL_BASELINES_MEASURED; VALIDATED_MODEL=NO.

ALL_4_LEAGUES_DRAW_PREDICTED_ZERO=NO.

Result SHA256: 2c51553d966d5957f6b7a7ffecc3871c33645df9edbe90b8b498cf3372847328

Full comparator/class/calibration and Q1–Q5 evidence are in the aggregate review seal. Local result includes all prediction records. No engine/weight/minimum/lag changes, odds, provider predictions, network calls, fabricated observations or betting outputs.

STOP for CTO review. Do not rerun, tune V1, create V2 or merge main.
