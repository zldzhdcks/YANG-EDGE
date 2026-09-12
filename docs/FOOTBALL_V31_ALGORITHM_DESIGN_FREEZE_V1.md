# FOOTBALL V31 ALGORITHM DESIGN FREEZE V1

**AUDIT + DESIGN ONLY.** 구현·fitting·backtest·candidate metric 계산은 수행하지 않았다. 이 봉인은 실행 승인이 아니다.

BASE_SHA = 534f32f9ecfdbf7f1e149f95c4c2acfc82882b82
BRANCH = agent/astra/football-historical-source-gate-v1

Design canonical-payload SHA256 = `8ed600a7a97ed7276dbadf1fc9eaff518e03101090b9d952563877116f3ff264`

선행 omission audit는 2026-09-12T10:42:17.700Z에 DESIGN_FREEZE_ALLOWED로 봉인됐다. Audit hash = `87abfe5f7218657a4142d65d029034cd9ae4f48e93fc46da649309dfb30da350`. 설계 생성은 그 이후다. [Omission audit](FOOTBALL_V31_OMISSION_AUDIT_V1.md)와 [정확한 JSON specification](FOOTBALL_V31_ALGORITHM_DESIGN_FREEZE_V1.json)을 함께 읽는다. JSON common contract와 candidate별 blocks가 실행 계약이며 기존 부모/source/beta를 변경하지 않는다.

## Selection and limits

R1 directly tests restricted H2-conditional process information. R3 fixed projection is a low-degree unresidualized representation control using the identical all-feature composites, separating compression from the additional conditioning operation. Both have two rate coefficients and identical features/normalization.

선택: V31-R1(R1)과 V31-R3(R3), 정확히 2개. R2는 window 선택 자유도와 recency/conditioning 혼동을 피하기 위해 이번에 선택하지 않았다. R3는 PCA 대신 고정 투영 하나만 채택한다. 어느 선택도 새로운 2023/2024 성능 실행으로 결정하지 않았다. Feature 삭제 없이 xG·Shots·SOT를 두 후보 모두 유지한다.

## Shared feature identity, temporal state and H2

C(T)=kickoff(T)−1ms. Same league Regular Season FT, 다른 fixture ID, kickoff(m)≥C(T)−365days, kickoff(m)+48h<C(T), 허용된 source season만 사용한다. 48h equality는 제외하고 365d equality는 포함한다. Same-kickoff 그룹은 동일 immutable history 및 prefix-map pool을 사용한다. ID 정렬은 시간 정보가 아니다.

48h는 retrospective research assumption이며 실제 publication/fetchedAt이 아니다. Final/revised historical values의 strictReplayEligible=false를 유지한다. 모순되는 완료 시각은 INVALID이고 lag를 선택적으로 수정하지 않는다. Forward는 실제 providerFetchedAt 조건이 별도로 필요하며 이번 설계로 변경하지 않는다.

Provider types는 expected_goals, Total Shots, Shots on Goal. Exact fixture/team IDs로 join한다. Home For=home value, Against=away value이고 away는 반대다. 0은 유효 값, null/absent/block missing은 결측이다. Duplicate identity/type, 음수·비유한·잘못된 값은 INVALID다. Shots/SOT는 정수여야 한다.

각 feature별 독립 complete prior pool을 사용한다. 양 target team마다 각 feature 최소5경기, 365d uniform arithmetic means, all venues. League reference는 해당 pool의 양 팀 For 합/2경기수다. zFor=log(team For mean)−log(league reference), zAgainst=log(team Against mean)−log(league reference). Min count 이후 required mean/reference=0이면 PASS_NONPOSITIVE_FEATURE_MEAN. Epsilon·imputation·clipping·추가 scale은 없다. 결측 경기의 base-result는 남기고 해당 feature history만 제외한다.

모든 target와 training anchor의 H2는 자기 cutoff 이전 base-result history로 fresh causal frozen H2 fit한다. 기존30/5/5, unseen-team, ridge/optimizer/rate 규칙 그대로다. Full-season hindsight H2 parameter를 conditioning에 가져오지 않는다. H2 parameter는 V3.1 fitting에서 갱신하지 않는다.

## Shared two-dimensional projection

For scoring side s and opposing team o:

q_s,For = ((z_s,xG,For + z_s,Shots,For) + z_s,SOT,For) / 3

q_s,Against = ((z_o,xG,Against + z_o,Shots,Against) + z_o,SOT,Against) / 3

같은 절차를 home/away 대칭 적용한다. 모든 feature가 dimensionless league log-relative state이므로 동일한 고정 양의 weight를 사용한다. 이는 사전 표현 선택이며 최적 weight라는 주장이 아니다. 행렬의 1/3을 미리 반올림해 곱하지 말고 위 sum/divide 순서를 사용한다.

## V31-R1 — H2-conditional residual representation

Residualize하는 대상은 target own stats가 아니라 target 이전 process history로 만든 두 composite q다. Conditioning h_s=[1, log(lambda_H2,s), log(lambda_H2,o)]이며 scorer/opponent 순서를 지킨다. Home/away에 동일한 map을 공유한다. H2가 설명하는 모든 정보를 완전히 제거한다고 주장하지 않고 두 log-rate 요약에 대한 regularized linear component만 제거한다.

각 j=For,Against에 map a_j=(intercept,scorer-rate slope,opponent-rate slope)를 추정한다. N은 distinct anchor 수, M=2N은 side row 수다:

For j=For,Against separately: minimize L(a_j)=(1/(2M))*sum_r(q_rj-h_r dot a_j)^2+(0.01/2)*(a_j1^2+a_j2^2). r iterates home then away for N distinct eligible anchors; M=2N. Intercept unpenalized.

A=(sum_r h_r h_r^T)/M+diag(0,0.01,0.01); b_j=(sum_r h_r q_rj)/M; solve A*a_j=b_j. No target scores or process stats are regression responses: q is its anchor-prior process composite.

Intercept 2개와 slope4개, 총6개 nuisance coefficient다. Slope ridge=.01, intercept penalty=0. Representation 최소5 distinct anchors(10 side rows)는 3 columns를 넘는 구조적 gate로 고정했다. 통계적 power나 실험 최적 최소치가 아니다. Beta 최소30은 기존 규칙을 유지한다.

Unpivoted Cholesky in column order 0,1,2; ascending lower-triangle accumulation, forward/back substitution. Reuse A factor only for the two RHS within the identical pool; no alternate solver, pivoting, jitter, random initialization, grid or restart.

Require all finite, all Cholesky pivots strictly positive, and infinity norm(A*a_j-b_j)<=1e-10*(1+maxAbs(b_j)) for each j. A is positive definite mathematically for any nonempty pool because the intercept has positive count and slopes have positive ridge. Numerical failure remains failure.

Transform r_sj=q_sj−h_s·a_j. Residual mean/variance를 사후 재조정하지 않는다. Ridge 때문에 training residual의 slope-column covariance는 정확히0이 아니다: Hᵀr/M=diag(0,.01,.01)a. Intercept 잔차 평균만 수치 허용범위에서0이며 out-of-sample에서는 그마저 보장되지 않는다. “orthogonal=incremental signal”로 해석하지 않는다.

### Chronological representation fitting — mandatory

B is every season-2023 full-cohort anchor with PREDICTED causal H2 and valid all-required-feature pregame q. Construct each anchor from its own cutoff history. Normal H2/feature PASS excluded only from representation likelihood with full census; FAIL/INVALID prevents required fit. B does not depend on R1 residual eligibility or labels: no recursion.

For beta-training anchor T, P(T)={m in B: same league, kickoff(m)>=C(T)-365d AND kickoff(m)+48h<C(T)}. Fit a(T) from P(T), requiring >=5 distinct fixtures, and transform T with a(T) only. Never use T, same-kickoff anchors, or later anchor states. P(T) is independent of candidate results. Every q_m and h_m was already causal at m.

Initial check map: fit B with kickoff<2024-01-01T00:00:00.000Z and kickoff+48h<boundary. Final map: fit all B from season2023, only after max2023Kickoff+48h+1ms. Both require >=5 anchors. These maps are used only out-of-sample; never replace stored prefix maps in beta training.

Initial map held fixed throughout internal check; final map held fixed throughout 2024 and any separately approved 2025 check. Neither representation response nor map fit can use 2024/2025 anchors. Current causal target history may update; learned map may not.

핵심적으로 beta 학습용 r(T)에 initial/full-final map을 소급 적용하지 않는다. T별 과거 prefix map을 사용한다. Initial/final map은 이후 check target을 변환하는 데만 쓴다. 이렇게 해야 2023 안의 미래 feature state가 더 이른 학습 예제의 변환에 들어가지 않는다.

Beta is trained on causal prefix residuals and evaluated with a fixed end-of-training map. This prevents in-sample lookahead but may cause scale/distribution differences. Retain hashes and descriptive diagnostics; no recalibration or repair after results.

Active parameter count는 map6+beta2=8이다. 여러 prefix map도 각각6개를 추정하므로 전체 연구에서 단8개만 추정했다는 뜻은 아니다. 모든 prefix pool/map hash와 count를 기록한다.

## V31-R3 — fixed correlated-feature projection

R3는 위 q 두 성분을 그대로 사용한다. Method=FIXED_PROJECTION, component count=2, learned representation parameter=0, beta=2. Fit season=NONE, centering/scaling=위 causal league-log normalization 외 NONE, sign=모든 가중치 양수, 순서=For/Against. Eigenvalue tie rule와 eigensolver는 NOT_APPLICABLE이며 PCA를 사용하지 않는다. 모든 out-of-sample target에 같은 projection을 적용하고 2024 refit은 없다.

이는 H2 중복 성분을 제거했다고 주장하는 후보가 아니다. 높은 상관의 여섯 covariate를 두 process composite로 압축한 대조 후보다. 같은 q에 conditioning을 추가한 R1과 비교하여 표현 압축과 제한적 H2 제거를 구분한다. 공통 process level에 실제 incremental signal이 없을 가능성과 유용한 feature contrast를 잃을 가능성을 모두 허용한다.

## Frozen model rate and beta estimator

두 후보 모두 eta_s=log(lambda_H2,s)+beta_For*X_s,For+beta_Against*X_s,Against; lambda_s=exp(eta_s). R1 X=r, R3 X=q. Left-to-right dot와 exp(log(H2)+dot)를 사용한다. Beta 2개는 양 side 공통, intercept/interaction/draw coefficient 없음. Representation/H2를 beta likelihood와 joint fit하지 않는다.

J(beta)=(1/(2N))*sum_i[exp(o_iH+X_iH dot beta)-y_iH*(o_iH+X_iH dot beta)+exp(o_iA+X_iA dot beta)-y_iA*(o_iA+X_iA dot beta)]+(0.01/2)*sum_j beta_j^2; o=ln(causal frozen H2 rate); omit log-factorial constants.

g=(1/(2N))*sum_i,s X_is*(lambda_is-y_is)+0.01*beta

H=(1/(2N))*sum_i,s lambda_is*X_is*X_is^T+0.01*I

위 inherited objective의 X는 해당 후보 r 또는 q로 한정한다. Ridge beta .01, initialization0, minimum30 valid fixture examples. Damped Newton/unpivoted Cholesky, maxAbs(g)≤1e−7, accepted updates≤100. Alpha=2^(−j), j0..59, Armijo1e−4의 첫 finite positive-rate trial. Convergence는 objective change로 대체하지 않는다. No warm start, solver fallback, restart, grid search.

Nonpositive Cholesky pivot, nonfinite accepted state or g dot d>=0 before convergence => FAIL_NUMERICAL. 100 updates without convergence => FAIL_NON_CONVERGENCE. No beta=0/H2 fallback after failure.

Likelihood에는 cap10을 적용하지 않지만 finite positive를 요구한다. Target finite rate>10은 PASS_GOAL_RATE_OUT_OF_RANGE; computed nonfinite/nonpositive는 FAIL. Independent Poisson recurrence/tail1e−12/k≤199, mass tolerance3e−12, final sum tolerance1e−10, ordinary argmax HOME→DRAW→AWAY tie order는 기존 specification 그대로 복사해 봉인했다. Draw-specific correction은 일절 없다.

## Development and check

Season2023 anchors kickoff<boundary and kickoff+48h<boundary. R1 uses prefix-map residual per anchor, R3 fixed q. Require >=30 valid beta examples. Initial R1 map fitted separately from B before check. Fit each beta from zero with inherited optimizer; no tune based on internal check.

All season2023 targets kickoff>=boundary. Freeze initial beta and initial R1 map. H2/q target state remains causal and updates with eligible 2023 history. Pre-boundary anchors whose 48h has not elapsed at boundary remain audited but are not moved into internal check.

At time strictly after max season2023 kickoff+48h, fit beta once from all eligible season2023 causal examples using saved prefix-map residuals (R1) or fixed q (R3). Fit final R1 map separately from all B. Seal final map/beta/input hashes before 2024 candidate result access.

Season2024 full cohort; final-2023 beta and R1 map immutable. No representation fit/refit, beta refit, feature selection or structural changes from 2024 outcomes. H2 and q may consume earlier eligible 2024 results/features as causal history only.

Not executed or authorized. Future approved 2025 stage must reuse identical final-2023 beta/map hashes; no 2024/2025 learned-map or beta refit.

Initial boundary=2024-01-01T00:00:00.000Z. Final stage 실행 시각은 max2023Kickoff+48h보다 엄격히 이후여야 한다. Initial/final beta 각각0부터 한 번 fit하며 내부 check 결과로 설계를 바꾸지 않는다. 2024/2025의 이전 완료 경기는 해당 target의 causal H2/q history에만 들어갈 수 있다. Representation 학습 pool과 beta fit에 들어갈 수 없다. No2022 warmup.

## Missingness and status propagation

전체 target ID·분모를 유지한다. Known missing fixture1223728의 정상 base-result history도 유지한다. 각 feature pool만 exclusion하고 min count 부족이면 PASS다. R1 prefix map의 anchor5개 미만도 별도 PASS_INSUFFICIENT_REPRESENTATION_HISTORY이며 zero residual/H2/R3 fallback으로 구제하지 않는다. Required stage map 또는 beta fit이 부족하면 experiment INSUFFICIENT다.

Integrity first; then causal H2, feature min counts and positive means, R1 map integrity/eligibility, final rates/mass. A required upstream FAIL/INVALID halts the fit/candidate stage and emits its status; do not silently continue a fit after dropping it. Other independent candidate remains separately reported only if shared integrity is valid.

PASS means valid completed fit/check, not performance improvement; no score-based override. Metrics null when U incomplete; report INCOMPLETE_PRIMARY_COVERAGE without shrinking U.

INVALID→FAIL→INSUFFICIENT→PASS precedence. 정상 row PASS를 experiment FAIL로 바꾸지 않지만 numerical/integrity failure를 PASS로 낮추거나 해당 예제를 삭제해 fit하지 않는다. Shared evidence가 invalid이면 독립 후보도 진행하지 않는다.

## Comparator fairness, metrics, reference

For each league/phase, N is every frozen target. Before candidate execution and without consulting outcomes/features, seal U={IDs where frozen V1 and frozen H2 both PREDICTED} and comparator probabilities/hashes. Never import V2 paired IDs as V3 universe.

If candidate does not predict every ID in U, primary LL/Brier/class metrics are null with INCOMPLETE_PRIMARY_COVERAGE; do not drop targets or substitute comparator probabilities. Optional common-subset metric not produced in this design.

Both use Phase-1 F3 as feature-set-matched descriptive reference only, because all three feature families retained. Logical comparison is registered now; no candidate mapping by observed performance. Compare existing sealed F3 only if exact stage IDs and U and comparator contracts match, else REFERENCE_NOT_COMPARABLE without rerun/subsetting. No reference required for promotion.

Freeze sources/specs; for each phase seal V1/H2 U and probabilities before candidate outputs. Candidate order V31-R1 then V31-R3. Seal candidate pregame outputs before joining stage outcomes for scoring. Beta fitting joins only eligible training labels via separate interface.

LL scoring floor1e−15(hit count), multiclass Brier는 class 수로 나누지 않음. Accuracy/recall/precision/class share와 OVR Brier, class별10 equal-bin ECE는 inherited exact contracts를 JSON에 복사했다. Empty denominator=null; ECE empty bin은 null, n<20 low-sample 표시. Candidate−comparator delta는 동일 U의 unrounded값. U 밖 prediction은 audit만, pooled winner score·historical/Forward 합산 없음.

## Promotion rule — UNCHANGED

기존 promotion object canonical hash 9bb0ccd9917f3049ec740617caf86d06787ab8d46ced235c442844adf1639f7f를 검증하고 원문을 복사했다. Numeric rule은 **UNCHANGED**로 재봉인한다. Candidate 열거만 V31-R1/V31-R3에 적용하며 과거 F1/F2/F3를 실행 후보로 추가하지 않는다.

4리그 모두, V1/H2 각각 ΔLL<−1e−12 AND ΔBrier<−1e−12; class별 recallΔ≥−.05−1e−12, ECEΔ≤.01+1e−12, OVR BrierΔ≤1e−12. U≥100, U/N≥80%, candidate U coverage100%, full IDs 보존, FAIL/INVALID0, 실제3class 존재. Required null은 INSUFFICIENT, precision null은 보고만 한다. 모두 통과해도 ELIGIBLE_FOR_CTO_PROMOTION_REVIEW이며 자동 승격/ensemble/Forward 전환 없음.

2023/2024는 descriptive only. 2025는 여전히 접근 금지다. 구현/tests, source/input/parameter 봉인, 2023 Development 및2024 exposed가 완료되고 별도 명시적 CTO 승인 뒤에만 future holdout execution을 검토한다. 이번 문서는 그 승인에 해당하지 않는다.

## Determinism, diagnostics and tests before execution

Binary64; sorted kickoff ascending then numeric fixtureId; home then away; features xG/shots/sot; component For then Against; column order 0,1,2; scalar left-to-right sums; fixed Node/runtime version logged at future source seal. No BLAS parallel reductions, randomness, rounding comparisons, solver fallback or tuning.

Per league/candidate Pearson and Spearman average tied ranks; zero variance=>null. All allowed pregame representation components versus each H2 log-rate and one another; no outcome-conditioned selection. Contribution quantiles linear interpolation (n-1)q at p10,p25,median,p75,p90 and maximum absolute, rates ratio likewise. Initial/final active map/beta values/signs and absolute delta, relative abs delta divided by abs initial (zero=>null). Prefix fit counts/ranges/hashes recorded; no confidence/significance claim.

Training sides, repeated teams and overlapping histories are dependent. Ridge residual not fully decorrelated. Low-dimensional fixed projection can discard useful contrast. Prefix versus fixed map scale may differ.

1. Target own feature absent from input schema and mutation has no effect
2. Target result inaccessible to representation/H2 state; labels joined only for eligible beta examples
3. Future feature mutation cannot affect an earlier state or prefix-map hash
4. Check/evaluation season rejected from representation-fit population; final maps fixed from 2023
5. 48h strict equality excluded and +1ms transition included relative to cutoff
6. 365d equality included and 1ms older excluded
7. Same-kickoff group shares history and prefix maps; ID permutation cannot reveal outcomes
8. Foreign league rejected from history, representation pool and beta fit
9. Exact fixture/team identity; duplicates rejected; no fuzzy join or season relabel
10. Home/away swap exchanges process state, H2 log rates and predicted sides with no manual coefficient change
11. Zero valid raw value versus null/missing; all-zero required mean PASS, invalid value INVALID
12. Each feature/team count gate, 5-fixture representation gate and 30-fixture beta gate checked separately
13. Fixed projection arithmetic and R1 transform deterministic under canonical ordering
14. Representation normal equation and unpenalized-intercept equation checked on synthetic inputs only
15. Representation solver nonpositive pivot/nonfinite/residual failure propagates; no fallback
16. Residual-training example uses its own strictly earlier prefix; initial/final full map cannot be substituted
17. Final map training excludes 2024 even when earlier 2024 history is available to target state
18. Beta gradient/Hessian analytic versus synthetic finite differences; deterministic zero-start fit
19. Beta=0 reproduces frozen H2 probabilities within frozen numerical tolerance, without changing source
20. Hash mismatch in source/input/map/beta/comparator rejects execution
21. 2025 raw path/season rejected before file read without separately approved stage
22. V1 and H2 comparator U identical for every candidate; a candidate PASS cannot delete U IDs
23. Incomplete U yields null primary metrics; PASS census retained; no H2 fallback
24. Forbidden odds/market/provider predictions/manual/external inputs rejected
25. Frozen source/model/protocol/promotion hashes unchanged before and after
26. Probability mass, cap, argmax tie order, null metrics and ECE bins match inherited contracts
27. Revisions of candidate source after source seal invalidate execution; no fitting before freeze

## Preservation / risk / handoff

현재 수행한 검증은 부모·audit·source/protected hash와 문서 구조 검증뿐이다. 위 runtime tests는 향후 구현에서 필수이며 지금 실행했다는 뜻이 아니다. V1/V2/H2/V3 Phase-1 및 beta는 변경하지 않았다. Raw LOCAL_ONLY, conditional internal-use 및 unresolved public/commercial rights 유지. Provider Chat AI는 formal license로 승격하지 않는다.

다음 별도 구현 미션은 이 JSON의 candidate/common specification을 그대로 사용하고 source/test/runtime 및 각 causal state/map/beta/output hash를 실행 전에 봉인해야 한다. Parameter 부족·수치 실패·성과 악화를 보고 설계/상수를 바꾸지 않는다. 기존 untracked doc을 보존하고 main에 merge하지 않는다. 구현용 directory는 예약만 했으며 파일을 만들지 않았다.

V31_IMPLEMENTED = NO; V31_FITTING_EXECUTED = NO; V31_BACKTEST_EXECUTED = NO; V31_CANDIDATE_METRICS_COMPUTED = NO.

2025_HOLDOUT_PREDICTIONS_GENERATED = NO; 2025_HOLDOUT_METRICS_VIEWED = NO; 2025_HOLDOUT_METRICS_COMPUTED = NO.

V3_PHASE1_CHANGED = NO; V2_H2_CHANGED = NO; FORWARD_V1_CHANGED = NO.

FOOTBALL_V31_OMISSION_AUDIT_ALGORITHM_DESIGN_FREEZE_V1_READY_FOR_CTO_REVIEW

STOP.
