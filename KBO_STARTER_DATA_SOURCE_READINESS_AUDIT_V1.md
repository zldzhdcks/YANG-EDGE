# KBO Starter Data Source and Dataset Readiness Audit v1

KBO Prediction Pipeline 구현 **전** 선발투수 정보의 **출처·시점·정확도·합법성**을 확인하는 읽기 전용 사전 감사.

**Official conclusion:** `KBO_STARTER_DATA_SOURCE_READINESS_AUDITED`

**Machine-readable audit:** `data/audits/kbo-starter-data-source-readiness-audit-v1.json`

---

## Scope

### Allowed

- 기존 Provider 코드·캐시·Identity artifact 감사
- API-BASEBALL 캐시 기반 소수 경기 probe (추가 네트워크 호출 없음)
- Starter Identity / Operator Input **문서상 후보** 설계
- MLB Starter Dataset 재사용성 분류
- Prediction readiness gate 평가

### Forbidden (this pass)

- KBO Prediction / Engine / Starter Builder / Viewer / Adapter 구현
- 예상 로테이션·추측 선발 생성
- 경기 후 실제 선발을 pre-game으로 소급
- 무단 크롤링
- Operator starter 입력 파일 실제 생성
- Framework / Registry 변경

---

## 1. Current repo KBO Provider audit

### API-BASEBALL (identity provider)

| Item | Finding |
|------|---------|
| Implementation | `src/lib/kbo/providers/api-baseball-kbo-schedule-provider.ts` |
| Endpoint | `GET games?league=5&season={year}` |
| Parsed fields | `id`, `date`, `time`, `status`, `teams`, `scores` |
| Starter / lineup / player | **Not parsed; not in raw game object** |
| Documented endpoints (repo) | `leagues`, `teams`, `standings`, `games`, `games/h2h`, `odds` — **no `lineups` / `players`** |

Prior probe: `scripts/test-api-baseball-coverage.ts` — games 응답 JSON에 `pitcher|lineup|player` 필드 없음.

### TheSportsDB

| Item | Finding |
|------|---------|
| Implementation | `src/lib/kbo/providers/thesportsdb-kbo-schedule-provider.ts` |
| Endpoint | `eventsday.php?d={date}&l=4830` |
| Free tier | 3 events / league / day |
| Starter fields | **None** in `TheSportsDbEvent` parse model |

### Stored IDs (2026-07-28 example)

- Internal game: `kbo-181902` … `kbo-181906`
- API-BASEBALL game: `181902` … `181906`
- TheSportsDB crosswalk: e.g. `2400384` ↔ `181902`
- Canonical team: `kbo-한화`, `kbo-lg`, … (`resolve-kbo-team-identity.ts`)

### MLB Starter reference (not KBO)

- Types: `src/lib/mlb/starter-dataset-types.ts`
- Builder: `src/lib/mlb/build-starter-dataset.ts`
- Source: MLB Stats API `hydrate=probablePitcher`
- Policy: `preGameImmutable: true`, post-game review in separate `postGameReview` field

---

## 2. API-BASEBALL probe (cache, 2 games)

**Method:** read-only inspection of `data/cache/research/kbo/raw/api-baseball/games_league_5_season_2026.json`  
**Network calls this audit:** 0

| Game | Match | Status | Top-level keys | Pitcher/lineup |
|------|-------|--------|----------------|----------------|
| 181902 | Lotte @ Hanwha | FT | id, date, time, status, country, league, teams, scores | **Absent** |
| 181906 | Doosan @ SSG | FT | same | **Absent** |

Finished games include inning-level `hits` / `errors` under `scores`, but **no pitcher identity**, **no probable/confirmed distinction**, **no pre-game vs post-game starter separation**.

---

## 3. Provider candidate matrix (summary)

| providerId | preGame starter | playerId | legalStatus |
|------------|-----------------|----------|-------------|
| API_BASEBALL | NOT_AVAILABLE | false | NEEDS_LEGAL_REVIEW |
| THESPORTSDB | NOT_AVAILABLE | false | NEEDS_LEGAL_REVIEW |
| SPORTSDATAIO | UNKNOWN (KBO not probed) | candidate if licensed | COMMERCIAL_LICENSE_REQUIRED; Scrambled BLOCKED |
| OFFICIAL_KBO_OR_PARTNER | UNKNOWN | UNKNOWN | NEEDS_LEGAL_REVIEW |
| SPORTRADAR_GLOBAL_BASEBALL | UNKNOWN | UNKNOWN | NEEDS_LEGAL_REVIEW |
| OPERATOR_VERIFIED_INPUT | YES if reviewed before start | optional | INTERNAL_RESEARCH_ONLY |

Full field matrix: audit JSON `auditedProviders`.

---

## 4. Official announcement timing

| Topic | Status |
|-------|--------|
| KBO formal rule document | **UNKNOWN** (no official rule text in repo) |
| Reported practice — day-before evening | Secondary sources only (~18:00–22:00 KST) |
| Same-series consecutive games | May announce after prior game (reported) |
| Opponent-change / travel | Reported noon game-day deadline |
| Lineup near first pitch | Reported 1–2 hours before (team SNS / KBO app) |
| Doubleheader procedure | **UNKNOWN** |
| Rain cancel / starter change | Observed in media; not in API-BASEBALL |

Do **not** treat secondary reports as binding compliance rules until official KBO documentation or licensed provider timestamps are verified.

---

## 5. Starter Identity candidate schema (design only)

```json
{
  "gameId": "kbo-181902",
  "teamSide": "HOME|AWAY",
  "teamId": "kbo-한화",
  "starterPlayerId": null,
  "starterName": "string|null",
  "throwingHand": "L|R|null",
  "starterStatus": "CONFIRMED|PROBABLE|OPERATOR_VERIFIED|NOT_ANNOUNCED|CHANGED|UNKNOWN",
  "sourceType": "API_PROVIDER|OPERATOR_INPUT|OFFICIAL_ANNOUNCEMENT",
  "announcedAt": "ISO8601|null",
  "collectedAt": "ISO8601",
  "cutoffTime": "scheduledStartTimeKst",
  "isPreGame": true,
  "mappingStatus": "MATCHED|UNMATCHED|AMBIGUOUS",
  "warnings": [],
  "missing": []
}
```

Post-game box score starter → separate `POST_GAME_STARTER_CONFIRMATION` collection phase. **Never backfill** into pre-game rows.

---

## 6. Pre-game cutoff policy

- Required: `collectedAt < scheduledStartTime`
- Prohibited: rotation guess, team-name-only player identity, post-game starter as pre-game feature
- MLB parallel: `STARTER_DATASET_V1_DESIGN.md` — `preGameImmutable`, `postGameReview` separation

---

## 7. Operator input candidate (design only — no file created)

Path: `data/operator-input/kbo/{DATE}-starter-confirmation-v1.json`

Required per slate:

- `gameId`, `homeStarter`, `awayStarter`
- `sourceReference` (official SNS URL, broadcast note, operator observation)
- `capturedAt`, `reviewedAt`, `reviewStatus` (`DRAFT` | `VERIFIED` | `REJECTED`)

DRAFT rows must not feed Prediction freeze (same rule as operator markets v2).

---

## 8. MLB Starter reusability

| Classification | Items |
|----------------|-------|
| COMMON_CONFIRMED | gameId, teamSide, cutoffTime, collectionPhase, preGameImmutable, postGameReview split, hash/audit, warnings/missing, legal/researchOnly |
| COMMON_CANDIDATE | probable vs confirmed taxonomy, reviewStatus workflow, cacheUsage |
| KBO_SPECIFIC | `kbo-{providerGameId}`, canonical team ids, KBO announcement/CHANGE handling, draw/no-game void |
| NOT_REUSABLE | `gamePk`, Stats API `probablePitcherId`, `/people` throws, MLB gameLog seasonStats |

Framework promotion: **prohibited this pass**.

---

## 9. Prediction readiness gates

| Gate | Status |
|------|--------|
| STARTER_PROVIDER_GATE | **BLOCKED** |
| STARTER_IDENTITY_GATE | **PARTIAL** (game/team ready; player not) |
| PRE_GAME_CUTOFF_GATE | **NOT_IMPLEMENTED** |
| LEGAL_GATE | **BLOCKED** |
| LICENSE_GATE | **BLOCKED** |
| CACHE_GATE | **READY** |
| DATA_QUALITY_GATE | **BLOCKED** |

**KBO Prediction implementation:** **BLOCKED**

---

## 10. Recommended source strategy

**`HYBRID_PROVIDER_OPERATOR_REQUIRED`**

- Current identity provider (API-BASEBALL) cannot supply pre-game starters.
- TheSportsDB cannot.
- Paid / official providers unverified in this repo.
- Operator-verified capture is the minimum lawful path until a cleared API is proven with pre-game timestamps.

Alternatives rejected for now:

- `API_PROVIDER_READY` — false for API-BASEBALL KBO
- `PAID_PROVIDER_REQUIRED` alone — license + KBO coverage probe still needed
- `NO_RELIABLE_SOURCE_FOUND` — operator path exists

---

## 11. Next implementation (one only)

**A. KBO Starter Operator Input v1**

| Candidate | Verdict |
|-----------|---------|
| A. Operator Input v1 | **Recommended** |
| B. Provider Adapter v1 | Blocked — no cleared provider |
| C. Dataset Builder v1 | Blocked — provider gate fails |
| D. Defer | Not chosen — operator path is prerequisite |

Suggested follow-up after A: paid-provider mini-clearance probe (SportsDataIO / official KBO) before any Adapter.

---

## 12. Regression (this pass)

| Artifact | Impact |
|----------|--------|
| KBO Identity | 0 |
| Operator Market | 0 |
| Odds Comparison | 0 |
| Market Feedback | 0 |
| MLB Prediction | 0 |
| TODAY EDGE PICK | 0 |
| Engine | 0 |

---

## CLI / re-run

This audit is documentation-only. No npm script required.

Reference probes:

```bash
# Prior API-BASEBALL coverage (KBO/NPB, documented endpoints only)
npx tsx --env-file=.env.local scripts/test-api-baseball-coverage.ts
```

---

## Related docs

- [KBO_RESEARCH_PIPELINE_V1_DESIGN.md](./KBO_RESEARCH_PIPELINE_V1_DESIGN.md)
- [STARTER_DATASET_V1_DESIGN.md](./STARTER_DATASET_V1_DESIGN.md)
- [KBO_MARKET_RESULT_FEEDBACK_V1.md](./KBO_MARKET_RESULT_FEEDBACK_V1.md)
- [DATA_SOURCES.md](./DATA_SOURCES.md)
