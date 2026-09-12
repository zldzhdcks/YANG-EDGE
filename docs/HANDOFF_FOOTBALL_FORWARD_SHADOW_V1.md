# Cursor handoff — Forward Shadow V1

Worktree: `C:/Users/TCTCTC/YANG-EDGE/football-source-gate-v1`

Branch: `agent/astra/football-historical-source-gate-v1`

Base: `f7fff5f40712f28ee18405e069ba21d7c8338398`. Resolve this package's commit with `git log -1 --format=%H -- docs/HANDOFF_FOOTBALL_FORWARD_SHADOW_V1.md`.

Read `docs/FOOTBALL_FORWARD_SHADOW_V1.md` and the sanitized `data/audits/football-forward-shadow-v1-provider-check.json` first. Implementation and tests are complete; the current API-Football Free plan denies season 2026 (allows 2022–2024), so the first live slate and seal remain unavailable. No watch process is running.

## Exact next mission

1. Confirm the owner has current-season and preceding-season access through the existing official provider. Do not buy or change a subscription automatically. Never substitute retrospective archives with invented observation times, fabricate fixtures or force empty-history PASS.
2. Read Git status and this branch's HEAD; preserve all frozen model/protocol/archive files. No main merge and no Poisson v2.
3. Run the command below. The secret stays in the original checkout's `.env.local`, outside Git. This worktree currently uses the original checkout's dependencies:

```powershell
node --env-file=C:/Users/TCTCTC/YANG-EDGE/yang-edge/.env.local C:/Users/TCTCTC/YANG-EDGE/yang-edge/node_modules/tsx/dist/cli.mjs scripts/run-football-forward-shadow-v1.ts --run
```

4. Require coverageComplete=true. Check actual league current seasons and nearest slate, selected FT history and actual providerFetchedAt before prediction cutoff. Verify every PREDICTED/PASS input hash, snapshot hash and pre-kickoff receipt. Never modify an existing seal or MISS. If an incomplete seal exists, preserve it and investigate; do not delete it to retry.
5. Once provider access works, start the same command with `--watch` for six-hour cycles. Keep the PC awake and process running. Inspect daily coverage; do not treat unknown schedules as zero. If the process was offline, its previously observed started fixtures become permanent MISS on restart.
6. Report actual firstLiveSlateDate, scheduled/predicted/PASS/MISS and `forwardSnapshotSha256` from the newly generated run report. The provider-check report hash is NOT a prediction snapshot hash. Do not publish raw licensed data or keys.

Tests:

```powershell
C:/Users/TCTCTC/YANG-EDGE/yang-edge/node_modules/.bin/tsx.cmd --test scripts/test-football-forward-shadow-v1.ts scripts/test-football-poisson-research-v1.ts scripts/test-football-poisson-chronological-protocol-v1.ts scripts/test-football-poisson-backtest-v1.ts
```

No current-season successful end-to-end provider run has been claimed. Past completed scores ARE allowed when actually observed before prediction; Target/unfinished/future results, odds and owner/external inputs remain forbidden. The 48-hour retrospective proxy is never valid forward observation evidence.
