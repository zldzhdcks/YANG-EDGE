# CURRENT_ARCHITECTURE

Version: 1.0.0

## 목적
이 문서는 YANG EDGE의 현재 시스템 구조와 각 구성요소의 책임을 정의한다.
구조 변경 시 가장 먼저 갱신해야 하는 문서다.

---

# 1. 아키텍처 원칙

- Producer와 Consumer를 분리한다.
- Source of Truth는 하나만 유지한다.
- Artifact 기반으로 데이터가 흐른다.
- Prediction은 Artifact만 읽는다.
- Engine은 연구가 끝난 후에만 변경한다.

---

# 2. 전체 데이터 흐름

Schedule
→ Starter
→ Odds
→ Lineup
→ Research Dataset
→ Daily Research Summary
→ Prediction Consumer
→ Prediction Snapshot
→ Official Result
→ Prediction Grader
→ Success Review
→ Failure Review
→ Daily Review Summary
→ Backtest
→ Engine

---

# 3. Producer

Producer는 새로운 데이터를 생성한다.

현재 대상
- Schedule Builder
- Starter Builder
- Odds Builder
- Lineup Builder
- Weather Builder(예정)
- Travel Builder(예정)

Producer는 Prediction 단계에서 실행하지 않는다.

---

# 4. Consumer

Consumer는 생성된 Artifact만 읽는다.

예시
- Prediction
- Review
- Dashboard
- Statistics
- Reports

---

# 5. Source of Truth

경기 일정
→ Schedule Artifact

선발
→ Starter Artifact

배당
→ Odds Artifact

라인업
→ Lineup Artifact

Prediction은 위 데이터를 직접 Provider에서 읽지 않는다.

---

# 6. Artifact 공통 규칙

모든 Artifact는 가능하면 다음 정보를 가진다.

- schemaVersion
- generatedAt
- cutoffTime
- inputHash
- generatorVersion
- source
- qualityWarnings

---

# 7. 데이터 계층

External Provider

↓

Raw Cache

↓

Normalized Data

↓

Research Artifact

↓

Prediction Snapshot

↓

Official Result

↓

Review

---

# 8. 연구 계층

Dataset

↓

Hypothesis

↓

Validation

↓

Backtest

↓

Approved Engine

---

# 9. 금지사항

- Prediction에서 API 호출
- Prediction에서 Builder 실행
- 결과 데이터 Feature화
- 중복 Source of Truth
- Artifact 우회

---

# 10. Pregame Scheduler v1 (Orchestrator)

역할: 시간 Window / Hard Cutoff / Lock / Idempotency 판단 후 **기존 Runner만** 호출한다.

경로:
- `src/lib/scheduler/` (core + league adapters)
- `scripts/run-pregame-scheduler-v1.ts`
- CLI: `npm run scheduler:pregame`

금지:
- Provider 응답 직접 해석
- Odds / Prediction / Engine / Weight / Threshold 계산
- Artifact 내용 임의 수정

State / Lock / Audit:
- `data/scheduler/{league}/{dateKst}/scheduler-state-v1.json`
- `data/scheduler/locks/{league}/{dateKst}/{gameId}.json`
- `data/audits/{dateKst}-{league}-pregame-scheduler-v1-audit.json`

---

# 11. 향후 확장

- Weather
- Travel
- Bullpen
- Market Movement
- Explainable AI
- Membership Analysis
- OS Cron / 상시 백그라운드 Scheduler (v1 범위 밖)

모든 확장은 기존 구조를 유지하면서 추가한다.
