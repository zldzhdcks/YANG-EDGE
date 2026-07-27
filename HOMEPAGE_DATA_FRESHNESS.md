# Homepage Data Freshness Audit

감사 전용. 코드·Dataset·Engine·Prediction·Framework 미수정.  
근거: `data/audits/homepage-data-freshness-audit.json`

---

## 화면별 데이터 출처

| 화면 | 경로 | 실제 데이터 출처 | 연구 artifact 연결 |
|------|------|------------------|-------------------|
| 홈 | `/` | `SportsProvider.getGames()` + `buildHomeFeed` → `DummyEngineAnalysisProvider` (dummy gameId 3개만 Engine 입력) | **없음** |
| 오늘 경기 | `/games` | 클라이언트 `GET /api/games?date=` (`cache: "no-store"`) → TheSportsDB/Football/MLB schedule + odds | **없음** |
| EDGE Ranking | `/picks` | `constants/picks.ts` `AI_PICKS` 하드코딩 | **없음** |
| EDGE Detail | `/analysis/[gameId]` | `getEngineAnalysisData` → dummy 상수 3 ID만 | **없음** |
| Feedback Center | `/feedback` | `data/predictions/*-review.json` (디렉터리 top-level `readdir` + `readFile`) | **간접** — `export-mlb-feedback-review.ts`가 `mlb/{date}-review.json` → `{date}-mlb-review.json` 변환 필요 |
| Learning Dashboard | `/learning` | `data/learning/dashboard.json` (`readFile`) | **간접** — `build-learning-dashboard.ts`가 `*-review.json` 집계 |
| Success/Failure Review | (UI 없음) | `data/predictions/mlb/*-success-flow-review.json`, `*-failure-flow-review.json` | 파일만 존재 · **공개 화면 없음** |
| Bullpen / Starter 연구 | (UI 없음) | `data/research/mlb/*`, `data/audits/*` | **공개 화면 없음** |
| EDGE Combo | `/toto` | Provider `getToto()` / Dummy `TOTO_ROUND` | 연구 MLB와 무관 · 공개 내비 HIDDEN |

---

## 현재 표시 기준 날짜

| 표면 | 기준 날짜 | 비고 |
|------|-----------|------|
| 홈 Today Pick / Featured | Provider `getKstToday()` 일정 | Engine은 dummy ID만 → 실일정과 불일치 시 Pick 빈 상태 가능 |
| `/games` | 클라이언트 `getKstToday()` 기본 · DatePicker 변경 가능 | 런타임 |
| `/picks` | `DEFAULT_GAME_DATE` / 샘플 카피 기준 (고정) | 하드코딩 |
| Feedback | 파일 `meta.dateKst` 목록 | 빌드 시점에 정적 HTML로 고정될 수 있음 (`○` static) |
| Learning | `dashboard.json` `recentDays[].dateKst` | 동일 · **생성 시각 2026-07-26T23:27Z** 기준 스냅샷 |
| 연구 채점 (파일) | 2026-07-27 Final 15/15 | `mlb/2026-07-27-review.json` graded **15** |
| 사이트용 MLB export | 2026-07-27 | `{date}-mlb-review.json` graded **14** · Yankees **pending** (export 미재실행) |

---

## 하드코딩 위치

| 위치 | 값 / 내용 |
|------|-----------|
| `src/constants/games.ts` | `DEFAULT_GAME_DATE = "2026-07-23"` + Dummy `GAMES[]` |
| `src/constants/dummyAnalysisData.ts` | Engine 입력 3경기 · 날짜 2026-07-18…23 샘플 |
| `src/constants/picks.ts` | `AI_PICKS` 고정 Ranking |
| `src/lib/research/registry.ts` | artifact 경로 `2026-07-27-…` 고정 (연구 레지스트리 · 홈 UI 미사용) |
| 다수 `scripts/*` | argv 기본 `2026-07-27` (CLI 기본값) |
| `src/lib/engine/analysis-data-provider.ts` | 항상 `DummyEngineAnalysisProvider` |

---

## 캐시 정책

| 계층 | 관찰 |
|------|------|
| App Router 페이지 | 빌드 산출물 기준: `/`·`/analysis/[id]` = **dynamic (ƒ)** · `/feedback`·`/learning`·`/picks` = **static (○)** |
| `export const dynamic` / `revalidate` | 주요 UI 페이지에 **미설정** |
| `/api/games` 클라이언트 | `fetch(..., { cache: "no-store" })` |
| 내부 API helper | `apiGetInternal` → `cache: "no-store"` |
| 외부 API helper | `apiGetExternal` → `next: { revalidate: 60 }` |
| Sports/Odds/Football provider fetch | 대체로 `cache: "no-store"` |
| MLB Stats research cache | 디스크 raw/derived · **사이트 런타임 미연결** (INTERNAL_RESEARCH_ONLY) |

---

## 최신화가 끊기는 지점

1. **연구 ↔ 홈 분리:** `grade` / Success·Failure / Bullpen / Starter 산출물은 홈 `buildHomeFeed`가 읽지 않음.
2. **사이트 변환 스크립트 미재실행:** `mlb/{date}-review.json`(graded 15) 갱신 후에도 `export-mlb-feedback-review`·`build-learning-dashboard`를 다시 돌리지 않으면 Feedback/Learning용 파일이 구버전(graded 14, Yankees pending).
3. **Feedback/Learning 정적 프리렌더:** 파일만 최신화해도 `○` static 페이지는 **재빌드 전**에 옛 내용이 남을 수 있음.
4. **Success/Failure·Bullpen·Starter:** 공개 UI route 자체가 없어 사이트에 반영될 통로 없음.
5. **Engine 입력 고착:** 홈/분석은 dummy 3 ID만 → 연구 MLB `mlb-179589` 등과 ID 체계 불일치.

---

## 수동 작업이 필요한 지점

| 단계 | 명령 / 산출물 | 사이트 반영 |
|------|----------------|-------------|
| 채점 | `grade-mlb-research-predictions.ts` → `mlb/{date}.json` + `mlb/{date}-review.json` | 홈 **미반영** |
| Feedback export | `export-mlb-feedback-review.ts` → `predictions/{date}-mlb-review.json` | Feedback가 읽음 (파일 + 가능 시 rebuild) |
| Learning 집계 | `build-learning-dashboard.ts` → `data/learning/dashboard.json` | Learning이 읽음 (파일 + 가능 시 rebuild) |
| 원클릭 | `run-mlb-postgame-pipeline.ts` (grade→export→dashboard) | Feedback/Learning만 · 홈 제외 |
| 배포 | `npm run build` | static Feedback/Learning 갱신에 사실상 필요 |

---

## 최소 자동화 대안

| # | 대안 | 효과 | 변경 규모 |
|---|------|------|-----------|
| 1 | 최신 artifact 자동 탐색 | Feedback/Learning이 `mlb/*-review.json` 또는 최신 dated 파일을 직접 탐색 | 중 · 로더 계약 변경 |
| 2 | 사이트용 `latest-summary.json` 생성 | 연구 파이프라인 끝에 요약만 쓰고 UI는 그 파일만 읽음 | **최소·권장** (연구/공개 경계 유지) |
| 3 | API/페이지 캐시 정책 조정 | `/feedback`·`/learning`에 `force-dynamic` 또는 short `revalidate` | **최소** (stale static 해소) · 연구→홈 연결은 해결 안 함 |

**권장 순서:** (3)으로 Feedback/Learning 신선도 확보 → 파이프라인에 export+dashboard를 항상 포함 → 홈에 연구 숫자를 보여줄 필요가 생기면 (2) `latest-summary.json`만 연결. MLB Stats API는 공개 런타임에 연결하지 않음.

---

## 법적 / 런타임 제한

- MLB Stats API = **INTERNAL_RESEARCH_ONLY** · 공개 UI/runtime 호출 금지 유지
- 홈·`/games`의 MLB 일정은 기존 Sports/Football/별도 schedule 경로만 사용 (연구 Stats 캐시와 분리)
- 자동 cron/DB/webhook은 이번 감사 범위에서 제안하지 않음 (구현 금지와 동일)

---

## 권장 구현 범위 (다음 작업용 · 이번엔 미구현)

1. `/feedback`, `/learning`에 `dynamic = "force-dynamic"` (또는 짧은 revalidate)
2. Yankees Final 반영 후 `run-mlb-postgame-pipeline.ts 2026-07-27` 재실행 → export/dashboard 정합
3. (선택) `data/site/latest-summary.json` writer를 postgame 파이프라인에 추가하고, 홈/Learning이 연구 raw가 아닌 이 요약만 읽도록 제한
4. 홈이 연구 적중률을 보여야 한다는 제품 결정이 없다면, 홈은 계속 live schedule+Engine 경로 유지하고 “연구 결과 ≠ 홈”을 문서화

---

## 2026-07-27 불일치 요약

| 지표 | 연구 (최신) | 사이트용 파일 / UI |
|------|-------------|-------------------|
| Graded | 15 | export/dashboard: **14** |
| Yankees | SIGNAL_FAILED (MISS 11-4) | export: **pending** |
| Starter MATCHED | 30 | 홈/Feedback에 Starter 지표 **미표시** |
| Bullpen fail warn | 7/7 | 공개 UI **없음** |
