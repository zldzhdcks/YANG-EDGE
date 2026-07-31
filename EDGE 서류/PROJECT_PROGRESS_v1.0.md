# PROJECT_PROGRESS

Version: 1.0.0

## 목적
프로젝트의 진행 상황을 시간순으로 기록하는 공식 문서이다.
PROJECT_STATE가 '현재 상태'라면 PROJECT_PROGRESS는 '변화의 기록'이다.

---

# 진행률 요약

- 프로젝트 상태: ACTIVE DEVELOPMENT
- 현재 단계: Research Platform 구축
- Engine: 연구 전용
- 공개 서비스: 준비 중

---

# 진행 단계

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

---

# 세션 로그

## Session 001
- 프로젝트 구조 설계
- Producer / Consumer 원칙 정의

## Session 002
- Prediction Snapshot 구축
- Review Pipeline 구축

## Session 003
- Bullpen Dataset 연구
- Starter Dataset 연구

## Session 004
- Documentation 체계 설계
- 운영 문서 작성 시작

## Session 005 — 2026-07-31
- MLB Remaining Pregame Accumulation (`runId` 2026-07-31T00-53-46-838Z)
- Slate 10 / PREGAME_ELIGIBLE 3 / EXCLUDED 7
- Official eligible prediction 0 · PASS 3 · Research Ready 61%
- Cutoff 0 · Leakage 0 · Engine unchanged
- Conclusion: DATA_ACCUMULATION_CONTINUES
- Docs sync: RESEARCH_LOG, coverage dashboard supplemental, ROADMAP, KNOWN_ISSUES, NEXT_SESSION, CHANGELOG

---

# 현재 진행 중

- 2026-07-31 Postgame Grade and Review (다음 세션)
- Dataset 품질 향상
- Odds Intake 개선
- 문서 표준화
- KBO 기능 확장
- Safe pre-first-pitch lineup re-collect window 연구

---

# 다음 목표

1. Dataset 누적
2. Backtest
3. Engine 검증
4. Explainable Analysis
5. Public Release 준비

---

# 완료 기준

각 항목은 다음 상태만 사용한다.

- PLANNED
- IN_PROGRESS
- BLOCKED
- DONE
- SUPERSEDED

완료된 항목은 삭제하지 않고 상태만 변경한다.

---

# 업데이트 규칙

모든 개발 미션 종료 후 다음을 기록한다.

- 완료한 기능
- 진행률 변경
- 새 Blocker
- 해결한 Issue
- 다음 우선순위
- 관련 문서 변경

이 문서는 프로젝트의 연대기이며 과거 기록을 보존한다.
