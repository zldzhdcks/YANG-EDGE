# YANG EDGE Roadmap

코드 기준 현황 문서입니다. 홍보 문구가 아니라 **현재 저장소에서 확인된 동작**을 적습니다.
완료되지 않은 항목에 완료 표시를 하지 않습니다.

## 제품 단계 (July 2026)

| 단계 | 코드 | 설명 |
|------|------|------|
| **현재** | `PRIVATE_RESEARCH_PROTOTYPE` | 찬양님 단독 사용 · MLB 연구 파이프라인 · Viewer·복기 우선 · 공개 UI는 일정 + **라벨된 샘플** 분석 |
| **미래** | `PUBLIC_AI_SPORTS_ANALYSIS_PLATFORM` | “AI가 왜 그렇게 판단했는가”를 설명하는 공개 제품 — **데이터·법적·표본·Backtest 게이트 통과 전 구현 금지** |

제품 비전·설명 정책·법적 경계: [PROJECT_MEMORY.md §22](./PROJECT_MEMORY.md#22-product-vision-and-direction-july-2026) · [Development & Compliance Charter](./docs/DEVELOPMENT_COMPLIANCE_CHARTER.md)  
종목·배트맨 편성 범위: [PROJECT_MEMORY.md §24](./PROJECT_MEMORY.md#24-supported-sports-and-betman-배트맨-scope) · [MULTI_SPORT_RESEARCH_BOUNDARY.md](./MULTI_SPORT_RESEARCH_BOUNDARY.md)  
해외 Historical Odds 사전 감사: [MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDIT_V1.md](./MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDIT_V1.md)  
Timeline Dataset 사전 설계: [HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md](./HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md) (`DESIGN_ONLY`)  
MLB h2h Historical 최소 Probe: [MLB_H2H_HISTORICAL_ODDS_PROBE_V1.md](./MLB_H2H_HISTORICAL_ODDS_PROBE_V1.md) — 현재 `PLAN_BLOCKED` (free plan)  
Historical 유료 도입 판단: [HISTORICAL_ODDS_PAID_PROVIDER_BUSINESS_DECISION_AUDIT_V1.md](./HISTORICAL_ODDS_PAID_PROVIDER_BUSINESS_DECISION_AUDIT_V1.md) — **HOLD**  
Market Intelligence Hypothesis Registry 사전 설계: [MARKET_INTELLIGENCE_HYPOTHESIS_REGISTRY_V1.md](./MARKET_INTELLIGENCE_HYPOTHESIS_REGISTRY_V1.md) (`DESIGN_ONLY` · Prediction Registry와 분리)

## 제품 원칙

- 개인용 우선
- 실데이터와 테스트 데이터 분리
- 확인되지 않은 분석값 노출 금지
- 법적·데이터 이용조건 준수
- 입력 최소화와 사람 친화적 UX

## 지원 종목 · 리그 범위 (문서 상태)

| 종목 | 제품 지원 범위 | 연구·제품 구현 상태 |
|------|----------------|---------------------|
| 야구 (BASEBALL) | 지원 | **MLB Research Pipeline = 활성 참조 구현** |
| 축구 (SOCCER) | 지원 | **NOT_STARTED / FUTURE_GATED** — Dataset·Engine 검증 전 |
| 농구 (BASKETBALL) | 지원 | **NOT_STARTED / FUTURE_GATED** |
| 배구 (VOLLEYBALL) | 지원 | **NOT_STARTED / FUTURE_GATED** |
| 테니스 및 기타 | **제외** | 명시적 결정·별도 법적·데이터 검토 전까지 비대상 |

**리그:** 유명 리그 고정 화이트리스트 없음. 배트맨에 **실제 편성**된 경기·리그(노르웨이 축구 등 비주류 포함)만 후보. 편성 확인 ≠ 배트맨 크롤링. 일정·결과·통계는 적법 Provider만.

## 현재 사용 가능

실제로 핵심 흐름이 동작하는 항목만 기재합니다.

| 기능 | 경로 / 위치 | 근거 |
|------|-------------|------|
| 개인 베팅 가계부 | `/ledger` | 브라우저 `localStorage` (`yang-edge:private-ledger:v1`). 서버 전송 없음 |
| 오늘 경기 일정 UI | `/games` | `SportsProvider.getGames` + (가능 시) football·odds 보강. **graded MLB는 카드에 최종 스코어·예측 적중/실패·예측 팀 표시** |
| 홈 상태 구분 | `/` | TODAY EDGE PICK v1.1 (upcoming 슬레이트) · 오늘 경기: `success` · `empty` · `error` · Dummy TodayPick/Featured **공개 홈 미노출** |
| 이용 안내(푸터) | 공통 Footer | 참고용·비보장·데이터 출처 원칙 문구 |
| 헤더 내비 | Header | `/games`, `/ledger`, Feedback/Learning 등 (EDGE Ranking `/picks`·EDGE Combo `/toto`는 공개 내비에서 HIDDEN) |
| Feedback / Learning | `/feedback`, `/learning` | MLB post-game export(`refresh-site-feedback-learning`) 후 mirror·dashboard 갱신 · `force-dynamic` |

## 부분 연결

어디까지 되고 무엇이 안 되는지 함께 적습니다.

| 기능 | 되는 것 | 안 되는 것 / 제한 |
|------|---------|-------------------|
| TheSportsDB 일정 | NPB·KBO `eventsday` → `GameData` 매핑, KST 변환 | 무료 키 **요청당 리그별 최대 3건**. 유료 키 전량 여부는 미검증 |
| 홈 TODAY EDGE PICK | `/` · `GET /api/today-edge-picks` | 연구 snapshot + Dataset completeness 기준 최대 3경기 · **현재 KST 이후 upcoming 슬레이트만** · 엄격 EDGE_PICK 미충족 시 **RESEARCH_CANDIDATE fallback** · 종료 경기 재노출 없음 · `force-dynamic` |
| 홈 Featured / 오늘 경기 요약 | 동일 `buildHomeFeed` + 샘플 안내 · analyzed=`샘플 분석` | Featured·분석 수는 Engine 가용 경기에 의존. 실일정만 있으면 0에 가까움 |
| `/api/games` odds | 키 있으면 h2h 매칭·표시 보강 | 키 없으면 일정만. 배당 매칭 실패 시 Value Edge 없음 |
| `/api/games` football | `FOOTBALL_API_KEY` 있으면 관심 리그 병합 | 키/한도 없으면 야구 일정만 또는 partial |
| `/analysis/[gameId]` | Research Analysis Viewer v1 — 요약 우선·기술 정보(hash/paths) 접기 · Status=`COLLECTED`/`PARTIAL`/`AWAITING_RESEARCH` | Engine 재계산 없음. 실 TheSportsDB 슬러그만으로는 snapshot 없으면 Awaiting |
| Value Edge | 야구 2-way + 배당 매칭 시에만 | 축구 3-way 모델 미지원. 홈 Pick도 동일 제약 |

## 테스트 전용

운영 화면처럼 오해되면 안 되는 항목입니다.

| 항목 | 위치 | 비고 |
|------|------|------|
| `DummyProvider` | `SPORTS_PROVIDER=dummy` **명시 시에만** | 고정일 `GAMES` 상수. 자동 폴백 없음 |
| Dummy Engine 분석 | `src/constants/dummyAnalysisData.ts` | `npb-softbank-orix`, `npb-hanshin-yomiuri`, `kbo-lg-doosan` |
| EDGE Ranking 페이지 | `/picks` | `AI_PICKS` 하드코딩. **공개 UI HIDDEN**(`EDGE_RANKING_PUBLIC_VISIBILITY`). 직접 URL + 샘플 배너 + noindex. Provider/실일정 미연결 |
| EDGE Combo 데이터 | `TOTO_ROUND` 등 | 공개 UI HIDDEN(`EDGE_COMBO_PUBLIC_VISIBILITY`). 직접 `/toto`만. TheSportsDB·ApiSports는 `getToto` throw. Dummy에서만 샘플 |
| TheSportsDB 공용 테스트 키 | 문서 예시 `123` | 무료 제한·테스트 목적. 키를 문서/로그에 실사용 값으로 추가하지 말 것 |
| Odds/Football Dummy | `ODDS_PROVIDER=dummy` / `FOOTBALL_PROVIDER=dummy` | 명시 선택만 |

## 현재 미구현

| 항목 | 상태 |
|------|------|
| 로그인 / 회원 | 내비 `로그인` → `/#login` (앵커·기능 없음) |
| 이용약관·개인정보처리방침 페이지 | Footer는 “준비 중” 표기 (페이지 없음) |
| `ApiSportsProvider` (야구) | 전 메서드 throw 스텁 |
| TheSportsDB `getAnalysis` / `getToto` | 의도적 throw |
| 실경기별 분석 입력 Provider | 일정 Provider와 분리된 Engine은 dummy만 |
| 경기 결과 자동 반영 · AI 성적표 | 코드 경로 없음 (데이터 폴더·스크립트는 연구/백테스트용) |
| 가계부 서버 동기화 · JSON 가져오기 | 내보내기만 있음 |
| 기기 간 가계부 동기화 | 미지원 (페이지 안내문 명시) |

## 다음 우선순위

1. 데이터 공급원 결정 및 실제 일정 완전성 확보 (무료 3건 제한 해소 또는 대체 소스)
2. 실제 경기별 분석 입력 Provider (실일정 `gameId`/`externalId`와 연결; dummy 수치를 실경기에 붙이지 말 것)
3. 경기 결과 자동 반영
4. 예측 기록 및 AI 성적표
5. Value Edge 구간별 검증
6. 개인 가계부 로그인·DB 동기화
7. 공개 전 법률·약관·개인정보·라이선스 검토

## MLB 연구 파이프라인 npm alias (v1)

날짜 인자: `npm run research:ops -- 2026-07-27`

**Full-slate 순서:** postgame → starter → bullpen-validate (`--skip-postgame-steps`) → lineup → ops

| Script | 역할 |
|--------|------|
| `research:postgame` | Postgame grade + flow reviews + site refresh |
| `research:starter` | Starter accumulation + summary |
| `research:bullpen-validate` | Bullpen validation (superset 또는 skip-postgame) |
| `research:bullpen` | Bullpen dataset v1.1 builder only |
| `research:lineup` | Lineup dataset (full slate graded only) |
| `research:ops` | Research ops chain (5 steps) |
| `research:dashboard` | Coverage dashboard only |
| `research:starter-summary` | Starter summary only |

`research:ops` 순서: correlation audit → contradiction ledger → severity → dashboard → starter summary.

예측 스냅샷 freeze는 수동 유지. 상세: [RESEARCH_PIPELINE_AUTOMATION_AUDIT_V1.md](./RESEARCH_PIPELINE_AUTOMATION_AUDIT_V1.md).

## KBO 연구 파이프라인 (v1 · 부분 구현)

| 단계 | 상태 |
|------|------|
| Schedule / Result Identity | READY (API-BASEBALL) |
| Operator Market / Odds | PARTIAL |
| Market Result Feedback | v1 observation only |
| **Starter** | **Operator Input v1** — validator ready; Prediction still BLOCKED |
| Prediction | NOT_IMPLEMENTED |

KBO Prediction은 선발 pre-game 소스 확보 전 구현 금지.

## Betman Daily Full-Slate Coverage v1 (internal)

| Surface | Status |
|---------|--------|
| Operator input | `data/operator-input/betman/{DATE}-daily-slate-v1.json` — manual / OCR-reviewed only |
| CLI | `npm run research:betman-slate -- YYYY-MM-DD` |
| Artifact | `data/research/daily-slates/{DATE}-betman-full-slate-v1.json` |
| Internal API | `GET /api/research/daily-slate?date=` |
| Viewer | Deferred — API + artifact only in v1 |
| Tennis | Excluded (`UNSUPPORTED_SPORT`) |

Doc: [BETMAN_DAILY_FULL_SLATE_COVERAGE_V1.md](./BETMAN_DAILY_FULL_SLATE_COVERAGE_V1.md)

## Multi-Sport Extraction (미래 단계 · 게이트 통과 전 착수 금지)

지원 종목은 야구·축구·농구·배구 네 가지로 제한한다. 두 번째 실제 종목 Dataset이 없으므로 **지금은 구현하지 않는다.** 경계: [MULTI_SPORT_RESEARCH_BOUNDARY.md](./MULTI_SPORT_RESEARCH_BOUNDARY.md) · [PROJECT_MEMORY.md §24](./PROJECT_MEMORY.md#24-supported-sports-and-betman-배트맨-scope)

| 단계 | 내용 |
|------|------|
| 1 | 첫 번째 비-MLB Research Dataset 구현 (실제 artifact + audit; Betman 편성·적법 데이터 게이트 통과 후) |
| 2 | MLB vs 신규 종목 common/different audit (`DATASET_COMMON_AUDIT` 방식) |
| 3 | **양쪽에서 반복 확인된** 구조만 Framework/Registry에 반영 |
| 4 | 종목별 Engine admission·Backtest는 각각 독립 통과 |

**금지:** MLB payload 일반화, placeholder builder, Multi-Sport 타입 선행 추가, 테니스 등 비지원 종목 schema 초안, 배트맨 크롤링.

## FUTURE_GATED (미구현 · 게이트 통과 전 착수 금지)

아래는 **미래 제품 후보**입니다. 구현 완료·출시 예정으로 기록하지 않습니다.

| 항목 | 설명 | DATA_VALIDATION | LEGAL_CLEARANCE | COMMERCIAL_READINESS |
|------|------|:---:|:---:|:---:|
| Membership (Free / Basic / Premium) | 유료는 검증된 설명 심화; 미검증 분석 판매 금지 | 필수 | 필수 (약관·개인정보·환불) | 필수 (사업자·세무) |
| OCR Admin Assist | 운영자 전용 수동 입력 보조; 회원 미제공 | 필수 | 필수 | 필수 |
| Korean Proto Value Edge | 프로토 배당 기반 Value Edge; source rights 미확인 | 필수 | 필수 (공식 사용·저장·재배포) | 필수 |
| Advertising | 수익 모델 후보 | 해당 시 | 필수 | 필수 |
| Public Accuracy Dashboard | 사전 저장 예측만; 표본·기간·시장 유형 공개 | 필수 (최소 표본·Backtest) | 필수 | 필수 |

게이트 정의:

- **DATA_VALIDATION** — 표본·Backtest·누수 감사·재현성·시장별 별도 검증
- **LEGAL_CLEARANCE** — 이용권·표시권·크롤링/자동화 금지 준수·약관
- **COMMERCIAL_READINESS** — 결제·환불·사업자·세무·고객 지원

## 제거·통합 검토 대상

이번 감사에서 **삭제하지 않고** 판단이 필요한 후보입니다.

| 후보 | 분류 | 근거 | 제안 |
|------|------|------|------|
| `/picks` + 내비「EDGE Ranking」 | C / E · **공개 UI HIDDEN** | 내비·홈 Hero·Footer 비노출. `AI_PICKS`·Pick 컴포넌트 유지. 직접 URL + 샘플 고지 + noindex | 실데이터 연동 전까지 공개 재개 금지 |
| `/toto` EDGE Combo | C / D · **공개 UI HIDDEN** | 내비·홈·Footer 비노출. 핵심 로직·데이터 유지. 직접 URL + 내부 안내 배너 | 축구 연구 재개 시 공개 여부 재검토 |
| 내비「로그인」 | D | placeholder | 제거 또는 비활성 표기 |
| 홈 Hero 보조 CTA | — | 샘플 Ranking 대신 `/ledger` (`내 가계부`) | 실 Ranking 공개 시 재검토 |
| 「Why YANG EDGE」섹션명 | F · **Featured로 변경** | Featured 샘플 그리드 + 공통 샘플 배너 | 제품 설명 카피는 COPY에서 분리 |
| `DummyProvider` 파일 | C (유지) | 명시적 개발 모드에 필요 | **삭제 금지** — 자동 폴백만 금지 유지 |
| README 구 create-next-app 문구 | 문서 | 제품과 무관 | 이번 작업에서 요약으로 교체 |

## 공개 전 필수 조건

- 정식 데이터 이용권한
- 테스트 데이터 미노출 (또는 명확한 테스트 배지·모드 분리)
- 정확도 비보장 안내
- 이용약관·개인정보처리방침
- 보안 및 접근통제
- 세무·사업자 검토
- 전체 API 비용과 호출량 검증

## 관련 코드 앵커

- Provider factory: `src/lib/sports/get-provider.ts` (Dummy는 `SPORTS_PROVIDER=dummy`만)
- 홈 피드: `src/lib/home/build-home-feed.ts`, `src/lib/api/today-pick.ts`, `src/lib/api/home-games.ts`
- Engine 입력: `src/lib/engine/analysis-data-provider.ts` → dummy constants
- 가계부: `src/app/ledger/page.tsx`, `src/lib/ledger/*`
- API 가이드: `docs/API.md`
