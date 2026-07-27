# Starter Dataset v1 — Pre-design

연구 전용. Builder / Engine 연결 / Starter Score는 구현하지 않는다.  
근거 감사: `data/audits/starter-dataset-v1-pre-design-audit.json`

---

## 연구 목적

경기 **시작 전**에 합법적으로 확보 가능한 선발투수(probable) 정체성·성적·메타데이터를 표준 Dataset 행으로 축적하여, Bullpen과 동일한 research metadata/audit 규약 아래에서 설명력 가설을 검증할 수 있는지 설계한다.

이번 문서는 **최소 스키마와 경계**만 고정한다. 분류 점수·예측 변수·Engine 투입은 포함하지 않는다.

---

## 후보 가설

등록용 초안만 (Framework/HYPOTHESIS_REGISTRY는 이 감사에서 수정하지 않음).

| ID | 초안 |
|----|------|
| H-ST-001 | Pre-cutoff ERA gap과 baseline pick의 정렬이 SIGNAL_WORKED와 양의 상관을 갖는가 |
| H-ST-002 | WHIP gap이 ERA gap 이상의 독립 정보를 제공하는가 |
| H-ST-003 | Recent-3 form이 시즌 표본이 얇을 때 보조 신호로 오탐 과신을 줄이는가 |
| H-ST-004 | Probable→actual 변경(STARTER_CHANGED)이 실패 사례의 설명 가능 비중을 갖는가 |

---

## 경기 전 사용 가능 필드

| 필드 | 소스 | as-of |
|------|------|--------|
| probable `personId`, `fullName` | Stats API `schedule?hydrate=probablePitcher` | `cutoffTime` |
| `throws` | `/people/{id}` | `cutoffTime` |
| season ERA / WHIP / IP / W-L / K / BB / HR / GS | gameLog pitching, **cutoff 이전·target gamePk 제외** 재집계 | pre-cutoff |
| `recentOutings[]` (직전 최대 5 start) | 동일 filtered gameLog | prior starts only |
| `gamePk`, teams, `commenceTimeUtc` / KST | schedule | pre-game |
| `baselineGameId` (가능 시) | API-BASEBALL gameId ↔ name+time join | pre-game |
| `missingFields`, `warnings`, `status` | coverage builder | pre-game |
| `statsSource`, `cutoffTime` | candidate meta | pre-game |
| (선택 메타) `pitcherDirection` | pitcher-review watchlist | review 시점 — **Score 아님** |

이미 관측된 커버리지(2026-07-27, 15경기): ERA/WHIP/IP/recent **100%**, both pitchers identified **15/15**.

---

## 사용 금지 필드

| 필드 | 이유 |
|------|------|
| 당일 경기 boxscore outing (IP/ER/H/BB/SO/HR/pitches/decision) | post-game leakage |
| Live/Final `pitchers[0]` confirmed starter를 pre-game feature로 사용 | Preview에 confirmed 전용 필드 없음 |
| `STARTER_MATCHED` / `STARTER_CHANGED` / starterVerdict | 사후 라벨 (outcome 주석만 가능) |
| as-of 없는 live season endpoint 성적 | `LEAKAGE_RISK` |
| `qualityStarts` | 현재 gameLog 경로에 없음 |
| SportsDataIO Scrambled | 영구 금지 |
| MLB.com HTML crawl | `NO_MLB_HTML_CRAWLING` |
| Starter Score / Pitcher Advantage / Confidence / EDGE / Value Edge / recommendation | Engine·예측 변수 — 범위 밖 |
| 공개·상업 런타임으로의 Stats API 페이로드 | `INTERNAL_RESEARCH_ONLY` |

Prediction snapshot의 `pitcherDirection` / `pitcherReviewAvailable`은 **이미 불변 필드**이나, 선발 정체성·성적이 들어 있지 않다. Snapshot을 변경하지 않는 것이 원칙이다.

---

## 최소 스키마 초안

```text
datasetId:        mlb-starter
schemaVersion:    mlb-starter-dataset-v1   (구현 시)
builderVersion:   not-implemented          (현재)
engineAdmission:  PROHIBITED
```

행(초안):

```json
{
  "gameId": "mlb-{externalId}",
  "gamePk": null,
  "dateKst": "YYYY-MM-DD",
  "cutoffTime": "ISO-8601",
  "homeTeam": "",
  "awayTeam": "",
  "home": { "PitcherStatCandidate-like pre-game block": true },
  "away": { "PitcherStatCandidate-like pre-game block": true },
  "joinQuality": "MATCHED|AMBIGUOUS|UNLINKED",
  "probableConfirmedStatus": "PROBABLE_ONLY|UNKNOWN",
  "source": "INTERNAL_RESEARCH_ONLY",
  "missingFields": [],
  "warnings": []
}
```

Dataset `meta` 필수(감사 공통):

- `researchOnly`, `engineConnected: false`, `engineUseAllowed: false`
- `legal.{mlbStatsSource, publicRuntimeUseAllowed, commercialRuntimeUseAllowed, rawResponseInResearchCacheOnly}`
- `resultHashSha256` (+ 연결 시 `predictionHashSha256`, `predictionUnchanged`)
- `cacheUsage.{rawHit, rawMiss, derivedHit, derivedMiss, networkCalls}`
- `dateKst`, `generatedAt`, schema/builder version

`PitcherStatCandidate` (`src/lib/mlb/types-pitcher.ts`)를 도메인 페이로드 기준으로 재사용하되, **Bullpen role 분류 로직은 재사용하지 않는다.**

---

## 데이터 소스와 법적 상태

우선순위 (`DATA_SOURCES.md`):

1. API-BASEBALL — 일정/결과 가능, **players 통계 endpoint 없음**
2. The Odds API — 배당만
3. SportsDataIO — non-scrambled만; Scrambled 금지
4. MLB Stats API — **INTERNAL_RESEARCH_ONLY**, 상업 이용 미확인, 공개/상업 런타임 연결 금지
5. 기타 — 별도 법률 검토

허용: `scripts/` 연구 스크립트, `data/cache/research/mlb/`, `data/research/`·`data/audits/` 파생물.  
금지: Next.js 공개 런타임 import, 상업 제품 feature, HTML crawl, Scrambled.

---

## leakage 위험

1. Live season stats를 cutoff 없이 사용 → 당일 성적 혼입.
2. Target game gameLog 행을 season/recent 집계에 포함.
3. Post-game boxscore outing을 feature로 저장.
4. `STARTER_CHANGED`를 “사전 알고 있던 신호”처럼 역투사 (사후 발견).
5. Prediction `predictedAt` 이후 probable 교체를 반영하지 않은 채 성적만 최신화.

완화: gameLog **strict as-of**, target `gamePk` 제외, feature/outcome 분리, `cutoffTime` 필수.

---

## missing-data 위험

1. Preview에서 **confirmed starter 부재** → 항상 `PROBABLE_ONLY`.
2. `qualityStarts` 전무.
3. `baselineGameId` join 실패 → UNLINKED (prediction/결과와 연결 약화).
4. 동일 일자 필터로 직전 등판 누락 (더블헤더/타임존).
5. Prediction은 `missingFactors`에 `선발투수`를 유지 (Engine 미인정) — coverage 100%와 혼동 금지.
6. 07-28 등 pitcher-review 없는 슬레이트 → direction 메타 공백.

---

## 캐시 및 호출량 예상

관측(15경기): unique pitchers 30, Stats API **60 calls** (~2/pitcher: people + gameLog).

100경기 cold 대략:

- schedule: 포함 US 날짜당 ~1회
- people+gameLog: ≈ 2 × unique starters (최악 ~200 unique → ~400 calls)
- 합계 ballpark: **~420–450** cold; 일자 중첩·캐시 시 크게 감소

캐시: `research-stats-cache` raw/derived 재사용 가능. 동일 입력 warm re-run은 network 0 가능(불펜 연구 캐시에서 입증).  
`mlb-game-results` 캐시는 **스코어만** — 선발 성적 대체 아님.

---

## Bullpen과 공통·차이점

**공통 (metadata/audit만):**

- researchOnly / engine 금지 플래그
- legal 블록
- prediction hash 연계·불변 검증
- result/input hash
- cacheUsage
- cutoffTime
- Framework registry + audit shell 계약

**차이 (Starter 전용 — Bullpen 도메인 로직 비재사용):**

- probable 정체성·throws
- pre-cutoff season / recent **start** outings
- home/away starter pair
- probable vs confirmed / scratch
- joinQuality (gamePk ↔ mlb gameId)
- (선택) pitcherDirection 리뷰 메타

불펜의 role score, CLOSER/SETUP, fatigue role flag, `starterAppearancesExcluded` 로직은 **가져오지 않는다.**

---

## 구현 전 미해결 질문

1. Prediction snapshot을 변경하지 않고, `predictedAt`에 probable 정체성을 별도 research artifact로 고정하는가?
2. join 키를 `gamePk` 필수로 할 것인가, name+time soft join + `UNLINKED`를 허용할 것인가?
3. COLLECTING→PROMISING 최소 표본을 Framework 가이드(≥100경기)에 맞출 것인가?
4. `pitcherDirection`을 메타로만 둘 것인가, v1에서 제외할 것인가?
5. `recheckRequiredBeforePitch=true`일 때 mid-day 교체 버전 정책은?
6. Engine 논의 전 상업 클리어 통계 소스 일정은?

---

## 공식 결론

`READY_FOR_MINIMAL_STARTER_DATASET_DESIGN`

(실제 builder·Engine 연결은 다음 단계. 본 문서는 설계 경계만 확정한다.)
