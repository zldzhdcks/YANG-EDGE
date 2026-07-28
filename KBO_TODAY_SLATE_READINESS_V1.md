# KBO Today Slate and Odds Readiness v1

KBO 오늘 경기 분석 시작 전 운영·연구 준비 상태를 확인하는 read-only 점검 문서다.

- 목적: 추천 생성이 아니라 슬레이트 / 범위 / 배당 입력 / 데이터 가용성 확인
- 금지: KBO Prediction / EDGE PICK / Engine 생성
- 출력 artifact: `data/audits/{DATE}-kbo-today-slate-readiness-v1.json`

## CLI

```bash
npm run research:kbo-slate-readiness -- YYYY-MM-DD
```

- 날짜 생략 시 오늘 KST 사용
- 기존 identity artifact가 없으면 먼저 다음 명령을 안내한다:

```bash
npm run research:kbo-identity -- YYYY-MM-DD
```

## Coverage policy

TheSportsDB free tier 3경기 제한이 확인되면:

- `expectedKboGames = "UNKNOWN"`
- `providerCoverageStatus = "PARTIAL_COVERAGE"`

이 경우 반환된 3경기를 오늘 전체 KBO 슬레이트라고 단정하지 않는다.

허용 상태:

- `FULL_COVERAGE`
- `PARTIAL_COVERAGE`
- `NO_COVERAGE`
- `UNKNOWN_EXPECTED_SLATE`

API-BASEBALL full-slate artifact가 선택된 경우:

- `providerCoverageStatus = "FULL_COVERAGE"`
- `identityGames = 5`
- legacy TheSportsDB artifact는 보존되지만 readiness primary는 `KBO_IDENTITY_PROVIDER`를 따른다

## Operator input files

실제 운영 입력은 수동만 허용한다.

- Betman scope: `data/operator-input/kbo/{DATE}-betman-scope.json`
- Proto odds: `data/operator-input/kbo/{DATE}-proto-odds.json`

Template:

- `data/operator-input/kbo/templates/betman-scope-template.json`
- `data/operator-input/kbo/templates/proto-odds-template.json`

Validator / audit:

- `npm run research:kbo-operator-input -- YYYY-MM-DD`
- `data/audits/{DATE}-kbo-operator-input-v1-audit.json`
- `npm run research:kbo-operator-markets -- YYYY-MM-DD`
- `data/audits/{DATE}-kbo-operator-markets-v2-audit.json`

입력이 없으면:

- `betmanScopeStatus = "NOT_ENTERED"`
- `oddsInputStatus = "NOT_ENTERED"`

## Mapping rules

우선순위:

1. Provider Team ID
2. Canonical Team ID
3. 날짜 + 홈/원정 + 시작 시각
4. 운영자 수동 확인

`mappingStatus`:

- `MATCHED`
- `UNMATCHED`
- `AMBIGUOUS`
- `NOT_CHECKED`

Betman 경기번호는 primary `gameId`가 아니다.

## Analysis availability states

각 경기별 후보 상태:

- `COLLECTED`
- `PARTIAL`
- `NOT_COLLECTED`
- `NOT_SUPPORTED`
- `FUTURE_GATED`

현재 KBO Today Slate readiness에서:

- identity / schedule / resultStatus: `COLLECTED`
- odds: `NOT_COLLECTED` unless operator input exists
- starter / bullpen / lineup / travel / weather / injury / predictionSnapshot: `FUTURE_GATED`

## Analysis readiness states

허용:

- `IDENTITY_ONLY`
- `MARKET_INPUT_PENDING`
- `RESEARCH_INPUTS_PARTIAL`
- `READY_FOR_RESEARCH_SNAPSHOT_AUDIT`
- `READY_FOR_PREDICTION`

현재는 KBO prediction pipeline 미구현이므로 `READY_FOR_PREDICTION` 판정 금지.

운영 입력 audit가 `VERIFIED_FOR_RESEARCH_INPUT`이면 readiness는 최대 `READY_FOR_RESEARCH_SNAPSHOT_AUDIT`까지만 올린다.
v2 audit가 있으면 v1보다 우선 읽는다.

2026-07-28 API-BASEBALL primary 결과:

- provider coverage: `FULL_COVERAGE`
- operator market v2 input status: `READY_FOR_OPERATOR_REVIEW`
- analysis readiness: `RESEARCH_INPUTS_PARTIAL`
- prediction pipeline 미구현이므로 `READY_FOR_PREDICTION` 금지

## Blocking reasons

- `PROVIDER_PARTIAL_COVERAGE`
- `BETMAN_SCOPE_NOT_ENTERED`
- `PROTO_ODDS_NOT_ENTERED`
- `STARTER_NOT_COLLECTED`
- `BULLPEN_NOT_COLLECTED`
- `LINEUP_NOT_COLLECTED`
- `INJURY_NOT_COLLECTED`
- `PREDICTION_PIPELINE_NOT_IMPLEMENTED`
- `LEGAL_CLEARANCE_PENDING`

## Legal boundary

- Betman: 수동 범위 확인 입력만
- Proto odds: 수동 입력 또는 향후 검수된 OCR 보조만
- KBO data: `INTERNAL_RESEARCH_ONLY`
- Public / commercial: `LEGAL_CLEARANCE_PENDING`

금지:

- Betman HTML crawling
- login automation
- hidden API extraction
- proto odds automated collection
- recommendation generation from incomplete inputs

## Official conclusion

`KBO_TODAY_SLATE_READINESS_CREATED`

참고: 2026-07-28 full-slate identity 보완 감사는 [KBO_FULL_SLATE_IDENTITY_COVERAGE_AUDIT_V1.md](./KBO_FULL_SLATE_IDENTITY_COVERAGE_AUDIT_V1.md)에 정리되어 있다.
