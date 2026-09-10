# FOOTBALL_DRAW_STRUCTURAL_FAILURE_REVIEW_V1

BASE_SHA: db7f81883da9215d5cc103a3b954fd35cac83409

## 판정

DRAW_FAILURE_TYPE = ARGMAX_COMPETITION. V2_RESEARCH_JUSTIFIED = YES. V2_IMPLEMENTED = NO.

가장 직접적으로 입증된 원인은 확률 간 argmax 경쟁이다. 1,342개 PREDICTED 중 1,320개(98.36%)는 pDraw < 1/3이다. 나머지 22개 중 17개도 더 높은 HOME/AWAY 확률에 밀렸고 5개만 DRAW였다. 실제 DRAW 348개 중 맞힌 것은 2개다. 이것은 분류 선택의 현상이며, 독립 Poisson이 잘못됐다는 인과 증명이나 argmax 구현 오류 판정은 아니다. Calibration 오차도 관측되지만 그것이 주원인이라는 증거는 부족하다. 이 판정은 calibration 문제가 없다는 뜻이 아니다.

## Frozen evidence와 모집단

기존 2024/25 sealed result만 읽었다. 전체 target 1,446개 = PREDICTED 1,342 + PASS 104. 확률이 없는 PASS를 계산 가능 표본인 것처럼 채우지 않았다. 모든 PASS 수·fixture ID와 PASS의 실제 DRAW 수도 audit에 보존했다. 요청의 actual DRAW 85/90/99/74는 PREDICTED 모집단 기준이다. 현재 시즌 API, archive 재조회, 모델 재실행, 새 성능 실험은 없다. 코드 열람은 산식과 규칙 확인에만 사용했다. Historical 결과는 기존 retrospective provenance 그대로이며 Forward 관측 증거로 승격하지 않는다.

- data/cache/research/football/poisson-chronological-backtest-v1/football-poisson-chronological-backtest-v1.json
  SHA256: 2c02e3685496c07fd533e6f9876b89c48b978a773229b77ed3c8f55ea3a1bb6c
- data/cache/research/football/poisson-chronological-backtest-v1/cross-league-v1/football-poisson-cross-league-backtest-v1.json
  SHA256: 2c51553d966d5957f6b7a7ffecc3871c33645df9edbe90b8b498cf3372847328

두 exact-byte hash는 읽기 전 검증하고 집계 후 다시 검증했다. 모델 source hash는 기존 seal의 6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf이며 모델/Forward 파일은 변경하지 않는다.

## Argmax의 정확한 조건

h+d+a=1에서 m=max(h,a)-d=(1-3d+|h-a|)/2.

DRAW가 최고 확률이려면 d >= (1+|h-a|)/3이어야 한다. 엄격한 1위는 > 조건이다. 따라서 d<1/3이면 불가능하고, d>=1/3이어도 HOME/AWAY 불균형이 크면 불가능하다. 이는 새 threshold 제안이 아니라 기존 argmax를 대수적으로 표현한 것이다. 1,342개 모두 저장 class와 기존 H/D/A 순서 argmax가 일치한다. 동점 처리로 누락된 DRAW는 발견하지 않았다. 실제 DRAW를 더 많이 선택해야 한다는 별도 목적을 정확도 중심 argmax에 사후 주입하지 않았다.

## 리그별 분포

확률 분포 단위는 %, margin은 %p. 분위수는 정렬한 값의 (n−1)p 선형 보간. m>0이면 DRAW가 최상위 승리 class보다 낮고, m<0이면 DRAW가 높다. 아래 near 사례는 작은 양의 margin 순서의 설명용 첫 3개일 뿐이며, 전체 1,342개 순위와 모든 분위수는 audit에 보존했다. near 기준으로 예측 규칙을 생성하지 않았다.

### EPL

- Targets 380; PREDICTED 353; PASS 27 (PASS actual DRAW 8). DRAW predicted 0; actual 85; correct 0.
- 전체 pDraw: min 10.79, P10 16.65, P25 20.13, median 22.24, P75 24.50, P90 26.12, max 29.87, mean 22.00.
- 전체 pHome: min 5.51, P10 20.47, P25 32.25, median 44.17, P75 56.48, P90 65.10, max 81.89, mean 43.60.
- 전체 pAway: min 6.29, P10 15.48, P25 21.44, median 31.87, P75 43.85, P90 59.34, max 82.24, mean 34.40.
- |pHome−pAway|: min 0.01, P10 4.48, P25 12.59, median 25.49, P75 42.41, P90 56.40, max 76.72, mean 28.58.
- 전체 margin: min 7.31, P10 15.85, P25 19.72, median 28.37, P75 40.53, P90 52.50, max 71.10, mean 31.29.
- 실제 DRAW에서 pDraw: min 12.98, P10 18.46, P25 20.76, median 22.78, P75 24.52, P90 26.15, max 29.87, mean 22.48.
- 실제 DRAW에서 margin: min 12.50, P10 16.52, P25 19.21, median 27.25, P75 37.69, P90 48.27, max 67.12, mean 29.94.
- 실제 DRAW의 argmax: HOME 58, DRAW 0, AWAY 27.
- pDraw<1/3: 353/353; pDraw>=1/3이나 DRAW 미선택: 0.
- 평균 pDraw 22.00% vs 실제 DRAW 빈도 24.08%; 실제−예측 2.08%p. 원래 0.1 calibration bin 기반 ECE 2.08%p.
- Training 표본 min/median/max 362/371/391; home venue 5/18/21; away venue 5/18/20.

기존 DRAW calibration bins (빈 bin도 JSON에 보존):

- [10.00, 20.00)%: n=83, mean 17.14%, actual 19.28%, lowSample=false.
- [20.00, 30.00)%: n=270, mean 23.50%, actual 25.56%, lowSample=false.

실제 DRAW 중 DRAW를 선택하지 않은 가장 가까운 3개:

- fixture 1208122, 2024-11-02, Wolves–Crystal Palace: H/D/A 38.54/26.05/35.41%; margin 12.50%p; argmax HOME; actual 2–2 (DRAW); training 370, venue 18/18
- fixture 1208326, 2025-04-05, Everton–Arsenal: H/D/A 26.85/29.87/43.28%; margin 13.42%p; argmax AWAY; actual 1–1 (DRAW); training 375, venue 20/19
- fixture 1208302, 2025-03-08, Wolves–Everton: H/D/A 41.20/27.59/31.22%; margin 13.61%p; argmax HOME; actual 1–1 (DRAW); training 383, venue 19/19

### La Liga

- Targets 380; PREDICTED 352; PASS 28 (PASS actual DRAW 7). DRAW predicted 1; actual 90; correct 0.
- 전체 pDraw: min 9.33, P10 17.92, P25 21.87, median 25.39, P75 28.87, P90 31.56, max 37.53, mean 25.07.
- 전체 pHome: min 5.29, P10 22.85, P25 32.43, median 42.61, P75 54.81, P90 69.48, max 84.66, mean 44.12.
- 전체 pAway: min 5.32, P10 12.30, P25 20.28, median 29.37, P75 38.83, P90 50.60, max 84.43, mean 30.81.
- |pHome−pAway|: min 0.06, P10 2.98, P25 10.70, median 21.58, P75 40.67, P90 57.65, max 79.15, mean 26.87.
- 전체 margin: min -1.81, P10 7.49, P25 12.45, median 21.41, P75 36.70, P90 52.34, max 75.32, mean 25.83.
- 실제 DRAW에서 pDraw: min 15.70, P10 20.04, P25 23.28, median 26.68, P75 28.47, P90 31.07, max 34.61, mean 25.88.
- 실제 DRAW에서 margin: min 1.89, P10 8.37, P25 11.88, median 17.80, P75 29.66, P90 44.35, max 56.02, mean 22.35.
- 실제 DRAW의 argmax: HOME 60, DRAW 0, AWAY 30.
- pDraw<1/3: 342/352; pDraw>=1/3이나 DRAW 미선택: 9.
- 평균 pDraw 25.07% vs 실제 DRAW 빈도 25.57%; 실제−예측 0.50%p. 원래 0.1 calibration bin 기반 ECE 3.80%p.
- Training 표본 min/median/max 365/376/387; home venue 5/18/20; away venue 5/18/22.

기존 DRAW calibration bins (빈 bin도 JSON에 보존):

- [0.00, 10.00)%: n=1, mean 9.33%, actual 0.00%, lowSample=true.
- [10.00, 20.00)%: n=58, mean 16.41%, actual 15.52%, lowSample=false.
- [20.00, 30.00)%: n=230, mean 25.40%, actual 28.70%, lowSample=false.
- [30.00, 40.00)%: n=63, mean 32.07%, actual 23.81%, lowSample=false.

실제 DRAW 중 DRAW를 선택하지 않은 가장 가까운 3개:

- fixture 1208585, 2024-10-28, Mallorca–Athletic Club: H/D/A 32.64/32.74/34.62%; margin 1.89%p; argmax AWAY; actual 0–0 (DRAW); training 378, venue 19/18
- fixture 1208641, 2024-12-15, Alaves–Athletic Club: H/D/A 33.97/31.61/34.42%; margin 2.81%p; argmax AWAY; actual 1–1 (DRAW); training 378, venue 18/18
- fixture 1208515, 2024-08-27, Mallorca–Sevilla: H/D/A 36.61/32.72/30.67%; margin 3.89%p; argmax HOME; actual 0–0 (DRAW); training 369, venue 19/19

### Serie A

- Targets 380; PREDICTED 351; PASS 29 (PASS actual DRAW 9). DRAW predicted 3; actual 99; correct 2.
- 전체 pDraw: min 11.76, P10 19.80, P25 22.28, median 24.86, P75 27.24, P90 30.00, max 37.60, mean 24.87.
- 전체 pHome: min 4.97, P10 21.36, P25 28.12, median 41.46, P75 54.64, P90 64.29, max 79.68, mean 41.58.
- 전체 pAway: min 7.22, P10 14.69, P25 20.53, median 30.91, P75 44.76, P90 55.74, max 83.26, mean 33.55.
- |pHome−pAway|: min 0.11, P10 4.37, P25 13.30, median 26.06, P75 40.42, P90 52.43, max 78.29, mean 27.57.
- 전체 margin: min -5.29, P10 10.61, P25 15.79, median 24.23, P75 35.70, P90 45.96, max 71.50, mean 26.48.
- 실제 DRAW에서 pDraw: min 14.45, P10 20.81, P25 22.62, median 25.36, P75 27.84, P90 30.84, max 35.57, mean 25.37.
- 실제 DRAW에서 margin: min -1.18, P10 9.15, P25 14.79, median 22.37, P75 34.73, P90 44.65, max 61.73, mean 25.09.
- 실제 DRAW의 argmax: HOME 60, DRAW 2, AWAY 37.
- pDraw<1/3: 340/351; pDraw>=1/3이나 DRAW 미선택: 8.
- 평균 pDraw 24.87% vs 실제 DRAW 빈도 28.21%; 실제−예측 3.33%p. 원래 0.1 calibration bin 기반 ECE 3.33%p.
- Training 표본 min/median/max 366/378/382; home venue 5/19/20; away venue 5/18/21.

기존 DRAW calibration bins (빈 bin도 JSON에 보존):

- [10.00, 20.00)%: n=38, mean 17.60%, actual 18.42%, lowSample=false.
- [20.00, 30.00)%: n=277, mean 24.88%, actual 27.80%, lowSample=false.
- [30.00, 40.00)%: n=36, mean 32.45%, actual 41.67%, lowSample=false.

실제 DRAW 중 DRAW를 선택하지 않은 가장 가까운 3개:

- fixture 1223597, 2024-08-17, Empoli–Monza: H/D/A 31.65/32.90/35.44%; margin 2.54%p; argmax AWAY; actual 0–0 (DRAW); training 380, venue 19/19
- fixture 1223833, 2025-02-08, Torino–Genoa: H/D/A 40.01/35.57/24.42%; margin 4.44%p; argmax HOME; actual 1–1 (DRAW); training 382, venue 19/18
- fixture 1223792, 2025-01-11, Torino–Juventus: H/D/A 24.74/34.61/40.65%; margin 6.03%p; argmax AWAY; actual 1–1 (DRAW); training 375, venue 18/17

### Bundesliga

- Targets 306; PREDICTED 286; PASS 20 (PASS actual DRAW 4). DRAW predicted 1; actual 74; correct 0.
- 전체 pDraw: min 6.72, P10 16.30, P25 19.52, median 22.12, P75 24.36, P90 26.85, max 36.59, mean 21.87.
- 전체 pHome: min 9.12, P10 24.83, P25 32.29, median 43.23, P75 57.33, P90 69.36, max 90.25, mean 45.01.
- 전체 pAway: min 3.03, P10 13.02, P25 20.93, median 32.37, P75 43.63, P90 53.29, max 77.47, mean 33.12.
- |pHome−pAway|: min 0.14, P10 5.39, P25 10.96, median 23.20, P75 43.74, P90 59.18, max 87.22, mean 28.09.
- 전체 margin: min -2.62, P10 14.51, P25 19.68, median 27.75, P75 41.51, P90 55.34, max 83.54, mean 31.24.
- 실제 DRAW에서 pDraw: min 11.63, P10 17.39, P25 19.58, median 22.37, P75 24.91, P90 26.91, max 30.29, mean 21.99.
- 실제 DRAW에서 margin: min 10.75, P10 14.03, P25 17.04, median 25.00, P75 42.55, P90 53.49, max 69.37, mean 30.21.
- 실제 DRAW의 argmax: HOME 47, DRAW 0, AWAY 27.
- pDraw<1/3: 285/286; pDraw>=1/3이나 DRAW 미선택: 0.
- 평균 pDraw 21.87% vs 실제 DRAW 빈도 25.87%; 실제−예측 4.00%p. 원래 0.1 calibration bin 기반 ECE 5.03%p.
- Training 표본 min/median/max 289/300/307; home venue 5/16/18; away venue 5/16/18.

기존 DRAW calibration bins (빈 bin도 JSON에 보존):

- [0.00, 10.00)%: n=3, mean 8.32%, actual 0.00%, lowSample=true.
- [10.00, 20.00)%: n=80, mean 17.28%, actual 28.75%, lowSample=false.
- [20.00, 30.00)%: n=196, mean 23.60%, actual 25.51%, lowSample=false.
- [30.00, 40.00)%: n=7, mean 31.71%, actual 14.29%, lowSample=true.

실제 DRAW 중 DRAW를 선택하지 않은 가장 가까운 3개:

- fixture 1224242, 2025-04-19, FSV Mainz 05–VfL Wolfsburg: H/D/A 38.31/27.56/34.12%; margin 10.75%p; argmax HOME; actual 2–2 (DRAW); training 306, venue 16/16
- fixture 1224187, 2025-03-02, FC Augsburg–SC Freiburg: H/D/A 41.73/30.29/27.98%; margin 11.44%p; argmax HOME; actual 0–0 (DRAW); training 300, venue 16/17
- fixture 1224154, 2025-02-01, FC St. Pauli–FC Augsburg: H/D/A 39.12/27.37/33.51%; margin 11.74%p; argmax HOME; actual 1–1 (DRAW); training 307, venue 9/17

## DRAW 예측 5개 전체

- La Liga: fixture 1208606, 2024-11-10, Mallorca–Atletico Madrid: H/D/A 32.36/34.72/32.92%; margin -1.81%p; argmax DRAW; actual 0–1 (AWAY); training 377, venue 20/19
- Serie A: fixture 1223716, 2024-11-25, Empoli–Udinese: H/D/A 33.84/34.24/31.91%; margin -0.40%p; argmax DRAW; actual 1–1 (DRAW); training 374, venue 18/18
- Serie A: fixture 1223768, 2024-12-28, Empoli–Genoa: H/D/A 31.61/36.90/31.49%; margin -5.29%p; argmax DRAW; actual 1–2 (AWAY); training 378, venue 18/17
- Serie A: fixture 1223917, 2025-04-20, Empoli–Venezia: H/D/A 30.95/35.11/33.93%; margin -1.18%p; argmax DRAW; actual 2–2 (DRAW); training 380, venue 18/16
- Bundesliga: fixture 1224145, 2025-01-26, FC St. Pauli–Union Berlin: H/D/A 33.96/36.59/29.45%; margin -2.62%p; argmax DRAW; actual 3–0 (HOME); training 301, venue 8/17

맞힌 두 경기는 모두 Empoli 홈 경기다. Udinese전은 DRAW의 선두 margin이 0.40%p, Venezia전은 1.18%p에 불과하며 venue sample은 각각 18/18, 18/16이다. 실제 결과는 1–1과 2–2라서 “둘 다 0–0/1–1 특수성으로 설명된다”고 할 수 없다. 같은 Empoli의 Genoa전은 더 높은 pDraw 36.90%와 5.29%p 선두에도 1–2였다. 2건은 독립적인 일반화 증거가 아니며 Empoli 전용 규칙을 만들 근거도 아니다.

## Calibration과 선택 실패의 구분

EPL의 평균 22.00% 대 실제 24.08%, La Liga 25.07% 대 25.57%는 빈도 수준에서 상대적으로 가깝지만, calibration 검증 통과를 뜻하지 않는다. La Liga 30–40% bin은 예측 32.07% 대 실제 23.81%로 과대추정하고, 20–30% bin은 25.40% 대 28.70%로 과소추정해 평균에서 상쇄된다. Serie A의 전체 과소추정은 3.33%p, Bundesliga는 4.00%p이며 Bundesliga 10–20% bin 잔차도 크다. 작은 bin은 특히 불안정하다. ECE는 기존 고정 bin의 기술적 집계일 뿐이고 독립성/유효 표본수/시간 의존성을 반영한 유의성 검정은 수행하지 않았다.

실제 DRAW 경기만 조건부로 뽑아 pDraw 평균을 100%와 비교하는 것은 calibration 평가가 아니다. Calibration은 같은 예측 확률을 받은 전체 경기에서 실제 빈도를 본다. 완벽히 calibrated된 25% DRAW 확률도 다른 class가 항상 더 크면 DRAW argmax가 0일 수 있다. 반대로 DRAW 선택률을 올리는 것만으로 calibration이나 전체 예측 품질이 개선됐다고 할 수 없다. EPL/Bundesliga 실제 DRAW에서 가장 가까운 실패조차 12.50/10.75%p 차이가 있어 단순 동점 근처 사례만의 문제도 아니다.

## Root cause 후보 A–H

- **A. Independent Poisson scoring: PARTIALLY_SUPPORTED** — Source multiplies marginal goal PMFs, with no joint dependence parameter. Sealed probabilities rarely put DRAW first. Attribution versus alternative dependence models is not tested.
- **B. Home/away expected-goal formula: PARTIALLY_SUPPORTED** — Source uses products of shrunk venue attack/defence rates divided by league rates. Probability imbalance is observed; per-fixture expectedGoals are not sealed, so rate bias and causal responsibility are not established.
- **C. Prior shrinkage: NOT_TESTED** — Fixed priorMatches=5 exists, but no unshrunk rates or ablation are available in the sealed outputs. Direction and magnitude of its effect on DRAW are unidentified.
- **D. League-level goal-rate structure: NOT_TESTED** — League home/away rate anchors exist in source. Different league pDraw distributions do not identify league-rate bias; neither rate reconstruction nor counterfactual was run.
- **E. Argmax competition: SUPPORTED** — 1320/1342 predictions have pDraw<1/3; 17 further predictions above that level lose to HOME/AWAY. All saved classes match frozen argmax. This is class-competition behavior, not a tie-break or implementation defect.
- **F. Calibration failure: PARTIALLY_SUPPORTED** — Descriptive draw underestimation and bin errors exist, but no independent calibration validation or uncertainty-aware causal attribution. Near-zero class counts do not prove probability miscalibration.
- **G. Missing draw/low-score dependency: PARTIALLY_SUPPORTED** — No draw-specific dependence term in source. Whether residual dependence actually explains errors cannot be tested from sealed 1X2 probabilities alone; score-cell predictive masses are missing.
- **H. Structure rather than insufficient data: PARTIALLY_SUPPORTED** — All PREDICTED rows passed fixed sample gates; minimum competition histories 362/365/366/289, typical venue samples 16–19. This excludes universal sample-gate failure, not finite-sample uncertainty, selection bias or missing information.

근거 수준별 TOP3: (1) E — argmax 경쟁: 입증됨. (2) A/G — 독립 점수분포와 DRAW/저득점 의존성 항 부재: 구조 존재는 확인, 실패 원인으로는 부분 지지. (3) F — calibration 잔차: 관측되지만 인과 기여도는 미확정. 서로 독립적인 원인 기여율이나 최적 수정 우선순위로 읽으면 안 된다.

모델 코드는 venue 득점/실점 평균을 priorMatches=5의 리그 home/away 평균으로 수축한 뒤 공격×상대수비/리그 평균으로 expected goal을 만든다. 독립 PMF의 대각합에서 P(DRAW)=exp(−λH−λA) × Σ[k>=0] (λHλA)^k/(k!)²가 된다. 따라서 DRAW는 별도로 적합된 class 확률이 아니라 두 goal rate가 정한 대각 질량이다. 이 식은 소스의 곱셈/대각합으로부터의 대수적 설명이며 새 확률 계산이나 실험이 아니다. 하지만 sealed record에는 expectedGoals, 수축 전후 구성값, 리그 goal-rate 수치, 전체 score-grid 확률이 저장되어 있지 않다. 이번에는 이를 재구성하지 않았다. 따라서 lambda 과대추정, prior가 DRAW를 얼마나 억제했는지, 리그 평균이 높은 것이 원인인지, 저득점 상관 잔차가 존재하는지는 확정할 수 없다. 표본 gate 통과도 충분한 추정 정확성을 보장하지 않는다.

## V2 연구 가설 — 최대 3개, 선택 없음

아래는 다음 연구의 반증 가능한 후보이며 구현·적합·비교 실험을 하지 않았다. 지금 검토한 2024/25 cohort는 이미 탐색에 사용했으므로 새로운 가설의 최종 미사용 평가셋으로 취급할 수 없다. 승자가 좋아 보이는 가설을 선택하거나 사후 DRAW threshold/offset/multiplier를 추가하지 않는다.

- HYPOTHESIS_ID: DRAW-H1
- MECHANISM: Explicit low-score joint dependence may correct diagonal probability mass beyond independent marginals.
- WHY_SUPPORTED: Independence is confirmed in code; DRAW frequency residuals motivate diagnosis, not proof of this mechanism.
- WHAT_DATA_NEEDED: Chronologically available full-time scores, frozen marginal goal rates and full score-grid predictive masses; independently held-out seasons.
- EXPECTED_EFFECT: Potentially improve joint-score and DRAW probability fit; direction and argmax recall gain not guaranteed.
- FAILURE_RISK: Dependence may be absent or unstable; may damage non-draw probabilities and does not automatically explain 2–2 draws.
- BACKTEST_REQUIREMENT: Preregister parameter estimation using training only, untouched temporal holdout, frozen v1 comparator, full cohort/PASS preservation and joint-score plus multiclass probability evaluation.

- HYPOTHESIS_ID: DRAW-H2
- MECHANISM: A separately specified goal-rate estimation model may better represent low-total, balanced fixtures.
- WHY_SUPPORTED: Venue shrinkage and league-rate products constrain current rates; observed class competition warrants inspecting those constraints. Existing evidence does not establish that rates are too high.
- WHAT_DATA_NEEDED: Training-only venue attack/defence components, rate estimates, uncertainty and sample sizes; sealed future or untouched historical score outcomes.
- EXPECTED_EFFECT: If rates are biased, improved marginal rates may improve DRAW and other classes together; no required direction.
- FAILURE_RISK: Sparse venue estimates, overfitting or erroneous reduction of rates to chase draw recall.
- BACKTEST_REQUIREMENT: Freeze specification and estimation before evaluation; isolate this change from dependence/calibration; same chronological cutoffs and fixed evaluation population; no league weights chosen from these results.

- HYPOTHESIS_ID: DRAW-H3
- MECHANISM: A preregistered multiclass probability calibration study may address systematic probability errors while retaining argmax.
- WHY_SUPPORTED: Observed versus predicted draw frequencies differ, with La Liga bin cancellation and Bundesliga low-bin residuals. This is exploratory evidence only.
- WHAT_DATA_NEEDED: Disjoint temporal calibration and final evaluation sets of probability vectors and outcomes, adequate class/bin counts.
- EXPECTED_EFFECT: Potentially better reliability/log loss; DRAW selection can remain rare even after successful calibration.
- FAILURE_RISK: Leakage, small-bin noise, loss of resolution or apparent gains on the already reviewed season.
- BACKTEST_REQUIREMENT: Fit only within training/calibration time windows, lock transformations before untouched holdout; preserve normalization, compare all classes and keep recall secondary; no arbitrary draw offset/multiplier/threshold.

## Governance / 재현 / Forward 보호

집계 재현: 저장소 root에서 node data/audits/review-football-draw-v1.mjs. 이 스크립트는 sealed 확률/label만 집계하고 모델·runner를 import하지 않는다. Hash 일치, 전체/PASS 수, fixture uniqueness, 확률 normalization, 저장 argmax 일치, margin 항등식, 기존 bin 빈도/평균을 assert한다. 기존 성능 지표를 다른 설정으로 재측정하지 않는다.

BACKTEST_RERUN=NO; ENGINE_CHANGED=NO; WEIGHTS_CHANGED=NO; THRESHOLD_CHANGED=NO; ODDS_USED=NO; FORWARD_CHANGED=NO; V2_IMPLEMENTED=NO. 기존 두 result SHA256 불변. 모든 행 보존; 새 데이터/네트워크/모델 호출 0. 수정 파일은 review script, machine-readable audit, 이 문서뿐이다. main merge 금지.

Forward v1은 현재 frozen 버전 그대로 유지한다. API 접근이 확보되면 기존 v1 경로로 시작하며 이번 가설·calibration 해석이 입력이나 결정에 들어가지 않는다. Historical v2는 별도 사전 등록 연구로만 진행한다. 오늘 추가 개발은 수행하지 않는다.

FOOTBALL_DRAW_STRUCTURAL_FAILURE_REVIEW_V1_READY_FOR_CTO_REVIEW
