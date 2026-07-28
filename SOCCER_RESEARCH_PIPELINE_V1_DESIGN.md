# Soccer Research Pipeline v1 Pre-design

YANG EDGE의 첫 비야구 종목인 축구 Research Pipeline 사전 설계 문서다.

- 범위: pre-design audit only
- 금지: Builder / Dataset / Prediction / Grade / Engine / Viewer 구현
- 배트맨: 경기 범위 기준만, 데이터 Provider 아님

## Current repo status

- 일정: API-Football 기반 fixture 수집 경로 존재
- 팀 매핑: 일부 리그(K리그1, MLS, 일부 유럽 팀) alias 존재
- 배당: The Odds API sport key 해석 및 일정 화면 보강 일부 존재
- Prediction / Research Dataset / Grade / Viewer research 연결: 없음

## Provider candidates

| Provider | Schedule / Result | Lineup / Formation | Injury | Odds | Coverage / notes | Legal status |
|---|---|---|---|---|---|---|
| API-Football / API-SPORTS | strong | strong where competition coverage exists | available by endpoint/coverage | available by endpoint/coverage | fixture-centric; coverage object must be checked per league/season; good first identity candidate | `NEEDS_LEGAL_REVIEW` |
| SportsDataIO Soccer | strong | strong | partial-to-strong by competition | strong incl. historical products | wide league coverage, paid/commercial product orientation | `COMMERCIAL_LICENSE_REQUIRED` |
| TheSportsDB | partial | limited / unclear | unclear | weak | useful fallback candidate for public schedule-style data, but coverage depth unclear | `PUBLIC_DISPLAY_UNCONFIRMED` |
| The Odds API | no core schedule source | none | none | strong for pre-match reference odds | odds reference only; not a full match lifecycle provider | `PER_USE_LEGAL_REVIEW` |
| Official league / licensed partner | varies | varies | varies | varies | candidate only after per-league legal review | `UNKNOWN` / per-provider |

## Betman boundary

- Betman schedule determines candidate scope only.
- Provider fixture schedule, IDs, and stats must come from lawful sports data Providers.
- Betman HTML crawling, login automation, hidden API use, and bulk odds copying remain prohibited.

## League scope

- 유명 리그 고정 화이트리스트를 장기 계약으로 보지 않는다.
- 실제 배트맨 편성 리그(노르웨이 축구 등 포함)가 Provider coverage 안에 있는지 별도 확인해야 한다.
- 이번 감사에서는 `betmanScopeStatus = NOT_CHECKED`가 기본값이다.

## Result / grade differences from baseball

축구는 최소 다음 결과 상태를 별도 고려해야 한다.

- `HOME_WIN`
- `DRAW`
- `AWAY_WIN`
- `POSTPONED`
- `CANCELLED`
- `ABANDONED`
- `SUSPENDED`
- `VOID`
- `INCONCLUSIVE`
- `UNKNOWN`

또한 정규시간, 연장전, 승부차기, 컵 대진 통과 여부를 분리해야 한다. MLB/KBO의 단일 winner 중심 구조를 그대로 재사용하면 부족하다.

## Market differences

축구는 winner 하나로 모든 시장을 채점할 수 없다.

후보 시장:

- 승무패
- 핸디캡
- 언더오버
- 양 팀 득점
- 더블 찬스
- 전반전
- 정확한 스코어

각 시장은 독립적인 결과 기준과 cutoff / odds snapshot 규칙이 필요하다.

## Dataset candidates

| Dataset | Provider feasibility | Pre-game | Post-game | Leakage risk | Reuse from MLB/KBO | Priority |
|---|---|---|---|---|---|---|
| Schedule / Result Identity | highest | yes | yes | low | high for lifecycle/meta, low for result taxonomy | 1 |
| Team Form | medium-high | yes | yes | medium (post-result recompute risk) | common candidate | 4 |
| Home / Away Form | medium-high | yes | yes | medium | common candidate | 5 |
| Starting XI / Lineup | medium | often late only | yes | high (post-game backfill risk) | low | 2 |
| Formation | medium | often late only | yes | high | soccer-specific | 6 |
| Injury / Suspension | medium | yes where available | yes | high | common candidate | 3 |
| Travel / Rest | medium | yes | yes | medium | common candidate | 7 |
| Weather | medium | yes | yes | medium | common candidate | 9 |
| Odds History | medium-high | yes | limited by provider retention | high (closing/live contamination) | common candidate | 8 |
| Head-to-Head | medium | yes | yes | medium | soccer-specific usage | 10 |
| Referee | medium | sometimes | yes | low | soccer-specific | 11 |
| League Table Context | medium | yes | yes | high (post-match table leakage) | soccer-specific | 12 |

## First Dataset recommendation

`Soccer Schedule / Result Identity Dataset v1`

근거:

1. fixture/league/team/result ID 안정성이 가장 높다
2. 다른 dataset의 선행 조건이다
3. 배트맨 편성 매칭의 anchor가 된다
4. 법적/운영 리스크가 lineup/odds/history보다 상대적으로 낮다
5. grade / viewer / later dataset 확장의 공통 기반이 된다

## Game ID recommendation

권장 후보:

- `soccer-{providerFixtureId}`

비권장:

- Betman 회차 ID primary 사용
- 팀명 + 날짜 slug primary 사용

분리 대상:

- internal `gameId`
- provider `fixtureId`
- provider `leagueId`
- Betman scope reference

## Team identity recommendation

권장 구조:

- `providerTeamId`
- `providerTeamName`
- `canonicalTeamId`
- `canonicalNameKo`
- `canonicalNameEn`
- `country`
- `leagueId`
- `mappingStatus`

`mappingStatus`:

- `MATCHED`
- `UNMATCHED`
- `AMBIGUOUS`
- `NOT_CHECKED`

문자열 축약(`FC`, `United`, `City`)만으로 동일 팀 판정 금지.

## Leakage risks to preserve

- post-game confirmed lineup -> pre-game backfill
- post-game injury news -> pre-game feature화
- updated league table -> old cutoff로 backfill
- closing odds -> pre-game open/mid snapshot처럼 사용
- post-match xG / tactical summary -> pre-game feature화
- postponed fixture reschedule data -> original cutoff 덮어쓰기

## Feature flag candidates (document only)

- `SOCCER_IDENTITY_COLLECTION_ENABLED`
- `SOCCER_LINEUP_COLLECTION_ENABLED`
- `SOCCER_ODDS_COLLECTION_ENABLED`

의미 분리:

- collection enabled != prediction enabled
- collection enabled != engine enabled
- collection enabled != public UI enabled
- collection enabled != commercial clearance

이번 감사에서는 env 추가 없음.

## Structured LLM

`FUTURE_GATED` only.

입력 계약 후보:

- `summary`
- `verifiedFactors`
- `risks`
- `missingData`
- `sourceIds`
- `cutoffTime`
- `marketContext`
- `lineupStatus`
- `formationStatus`

실제 Research Artifact 기반만 허용한다.

## Multi-sport conclusion

- 공통 lifecycle/meta/hash/audit 원칙은 반복 가능성이 높다
- sport payload / result taxonomy / market grading은 축구 전용 분리가 필요하다
- 지금은 `NO_FRAMEWORK_CHANGE`
- Sport Provider Contract의 repo-wide 공통 구현은 아직 금지

## Official conclusion

`READY_FOR_SOCCER_MINIMAL_RESEARCH_DATASET`
