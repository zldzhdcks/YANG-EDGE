# EDGE Assistant v0

규칙 기반 Research Operations Assistant.

## 핵심 원칙

- **외부 LLM 없음** — OpenAI, Anthropic 등 외부 API 연결 금지
- **자유 입력 없음** — 정해진 질문만 지원, 자연어 추론 없음
- **Artifact 상태만 사용** — 확인된 데이터만으로 결정론적 답변
- **Task 직접 변경 없음** — 읽기 전용, 상태 변경은 사용자가 직접
- **Pipeline 실행 금지** — 명령어 안내만 제공, 자동 실행 없음

## 지원 질문

| ID | 표시 |
|----|------|
| QUESTION_TODAY_PRIORITY | 오늘 뭐부터 해야 해? |
| QUESTION_OPEN_PROBLEMS | 아직 해결하지 않은 문제는? |
| QUESTION_MLB_STATUS | MLB 상태는 어때? |
| QUESTION_KBO_READINESS | KBO 분석 준비됐어? |
| QUESTION_WHY_PRIORITY | 왜 이 작업이 우선이야? |
| QUESTION_WHAT_CHANGED | 오늘 무엇이 바뀌었어? |

## 우선순위 결정 규칙

1. CRITICAL + OPEN
2. HIGH + OPEN
3. NORMAL + OPEN
4. 진행 중인 사용자 Task (IN_PROGRESS)
5. Review Pending
6. DEFERRED / LOW

## Task State 연동

- IN_PROGRESS task가 있으면 우선 마무리 추천
- COMPLETED + systemStatus OPEN이면 경고 표시
- DEFERRED task는 후순위로 표시

## KBO Readiness

현재 Reader는 MLB만 지원. KBO 질문 시 UNKNOWN으로 정직하게 표시.
라인업 이미지가 확인되었더라도 프로젝트 Artifact 반영은 별도 확인 필요.

## 변경사항 감지

이전 Snapshot 비교가 없어 diff 불가. 현재 Artifact 상태만 표시.

## 안전

- 근거 없는 예상 소요시간 금지
- 가짜 AI confidence 금지
- 확인되지 않은 READY 표시 금지
- 배당만으로 Prediction 추천 금지

## 표시 위치

운영 홈 (`/internal/research?date=YYYY-MM-DD&view=operator`)
- 오늘의 한 줄 요약 아래
- 오늘 반드시 확인할 일 위

## 파일 구조

| 파일 | 역할 |
|------|------|
| `src/lib/internal/edge-assistant-presenter.ts` | 규칙 기반 Brief + Answer 생성 |
| `src/components/internal/research/EdgeAssistantCard.tsx` | 클라이언트 UI |

## v1 후보

- Assistant Inbox
- Timeline
- 이전 Snapshot 비교
- 자유 입력 질의
- LLM 연결
- 안전한 Pipeline 실행
- 서버 기반 운영 기록
