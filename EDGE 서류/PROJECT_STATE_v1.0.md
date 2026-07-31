# PROJECT_STATE

Version: 1.0.0
Status: ACTIVE

## 목적

이 문서는 현재 YANG EDGE 프로젝트의 실제 구현 상태와 검증 상태를 관리하는 공식 문서이다.

구현 완료 여부와 연구 진행률을 한 곳에서 확인한다.

---

# 1. 프로젝트 단계

현재 단계

Research Platform 구축

상태

ACTIVE DEVELOPMENT

---

# 2. 구현 현황

| 영역 | 상태 |
|------|------|
| Frontend | 진행중 |
| Backend | 진행중 |
| Research Engine | 진행중 |
| Prediction | 구현 |
| Review Engine | 구현 |
| Dataset | 진행중 |
| Documentation | 진행중 |

---

# 3. Dataset

현재

- Starter v1
- Bullpen v1.1
- Research Framework

예정

- Weather
- Travel
- Line Movement

---

# 4. Pipeline

구현

Schedule

↓

Starter

↓

Odds

↓

Lineup

↓

Prediction

↓

Official Result

↓

Review

Engine 반영은 아직 연구 단계.

---

# 5. 구현 완료

- Prediction Snapshot
- Review Pipeline
- Success Review
- Failure Review
- Leakage Audit
- Research Framework
- Remaining Pregame Accumulation runner (`research:mlb-remaining-pregame`) — 2026-07-31 VERIFIED

---

# 6. 진행중

- KBO 확장
- Odds Intake
- Dataset 확장
- Documentation
- Safe pre-first-pitch lineup re-collect window (연구 필요)
- 2026-07-31 Postgame Grade and Review (다음 Active Mission)

---

# 7. Known Issue

현재 확인된 대표 이슈

- Doubleheader internalGameId
- Dataset 표본 부족
- Weather 미구현
- Travel 미구현
- MLB official lineup near first pitch (2026-07-31 eligible 3/3 NOT_RELEASED)

---

# 8. Engine

상태

RESEARCH ONLY

자동 변경 금지.

2026-07-31 remaining pregame: Engine changes = 0 (VERIFIED).

---

# 9. 검증 상태

VERIFIED

실제 실행으로 확인

- 2026-07-31 Remaining Pregame: slate 10 / eligible 3 / official eligible prediction 0 / PASS 3 / cutoff 0 / leakage 0

REPORTED_NOT_VERIFIED

보고만 완료

UNKNOWN

확인 안됨

---

# 10. 다음 우선순위

1. MLB 2026-07-31 Postgame Grade and Review (official eligible = 0; PASS baseline pick 비공식)
2. 데이터 품질
3. Dataset 확장
4. Backtest
5. Engine 검증
6. UI 고도화

---

# 11. 문서 갱신 규칙

기능이 완료될 때마다 다음을 갱신한다.

- 구현 상태
- Dataset 상태
- Known Issue
- Engine 상태
- 다음 우선순위

본 문서는 프로젝트의 현재 상태를 나타내며 과거 기록은 PROJECT_PROGRESS.md에서 관리한다.
