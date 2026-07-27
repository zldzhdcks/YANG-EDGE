# YANG EDGE Roadmap

코드 기준 현황 문서입니다. 홍보 문구가 아니라 **현재 저장소에서 확인된 동작**을 적습니다.
완료되지 않은 항목에 완료 표시를 하지 않습니다.

## 제품 원칙

- 개인용 우선
- 실데이터와 테스트 데이터 분리
- 확인되지 않은 분석값 노출 금지
- 법적·데이터 이용조건 준수
- 입력 최소화와 사람 친화적 UX

## 현재 사용 가능

실제로 핵심 흐름이 동작하는 항목만 기재합니다.

| 기능 | 경로 / 위치 | 근거 |
|------|-------------|------|
| 개인 베팅 가계부 | `/ledger` | 브라우저 `localStorage` (`yang-edge:private-ledger:v1`). 서버 전송 없음 |
| 오늘 경기 일정 UI | `/games` | `SportsProvider.getGames` + (가능 시) football·odds 보강. **graded MLB는 카드에 최종 스코어·예측 적중/실패·예측 팀 표시** |
| 홈 상태 구분 | `/` | Today Pick / Featured / 오늘 경기: `success` · `empty` · `error` 구분. **일정=Provider · 분석=Dummy 샘플 라벨** |
| 이용 안내(푸터) | 공통 Footer | 참고용·비보장·데이터 출처 원칙 문구 |
| 헤더 내비 | Header | `/games`, `/ledger`, Feedback/Learning 등 (EDGE Ranking `/picks`·EDGE Combo `/toto`는 공개 내비에서 HIDDEN) |
| Feedback / Learning | `/feedback`, `/learning` | MLB post-game export(`refresh-site-feedback-learning`) 후 mirror·dashboard 갱신 · `force-dynamic` |

## 부분 연결

어디까지 되고 무엇이 안 되는지 함께 적습니다.

| 기능 | 되는 것 | 안 되는 것 / 제한 |
|------|---------|-------------------|
| TheSportsDB 일정 | NPB·KBO `eventsday` → `GameData` 매핑, KST 변환 | 무료 키 **요청당 리그별 최대 3건**. 유료 키 전량 여부는 미검증 |
| 홈 Today EDGE Pick | 일정 로드 + Engine 파이프라인 + **연구용 샘플 분석** 배너 | Engine 입력이 **dummy gameId 3개뿐**. 실일정 ID와 불일치 → Pick 비는 것이 정상일 수 있음. **실추천 아님** |
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
