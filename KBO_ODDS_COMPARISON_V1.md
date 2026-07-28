# KBO Domestic / Overseas Odds Comparison v1

목표: 2026-07-28 KBO 5경기에 대해 운영자 입력 국내 프로토 배당과 해외 Provider 배당을 동일 경기·동일 시장 기준으로 두 줄 비교한다.

## Scope

- dataset: `kbo-odds-comparison`
- supported market: `MONEYLINE_2WAY`
- period: `FULL_GAME`
- domestic source: operator-reviewed JSON only
- overseas source: The Odds API actual collected odds only
- preview route: `/kbo/odds-preview`

## Out of scope

- Prediction
- Confidence
- EDGE Score
- implied probability
- margin removal
- fair odds
- value edge
- 추천 / 구매 지시 / 금액 안내

## Source policy

Domestic:

- sourceType: `DOMESTIC_PROTO_OPERATOR_INPUT`
- sourceLabel: `KOREAN_PROTO`
- current reviewStatus: `DRAFT`
- UI label: `국내 프로토`, `국내 배당 검수 전`

Overseas:

- provider: `THE_ODDS_API`
- sport key: `baseball_kbo`
- bookmakerPolicy: `AGGREGATE_BEST`
- legalStatus: `NEEDS_LEGAL_REVIEW`
- UI label: `해외 시장`

## Matching

필수 일치 조건:

- `gameId`
- canonical home team id
- canonical away team id
- `startTimeKst`
- `marketType = MONEYLINE_2WAY`
- `period = FULL_GAME`
- `selectionCode = HOME / AWAY`

팀명 문자열만으로 자동 `MATCHED` 확정 금지.

## Comparison policy

- 동일 시장 raw decimal odds만 보존
- 해외 `h2h`의 상세 규칙(연장 포함 여부)을 코드/문서에서 명시 검증하지 못하면 `comparison.status = MARKET_RULE_UNVERIFIED`
- 이 경우 카드에는 국내/해외 원문 odds는 보여주되 `homeDifference` / `awayDifference`는 생성하지 않음

## Artifacts

- dataset: `data/research/kbo/2026-07-28-odds-comparison-v1.json`
- audit: `data/audits/2026-07-28-kbo-odds-comparison-v1-audit.json`
- raw cache: `data/cache/research/kbo/raw/the-odds-api/`

## CLI

```bash
npm run research:kbo-odds-comparison -- 2026-07-28
```

## UI copy

- `KBO 시장 배당 비교`
- `국내 프로토`
- `해외 시장`
- `국내 배당 검수 전`
- `해외 배당 미수집`
- `운영자 입력 국내 배당과 해외 Provider 배당의 단순 비교입니다.`
- `추천·구매 지시가 아닙니다.`
