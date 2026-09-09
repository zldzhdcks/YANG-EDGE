# Cursor / Astra HANDOFF — next exact ingest mission

MISSION_ID: FOOTBALL_EPL_HISTORICAL_RESULT_ARCHIVE_INGEST_V1
STATUS: SPECIFICATION_ONLY — NOT EXECUTED
BASE_SHA: 1b90cdd3d406dd2991f79fe0836c32d8ba08e4b9
SOURCE_GATE_BRANCH: agent/astra/football-historical-source-gate-v1
SOURCE_GATE_WORKTREE: C:/Users/TCTCTC/YANG-EDGE/football-source-gate-v1

## 사용자에게 보여줄 핵심

API-Football 현재 Free 계정으로 EPL 2023/24·2024/25 첫 라운드 10경기씩이 확인됐다. 두 시즌 약 760개의 결과 행 확보 경로가 있다. 과거 date 필터는 제한되므로 기존 getFixtures(date 필수)를 바꾸지 말고 독립 season adapter를 작성한다. 구독 업그레이드는 이 범위에 필요하다고 입증되지 않았다.

이것은 strict historical backtest를 실행하라는 미션이 아니다. 과거 당시 observation이 없어서 baseline admission은 여전히 막혀 있다. 모델을 바꾸거나 관측 시간을 소급해 성공으로 만들지 않는다.

## 다음 실행 지시

1. Git 상태·현재 branch·SOURCE_GATE 문서를 확인한다. Owner Risk Manager checkout은 그대로 두고 별도 research worktree에서 진행한다. 운영 중인 서버의 checkout을 바꾸지 않는다. 기존 dirty 파일은 보존한다. 키는 현재 사용 중인 환경에서 읽되 로그·문서·Git·공개 디렉터리에 복사하지 않는다.
2. 이 source의 API 사용 조건과 우리 비공개 연구 범위를 기록한다. 공개/재판매/로고 사용 없음, archive 접근 제한, 보관기간과 구독 종료 후 처리, 파생 통계모델 연구 허용 범위를 확인한다. 명확하지 않은 권리는 추측하지 말고 provider에 확인할 질문을 남긴 뒤 원본 아카이브 ingest는 멈춘다. 아래 문의 초안은 발송하지 않은 상태다. HTTP 200은 법률 승인 증거가 아니다.
3. 실제 `/status`를 한 번 확인한다. Free/active와 잔여 호출·minute rate limit을 확인한다. 실패/권한 변경/429이면 중단 보고한다. 다른 계정·다른 host·유료 구매로 자동 우회하지 않는다.
4. 독립 `scripts/ingest-football-epl-historical-results-v1.mjs`를 작성한다. 기본 dry-run, `--execute`에만 네트워크·파일 쓰기. `league=39`, seasons `2023,2024`, timezone=UTC만 allowlist. 날짜 필터, odds, predictions, standings, player endpoints는 없다. 기존 src provider나 engine을 import/수정하지 않는다.
5. 예정 API는 `GET /fixtures?league=39&season=2023&timezone=UTC`와 2024 동일 쿼리이다. 공식 문서가 시즌 단위 fixture 조회를 지원한다. 첫 응답의 HTTP, errors, parameters, results, paging, season, league를 검증하고 실패하면 두 번째를 진행하지 않는다. HTTP 200 + errors.plan은 실패다. 이 미션에서 실제 성공을 확인한 것은 round=1 경로이므로 season 전체 쿼리는 다음 미션에서 최초 검증한다. 차단 시 자동으로 모든 날짜/라운드를 순회해 권한 제한을 우회하지 않는다.
6. 호출은 직렬로 보수적으로 제한한다(최대 5 API attempts: status 1 + season 2 + 일시적 5xx 재시도 최대 2). 공식 plan rate limit이 더 엄격하면 그 한도를 우선한다. 401/403/429/plan 오류는 재시도하지 않는다. pagination>1 또는 envelope 결과수 불일치는 멈추고 계획을 수정한다. 임의 page sweep 없음.
7. 응답 bytes의 SHA256, API endpoint/쿼리(키 제외), requestedAt, 실제 receivedAt/retrievedAt UTC, HTTP 상태, quota metadata, source/season, ingest 버전을 manifest에 기록한다. API 키/인증 헤더/계정 개인정보는 원본·manifest 어느 곳에도 저장하지 않는다. immutable 파일은 overwrite하지 않고 같은 SHA는 idempotent no-op, 변경된 응답은 새 revision으로 둔다. 백업과 purge 범위는 2단계 권리 기록에 맞춘다.
8. 원본은 공개 serving 경로 밖의 `data/cache/research/football/historical-results-v1/api-football/epl/{season}/{retrieval-id}.json`에 보관하되 Git 배포/공개 업로드 대상에서 제외한다. 정규화 산출물과 품질 보고서는 `data/research/football/historical-results-v1/`로 한정한다. 기존 official-result/Poisson 입력/production prediction 산출물을 덮어쓰지 않는다. 자동승격 경로를 만들지 않는다.
9. 결과 archive schema는 `football-historical-retrospective-final-v1`. 필수 값은 source, providerFixtureId, canonical match/team/competition IDs, 원문 팀 이름, season, kickoff UTC, status, regulation scores, retrievedAt, source hash. `observationMode=RETROSPECTIVE_FINAL_STATE`, `historicalFirstPublishedAt=null`, `strictAsOfAdmission=false`. 실제 회수 시각은 그대로 유지한다. 가짜 resultObservedAt이나 kickoff+2시간을 만들지 않는다.
10. ID는 `soccer-api-football-{fixture.id}`, `fb-comp-api-football-{league.id}`, `fb-team-v1-api-football-{team.id}`. provider ID가 중복되면 identity/score 일치 여부를 확인한다. 다른 팀/시즌/점수의 충돌은 overwrite 없이 격리한다. 이름 fuzzy join·kickoff 근접 매칭·시즌을 연도로 추정하는 행위는 금지한다.
11. `status=FT`이며 `score.fulltime.home/away`가 유효한 비음수 정수인 행만 이번 archive 적격으로 분류한다. AET/PEN/AWD/WO/CANC/ABD/PST/TBD/미완료·결측 점수는 제외 사유를 남긴다. 총 goals로 임의 복구하지 않는다. 반환된 extra-time/penalty 결과는 이번 EPL 정규리그 범위에 자동 편입하지 않는다. market odds/provider prediction 값은 정규화 필드에 포함하지 않는다.
12. 시즌별 unique fixtures=380, 합계760은 기대치로 검사한다. 최종 pass 기준은 2시즌 각각의 완전성 근거와 전체 적격 unique>=500. 380과 다르면 누락/취소/재경기/중복/구조 변경을 설명하기 전 COMPLETE를 선언하지 않는다. fixture ID만 다른 동일 경기 후보도 별도 ambiguity report에 남기고 자동 병합하지 않는다.
13. 테스트: envelope 오류, 누락/결측, UTC 변환, 점수 범위, 시즌/리그 오염, 중복충돌, idempotency, retry budget, 비밀정보 차단, raw hash, schema에 배당/예측 없음, historical observation 소급 없음. 원본 baseline 및 inventory 테스트를 실제 출력 위치를 오염시키지 않는 방식으로 유지한다. Backtest/성능 지표는 실행하지 않는다.

## 완료 산출물

- 별도 ingest script 및 그 범위의 테스트
- 권리·보관 범위 기록(확인 안 됐으면 BLOCKED_REPORT만, 대량 원본 없음)
- source manifest / SHA256 / 실제 retrieval timestamps
- 2023·2024 별도 raw archive, 적격·격리·중복 보고서, 전체 수량 감사
- `docs/FOOTBALL_EPL_HISTORICAL_RESULT_ARCHIVE_INGEST_V1.md`
- SOURCE, LEGAL_SCOPE, PLAN, API_CALL_COUNT, SEASONS, RAW_ROWS, UNIQUE_ROWS, VALID_RESULT_ROWS, DUPLICATES, CONFLICTS, MISSING_FIELDS, ACTUAL_ASOF_ROWS, BACKTEST_EXECUTED=NO, ENGINE_CHANGED=NO, WEIGHT_CHANGED=NO, ODDS_USED=NO, COMMIT_SHA

기존 temporal 계약에서 이번 결과를 historical backtest에 바로 넣을 수 없다는 사실을 완료보고에 유지한다. 승격 필요 시 별도 미션에서 authentic historical observation 확보 또는 가정이 명시된 retrospective 연구 계약을 검토한다. baseline 변경 승인은 이 문서에 없다.

## 제공자 권리 확인용 초안 — 미발송

We already use API-Football directly. For one private, non-public research project we want to retain the Premier League 2023 and 2024 season fixture IDs, team IDs/names, kickoff timestamps, and regulation final scores (approximately 760 matches), retrieved through the season fixtures endpoint within our plan. No odds, logos, raw-data resale, public recommendations, or external distribution are planned. Can you confirm permission for a local research archive and statistical model evaluation, the permitted retention period and rights after plan changes or termination, and whether any additional rights-holder permission is required for this exact use? Separately, do you provide authentic first-result-publication timestamps or historical response revisions for point-in-time research? We will not treat kickoff or retrieval time as the original result-publication time.

문의 발송·구매·신규 계약 체결은 실행하지 않았다. 다음 작업에서도 별도 사용자 권한 없이 메시지를 보내지 않는다.
