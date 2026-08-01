# NEXT_SESSION

Version: 1.0.0

## 목적
다음 개발 세션에서 가장 먼저 수행해야 할 작업을 정리하는 공식 문서이다.

---

# 현재 Active Mission

## KBO T45 Admin Input UI/API v1 — implemented (uncommitted)

상태: Admin UI + load/validate/save/run API 완료. git add/commit/push 금지(미션).

### Verified (이 세션)

- `npm run test:kbo-t45-admin-api`
- `npm run test:kbo-t45-personnel`
- `npm run verify:kbo-t45-historical`
- `npx tsc --noEmit`

### 다음 실행 후보

1. 브라우저에서 `/internal/kbo/personnel?date=<fixture>` dry-run 확인
2. 승인 후 Commit 분리 (API → UI → tests → docs)
3. 실인증(Auth) 도입
4. KBO Prediction Engine — 범위 밖

### 필수 주의

- 2026-07-31 read-only
- ADMIN_VERIFIED ≠ 공식/Provider/Engine
- production은 INTERNAL_ADMIN_TOKEN 없이 공개 금지
- T30 자동 실행 없음
- git push는 명시 승인 후만

---

# 세션 시작 체크리스트

- [ ] `npm run test:kbo-t45-admin-api`
- [ ] `npm run verify:kbo-t45-historical`
- [ ] `/internal/kbo/personnel` 로컬 확인
