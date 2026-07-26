# YANG EDGE — API / Sports Provider 가이드

코드 기준입니다. 과거 “Dummy 자동 폴백” 설명은 **폐기**되었습니다.

## 데이터 흐름

```
화면 (Home / Games / Analysis / EDGE Combo / Ledger)
  → getSportsProvider()   ※ Ledger는 Provider 미사용 (localStorage)
      ├─ DummyProvider         (SPORTS_PROVIDER=dummy 명시 시에만)
      ├─ TheSportsDbProvider   (일정 NPB/KBO — 실패 시 Dummy 대체 없음)
      └─ ApiSportsProvider     (야구 스텁 — 전 메서드 throw, Dummy 폴백 없음)

/api/* Route Handler 도 동일하게 getSportsProvider() 사용 (해당 라우트에 한함)
```

## Provider 선택 (`SPORTS_PROVIDER`)

| 값 | Provider |
|----|----------|
| `dummy` | DummyProvider **만** (명시적 테스트 모드) |
| `thesportsdb` | TheSportsDbProvider (**Dummy 폴백 없음**) |
| `apisports` | ApiSportsProvider 스텁 (**Dummy 폴백 없음**) |
| `api` (하위 호환) | thesportsdb 와 동일 |

미지정 시:

- `SPORTS_API_BASE_URL`에 `thesportsdb.com` 포함 → thesportsdb
- URL만 있으면 → apisports
- URL도 없으면 → thesportsdb 인스턴스(키 없으면 `getGames` 등에서 설정 오류 throw). **자동 Dummy 아님**

## 파일 구조

```
src/lib/sports/
  types.ts
  get-provider.ts          ← Factory
  dummy-provider.ts
  thesportsdb-provider.ts  ← 일정 연동
  apisports-provider.ts    ← API-Sports 준비용 스텁 (TODO)
```

## 보안 (중요)

- **API 키·시크릿은 절대 `NEXT_PUBLIC_*` 에 넣지 않는다.**
- `SPORTS_API_KEY`, `SPORTS_API_BASE_URL` 은 서버 전용.
- 실키를 이 문서에 적지 말 것.

## 환경변수

| 변수 | 공개 여부 | 용도 |
|------|-----------|------|
| `SPORTS_PROVIDER` | 서버 | `dummy` / `thesportsdb` / `apisports` |
| `SPORTS_API_BASE_URL` | 서버 | 외부 스포츠 API 베이스 URL |
| `SPORTS_API_KEY` | 서버 | 외부 스포츠 API 키 |
| `ODDS_PROVIDER` | 서버 | `the-odds-api` (기본) / `dummy` (명시 선택만) |
| `ODDS_API_BASE_URL` | 서버 | The Odds API 베이스 (기본 `https://api.the-odds-api.com/v4`) |
| `ODDS_API_KEY` | 서버 | The Odds API 키 (`NEXT_PUBLIC_*` 금지) |
| `FOOTBALL_PROVIDER` | 서버 | `api-football` (기본) / `dummy` (명시 선택만) |
| `FOOTBALL_API_BASE_URL` | 서버 | 기본 `https://v3.football.api-sports.io` |
| `FOOTBALL_API_KEY` | 서버 | API-Football 키 (`x-apisports-key`, `NEXT_PUBLIC_*` 금지) |
| `SITE_URL` | 서버 | 내부 `/api` 자기호출 (레거시/테스트) |

로컬에서 TheSportsDB·Odds·Football을 쓰려면 **`.env.local` 필요** (Git 미포함).

## 홈 / Today Pick 응답 상태

`loadTodayPick()` / `GET /api/today-pick` 본문 예:

| `status` | HTTP | 의미 |
|----------|------|------|
| `success` | 200 | Pick 데이터 |
| `empty-games` | 200 | 오늘 일정 0건 |
| `empty-pick` | 200 | 일정은 있으나 \|EDGE\| 기준 미충족 |
| `error` | 502/503 | 외부 API·네트워크·설정 오류 |

홈 Featured·오늘 경기: `loadHomeGames()` → `success` / `empty` / `error`.

## 브라우저 스모크 (설정에 따라 결과 다름)

- http://localhost:3000/api/games
- http://localhost:3000/api/today-games
- http://localhost:3000/api/today-pick
- http://localhost:3000/api/featured
- http://localhost:3000/api/analysis/npb-softbank-orix  ← dummy Engine ID 예시
- http://localhost:3000/api/toto/current  ← Dummy 모드가 아니면 오류/빈 안내 가능
- http://localhost:3000/ledger  ← Provider 무관 (localStorage)

## TheSportsDB v1

```
SPORTS_PROVIDER=thesportsdb
SPORTS_API_BASE_URL=https://www.thesportsdb.com/api/v1/json
SPORTS_API_KEY=...   # 서버 전용. 공용 테스트 키는 제한·테스트 목적
```

URL 형식: `{BASE}/{KEY}/{endpoint}`

| 메서드 | TheSportsDB | 비고 |
|--------|-------------|------|
| `getGames` | `eventsday.php?d=&l=` | NPB(`4591`) / KBO(`4830`) → `GameData[]`. 0건은 빈 배열 |
| `getTodayPick` 등 | `getGames` + `buildHomeFeed` | Engine 입력 없으면 Pick/Featured 빈 결과 (정상). **Dummy 폴백 없음** |
| `getAnalysis` / `getToto` | 없음 | throw (Dummy 자동 대체 없음) |

### 무료 플랜 제한

- `eventsday`: **요청당 최대 3건** (리그별 호출 시 NPB≤3 + KBO≤3)
- EDGE 분석·Combo API는 TheSportsDB에 없음 → Engine은 **별도 dummy 상수**에만 존재 (실일정 ID와 불일치 가능)
- **사용자 화면에는 무료 제한을 표시하지 않는다.** (개발 문서·코드 주석 전용)

검증: `npx tsx --env-file=.env.local scripts/verify-thesportsdb.ts`

## Odds Provider (The Odds API)

SportsProvider / EDGE Engine 과 **독립**.  
**연결 화면:** `GET /api/games` (일정 보강), 분석 상세 Value Edge (`resolveAnalysisMarketOdds`).  
실패해도 일정 자체는 유지(보강만 생략)하는 경로가 있음.

```
ODDS_PROVIDER=the-odds-api
ODDS_API_BASE_URL=https://api.the-odds-api.com/v4
ODDS_API_KEY=...   # 서버 전용
```

| 엔드포인트 | 설명 |
|------------|------|
| `GET /api/odds?sportKey=` | 배당 목록 + usage 메타 |
| `GET /v4/sports` (외부) | 활성 KBO/NPB key 확인 |
| `GET /v4/sports/{key}/odds` | regions=eu, markets=h2h, decimal |

- Dummy: `ODDS_PROVIDER=dummy` 명시 시에만
- API 키 로그 출력 금지

## Football Provider (API-Football)

SportsProvider / Odds / EDGE Engine 과 **독립**.  
**연결:** `GET /api/games`가 날짜·종목 조건에 따라 football fixtures를 병합.  
전용 UI 페이지는 없음. `GET /api/football/fixtures` 제공.

```
FOOTBALL_PROVIDER=api-football
FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
FOOTBALL_API_KEY=...   # Header: x-apisports-key
```

- HTTP 200 + `[]` = 경기 없음 (오류 아님, Dummy 가짜 경기 미혼합)
- Dummy: `FOOTBALL_PROVIDER=dummy` 명시 시에만

## API-Sports baseball stub

구현 위치: `src/lib/sports/apisports-provider.ts`  
야구 API-Sports 스텁이며, 축구는 `src/lib/football` 을 사용한다.

## 제품 현황

더 넓은 기능 분류·우선순위는 루트 [`ROADMAP.md`](../ROADMAP.md) 참고.
