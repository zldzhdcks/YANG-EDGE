# EPL Historical Archive Ingest V1 — CTO review

STATUS: FOOTBALL_EPL_HISTORICAL_ARCHIVE_V1_READY_FOR_CTO_REVIEW

## Git / 실행 범위

- BASE_SHA / origin/main 확인: `1b90cdd3d406dd2991f79fe0836c32d8ba08e4b9`
- SOURCE_GATE_COMMIT / 작업 시작 HEAD: `d98a6cc089f29f78cd1c0d9c47ac9262a2ba6a2c`
- BRANCH: `agent/astra/football-historical-source-gate-v1`
- 시작 working tree: clean. 이 브랜치에서 이어서 작업. Owner 도구 checkout 변경 없음.
- 본 문서가 포함된 커밋이 INGEST_COMMIT이다. `git log -1 --format=%H -- docs/FOOTBALL_EPL_HISTORICAL_ARCHIVE_INGEST_V1.md`로 정확한 SHA를 얻는다. 자기 커밋 SHA를 파일에 삽입해 순환시키지 않는다.
- main merge, push, 구매, 새 계정 등록, 외부 메시지 발송 없음.

## Terms / rights

TERMS_CHECKED_AT: 2026-09-10T12:16:40.000Z. [현재 약관](https://www.api-football.com/terms), [공식 저장/cache 안내](https://www.api-football.com/news/post/how-to-optimize-api-sports-calls-and-quota-usage), [공식 시즌 fixture 조회 안내](https://www.api-football.com/news/post/how-to-get-all-fixtures-data-from-one-league)를 재확인했다.

- HISTORICAL_RETRIEVAL_ALLOWED: YES, 계정이 허용하는 시즌과 공식 API 범위.
- LOCAL_RESEARCH_STORAGE_STATUS: 공식 안내가 로컬 DB/cache를 지원한다. 이번 사용은 사용자 지시에 따른 비공개 로컬 연구 아카이브로 한정한다. 영구 보관 권리를 확정했다고 주장하지 않는다.
- PUBLIC_REDISTRIBUTION_STATUS: 이번 검토로 허가되지 않음. 직접 재판매 금지. 원본과 경기별 정규화 기록 모두 LOCAL_ONLY.
- COMMERCIAL_USE_STATUS: NOT_CLEARED. 리그/제3자 이용·공개·상업 권리를 API 접근권으로 대체하지 않는다.
- RETENTION_STATUS: TERMS_UNCLEAR. 보관 기간, 종료·요금제 변경 후 권리를 확정할 명시 조항을 확인하지 못했다.
- ATTRIBUTION_STATUS: 일반 숫자 feed에 대한 일률적인 출처표시 의무는 TERMS_UNCLEAR. 출처와 API provenance는 자발적으로 보존한다.
- UNCLEAR_ITEMS: 영구 retention, 계약 종료 후 권리, 향후 공개/상업 제3자 권리, 일반 숫자 feed attribution. 공개·상업 사용 또는 무기한 보관을 결정하기 전에 확인한다. 임의 보관기한은 만들지 않았다.

세부 값은 `FOOTBALL_EPL_ARCHIVE_TERMS_V1.json` 및 각 로컬 manifest에 포함된다. 현재 사용자 실행 지시(모호한 항목을 명시하고 내부 아카이브 확보)가 이전 handoff의 포괄적인 중단 제안보다 우선한다. 새로운 법률상 권리를 추정해서 부여한 것은 아니다.

## 실제 수집과 시즌 정의

공식 API 4회: `/status`, `/leagues?id=39`, `/fixtures?league=39&season=2023&timezone=UTC`, 2024 동일 쿼리. Free active / 100 requests per day. 순차 호출, date 없음, retry/라운드 sweep 없음. 전체 시즌 조회가 errors=[] 및 paging 1/1로 성공했다. 기존 daily provider는 수정하지 않았다.

Provider가 반환한 시즌 경계:

- season=2023: 2023-08-11 ~ 2024-05-19 → 2023/24 시즌.
- season=2024: 2024-08-16 ~ 2025-05-25 → 2024/25 시즌.

최종 retrieval: **2026-09-10T12:22:59.884Z**. batch별 개별 fetchedAt, query, count, source SHA256 및 quota 응답 헤더를 로컬 manifest에 기록했다. 계정 이름/이메일 및 인증 헤더는 저장하지 않았다.

## Dataset / completeness — 실제 반환 기준

- 2023: raw 380, canonical 380, completed 380, usable regular-time 380. 완전성 100% (기대 380 대비). 팀 20, 방향별 대진 380, 반복 대진 0.
- 2024: raw 380, canonical 380, completed 380, usable regular-time 380. 완전성 100% (기대 380 대비). 팀 20, 방향별 대진 380, 반복 대진 0.
- TOTAL_RAW_ROWS = 760
- TOTAL_CANONICAL_MATCHES = 760
- COMPLETED_FIXTURES = 760
- USABLE_COMPLETED_MATCHES = 760
- DUPLICATES = 0; CONFLICTING_FIXTURE_IDS = 0
- MISSING_SCORE = 0; MISSING_IDENTITY = 0
- MISSING_KICKOFF = 0; MISSING_HOME_TEAM = 0; MISSING_AWAY_TEAM = 0
- UNEXPECTED_STATUSES = 0; SEASON_CONTAMINATION = 0
- EARLIEST_KICKOFF = 2023-08-11T19:00:00.000Z
- LATEST_KICKOFF = 2025-05-25T15:00:00.000Z

380으로 채워 넣지 않았다. 실제 반환 행에서 unique ID·유효 점수·팀·시즌·대진 구조가 모두 기대치와 일치했다. 결측/불일치는 격리하도록 구현했지만 이번 실제 자료에는 없었다. 완료 경기 상태는 모두 FT이며 AET/PEN 또는 총 goals로 정규시간 점수를 대신하지 않았다.

## 역할과 시간 무결성

CHRONOLOGICAL_RESEARCH_ELIGIBLE = YES (결과 데이터셋 무결성 통과).
STRICT_REPLAY_ELIGIBLE = NO.

정규화 데이터는 `RETROSPECTIVE_HISTORICAL_RESULT`이고 `kickoffUtc ASC, providerFixtureId ASC`(숫자 비교)로 정렬돼 있다. 각 행의 실제 `providerFetchedAt`은 보존했다. `resultCompletedAt=null`, `strictAsOfProvenance=UNAVAILABLE`. Provider가 나중에 정정한 최종 상태일 수 있으며 당시 YANG EDGE가 보유했던 응답으로 주장하지 않는다.

과거 결과 자체를 현재 조회했다는 이유로 폐기하지 않는다. 다만 향후 chronological 연구에서는 T cutoff 이전에 결과가 끝났음을 어떻게 입증하거나 명시적으로 가정할지 별도 설계해야 한다. kickoff 정렬만으로 경기 완료가 증명되는 것은 아니다. kickoff+2시간, 파일 mtime, 임의 observedAt을 생성하지 않았다. 두 backtest 유형의 성능 수치를 혼합하지 않으며, 이번에는 어느 유형도 실행하지 않았다.

## Local freeze / hashes

로컬 root:
`data/cache/research/football/historical-archive-v1/2026-09-10T12-22-36-787Z-2d08238b-cb0c-43fd-9ff2-d20f2a89337b/`

- `2023/raw.json`, `2024/raw.json`: provider 응답.
- `2023/normalized.json`, `2024/normalized.json`: 시즌별 정규화.
- `league-metadata.json`: provider 시즌 정의 증거.
- `archive.json`: 전체 정규화 아카이브.
- `quarantine.json`: 격리 결과(이번에는 비어 있음).
- `football-epl-historical-archive-v1.json`: 로컬 manifest, 배치별 provenance 및 모든 파일 해시.

**FOOTBALL_EPL_HISTORICAL_ARCHIVE_SHA256** (정확한 `archive.json` UTF-8 bytes, 마지막 newline 포함):
`df77d7b146f4784fd4021282a6566fcfb36bdd574e1ab46ad8140a24e7585e76`

각 raw 파일 hash와 로컬 manifest 자체 hash는 커밋 가능한 집계 manifest `data/audits/football-epl-historical-archive-v1.json`에 보존한다. 경기별 데이터는 집계 manifest에 포함하지 않는다. 오프라인에서 원본 해시를 검사하고 정규화·audit를 다시 생성해 동일 archive SHA와 audit가 나오는 것을 확인했다.

이 로컬 root 전체는 `.gitignore`에 등록했다. **Git 커밋은 데이터 백업이 아니다.** 로컬 아카이브를 따로 보존하기 전 이 worktree를 삭제하지 않는다. 공개 serving 경로로 복사하거나 자동 업로드하지 않는다.

## 검증 및 재현

- 신규 단위 테스트 10/10 PASS: 필수 필드, UUID 아닌 provider ID 고유성, 중복/충돌, 정규시간 점수, 실제 fetchedAt, 미래·잘못된 날짜 차단, ordering, 시즌 분리, 오류 envelope, offline 재생/변조 탐지, 기본 dry-run.
- 기존 historical inventory 단위 테스트 PASS.
- 기존 Poisson 합성 fixture 단위 테스트 PASS. 수집한 760경기에 Poisson을 호출한 것이 아니다.
- 신규 두 파일 scoped strict TypeScript PASS (`module=esnext`, `moduleResolution=bundler`, 프로젝트 설정과 일치). 전체 프로젝트 clean typecheck를 주장하지 않는다.
- 신규 두 파일 scoped ESLint PASS. React detection 경고는 React를 쓰지 않는 독립 worktree에서 발생했으며 lint error는 없다.
- 첫 nodenext typecheck 시 package CommonJS 판정으로 import.meta/top-level await 오류가 있어 프로젝트의 ESNext/bundler 설정으로 검증했다. package.json 변경 없음.
- sandbox에서 기존 tsx의 OS 사용자정보 조회가 실패했으나 승인된 동일 단위 테스트 재실행은 통과했다.
- 최종 비밀정보/추적 파일 검사: API key actual value는 코드·문서·manifest·로컬 raw 어느 곳에도 포함되지 않음. 로컬 raw/normalized는 Git 추적되지 않음.

Node 24.18.0 기준(독립 CLI의 ESM 재판별 warning은 비치명적):

```powershell
node scripts/ingest-football-epl-historical-archive-v1.ts
node --test scripts/test-football-epl-historical-archive-v1.ts
node scripts/ingest-football-epl-historical-archive-v1.ts --verify data/cache/research/football/historical-archive-v1/2026-09-10T12-22-36-787Z-2d08238b-cb0c-43fd-9ff2-d20f2a89337b
```

기본 명령은 dry-run이다. `--execute`는 현재 계정 키와 24시간 이내 약관 검토 기록이 있어야 실행하며 새 immutable run 디렉터리를 만든다. 완료 자료를 재검증할 때는 `--verify`를 사용해 불필요한 provider 재호출을 피한다.

## Governance / STOP

ODDS_USED=NO; PROVIDER_PREDICTION_USED=NO; ENGINE_CHANGED=NO; WEIGHTS_CHANGED=NO; PRODUCTION_PREDICTION_CHANGED=NO; BACKTEST_EXECUTED=NO; STRICT_AS_OF_FABRICATED=NO; OWNER_PRIVATE_DATA_USED=NO.

CTO 검토 자료를 생성하고 STOP. 다음 승인이 있어도 기존 model을 변경하거나 strict replay라고 이름을 바꾸어 실행하지 않는다. 이어받기 사항은 `FOOTBALL_EPL_ARCHIVE_CURSOR_HANDOFF_V1.md`.
