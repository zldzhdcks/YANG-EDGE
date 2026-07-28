# KBO Postgame Result Identity v1

API-BASEBALL Identity Artifact의 **POST_GAME_RESULT_IDENTITY** 영역만 갱신한다.

- Prediction / Grade / EDGE PICK / Engine: **미구현**
- Operator Market / Odds Comparison: **변경 금지**
- TheSportsDB Identity Artifact: **변경 금지**

## CLI

```bash
npm run research:kbo-postgame-identity -- YYYY-MM-DD
```

예시:

```bash
npm run research:kbo-postgame-identity -- 2026-07-28
```

## Artifact policy

동일 날짜 API-BASEBALL Identity Artifact의 **result 영역만** 갱신한다.

- Target: `data/research/kbo/{DATE}-schedule-result-identity-v1-api-baseball.json`
- 별도 postgame 파일은 만들지 않는다 (immutable migration 정책 A와 충돌하지 않음)
- TheSportsDB legacy artifact는 그대로 둔다

## Mutable vs immutable

변경 허용:

- `providerStatusRaw`
- `gameStatus`
- `lastObservedAt`
- `scheduleChanges`
- `result` / `resultStatus` / `homeScore` / `awayScore` / `winner`
- `collectionPhase`
- summary status counts
- `meta.resultHashSha256` / full file hash

변경 금지 (identity immutable fingerprint):

- `internalGameId` / `providerGameId`
- `homeTeam` / `awayTeam` / canonical team ids
- `startTimeKst` original / `cutoffTime` / `firstObservedAt` / original `providerStartTime`
- Operator Market / domestic·overseas odds artifacts

시작 시각이 Provider에서 바뀌면 `startTimeKst`를 덮어쓰지 않고 `scheduleChanges`에 `START_TIME_CHANGED`를 기록한다.

## Final 판정

Provider 종료 상태(`FINAL`/`DRAW`)이고 점수가 모두 유효할 때만:

- `resultStatus = GRADED` + `winner = HOME|AWAY`
- 동점이면 `resultStatus = DRAW` + `winner = DRAW`

그 외:

- `LIVE` / `SCHEDULED` → `PENDING` (점수 미확정)
- `POSTPONED` / `CANCELLED` / `NO_GAME` → `VOID`
- `SUSPENDED` / `UNKNOWN` / 점수 불명 → `INCONCLUSIVE`

**비종료 경기를 GRADED로 강제하지 않는다.**

## Hash policy

- `identityImmutableHash`: pre-game identity fingerprint — before/after 동일해야 함
- `fullFileHash`: result 포함 전체 파일 hash — 변경 가능

## Readiness

`research:kbo-slate-readiness`는 identity에서 result coverage를 읽는다:

- final / pending / special status games
- scores / winners resolved

`READY_FOR_PREDICTION` 승격은 하지 않는다.

## Files

| Path | Role |
|------|------|
| `src/lib/kbo/update-kbo-postgame-result-identity.ts` | Result-region updater |
| `scripts/update-kbo-postgame-result-identity-v1.ts` | CLI |
| `data/audits/{DATE}-kbo-postgame-result-identity-v1-audit.json` | Audit |

## 2026-07-28 note

Provider 재조회 시점(KST 저녁)에 5경기 모두 `INn` (이닝 진행) → normalized `LIVE` / `PENDING`.

종료(`FT`) 확정 후 동일 CLI를 다시 실행하면 Final 점수·승자가 저장된다.
