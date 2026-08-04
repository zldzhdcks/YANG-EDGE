# PROJECT_STATUS

Version: 1.0.0  
Status: ACTIVE

## 목적

YANG EDGE의 **현재 상태**와 **진행 기록 요약**을 한 문서에서 관리한다.

- 구 `PROJECT_STATE` = 현재 상태
- 구 `PROJECT_PROGRESS` = 변화·진행 기록  
→ 본 문서로 **통합**한다.

상세 세션 연대기 중 핵심만 유지하고, 다음 작업·인수인계는 `NEXT_SESSION_v1.0.md`를 본다.

---

# 1. 현재 진행률

| 항목 | 값 |
|------|-----|
| 프로젝트 상태 | ACTIVE DEVELOPMENT |
| 현재 단계 | Research Platform 구축 |
| 공개 서비스 | 준비 중 |
| Engine | RESEARCH ONLY (자동 변경 금지) |

### 단계 표

| 단계 | 상태 |
|------|------|
| 프로젝트 기획 | DONE |
| 기본 아키텍처 | DONE |
| Research Framework | DONE |
| Prediction Pipeline | DONE |
| Review Engine | DONE |
| Dataset 확장 | IN_PROGRESS |
| KBO 확장 | IN_PROGRESS |
| Backtest | PLANNED |
| Engine 승인 | PLANNED |
| Public Beta | FUTURE |

상태값: `PLANNED` · `IN_PROGRESS` · `BLOCKED` · `DONE` · `SUPERSEDED`

---

# 2. 현재 Mission

**Active Mission (문서 기준):** KBO Lineup Screenshot Intake v1  

상태 요약: T45 Partial/Cancelled readiness 수정 반영(미커밋 가능). 다음으로 라인업 스크린샷 Intake.  
정확한 시작 체크리스트는 `NEXT_SESSION_v1.0.md`.

---

# 3. 현재 Branch

문서에 기록된 기준:

- 원격 기준: `origin/main` (선행 Proto OCR + Clipboard Intake 등)
- 로컬: 미커밋 작업 가능 — 커밋/푸시는 명시 요청 후에만

실제 branch/dirty는 세션 시작 시 `git status`로 재확인한다.

---

# 4. 현재 Engine

| 항목 | 상태 |
|------|------|
| 모드 | RESEARCH ONLY |
| 자동 변경 | 금지 |
| 2026-07-31 remaining pregame | Engine changes = 0 (VERIFIED) |

변경 조건은 `PROJECT_CONSTITUTION` · `RESEARCH_POLICY`를 따른다.

---

# 5. 현재 Dataset

### 현재

- Starter v1
- Bullpen v1.1
- Research Framework
- Remaining Pregame Accumulation runner (`research:mlb-remaining-pregame`) — 2026-07-31 VERIFIED

### 예정

- Weather
- Travel
- Line Movement
- Dataset 품질·표본 확대

### Pipeline (구현·연구)

Schedule → Starter → Odds → Lineup → Prediction → Official Result → Review  

Engine 반영은 아직 연구 단계.

---

# 6. 현재 Block

대표 Block / 이슈 (상세는 `KNOWN_ISSUES_v1.0.md`):

- Doubleheader internalGameId
- Dataset 표본 부족
- Weather / Travel 미구현
- MLB official lineup near first pitch (예: 2026-07-31 eligible NOT_RELEASED)
- KBO Proto OCR — engine not configured; paste fallback
- KBO Clipboard — browser/mobile variance; Lineup screenshot 미연결(미션 대상)
- NPB postgame runner missing
- KBO Prediction Pipeline — NOT_IMPLEMENTED (의도적)
- Provider ingestion 미연결 / quota 확인 필요 (운영 시)

---

# 7. 최근 완료 (요약)

구현·검증으로 문서에 남은 항목:

- Prediction Snapshot · Review Pipeline · Success/Failure Review · Leakage Audit · Research Framework
- MLB Remaining Pregame Accumulation (2026-07-31 VERIFIED: slate 10 / eligible 3 / cutoff 0 / leakage 0)
- Pregame Input Integrity Guards v1 (odds format contract 등)
- KBO T-30 CLI 파라미터화 · T45 Personnel Workflow / Admin UI · Proto OCR assist · Clipboard Intake (선행)
- Documentation 체계 (본 Refactoring: STATUS 통합)

### 세션 로그 (압축)

| Session | 요지 |
|---------|------|
| 001–004 | 구조·Snapshot·Review·Bullpen/Starter·문서 체계 |
| 005 (07-31) | Remaining Pregame Accumulation · DATA_ACCUMULATION_CONTINUES |
| 006 (07-31) | Postgame Review partial · Engine unchanged |
| 007 (07-31) | Pregame Input Integrity Guards · Engine unchanged |

---

# 8. 다음 목표

1. Active Mission 완료 (Lineup Screenshot Intake 등 — `NEXT_SESSION`)
2. Dataset 누적 · 데이터 품질
3. Backtest
4. Engine 검증 (승인 전)
5. Explainable Analysis · UI 고도화
6. Public Release 준비 (법적·데이터 게이트 후)

---

# 9. 구현 현황 (한눈에)

| 영역 | 상태 |
|------|------|
| Frontend | 진행중 |
| Backend | 진행중 |
| Research Engine | 진행중 |
| Prediction | 구현 |
| Review Engine | 구현 |
| Dataset | 진행중 |
| Documentation | 진행중 (체계 단순화) |

---

# 10. 검증 표기

- **VERIFIED** — 실제 실행으로 확인 (예: 2026-07-31 Remaining Pregame)
- **REPORTED_NOT_VERIFIED** — 보고만
- **UNKNOWN** — 미확인

---

# 11. 업데이트 규칙

미션 종료 후 본 문서에 반영:

- 진행률·Mission·Block·최근 완료·다음 목표
- Engine / Dataset 상태 변화
- 관련 `KNOWN_ISSUES` · `NEXT_SESSION` · `CHANGELOG` 동시 갱신

과거 세션의 상세 연대기가 필요하면 CHANGELOG·LESSONS·Git history를 보완 자료로 사용한다.
