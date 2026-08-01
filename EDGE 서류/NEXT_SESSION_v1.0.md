# NEXT_SESSION

Version: 1.0.0

## 목적
다음 개발 세션에서 가장 먼저 수행해야 할 작업을 정리하는 공식 문서이다.

---

# 현재 Active Mission

## Pregame Scheduler v1 — implemented (no cron yet)

상태: Scheduler core + MLB/KBO/NPB adapters + fixture tests + dry-run verified

### Verified

- `npm run test:scheduler-stage|lock|integration` OK
- `npx tsc --noEmit` OK
- `npm run scheduler:pregame -- --date 2026-07-31 --league MLB --dry-run` → providerCalls=0

### 다음 실행 후보

1. Commit Scheduler v1 (core / adapters / docs) when Chan-yang approves
2. Parameterize KBO T-30 runner (remove hardcoded PREV_RUN) → enable auto stage
3. Optional: OS Task Scheduler / cron wrapper (out of v1)
4. NPB postgame identity runner

### 필수 주의

- Scheduler는 Orchestrator만 — Engine/Prediction 로직 금지
- Dry-run 기본으로 판단 검증
- `--force-stage`는 Hard Cutoff / Lock 우회 불가
- git add/commit/push는 명시 승인 후만

---

# 세션 시작 체크리스트

- [ ] `npm run test:scheduler-stage`
- [ ] `npm run scheduler:pregame -- --date <KST> --league MLB --dry-run`
- [ ] Schedule artifact 존재 확인

---

# Blocker

KBO T-30 auto-lock: MANUAL_REQUIRED until runner is parameterized
