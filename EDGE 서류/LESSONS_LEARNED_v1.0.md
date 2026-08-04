# LESSONS_LEARNED

Version: 1.0.0

## 목적

이 문서는 YANG EDGE 프로젝트에서 얻은 성공 사례, 실패 사례, 연구 결과, 운영 교훈을 장기적으로 기록하는 공식 문서이다.

같은 실수를 반복하지 않고, 검증된 경험을 프로젝트 자산으로 축적하는 것을 목표로 한다.

---

# 분류

- SUCCESS
- FAILURE
- RESEARCH
- QA
- ARCHITECTURE
- OPERATION
- LEGAL

---

# LESSON-001

분류:
ARCHITECTURE

제목:
Prediction은 Consumer여야 한다.

교훈:
Prediction에서 Builder를 호출하면 구조가 복잡해지고 데이터 누수 위험이 커진다.

결론:
Producer와 Consumer를 명확히 분리한다.

상태:
ADOPTED

---

# LESSON-002

분류:
RESEARCH

제목:
단일 경기로 Engine을 수정하지 않는다.

교훈:
짧은 기간의 적중률은 충분한 증거가 아니다.

결론:
충분한 표본과 Backtest 이후에만 Engine을 변경한다.

상태:
ADOPTED

---

# LESSON-003

분류:
QA

제목:
Build PASS는 완료의 일부일 뿐이다.

교훈:
실행, 검증, 문서화가 함께 완료되어야 진정한 완료이다.

상태:
ADOPTED

---

# LESSON-004

분류:
LEGAL

제목:
합법적인 데이터 수집이 최우선이다.

교훈:
무단 크롤링보다 공식 API와 라이선스를 우선한다.

상태:
ADOPTED

---

# LESSON-005

분류:
OPERATION

제목:
프로젝트 기억은 문서가 담당한다.

교훈:
채팅 기억이 아닌 Git, Documentation, Artifact가 공식 기억이다.

상태:
ADOPTED

---

# 신규 Lesson 기록 규칙

필수 항목

- Lesson ID
- 날짜
- 분류
- 제목
- 상황
- 교훈
- 재발 방지
- 적용 여부

---

# 활용 규칙

새로운 기능을 설계하기 전 이 문서를 확인한다.

과거 실패와 동일한 실수를 반복하지 않는다.

성공 사례도 반드시 기록한다.

---

# 문서 갱신

연구 완료, 주요 버그 수정, 아키텍처 변경, 운영 개선 시 새로운 Lesson을 추가한다.

기존 Lesson은 삭제하지 않고 누적 관리한다.
