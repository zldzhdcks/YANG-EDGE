# FOOTBALL_POISSON_V2_DRAW_RESEARCH_PROTOCOL_V1

BASE_SHA = e025e87a4cda3e36130109125927e16499a384a6

STATUS = RESEARCH_DESIGN_ONLY / NOT_AUTHORIZED_TO_EXECUTE

이 문서와 동명 JSON은 H1/H2/H3의 독립 연구 계약을 사전 등록한다. 모델 구현, 계수 적합, parameter search, Backtest, Forward 실행은 하지 않았다. 구체 알고리즘은 후속 design freeze 대상이다. **이 protocol의 승인만으로 실험을 실행할 수 없다.**

## 1. Frozen baseline과 연구 질문

Baseline은 `football-poisson-research-v1`이다. source SHA256(LF 정규화)은 `6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf`다. 기존 EPL/La Liga/Serie A/Bundesliga sealed evidence의 1,342 PREDICTED, actual DRAW 348, DRAW predictions 5, correct DRAW 2와 `DRAW_FAILURE_TYPE=ARGMAX_COMPETITION`을 그대로 유지한다.

[기존 구조적 실패 review](FOOTBALL_DRAW_STRUCTURAL_FAILURE_REVIEW_V1.md)는 argmax 경쟁 현상을 입증했지만 독립 Poisson, goal-rate 산식, shrinkage/league baseline 또는 calibration의 인과 기여도를 확정하지 않았다. 이번 protocol은 그 결론을 수정하거나 새 수치로 재해석하지 않는다.

질문은 **“DRAW 선택 수를 인위적으로 늘리는 대신, 득점분포 또는 확률 추정 구조를 바꾸면 전체 multiclass probability quality가 개선되는가?”**다. DRAW recall은 보조 지표다. 확률이 개선돼도 DRAW argmax가 드물 수 있으며, 그 자체를 실패로 재정의하지 않는다.

## 2. 세 개의 독립 가설

**H1 — LOW-SCORE DEPENDENCE MODEL (기존 DRAW-H1).** 0–0, 1–1 등 저득점 joint dependence를 허용하는 구조를 검토한다. Dixon–Coles 계열은 예시이며 이번에 채택하지 않는다. v1 marginal rate 추정과 argmax는 고정하고 dependence만 분리한다. Development의 chronological rate/score evidence로만 dependence 계수를 적합하고 evaluation 전 고정한다. 기대 효과는 joint 및 multiclass 확률 개선 가능성이다. 상관 부재·비정상 확률 질량·HOME/AWAY 손상·과적합으로 반증될 수 있다. 기존 review는 이 mechanism의 존재를 입증한 것이 아니다.

**H2 — GOAL-RATE ESTIMATION V2 (기존 DRAW-H2).** team attack/defence, league baseline, venue effect, regularization/shrinkage를 포함하는 별도 marginal-rate 추정 구조를 설계한다. 독립 Poisson 분포와 argmax를 유지하며 H1/H3를 넣지 않는다. estimator와 hyperparameter는 evaluation 전 고정하고, evaluation 중 team/rate state는 매 cutoff의 동일한 causal history로만 갱신할 수 있다. 기존 rate가 과대 추정됐다는 결론은 없다. 희소 표본·부정확한 수축·비무승부 확률 악화가 위험이다. DRAW를 늘리기 위한 임의 lambda 축소는 허용하지 않는다.

**H3 — MULTICLASS CALIBRATION (기존 DRAW-H3).** v1 raw probability vector 뒤에 하나의 사전 등록된 multiclass calibration layer를 검토한다. 세 class에 같은 설계 원칙을 적용하며 DRAW 전용 offset/multiplier/threshold는 금지한다. Development의 out-of-time probability/label 쌍으로만 적합하고 evaluation 전 고정한다. Predictor를 전체 development label로 적합한 뒤 같은 경기의 in-sample 확률을 calibration 입력으로 쓰지 않는다. reliability/log loss 개선 가능성과 함께 표본 부족·해상도 손실·누수를 검증한다. Calibration 개선이 DRAW recall 증가를 보장하지 않는다.

각 가설의 data requirement, held-fixed 요소, 기대 효과, 반증 조건과 위험은 JSON에 고정했다. Mechanism-specific diagnostics의 정확한 산식도 후속 design freeze에 반드시 명시한다. 해당 진단은 primary 실패를 뒤집는 승자 기준이 될 수 없다.

## 3. Development / evaluation split

**Development = provider season 2023, 즉 2023/24의 기존 FT regular-season 1,446경기. Evaluation = provider season 2024, 즉 2024/25의 기존 FT regular-season 1,446경기.** Provider season과 stage로 선택하며 승패·DRAW 여부·성능을 보고 분할하지 않는다. 두 target ID 집합의 교집합은 0이다.

- EPL: development 380 / evaluation 380; fixed primary 353, 기존 PASS 27.
- La Liga: development 380 / evaluation 380; fixed primary 352, 기존 PASS 28.
- Serie A: development 380 / evaluation 380; fixed primary 351, 기존 PASS 29.
- Bundesliga: development 306 / evaluation 306; fixed primary 286, 기존 PASS 20.

Regular Season round 1..38(39/140/135), 1..34(78)을 사용한다. Bundesliga Relegation Round는 이미 고정된 [cross-league scope](../scripts/football-cross-league-scope-v1.ts)를 계승해 제외한다. 원본 archive에서 제거하거나 그 당시 completeness 판정을 바꾸지 않는다. Provider season 2023에 속한 지연 경기는 달력상의 일반적인 시즌 종료일로 잘라내지 않는다.

Development 내부 경계는 **2024-01-01T00:00:00.000Z**다. 경계 전 fit target / 경계 이후 check target은 EPL 196/184, La Liga 180/200, Serie A 180/200, Bundesliga 143/163이다. 이는 목표 경기 inventory이며 실제 학습 가능 벡터 수가 아니다. 초기 warmup 부족은 PASS로 남기고, 경계 전에 48시간 research lag를 충족하지 못한 label은 초기 fit에 넣지 않는다. 내부 check를 보고 변형 모델을 선택하거나 search를 늘리지 않는다. 이후 동일한 사전 등록 estimator를 전체 development의 사용 가능한 out-of-time 예제로 최종 적합한다. 모든 fit label은 해당 리그 첫 evaluation cutoff 전에 사용 가능해야 한다.

**2024/25는 이미 구조적 실패 review에 노출된 평가셋이다.** 이번 evaluation의 역할은 `EXPOSED_RETROSPECTIVE_COMPARISON`이며 untouched holdout이 아니다. 이 노출은 과거에 발생했으므로 문서 봉인으로 없어지지 않는다. V2 실행 전에 가설을 등록하는 것이지, 문제 발견 이전의 confirmatory study라고 주장하지 않는다. 현재 archive만으로 독립 미사용 최종 평가가 마련됐다는 판정은 하지 않는다. 실제 promotion에는 별도 미열람 cohort·prospective protocol·CTO 승인이 필요하며 이번에는 새 cohort를 조회하거나 수집하지 않는다.

JSON의 `cohortManifest`에 리그별 archive hash, 두 시즌 target ID hash, fit/check hash, baseline PREDICTED/PASS ID hash와 날짜 범위를 기록했다. ID hash는 kickoffUtc → numeric fixture ID 순서의 ID 배열을 compact JSON으로 직렬화한 SHA256이다. 원본 fixture payload나 결과 행을 Git에 추가하지 않는다.

## 4. 시간·리그 누수 방지

기존 chronological 계약을 계승한다: cutoff=target kickoff−1ms, same-league 365-day lookback, distinct fixture identity, `derivedResearchAvailableAt=prior kickoff+48h < cutoff`. 동일 kickoff 그룹은 동일한 immutable eligible history를 사용한다. Target의 score/result는 pregame 객체에 없고, prediction/PASS 봉인 이후에만 평가용으로 join한다.

48시간은 **retrospective 연구 가정**이며 실제 종료·관측 증거가 아니다. Archive의 providerFetchedAt/resultCompletedAt/observedAt를 덮어쓰거나 과거 실제 관측으로 위장하지 않는다. strictReplayEligible=false를 유지한다. 신뢰할 만한 반대 완료 증거가 있으면 영향받은 실험을 invalid로 남기고 별도 protocol로 다룬다. 결과에 유리한 경기만 삭제하지 않는다.

Development에는 season 2023만 사용하고 2022를 추가 수집하거나 warmup을 합성하지 않는다. Evaluation에서는 season 2023 및 cutoff 전에 eligible인 season 2024 history를 쓸 수 있다. **이전 evaluation 경기 결과의 고정된 causal state 갱신**과 **evaluation 성능을 보고 모델을 선택·튜닝하는 것**을 구분한다. H1/H3의 학습된 변환 계수는 evaluation 중 재적합하지 않는다. H2는 고정된 estimator/hyperparameter 아래에서만 eligible history로 rate state를 재적합한다. 리그 간 history·calibration label·team fitting을 합치지 않는다.

## 5. 실험 순서와 실행 전 gate

순서는 **Frozen v1 reference → H1 alone → H2 alone → H3 alone**이다. H1/H2/H3를 결합하지 않고 성공·실패·수렴 실패를 전부 보고한다. 먼저 좋아 보이는 결과를 본 뒤 다음 가설의 설계를 고치지 않는다.

각 H에 **하나의 specification, hyperparameter search trial 0개**를 등록한다. 미래의 고정 estimator 내부 계수 fitting과 hyperparameter search는 구별한다. 이번에는 둘 다 수행하지 않는다. 세 가설의 구체 algorithm, 고정 hyperparameter, objective/constraints, initialization/seed, 수렴 한도, class sample gate, failure/PASS 규칙, grid/normalization 및 mechanism diagnostic을 **어떤 새 development/evaluation 결과도 보기 전에 함께 봉인**해야 한다. 이번 미션에서 빠진 알고리즘 세부 선택은 이 gate가 막는다. 이를 실행 가능한 완성 모델 명세라고 보고하지 않는다.

후속 design freeze와 별도 CTO 실행 승인이 필수다. Evaluation 전 candidate source hash, 최종 development parameter hash, cohort/input/protocol hash와 development report를 봉인한다. 기존 v1 sealed 결과를 comparator로 사용하며 v1 산식이나 결과 파일을 재작성하지 않는다. 버그/누수/identity/hash mismatch 또는 nonfinite 확률을 발견하면 중단하고 새 version으로 기록한다. 사후 threshold, cohort, metric, parameter search 또는 실패 가설의 의미를 바꾸지 않는다.

## 6. 공통 평가와 PASS

Primary는 **multiclass Log Loss와 unscaled multiclass Brier Score**다. Log Loss는 자연로그와 scoring-only floor 1e−15를 쓰고 floor-hit 수를 보고한다. Brier는 세 class squared error 합의 평균(범위 0..2)이다. 확률 자체를 floor 값으로 바꾸지 않는다.

Primary paired population은 기존 v1 PREDICTED **1,342개 ID**로 고정한다. 모든 candidate가 같은 ID 전부에 유효 확률을 내야 한다. Candidate PASS/오류를 제외해 유리한 subset을 만들면 비교가 invalid다. 전체 1,446 target과 기존 104 PASS는 계속 보존한다. 그 104개에서 새로 생성되는 candidate 확률은 coverage 및 별도 descriptive 분석만 가능하며 primary 분모에 넣지 않는다.

Secondary는 accuracy, DRAW recall/precision, DRAW count/share, HOME/AWAY recall/precision 및 one-vs-rest Brier, class calibration과 PASS coverage다. Tie order는 HOME→DRAW→AWAY의 기존 argmax다. Calibration은 각 리그·class별 0.1 간격 10개 bin, 마지막 bin에 1 포함, n<20 표시, 빈 bin mean/frequency=null을 고정한다. ECE는 bin 비중×절대 reliability gap의 합이다. 분모 0은 null이며 무조건 0으로 대체하지 않는다.

리그별 독립 결과를 모두 보고한다. 새로운 pooled accuracy나 league-weighted winner score는 만들지 않는다. 비교는 반올림 전 binary64 값으로 한다. 이 노출된 시즌에서는 유의성·독립 일반화·인과적 확정 주장을 하지 않는다.

## 7. 수치화한 promotion / research-screen 규칙

**이번 evaluation에서 실제 PROMOTE=NO는 고정이다.** 다음 조건을 모두 만족할 때만 `ELIGIBLE_FOR_INDEPENDENT_CONFIRMATION_ONLY`라고 기록할 수 있다.

1. 네 리그 **각각**에서 candidate Log Loss < baseline−1e−12이고 Brier < baseline−1e−12여야 한다. 어느 리그든 하나가 악화되거나 개선되지 않으면 screen=NO다. DRAW recall로 상쇄하지 않는다.
2. 고정 primary ID 전부를 평가하고, 각 리그 paired n≥200 및 실제 각 class n≥20을 충족해야 한다. Integrity 오류는 INVALID, 표본 부족은 INSUFFICIENT다.
3. 각 리그에서 전체 accuracy 및 HOME/AWAY 각 recall의 감소는 절대 0.02(2%p) 이하이며, HOME/AWAY 각 one-vs-rest Brier는 악화되지 않아야 한다.
4. 각 리그·각 class ECE 증가는 절대 0.01(1%p) 이하여야 한다. 필요한 guard 값이 unknown이면 통과하지 않는다. 경계 비교의 부동소수점 허용오차는 1e−12다.

이 수치는 실험 전에 선택한 평가 guardrail이며 모델 threshold/weight나 통계적 검정력 보장이 아니다. 엄격한 전 리그 probability gate로 한 리그의 개선이 다른 리그의 악화를 가리지 못하게 한다. 통과한 가설이 여러 개여도 임의 승자를 선정하거나 결합하지 않는다. 독립 미사용 cohort를 위한 새 protocol 및 별도 CTO 판단 이전에는 Forward 적용·VALIDATED_MODEL 승격이 없다.

## 8. Firewall / 검증 / handoff

미래 v2 출력은 `data/cache/research/football/poisson-v2-draw-research/protocol-v1/<hypothesis>/<league>/<run>/`의 독립 LOCAL_ONLY namespace로 제한한다. 현재 Forward model은 계속 v1이며 runner, policy, input/snapshot/grade/scorecard를 변경하지 않는다. Forward 데이터를 이번 historical study에 혼합하지 않는다. Odds, market consensus, betting lines, provider prediction, owner/private/manual, external shadow는 입력 금지다. Market comparison도 별도 승인된 post-seal 작업만 가능하다.

이번 검증은 JSON parse·protocol rule 일관성, 기존 archive/result/model hash, fixture metadata membership와 split disjointness만 확인했다. 모델 import/계수 fitting/확률 재생성/성능 재계산/네트워크 호출은 0이다. Source archive 4개와 기존 result 2개의 hash를 확인했다. 기존 review와 Forward 코드도 변경하지 않았다. 기존 untracked access-gate 문서는 보존하고 이 MD/JSON 두 파일만 commit한다.

Cursor/CTO 다음 미션은 **세 가설의 구체 design freeze**다. 이 protocol과 동명 JSON, 기존 review를 읽고 immutable cohort hashes를 먼저 확인한다. 알고리즘과 coefficient-estimation 세부 명세를 봉인하기 전에는 개발 표본을 대상으로도 모델을 실행하지 않는다. 결과가 나쁘다는 이유로 이 protocol을 수정하지 않는다. main merge와 watch 시작은 이번 작업에 없다.

PROTOCOL_SHA256 = `0299f98fd28d1c3f4dc1c5153c5ddb6d614da6f0fbff09be295d68de51cfc69f`

Hash 대상은 동명 JSON 전체의 canonical UTF8 JSON이며 object key 재귀 정렬, array 순서 보존, 공백/마지막 newline 없음이다.

MODEL_CHANGED=NO; ENGINE_CHANGED=NO; FORWARD_V1_CHANGED=NO; FORWARD_MODEL_CHANGED=NO; BACKTEST_EXECUTED=NO; V2_IMPLEMENTED=NO; PARAMETER_TUNING=NO.

FOOTBALL_POISSON_V2_DRAW_RESEARCH_PROTOCOL_V1_READY_FOR_CTO_REVIEW

STOP.
