# KBO Identity Pipeline Architecture

KBO Schedule / Result Identity v1의 장기 아키텍처 경계 문서.

## Layer Structure

```
CLI (scripts/build-kbo-schedule-result-identity-v1.ts)
  ↓
Service (kbo-identity-collection-service.ts)
  ↓ Feature Flag
  ↓ Provider selection (KBO_IDENTITY_PROVIDER)
  ↓ Provider Adapter (api-baseball-kbo-schedule-provider.ts | thesportsdb-kbo-schedule-provider.ts)
  ↓ Cache (kbo-api-baseball-cache.ts | kbo-thesportsdb-cache.ts — disk only)
  ↓ Team Resolver (resolve-kbo-team-identity.ts)
  ↓ Optional crosswalk (kbo-provider-crosswalk.ts)
  ↓ Builder (build-schedule-result-identity-dataset.ts)
  ↓ Artifact (provider-specific path; legacy TheSportsDB path preserved)
```

## Provider Boundary

| Layer | File | Responsibility |
|-------|------|----------------|
| Interface | `providers/kbo-schedule-provider.ts` | Provider-neutral contract |
| Adapter | `providers/api-baseball-kbo-schedule-provider.ts` | API-BASEBALL league 5, season schedule fetch, raw parsing |
| Adapter | `providers/thesportsdb-kbo-schedule-provider.ts` | TheSportsDB 4830, eventsday, raw parsing |
| Cache | `kbo-api-baseball-cache.ts` | API-BASEBALL raw disk cache |
| Cache | `kbo-thesportsdb-cache.ts` | TheSportsDB raw disk cache |

Builder는 TheSportsDB endpoint·raw field명을 참조하지 않는다.

## Service Boundary

`services/kbo-identity-collection-service.ts`:

- Feature Flag 확인
- Provider 호출
- 팀명 Identity Resolver 호출
- 이전 Artifact 로드 (schedule change detection)
- Builder 호출

**금지:** Engine, Prediction, Viewer 호출

## Builder Purity

`build-schedule-result-identity-dataset.ts`:

- 정규화된 `KboEnrichedScheduleGame[]` 입력만 받음
- Dataset Row / Metadata / Hash / Warnings / Missing 생성
- HTTP, env, raw provider field 해석 없음

## Feature Flag

```text
KBO_IDENTITY_COLLECTION_ENABLED
KBO_IDENTITY_PROVIDER
```

| Value | Behavior |
|-------|----------|
| unset / `true` | 수집 실행 허용 (기본) |
| `false` | CLI 출력 `KBO_IDENTITY_COLLECTION_DISABLED`, Artifact 미수정 |

`KBO_IDENTITY_PROVIDER`:

| Value | Behavior |
|-------|----------|
| unset / `API_BASEBALL` | API-BASEBALL primary artifact 생성 |
| `THESPORTSDB` | legacy TheSportsDB artifact 생성 |

자동 fallback 금지. 한 Provider 실패 시 다른 Provider를 조용히 호출하지 않는다.

**의미:** KBO Identity **수집 실행** 허용만.

**아님:**

- KBO Prediction 활성화
- KBO Engine 활성화
- KBO 공개 UI 활성화
- KBO 상용 이용 승인
- Engine Admission 승인

**금지 env (미생성):** `KBO_ENGINE_ENABLED`, `KBO_PREDICTION_ENABLED`, `KBO_EDGE_PICK_ENABLED`, `KBO_PUBLIC_ENABLED`

## Cache

- Path: `data/cache/research/kbo/raw/api-baseball/`
- Path: `data/cache/research/kbo/raw/thesportsdb/`
- Redis / Database **미도입**
- Warm rerun: `networkCalls = 0`, `resultHash` 안정

## HTTP Polling

| Status | Policy |
|--------|--------|
| Current | CLI 수동 실행 (`npm run research:kbo-identity -- DATE`) |
| Future candidate | 30초~5분 HTTP Polling (문서만, 미구현) |
| Forbidden | 2초 Polling, WebSocket |

도입 조건 (향후): 실시간 경기 상태 UI, 사용자 증가, Provider 호출 한도 검토, 운영 모니터링.

## Structured LLM (FUTURE_GATED)

이번 파이프라인에서 LLM **미구현**.

향후 KBO 설명 기능 입력 계약 후보:

- `summary`
- `verifiedFactors`
- `risks`
- `missingData`
- `sourceIds` (실제 Research Artifact 참조 필수)
- `cutoffTime`

현재 Identity Dataset만으로 경기 분석 문장을 생성하지 않는다.

## Error Codes

| Code | Type |
|------|------|
| `KBO_IDENTITY_COLLECTION_DISABLED` | Feature flag block |
| `PROVIDER_REQUEST_FAILED` | HTTP/API failure |
| `PROVIDER_LIMITED_COVERAGE` | Warning (e.g. 3-game free tier) |
| `NO_PROVIDER_GAMES` | Empty provider response |
| `TEAM_MAPPING_PARTIAL` | Warning |
| `CACHE_READ_FAILED` | Cache read error |
| `CACHE_WRITE_FAILED` | Cache write error |

## Registry

`kbo-schedule-result-identity` — `COLLECTING`, `engineAdmission: PROHIBITED` (변경 없음)

## Audit

- Architecture: `data/audits/kbo-identity-pipeline-architecture-alignment-v1.json`
- Build: `data/audits/{DATE}-kbo-schedule-result-identity-v1-audit.json`
- API-BASEBALL full slate: `data/audits/{DATE}-kbo-api-baseball-full-slate-identity-v1-audit.json`
- Verify: `npx tsx scripts/audit-kbo-identity-pipeline-architecture-v1.ts`
