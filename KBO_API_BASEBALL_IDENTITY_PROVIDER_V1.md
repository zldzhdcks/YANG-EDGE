# KBO API-BASEBALL Identity Provider v1

목표: 2026-07-28 KBO 5경기 전체에 대해 추정이 아닌 실제 provider-backed identity를 부여한다.

## Provider

- provider id: `API_BASEBALL`
- league id: `5`
- legal status: `NEEDS_LEGAL_REVIEW`
- research use: `INTERNAL_RESEARCH_ONLY`
- public display: `UNCONFIRMED`
- commercial use: `UNCONFIRMED`

## Scope

- 구현: `src/lib/kbo/providers/api-baseball-kbo-schedule-provider.ts`
- raw cache: `data/cache/research/kbo/raw/api-baseball/`
- status mapping: `NS -> SCHEDULED`, live 계열 `-> LIVE`, `FT -> FINAL`, `POSTPONED -> POSTPONED`, `CANCELLED -> CANCELLED`, `SUSPENDED -> SUSPENDED`, else `UNKNOWN`
- internal game id policy: `kbo-{providerGameId}`
- automatic fallback: 금지

## 2026-07-28 verified games

- `181902` 한화 vs 롯데
- `181903` LG vs 키움
- `181904` NC vs KT
- `181905` 삼성 vs KIA
- `181906` SSG vs 두산

모든 경기 시작 시각은 provider 기준 `2026-07-28T09:30:00+00:00`이며 KST 정규화 결과 `2026-07-28T18:30:00+09:00`.

## Crosswalk

- 기존 3경기: `providerRefs`에 `API_BASEBALL` + `THESPORTSDB`를 함께 저장
- 매칭 근거: canonical home team id + canonical away team id + `startTimeKst` + 홈/원정 방향
- 팀명 문자열만으로 `MATCHED` 확정 금지
- 누락 2경기: API-BASEBALL ref만 유지, 오류 승격 금지

## Output

- new artifact: `data/research/kbo/2026-07-28-schedule-result-identity-v1-api-baseball.json`
- new audit: `data/audits/2026-07-28-kbo-api-baseball-full-slate-identity-v1-audit.json`
- old artifact preserved: `data/research/kbo/2026-07-28-schedule-result-identity-v1.json`

## Boundaries

- Prediction / Engine / EDGE PICK / Viewer 미구현
- operator input review 상태는 `DRAFT` 유지
- `READY_FOR_OPERATOR_REVIEW`는 identity/odds 입력 정합성만 의미하며 Engine admission이 아니다
