# KNOWN_ISSUES

Version: 1.0.0

## 목적

이 문서는 YANG EDGE 프로젝트에서 확인된 문제점, 기술 부채, 위험 요소를 관리하는 공식 문서이다.

완료되지 않은 문제는 삭제하지 않고 상태를 변경하며 관리한다.

---

# 상태 정의

- OPEN
- INVESTIGATING
- BLOCKED
- MITIGATED
- RESOLVED
- SUPERSEDED

---

# ISSUE-001

제목:
Doubleheader internalGameId 중복 가능성

상태:
OPEN

영향:
- Prediction 매칭 오류
- Review 오류
- Artifact 충돌

우선순위:
HIGH

---

# ISSUE-002

제목:
Dataset 표본 부족

상태:
OPEN

영향:
- 연구 신뢰도 저하
- Engine 반영 불가

우선순위:
HIGH

---

# ISSUE-003

제목:
Weather Dataset 미구현

상태:
PLANNED

영향:
환경 변수 연구 불가

우선순위:
MEDIUM

---

# ISSUE-004

제목:
Travel Dataset 미구현

상태:
PLANNED

영향:
원정 피로도 연구 불가

우선순위:
MEDIUM

---

# ISSUE-005

제목:
MLB official lineup availability near first pitch

상태:
OPEN

발견일:
2026-07-31

발견 위치:
Remaining Pregame Accumulation (`runId` 2026-07-31T00-53-46-838Z)

영향:
- Eligible 3경기 모두 lineup NOT_RELEASED (~47–77분 전)
- Prediction inputStatus LIMITED_INPUT
- Official eligible prediction 0 / PASS 3

임시 조치:
- NOT_RELEASED 상태 정상 저장
- 라인업 부재 시 억지 공식 예측 금지
- 시작 후 공개 라인업 소급 pre-game 사용 금지

해결 조건 / Future research:
- 공식 라인업 평균 발표 시각 분석
- 안전한 최종 재수집 window 설계
- Provider별 발표 시각 차이 조사

우선순위:
MEDIUM

관련 문서:
- KNOWN_ISSUES.md (root Lineup Dataset v1)
- RESEARCH_LOG.md 2026-07-31 Remaining Pregame

---

# 신규 Issue 등록 규칙

필수 항목

- Issue ID
- 제목
- 발견일
- 발견 위치
- 영향
- 원인
- 임시 조치
- 해결 조건
- 상태
- 담당 미션

---

# 해결 규칙

Issue를 삭제하지 않는다.

상태만 변경한다.

예시

OPEN
↓

INVESTIGATING
↓

MITIGATED
↓

RESOLVED

---

# Blocker 구분

현재 미션을 막으면

BLOCKER

현재 미션과 무관하면

KNOWN ISSUE

향후 아이디어는

FUTURE CANDIDATE

로 분리한다.

---

# 문서 갱신

새로운 문제가 발견되면 즉시 추가한다.

해결 시에는 해결 날짜와 관련 Commit 또는 문서를 기록한다.

과거 이력은 유지한다.
