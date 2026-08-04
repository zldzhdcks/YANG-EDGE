# DECISION_LOG

Version: 1.0.0

## 목적

이 문서는 YANG EDGE 프로젝트에서 내려진 중요한 기술적·운영적 의사결정을 기록하는 공식 문서이다.

결정의 이유와 대안을 함께 기록하여 동일한 논의를 반복하지 않도록 한다.

---

# 상태

- PROPOSED
- ACCEPTED
- REJECTED
- SUPERSEDED

---

# DECISION-001

제목:
Prediction은 Consumer로 유지한다.

상태:
ACCEPTED

이유:
Prediction 단계에서 Builder 실행 시 데이터 누수와 구조 혼합 위험이 증가한다.

대안:
Prediction에서 Provider 직접 호출

결론:
채택하지 않음.

---

# DECISION-002

제목:
Engine 변경은 연구 완료 후 수행한다.

상태:
ACCEPTED

이유:
단기 적중률보다 검증 가능한 연구를 우선한다.

조건:
- Leakage 0
- 충분한 표본
- Backtest
- 사용자 승인

---

# DECISION-003

제목:
Artifact 중심 구조 유지

상태:
ACCEPTED

이유:
재현성과 감사 가능성을 확보하기 위함.

---

# DECISION-004

제목:
공식 API 우선

상태:
ACCEPTED

이유:
법적 리스크 최소화

대안:
무단 크롤링

결론:
채택하지 않음.

---

# DECISION-005

제목:
문서 중심 프로젝트 운영

상태:
ACCEPTED

이유:
채팅 기억에 의존하지 않기 위함.

공식 기억

- Git
- Documentation
- Artifact

---

# 신규 결정 기록

필수 항목

- Decision ID
- 날짜
- 제목
- 배경
- 대안
- 선택 이유
- 영향
- 상태

---

# 변경 규칙

기존 결정을 삭제하지 않는다.

새로운 결정으로 대체되면

SUPERSEDED

상태를 사용한다.

---

# 참고 문서

- PROJECT_CONSTITUTION.md
- CURRENT_ARCHITECTURE.md
- RESEARCH_POLICY.md

본 문서는 프로젝트의 기술적 의사결정 이력을 영구 보존한다.
