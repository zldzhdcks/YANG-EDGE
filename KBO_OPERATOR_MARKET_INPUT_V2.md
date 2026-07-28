# KBO Operator Market Input v2

KBO 운영 입력을 `Game -> Market -> Selection` 구조로 통합한 문서다.

- 상태: operator draft input
- 목적: 시장번호 / 선택지 / 배당을 재현 가능하게 저장
- 금지: Prediction / Engine / EDGE PICK / OCR 자동화 / crawling

## Input file

- `data/operator-input/kbo/2026-07-28-operator-markets-v2.json`

상태:

- `inputMethod = MANUAL`
- `reviewStatus = DRAFT`
- `sourceLabel = USER_PROVIDED_BETMAN_SCREENSHOTS`

## Structure

Top-level:

- `dateKst`
- `round`
- `capturedAt`
- `enteredAt`
- `enteredBy`
- `sourceLabel`
- `inputMethod`
- `reviewStatus`
- `games`
- `metadata`

Game:

- `operatorGameId`
- `internalGameId`
- `providerGameId`
- `homeTeamText`
- `awayTeamText`
- `canonicalHomeTeamId`
- `canonicalAwayTeamId`
- `startTimeKst`
- `mappingStatus`
- `reviewStatus`
- `blockingReasons`
- `markets`

Market:

- `operatorMarketId`
- `marketType`
- `period`
- `line`
- `displayLabel`
- `reviewStatus`
- `selections`

Selection:

- `selectionCode`
- `selectionLabel`
- `odds`
- `reviewStatus`

## Market ID policy

`operatorMarketId`는 배트맨 화면의 시장번호를 그대로 보존한다.

예:

- `9079`
- `9080`
- `9118`

하지만 primary `gameId`로 사용하지 않는다.

## Current 2026-07-28 result

- games entered: `5`
- markets entered: `40`
- selections entered: `90`
- operatorMarketId range: `9079` ~ `9118`
- identity matched: `5`
- identity unmatched: `0`
- input status: `READY_FOR_OPERATOR_REVIEW`
- top-level review status: `DRAFT`
- input status: `PARTIALLY_MAPPED`

Matched:

- `KBO-20260728-LG-KIWOOM` -> `kbo-181903`
- `KBO-20260728-SAMSUNG-KIA` -> `kbo-181905`
- `KBO-20260728-SSG-DOOSAN` -> `kbo-181906`
- `KBO-20260728-NC-KT` -> `kbo-181904`
- `KBO-20260728-HANWHA-LOTTE` -> `kbo-181902`

모든 game / market / selection review status는 여전히 `DRAFT`.

Full-slate identity coverage 보완 방식 감사는 [KBO_FULL_SLATE_IDENTITY_COVERAGE_AUDIT_V1.md](./KBO_FULL_SLATE_IDENTITY_COVERAGE_AUDIT_V1.md)를 따른다.

## Validator

```bash
npm run research:kbo-operator-markets -- 2026-07-28
```

검증:

- `operatorGameId` 중복
- `operatorMarketId` 중복
- 시장별 selection 중복
- 필수 selection 누락
- odds 양수 / 유한값
- market type / period / line 정합
- selected primary identity artifact 존재 및 홈/원정/시각 정합

## Review policy

모든 현재 입력은 `DRAFT`.

`READY_FOR_OPERATOR_REVIEW`는 다음만 의미한다:

- identity mapping complete
- duplicate 0
- invalid odds 0
- invalid market structure 0
- 그러나 operator final verification은 아직 아님

`VERIFIED_FOR_RESEARCH_INPUT`은 다음이 모두 충족되어야 한다.

- 운영자 최종 검수 완료
- identity mapping complete
- duplicate 0
- invalid odds 0
- invalid market structure 0

주의:

- 입력 검증 완료 != Prediction 승인
- 입력 검증 완료 != Engine 승인
- 입력 검증 완료 != public UI 승인

## OCR boundary

문서상 흐름만 허용:

`Screenshot -> OCR Draft -> JSON -> Validator -> Operator Review -> VERIFIED`

금지:

- OCR 자동 저장
- OCR 자동 VERIFIED

## Official conclusion

`KBO_OPERATOR_MARKET_INPUT_V2_READY`
