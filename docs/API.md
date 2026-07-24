# YANG EDGE — API 연동 가이드

## 데이터 흐름

```
화면 (Server Component)
  → lib/api/fetch*
      ① external-api   NEXT_PUBLIC_API_BASE_URL
      ② internal-api   /api/games | /api/analysis/:id | /api/toto/current
      ③ dummy          constants/* (최후 폴백)
```

## 보안 (중요)

- **API 키·시크릿은 절대 `NEXT_PUBLIC_*` 에 넣지 않는다.**
- `NEXT_PUBLIC_*` 는 브라우저에 노출된다.
- 외부 스포츠 API 키는 서버 전용 환경변수로만 둔다.
  - 예: `SPORTS_API_KEY` (서버 only)
  - 사용 위치: `src/app/api/**/route.ts` 또는 서버 전용 `lib` 코드
- `NEXT_PUBLIC_API_BASE_URL` 에는 **공개 베이스 URL만** 넣는다. (키 쿼리 금지)

## 환경변수

| 변수 | 공개 여부 | 용도 |
|------|-----------|------|
| `NEXT_PUBLIC_API_BASE_URL` | 공개 | 외부 API 베이스 URL (선택) |
| `SITE_URL` | 서버 | 내부 `/api` 자기호출 베이스 (선택) |
| `SPORTS_API_KEY` | 서버 | 외부 스포츠 API 키 (실연동 시) |

## 브라우저 테스트

- http://localhost:3000/api/games
- http://localhost:3000/api/analysis/npb-softbank-orix
- http://localhost:3000/api/analysis/unknown-id  (404)
- http://localhost:3000/api/toto/current

## 외부 스포츠 API 연결 시 교체 지점

1. `src/app/api/games/route.ts` — constants 대신 외부 API fetch
2. `src/app/api/analysis/[gameId]/route.ts` — 동일
3. `src/app/api/toto/current/route.ts` — 동일
4. 키는 `SPORTS_API_KEY` 등 서버 env로만 읽기

화면/`lib/api/fetch*` 는 그대로 두고, **Route Handler 내부만** 바꾸면 된다.
