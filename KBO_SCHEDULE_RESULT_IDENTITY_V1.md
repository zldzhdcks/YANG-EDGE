# KBO Schedule / Result Identity Dataset v1

YANG EDGE의 첫 KBO Research Dataset. 경기 **신원·일정·상태·결과**만 저장한다.

- **Engine admission:** `PROHIBITED`
- **Prediction / Starter / Bullpen / Lineup:** 미구현 (본 Dataset 범위 외)
- **Primary provider default:** API-BASEBALL league `5` (`KBO_IDENTITY_PROVIDER`, 자동 fallback 없음)
- **Legacy provider preserved:** TheSportsDB league `4830`
- **Legal:** `INTERNAL_RESEARCH_ONLY` · public/commercial `UNCONFIRMED`

## Internal Game ID

```
kbo-{providerGameId}
```

- API-BASEBALL primary 사용 시 `providerGameId` = API-BASEBALL `game.id`
- Legacy TheSportsDB artifact는 기존 `idEvent` 기반 ID를 유지한다
- Provider ID 없는 경기는 Row에 넣지 않고 `missing`에 기록
- Betman ID를 primary gameId로 사용하지 않음
- 팀명 slug/hash 대체 금지

## Collection Phase

| Phase | 조건 |
|-------|------|
| `PRE_GAME_SCHEDULE_IDENTITY` | `result.resultStatus = PENDING` |
| `POST_GAME_RESULT_IDENTITY` | 결과 확정 또는 VOID/INCONCLUSIVE |

Dataset meta `collectionPhase`는 Row phase가 혼합이면 `MIXED`.

## Row 구조

- **Schedule:** `internalGameId`, teams, venue, `providerStatusRaw`, `gameStatus`, `time.*`
- **Result subsection:** `result.resultStatus`, scores, `winner`
- **Provider ref:** `provider.id`, `providerGameId`, `betmanScopeReference` (`NOT_CHECKED` default)
- **Team identity:** `providerName`, `canonicalNameKo/En`, `canonicalTeamId`, `mappingStatus`

## Game Status (normalized)

`SCHEDULED` · `LIVE` · `FINAL` · `DRAW` · `POSTPONED` · `CANCELLED` · `NO_GAME` · `SUSPENDED` · `INCONCLUSIVE` · `UNKNOWN`

Provider raw status는 `providerStatusRaw`에 보존.

## Build

```bash
npm run research:kbo-identity -- 2026-07-24
```

Postgame result-only refresh (API-BASEBALL artifact):

```bash
npm run research:kbo-postgame-identity -- 2026-07-28
```

상세: [KBO_POSTGAME_RESULT_IDENTITY_V1.md](./KBO_POSTGAME_RESULT_IDENTITY_V1.md)

Feature flag `KBO_IDENTITY_COLLECTION_ENABLED=false` → 출력 `KBO_IDENTITY_COLLECTION_DISABLED` (수집만 차단; Engine/Prediction/UI 아님).

## Pipeline Architecture

Provider → Service → Builder → Artifact. 상세: [KBO_IDENTITY_PIPELINE_ARCHITECTURE.md](./KBO_IDENTITY_PIPELINE_ARCHITECTURE.md)

| Layer | File |
|-------|------|
| Provider interface | `src/lib/kbo/providers/kbo-schedule-provider.ts` |
| API-BASEBALL adapter | `src/lib/kbo/providers/api-baseball-kbo-schedule-provider.ts` |
| TheSportsDB adapter | `src/lib/kbo/providers/thesportsdb-kbo-schedule-provider.ts` |
| Service | `src/lib/kbo/services/kbo-identity-collection-service.ts` |
| Builder (pure) | `src/lib/kbo/build-schedule-result-identity-dataset.ts` |
| Crosswalk | `src/lib/kbo/kbo-provider-crosswalk.ts` |

## Artifacts

| Path | Description |
|------|-------------|
| `data/research/kbo/{DATE}-schedule-result-identity-v1.json` | Dataset |
| `data/research/kbo/{DATE}-schedule-result-identity-v1-api-baseball.json` | API-BASEBALL full-slate dataset (pre-game + postgame result region) |
| `data/audits/{DATE}-kbo-schedule-result-identity-v1-audit.json` | Build audit |
| `data/audits/{DATE}-kbo-api-baseball-full-slate-identity-v1-audit.json` | API-BASEBALL full-slate audit |
| `data/audits/{DATE}-kbo-postgame-result-identity-v1-audit.json` | Postgame result-identity audit |
| `data/cache/research/kbo/raw/thesportsdb/` | Raw API cache |
| `data/cache/research/kbo/raw/api-baseball/` | Raw API cache |

## Registry

`kbo-schedule-result-identity` — status `COLLECTING`, Framework adapter `kboScheduleResultIdentityV1FrameworkMetadata()`.

## Known Limitations (v1)

- TheSportsDB free tier: `eventsday.php` 요청당 최대 3경기 — legacy artifact only
- API-BASEBALL provider metadata: `legalStatus=NEEDS_LEGAL_REVIEW`, `researchUse=INTERNAL_RESEARCH_ONLY`
- Betman scope matching 미수행 (`NOT_CHECKED`)
- 단일 Provider — API-BASEBALL 등 자동 fallback 없음

## Migration Policy (2026-07-28)

- 방식: **A. 새 API-BASEBALL Identity Artifact를 별도 생성**
- 기존 `data/research/kbo/2026-07-28-schedule-result-identity-v1.json` 및 hash는 보존
- 새 primary artifact는 `data/research/kbo/2026-07-28-schedule-result-identity-v1-api-baseball.json`
- 기존 3경기는 `providerRefs`에서 `API_BASEBALL <-> THESPORTSDB` crosswalk `MATCHED`
- 누락 2경기(삼성-KIA, SSG-두산)는 API-BASEBALL ref만 존재해도 오류로 승격하지 않음
- Postgame: 동일 API-BASEBALL 파일의 result 영역만 갱신 (별도 `*-postgame.json` 불필요). pre-game identity immutable hash는 유지

## Files

- Types: `src/lib/kbo/schedule-result-identity-types.ts`
- Builder: `src/lib/kbo/build-schedule-result-identity-dataset.ts`
- Postgame updater: `src/lib/kbo/update-kbo-postgame-result-identity.ts`
- Cache: `src/lib/kbo/kbo-thesportsdb-cache.ts`
- Team mapping: `src/lib/kbo/resolve-kbo-team-identity.ts`
- Script: `scripts/build-kbo-schedule-result-identity-v1.ts`
- Postgame script: `scripts/update-kbo-postgame-result-identity-v1.ts`
