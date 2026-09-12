# FOOTBALL_POISSON_V2_ALGORITHM_DESIGN_FREEZE_V1

BASE_SHA = 2be2d12b75cff34560bbe3f8608db2d82c613698

**DESIGN ONLY. 각 가설에 정확히 한 specification을 선택했다. 구현·fitting·development 결과 열람·evaluation·Backtest는 수행하지 않았다.** 숫자는 이번에 사전 고정한 설계 상수이며 성능을 보고 고른 값이 아니다. 이후 실패해도 대체 optimizer, grid, threshold나 다른 알고리즘으로 바꾸지 않는다.

## 상위 계약과 공통 규칙

[상위 protocol](FOOTBALL_POISSON_V2_DRAW_RESEARCH_PROTOCOL_V1.json)의 canonical SHA256은 `0299f98fd28d1c3f4dc1c5153c5ddb6d614da6f0fbff09be295d68de51cfc69f`다. Development 2023/24, evaluation 2024/25, primary paired 1,342개 ID, 기존 PASS, metrics/promotion, 리그 격리, 48h research lag, 365d lookback, Baseline→H1→H2→H3 순서와 모든 firewall은 변경하지 않는다. 충돌은 실행 중단 사유이며 이 문서로 상위 계약을 덮어쓰지 않는다.

모든 산술은 binary64, randomness=NONE, seed=null이다. 확률은 finite, [0,1], 합 허용오차 1e−10을 유지한다. 최종 확률의 ordinary argmax, 정확한 동점 HOME→DRAW→AWAY 순서다. Evaluator에서 확률을 임의 보정하지 않는다. Cohort/reduction 순서는 kickoffUtc→numeric fixtureId, team 순서는 numeric provider ID다. v1 adapter는 기존 모듈 내부의 matchId 정렬도 그대로 보존한다.

H1/H2의 score grid는 각 Poisson marginal에서 P(0)=exp(−rate), P(k)=P(k−1)×rate/k를 사용한다. 적어도 0,1을 포함하고 marginal tail≤1e−12까지 확장한다(최대 k=199). Joint를 x→y 오름차순으로 합산하여 Z를 구하고 |1−Z|≤3e−12, Z>0, finite를 확인한 뒤 한 번만 정규화한다. Cap까지 tail 조건을 못 맞추면 INVALID다. 이는 candidate의 수치 계약이며 기존 v1 파일을 수정하지 않는다.

Target rate는 0<λH,λA≤10이다. 양수 finite지만 10을 넘으면 PASS_GOAL_RATE_OUT_OF_RANGE, nonpositive/nonfinite 최종 rate는 FAIL_NUMERICAL이다. Rate를 잘라서 살리지 않는다. 기존 eligible history 30경기, home-team home 5경기, away-team away 5경기 및 양수 home/away league goal mean gate를 유지한다.

## H1 — Fixed-v1-marginal Dixon–Coles four-cell MLE

**ALGORITHM_NAME = FIXED_V1_MARGINAL_DIXON_COLES_FOUR_CELL_MLE**

λ, μ는 read-only v1 `predictFootball(input).expectedGoals.home/away` 그대로다. v1 PASS는 PASS다. Joint는 다음 한 가지다.

\[
q(x,y)=\operatorname{Pois}(x;\lambda)\operatorname{Pois}(y;\mu)\tau(x,y),\qquad
\tau(x,y)=\begin{cases}
1-\lambda\mu\rho &(x,y)=(0,0)\\
1+\lambda\rho &(x,y)=(0,1)\\
1+\mu\rho &(x,y)=(1,0)\\
1-\rho &(x,y)=(1,1)\\
1 &\text{otherwise}.
\end{cases}
\]

이 네 셀 보정 형태만 [Dixon–Coles 원 논문](https://doi.org/10.1111/1467-9876.00065)에서 채택한다. 논문의 시장 입력, 성능 결과, time decay나 fitting specification을 이 연구로 가져오지 않는다. 네 셀의 additive 변화는 −A,+A,+A,−A이고 A=exp(−λ−μ)λμρ다. 합과 각 행/열의 변화가 0이므로 무한 support에서 전체 mass와 Poisson marginals를 보존한다. DRAW class 자체에 가산·배수를 적용하는 방식이 아니다.

**PARAMETERS / CONSTRAINTS.** 리그마다 fitted rho 하나. δ=1e−8, 고정 domain은 `L=−(1−δ)/10`, `U=(1−δ)/100`이다. v1의 λ,μ≤10 전체에서 네 τ≥δ를 보장하도록 좁게 고정한 구간이다. Negative rho는 두 저득점 무승부 셀로 mass를 옮기고 positive rho는 반대로 옮긴다. Evaluation rate를 보고 domain을 바꾸지 않는다. Boundary optimum은 유효하되 반드시 표시한다.

**FIT_OBJECTIVE.** 허용된 development v1 PREDICTED 예제 전체에서 `J(rho)=mean[−log(tau(observed score))]`를 최소화한다. Full joint score NLL과 rho에 무관한 상수만 다르다. 예제≥30 및 관측 score가 {00,01,10,11}인 예제≥10을 요구한다. 각 셀 최소 수나 1X2 class minimum은 추가하지 않고 실제 수를 보고한다. Time weighting, ridge, oversampling은 없다.

**OPTIMIZER / INITIALIZATION.** Bounded derivative bisection 하나만 사용한다. `c_i`는 00:−λμ, 01:λ, 10:μ, 11:−1, 나머지:0이다. `g(rho)=−mean[c_i/(1+c_i*rho)]`, curvature는 `mean[c_i²/(1+c_i*rho)²]≥0`이다. Bounds의 finite derivative를 먼저 확인하여 g(L)≥0이면 L, 아니고 g(U)≤0이면 U다. 내부 optimum이면 rho=0에서 시작하고 gradient 부호로 bracket을 줄인 뒤 midpoint만 사용한다. g>0이면 upper, g<0이면 lower를 바꾼다.

**CONVERGENCE / FAILURE.** Boundary KKT sign, |g|≤1e−10 또는 bracket 폭≤1e−10이면 종료한다. 폭 종료 시 midpoint를 택하고 최대 midpoint iteration은 80이다. 정확한 flat objective는 rho=0을 택하지만 informative gate를 통과하면 예상하지 않는 경우다. 표본 부족은 PASS_INSUFFICIENT_FIT, nonfinite/수렴 실패는 FAIL, identity/hash/최종 probability mass 오류는 INVALID다. 실패 시 rho=0으로 대체하거나 target마다 rho를 clip/refit하지 않는다. Grid에는 네 셀 모두 τ를 적용한 뒤 공통 정규화를 수행한다.

**DIAGNOSTICS.** 리그·phase별 rho/boundary/iteration/fit 수와 네 관측 셀 수를 기록한다. Target별 raw/corrected 네 셀 확률, 네 셀 합, 00+11 합, 세 class delta를 남긴다. **네 셀 총합은 증가하는 것이 아니라 보존되며 내부에서 재배분된다.** Check/evaluation에서 full joint score NLL delta와 네 셀 `sum(abs(mean probability−observed frequency))` delta를 계산한다. 둘 다 <−1e−12일 때만 mechanismSupported이며, 누락된 paired row가 있으면 INSUFFICIENT다. 관측 score log likelihood의 log factorial은 1..score의 log 합(0!=1)으로 계산하고 관측 score를 grid 밖이라고 제거하지 않는다. 이 진단은 primary 실패를 뒤집지 못한다.

## H2 — Ridge log-linear attack/defence independent Poisson

**ALGORITHM_NAME = RIDGE_LOG_LINEAR_ATTACK_DEFENCE_INDEPENDENT_POISSON**

\[
\lambda_H=\exp(b+h+a_H-d_A),\qquad
\lambda_A=\exp(b+a_A-d_H).
\]

League log baseline b, home log advantage h, team attack a, team defensive strength d를 포함한다. d가 커지면 상대 득점률이 낮아진다. Independent Poisson을 유지하며 H1/H3는 사용하지 않는다. Training pool의 K개 exact team ID만 사용한다. 계수 저장 수 2+2K, `sum(a)=sum(d)=0` 제약 이후 자유도 2K다. 미래 roster나 이름 유사도로 team universe를 늘리지 않는다.

**FIT_OBJECTIVE / SHRINKAGE.** N개 eligible training match에 대해 ηHi=b+h+a_hi−d_ai, ηAi=b+a_ai−d_hi이고 다음을 최소화한다.

\[
J=\frac1{2N}\sum_i\{e^{\eta_{Hi}}-x_i\eta_{Hi}+e^{\eta_{Ai}}-y_i\eta_{Ai}\}
+\frac{0.01}{2}\left(b^2+h^2+\sum_t(a_t^2+d_t^2)\right).
\]

Log factorial은 fitting에 무관한 상수라 생략한다. κ=0.01은 모든 계수에 동일한 ridge 상수이며 search로 선택하지 않는다. Fixture weighting은 uniform, time decay 없음이다. Sparse training team에 추가 gate 대신 동일한 ridge를 적용한다. Target에는 기존 30/5/5 gate를 적용하며 fitted universe에 없는 team은 PASS_UNSEEN_TEAM이다. 임의 zero-strength fallback을 만들지 않는다.

**WINDOW / CAUSALITY.** 초기 development fit/check와 final development 경계는 아래 공통 phase 계약을 따른다. Evaluation은 매 cutoff마다 parent의 same-league 365d/48h eligible pool로 같은 estimator를 fresh fit한다. Hyperparameter나 알고리즘은 고정이고 이전 evaluation 성능으로 변경하지 않는다. Training likelihood 안의 rate>10은 금지하지 않지만, 출력 target의 rate≤10 gate는 그대로 유지한다. Accepted coefficient/rate는 finite이고 rate>0이어야 한다.

**OPTIMIZER.** Projected gradient descent + 고정 Armijo backtracking 하나다. eHi=exp(ηHi)−xi, eAi=exp(ηAi)−yi일 때 b gradient는 sum(eH+eA)/(2N)+κb, h는 sum(eH)/(2N)+κh다. Team attack은 해당 team의 scoring residual 합/(2N)+κa, defence는 해당 team이 상대할 때의 scoring residual 음의 합/(2N)+κd다. Exact index 식은 JSON에 고정했다. Attack/defence gradient에서 각각 block mean을 빼 gP를 얻고 direction=−gP로 한다.

**INITIALIZATION / STEP.** 매 fit은 b=log(total goals/(2N)), h=a=d=0에서 새로 시작한다. Home 또는 away goal sum이 0이면 기존 ZERO_COMPETITION_GOAL_RATE PASS다. 매 iteration α=1을 시작으로 2^(−j), j=0..59만 순서대로 시도한다. Trial team blocks를 다시 center하고 `J(trial)≤J(current)−1e−4×α×dot(gP,gP)`를 만족하는 첫 finite positive-rate trial을 수락한다. Overflow/underflow trial은 reject 후 halve하며 clipping하지 않는다. 60개 모두 실패하면 FAIL_LINE_SEARCH다. Warm start·다른 optimizer·다른 상수 restart는 없다.

**CONVERGENCE / FAILURE.** 초기점과 매 accepted update에서 maxAbs(gP)≤1e−7 및 두 zero-sum residual≤1e−10이면 종료한다. Max accepted updates=10,000. Objective 변화가 작다는 것만으로 수렴으로 처리하지 않는다. Nonconvergence/accepted nonfinite parameter·gradient는 FAIL, integrity/최종 mass 오류는 INVALID, 부족 표본·unseen team·양수 finite target rate>10은 PASS다. 해당 fixture와 실패 이유를 유지하고 v1으로 대체하지 않는다.

**DIAGNOSTICS.** N,K, team hash, 계수, objective, projected-gradient norm, iteration/backtracking 수와 zero-sum residual을 남긴다. Held-out home/away 각각 Poisson deviance `mean[2×(g×log(g/λ)−(g−λ))]`를 사용하며 g=0의 g×log 항은 0이다. Mean(λ−g), mean|λ−g|, v1 대비 delta와 target λH+λA min/median/max를 보고한다. Home/away deviance delta 모두 <−1e−12일 때만 mechanismSupported다. Training deviance를 held-out 성능으로 부르거나 DRAW를 위해 rate가 낮아진 것을 성공으로 삼지 않는다.

## H3 — Single-temperature multiclass scaling

**ALGORITHM_NAME = SINGLE_TEMPERATURE_MULTICLASS_SCALING**

\[
\beta=1/T,\quad z_k=\log p_k,\quad
q_k=\frac{\exp(\beta z_k-m)}{\sum_j\exp(\beta z_j-m)},\quad m=\max_j\beta z_j.
\]

모든 class에 하나의 양수 T를 적용하는 [temperature scaling](https://proceedings.mlr.press/v70/guo17a.html)이다. 여기서는 convex derivative bisection을 위해 inverse temperature β를 적합한다. β∈[0.05,20], T∈[0.05,20], 초기 β=T=1이다. Class별 bias, manual weight, DRAW parameter는 없다. 리그마다 같은 specification의 scalar 하나를 적합한다.

**ZERO / NORMALIZATION.** Raw p를 먼저 검증한다. p_k=0인 class는 support에서 제외하고 q_k=0을 유지하며 floor logit으로 바꾸지 않는다. 나머지만 stable log-sum-exp한다. Fit 예제 중 pActual=0이 하나라도 있으면 전체 fit을 FAIL_ZERO_SUPPORT로 기록하며 삭제하지 않는다. Non-actual zero는 허용한다. Evaluation score의 1e−15 floor는 parent의 scoring-only 규칙대로이며 변환 입력을 고치지 않는다.

**FIT / OPTIMIZER.** 허용된 out-of-time development vector≥30, actual HOME/DRAW/AWAY 각각≥5를 요구한다. `J(beta)=mean[logsumexp(beta×log p)−beta×log pActual]`를 최소화하며 weighting/regularization은 없다. `g=mean[sum(q×log p)−log pActual]`, curvature=`mean Var_q(log p)≥0`이다. 모든 vector가 positive support에서 정확히 uniform이고 actual이 support 안에 있으면 flat objective로 β=1을 택한다. 그 외에는 H1과 같은 bounded derivative bisection을 사용한다: bounds KKT check → β=1 → 부호 bracket → midpoint. |g|≤1e−10 또는 폭≤1e−10, 최대 80회; boundary optimum은 기록한다. 실패 시 identity calibration으로 대체하지 않는다.

**CLASS BEHAVIOR / DIAGNOSTICS.** β>0이므로 class ranking과 정확한 ties는 수학적으로 유지된다. H3로 DRAW argmax 수를 늘릴 수 없으며 이는 calibration과 classification을 분리하는 설계다. 최종 ordinary argmax가 v1과 다르면 numerical INVALID로 처리하고 class를 수동 override하지 않는다. β/T, boundary/flat flag, fit class 수, objective, iterations, zero-support 수를 기록한다. Held-out에서 parent의 10-bin class reliability/ECE, mean probability−frequency, NLL/Brier delta, argmax-change count(0이어야 함)를 보고한다. 모든 class ECE delta≤1e−12, 하나 이상 <−1e−12, NLL delta<−1e−12일 때만 mechanismSupported다. Primary gate는 별도로 그대로 적용한다.

## Development fit/check의 정확한 적용

Boundary는 parent의 **2024-01-01T00:00:00.000Z**다. H1/H3의 fit vector/rate는 각 development target 원래 cutoff에서 v1으로 생성·봉인하고 나서 label을 join한다. Initial coefficient fit에는 target kickoff+48h<boundary인 fit-part 예제만 사용한다. 예측 불가한 v1 PASS는 지우거나 합성하지 않는다.

H2 initial coefficient vector는 boundary 시점에 available인 season-2023 FT pool([boundary−365d,boundary))에 한 번 적합한다. Parent의 `developmentCheck` 제약에 따라 **H1/H3 scalar와 H2 initial coefficient vector는 check 기간 내 고정**한다. H1/H3의 v1 raw rate/probability와 모든 candidate의 target sample gate는 각 target cutoff의 causal history를 사용한다. H2에 check label로 coefficient update를 하지 않는다. 이 phase 동작과 evaluation에서 허용된 H2 causal refit을 혼동하지 않는다.

Check 결과는 sanity/falsification 용도다. 통계적으로 좋지 않다는 이유로 알고리즘·상수·optimizer를 바꾸지 않는다. Integrity/numerical failure는 해당 실험을 중단한다. 초기 fit 표본 부족도 그대로 기록하고 check label을 보고 minimum을 낮추거나 유리한 final fit으로 건너뛰지 않는다.

최종 development 경계 E는 각 리그 첫 evaluation kickoff−1ms다. H1/H3는 E 전에 available인 모든 유효 season-2023 out-of-time 예제로 동일 방법을 적합하고 scalar/hash를 봉인한다. H2는 E의 eligible season-2023 history로 final-development state를 봉인한 뒤, evaluation 각 cutoff에서 같은 estimator/상수/initialization으로 refit할 수 있다. 이전 eligible 2024 결과는 H2의 causal state 또는 H1/H3의 v1 history에만 들어가며 H1/H3 scalar, H2 hyperparameter 선택에 들어가지 않는다. Full-season hindsight predictor vector로 calibration을 학습하지 않는다.

## Failure, 구현 계획, 검증 범위

Precedence는 INVALID integrity → FAIL optimizer/numerical → PASS insufficient/range → PREDICTED다. 모든 target identity/status/reason을 남긴다. Shared fit이 없으면 종속 target마다 unavailable 기록을 남기고 해당 phase를 차단한다. Fixed primary 1,342개 중 하나라도 candidate 확률이 없으면 parent의 paired screen을 통과할 수 없다. Survivor subset으로 primary 지표를 다시 만들지 않는다.

미래 구현 경로는 `scripts/football-poisson-v2-draw-research/` 아래 contracts/numerics/read-only-v1-adapter와 H1/H2/H3 세 파일, 별도 development/evaluation runner, synthetic contract tests다. 정확한 예정 파일명·artifact 필드는 JSON에 있다. **이번에는 source 파일을 만들지 않는다.** H1/H2/H3는 서로 import하지 않는다. Read-only v1 모델 모듈 외에 어떤 Forward module/runner/owner/market 코드도 import하지 않는다.

출력은 parent의 `data/cache/research/football/poisson-v2-draw-research/protocol-v1/<hypothesis>/<league>/<run>/`에서 append-only로 분리한다. Archive/v1 result는 READ ONLY다. Protocol/design/source/input/cohort/parameter hash와 fit phase/boundary를 기록한다. 실제 Forward에 자동 반영하지 않는다. 2024/25의 exposed retrospective 지위와 실제 PROMOTE=NO도 그대로다.

후속 구현 미션은 rho=0·질량/주변분포 보존, H1 global domain, H2 analytic gradient/zero-sum, H3 class symmetry/순위/zero support, optimizer boundary/failure, 누수·hash·PASS 보존 등을 synthetic 자료로 검증해야 한다. 이번에는 그 테스트나 optimizer도 실행하지 않았다. 수행한 검증은 문서 JSON 구조, 상위 canonical hash, 필수 명세 항목 및 Git 변경 범위 확인뿐이다. 개발·평가 결과 파일을 열지 않았으며 공식 provider 요청도 0이다. 문헌 조회는 알고리즘 정의 확인에만 사용했다.

MD와 동명 JSON을 함께 봉인하며 충돌 시 구현을 중단한다. 기존 untracked access-gate 문서는 보존한다. 다음 단계는 별도 CTO 검토 후 승인된 구현 미션이며, 현재 커밋은 fitting/evaluation 실행 권한을 부여하지 않는다.

DESIGN_SHA256 = `03ad74710019082428fce6dbd2dd234aa4f0d21c009e715ae27ecb027b490945`

대상은 동명 JSON 전체를 object key 재귀 정렬, array 순서 보존, 공백/newline 없이 canonical UTF8 JSON으로 직렬화한 값이다. JSON 필수 명세 항목과 parent hash 검증은 통과했다. 알고리즘의 수치 검증이나 성능 검증을 통과했다는 의미는 아니다.

MODEL_CHANGED=NO; ENGINE_CHANGED=NO; FORWARD_V1_CHANGED=NO; V2_IMPLEMENTED=NO; DEVELOPMENT_EXECUTED=NO; EVALUATION_EXECUTED=NO; BACKTEST_EXECUTED=NO.

H1_SPEC_FROZEN=YES; H2_SPEC_FROZEN=YES; H3_SPEC_FROZEN=YES; RANDOMNESS=NONE.

FOOTBALL_POISSON_V2_ALGORITHM_DESIGN_FREEZE_V1_READY_FOR_CTO_REVIEW

STOP.
