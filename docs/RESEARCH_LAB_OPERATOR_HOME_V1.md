# YANG EDGE Research Lab Operator Home v1

## Overview

Operator-friendly dashboard at `/internal/research` with two views:
- **운영 홈** (`view=operator`, default): Action-oriented, Korean-language, easy to understand
- **시스템 상세** (`view=system`): Technical detail from v0, fully preserved

## Route

```
/internal/research?date=2026-07-29                  (operator home, default)
/internal/research?date=2026-07-29&view=operator     (explicit operator)
/internal/research?date=2026-07-29&view=system       (system detail)
```

## Operator Home Sections

1. **오늘의 한 줄 요약** — Template-based Korean summary from artifact state (no LLM)
2. **오늘 반드시 확인할 일** — Action cards with situation, reason, next action, collapsible commands
3. **현재 진행 상황** — Pipeline groups (경기 준비/경기 전 데이터/분석/경기 결과/리뷰)
4. **놓치면 안 되는 문제** — Explanation cards with impact, known facts, unknowns, next action
5. **오늘의 연구 결과 요약** — Key metrics, accuracy with caveat text
6. **시스템 상세로 이동** — Link to system view

## System Detail (Preserved from v0)

All v0 sections preserved: Summary Cards, Pipeline Status, Tasks, Missed Items, Starter Health, Review Queue, Commands, Artifacts.

## Postponed Game Handling

- `resultStatus: "postponed"` — distinct from `pending`
- `feedbackClassification: "INCONCLUSIVE"`
- `postponementReason: "WEATHER_POSTPONEMENT"` — metadata only
- Not counted as pending result, not counted toward accuracy denominator
- Separate task: "기상 연기 경기 확인" instead of "종료 대기 경기 재채점"
- Next-day doubleheader: new gameId, separate analysis, no prediction linking

## Task Generation Rules

| resultStatus | Task |
|---|---|
| pending | 경기 종료 후 재채점 |
| postponed | 재편성 경기 identity 확인 |
| cancelled | 채점 제외 상태 확인 |
| suspended | 재개 여부 확인 |

## Architecture

```
src/app/internal/research/page.tsx          — Route with view switching
src/components/internal/research/
  OperatorHome.tsx                           — Operator view
  SystemDetail.tsx                           — System detail view
src/lib/internal/
  research-lab-reader.ts                     — Artifact data loading
  research-lab-presenter.ts                  — Operator-friendly presentation
```

## Constraints

- Read-only, no execution buttons, no state persistence
- No public navigation link, noindex robots
- No authentication (TODO for production)
- No hardcoded numbers, no fake percentages
- Template-based summary (no LLM calls)
- NOT_AVAILABLE and 0 are distinct

## Integrated Components

- **Task State Persistence v1** — `docs/RESEARCH_LAB_TASK_STATE_V1.md`
- **EDGE Assistant v0** — `docs/EDGE_ASSISTANT_V0.md` (규칙 기반 운영 안내)

## Future Phases

- ~~Task completion state persistence~~ → implemented in Task State v1
- ~~Rule-based operations assistant~~ → implemented in EDGE Assistant v0
- Review detail screen
- Review prioritization
- Scheduler status monitoring
- Change timeline
- Multi-sport operator home
- Safe execution buttons
- Authentication
