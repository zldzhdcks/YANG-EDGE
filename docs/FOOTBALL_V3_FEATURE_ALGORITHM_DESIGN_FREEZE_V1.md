# FOOTBALL V3 FEATURE ALGORITHM DESIGN FREEZE V1

**DESIGN ONLY.** F1/F2/F3의 단일 specification을 첫 V3 결과 전에 봉인한다. 구현·fitting·backtest·API 조회·2025/26 metric 열람은 수행하지 않았다. 다음 설계 상수는 성능 실험으로 선택한 값이 아니다. 실행에는 별도 미션이 필요하다.

BASE_SHA = 6690d4c9f05a9e659bc25d531f08e5da214c9566

BRANCH = agent/astra/football-historical-source-gate-v1

Design canonical-payload SHA256 = `04803e9b26acfd43de263c9b52c575ed2231d91984f82877da5e63b0cde6207a`

[JSON design](FOOTBALL_V3_FEATURE_ALGORITHM_DESIGN_FREEZE_V1.json)에 각 candidate의 필수 설계 항목과 공통 수치 규약을 포함한다. Hash는 payload를 재귀적 key 정렬, 배열 순서 유지, compact UTF-8 JSON으로 직렬화한 SHA256이며 envelope sha256은 제외한다.

## Binding parent와 선행 결정

[부모 protocol](FOOTBALL_V3_FEATURE_RESEARCH_PROTOCOL_V1.json)의 canonical SHA256은 `0b30bc4d41684f2797d0a8e0a2a53694ecc6d5dc8f151b45213af1f1f9dc1bb8`이다. Feature set, candidate 정의, comparator, 전체 cohort, holdout 역할, market/Forward firewall을 그대로 복사하여 JSON에 보존했다. 부모 파일은 변경하지 않는다.

이번 사용자 미션은 미정이던 48h research assumption, feature-layer-only history exclusion과 numeric promotion screen을 구체화하도록 승인했다. 알고리즘 문서 생성 전에 temporal/promotion 결정을 별도 local prerequisite seal로 기록했고 이를 JSON에도 포함했다. Prerequisite canonical SHA256은 `3865f247cda98eb7816ed5b9f2441c68b64bc3033723ce6d2230f073be4021db`이다. 이 결정은 결과를 보고 만든 변경이 아니다.

공식 comparator/Forward는 `football-poisson-research-v1`이다. Frozen V2 H2는 SCREEN_RESULT=SCREEN_NO, MODEL_PROMOTED=NO인 **연구용 offset**이다. [H2 specification](FOOTBALL_POISSON_V2_ALGORITHM_DESIGN_FREEZE_V1.json)의 estimator·기존 소스·기존 결과를 수정하지 않는다.

## Temporal / history 계약

Target T의 cutoff C(T)=kickoffUtc(T)−1 millisecond이다. Eligible history는 동일 리그의 Regular Season FT 경기 중 아래 조건을 모두 충족한다.

- Fixture ID가 T와 다르고 kickoff(m)≥C(T)−365 days.
- featureResearchAvailableAt(m)=kickoff(m)+48 hours < C(T).
- 허용된 source season만 사용하고 홈·원정 구분 없이 all venues를 포함한다.
- 같은 kickoff group에는 동일한 immutable history를 사용한다. ID 정렬은 출력 순서일 뿐 같은 시각 경기의 결과를 앞당겨 주지 않는다.

**THIS IS NOT ACTUAL PROVIDER PUBLICATION TIME.** 48시간은 사용자가 허용한 v1/v2와 일관된 retrospective research assumption이다. Census는 현재 final/revised data 존재를 확인했을 뿐 게시 지연을 검증하지 않았다. 현재 시즌 누락 2건도 48h 보장의 근거가 아니다. strictReplayEligible=false를 유지하며 모순되는 완료 시각 증거가 있으면 INVALID_TEMPORAL_CONTRACT로 보고한다. 선택적으로 lag를 고쳐 살리지 않는다.

Target own stats와 결과는 pregame state 입력에서 제외한다. 이후 fitting label로 사용하는 target FT goals는 pregame 입력과 분리한다. 향후 Forward에서는 실제 완료 경기 feature를 관측한 providerFetchedAt≤predictionCreatedAt만 허용하며, synthetic 48h 시각을 실제 observedAt으로 사용하지 않는다.

## Field mapping / aggregation / normalization

Feature f의 provider type은 xG=`expected_goals`, Shots=`Total Shots`, SOT=`Shots on Goal`이다. Exact home/away team ID의 block을 사용한다. Home team For=f_home, Against=f_away이고 away team For=f_away, Against=f_home이다. Against를 음수로 바꾸지 않는다.

필요한 feature에 대해 양 팀 모두 유효한 값을 가진 prior match만 M_f(T)에 들어간다. Finite nonnegative number 또는 공백 제거 후 decimal numeric string을 허용하고 Shots/SOT는 정수여야 한다. 0은 존재하는 값이다. Null/absent/block unavailable은 missing이다. 중복 ID/type, 잘못된 수치·음수·nonfinite raw value나 hash mismatch는 INVALID이며 missing으로 숨기지 않는다.

팀 t가 참여한 M_f의 경기 수를 n_tf라 하면:

\[
\mu^{For}_{tf}=\frac{\sum For_{tf}}{n_{tf}},\quad
\mu^{Against}_{tf}=\frac{\sum Against_{tf}}{n_{tf}},\quad
L_f=\frac{\sum_{m\in M_f}(f_{m,home}+f_{m,away})}{2|M_f|}.
\]

각 target team은 **각 required feature별 최소 5경기**가 필요하다. Uniform arithmetic mean, 365일, all venues이며 time weighting·feature mean shrinkage는 없다. League reference도 동일 cutoff와 동일 feature-complete pool에서 계산한다.

\[
z^{For}_{tf}=\ln\mu^{For}_{tf}-\ln L_f,\qquad
z^{Against}_{tf}=\ln\mu^{Against}_{tf}-\ln L_f.
\]

이는 log ratio이며 수치 연산은 명시된 log 차이로 고정한다. Epsilon, clipping, 표준화, 평균 대체는 없다. Min count를 먼저 확인한다. Required mean/reference가 정확히 0이면 PASS_NONPOSITIVE_FEATURE_MEAN, 집계의 nonfinite arithmetic은 FAIL_NUMERICAL이다. Invalid raw input은 그 전에 INVALID로 판정한다.

Completeness mask는 feature별로 독립이다. F1은 xG만, F2는 Shots/SOT만 검사한다. F3는 F1/F2와 동일한 feature별 pool을 재사용하며 세 feature의 joint-complete pool로 바꾸지 않는다. 따라서 F2의 eligibility에 xG 누락 여부가 영향을 줄 수 없다.

## Rate structure와 candidate별 specification

각 target와 각 beta 학습 예제의 H2 offset은 해당 경기 cutoff 이전의 base-result history로 **fresh causal frozen H2 fit**하여 얻는다. Full-season H2 fit에서 target나 이후 결과가 섞인 rate를 가져오는 것은 금지다. H2의 기존 30/5/5 gate, unseen-team 규칙, 365d/48h history, ridge/optimizer, rate cap과 PASS 규칙을 유지한다. Feature 누락 경기의 정상 FT 결과도 이 history에 남긴다.

두 득점 방정식 모두 다음 형태를 사용한다.

\[
\log\lambda^{V3}_s=\log\lambda^{H2}_s+\beta^\top X_s,
\qquad \lambda^{V3}_s=\lambda^{H2}_s\exp(\beta^\top X_s).
\]

실제 수치 계산은 exp(log(lambda_H2)+left-to-right dot(beta,X))이다. 동일 리그/candidate의 하나의 beta vector를 양 side에 공유한다. 추가 intercept, class/side별 수작업 weight, interaction, DRAW coefficient는 없다. Beta fitting이 H2 parameter를 갱신하지 않는다.

**V3-F1 — FROZEN_H2_OFFSET_XG_RIDGE_POISSON_V1**

- Home X=[home xG For signal, away xG Against signal].
- Away X=[away xG For signal, home xG Against signal].
- PARAMETERS: [beta_xG_For, beta_xG_Against], 2개.

**V3-F2 — FROZEN_H2_OFFSET_SHOTS_SOT_RIDGE_POISSON_V1**

- Home X=[home Shots For, away Shots Against, home SOT For, away SOT Against]의 log-relative signals.
- Away X는 home/away를 대칭 교환한다.
- PARAMETERS: [beta_shots_For, beta_shots_Against, beta_sot_For, beta_sot_Against], 4개.
- xG 사용 금지. 결과를 보고 Shots/SOT 중 하나를 제거하지 않는다.

**V3-F3 — FROZEN_H2_OFFSET_XG_SHOTS_SOT_RIDGE_POISSON_V1**

- Home/Away X는 F1 vector 다음 F2 vector를 연결한다.
- PARAMETERS: [beta_xG_For, beta_xG_Against, beta_shots_For, beta_shots_Against, beta_sot_For, beta_sot_Against], 6개.
- F1/F2 fitted beta를 재사용하지 않고 독립적으로 fit한다. INTERACTION=NONE.

세 candidate 모두 동일 aggregation, normalization, temporal, missingness, fitting, failure와 diagnostic 계약을 사용하며 JSON의 candidate별 항목에 이를 명시했다. 모든 specification은 어느 V3 결과보다 먼저 freeze한다.

## Beta fitting — 단일 deterministic specification

리그×candidate별 최소 30개의 유효한 two-equation causal development 예제를 요구한다. 정상적인 frozen PASS 예제는 이유와 전체 fit census를 보존하고 likelihood에 넣지 않는다. FAIL/INVALID 예제는 삭제해서 학습을 계속하지 않고 해당 fit을 실패시킨다.

N은 유효한 fit fixture 수, o_is=log(causal H2 rate), eta_is=o_is+beta·X_is, y_is는 별도로 join한 FT goals이다.

\[
J(\beta)=\frac{1}{2N}\sum_{i,s}\{e^{\eta_{is}}-y_{is}\eta_{is}\}
+\frac{0.01}{2}\sum_j\beta_j^2.
\]

Log factorial은 beta와 무관하므로 생략한다. 모든 beta에 fixed ridge kappa=0.01을 적용한다. 실험으로 선택한 값이 아니며 kappa 비교/grid search는 금지다. 계수는 unconstrained real이며 별도 feature shrinkage는 없다.

\[
g=\frac{1}{2N}\sum_{i,s}X_{is}(\lambda_{is}-y_{is})+0.01\beta,\quad
H=\frac{1}{2N}\sum_{i,s}\lambda_{is}X_{is}X_{is}^{\top}+0.01I.
\]

OPTIMIZER는 **damped Newton + unpivoted Cholesky + Armijo backtracking** 하나다. INITIALIZATION=beta 0, RANDOMNESS=NONE, seed=null이다. Cholesky에서 coefficient index 오름차순으로 lower triangle을 계산하고 forward/back substitution으로 H d=−g를 푼다. Jitter·pivot 대체·다른 solver·warm start·restart는 없다.

초기점과 각 accepted update에서 maxAbs(g)≤1e−7이면 수렴이다. 최대 accepted update=100이다. Objective 변화량만으로 수렴을 인정하지 않는다. 매 step alpha=2^(−j), j=0..59 순서로 시도해 finite positive-rate이고 J(beta+alpha d)≤J(beta)+1e−4 alpha(g·d)인 첫 trial만 수락한다. Overflow/underflow trial은 clipping 없이 reject한다. 60개 모두 실패하면 FAIL_LINE_SEARCH이다.

비양수 Cholesky pivot, nonfinite accepted state 또는 수렴 전 g·d≥0은 FAIL_NUMERICAL이다. 100 update 후 gradient 기준을 못 맞추면 FAIL_NON_CONVERGENCE이다. Fit 표본 30 미만이면 PASS_INSUFFICIENT_FIT와 experiment INSUFFICIENT이다. 실패를 beta=0/H2 fallback으로 바꾸지 않는다. Likelihood 내부 rate에는 10 cap을 걸지 않되 finite positive를 요구한다.

## Missingness / PASS / failure

MISSINGNESS_BEHAVIOR = **HISTORY_WINDOW_EXCLUSION_FEATURE_LAYER_ONLY**.

Fixture 1223728처럼 feature가 없는 prior match는 해당 feature aggregation에서만 제외한다. Base-result history와 전체 target cohort에서는 유지한다. Imputation, zero/league mean substitution, feature-neutral fallback은 없다. 제외 후 required feature의 어느 target team이라도 5경기 미만이면 PASS_INSUFFICIENT_FEATURE_HISTORY이다. 모든 부족 feature/team pair와 제외 ID를 기록한다.

Row 처리 순서는 integrity → frozen H2 status → required feature min counts → positive means → V3 rates → probability mass이다. Independent min-count reason은 canonical 순서로 전부 보존한다. H2가 PASS면 그대로 유지한다. Finite positive V3 output rate가 10을 넘으면 PASS_GOAL_RATE_OUT_OF_RANGE; nonpositive/nonfinite output은 FAIL_NUMERICAL이다.

Experiment precedence는 INVALID → FAIL → INSUFFICIENT → PASS이다. Hash/identity/temporal/forbidden-input/probability integrity 위반은 INVALID, 수치·optimizer·수렴 실패는 FAIL이다. Required initial/final beta fit 부족은 INSUFFICIENT이다. 정상 row PASS 자체를 experiment FAIL로 바꾸지 않지만 primary coverage 부족은 승격을 막는다. Execution PASS는 성능 성공을 뜻하지 않는다.

## Development와 계수 봉인 시점

Boundary는 **2024-01-01T00:00:00.000Z** 하나다.

1. Initial beta fit: season 2023 중 kickoff<boundary이고 kickoff+48h<boundary인 예제만 사용한다. 각 예제의 X/H2 offset은 자기 kickoff 직전의 causal history로 만든다. 48h가 아직 지나지 않은 pre-boundary 예제도 audit에 남기며 check 쪽으로 옮기지 않는다.
2. Internal check: season 2023 중 kickoff≥boundary인 모든 target. Initial beta를 고정하며 check 중 refit하지 않는다.
3. Final development fit: season 2023 전체 결과의 research lag가 지난 뒤, season 2023의 유효한 causal 예제 전체로 beta=0부터 같은 estimator를 한 번 fit한다. Internal check에 따라 specification을 바꾸지 않는다. Final beta/input hashes는 2024 결과 전에 봉인한다.
4. Exposed 2024/25: final-2023 beta를 그대로 쓴다. 2024 label로 beta를 다시 학습하지 않는다. DESCRIPTIVE CHECK ONLY이다.
5. Independent holdout candidate 2025/26: 같은 final-2023 beta/hash를 재사용한다. 2024/2025 beta refit은 금지다. 별도 identity/scope/completeness/exposure/hash 봉인, 독립성 인증과 CTO 승인 뒤에만 1회 evaluation한다.

History source는 development=2023, exposed=2023+2024, 승인된 holdout=2023+2024+2025이다. 모두 strict cutoff/window를 적용한다. 앞서 완료된 2024/2025 경기는 나중 경기의 H2와 feature state에는 들어갈 수 있지만 beta·hyperparameter·selection에는 들어갈 수 없다. Season 2022 warmup을 추가 수집하지 않는다. 이번 미션에서는 2025 데이터를 읽거나 metric/probability를 만들지 않았다.

## Probability와 비교 분모

V3는 independent Poisson이다. Marginal P0=exp(−lambda), Pk=P(k−1)lambda/k로 계산하고 k≥1을 포함하여 tail≤1e−12까지 확장한다. 최대 k=199에서 tail이 충족되지 않으면 INVALID이다. Joint를 home score→away score 오름차순으로 합산하고 Z>0, finite, |1−Z|≤3e−12를 확인한 뒤 한 번만 normalize한다. HOME은 i>j, DRAW는 i=j, AWAY는 i<j이다. 최종 확률은 finite [0,1], sum error≤1e−10이다. Ordinary argmax, exact tie는 HOME→DRAW→AWAY이다. Evaluator 보정, DRAW multiplier, H1/H3 결합은 없다.

각 리그/phase의 N은 모든 frozen target이다. Candidate 실행 전에, outcome/feature를 보지 않고 frozen v1과 H2가 모두 PREDICTED인 ID 집합 U 및 comparator probabilities/hash를 봉인한다. 두 comparator 대비 모두 같은 U를 쓴다. V2 paired IDs를 V3 population으로 가져오지 않는다.

Candidate가 U 전체에 예측하지 못하면 primary LL/Brier/class metrics는 null, INCOMPLETE_PRIMARY_COVERAGE로 남긴다. Target 삭제나 comparator probability 대체는 금지다. 이번 design은 임의 common-subset metric도 만들지 않는다. U 밖의 추가 prediction은 운영 audit로 남기되 primary에 넣지 않는다. 실행 순서는 V1→H2→F1→F2→F3이며 모든 source/specification은 시작 전에 고정한다.

## Metrics와 numeric promotion screen

LL=mean(−ln(max(pActual,1e−15)))이며 floor는 scoring 전용, hit 수를 보고한다. Multiclass Brier=mean(sum_c(p_c−y_c)^2), class 수로 나누지 않는다. Accuracy=correct/|U|, recall=TP/actual, precision=TP/predicted, class share=predicted/|U|이다. Zero denominator는 null이다. One-vs-rest Brier는 각 class의 mean((p_c−y_c)^2)이다.

Per-class ECE는 10개 equal-width bin [0,.1), …, [.9,1]에서 sum(n_bin/|U| × |meanProbability−frequency|)이다. Empty bin은 null mean/frequency로 보존하고 n<20 bin은 low sample 표시한다. 모든 delta는 candidate−comparator이며 binary64 원값을 비교한다. 리그별로 독립 보고하고 pooled winner score나 historical/Forward 합산은 없다.

**아래 eligibility는 독립성 인증·CTO 승인이 있는 2025/26에만 적용한다.** Candidate별로 4리그 모두, 두 comparator 각각에 대해 전부 충족해야 한다.

- Delta LL < −1e−12 AND delta Brier < −1e−12.
- HOME/DRAW/AWAY 각각 recall delta ≥ −0.05−1e−12.
- 각 class ECE delta ≤ 0.01+1e−12.
- 각 class one-vs-rest Brier delta ≤ 1e−12.
- U≥100경기, |U|/N≥80%, candidate가 U의 100% 예측, 전체 N개 ID 보존.
- FAIL/INVALID=0; U에 actual 3개 class가 모두 존재해야 한다. Required recall/ECE가 null이면 INSUFFICIENT이다. Precision null은 보고하되 별도 승격 guard로 사용하지 않는다.

모두 충족할 때만 ELIGIBLE_FOR_CTO_PROMOTION_REVIEW이다. Numeric 위반은 SCREEN_NO, 부족/실패/위반은 정해진 상태로 보고한다. 이 상수는 사전등록한 보수적 eligibility guard이며 통계적 유의성 보장이나 실험 최적값이 아니다. 2024 결과에 따라 완화하지 않는다. 여러 candidate가 통과해도 자동 winner 선택·ensemble·Forward 전환은 없다.

## Diagnostics / implementation handoff / governance

각 candidate는 전체 IDs/status/reasons, U membership, required feature별 사용/제외 ID와 사유, team count/means/reference/vector, raw/input/provider hash와 실제 fetchedAt, H2 fit/input hash와 rate, beta/fit-ID hash, objective/gradient/iteration/backtracking trace, beta·X와 V3 rate/probability hash, dual-comparator metric을 남긴다. 원본 통계는 LOCAL_ONLY이며 기존 CONDITIONAL 내부 사용 및 UNRESOLVED 공개 권리 상태를 유지한다.

구현 경로는 JSON의 implementationContract에 미리 명시했지만 아직 파일을 만들지 않았다. 후속 구현자는 field reversal, candidate isolation, boundary, missingness, synthetic analytic gradient/Hessian, deterministic optimizer, beta=0 H2 equivalence, fixed denominator, forbidden-input 및 hash 보호 테스트를 통과한 후 모든 source/test/input/comparator hashes를 봉인해야 한다. H2/v1의 기존 season guard를 고치지 않는다. 필요한 V3 전용 adapter는 identity를 유지하고 2025를 2024로 relabel하지 않으며 기존 시즌의 frozen 동작 동등성을 검증해야 한다.

640개 기존 파일의 byte hash를 보호하며 부모/V2/H2/Forward/archive/census와 기존 미추적 access-gate 문서를 그대로 유지한다. Local prerequisite/preservation evidence는 `C:/Users/TCTCTC/YANG-EDGE/YANG-EDGE-INBOX/football-v3-algorithm-design-v1`에 있다. 후속 작업은 이 MD/JSON과 부모 protocol을 읽고 별도 승인된 구현 범위만 진행한다. 합법적인 모델 실험 실패를 이유로 상수·feature를 재선택하지 않는다.

Odds/market lines/consensus는 입력 금지다. Independent prediction 봉인 이후 별도 시장 비교만 허용한다. 공식 Forward는 계속 football-poisson-research-v1이며 별도 promotion/CTO 승인 없이 바꾸지 않는다. main merge는 없다.

V3_IMPLEMENTED = NO; V3_FITTING_EXECUTED = NO; V3_BACKTEST_EXECUTED = NO.

2025_HOLDOUT_METRICS_VIEWED = NO; V2_CHANGED = NO; H2_CHANGED = NO; FORWARD_V1_CHANGED = NO.

F1_SPEC_FROZEN = YES; F2_SPEC_FROZEN = YES; F3_SPEC_FROZEN = YES.

FOOTBALL_V3_FEATURE_ALGORITHM_DESIGN_FREEZE_V1_READY_FOR_CTO_REVIEW

STOP.
