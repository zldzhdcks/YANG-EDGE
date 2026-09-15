# PRE_ASTRA_REPOSITORY_BUILD_BASELINE_V1

Recorded from research branch `agent/cursor/football-v31-third-real-batch-preflight-v1` on 2026-09-15.

Sealed JSON: `data/audits/pre-astra-repository-build-baseline-v1.json`

This is a repository build baseline for Friday Astra Prototype UI work. It is not a Football engine research mission. Engine / Prediction / V3 / V3.1 / sealed Forward artifacts were not modified.

## Commands

| Command | Before | After |
|---|---|---|
| `npx tsc --noEmit` | exit 1 · **121** errors | exit 1 · **96** errors |
| `npm run lint` | exit 1 · **77** errors · 98 warnings | exit 1 · **55** errors · 98 warnings |
| `npm run build` | exit 1 Turbopack symlink | exit 1 same Turbopack symlink |
| `npm run test:football-forward-cumulative-evaluation-v1` | n/a | exit 0 · 17/17 · N=11 unchanged |

## Default build failure (not Astra)

`node_modules` in this worktree is a Windows junction to `C:\Users\TCTCTC\YANG-EDGE\yang-edge\node_modules`. Turbopack refuses a symlink that points outside the project root:

`Symlink [project]/node_modules is invalid, it points out of the filesystem root`

Diagnostic `npx next build --webpack` compiled the app successfully, then failed typecheck on the first remaining `tsc` error (`scripts/audit-2026-08-19-operator-scope-join-v1.ts:378 TS2367`). That error existed at HEAD `62c3013` before this mission.

## What was fixed

Type-only / prefer-const only:

- TS5097 `.ts` import extensions in football historical archive scripts
- Stage G scope count literal types widened to `number`
- Dead `predictionInput` comparison in 1X2 market comparison integrity assert
- Proto-round duplicate export, null band index, unreachable branch, row strip typing, `visualRowIndex` narrowing, allowlist `Set<string>`
- Capture SHA-256 Buffer encoding argument
- `eslint --fix` prefer-const on non-protected files

## What was not fixed

- Historical MLB/operator audit scripts with unreachable union branches and implicit `any`
- MLB independent-model feature validation (`UNKNOWN_RISK`)
- `scripts/football-v31-r1-second-real-batch-seal-v1/test-v1.ts` (`PROTECTED_RESEARCH`)
- holdout / V3.1 `mirror.cjs` `require()` lint (`PROTECTED_RESEARCH`)
- React `set-state-in-effect` / refs lint (`SAFE_PRODUCT_FIX` but behavior-change risk)
- large `no-explicit-any` blocks in KBO/NPB ops scripts

## Astra contract

- `TYPECHECK_BASELINE = KNOWN_FAIL`
- `LINT_BASELINE = KNOWN_FAIL`
- `BUILD_BASELINE = KNOWN_FAIL`
- `ASTRA_BASELINE_READY = true`

Friday Astra work should not be blamed for the remaining exact errors listed in the JSON `unresolved` section.
