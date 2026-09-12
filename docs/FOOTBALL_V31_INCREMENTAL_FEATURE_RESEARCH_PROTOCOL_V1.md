# FOOTBALL V31 INCREMENTAL FEATURE RESEARCH PROTOCOL V1

**PROTOCOL ONLY.** V3.1 연구 질문과 범위를 사전등록한다. 알고리즘 선택·구현·fitting·backtest·2025 holdout 분석을 승인하지 않는다.

BASE_SHA = 4c92f7ce89c9ebf7a682199181f084f75f889681

BRANCH = agent/astra/football-historical-source-gate-v1

Protocol canonical-payload SHA256 = `04d7a0029d70c031fcc3fcb443dca56c6a08f7d1c64c5051570af4dd4117ebfb`

[Machine-readable protocol](FOOTBALL_V31_INCREMENTAL_FEATURE_RESEARCH_PROTOCOL_V1.json)에 동일한 계약, 선행 evidence hashes, 기존 promotion rule 원문을 보존한다. Hash는 payload의 object key를 재귀 정렬하고 배열 순서를 유지한 compact UTF-8 JSON의 SHA256이며 envelope sha256은 제외한다.

## PRIMARY_RESEARCH_QUESTION

Do xG / Shots / SOT contain predictive information incremental to the frozen H2 attack/defence goal-rate structure, rather than mostly re-expressing the same underlying team strength?

H2가 이미 설명하는 팀 강도 성분을 분리한 뒤에도 과거 공격 과정 데이터에 추가적인 1X2 probability signal이 남는가?

H2가 표현한 팀 강도와 구별되는 공격 과정 정보가 있는지 묻는다. 단순 상관 감소가 추가적인 예측 정보의 존재를 증명하지는 않는다. 수학적 구별 가능성과 실제 probability quality를 별도로 확인해야 한다.

## PRIOR_EVIDENCE

다음 자료를 read-only로 확인하고 canonical hash를 검증했다. 2025는 committed metadata만 읽었다.

- docs/FOOTBALL_V3_FEATURE_RESEARCH_PROTOCOL_V1.json — 0b30bc4d41684f2797d0a8e0a2a53694ecc6d5dc8f151b45213af1f1f9dc1bb8
- docs/FOOTBALL_V3_FEATURE_ALGORITHM_DESIGN_FREEZE_V1.json — 04803e9b26acfd43de263c9b52c575ed2231d91984f82877da5e63b0cde6207a
- data/audits/football-v3-feature-development-v1.json — b1197bfaa895a9bf9893e9c6f1df817e687fff94ecc9d54cea958de6c004f2e8
- data/audits/football-v3-feature-2024-exposed-check-v1.json — 3cb3c4f907f8c493043660b2a6ffd018b378021d6e6adfc736eea48a0ce427da
- data/audits/football-v3-phase1-diagnostic-review-v1.json — 1d6b4219774c9e58a0421cc5b91eb5cb0b985a36a143397ebba58fe0b89d9b12
- data/audits/football-v3-2025-independent-holdout-cohort-seal-v1.json — 7924420956e419af1a7f14b8b2eb520cc55d37b46534736d35b0fbdcf51c2581
- data/audits/football-v3-feature-source-freeze-v1.json — 9b77401cc2f3c828f58a3018367985edb8c4e8ee4bd005467ff694e1e8192091

Phase-1의 모든 후보는 2024 LL/Brier를 v1 대비 개선했다. H2 대비 EPL은 F1/F2/F3 개선, La Liga는 F2/F3 개선·F1 악화, Serie A와 Bundesliga는 모두 악화했다. Fitted covariates의 높은 상관과 H2 overlap PARTIALLY_SUPPORTED가 관측됐다. 계수 이동/부호 반전이나 correction magnitude만으로 성공·실패를 설명할 수 없었고 DRAW recall 문제도 남았다.

이 사실은 질문의 동기다. V3.1의 예상 개선치, candidate 선택 결과, 원인 확정 또는 F2 winner 선언으로 사용하지 않는다. V3.1은 Phase-1 결과를 본 뒤 등록한 연구이며 2024 데이터의 기존 노출을 숨기지 않는다.

## Feature scope / ALLOWED_REPRESENTATION_FAMILIES / CANDIDATE_LIMIT

Feature family는 xG(expected_goals), Total Shots, Shots on Goal만 유지한다. 새 외부 feature는 추가하지 않는다. rest/congestion은 별도 Phase-2, lineups/injuries/suspensions는 V4다.

- R1: H2-CONDITIONAL RESIDUAL REPRESENTATION.
- R2: LEAGUE-RELATIVE FEATURE INNOVATION REPRESENTATION.
- R3: LOW-DIMENSIONAL CORRELATED-FEATURE REPRESENTATION.

위 세 항목은 향후 설계에서 검토할 수 있는 family이며 실행 candidate가 아니다. **MAX_V31_CANDIDATES = 2**. 현재 선택된 candidate는 0개다. 결과에 맞춰 후보를 늘리거나 수십 개의 변형을 시험할 수 없다.

이번에는 정확한 수식, residual estimator, dimension reduction method, coefficient 수, hyperparameter, fitting 방식을 정하지 않는다. PCA·clipping·orthogonalization·regression residual 등 특정 방법을 자동 채택하지 않는다. 이름에 residual 또는 low-dimensional이 포함되어 있어도 그 구현법을 선택한 것이 아니다.

## Required properties and league firewall

Frozen H2 backbone과 v1/H2 comparator를 유지한다. 공식 Forward 모델은 계속 football-poisson-research-v1이다. H2는 SCREEN_NO인 미승격 연구 backbone이며 이번 프로토콜로 상태가 바뀌지 않는다.

Target own stats·target result·미래 데이터·market/odds·provider prediction·owner/external shadow를 prediction 입력으로 사용하지 않는다. 모든 representation 학습과 적용에 same-league temporal isolation이 필요하다. H2가 설명한 성분을 분리한다는 주장을 수학적으로 설명해야 하며 target 또는 미래 정보를 이용해 변환을 학습해서는 안 된다.

등록된 각 candidate의 한 specification을 4리그에 동일하게 적용한다. EPL/La Liga/Serie A/Bundesliga 결과에 맞춘 별도 formula는 금지다. 리그별 parameter fitting은 향후 설계에서 허용할 수 있으나 여기서 방법을 결정하지 않는다. 기존 모델 source/beta는 변경하지 않는다.

## DEVELOPMENT_SPLIT / COMPARATORS

- 2023/24, providerSeason=2023: PRIMARY DEVELOPMENT.
- 2024/25, providerSeason=2024: EXPOSED DEVELOPMENT CHECK. Untouched holdout이 아니다.
- 기존 4대리그 Regular Season cohort 역할을 유지하고 결과 기반 cohort 추가·제거는 하지 않는다.

V3.1의 구조·설계는 실행 전에 고정하며 V3.1 2024 결과를 본 뒤 변경하지 않는다. 2023/2024 단계에서 promotion 판단은 금지다.

필수 비교는 A=football-poisson-research-v1, B=frozen H2다. C=corresponding Phase-1 candidate는 논리적으로 비교 가능할 때만 reference로 둔다. R1을 F1에 자동 대응시키지 않는다. 대응 근거는 실행 전에 설계에 기록하고 비교 불가능하면 NOT_APPLICABLE로 남긴다. Promotion 필수 comparator는 계속 V1+H2다.

리그/candidate별 paired IDs·분모·전체 coverage·PASS·missingness를 보고한다. 비교 가능한 subset을 전체 cohort로 표현하거나 pooled winner score를 만들지 않는다. 정확한 pairing 및 실행 규약은 Design Freeze에서 명시해야 한다.

## HOLDOUT_FIREWALL

기존 sealed 2025/26(providerSeason=2025), **1,446경기**를 독립 holdout으로 보존한다. 현재 허용은 committed seal metadata/hash 확인뿐이다. Raw feature magnitude, score/result, prediction/probability, metric 접근·생성·계산은 금지다.

V3.1 Protocol → Algorithm Design Freeze → frozen implementation/tests → 2023 Development → 2024 exposed check가 모두 완료되기 전 2025 평가 승인은 불가하다. 완료 후에도 numeric promotion rule 재봉인, integrity/exposure 확인 및 별도 명시적 CTO 승인이 필요하다. 이 문서는 어느 실행 단계도 자동 승인하지 않는다.

## DRAW_FIREWALL

DRAW_RESEARCH_SEPARATED = YES. DRAW structural problem은 별도 연구다. V3.1은 incremental attacking-process signal을 검증한다.

금지: draw multiplier, draw intercept, draw threshold, draw-specific coefficient, Dixon-Coles 결합, class-specific post-hoc calibration. DRAW metric은 관찰하되 이를 고치기 위한 별도 장치를 이번 연구에 넣지 않는다.

## METRICS / SUCCESS_QUESTIONS

Primary는 Multiclass Log Loss와 Multiclass Brier다. Secondary는 accuracy, HOME/DRAW/AWAY recall·precision·class shares, OVR Brier, per-class ECE다. 추가 diagnostic은 representation–H2 correlation, cross-feature correlation, contribution magnitude, coefficient stability다.

아래 네 질문은 descriptive research questions이며 새로운 promotion threshold가 아니다.

1. H2와의 정보 중복이 감소했는가?
2. 리그별 feature effect 방향의 이질성이 감소했는가?
3. Phase-1보다 H2 대비 LL/Brier가 더 일관되게 개선되는가?
4. Class-level degradation이 감소했는가?

Correlation, ECE, proper scores를 같은 의미로 해석하지 않는다. 정확한 통계/metric 계산 규약은 결과 접근 전에 설계에서 고정한다. 새로운 수치 성공 기준은 이번에 만들지 않는다.

## PROMOTION_GOVERNANCE

기존 Phase-1 Algorithm Design의 promotion object를 companion JSON에 원문 보존했다. 해당 object canonical SHA256 = `9bb0ccd9917f3049ec740617caf86d06787ab8d46ced235c442844adf1639f7f`.

V3.1 Design Freeze에서 기존 규칙을 그대로 재사용하거나 더 엄격하게만 할 수 있다. 자동 폐기·완화 및 결과 후 완화는 금지다. 2025를 열기 전에 V3.1 numeric promotion rule을 반드시 다시 봉인해야 한다. 이번 프로토콜은 기존 수치 규칙을 변경하거나 V3.1 최종 채택을 대신하지 않는다.

기존 규칙의 보호 수준은 다음과 같다(읽기 전용 참조).

- 각 candidate, 4리그 모두, 두 comparator 각각에 ΔLL < −1e−12 및 ΔBrier < −1e−12.
- 각 class recall Δ ≥ −0.05−1e−12; ECE Δ ≤ 0.01+1e−12; OVR Brier Δ ≤ 1e−12.
- U≥100, U/N≥80%, candidate의 U prediction coverage=100%, 전체 ID 보존, FAIL/INVALID=0, U의 실제 3개 class 존재.
- 필수 recall/ECE null 또는 primary probability 누락은 INSUFFICIENT. Precision null은 보고하며 별도 promotion guard가 아니다.
- 모두 통과해도 ELIGIBLE_FOR_CTO_PROMOTION_REVIEW일 뿐 자동 승격·winner 선택·ensemble·Forward 전환은 없다.

원문에 있는 F1/F2/F3 열거는 과거 Phase-1 계약이며 V3.1 후보 3개를 허용한다는 뜻이 아니다. V3.1은 최대 2개이고 사전등록된 모든 후보에 같은 규칙을 적용한다.

## Feature-selection and provenance firewall

2024 결과만 보고 xG·Shots·SOT를 삭제하지 않는다. Family 축소가 필요하다면 Phase-1 redundancy rationale와 사전 Protocol 논리로 정당화하고 Design Freeze 전에 결정해야 한다. 현재는 어떤 축소도 선택하지 않았다. V3.1 2024 결과 이후 feature 삭제는 금지다.

Historical evidence는 retrospective final/revised data이며 strictReplayEligible=false다. 과거 observedAt을 소급 생성하지 않는다. Phase-1 temporal/fitting 상세는 읽기 전용 선행 계약이다. V3.1의 정확한 representation 학습/변환 chronology, availability, missingness는 별도 Design Freeze에서 명시하고 암묵적 기본값으로 구현하지 않는다.

Raw는 LOCAL_ONLY. LEGAL_INTERNAL_USE=CONDITIONAL, PUBLIC_RAW_FEATURE_DISPLAY=UNRESOLVED, COMMERCIAL_PUBLIC_RIGHTS=UNRESOLVED를 유지한다. Provider dashboard Chat AI 안내를 사람 support 확인 또는 정식 license로 승격하지 않는다. 이번에는 API 조회를 하지 않았다.

## Verification / handoff

7개 선행 JSON canonical hash, 12개 V3 source, 21개 dependency, 644개 protected file hash를 before/after 검증했다. 기존 beta와 결과는 protected seals를 통해 보호했다. 기존 untracked access-gate 문서의 byte hash도 유지했다. 검증은 문서 구조·hash·governance에 한정하며 fitting/backtest runner를 실행하지 않았다.

다음 작업은 별도 V3.1 Algorithm Design Freeze 미션이다. 최대 두 candidate 정의, incremental-information 수학적 근거, 동일 cross-league 구조, causal transform/fitting·missingness·comparator pairing·metrics 규약, unchanged-or-stricter numeric promotion rule과 source/input/parameter seal 순서를 명시해야 한다. 미정 알고리즘을 임의로 채워 구현하지 않는다. 2025 접근은 모든 선행 단계와 별도 CTO 승인 전까지 계속 금지다.

V31_IMPLEMENTED = NO

V31_FITTING_EXECUTED = NO

V31_BACKTEST_EXECUTED = NO

V3_PHASE1_CHANGED = NO; V2_H2_CHANGED = NO; FORWARD_V1_CHANGED = NO

2025_HOLDOUT_PREDICTIONS_GENERATED = NO

2025_HOLDOUT_METRICS_VIEWED = NO

2025_HOLDOUT_METRICS_COMPUTED = NO

FOOTBALL_V31_INCREMENTAL_FEATURE_RESEARCH_PROTOCOL_V1_READY_FOR_CTO_REVIEW

STOP.
