# Lineup Dataset v1 — Pre-design

연구 전용. Builder / Lineup Score / Engine 연결은 구현하지 않는다.  
근거 감사: `data/audits/lineup-dataset-v1-pre-design-audit.json`

---

## 연구 목적

2026-07-27 종료 경기의 **실제 선발 타순(starting lineup)** 을 내부 연구·복기용으로 확보할 수 있는지 확인하고, 향후 **경기 전 Lineup Snapshot** 과 **경기 후 Actual Lineup** 을 명확히 분리한 최소 Dataset 경계를 고정한다.

이번 문서는 **스키마·경계·누수 방지**만 다룬다. 타선 우위 점수, OPS/wRC+ 대량 피처, Engine 투입은 포함하지 않는다.

---

## 후보 가설

등록용 초안만 (HYPOTHESIS_REGISTRY / Framework는 이 감사에서 수정하지 않음).

| ID | 질문 |
|----|------|
| H-LU-001 | Pre-cutoff published lineup 양측 완결이 사후 actual과의 불일치 감소와 상관하는가 |
| H-LU-002 | Pre-game vs actual 선발 9명 정체성 불일치가 예측 실패 설명에 기여하는가 |
| H-LU-003 | 동일 9명 순서만 변경 vs 선수 교체가 실패 연관에서 다른가 |
| H-LU-004 | DH/수비 정렬 표지가 starter·bullpen만으로 설명되지 않는 잔차를 갖는가 |

---

## pre-game과 post-game 경계

| Artifact | 시점 | 허용 | 금지 |
|----------|------|------|------|
| `preGameLineupSnapshot` | cutoff 이전 freeze | 당시 schedule `hydrate=lineups` 등 **당시에 관측된** 타순 | 경기 후 boxscore로 사후 백필 |
| `postGameActualLineup` | Final 이후 | 복기·비교 **label** | Engine feature / Lineup Score / prediction 불변 필드 |

**2026-07-27 과거 슬레이트:** `preGameLineupSnapshot = NOT_COLLECTED`.  
사전에 고정된 lineup research artifact가 없고, 당일 Pre-Game probe에서도 양측 타순 동시 공개는 0건이었다. **post-game actual을 pre-game으로 쓰지 않는다.**

---

## 실제 starting lineup 판별 기준

Stats API boxscore (`body.teams.{home\|away}.players`):

1. `battingOrder` 문자열이 `/^[1-9]00$/` (100…900) → 해당 슬롯 **원 선발**.
2. `gameStatus.isSubstitute === false` (07-27 관측: 270/270 starters).
3. 슬롯 → 타순 번호: `floor(battingOrder/100)` = 1…9.
4. `position.abbreviation` = 선발 수비 위치; `DH`면 DH.

**`team.battingOrder`(길이 9 id 배열)는 사용하지 않는다.**  
Final 이후 교체가 반영된 **현재/최종 타순**이다 (07-27: 30팀 중 29팀 mismatch).

관측(2026-07-27, 15경기): **양팀 9명 완결 15/15**, incomplete team lineup **0**.

---

## 교체 출전자 분리 기준

| 신호 | 의미 |
|------|------|
| `battingOrder` ≠ `*00` (예: 801, 301) | 해당 슬롯의 후속 출전(대타·대주자·수비 교체 등) |
| `gameStatus.isSubstitute === true` | 교체 출전 |
| `allPositions`에 `PH` 등 | 역할 힌트 (최소 스키마에서는 optional) |

v1 최소 Dataset은 **선발 9명만** 필수 행으로 두고, 교체 목록은 optional / out-of-scope로 둘 수 있다.

playByPlay는 **선발 추출에 필수 아님**. 필요 시 최소 범위: Final 경기당 `GET /api/v1/game/{gamePk}/playByPlay` 1회 (1회 타석 검증·PA batSide 등).

---

## 최소 스키마 초안

```text
datasetId:        mlb-lineup
schemaVersion:    mlb-lineup-dataset-v1   (구현 시)
builderVersion:   not-implemented
engineAdmission:  PROHIBITED
```

행(초안):

```json
{
  "gameId": "mlb-{externalId}",
  "gamePk": null,
  "dateKst": "YYYY-MM-DD",
  "homeTeam": "",
  "awayTeam": "",
  "joinQuality": "MATCHED|AMBIGUOUS|UNLINKED",
  "preGameLineupSnapshot": {
    "status": "NOT_COLLECTED|PARTIAL|BOTH_PUBLISHED",
    "cutoffTime": null,
    "sourceFetchedAt": null,
    "home": null,
    "away": null,
    "note": "Never backfilled from post-game boxscore"
  },
  "postGameActualLineup": {
    "status": "COMPLETE|PARTIAL|MISSING",
    "source": "mlb-statsapi:/api/v1/game/{gamePk}/boxscore",
    "sourceFetchedAt": null,
    "home": { "starters": [/* 9 slots */] },
    "away": { "starters": [/* 9 slots */] }
  },
  "starterSlot": {
    "battingOrder": 1,
    "playerId": 0,
    "playerName": "",
    "defensivePosition": "SS|DH|…",
    "isDH": false,
    "battingSide": "L|R|S|null"
  },
  "source": "INTERNAL_RESEARCH_ONLY",
  "engineUseAllowed": false,
  "missingFields": [],
  "warnings": []
}
```

Dataset `meta` 필수(Starter/Bullpen 감사 공통):

- `researchOnly`, `engineConnected: false`, `engineUseAllowed: false`
- `legal.{mlbStatsSource, publicRuntimeUseAllowed, commercialRuntimeUseAllowed, rawResponseInResearchCacheOnly}`
- `resultHashSha256` (+ 연결 시 `predictionHashSha256`, `predictionUnchanged`)
- `cacheUsage.{rawHit, rawMiss, derivedHit, derivedMiss, networkCalls}`
- `dateKst`, `generatedAt`, schema/builder version

---

## 사용 가능 필드

| 필드 | 소스 | as-of |
|------|------|--------|
| starting 1–9 `playerId`, `playerName` | boxscore `players[*].person` + `battingOrder` *00 | post-game |
| `defensivePosition`, `isDH` | `position.abbreviation` | post-game |
| home/away, team id/name, `gamePk` | boxscore teams + path | post-game |
| `battingSide` (optional) | `/people/{id}.batSide` | research fetch time (not boxscore) |
| substitute flags (optional) | `isSubstitute`, non-00 `battingOrder` | post-game |
| pre-game published counts/players (future) | schedule `hydrate=lineups` | **fetch 시점** cutoff |
| `sourceFetchedAt` / `cutoffTime` | cache `meta.fetchedAt`, research freeze | recorded |

이미 관측된 post-game 커버리지(2026-07-27): starting nines **30/30** complete; boxscore cache **15/15**.

---

## 사용 금지 필드

| 필드 | 이유 |
|------|------|
| `team.battingOrder` as starting lineup | Final/current order — leakage of mid-game replacements into “starter” |
| Post-game actual → `preGameLineupSnapshot` | 사후 백필 금지 |
| Lineup Score / 타선 우위 / OPS·wRC+·대량 타격 지표 | v1 범위 밖 |
| Confidence / EDGE / Value Edge / recommendation | Engine |
| SportsDataIO Scrambled | 영구 금지 |
| MLB.com HTML crawl | `NO_MLB_HTML_CRAWLING` |
| Stats API → 공개·상업 런타임 | `INTERNAL_RESEARCH_ONLY` |
| Prediction immutable 필드 변경 | hash 불변 |

---

## leakage 위험

1. Final boxscore 타순을 “경기 전 공개 라인업”으로 저장.
2. `team.battingOrder`(교체 반영)를 선발로 오인.
3. 대타·수비 교체 성적을 선발 타선 feature로 혼입 (향후 Score 시).
4. Prediction/`predictedAt` 이후 발표된 타순을 과거 snapshot에 역투사.
5. as-of 없는 live people/stats로 battingSide·타격 지표를 최신화해 pre-game freeze와 불일치.

완화: artifact 분리, *00 규칙, `NOT_COLLECTED` 유지, Engine admission PROHIBITED.

---

## missing-data 위험

1. Pre-game lineup은 첫 피치 직전·편측만 공개되는 경우가 많음 (07-27 probe: both=0).
2. `battingSide`는 boxscore person에 없음 → people 미호출 시 null.
3. 07-27 audited gamePk의 playByPlay cache 0 — *00에는 불필요, PA 검증 시 miss.
4. `gamePk`↔`mlb-{externalId}` join 실패 → UNLINKED.
5. 전용 “lineup announcement time” 필드 부재 — `fetchedAt`/`cutoffTime`만 기록 가능.
6. probable vs confirmed **라인업** 전용 API 필드 부재 — PUBLISHED_PREGAME vs ACTUAL_STARTING 상태 머신으로 대체.

---

## 데이터 출처와 법적 상태

우선순위 (`DATA_SOURCES.md`):

1. API-BASEBALL — 일정/결과; 라인업 상세 비의존
2. The Odds API — 배당만
3. SportsDataIO — non-scrambled만; Scrambled 금지
4. MLB Stats API — **INTERNAL_RESEARCH_ONLY**, 공개/상업 런타임 연결 금지
5. 기타 — 별도 법률 검토

허용: `scripts/` 연구 스크립트, `data/cache/research/mlb/`, `data/research/`·`data/audits/` 파생물.  
금지: Next.js 공개 런타임 import, 상업 feature, HTML crawl, Scrambled.

`postGameActualLineup`은 복기·label 전용. Engine feature 금지.

---

## 캐시 및 호출량 예상

관측(15경기 post-game minimal): boxscore **이미 캐시** → warm **0 network** 가능.

100경기 cold 대략:

| 모드 | 호출 |
|------|------|
| post-game minimal (id/name/order/pos/DH) | ≈ **100** boxscore |
| + battingSide via people | + unique batters (ballpark **400–900**, 최악 ≤1800) |
| playByPlay (optional) | +100 if enabled |
| future pre-game | US 날짜당 schedule hydrate ≈1 (+ 필요 시 near-cutoff 재조회) |

캐시: `research-stats-cache` raw boxscore/people 재사용.  
07-27: boxscore hit 15/15; PBP hit 0/15 (해당 gamePk); batter people 샘플 0/18.

---

## Starter/Bullpen 공통 요소

- researchOnly / engine 금지 플래그
- legal 블록
- prediction hash 연계·불변 검증
- result/input hash
- cacheUsage
- cutoffTime / fetchedAt
- Framework metadata / audit shell 계약
- missingFields / warnings

불펜 role 분류·Starter ERA/WHIP 집계 로직은 **재사용하지 않는다.**

---

## Lineup 전용 요소

- `preGameLineupSnapshot` ↔ `postGameActualLineup` 분리
- *00 starting-order 규칙 / `team.battingOrder` 배제
- 수비 위치·DH
- 교체 출전 분리
- optional battingSide (people)
- PUBLISHED_PREGAME / NOT_COLLECTED / ACTUAL_STARTING 상태
- Lineup Score·타격 지표 비포함 (v1)

Framework: `domain: "lineup"` 타입은 이미 존재. **구조 변경 불필요** (registry 등록은 구현 단계).

---

## Analysis Viewer 연결 가능 범위

가능: 향후 `data/research/mlb/*-lineup-dataset-v1.json` 로드 → starter/bullpen과 동일 패턴으로 표시.  
이번 감사: **UI/loader 수정 0**. 현재 Viewer에 lineup 섹션 없음.

표시 권장(미래): post-game 선발 1–9만; pre-game은 NOT_COLLECTED/PARTIAL을 명시. Engine 신호로 해석하지 않음.

---

## 구현 전 미해결 질문

1. v1 builder가 post-game only로 시작하고 pre-game은 상태 필드만 둘 것인가?
2. `battingSide`를 v1 필수 missingFields로 둘 것인가, optional로 둘 것인가?
3. 교체 출전자 배열을 스키마에 넣을 것인가, starters-only인가?
4. schedule hydrate 재조회 cadence (첫 공개 vs near-cutoff) 정책은?
5. COLLECTING→PROMISING 최소 표본을 ≥100경기에 맞출 것인가?
6. Viewer에 넣을 최소 라벨 세트는? (구현 전 UI 변경 없음)

---

## 공식 결론

`READY_FOR_MINIMAL_LINEUP_DATASET_DESIGN`

(실제 builder·Lineup Score·Engine 연결은 다음 단계. 본 문서는 설계 경계만 확정한다.)
