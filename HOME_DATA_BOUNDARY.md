# Home Data Boundary Audit

감사 전용 문서. 홈 UI·Engine·연구 artifact·Prediction은 **이번 작업에서 수정하지 않음**.  
근거 JSON: `data/audits/home-dummy-data-boundary-audit.json`

**공식 결론: `HOME_DUMMY_LABELING_NEEDED`**

---

## 요약

홈(`/`)은 **일정(Provider)** 과 **추천 수치(EDGE Engine)** 가 분리된 파이프라인으로 렌더링된다.  
기본 운영(`thesportsdb`)에서는 NPB/KBO **실일정**을 보여줄 수 있지만, Engine 입력은 항상 **3경기 dummy 상수**뿐이다.  
`SPORTS_PROVIDER=dummy`일 때는 일정·추천 모두 샘플이며, TodayPick에만 작은 테스트 배지가 있고 Featured·분석 완료 카운트에는 경계 표시가 없다.

---

## 홈 섹션별 데이터 출처

| 섹션 | 일정(실/샘플) | Engine 수치 | 연구 artifact | `/analysis` 링크 |
|------|---------------|-------------|---------------|------------------|
| Hero | — | — | 없음 | 없음 |
| Today EDGE Pick | Provider 팀·리그 | **dummy Engine** | 없음 | **있음** (`상세 분석 →`) |
| 오늘 경기 | Provider 건수 | analyzed = dummy 매칭 수 | 없음 | 없음 |
| Why YANG EDGE (Featured) | Provider 팀명 | **dummy Engine** + 등급 배지 | 없음 | 없음 |

### 파이프라인

```
page.tsx
  ├─ loadTodayPick()  ─┐
  └─ loadHomeGames()  ─┼─► getSportsProvider().getGames()
                        └─► buildHomeFeed(games)
                              └─► getEngineAnalysisData(gameId)
                                    └─► DummyEngineAnalysisProvider (항상)
                                          └─► dummyAnalysisData.ts (3 IDs)
```

---

## 실제 데이터 요소

- **TheSportsDB (기본):** NPB/KBO 팀명, 리그, 날짜, 시작 시각(KST), `externalId`
- **SportCard `오늘 경기`:** Provider가 반환한 당일 슬레이트 건수(종목별)
- **빈 상태 문구:** 일정 0건 · 추천 기준 미충족 · API 오류

## Dummy / 샘플 요소

| 항목 | 출처 | 비고 |
|------|------|------|
| 승리 확률, Confidence, EDGE Score | `runEdgeEngine` + dummy `AnalysisData` | TodayPick·Featured 공통 |
| 추천 등급 배지 (WATCH / EDGE PICK / TOP EDGE) | `getRecommendationGrade` | Featured 카드 |
| `EDGE 분석 완료` 숫자 | dummy engine 매칭 경기 수 | 실채점·연구 아님 |
| Value Edge (홈) | 배당 매칭 시 계산 | baseball dummy 1건만 가능 |
| DummyProvider 일정 전체 | `constants/games.ts` | `DEFAULT_GAME_DATE = 2026-07-23` |

### Engine이 있는 gameId (3개만)

- `npb-softbank-orix`
- `npb-hanshin-yomiuri`
- `kbo-lg-doosan`

MLB 연구 ID(`mlb-179xxx`)와 **체계가 다름** → 홈은 연구 채점 결과를 읽지 않음.

---

## 샘플 `/analysis` 연결

| 진입점 | CTA | 동작 |
|--------|-----|------|
| TodayPick (pick 있을 때) | `상세 분석 →` | `/analysis/{gameId}` — dummy AnalysisData만 |
| Featured 카드 | 없음 | 깨진 링크 위험 없음 |
| `/picks` (공개 비노출) | PickCard → analysis | 별도 고정 `AI_PICKS` 샘플 |

Pick이 표시되면 `gameId`는 항상 위 3개 중 하나이므로 **홈에서 analysis 링크가 깨질 가능성은 낮음**.

---

## 사용자 오해 위험

### 라벨·문구

| 위치 | 문구 | 문제 |
|------|------|------|
| `layout.tsx` metadata | 오늘 가장 가치 있는 경기를 찾아드립니다 | 일일 실검증 Pick 암시 |
| Hero | EDGE Score + Confidence + 분석 근거 제공 | Engine 샘플 한계 미고지 |
| TodayPick | `EDGE Pick` | 실추천처럼 보임 |
| TodayPickStats | 승리 확률 / EDGE Confidence / EDGE Score | dummy 수치; provider=dummy일 때만 작은 배지 |
| SportCard | `EDGE 분석 완료` | dummy 매칭 수를 완료 분석으로 읽기 쉬움 |
| Why YANG EDGE | 섹션명 vs Featured 카드 | 제품 설명이 아니라 추천 카드 그리드 |
| FeatureCard | WATCH / EDGE PICK / TOP EDGE | dummy 등급이 실추천처럼 보임 |

### Provider별 공개 위험

| 모드 | 일정 | Pick / Featured | 위험도 |
|------|------|-----------------|--------|
| `thesportsdb` (기본) | 실제 | 대개 빈 상태 | **중** — Hero·metadata는 여전히 Pick 암시 |
| `dummy` | 고정 샘플 | Pick + Featured 표시 | **높음** — 수치·등급이 실서비스처럼 보임 |
| API 미설정/오류 | — | 오류·빈 카드 | 낮음 |

연구 Feedback/Learning 적중률·Audit 수치는 홈에 **노출되지 않음** (양호).

---

## 권장 최소 조치 (코드 미적용 · 제안만)

**선호: dummy 결과 명확한 샘플 표시**

1. `providerKind === "dummy"`와 무관하게, Engine이 `DummyEngineAnalysisProvider`이면 TodayPick·Featured·analyzed 카운트에 **공통 샘플 배너** 표시.
2. TodayPick 부제 예: `엔진 샘플 출력 (실추천·MLB 연구 채점 아님)`.
3. Featured(Why YANG EDGE)에도 동일 경계 문구 또는 섹션명을 `Featured (샘플)` 등으로 정리.
4. `EDGE 분석 완료` → `엔진 샘플 매칭` 등으로 완화 검토.

**대안: 일정만 유지 · 추천 영역 숨김**

- per-game AnalysisData가 dummy-only인 동안 TodayPick + Why YANG EDGE 섹션 비노출.
- TodayGames(일정 요약)만 유지.

**이번 감사에서 하지 않을 것**

- 홈 ↔ MLB research artifact 연결
- Engine / weights / recommendation 변경
- dummy 코드 삭제 또는 실데이터처럼 표현
- 연구 적중률 홈 노출

---

## 다른 화면과의 관계

| 경로 | 홈과의 관계 |
|------|-------------|
| `/games` | 별도 API 일정; 홈 TodayGames와 유사하나 클라이언트 fetch |
| `/feedback`, `/learning` | MLB 연구 mirror; **홈 미연결** |
| `/picks` | 공개 HIDDEN 고정 샘플; 홈 TodayPick과 별개 |
| `/analysis/[id]` | dummy 3 ID만 Engine 상세 |

---

## 문서 교차 참고

- `HOMEPAGE_DATA_FRESHNESS.md` — 신선도·캐시·수동 갱신 갭
- `ROADMAP.md` — 홈 Today Pick / Featured 부분 연결 명시
- `COPY.md` — EDGE Pick / Why YANG EDGE 문구 (일부는 컴포넌트와 불일치)

---

## 검증 (이번 작업)

| 항목 | 결과 |
|------|------|
| 코드 변경 | 없음 |
| Engine / Prediction 영향 | 0 |
| Feedback / Learning 영향 | 0 |
| 생성 문서 | `home-dummy-data-boundary-audit.json`, 본 파일 |
| Build | 감사 전용 — 코드 diff 없음 |
