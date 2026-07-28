# YANG EDGE

**AI가 왜 그렇게 판단했는지 설명하는 AI 스포츠 분석 플랫폼**을 목표로 하는 프로젝트입니다.  
단순 승패 예측이 아니라, 검증된 데이터로 판단 근거·신뢰도·위험·시장 차이·주요 변수를 사용자가 이해하기 쉽게 보여주는 것이 제품 UX의 핵심입니다.

**현재 단계:** `PRIVATE_RESEARCH_PROTOTYPE` — 찬양님 개인용 연구 파이프라인·Viewer·복기가 우선입니다.  
**정식 추천 서비스·유료 멤버십·공개 성과 홍보가 아닙니다.** 홈 분석 수치는 Dummy Engine **샘플**(라벨 표시)이며 실추천이 아닙니다.

**지원 종목 (제품 범위):** 야구 · 축구 · 농구 · 배구. 테니스 등 그 외 종목은 지원 대상이 아닙니다.  
**리그 범위:** 유명 리그 고정 목록이 아니라 **배트맨에 실제 편성된 경기**를 기준으로 후보를 잡습니다(비주류 리그 포함 가능). 배트맨 무단 크롤링·로그인 자동화는 금지이며, 일정·통계는 적법한 Provider로만 수집합니다. 상세: [PROJECT_MEMORY.md](./PROJECT_MEMORY.md) §24.

**설명 정책:** LLM·자연어 설명은 구조화되고 검증된 artifact만 사용합니다. 새 사실·근거를 창작하거나 미수집 데이터를 추정하지 않습니다. 없는 데이터는 미수집·연구 대기·검증 전으로 표시합니다.

## 현재 상태

코드 기준 사실과 우선순위는 **[ROADMAP.md](./ROADMAP.md)** 를 보세요.  
Provider·환경변수·API는 **[docs/API.md](./docs/API.md)** 를 보세요.

요약:

- **실일정:** NPB/KBO는 provider 실데이터 기반이며, KBO identity는 현재 `KBO_IDENTITY_PROVIDER` 기본값 `API_BASEBALL` full-slate artifact를 우선 사용한다 (legacy TheSportsDB artifact preserved)
- **홈:** 일정은 Provider 실데이터 · **TODAY EDGE PICK**은 현재 KST 이후 가장 가까운 연구 슬레이트만 사용하며, 엄격 기준 미충족 시 연구 후보 fallback을 제공한다 (종료 경기·과거 snapshot fallback 없음, 최대 3경기)
- **EDGE Score:** artifact·Engine의 **signed home-side** 연구값이며, 음수는 양수로 강제 변환(`Math.abs`)하지 않는다 — UI는 예측 팀 기준 우위 여부로 표시 ([EDGE_SCORE_SEMANTICS.md](./EDGE_SCORE_SEMANTICS.md))
- **분석 Engine 입력:** 현재 dummy gameId 일부만 (실일정과 ID 체계가 다를 수 있음)
- **개인 가계부:** `/ledger` — 브라우저 localStorage 전용
- **Feedback / Learning:** MLB post-game 후 `refresh-site-feedback-learning` (export → dashboard)로 갱신 · 페이지는 `force-dynamic`

## Getting Started

```bash
npm install
# docs/API.md 환경변수 표를 참고해 .env.local 작성 (Git 미포함)
# 연구 npm alias(`research:*`)는 devDependency로 고정된 로컬 `tsx`로 실행됩니다.
npm run dev
```

[http://localhost:3000](http://localhost:3000)

```bash
npm run lint
npm run build
```

## MLB 연구 파이프라인 (수동 + npm alias)

예측 스냅샷 동결(`save-mlb-research-prediction-snapshot.ts`)은 **수동 human gate** — 자동화하지 않습니다.

날짜 인자가 필요한 명령은 `npm run <script> -- YYYY-MM-DD` 형태로 전달합니다.

**Canonical full-slate 순서 (Final 이후):**

1. `npm run research:postgame -- DATE`
2. `npm run research:starter -- DATE`
3. `npm run research:bullpen-validate -- DATE --skip-postgame-steps`
4. `npm run research:lineup -- DATE`
5. `npm run research:ops -- DATE`

Bullpen Validation만 단독 실행할 때는 `--skip-postgame-steps` 없이 실행 가능합니다 (grade + flow review + bullpen + site refresh superset).

| npm script | 설명 |
|------------|------|
| `research:status` | Read-only pipeline readiness for DATE; outputs **currently needed** commands only (`npm run research:status -- YYYY-MM-DD`) |
| `research:postgame` | Grade → flow reviews → Feedback/Learning (canonical lifecycle) |
| `research:starter` | Starter accumulation + summary tail |
| `research:bullpen` | Bullpen role dataset v1.1 builder only |
| `research:bullpen-validate` | Bullpen v1.1 date validation (`--skip-postgame-steps` 지원) |
| `research:lineup` | Lineup dataset v1 (전체 slate graded일 때만 생성) |
| `research:ops` | correlation → ledger → severity → dashboard → starter summary |
| `research:dashboard` | Dataset coverage dashboard만 |
| `research:starter-summary` | Starter accumulation summary만 |
| `research:lineup-probe` | Pre-game lineup availability probe (append-only) |
| `research:kbo-identity` | KBO Schedule/Result Identity dataset v1 (`YYYY-MM-DD`) |
| `research:kbo-odds-comparison` | KBO 국내/해외 배당 비교 dataset v1 (`YYYY-MM-DD`) |
| `research:kbo-slate-readiness` | KBO 오늘 슬레이트 / 배당 입력 readiness audit (`YYYY-MM-DD`, 생략 시 KST today) |
| `research:kbo-operator-input` | KBO 배트맨 scope / proto odds 수동 입력 validator (`YYYY-MM-DD`, 생략 시 KST today) |
| `research:kbo-operator-markets` | KBO 통합 Game/Market/Selection v2 입력 validator (`YYYY-MM-DD`, 생략 시 KST today) |

KBO identity provider 선택:

```bash
# default: API_BASEBALL
npm run research:kbo-identity -- 2026-07-28

# PowerShell example: legacy TheSportsDB artifact rebuild
$env:KBO_IDENTITY_PROVIDER="THESPORTSDB"; npm run research:kbo-identity -- 2026-07-28
```

KBO odds comparison preview:

- route: `/kbo/odds-preview`
- scope: internal research preview only
- policy: 운영자 입력 국내 배당과 해외 Provider 배당의 단순 비교이며 추천·구매 지시가 아닙니다.

Research ops 실행 순서 (`research:ops`):

1. `audit-dataset-correlation-v1`
2. `build-contradiction-ledger-v1`
3. `build-contradiction-severity-audit-v1`
4. `build-dataset-coverage-dashboard-v1`
5. `summarize-mlb-starter-accumulation-v1`

자세한 감사·자동화 범위는 [RESEARCH_PIPELINE_AUTOMATION_AUDIT_V1.md](./RESEARCH_PIPELINE_AUTOMATION_AUDIT_V1.md) 참고.

## 주요 경로

| 경로 | 설명 |
|------|------|
| `/` | 홈 — 일정=Provider · Today Pick/Featured=Dummy 샘플(라벨 표시) |
| `/games` | 일정 — 종료(graded) MLB 카드에 최종 스코어·예측 적중/실패·예측 팀 표시 |
| `/ledger` | 개인 베팅 가계부 (localStorage) · 종목은 **개인 기록 분류** (EDGE 분석 지원과 별개 · 신규 선택: 야구·축구·농구·배구·기타) |
| `/picks` | EDGE Ranking — **공개 UI 비노출(HIDDEN)** · 고정 샘플 · 직접 URL만 · noindex |
| `/toto` | EDGE Combo — **공개 UI 비노출(HIDDEN)** · 직접 URL만 · 추후 축구 연구 재개 시 검토 · 실 Provider에서는 데이터 없음 |
| `/analysis/[gameId]` | Research Analysis Viewer v1 — 요약 우선·기술 정보 접기 · Status=`COLLECTED`/`PARTIAL`/`AWAITING_RESEARCH` · noindex |

## 보안

- API 키는 `NEXT_PUBLIC_*` 에 넣지 않습니다.
- `.env.local` 은 Git에 커밋하지 않습니다.
