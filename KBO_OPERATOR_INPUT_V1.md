# KBO Operator Scope and Proto Odds Input v1

운영자가 직접 확인한 KBO 배트맨 편성과 한국 프로토 배당을 내부 연구 입력으로 저장·검증하는 단계다.

현재는 v2 통합 구조([KBO_OPERATOR_MARKET_INPUT_V2.md](./KBO_OPERATOR_MARKET_INPUT_V2.md))를 우선 사용한다. v1 scope/proto 파일과 validator는 **삭제하지 않고 보존**한다.

- 범위: JSON 파일 + CLI validator
- 금지: crawling, Prediction, Engine, EDGE PICK, UI 연결
- 용도: `INTERNAL_RESEARCH_ONLY`

## Files

실제 운영 입력:

- `data/operator-input/kbo/{DATE}-betman-scope.json`
- `data/operator-input/kbo/{DATE}-proto-odds.json`

템플릿:

- `data/operator-input/kbo/templates/betman-scope-template.json`
- `data/operator-input/kbo/templates/proto-odds-template.json`

## CLI

```bash
npm run research:kbo-operator-input -- YYYY-MM-DD
```

- 날짜 생략 시 KST today
- Identity dataset이 먼저 있어야 한다:

```bash
npm run research:kbo-identity -- YYYY-MM-DD
```

## Allowed values

`mappingStatus`:

- `NOT_CHECKED`
- `MATCHED`
- `UNMATCHED`
- `AMBIGUOUS`

`reviewStatus`:

- `DRAFT`
- `VERIFIED`
- `REJECTED`

`marketTypes`:

- `MONEYLINE`
- `HANDICAP`
- `TOTAL`
- `OTHER`

`inputMethod`:

- `MANUAL`
- `OCR_REVIEWED`

## Validation

- 날짜 일치
- 필수 필드 존재
- `operatorGameId` 중복 금지
- 동일 `operatorGameId + marketType + selection` 중복 금지
- `odds`는 유한한 양수 number만 허용
- `matchedInternalGameId`가 있으면 identity dataset 실재 여부 확인
- 홈/원정 canonical mapping 일치 확인
- 시작 시각 허용 오차 검증

## Input ready status

- `NOT_ENTERED`
- `DRAFT`
- `PARTIALLY_MAPPED`
- `READY_FOR_OPERATOR_REVIEW`
- `VERIFIED_FOR_RESEARCH_INPUT`

`VERIFIED_FOR_RESEARCH_INPUT`은 다음을 모두 만족해야 한다.

- scope rows VERIFIED
- proto odds rows VERIFIED
- 모든 사용 대상 경기 MATCHED
- duplicate 0
- invalid odds 0
- identity 존재 / 날짜 일치

주의:

- 이것은 Prediction 승인 아님
- Engine 승인 아님
- public UI 승인 아님

## Blocking examples

- `IDENTITY_PROVIDER_GAME_MISSING`
- duplicate scope / odds row
- invalid odds
- invalid status value
- home/away or start time mismatch

## Legal boundary

- Betman: 수동 범위 확인 입력만
- Proto odds: 수동 입력 또는 향후 검수된 OCR 보조만
- `publicDisplay = LEGAL_CLEARANCE_PENDING`
- `commercialUse = LEGAL_CLEARANCE_PENDING`

## Official conclusion

`KBO_OPERATOR_INPUT_V1_READY`
