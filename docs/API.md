# YANG EDGE — API / Sports Provider 가이드

## 데이터 흐름

```
화면 (Home / Games / Analysis / EDGE Combo)
  → getSportsProvider()
      ├─ DummyProvider         (constants)
      ├─ TheSportsDbProvider   (테스트용 TheSportsDB v1)
      └─ ApiSportsProvider     (준비용 스텁 → 실패 시 Dummy 폴백)

/api/* Route Handler 도 동일하게 getSportsProvider() 사용
```

## Provider 선택 (`SPORTS_PROVIDER`)

| 값 | Provider |
|----|----------|
| `dummy` | DummyProvider |
| `thesportsdb` | TheSportsDbProvider (+ Dummy 폴백) |
| `apisports` | ApiSportsProvider 스텁 (+ Dummy 폴백) |
| `api` (하위 호환) | thesportsdb 와 동일 |

미지정 시: URL에 `thesportsdb.com` 포함 → thesportsdb, URL만 있으면 apisports, 없으면 dummy.

## 파일 구조

```
src/lib/sports/
  types.ts
  get-provider.ts          ← Factory
  dummy-provider.ts
  thesportsdb-provider.ts  ← 테스트용 (현재 동작)
  apisports-provider.ts    ← API-Sports 준비용 (TODO)
```

## 보안 (중요)

- **API 키·시크릿은 절대 `NEXT_PUBLIC_*` 에 넣지 않는다.**
- `SPORTS_API_KEY`, `SPORTS_API_BASE_URL` 은 서버 전용.

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

## 브라우저 테스트 (Dummy 모드)

- http://localhost:3000/api/games
- http://localhost:3000/api/today-games
- http://localhost:3000/api/today-pick
- http://localhost:3000/api/featured
- http://localhost:3000/api/analysis/npb-softbank-orix
- http://localhost:3000/api/toto/current

## TheSportsDB v1 (테스트용)

```
SPORTS_PROVIDER=thesportsdb
SPORTS_API_BASE_URL=https://www.thesportsdb.com/api/v1/json
SPORTS_API_KEY=123   # 무료 공용 테스트 키 (서버 전용)
```

URL 형식: `{BASE}/{KEY}/{endpoint}`

| 메서드 | TheSportsDB | 비고 |
|--------|-------------|------|
| `getGames` | `eventsday.php?d=&l=` | NPB(`4591`) / KBO(`4830`) → `GameData[]` |
| 그 외 | 없음 | throw → DummyProvider 폴백 |

### 무료 플랜 제한

- `eventsday`: **요청당 최대 3건** (리그별 호출 시 NPB 3 + KBO 3)
- `eventsnextleague` / `eventspastleague`: **요청당 최대 1건**
- EDGE 분석·Combo·Pick·Featured: API에 없음 → 항상 Dummy 폴백
- **사용자 화면에는 무료 제한을 표시하지 않는다.** (개발 문서·코드 주석 전용)

검증: `npx tsx --env-file=.env.local scripts/verify-thesportsdb.ts`

## Odds Provider (The Odds API)

SportsProvider / EDGE Engine 과 **독립**. UI 미연결. 실패해도 `/games` 에 영향 없음.

```
src/lib/odds/
  types.ts
  odds-provider.ts
  dummy-odds-provider.ts      ← ODDS_PROVIDER=dummy 명시 시에만
  the-odds-api-provider.ts
  get-odds-provider.ts
  match-odds-to-game.ts
  cache.ts                    ← 동일 요청 5분 캐시
  index.ts
```

```
ODDS_PROVIDER=the-odds-api
ODDS_API_BASE_URL=https://api.the-odds-api.com/v4
ODDS_API_KEY=...   # 서버 전용
```

| 엔드포인트 | 설명 |
|------------|------|
| `GET /api/odds?sportKey=` | 배당 목록 + usage 메타 |
| `GET /v4/sports` (외부) | 활성 KBO/NPB key 자동 확인 (쿼터 미차감) |
| `GET /v4/sports/{key}/odds` | regions=eu, markets=h2h, decimal |

- 내재 확률 = `1 / decimal` (마진 제거 전)
- `matchOddsToGame()` 로 GameData 안전 매칭 준비
- API 키 로그 출력 금지

검증: `npx tsx --env-file=.env.local scripts/test-odds-api.ts`

## Football Provider (API-Football)

SportsProvider / OddsProvider / EDGE Engine 과 **독립**. UI·`/games` 미연결.

```
src/lib/football/
  types.ts
  football-provider.ts
  dummy-football-provider.ts   ← FOOTBALL_PROVIDER=dummy 명시 시에만
  api-football-provider.ts
  get-football-provider.ts
  map-fixture-to-game.ts
  cache.ts                     ← fixtures 10분 / standings·stats 1시간
  index.ts
```

```
FOOTBALL_PROVIDER=api-football
FOOTBALL_API_BASE_URL=https://v3.football.api-sports.io
FOOTBALL_API_KEY=...   # Header: x-apisports-key
```

| 엔드포인트 | 설명 |
|------------|------|
| `GET /api/football/fixtures?date=` | fixtures → GameData[] + usage 메타 |
| `GET /api/football/fixtures?date=&leagueId=39` | EPL 등 리그 필터 |
| `GET /status` (외부) | 계정·일일 한도 |
| `GET /fixtures` (외부) | timezone=Asia/Seoul |

- HTTP 200 + `[]` = 경기 없음 (오류 아님, Dummy 가짜 경기 미혼합)
- 무료 한도 고려 캐시. API 키 로그 금지
- Free plan: **시즌 2022–2024만** 리그+시즌 필터 가능 (그 외 season 파라미터는 API 오류)
- standings / team stats / injuries / lineups 메서드 스켈레톤 포함

검증: `npx tsx --env-file=.env.local scripts/test-api-football.ts`

## API-Sports baseball stub (기존)

구현 위치: `src/lib/sports/apisports-provider.ts`  
야구 API-Sports 스텁이며, 축구는 `src/lib/football` 을 사용한다.
