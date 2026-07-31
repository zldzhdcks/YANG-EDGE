# CHANGELOG

Version: 1.0.0

## 목적

YANG EDGE 프로젝트의 버전별 변경 이력을 관리하는 공식 문서이다.
기능 추가, 수정, 삭제 및 호환성 변경을 시간순으로 기록한다.

---

# 상태

- ADDED
- CHANGED
- FIXED
- REMOVED
- DEPRECATED
- SECURITY

---

# v1.0.0

## ADDED

- YANG_EDGE_HANDOVER 문서
- PROJECT_CONSTITUTION 문서
- CURRENT_ARCHITECTURE 문서
- WORKFLOW_RULES 문서
- PROJECT_STATE 문서
- PROJECT_PROGRESS 문서
- NEXT_SESSION 문서
- CHAT_BOOTSTRAP 문서
- KNOWN_ISSUES 문서
- DECISION_LOG 문서
- CHANGELOG 문서 생성

## CHANGED

- 운영 방식을 문서 중심으로 전환
- 프로젝트 기억을 Git + Documentation 기반으로 전환

## FIXED

- 없음

## REMOVED

- 없음

## SECURITY

- 공식 API 우선 원칙 명문화
- 무단 크롤링 금지 정책 반영

---

# 2026-07-31 — MLB Remaining Pregame Accumulation

## ADDED

- `npm run research:mlb-remaining-pregame` CLI (`scripts/run-mlb-remaining-pregame-accumulation-v1.ts`)
- Pregame eligibility filtering (`mlb-remaining-pregame-v1`)
- Pregame cutoff audit artifact (`…-pregame-cutoff-audit-v1.json`)
- Pregame collection summary artifact (`…-pregame-collection-summary-v1.json`)
- Schedule / lineup revision preservation (`.rev-{runId}.json`)

## CHANGED

- NEXT_SESSION Active Mission → MLB 2026-07-31 Postgame Grade and Review
- RESEARCH_LOG / DATASET_COVERAGE_DASHBOARD / ROADMAP / KNOWN_ISSUES synced to 2026-07-31 remaining pregame run

## Notes

- Official eligible prediction: 0 · Eligible PASS: 3 · baseline pick ≠ official prediction
- Cutoff / leakage failures: 0 · Engine unchanged · conclusion: DATA_ACCUMULATION_CONTINUES
- Related mission: YANG EDGE Documentation Sync — MLB Remaining Pregame Accumulation 2026-07-31

---

# 기록 규칙

모든 기능 변경은 다음 형식으로 기록한다.

- 버전
- 날짜
- 변경 종류
- 변경 내용
- 영향 범위
- 관련 문서
- 관련 미션

---

# 버전 정책

MAJOR : 구조 변경
MINOR : 기능 추가
PATCH : 버그 수정

예시

1.0.0
1.1.0
1.1.1
2.0.0

---

# 문서 갱신

프로젝트 구조나 기능이 변경되면 완료 보고 이후 CHANGELOG를 함께 갱신한다.

과거 기록은 삭제하지 않고 누적 관리한다.
