# Research Lab Task State Persistence v1

## 개요

Research Lab 운영 홈의 Task 상태를 브라우저 localStorage에 저장한다.

## 저장소

- **Key**: `yang-edge:research-lab-task-state:v1`
- **Type**: Browser localStorage only
- **서버 동기화 없음**, DB 없음, API Route 없음

## Task Key 전략

`targetDate:taskType:relatedEntityId`

예:
- `2026-07-29:POSTPONED_GAME:mlb-179616`
- `2026-07-29:STARTER_MISSING:starter-dataset-v1`
- `2026-07-29:REVIEW_PENDING:mlb-review`

배열 순서나 제목 문구를 ID로 사용하지 않는다.

## 상태 분리

### systemStatus (Artifact 기반, 자동)
- `OPEN` — 문제가 열려 있음
- `RESOLVED` — 시스템에서 자동 해결됨
- `STALE` — 오래된 문제
- `UNKNOWN` — 판단 불가

### userStatus (사용자 설정)
- `TODO` — 아직 확인하지 않음
- `IN_PROGRESS` — 진행 중
- `ACKNOWLEDGED` — 확인함
- `DEFERRED` — 보류
- `COMPLETED` — 완료

### 충돌 경고

`systemStatus=OPEN` + `userStatus=COMPLETED` 시:
> "확인 완료로 표시했지만 시스템 문제는 아직 남아 있습니다."

완료 체크는 문제 해결을 의미하지 않는다.

## 메모

- Task별 최대 300자 plain text
- HTML 실행 금지

## 날짜 분리

각 날짜의 Task 상태가 독립적으로 저장된다.
이전 날짜 접속 시 해당 날짜 상태를 표시한다.

## 초기화

- 현재 날짜만 초기화 (확인 절차 포함)
- 전체 기간 초기화는 v1에서 지원하지 않음

## 안전

- localStorage parsing 실패 시 빈 상태로 fallback
- 페이지 Crash 없음
- schema version mismatch 시 안전한 fallback

## 제한사항

- 브라우저가 달라지면 상태 공유 안 됨
- 데이터 삭제 시 복구 불가
- 공개 배포 전 인증 및 서버 저장 검토 필요

## 다음 단계 후보

- Review 상세 진행률 연결
- Task 자동 완료 규칙
- 변경사항 Timeline
- 주간 미완료 Task 이월
- 계정 기반 서버 동기화
- 안전한 Pipeline 실행 버튼

## 파일 구조

| 파일 | 역할 |
|------|------|
| `src/lib/internal/research-task-state.ts` | localStorage CRUD |
| `src/hooks/useResearchTaskState.ts` | React hook |
| `src/components/internal/research/OperatorTaskList.tsx` | 필터 + 카드 + 메모 UI |
