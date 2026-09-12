# FOOTBALL V3 FEATURE RESEARCH PROTOCOL V1

**PROTOCOL / DESIGN SCOPE ONLY.** V3 연구 질문과 범위를 사전등록한다. 구현, fitting, backtest, API 조회, 2025/26 holdout 결과·metric 열람은 수행하지 않았다. 이 문서는 실행 승인이 아니다.

BASE_SHA = c8701b678e6d6a7b8cffb668e74ed696c7f6ee79

BRANCH = agent/astra/football-historical-source-gate-v1

Protocol canonical-payload SHA256 = `0b30bc4d41684f2797d0a8e0a2a53694ecc6d5dc8f151b45213af1f1f9dc1bb8`

[Machine-readable protocol](FOOTBALL_V3_FEATURE_RESEARCH_PROTOCOL_V1.json)은 동일한 계약과 선행 근거의 byte hash를 포함한다. JSON의 payload를 재귀적으로 key 정렬하고 배열 순서를 유지한 compact UTF-8 JSON으로 직렬화하여 SHA256을 계산한다. Envelope의 sha256은 해시 대상에서 제외한다.

## 연구 질문과 frozen prior evidence

“팀의 단순 득실점 구조를 넘어 과거 경기의 공격 과정 데이터가 미래 1X2 probability quality를 추가로 개선하는가?”를 검증한다. Accuracy만 높이는 것이 아니라 Log Loss, Brier, calibration과 HOME/DRAW/AWAY behavior를 함께 평가한다.

공식 Forward 모델은 `football-poisson-research-v1`이다. [기존 V2 exposed evaluation](FOOTBALL_POISSON_V2_EXPOSED_EVALUATION_V1.md)에서 H2는 4리그 모두 Log Loss와 Brier의 descriptive 개선을 보였지만 frozen screen을 통과하지 못했다. 따라서 다음 상태를 그대로 유지한다.

- BEST_DESCRIPTIVE_CANDIDATE = H2
- SCREEN_RESULT = SCREEN_NO
- MODEL_PROMOTED = NO
- V3_RESEARCH_BACKBONE_CANDIDATE = H2

H2의 연구 동기를 등록하는 것이며 공식 baseline 또는 Forward로 승격하지 않는다. [Frozen H2 specification](FOOTBALL_POISSON_V2_ALGORITHM_DESIGN_FREEZE_V1.json), 기존 구현과 기존 결과는 수정하지 않는다.

## Phase 1 feature와 독립 실험

Phase 1 공식 feature 후보는 F1=xG (`expected_goals`), F2=Total Shots, F3=Shots on Goal의 세 개뿐이다.

- V3-F1: H2 backbone + xG information only.
- V3-F2: H2 backbone + Shots/SOT information only.
- V3-F3: H2 backbone + xG + Shots/SOT information.

각 candidate를 독립적으로 평가한다. 어느 candidate의 결과도 다른 candidate의 specification 변경 근거로 사용할 수 없다. 세 candidate의 정확한 결합 수학식, 알고리즘과 hyperparameter는 어떤 V3 결과도 보기 전에 별도 Algorithm Design Freeze에서 모두 봉인한다. 이번에는 수치·공식·window·fitting 방법을 선택하지 않는다.

restDays와 fixtureCongestion은 Phase 1에서 제외한다. League-only schedule이 국내 컵과 대륙대회를 포함한 실제 workload를 표현한다고 검증되지 않았으므로 별도 schedule-scope audit 이후 Phase 2 후보로만 검토한다. 라인업·부상·징계는 V4이다. 이전 data gate의 추천 목록을 수정하지 않고, 이번 Phase 1의 범위를 별도로 한정한다.

## 필수 comparator와 보고 구조

모든 candidate는 A=`football-poisson-research-v1`, B=`frozen H2 specification` 두 comparator와 각각 비교한다. “H2 대비 추가 개선”과 “v1 대비 최종 개선”은 별도 보고하며 v1을 삭제하거나 H2로 대체하지 않는다.

리그·candidate별 결과, 비교에 사용된 paired fixture IDs와 분모, 전체 cohort coverage, PASS 및 missingness를 함께 보고한다. 비교 가능한 prediction subset의 metric을 전체 cohort 성능으로 표현하지 않는다. 정확한 pairing, comparator 실행 경로와 metric 계산 규약은 실행 전 Design Freeze에서 봉인한다. 기존 V2의 prediction-only paired IDs를 V3 전체 population으로 자동 채택하지 않는다.

## Cohort와 development / exposed check

[Historical census](../data/audits/football-v3-historical-feature-coverage-census-v1.json)의 전체 Regular Season cohort 2,892경기를 유지한다. EPL=39, La Liga=140, Serie A=135, Bundesliga=78이며 identity는 API-Football fixture.id이다. 각 리그의 archive SHA256과 시즌별 fixture-ID hash/count는 companion JSON에 기존 [V2 protocol cohort](FOOTBALL_POISSON_V2_DRAW_RESEARCH_PROTOCOL_V1.json)에서 복사하여 고정했다. Fixture 추가·삭제·추정은 허용하지 않는다.

- 2023/24, provider season=2023: PRIMARY DEVELOPMENT, 1,446경기.
- 2024/25, provider season=2024: EXPOSED DEVELOPMENT CHECK, 1,446경기.
- 각 시즌 EPL/La Liga/Serie A는 각각 380경기, Bundesliga는 306경기이다.

2024/25는 이미 v1/v2에서 사용한 exposed dataset이며 final validation 또는 untouched holdout이 아니다. V3 algorithm/hyperparameter 선택은 사전 Design Freeze에서 끝내고 2024/25 V3 결과를 보고 수정하지 않는다. 세부 chronological fitting/check 절차는 Design Freeze에서 결정하되, 미래 데이터나 평가 대상 결과를 fitting 입력으로 사용하는 경로를 허용하지 않는다.

Historical census canonical SHA256 = `0f215fba91a68cdd0a4a53b5124a311f193821baddd2ff1764d8942cb8718c41`

## Independent holdout candidate와 current season

2025/26, provider season=2025를 `INDEPENDENT_HOLDOUT_CANDIDATE`로 등록한다. 아직 독립성을 인증하거나 cohort 수집을 완료했다는 뜻은 아니다. 이번 미션에서는 이 시즌의 데이터나 결과 파일을 열지 않았고, metric 계산·열람·API 수집을 하지 않았다.

Protocol freeze 이후 별도 수집 단계에서는 먼저 fixture identity, league/stage scope, data completeness와 hashes만 봉인한다. Algorithm Design 전에 holdout 성능을 계산하거나 열람하지 않는다. 기존 노출 여부도 audit하여 독립성에 문제가 있으면 그대로 보고하고, exposed data를 독립 holdout으로 바꾸어 부르지 않는다. Completeness 봉인은 성능 평가 승인이 아니다.

Protocol 및 Algorithm Design Freeze, cohort/integrity/exposure audit가 완료된 후 별도 CTO 승인으로 최종 holdout evaluation을 1회만 실행한다. 이번 문서로 수집 또는 evaluation을 시작하지 않는다.

2026/27, provider season=2026의 역할은 `PROSPECTIVE_FORWARD_EVIDENCE`이며 Historical holdout으로 사용하지 않는다. 향후 V3 prospective evidence는 공식 Forward v1과 분리한다. V3 연구 통과만으로 2026 Forward에 자동 반영하지 않는다.

## Missingness 원칙

xG·Shots·SOT는 각각 2,891/2,892 complete, coverage=99.965422%이다. 공통 누락은 Serie A 2024 fixture `1223728`이며 세 feature 모두 STATISTICS_UNAVAILABLE이다.

Imputation, zero 대체, league/team 평균 대체, fixture 삭제 후 분모 축소를 금지한다. Base-result history는 유지하고 feature layer에 unavailable evidence를 명시한다.

정확한 candidate behavior는 PASS, feature-neutral, history-window exclusion 중 **하나만** Algorithm Design Freeze에서 실행 전에 선택한다. 이번에는 어떤 방식도 선택하지 않았다. Feature-neutral을 값 0 또는 평균으로 조작하는 것으로 해석해서는 안 된다. History-window exclusion을 선택해도 base-result history와 target 전체 분모를 제거하지 않는다. 어느 방식이든 정확한 동작과 coverage/PASS 보고 규약을 함께 봉인하고 결과에 따라 바꾸지 않는다.

MISSINGNESS_POLICY_STATUS = PRINCIPLES_FROZEN_BEHAVIOR_DEFERRED

## Temporal contract와 representation 결정사항

Target T 자신의 xG, shots, SOT는 입력 금지다. 오직 T 이전 완료 경기의 feature만 사용할 수 있다. 현재 수집한 historical stats는 retrospective final/revised data이며 `strictReplayEligible=false`이다.

Historical V3에는 근거를 명시한 하나의 availability lag가 필요하며 **Algorithm Design Freeze 전에** 별도 봉인한다. 이번에는 lag를 선택하지 않는다. 기존 v1/v2의 lag를 feature publication 보장으로 자동 승계하지 않는다. 현재 시즌 xG 누락 2건의 재확인만으로 일반적인 lag를 정하지 않는다. 연구용 availability 가정은 실제 과거 observedAt이 아니다.

실전 Forward에서는 실제 provider에서 관측된 완료 경기 feature로서 `providerFetchedAt <= predictionCreatedAt`인 evidence만 허용한다. Historical synthetic observedAt를 가져오거나 시각을 소급 생성하지 않는다. 나중에 수집된 수정값으로 기존 sealed input을 바꾸지 않는다.

다음 항목을 향후 Design Freeze에서 반드시 결정한다.

- xG: for/against, home/away representation, rolling aggregation.
- Shots와 SOT: 각각 for/against representation.
- Window: 최근 N경기 또는 fixed days와 정확한 범위.
- Normalization: league-relative 여부.
- Shrinkage: 필요 여부와 정확한 규약.

이번 protocol에는 위 항목의 구체 수치나 공식을 넣지 않는다.

## Metrics와 promotion 원칙

Primary metrics는 Multiclass Log Loss와 Multiclass Brier Score이다. Secondary는 Accuracy, DRAW/HOME/AWAY 각각의 recall·precision, predicted class shares, one-vs-rest Brier, per-class calibration/ECE이다. Feature coverage, PASS, missingness도 함께 보고한다. ECE binning, zero-denominator 처리 등 정확한 계산 규약은 실행 전에 봉인하며 결과에 맞춰 선택하지 않는다.

단순 accuracy 증가로 승격할 수 없다. 두 comparator 대비 probability quality 개선을 각각 보고하고, catastrophic class degradation이 없어야 하며, integrity/coverage를 통과하고 독립적으로 보호된 2025/26 holdout에서도 확인되어야 한다. **정확한 numeric promotion rule은 Algorithm Design Freeze 전에 별도 명시적으로 고정한다.** 이번에는 numeric rule을 선택하지 않는다.

2023/24 또는 2024/25만으로 MODEL_PROMOTED를 선언할 수 없다. Holdout 성공도 Forward 자동 전환을 뜻하지 않는다.

## Market / Forward firewall와 권리 상태

Odds, market consensus, betting lines는 `MODEL_INPUT_ALLOWED=NO`이다. Independent model prediction을 먼저 봉인한 후 시장 비교를 별도 layer에서만 허용한다.

공식 Forward는 계속 `football-poisson-research-v1`이며 `FORWARD_V3_AUTO_MIGRATION=NO`이다. 변경에는 별도 promotion 및 CTO 승인이 필요하다. 기존 V2/H2/Forward 코드나 봉인 결과는 수정하지 않는다.

기존 gate의 `LEGAL_INTERNAL_USE=CONDITIONAL`, `PUBLIC_RAW_FEATURE_DISPLAY=UNRESOLVED`, `COMMERCIAL_PUBLIC_RIGHTS=UNRESOLVED`를 유지한다. Raw는 LOCAL_ONLY이다. 보관 권리의 근거는 사용자가 전달한 provider dashboard Chat AI 안내이며 HUMAN_SUPPORT_CONFIRMATION=NO, FORMAL_WRITTEN_LICENSE=NO를 유지한다. 이번 문서는 새로운 법률·라이선스 확인이 아니다.

## 검증과 Cursor handoff

Companion JSON에는 이전 근거의 byte hashes와 638개 보호 파일의 before/after digest를 기록했다. V2/H2/Forward, historical archives, 이전 gate/census와 기존 미추적 access-gate 문서를 보존한다. 검증은 JSON 구조·hash·cohort count와 파일 불변 확인에 한정하며 모델 테스트, fitting 또는 backtest runner를 실행하지 않는다.

다음 작업자는 이 두 protocol 문서와 참조된 frozen evidence를 먼저 읽는다. 후속 필수 단계는 근거 있는 단일 availability lag와 numeric promotion rule의 사전 봉인, 세 candidate 전체의 Algorithm Design Freeze이다. 그 뒤 별도 허용된 2025 cohort 봉인과 CTO 승인 없이 holdout evaluation을 시작하지 않는다. 미정 항목을 임의 기본값으로 채워 구현하지 않는다. 기존 access-gate 미추적 문서를 커밋하거나 main에 merge하지 않는다.

V3_IMPLEMENTED = NO

V3_FITTING_EXECUTED = NO

V3_BACKTEST_EXECUTED = NO

2025_HOLDOUT_METRICS_VIEWED = NO

V2_CHANGED = NO

H2_CHANGED = NO

FORWARD_V1_CHANGED = NO

FOOTBALL_V3_FEATURE_RESEARCH_PROTOCOL_V1_READY_FOR_CTO_REVIEW

STOP.
