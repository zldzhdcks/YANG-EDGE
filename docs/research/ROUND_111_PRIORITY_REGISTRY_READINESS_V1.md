# Round 111 priority preview and V4 registry readiness

Base: `37f7219e6b613c31b0819b7afec728f9446aef1b`. Evidence namespace:
`data/research/slate-batches/round-111-odds-new-v1/priority-readiness-v1/`.

The two batch Predictions remain sealed and unchanged. Preview v4 is an appended
PREVIEW_PRE_LINEUP version, preserving v3 and copying probabilities directly from
the named batch seals. Venue, confirmed XI, injury and suspension are unknown.
Historical context reports only counts in the already sealed completed-FT input.
Market rows retain their source hashes; blank labels are unresolved, not inferred.

## Cumulative discrepancy

At 2026-09-20T04:28:57.536Z, the two explicit Official Forward roots contain
47 PREDICTED seals, covering **45 unique fixtures**, with 15 grade files present.
Unique ungraded fixtures: 30; ungraded artifact copies: 32. No grade body was read.
Grade presence does not revalidate an evaluation denominator or its outcomes.

Fixtures 1557413 and 1570394 each have a September 13 global snapshot and a
different September 20 batch snapshot. These are hash conflicts, not two new
unique fixtures. Both versions are preserved. No canonical precedence, revision
authorization or grade eligibility is silently inferred. Canonical reconciliation
is required before aggregate evaluation uses the conflicting versions.

## Membership evidence

Current `/players/squads?team=ID` responses establish observed roster membership,
not historical transfer dates, league registration eligibility, availability or XI.
Provider documentation: https://www.api-football.com/news/post/football-players-squads

League/season are the exact future fixture context. `validFrom` is actual receipt
time; `validTo=null` is an open observation interval, not a guarantee of permanence.
Only exact Provider IDs are consumed. Names are labels. Population: Manchester City
25, Sunderland 37, Atlético Madrid 33, Real Madrid 38; total 133, unresolved 0,
conflicts 0. Later unseen players must still fail exact membership checks.

First attempt made 4 roster calls and preserved local raw bytes, but failed because
Sunderland supplied player 381014 twice with entirely identical raw fields. No
registry was admitted from that attempt. Attended recovery now records durable
receipt time before normalization, collapses only entirely identical raw rows, and
rejects conflicting duplicate IDs. Four new requests supplied actual timestamps;
none were reconstructed from file modification time. Raw responses remain local.

Rights remain CONDITIONAL internal use, owner authorized with provider Chat AI
guidance. This is neither a formal license nor human support confirmation. Public
raw display and commercial rights remain unresolved; no legal status was upgraded.

## V4 execution handoff

Four frozen poll windows are unchanged: City 21:00/21:20/21:30/21:40 KST;
Atlético 22:15/22:35/22:45/22:55 KST on September 20.
`poll-job-index.json` pins 14 jobs within the existing 16-request daily budget.
At each fixture's first poll: one XI request (both teams), one injuries request
(both teams), one Player Stats page for each team. Later polls request XI only.
No automatic pagination: Player Stats page 1 is explicitly partial and remains
UNRESOLVED pending data-through and membership review. No features are admitted.

Each job is a committed manifest with exact identity, registry and rights hashes.
Run from the repository, using a manifest from the job index:

```powershell
node --env-file=.env.local --import tsx scripts/run-football-v4-prospective-evidence-v1.ts --date 2026-09-20 --batch round-111-odds-new-v1 --manifest priority-readiness-v1/poll-1557413-0-XI-50.json
```

Default is PLAN_ONLY with zero provider calls. Only at its one-minute scheduled
window may the same command append `--collect`. Never backfill missed windows.
Preserve claims and receipts; failed requests are not blindly retried. The runner
now accepts either existing API key environment variable and fails an empty or
temporally unverified registry before network access. No OS service is installed.
The PC and Codex task must be available for scheduled execution.

## Remaining targets

All 42 football targets were examined. Two already have batch seals; 25 are outside
the supported league set, 14 lack a pair of exact registered Provider-ID aliases,
and Villarreal–Levante (1570402) is exact but already has a global seal. This last
fixture remains PENDING for committed-batch binding review; its later identity
observation cannot be backdated to the earlier global prediction cutoff. One NS-only
provider request was made. No new prediction, early PASS or fuzzy binding was made.
Batch terminal state remains 2 Predictions, 1 PASS and 58 PENDING across 61 targets.

## Validation and boundaries

Focused suite: 76/76. Full typecheck: zero errors. Local artifact audit confirms
prior previews and predictions unchanged, append-only preview behavior, exact sealed
values, roster hashes/IDs/timestamps, frozen model hash and poll budget. Committed
CLI gate and local immutable-store probe are recorded separately after commit.

Prediction provider calls 0. Membership calls 8 (including failed first population)
and NS identity calls 1. Target results/live/postgame accessed false. No new grade,
backtest, model fit, Engine, weight, threshold or feature change. V4 remains evidence
foundation only; neither V4 Prediction nor Shadow is permitted.

Cursor handoff: use this namespace and the committed job index, inspect the final
gate audit, retain every original/untracked artifact, and resolve the two global
snapshot conflicts before any evaluation aggregation. Do not replay population,
package scripts or Predictions merely to recover context. A valid collection result
may append a new Preview version; it must not overwrite v4 or change its Prediction.
