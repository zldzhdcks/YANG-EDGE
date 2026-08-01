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

## ADDED (2026-08-01 KBO T45 Admin Input UI/API v1)

- Page: `/internal/kbo/personnel` (INTERNAL / noindex; auth incomplete)
- APIs: load / validate / save / run under `/api/internal/kbo/t45-personnel/*`
- Reuses `src/lib/kbo/t45-personnel` validators (no duplicated rules)
- Validate/Save/Run separated; T30 auto-run absent; 07-31 historical read-only
- Soft gate: `INTERNAL_ADMIN_TOKEN` or non-production
- Tests: `test:kbo-t45-admin-api`

## ADDED (2026-08-01 KBO T45 Personnel Workflow v1)

- Unified admin input schema `kbo-t45-personnel-input-v1` + per-game validators
- CLI: `npm run research:kbo-t45-personnel` (`--date`, `--input`, `--dry-run`, `--validate-only`, `--game-id`, …)
- Personnel / Domestic Proto snapshots + version/hash/audit (no Engine / no official picks)
- Scheduler KBO T45: READY → spawn workflow; missing → MANUAL_INPUT_REQUIRED; invalid → INPUT_VALIDATION_FAILED
- T30 consumes personnel/proto snapshots for lineage + passReasons (PASS + officialPick=null 유지)
- Tests: `test:kbo-t45-personnel`, `verify:kbo-t45-historical`

## ADDED (2026-08-01 KBO T30 Runner Parameterization)

- CLI: `--date`, `--prior-run-id`, `--game-id`, `--dry-run`, `--json` (+ positional date compat)
- Prior tip auto-resolve from `prediction.runId` (no hardcoded PREV_RUN)
- `npm run research:kbo-t30-lock` / `test:kbo-t30-cli`
- Scheduler KBO T30 adapter → `RUN_KBO_T30_FINAL_LOCK` (mayCallProvider: false)

## ADDED (2026-08-01 Pregame Scheduler v1)

- Scheduler core: windows, stage resolver, hard cutoff, lock TTL, idempotency, quota gate
- League adapters (MLB / KBO / NPB) reusing existing runners
- CLI: `npm run scheduler:pregame` (`--dry-run`, `--force-stage`, `--include-postgame`, …)
- Tests: `test:scheduler-stage`, `test:scheduler-lock`, `test:scheduler-integration`
- State/lock/audit paths under `data/scheduler/` and `data/audits/*-pregame-scheduler-v1-audit.json`
- KBO T-30 left as MANUAL_REQUIRED (hardcoded PREV_RUN); implicit-any type annotations only

## ADDED (2026-07-31 Pregame Input Integrity Guards v1)

- Odds price format contract (`normalizeOddsPrice`, DECIMAL internal standard)
- `FORMAT_MISMATCH` odds collection status + market probability guard
- Schedule `statusDetailed` / `codedGameState`
- Prediction additive `officialStatus` / `officialPick` / `passReasons` / `researchBaseline`
- Historical audit `2026-07-31-odds-format-integrity-audit-v1.json`
- Tests: `test:odds-format`, `test:pregame-eligibility`
- `.gitignore` for regenerable research raw/derived caches

## FIXED (2026-07-31)

- Starter `sourceTimestamp` no longer copies prediction snapshot time
- American odds no longer treated as decimal via `price > 1` alone

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

# 2026-07-31 — MLB Postgame Grade & Research Review (partial)

## CHANGED

- Official Result Collector prefers schedule `teams.*.score` for FINAL (stale boxscore batting.runs=0 cache)
- Daily review artifacts for 2026-07-31 generated (`official-results`, `graded-predictions`, success/failure reviews, daily-review-summary)

## Notes

- Official eligible prediction still 0 → official accuracy N/A
- LIMITED_INPUT observation 3/4 correct is **not** official hit-rate and must not promote Engine/Dataset/Hypothesis
- reviewStatus PARTIAL_REVIEW · leakage WARN · remaining 3 games PENDING
- Related mission: MLB 2026-07-31 Postgame Grade & Research Review v1

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
