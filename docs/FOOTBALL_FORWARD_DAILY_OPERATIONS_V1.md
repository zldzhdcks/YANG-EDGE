# FOOTBALL_FORWARD_DAILY_OPERATIONS_V1

BASE_SHA = e2bbd8f714009fe66ba3b7b24d33ef2713c522b9

운영 계약을 고정한다. 기존 Forward v1과 Poisson 코드는 수정하지 않았다. 기존 access-gate 미추적 문서도 보존한다. **POSTGAME_PIPELINE_READY = PARTIAL_WRITER_ONLY**: 별도 grade 저장 함수는 있지만 자동 FT 수집·통합 scorecard·milestone 실행기는 아직 없다. 이 문서는 무인 운영이 완성됐다는 선언이 아니다.

## 실행과 주기

EPL 39, La Liga 140, Serie A 135, Bundesliga 78에 대해 매 UTC 날짜 최소 1회 성공한 coverage 확인이 필요하다. 실패한 호출은 성공 횟수로 세지 않는다. 기본 watch는 기존 코드대로 cycle 완료 후 6시간이다. 고정 시각 cron이나 하루 4회 성공 보장은 아니다. PC 종료·절전·네트워크 장애 또는 프로세스 종료 중에는 실행되지 않는다.

football research worktree에서:

```powershell
# A. Manual one-shot
node --env-file=C:/Users/TCTCTC/YANG-EDGE/yang-edge/.env.local C:/Users/TCTCTC/YANG-EDGE/yang-edge/node_modules/tsx/dist/cli.mjs scripts/run-football-forward-shadow-v1.ts --run

# B. Foreground watch; terminate with Ctrl+C
node --env-file=C:/Users/TCTCTC/YANG-EDGE/yang-edge/.env.local C:/Users/TCTCTC/YANG-EDGE/yang-edge/node_modules/tsx/dist/cli.mjs scripts/run-football-forward-shadow-v1.ts --watch
```

C는 미래 always-on Mac mini/service다. 런타임·비밀키·로컬 저장 이관, 단일 writer, 호스트 시각, 장애 복구 및 아래 MISS 문제 해결을 별도 승인된 미션에서 검증해야 한다. 이번에는 A/B 실행, OS startup task, service, scheduler 설치를 하지 않았다. 다중 watch/수동 실행을 동시에 시작하지 않는다. 기존 67개 seal은 재실행으로 새 evidence가 되지 않는다.

## 운영 순서와 deadline

1. HEAD/model hash, 최근 run·coverage 및 프로세스 상태를 확인한다. 기존 input/snapshot/receipt/MISS/grade는 삭제하거나 덮어쓰지 않는다.
2. 공식 provider 접근과 current season identity, 일정 범위를 확인한다. outage는 coverage failure다. UNKNOWN을 0이나 PASS로 대체하지 않는다.
3. 아래 MISS preflight가 통과한 경우에만 기존 runner를 실행한다. 현재 코드의 admission 조건은 NS 및 kickoff까지 최소 60초다. 실제 receipt는 반드시 kickoff 전에 봉인돼야 한다. 60초는 admission 기준이며 receipt가 kickoff 60초 전까지 저장된다는 보장은 아니다.
4. 실제 관측 FT history만 사용하고 same league/365일 조건을 유지한다. PASS 확률은 null, 원래 이유를 보존한다. Target 결과·시장·owner/external 입력은 금지한다.
5. read-back으로 hash·receipt·coverage를 확인한다. 경기 시작 이후 prediction/revision/backfill은 없다.

## MISS 정책과 현재 구현 차이

실제 scheduleFetchedAt < kickoff인 사전 관측 fixture가 snapshot 없이 kickoff를 넘긴 경우만 MISSED_PREGAME_SNAPSHOT이다. 사전 관측한 fixture는 provider outage 중에도 기존 evidence로 MISS를 판단할 수 있다. 한 번 MISS가 되면 사후 prediction을 만들지 않는다. 취소/연기/TBD를 시작된 경기로 추정하지 않는다.

**현재 frozen runner는 최초 발견이 kickoff 이후인 fixture도 MISS로 기록할 수 있다.** `freeze()`의 kickoff 경과 분기 및 `auditCoverage()`가 사전 관측 여부를 구분하지 않기 때문이다. 따라서 무조건 매일 기존 watch를 켜면 이번 계약을 보장하지 못한다. 실행 전 조회 범위에 그런 fixture가 있으면 runner를 중단하고, 별도 승인된 orchestration fix로 분리한다. 이번 policy/docs/tests-only 미션에서 이를 수정하거나 기록을 사후 삭제하지 않는다. 첫 live run은 모든 대상이 미래 경기여서 해당 문제가 발생하지 않았다. 안전한 무인 운용 승인은 이 gap 해결 전 보류한다.

## Postgame 별도 실행 경로

기존 `scripts/football-forward-postgame-v1.ts`의 `grade(root, resultObservation)`은 MODEL_FORWARD/postgame/<fixtureId>.json을 exclusive-create한다. 현재 자동 수집 CLI가 없으므로 이 파일을 node로 직접 실행한다고 grading이 수행되는 것은 아니다. 현재 pregame --watch도 grade를 호출하지 않는다.

후속 운영자는 공식 API에서 종료된 대상의 FT regular-time score를 별도 수집하고, 실제 응답 완료 시각과 sourceHash를 기록해야 한다. 먼저 pregame/input/receipt hash, receipt의 kickoff 이전 시각, invalid/MISS 부재, fixture/league identity를 확인한다. 완료 상태를 추정하거나 사후 score를 pregame input으로 넣지 않는다. 기존 grade가 있으면 hash를 검증하고 skip한다. 충돌/수정 결과는 오류로 보존하고 원본을 overwrite하지 않는다.

저장 계약: fixtureId, predictionHash, actualScore, actualClass, correct1X2, gradedAt, providerFetchedAt, sourceHash. 기존 파일에서 providerFetchedAt는 **officialCompletionEvidence.providerFetchedAt**에 저장된다. schema를 바꾸지 않고 논리 필드로 매핑한다. PASS의 correct1X2는 null이다. grade 함수 자체만으로 모든 preflight가 자동 보장되는 것은 아니므로 호출 경로에서 위 검증이 필수다. 자동 결과 수집·재시도·통합 scorecard writer는 별도 구현 미션이 필요하다.

## 일일 scorecard 계약

UTC kickoff 날짜별로 MODEL_FORWARD만 집계한다. 정산 날짜별 코호트로 바꾸지 않는다. 이후 날짜에 grade가 도착하면 같은 kickoff 날짜의 새 timestamped scorecard를 추가한다. 과거 scorecard·prediction은 덮어쓰지 않는다.

- scheduled: 관측한 고유 fixture 수. coverage 불완전 시 null, observed count는 별도 보존.
- eligible: 유효하게 봉인된 fixture + 감사 시점 NS/60초 조건을 만족하는 미봉인 fixture. 누적 성공 수나 최종 정산 수가 아니다.
- predicted / pass: 유효 pregame seal 상태별 고유 fixture 수.
- missed: 사전 관측 조건을 충족한 영구 MISS 수.
- graded: 유효 predictionHash에 연결된 별도 grade 수. PASS grade도 포함.
- pending: predicted + pass − graded. 아직 kickoff 전이거나 미종료/결과 미수집인 봉인 fixture도 포함. MISS와 미봉인 일정은 포함하지 않는다. grade 저장소를 읽지 못하면 graded/pending은 null.
- HOME/DRAW/AWAY predictions: PREDICTED만 class별 집계. 합은 predicted와 일치해야 한다.

기존 coverage 파일에는 graded/pending/class breakdown이 없다. 위 통합 scorecard는 **정책만 준비됐으며 자동 생성기는 미구현**이다. 부분 coverage의 0을 전체 0으로 보고하지 않는다. 일별 운영 점검은 누락, pending, API 오류 확인에만 사용하며 모델 자동 변경은 없다.

## Forward sample milestones

N은 네 리그의 **유효하게 grade된 PREDICTED 고유 fixture 누적 수**다. PASS, historical, 중복 snapshot/revision은 제외한다. 현재 48 PREDICTED seal이 있다고 N=48이라고 선언하지 않는다. 아직 grade되지 않았으면 review 표본이 아니다.

N=25, 50, 100, 200만 정식 Forward Review checkpoint로 사전 고정한다. 네 리그 통합 Forward 코호트와 리그별 내역을 함께 보되 historical과 합산하지 않는다. grade batch가 여러 경계를 넘으면 gradedAt→fixtureId 순서로 각 정확한 N의 cohort manifest/hash를 고정하고 checkpoint별 1회만 기록한다. 중간 결과는 운영 확인만 허용한다.

25/50 및 모든 N<100은 engine-change 근거가 될 수 없다. N=100은 INTERNAL_RESEARCH_REVIEW만 허용한다. 200도 자동 validation/모델 변경을 허용하지 않는다. VALIDATED_MODEL 자동 승격, 결과 기반 threshold/weight 변경은 모든 단계에서 금지한다. 새로운 가설·더 큰 checkpoint·모델 연구는 별도 사전 승인 및 protocol이 필요하다. milestone 자동 실행기도 이번에는 만들지 않았다.

## Historical / market 격리

Historical은 retrospective evidence, Forward는 실제 pregame evidence다. 서로 별도 scorecard와 분모를 유지하고 하나의 accuracy로 합치지 않는다. 시장 비교는 prediction 봉인 이후 별도 데이터 경로에서만 허용하며, 회차·fixture identity 및 시장 관측 provenance를 먼저 확인한다. 시장 데이터의 MODEL_INPUT_ALLOWED=false; odds로 prediction을 수정하지 않는다. 국내 108회차 evidence의 기존 identity quarantine도 이 정책으로 해제되지 않는다.

## 검증과 다음 구현 범위

기존 Forward 테스트와 새 정책 계약/별도 PASS grade 테스트만 실행한다. 실전 provider 호출·Forward run·postgame grade·backtest는 수행하지 않는다. 다음 구현이 필요하면 frozen 모델을 건드리지 않는 별도 미션으로 (1) 사전 관측 MISS guard, (2) official FT collector+grade preflight, (3) append-only scorecard/milestone 기록기를 요청해야 한다.

MODEL_CHANGED=NO; ENGINE_CHANGED=NO; WEIGHTS_CHANGED=NO; THRESHOLD_CHANGED=NO; FORWARD_V1_CHANGED=NO; BACKTEST_RERUN=NO; PREGAME_OVERWRITE=NO; POSTGAME_MUTATES_PREGAME=NO; ODDS_MODEL_INPUT=NO.

FOOTBALL_FORWARD_DAILY_OPERATIONS_V1_READY_FOR_CTO_REVIEW

정책 검토 준비 완료. 무인 end-to-end pipeline 완성 판정은 아니다.
