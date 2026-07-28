# KBO Starter Operator Input v1

KBO 경기 **시작 전** 선발투수를 운영자가 직접 확인·입력·검수하는 연구용 Operator Input.

**Official conclusion:** `KBO_STARTER_OPERATOR_INPUT_V1_READY`

**Prerequisite audit:** [KBO_STARTER_DATA_SOURCE_READINESS_AUDIT_V1.md](./KBO_STARTER_DATA_SOURCE_READINESS_AUDIT_V1.md)

---

## Scope

- JSON 입력 → 검증 → Audit
- Identity 연결 (API-BASEBALL primary, TheSportsDB fallback)
- Pre-game cutoff 검증
- DRAFT / VERIFIED / REJECTED 분리

### Out of scope

- KBO Prediction / Engine / Starter Dataset Builder
- 공개 Viewer / 관리자 웹 UI
- 선발 자동 추정 / 로테이션 추측
- Validator 자동 VERIFIED 승격
- DRAFT → Prediction 사용

---

## CLI

```bash
npm run research:kbo-starter-input -- YYYY-MM-DD
```

날짜 생략 시 KST today.

Identity artifact가 있고 입력 파일이 없으면 **DRAFT scaffold**를 자동 생성한다 (선수 이름 없음).

---

## Input file

`data/operator-input/kbo/{DATE}-starter-confirmation-v1.json`

Template: `data/operator-input/kbo/templates/starter-confirmation-v1-template.json`

### Top-level

| Field | Value |
|-------|-------|
| schemaVersion | `kbo-starter-confirmation-v1` |
| sourceType | `OPERATOR_VERIFIED` |
| reviewStatus | `DRAFT` \| `VERIFIED` \| `REJECTED` (default `DRAFT`) |

### Per game

- Identity: `internalGameId`, `providerGameId`, `homeTeam`, `awayTeam`, `scheduledStartTimeKst`
- Starters: `awayStarter`, `homeStarter`
- Review: `capturedAt`, `sourceReference`, `reviewStatus`

### Starter side

| Field | Notes |
|-------|-------|
| playerId | `null` allowed — no arbitrary ID generation |
| playerName | operator-entered only |
| starterStatus | `CONFIRMED` \| `PROBABLE` \| `OPERATOR_VERIFIED` \| … |
| mappingStatus | `NAME_ONLY` when `playerId` is null |

---

## Pre-game cutoff

Required for **VERIFIED**:

- `capturedAt < scheduledStartTimeKst`
- if `announcedAt` present: `announcedAt < scheduledStartTimeKst`

Blocking codes: `CAPTURED_AFTER_GAME_START`, `ANNOUNCED_AFTER_GAME_START`, `CAPTURED_AT_MISSING`, `START_TIME_UNKNOWN`

---

## Review policy

| Status | Meaning |
|--------|---------|
| DRAFT | 입력만 완료 |
| VERIFIED | operator explicitly set; validator checks all gates |
| REJECTED | 잘못된 입력 |

**VERIFIED requires:**

- Identity `MATCHED`
- Both starters named
- `sourceReference` present
- Pre-game `capturedAt`
- No blocking reasons
- `MEDIA_SECONDARY` alone cannot verify

Validator **never** auto-promotes DRAFT → VERIFIED.

---

## Input status

| Status | Rule |
|--------|------|
| NOT_ENTERED | no file or no identity |
| DRAFT | all games DRAFT |
| PARTIALLY_VERIFIED | some VERIFIED |
| VERIFIED_FOR_RESEARCH_INPUT | all VERIFIED, no blocking |
| BLOCKED | validation errors |

`VERIFIED_FOR_RESEARCH_INPUT` does **not** approve Prediction, Engine, or public use.

---

## Audit

`data/audits/{DATE}-kbo-starter-operator-input-v1-audit.json`

Includes: `stableInputHashSha256`, `inputStatus`, `cutoffViolations`, regression hashes.

---

## Readiness integration

`research:kbo-slate-readiness` reads starter operator audit:

- `VERIFIED_FOR_RESEARCH_INPUT` → `analysisReadiness = STARTER_INPUT_VERIFIED`
- Never promotes to `READY_FOR_PREDICTION`

---

## Files

- Types: `src/lib/kbo/operator-starter/kbo-starter-operator-input-types.ts`
- Validator: `src/lib/kbo/operator-starter/validate-kbo-starter-operator-input-v1.ts`
- Script: `scripts/validate-kbo-starter-operator-input-v1.ts`
