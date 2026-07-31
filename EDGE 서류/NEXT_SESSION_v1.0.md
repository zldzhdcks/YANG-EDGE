# NEXT_SESSION

Version: 1.0.0

## 목적
다음 개발 세션에서 가장 먼저 수행해야 할 작업을 정리하는 공식 문서이다.
현재 우선순위를 유지하고, 새로운 AI가 빠르게 작업을 이어갈 수 있도록 한다.

---

# 현재 Active Mission

## MLB 2026-07-31 Postgame Grade and Review

상태:
READY_FOR_NEXT_SESSION

### 실행 순서

1. Official Result (`npm run result:mlb -- 2026-07-31`)
2. Grade (`npm run grade:mlb -- 2026-07-31`)
3. Success Review
4. Failure Review
5. Input Audit
6. Pregame Baseline Observation Review (research-only)
7. Daily Research Summary / Review Summary
8. Documentation Sync

### 필수 주의사항

- 공식 eligible prediction: **0** (`inputStatus=ELIGIBLE` / `BASELINE_CANDIDATE` 없음)
- Pregame eligible 3경기는 모두 공식 **PASS** (remaining-pregame finalStatus)
- PASS 당시 snapshot `baselinePick`은 연구 관찰용일 뿐 — 공식 예측 아님
- 결과가 baseline pick과 일치해도 **공식 적중으로 계산 금지**
- 원본 pregame artifact와 hash 보존
- 경기 후 데이터로 pregame artifact 덮어쓰기 금지
- Engine 변경은 별도 연구 승인 전 금지
- 자동 Dataset / Hypothesis 승격 금지

### Pregame context (VERIFIED)

- runId: `2026-07-31T00-53-46-838Z`
- collectionStartedAt: `2026-07-31T00:53:46.838Z` (KST 09:53)
- Eligible gamePk: 824974, 823271, 823921
- Cutoff failures: 0 · Leakage failures: 0
- Conclusion so far: `DATA_ACCUMULATION_CONTINUES`

---

# 세션 시작 체크리스트

- [ ] YANG_EDGE_HANDOVER.md 확인
- [ ] PROJECT_CONSTITUTION.md 확인
- [ ] CURRENT_ARCHITECTURE.md 확인
- [ ] PROJECT_STATE.md 확인
- [ ] PROJECT_PROGRESS.md 확인
- [ ] KNOWN_ISSUES.md 확인
- [ ] 현재 Git 상태 확인
- [ ] 현재 Build 상태 확인
- [ ] `data/predictions/mlb/2026-07-31.json` 및 remaining-pregame / cutoff-audit 확인

---

# 가장 높은 우선순위

1. 현재 Active Mission 확인
2. 기존 구조 감사
3. Source of Truth 확인
4. 중복 구현 여부 조사
5. Cursor Prompt 작성
6. 구현
7. 테스트
8. 문서 갱신

---

# 진행 중 TODO

- 2026-07-31 postgame grade/review (official eligible = 0)
- Dataset 품질 향상
- Safe pre-first-pitch lineup re-collect window 연구
- Odds Intake 개선
- KBO 확장
- 문서 체계 완성

---

# Blocker

현재 기록 없음.

발생 시 다음 형식 사용

- BLOCKER-ID
- 영향
- 원인
- 임시조치
- 해결조건

---

# Known Issue 확인

세션 시작 시 반드시 KNOWN_ISSUES.md를 확인한다.

관련: MLB official lineup availability near first pitch (2026-07-31 eligible 3/3 NOT_RELEASED).

새로운 문제가 발견되면

OPEN → INVESTIGATING → RESOLVED

상태를 사용한다.

---

# 종료 체크리스트

- [ ] Build PASS
- [ ] Runtime 확인
- [ ] 문서 갱신
- [ ] Git 여부 판단
- [ ] 다음 세션 TODO 작성

---

# 다음 세션 인계 형식

현재 미션:
완료 항목:
남은 작업:
Blocker:
Known Issue:
다음 우선순위:
수정 문서:
미수정 문서:
