# YANG EDGE OS — Feature Usefulness Audit v0

Generated as part of Operation Memory & Decision Center v0.
Read-only audit. No deletions performed.

| 기능명 | 위치 | 분류 | 데이터 연결 | 버튼 동작 | 제안 | 이유 |
|---|---|---|---|---|---|---|
| Dashboard | /internal/dashboard | DAILY_USE | yes | yes | KEEP | 대표 매일 진입 화면 |
| Mission Control | /internal/mission | DAILY_USE | yes | yes | KEEP | 오늘 행동 중심 |
| CTO Room | /internal/cto | WEEKLY_USE | yes | yes | KEEP | 주간 보고 + Decision Center 섹션 |
| Decision Center (CTO section) | /internal/cto#decision-center | WEEKLY_USE | yes | yes | KEEP | 승인/결정 분리 · 새 메뉴 추가 없음 |
| Data Center | /internal/data | WEEKLY_USE | yes | yes | KEEP | 종목 누적 현황 요약 |
| Research Lab | /internal/research | DAILY_USE | yes | yes | KEEP | 연구 전용 표면 |
| Engine Center | /internal/engine | WEEKLY_USE | yes | yes | KEEP | 읽기 전용 엔진 변수 상태 · weight 수정 없음 |
| Developer Console | /internal/developer | DEVELOPER_ONLY | yes | yes | KEEP | Hash/Artifact/Runtime — 대표 기본 비노출 |
| Settings | /internal/settings | WEEKLY_USE | yes | yes | KEEP | 대표 모드 토글 |
| Owner mode / Advanced disclosure | OsShell / Settings | DAILY_USE | yes | yes | KEEP | 기술 용어 숨김 |
| OperatorHome (legacy) | src/components/internal/research/OperatorHome.tsx | DEPRECATED_CANDIDATE | yes | yes | DEPRECATE | Dashboard로 대체 · 라우트에서 직접 미사용 |
| SystemDetail | /internal/developer (embedded) | DEVELOPER_ONLY | yes | yes | MOVE | 이미 Developer Console로 이동 완료 |
| Developer Console label chips | DeveloperConsoleView | PLACEHOLDER_ONLY | no | no | HIDE | 라벨만 있고 개별 화면/동작 없음 |
| EPL Schedule checklist item | Dashboard checklist | PLACEHOLDER_ONLY | no | no | HIDE | 축구 일정 미연결 · OFF 표시만 |
| Football/NBA/Volleyball Data Center cards | /internal/data | PLACEHOLDER_ONLY | no | null | KEEP | NOT_STARTED를 OFF로 정직 표시 |
| CTO Brier/LogLoss summary cards | /internal/cto | DUPLICATE | no | null | KEEP | 관찰 안내만 · 수치 복제 없음 |

Source of truth: `src/lib/internal/operation-memory-v0/feature-usefulness-audit.ts`
