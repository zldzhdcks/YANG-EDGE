# RESEARCH_POLICY

Version: 1.0.0
Status: OFFICIAL

## 목적

이 문서는 YANG EDGE의 공식 연구 정책을 정의한다.
모든 Dataset, Prediction, Review, Backtest, Engine 개발은 본 정책을 따른다.

본 문서는 PROJECT_CONSTITUTION과 함께 최상위 정책 문서이며 사용자 승인 없이 변경하지 않는다.

---

# 1. 연구 철학

YANG EDGE의 목표는 높은 적중률이 아니라 **검증 가능하고 재현 가능한 스포츠 연구 플랫폼**을 구축하는 것이다.

연구는 다음 원칙을 따른다.

- 설명 가능성(Explainability)
- 재현성(Reproducibility)
- 데이터 무결성(Data Integrity)
- 데이터 누수 방지(Leakage Prevention)
- 충분한 표본(Sufficient Sample)
- 근거 기반 Engine 개선(Evidence-based Engine)

---

# 2. 공식 연구 사이클

Prediction
→ Save Snapshot
→ Official Result
→ Auto Grade
→ Success Review
→ Failure Review
→ Input Audit
→ Leakage Audit
→ Hypothesis Validation
→ Sample Accumulation
→ Backtest
→ Engine Approval

Engine은 반드시 마지막 단계에서만 변경한다.

---

# 3. 연구 우선순위

1. 데이터 품질
2. 입력 검증
3. Leakage Audit
4. Dataset 누적
5. Hypothesis 검증
6. Backtest
7. Engine 변경

UI 개선이나 새로운 기능보다 연구 품질을 우선한다.

---

# 4. 데이터 누수 정책

금지 항목

- 결과 데이터를 Prediction 입력으로 사용
- Target 경기 통계 사용
- cutoff 이후 데이터 사용
- 라이브 확정 정보 사용
- 사후 정보를 사전 Feature로 사용
- Review 결과를 Prediction 입력으로 사용

Leakage가 확인되면 해당 연구는 INVALID 처리한다.

---

# 5. Hypothesis 정책

모든 아이디어는 Hypothesis 상태로 시작한다.

상태

- PROPOSED
- COLLECTING
- PROMISING
- VALIDATED
- REJECTED

PROMISING은 Engine 승인 상태가 아니다.

---

# 6. Sample 정책

단일 경기로 결론을 내리지 않는다.

충분한 표본 확보 후

- Success
- Failure
- False Positive
- False Negative

를 함께 분석한다.

---

# 7. Backtest 정책

Backtest는 실제 Prediction과 동일한 조건으로 수행한다.

금지

- 미래 정보 사용
- 결과 기반 Feature 생성
- 임의 데이터 보정

---

# 8. Engine 변경 정책

변경 조건

- Leakage 0
- Input Audit PASS
- Sample 충분
- Backtest PASS
- Review 완료
- 사용자 승인

자동 Engine 변경은 금지한다.

---

# 9. Dataset 정책

각 Dataset는 다음을 관리한다.

- 목적
- Source
- schemaVersion
- generatedAt
- cutoffTime
- inputHash
- qualityWarnings

---

# 10. Review 정책

모든 Prediction은

- Success Review
- Failure Review

를 모두 수행한다.

성공 사례도 반드시 분석한다.

---

# 11. 연구 결과 등급

VERIFIED

실제 검증 완료

REPORTED_NOT_VERIFIED

보고만 완료

UNKNOWN

확인 불가

INVALID

Leakage 또는 연구 오류

---

# 12. 문서 갱신

새로운 연구 정책이나 Engine 승인 기준이 변경되면 본 문서를 갱신한다.

단순 Dataset 추가나 진행 상황은 `PROJECT_STATUS_v1.0.md`에 기록한다.

---

# 최종 원칙

Engine은 연구의 결과이다.

연구 없이 Engine을 수정하지 않는다.

근거 없는 가설은 구현하지 않는다.

모든 연구는 미래의 AI와 개발자가 동일한 결과를 재현할 수 있어야 한다.
