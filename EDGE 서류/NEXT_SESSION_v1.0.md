# NEXT_SESSION

Version: 1.0.0

## 목적
다음 개발 세션에서 가장 먼저 수행해야 할 작업을 정리하는 공식 문서이다.

---

# 현재 Active Mission

## KBO T30 Runner Parameterization — in progress / verify

상태: Scheduler v1은 origin/main. T30 CLI 파라미터화 작업 중.

### Verified (Scheduler)

- origin/main @ scheduler commits
- dry-run providerCalls=0

### 다음 실행 후보

1. 검증: `npm run test:kbo-t30-cli` + `research:kbo-t30-lock -- --date 2026-07-31 --dry-run`
2. Commit KBO T30 parameterization (승인 후)
3. Optional: OS cron wrapper
4. NPB postgame identity runner
5. KBO Admin Personnel (T45)는 계속 MANUAL_REQUIRED

### 필수 주의

- 2026-07-31 기존 artifact 재생성 금지 (dry-run만)
- Engine / Prediction 계산 변경 금지
- Provider Odds API 추가 호출 금지
- git push는 명시 승인 후만

---

# 세션 시작 체크리스트

- [ ] `npm run test:kbo-t30-cli`
- [ ] `npm run research:kbo-t30-lock -- --date 2026-07-31 --dry-run`
- [ ] prediction tip runId auto-resolve 확인

---

# Blocker

없음 (T30 파라미터화로 Scheduler auto-spawn 가능). T45 admin은 MANUAL.
