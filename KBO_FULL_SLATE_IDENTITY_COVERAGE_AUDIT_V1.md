# KBO Full Slate Identity Coverage Audit v1

대상 날짜 `2026-07-28`의 KBO 운영 입력 5경기 중 TheSportsDB identity에 없는 2경기를 포함해, 전체 5경기의 신원을 적법하고 재현 가능한 방식으로 확보할 수 있는지 읽기 전용으로 감사한 문서다.

## Current state

- TheSportsDB identity coverage: 3 games
- Operator market v2: 5 games, 40 markets, 90 selections
- Unmatched:
  - 삼성 라이온즈 vs KIA 타이거즈
  - SSG 랜더스 vs 두산 베어스

## Current provider limitation

TheSportsDB documentation and current repo behavior both confirm:

- endpoint: `eventsday.php`
- filter: `leagueId=4830`
- free limit: `3`
- premium docs mention much larger schedule-day limits

따라서 현재 무료 TheSportsDB만으로는 07-28 전체 5경기를 full slate identity로 확정할 수 없다.

## Verified alternative coverage

현재 환경에서 API-BASEBALL query (`league=5`, `season=2026`)로 2026-07-28 KBO 5경기가 실제 조회되었다.

확인된 provider rows:

- Hanwha Eagles vs Lotte Giants -> gameId `181902`
- LG Twins vs Kiwoom Heroes -> gameId `181903`
- NC Dinos vs KT Wiz Suwon -> gameId `181904`
- Samsung Lions vs KIA Tigers -> gameId `181905`
- SSG Landers vs Doosan Bears -> gameId `181906`

모두:

- `providerLeagueId = 5`
- `providerStatusRaw = NS`
- `providerStartTime = 2026-07-28T09:30:00+00:00`

## Existing 3-game cross-check

TheSportsDB existing 3:

- `kbo-2400384` 한화 vs 롯데
- `kbo-2400385` LG vs 키움
- `kbo-2400386` NC vs KT

API-BASEBALL cross-check:

- `181902` Hanwha vs Lotte
- `181903` LG vs Kiwoom
- `181904` NC vs KT Wiz Suwon

Observed match:

- team direction: aligned
- start time: aligned (`18:30 KST`)
- status: aligned (`NS`)
- count overlap: all 3 cross-checkable

Provider IDs are different and must remain separate.

## Missing 2 games

Verified via API-BASEBALL:

- Samsung Lions vs KIA Tigers -> `providerGameId = 181905`
- SSG Landers vs Doosan Bears -> `providerGameId = 181906`

이 두 경기는 **추정이 아니라 provider-backed identity candidate**가 있다.

## Operator-confirmed Identity

결론: `RESEARCH_ONLY_FALLBACK_CANDIDATE`

설명:

- screenshot + operator review만으로 research fallback anchor를 만들 수는 있어도
- provider-backed identity와 동일 의미로 취급하면 안 된다
- public/commercial / long-term reproducibility 기준에서는 secondary fallback이어야 한다

후보 prefix는 문서상으로만:

- `kbo-op-{date}-{operatorGameId}`

하지만 이번 감사에서는 실제 생성하지 않는다.

## Crosswalk candidate (document only)

- `internalGameId`
- `providerRefs[]`
  - `providerId`
  - `providerGameId`
  - `providerHomeTeamId`
  - `providerAwayTeamId`
  - `observedAt`
  - `mappingEvidence`
  - `mappingStatus`

## Recommended solution

`B. 대체 라이선스 Provider 사용`

구체적 권장:

- full-slate KBO identity는 API-BASEBALL 같은 대체 provider-backed source로 보완
- TheSportsDB 3경기 identity는 legacy/partial source로 유지 가능
- operator-confirmed identity는 fallback 후보로만 문서화

## Why this is preferred

1. 오늘 5경기 전체가 실제 provider-backed IDs로 이미 확인되었다
2. 누락 2경기에 대해 추정 ID를 만들 필요가 없다
3. 기존 3경기와 시간/방향/status cross-check가 가능하다
4. dual identity보다 단일 provider-backed full slate가 장기 유지보수에 유리하다
5. TheSportsDB premium은 문서상 후보지만, 오늘 5경기 full-slate 자체는 현재 직접 검증하지 못했다

## Paid plan view

- TheSportsDB premium: full schedule-day limit 확대 문서상 확인, but 07-28 KBO 5경기 직접 검증은 없음
- API-BASEBALL: 현재 환경에서 5경기 query 성공. 다만 장기 사용 조건 / entitlement / legal review는 별도 확인 필요
- SportsDataIO / official partners: 상용 계약 가능성은 있으나 이번 감사에서 today full-slate direct verification 없음

## Official conclusion

`KBO_FULL_SLATE_IDENTITY_COVERAGE_AUDITED`
