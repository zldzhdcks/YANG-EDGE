# Game Status Freshness — 2026-07-28

감사 전용. prediction / pre-game / Engine / classifier 미수정.  
근거: `data/audits/2026-07-28-game-status-freshness-audit.json`

**공식 결론: `NS_STATUS_VALID`**

---

## 요약

감사 시각 **2026-07-27 13:13 KST** 기준, 슬레이트 12경기는 모두 **2026-07-28 KST**에 시작한다.  
가장 빠른 경기(Rangers, `03:35` KST)까지 약 **862분(~14시간)** 남았다.  
API-BASEBALL 네트워크 재조회와 디스크 캐시 모두 **NS×12**이며, 날짜 매핑 오류·캐시 고착이 아니다.

---

## Prediction timezone / date

| 항목 | 값 |
|------|-----|
| `meta.dateKst` | `2026-07-28` |
| 시작 시각 필드 | `startTimeKst` (KST) |
| 범위 | `03:35` … `10:45` KST |
| fixture 수 | 12 |
| immutable hash | `f0e94499…` (불변) |

---

## API query timezone / date

| 항목 | 값 |
|------|-----|
| Provider | API-BASEBALL `/games` |
| `date` | `2026-07-28` |
| `timezone` | `Asia/Seoul` |
| 코드 | `grade-mlb-research-predictions.ts`, `validate-mlb-bullpen-v1_1-date.ts` |
| HTTP cache | `no-store` |

응답 fixture `date`/`time`/`timezone`이 prediction `startTimeKst`와 일치한다 (예: `2026-07-28T03:35:00+09:00`).

---

## 교차 날짜 조회

| Query date (KST) | API total | Status | Prediction ID 매칭 |
|------------------|-----------|--------|-------------------|
| 2026-07-27 | 15 | FT×15 | **0** |
| 2026-07-28 | 12 | NS×12 | **12/12** |
| 2026-07-29 | 15 | NS×15 | **0** |

→ 동일 fixture가 인접 날짜에 중복되지 않음. **날짜 매핑 OK**.

---

## Cache

| 항목 | 값 |
|------|-----|
| Path | `data/cache/mlb-game-results/2026-07-28.json` |
| `fetchedAt` | `2026-07-27T03:59:59.516Z` |
| TTL | 5분 |
| 감사 시점 age | ~13분 → grade는 **네트워크 재조회** |
| 캐시 상태 | NS×12 |
| 고착 여부 | **아님** (TTL 만료 + live도 NS) |

Bullpen `fetchSlate`는 디스크 캐시 없이 항상 네트워크.

전용 fixture force-refresh CLI는 없음. 필요 시 TTL 만료 대기 또는 해당 캐시 파일 삭제만으로 충분.

---

## Live refresh

- 수행: **예** (`cache: "no-store"`)
- 결과: **NS×12** (캐시와 동일)
- 점수/FT 없음

---

## MLB Stats (내부 연구 cache만)

| 항목 | 값 |
|------|-----|
| Path | `…/schedule_sportId_1_startDate_2026-07-27_endDate_2026-07-28_…json` |
| `fetchedAt` | `2026-07-27T02:03:38.416Z` |
| 2026-07-28 | 15 games, 전부 `Preview` |
| 공개/상업 런타임 | **미연결** |
| 자동 보정 | **없음** |

`Preview` ≈ API-BASEBALL `NS`. 경기 수 15 vs 슬레이트 12는 연구 스냅샷 부분집합으로 정상.

---

## 원인 판정

| 가설 | 결과 |
|------|------|
| 날짜/타임존 매핑 오류 | **기각** |
| 오래된 NS 캐시 고착 | **기각** |
| Provider 상태 지연 (이미 Final인데 NS) | **기각** (아직 경기 전) |
| 실제 경기 전 NS | **채택** |

---

## 권장 다음 조치

1. **코드/artifact 수정 없음** (이번 감사).
2. 첫 경기 시작 후(~`2026-07-28 03:35` KST) 또는 FT 관측 후 `grade` → flow → bullpen → starter → site refresh 재실행.
3. 캐시 무효화는 현재 불필요. 의심 시에만 `data/cache/mlb-game-results/2026-07-28.json` 삭제.

---

## 검증

| 항목 | 결과 |
|------|------|
| prediction immutable hash | 불변 `f0e94499…` |
| pre-game artifact 변경 | 0 |
| 상태 강제 수정 | 0 |
| Engine / Bullpen / Starter / Framework | 0 |
