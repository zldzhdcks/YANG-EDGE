# YANG EDGE

개인용 AI 스포츠 분석·일정·가계부 프로토타입 (Next.js).

## 현재 상태

코드 기준 사실과 우선순위는 **[ROADMAP.md](./ROADMAP.md)** 를 보세요.  
Provider·환경변수·API는 **[docs/API.md](./docs/API.md)** 를 보세요.

요약:

- **실일정:** TheSportsDB (NPB/KBO) — `SPORTS_PROVIDER` + `.env.local` 필요
- **홈:** 일정은 Provider 실데이터 · 분석(Today Pick/Featured)은 **Dummy Engine 샘플** (공통 샘플 배너)
- **분석 Engine 입력:** 현재 dummy gameId 일부만 (실일정과 ID 체계가 다를 수 있음)
- **개인 가계부:** `/ledger` — 브라우저 localStorage 전용
- **Feedback / Learning:** MLB post-game 후 `refresh-site-feedback-learning` (export → dashboard)로 갱신 · 페이지는 `force-dynamic`

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
| `/` | 홈 — 일정=Provider · Today Pick/Featured=Dummy 샘플(라벨 표시) |
| `/games` | 일정 — 종료(graded) MLB 카드에 최종 스코어·예측 적중/실패·예측 팀 표시 |
| `/ledger` | 개인 베팅 가계부 |
| `/picks` | EDGE Ranking — **공개 UI 비노출(HIDDEN)** · 고정 샘플 · 직접 URL만 · noindex |
| `/toto` | EDGE Combo — **공개 UI 비노출(HIDDEN)** · 직접 URL만 · 추후 축구 연구 재개 시 검토 · 실 Provider에서는 데이터 없음 |
| `/analysis/[gameId]` | Research Analysis Viewer v1 — 요약 우선·기술 정보 접기 · Status=`COLLECTED`/`PARTIAL`/`AWAITING_RESEARCH` · noindex |

## 보안

- API 키는 `NEXT_PUBLIC_*` 에 넣지 않습니다.
- `.env.local` 은 Git에 커밋하지 않습니다.
