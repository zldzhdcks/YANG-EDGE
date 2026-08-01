# NEXT_SESSION

Version: 1.0.0

## 목적
다음 개발 세션에서 가장 먼저 수행해야 할 작업을 정리하는 공식 문서이다.

---

# 현재 Active Mission

## KBO T45 Personnel Workflow v1 — implemented (uncommitted)

상태: 코드/테스트 완료. git add/commit/push는 미션에서 금지 — 승인 후 커밋 분리.

### Verified (이 세션)

- `npm run test:kbo-t45-personnel`
- `npm run test:scheduler-integration`
- `npm run verify:kbo-t45-historical`
- `npx tsc --noEmit` (실행 후 확인)

### 다음 실행 후보

1. 승인 후 Commit 분리 (schema/workflow → scheduler/T30 → tests → docs)
2. 당일 `personnel-input-v1.json` 작성 → `research:kbo-t45-personnel -- --dry-run`
3. Optional: OS cron wrapper
4. NPB postgame identity runner
5. KBO Prediction Engine — 범위 밖 (미구현 유지)

### 필수 주의

- 2026-07-31 기존 artifact 재생성/변경 금지
- ADMIN_VERIFIED ≠ 공식/Provider/Engine
- Engine / Prediction 계산 변경 금지
- git push는 명시 승인 후만

---

# 세션 시작 체크리스트

- [ ] `npm run test:kbo-t45-personnel`
- [ ] `npm run verify:kbo-t45-historical`
- [ ] `npm run test:scheduler-integration`
- [ ] 당일 T45 input 존재 여부 확인
