# FOOTBALL HISTORICAL DATA SOURCE GATE V1

검토일: 2026-09-09 KST / API 확인 14:34~14:37 UTC. BASE_SHA: `1b90cdd3d406dd2991f79fe0836c32d8ba08e4b9`.
별도 branch: `agent/astra/football-historical-source-gate-v1`. Owner Risk Manager checkout과 분리.

## 최종 판정

- FOOTBALL_HISTORICAL_PRIMARY_SOURCE = API-Football / API-Sports v3, 기존 직접 연결 계정
- FIRST_TARGET_LEAGUE = English Premier League, provider league ID 39
- FIRST_TARGET_SEASONS = 2023/24 + 2024/25 (API season 2023, 2024)
- EXPECTED_USABLE_MATCHES = 약 760개의 결과 행, 전체 수집·완전성 검증 전 예상치
- HISTORICAL_RESULT_ACQUISITION_PATH_FEASIBLE = YES, 현재 Free 계정의 허용 시즌·공식 시즌/라운드 API 경로
- BACKTEST_DATA_PATH_FEASIBLE = NO, 현재 봉인된 strict observation 계약 기준
- STRICT_ASOF_EVALUABLE_MATCHES_ADDED = 0
- SOURCE_ADMISSION = 기술적 수집 경로 선정. 공개·상업 라이선스 승인이나 무기한 아카이브 권리 확인을 의미하지 않음.

**무료 과거 결과 수집 경로는 찾았다. 그러나 데이터 수집만으로 봉인된 backtest를 실행 가능하게 만들었다고 보고할 수 없다.** 약 760은 두 시즌 결과 데이터 규모이며 예측 가능 표본 수가 아니다. 전체 시즌을 내려받지 않았으므로 확정 수량도 아니다.

## 저장소와 실제 계정에서 확인한 것

1. `src/lib/football/get-football-provider.ts`는 기존 `FOOTBALL_API_KEY`로 `https://v3.football.api-sports.io`에 직접 연결한다. 현재 설정은 apifootball. 키 값·계정 이름·이메일은 출력·저장하지 않았다.
2. `api-football-provider.ts:getFixtures`는 date를 필수 검증한다. 현재 Free의 과거 date 필터 제한 때문에 이 메서드를 과거 시즌 수집에 그대로 쓰면 실패한다. 기존 메서드는 수정하지 않는다. 다음 미션은 독립 research season adapter를 만든다.
3. 공식 `/status`: HTTP 200, Free, active=true, 100 requests/day. 최초 확인 current=1. 이 미션의 원격 공식 API 요청은 총 7회. 첫 sandbox 연결 실패는 응답을 받지 못했고 유효한 probe로 세지 않는다.
4. `/leagues?id=39`: EPL 시즌 목록 2010~2026. 목록에 있다는 사실은 계정의 모든 시즌 접근권을 뜻하지 않는다.
5. 과거 date 쿼리 2023-08-11 및 2024-08-16은 HTTP 200이지만 `errors.plan`에 날짜 제한을 반환했다. 2025 쿼리는 Free 허용 시즌이 2022~2024라는 오류를 반환했다. HTTP status만 검사하면 잘못된 성공 판정이 된다.
6. 공식 `round` 필터로 허용 시즌 2023, 2024의 첫 라운드를 요청하니 각각 HTTP 200, errors=[], results=10, paging=1/1이었다. 이는 제공자가 안내한 허용 시즌과 문서화된 필터의 정상 사용이며 제한 시즌 접근/다계정/차단 우회를 하지 않았다.
7. 각각 첫 행의 필수 필드를 검토했다: fixture 1035037, Burnley–Manchester City, 2023-08-11T19:00:00+00:00, FT 0–3; fixture 1208021, Manchester United–Fulham, 2024-08-16T19:00:00+00:00, FT 1–0. 두 응답 총 20행은 소규모 접근성 probe이며 전체 데이터셋 검증은 아니다.
8. SportsDataIO 키는 있으나 기존 코드는 MLB 전용이고 축구/Vault 계약·권한을 증명하는 자료는 확인하지 못했다. 이를 축구 구독으로 간주하지 않았다. football-data.org 키는 확인되지 않았다. 타 계정 등록·구매·메일 발송 없음.

안전하게 요약한 probe는 `docs/evidence/football-historical-source-gate-v1.json`. 전체 provider payload, 인증 헤더, Owner private 기록은 포함하지 않는다.

## 후보 1 — 선정: API-Football

- SOURCE: API-Sports의 공식 API `v3.football.api-sports.io`. EPL 자체가 운영하는 API라는 뜻은 아니다. 기존 프로젝트의 축구 research source와 동일하다.
- LEGAL / TERMS STATUS: API 이용과 프로젝트 작성은 약관에 제시되어 있고, 공식 가이드는 로컬 DB/cache 사용과 시즌 fixture 조회를 설명한다. 데이터 직접 재판매는 금지된다. 약관은 제3자 리그의 이용·공개·상업 권리를 부여하지 않으며 필요한 허가 확인은 이용자 책임으로 둔다. 따라서 이번 선정은 비공개 연구용 API 경로 선정이며 EPL 전체 권리의 법률상 확정 판정이 아니다. 다음 수집 전 실제 사용범위, 결과 보관기간·계약 종료 후 보관, 모델 연구 이용조건을 기록하고 불명확하면 제공자 서면 확인 후 진행한다. 공개/회원/상업 배포는 이 승인에 포함되지 않는다. [약관](https://www.api-football.com/terms)
- LEAGUES: EPL 39 우선. La Liga 등 다른 리그는 이번 범위 밖. [공식 안내](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide)
- SEASONS AVAILABLE: EPL catalog 2010~2026; 현재 Free의 2023·2024는 작은 실응답으로 확인. 2022는 오류 안내상 허용 범위이나 미검증. 2025는 plan-blocked. catalog와 entitlement를 분리한다.
- EXPECTED MATCH COUNT: EPL 한 시즌 380 × 2 = 760 예상. 실제 확인은 첫 라운드 10 × 2. 시즌 전체 중복·취소·재편성·누락 여부는 다음 미션에서 확인. [시즌 조회 설명](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide)
- FIELDS AVAILABLE: `fixture.id`, `fixture.date`(+timezone), `fixture.timestamp`, `fixture.status.short`, `teams.home/away.id/name`, `score.fulltime.home/away`, `league.id/name/season`를 작은 응답에서 확인. FT와 유효한 fulltime 정수 필터를 적용한다. goals 총점으로 임의 대체하지 않는다.
- FIXTURE ID QUALITY: provider numeric fixture ID 및 team ID가 제공되어 이름/시간 합성 ID보다 적합. 기존 namespace `soccer-api-football-{id}`, `fb-team-v1-api-football-{id}`, `fb-comp-api-football-{id}`를 재사용 가능. ID 영구 불변의 계약 보장이나 삭제·재발급 부재를 검증한 것은 아니다. 충돌은 격리한다.
- HISTORICAL OBSERVATION / AS-OF LIMITATION: 샘플 fixture에는 최초 결과 공개/관측 시각·버전 이력이 없다. date/timestamp는 kickoff이고 periods는 경기 단계 시작 시각이다. 현재 회수한 최종 상태를 과거 당시 상태로 주장할 수 없다.
- COST: 이번에 확인한 2023·2024 경로는 현재 Free, $0, 100/day. 최신/다른 시즌이 필요하면 공식 Pro $19/month, 7,500/day가 후보지만 이번 미션은 구매하지 않았고 필요하다고 단정하지 않는다. [가격](https://www.api-football.com/pricing)
- IMPLEMENTATION DIFFICULTY: 낮음~중간. 독립 season 조회, 현재 응답 오류 확인, 원본 해시·실제 관측 시각·완전성 검증이 필요하다. 기존 날짜 필수 wrapper를 변경할 이유는 없다.
- RISKS: Free 범위 변경, null/수정된 결과, 원본 보관권 미확정 부분, 과거 observation 부재, 365일 window, 이름 기반 join 오류. odds/predictions endpoint는 사용하지 않는다.

## 후보 2 — 대안: football-data.org ML Pack Light

- SOURCE: 공식 API `api.football-data.org/v4`, 새 연결 필요.
- LEGAL / TERMS STATUS: 등록·단일 application·fair use·출처표시 조건이 있다. 구독 종료 후 자체 site/service에서 API 데이터를 참조할 수 없다는 조항이 있으므로 단기 구독 후 영구 사용 가능하다고 가정하지 않는다. 내부 아카이브/모델 사용·종료 후 보관은 필요시 서면 확인. [약관 §2,3,7,9](https://www.football-data.org/about)
- LEAGUES: EPL, Bundesliga, La Liga, Serie A, Ligue 1 등 12개 대회 패키지. [coverage](https://www.football-data.org/coverage)
- SEASONS AVAILABLE: ML Pack Light는 10시즌 이력을 명시한다. EPL 2023·2024가 그 범위의 후보이나 현재 계정으로 요청해 검증하지 않았다. Free의 과거 2시즌을 보장하지 않는다. [가격](https://www.football-data.org/pricing)
- EXPECTED MATCH COUNT: EPL 2시즌 약 760 예상; 실제 응답·완전성 미검증.
- FIELDS AVAILABLE: 문서상 match `id`, `utcDate`, `homeTeam/awayTeam.id/name`, `competition`, `season`, `status`, `score.duration/fullTime.home/away`. 정규시간 결과만 허용해야 한다. [match 문서](https://docs.football-data.org/general/v4/match.html)
- FIXTURE ID QUALITY: 문서상 고유 resource ID. 기존 API-Football ID와 서로 다른 namespace이므로 검증된 crosswalk 없이는 합치지 않는다.
- HISTORICAL OBSERVATION / AS-OF LIMITATION: `lastUpdated`는 최신 수정 시각이지 우리 시스템의 당시 관측 또는 최초 공개 시각이 아니다. historical revision/as-of 재현이 문서에서 확인되지 않았다.
- COST: ML Pack Light €29/month + 적용 시 VAT, 20 calls/minute. 새 계정/구독 필요; 이번에 등록·구매하지 않았다.
- IMPLEMENTATION DIFFICULTY: 중간. 새 인증·adapter·ID 연결·종료 후 데이터 관리가 필요.
- RISKS: 권리·보관 조건, 고유 ID 전환, 미검증된 season entitlement, as-of 부재. 배당 addon은 불필요.

## 후보 3 — 기존 타종목 연결 대안: SportsDataIO Soccer / Vault

- SOURCE: SportsDataIO 공식 Soccer/Vault API. 기존 MLB 연결의 자격을 자동 승계하지 않는다.
- LEGAL / TERMS STATUS: use case/feed별 라이선스를 체결하며 통계모델 이용과 계약 종료 후 보관은 개별 계약으로 정할 수 있다. 이 저장소의 Soccer/Vault 계약은 확인되지 않았다. Scrambled trial은 프로젝트 규칙상 영구 제외. [권리 FAQ](https://sportsdata.io/help/data-rights-and-licensing-questions)
- LEAGUES: EPL 등 Soccer 경쟁대회 중 계약한 범위만. [Soccer coverage](https://sportsdata.io/soccer-confirmed-coverage)
- SEASONS AVAILABLE: 공식 소개는 대부분 리그 2015 이후, EPL 등은 더 긴 이력을 설명한다. 실제 대상 시즌/필드는 계약으로 확인해야 하며 현재 entitlement는 UNKNOWN. [Vault 안내](https://sportsdata.io/help/historical-data-integration-guide)
- EXPECTED MATCH COUNT: EPL 2시즌 760이 계약 요청 목표; 검증된 제공 수량 아님.
- FIELDS AVAILABLE: 문서 Game의 `GameId`, `DateTime`(UTC), team IDs/names, Season, RoundId 및 대회 메타데이터, scores, Period. Final+Regular에 한정해 정규시간 의미를 검증해야 한다. [데이터 사전](https://sportsdata.io/developers/data-dictionary/soccer)
- FIXTURE ID QUALITY: GameId 및 전종목 고유 GlobalGameId가 문서화돼 있다. 기존 canonical ID로의 직접 치환은 불가.
- HISTORICAL OBSERVATION / AS-OF LIMITATION: `UpdatedUtc`는 최신 수정 시각. Vault의 최종 결과 이력과 당시 응답 버전 보관은 다르다. 최초 결과 공개/수정 버전 로그 제공 여부는 별도 확인 필요.
- COST: 견적 및 sales-enabled historical access 필요. 공개 고정 Soccer 견적은 확인되지 않았으며 MLB 키 보유를 무료 권리로 해석하지 않는다. [개발자 안내](https://sportsdata.io/developers)
- IMPLEMENTATION DIFFICULTY: 높음. 계약·새 feed·namespace 매핑·non-scrambled 검증 필요.
- RISKS: 미확인 권한/가격/리그별 범위, trial 변조 데이터, as-of 부재. 현재 선정하지 않는다.

## temporal gate가 별도로 막히는 이유

봉인 모델은 `resultObservedAt < cutoffAt < target.kickoffAt`와 과거 kickoff 및 365일 window를 요구한다. 과거 결과를 오늘 가져오면 `retrievedAt`은 오늘이다. 2023/24 target을 평가하면서 이를 2023년 관측값으로 바꾸면 실제 관측을 위조하는 것이다.

- kickoff+2시간, mtime, 파일명 날짜, period 시작 시각, 최신 수정 시각을 최초 관측으로 대입하지 않는다.
- 오늘 받아 만든 archive는 `RETROSPECTIVE_FINAL_STATE`로 구분한다. 결과 정확성, 표본 확보 및 향후 별도 event-time 연구 설계에 쓸 후보이지 기존 strict backtest 입력 승인이 아니다.
- 두 선택 시즌은 현재 365일 lookback도 지나 있다. 현재 실시간 예측의 즉시 training 해법이라고 표현하지 않는다.
- 실제 당시 캡처/검증 가능한 결과 공개·버전 증거를 얻거나, 별도 승인된 retrospective 연구 계약을 설계해야 historical evaluation로 넘어갈 수 있다. 이번에는 어느 것도 엔진에 반영하지 않는다.

## 다음 미션

`FOOTBALL_EPL_HISTORICAL_RESULT_ARCHIVE_INGEST_V1`의 정확한 실행 지시와 중단 조건은 [HANDOFF](FOOTBALL_HISTORICAL_INGEST_HANDOFF_V1.md)에 기록했다. 목표는 두 시즌 결과 아카이브와 품질 보고서이며 Poisson 실행·backtest·weight 변경은 포함하지 않는다.

이번 변경은 문서와 접근성 evidence만이다. ENGINE_CHANGED=NO, PREDICTION_CHANGED=NO, RESEARCH_MODEL_CHANGED=NO, OWNER_PRIVATE_DATA_USED=NO, ODDS_USED=NO, BULK_INGEST=NO, BACKTEST_EXECUTED=NO. 웹은 공식 약관·문서 확인에만 사용했고 경기 웹사이트 HTML scraping은 하지 않았다. main merge/push 없음.
