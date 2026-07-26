# YANG EDGE

개인용 AI 스포츠 분석·일정·가계부 프로토타입 (Next.js).

## 현재 상태

코드 기준 사실과 우선순위는 **[ROADMAP.md](./ROADMAP.md)** 를 보세요.  
Provider·환경변수·API는 **[docs/API.md](./docs/API.md)** 를 보세요.

요약:

- **실일정:** TheSportsDB (NPB/KBO) — `SPORTS_PROVIDER` + `.env.local` 필요
- **분석 Engine 입력:** 현재 dummy gameId 일부만 (실일정과 ID 체계가 다를 수 있음)
- **개인 가계부:** `/ledger` — 브라우저 localStorage 전용
- **Dummy:** `SPORTS_PROVIDER=dummy` 일 때만. 운영 Provider 실패 시 자동 Dummy 대체 없음

## Getting Started

```bash
npm install
# docs/API.md 환경변수 표를 참고해 .env.local 작성 (Git 미포함)
npm run dev
```

[http://localhost:3000](http://localhost:3000)

```bash
npm run lint
npm run build
```

## 주요 경로

| 경로 | 설명 |
|------|------|
| `/` | 홈 (Today Pick, 오늘 경기, Featured) |
| `/games` | 일정 |
| `/ledger` | 개인 베팅 가계부 |
| `/picks` | EDGE Ranking — **현재 고정 샘플** (ROADMAP 참고) |
| `/toto` | EDGE Combo — **실 Provider에서는 데이터 없음** |
| `/analysis/[gameId]` | EDGE Detail — Engine 입력 있는 ID만 |

## 보안

- API 키는 `NEXT_PUBLIC_*` 에 넣지 않습니다.
- `.env.local` 은 Git에 커밋하지 않습니다.
