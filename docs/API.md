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

검증: `npx tsx --env-file=.env.local scripts/verify-thesportsdb.ts`

## API-Sports (다음 단계)

구현 위치: `src/lib/sports/apisports-provider.ts`  
현재는 스텁이며 선택해도 Dummy로 폴백된다.
