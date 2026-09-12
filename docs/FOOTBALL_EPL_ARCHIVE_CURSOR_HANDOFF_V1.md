# ASTRA → CURSOR: EPL archive frozen, STOP

이번 사용자 실행 목표는 완료됐다. 다음 ingest를 재실행하지 말고 먼저 아래 manifest와 완료보고를 읽는다.

- Worktree: `C:/Users/TCTCTC/YANG-EDGE/football-source-gate-v1`
- Branch: `agent/astra/football-historical-source-gate-v1`
- Base/origin main observed: `1b90cdd3d406dd2991f79fe0836c32d8ba08e4b9`
- Source gate: `d98a6cc089f29f78cd1c0d9c47ac9262a2ba6a2c`
- Ingest commit: `git log -1 --format=%H -- docs/FOOTBALL_EPL_HISTORICAL_ARCHIVE_INGEST_V1.md`
- Aggregate manifest: `data/audits/football-epl-historical-archive-v1.json`
- Local-only archive: `data/cache/research/football/historical-archive-v1/2026-09-10T12-22-36-787Z-2d08238b-cb0c-43fd-9ff2-d20f2a89337b`
- Archive SHA256: `df77d7b146f4784fd4021282a6566fcfb36bdd574e1ab46ad8140a24e7585e76`

수집 결과: 두 시즌 각각 380, 총 760. 전부 FT이며 중복·점수/identity 결측 0. 각 시즌 20팀·380개 방향별 대진을 확인했다.

Chronological retrospective research eligible=YES, strict replay eligible=NO. 당시의 결과 공개 시각이나 YANG EDGE 관측 시각은 없고 실제 2026-09-10 회수 시각만 보존했다. future cutoff 전에 결과가 완료됐는지 판단할 계약은 향후 연구 설계에서 다뤄야 한다. 이번에는 backtest를 실행하지 않았다.

약관은 내부 local cache 사용 근거를 확인했지만 영구 retention/종료 후 보관 등은 TERMS_UNCLEAR. 최신 사용자 지시에 따라 모호한 항목을 기록하고 내부 수집만 수행했다. 기존 SOURCE_GATE handoff의 보류 문구를 다시 적용해 이미 승인된 수집을 취소하지 않는다. 공개·상업·재배포 허가는 생기지 않았다.

API 키는 원래 작업 환경에만 있다. 파일에 복사하지 말 것. 이 worktree의 local archive는 Git으로 백업되지 않는다. worktree 삭제 전 별도 보존이 필요하다. raw/normalized를 커밋하거나 원격으로 push하지 않는다.

검증: `node scripts/ingest-football-epl-historical-archive-v1.ts --verify <위 local archive>`; 신규 단위 10개, 기존 inventory·Poisson 합성 단위, scoped strict typecheck 및 lint 통과. 기존 Engine/Weights/production prediction 파일 차이 없음.

다음 행동은 CTO 검토 대기다. main merge 금지. 새로운 사용자 미션 없이 Poisson/weight를 수정하거나 backtest를 실행하지 않는다.
