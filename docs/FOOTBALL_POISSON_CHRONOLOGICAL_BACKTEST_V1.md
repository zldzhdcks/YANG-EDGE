# FOOTBALL_POISSON_CHRONOLOGICAL_BACKTEST_V1

Status: protocol freeze for CTO review. **BACKTEST_EXECUTED = NO. STOP after this freeze.**

The adjacent JSON is the normative, machine-readable preregistration. Its canonical SHA256 is in the adjacent `.seal.json`; this document explains the decisions. No performance of the 760 archived matches has been calculated for this protocol.

## Fixed inputs and evaluation

- Base: `162bdf3a5d26c6a2e8d5b78eb3e9c03e89f164f4` on `agent/astra/football-historical-source-gate-v1`.
- Archive SHA256: `df77d7b146f4784fd4021282a6566fcfb36bdd574e1ab46ad8140a24e7585e76` (raw archive bytes).
- Model: `football-poisson-research-v1`. Both its source and its sole timestamp-validation dependency are source-hash pinned in the config. The helper lives under `odds-1x2-v1` but performs only timestamp validation; it supplies no odds or provider predictions.
- EPL 2024/25 (API season 2024): exactly 380 targets. EPL 2023/24 supplies context, never primary evaluation targets.
- Candidate history expands through both seasons. **Effective model history still has the existing 365-day lookback.** Unlimited expanding history would change the frozen model and is therefore not used.
- Existing competition minimum 30, home venue minimum 5, away venue minimum 5, prior strength 5 and maximum expected goals 10 remain unchanged. All existing PASS reasons remain intact; promoted teams receive no special imputation or lowered threshold.

## Temporal contract

Process targets by UTC kickoff epoch milliseconds, then numeric provider fixture ID. For target/group kickoff T, freeze cutoff C = T − 1 millisecond. Derive research availability A = prior kickoff + **48 hours (172800000 ms)**. Eligible history must satisfy A < C, prior kickoff < C and prior kickoff >= C − 365 days, with matching league, allowed season and a different fixture ID.

The strict boundary is intentionally more conservative than A <= T, to match the unchanged model's strict pregame cutoff and observation predicate. A == C is excluded. The lookback lower bound is inclusive. Never use a target's own result. All targets with identical kickoff receive one immutable pre-group history; numeric ID is only an execution tie-break, never a result-availability rule.

48 hours is a fixed research buffer chosen before seeing performance. Ordinary play has two 45-minute halves, an interval and additional time; interruptions and abandoned matches complicate actual completion. See [IFAB Law 7](https://www.theifab.com/laws/latest/the-duration-of-the-match/). IFAB does **not** prescribe this 48-hour policy. It is deliberately much longer than ordinary play, but cannot guarantee completion of suspended matches or the timing of retrospective score corrections. Reliable contrary completion evidence makes the affected evaluation INVALID pending a prospectively revised protocol; do not silently remove troublesome outcomes.

The archive was retrieved retrospectively and has no actual observation/final-whistle timestamp. Persist only `derivedResearchAvailableAt`, `IS_ACTUAL_OBSERVED_AT=false`, `STRICT_REPLAY_PROVENANCE=false`. Archive `resultCompletedAt=null` and existing provenance remain untouched. This is chronological research, **not strict replay**.

The frozen predictor requires a legacy `resultObservedAt` parameter. A future, separately authorized runner must make a narrowly scoped **in-memory research adapter**: project the derived timestamp into that parameter only for the call, carrying explicit false provenance alongside it. Never serialize that alias as an observed fact or modify the original archive. No adapter or runner is implemented by this freeze. This limitation must be visible in the future report; CTO review is not evidence of strict replay.

## Future output and isolation

The JSON enumerates the complete per-target output contract. Map model evidence directly to training/home-venue/away-venue counts and preserve model status/reasons. PASS has all three probabilities, predicted class and correctness null. Actual scores/class may appear only in the post-prediction evaluation join. Target labels must never enter the predictor's target object. Preserve the eligible fixture IDs for later temporal audit.

Predict the largest of pHome/pDraw/pAway, with exact ties HOME then DRAW then AWAY. Reject invalid probabilities; no post-hoc probability repair. Full-time regulation scores determine HOME/DRAW/AWAY. No owner ledger, market odds, provider predictions, live network, picks, stakes, ROI or profit participate.

## Metrics and classification

Report all 380 targets, PREDICTED count, PASS count and coverage. Score only the PREDICTED cohort: accuracy, natural-log multiclass log loss (scoring floor 1e-15, report floor count), unscaled multiclass Brier (sum across 3 outcomes, range 0–2), each class's predicted/actual/correct counts, DRAW recall and all three mean probabilities. Class actual counts use that same cohort. A zero denominator yields null, not zero. Do not round before aggregation.

For each outcome, publish all ten calibration bins [0,.1), …, [.9,1], with count, mean predicted probability and observed frequency. Empty bins have null means/frequency; bins below 20 observations are marked low-sample, never hidden.

Exactly one comparator: unsmoothed empirical HOME/DRAW/AWAY proportions from the identical eligible history. Score it on the paired Poisson PREDICTED cohort with identical metric definitions. No comparator changes after results.

Classification is ordered: any contract failure => INVALID; otherwise fewer than 200 PREDICTED matches or fewer than 20 actual examples of any class in that cohort => INSUFFICIENT_EVALUATION; otherwise BASELINE_MEASURED, even if performance is poor. These are reporting floors, not a power calculation or changes to model input minimums. PROMISING requires a separate CTO annotation and is never automatic. VALIDATED_MODEL remains NO.

## Verification and Cursor handoff

Run `scripts/test-football-poisson-chronological-protocol-v1.ts` using the repository's tsx runtime. Tests use synthetic examples only, verify the config seal and unchanged model source, and exercise boundary/metric contracts. They do not load the archive or run a historical backtest. Existing model synthetic tests remain applicable. Passing these tests certifies the specification examples, **not an unimplemented future runner**.

Next mission, only after a new explicit execution request: implement an offline chronological research adapter/runner against this sealed config; verify archive byte hash and counts; prove target-label isolation and adapter provenance with independent tests; run all 380 targets once; save all PASS rows and all calibration bins; record execution code SHA and this protocol SHA. No model edits, lag variants, minimum changes, betting outputs or main merge. If this contract cannot be implemented faithfully, stop with INVALID instead of silently adapting it.

Local archive location is recorded in `data/audits/football-epl-historical-archive-v1.json`. It is gitignored and is not included in the branch push. A remote reviewer can audit code/config/hashes, but cannot reproduce the full future evaluation without authorized access to that local archive. Do not refetch or upload the archive as part of this freeze. Preserve the source-gate terms/retention limitations.

Hash procedure: recursively sort JSON object keys, preserve array order, serialize compactly as UTF-8 without newline, SHA256. Model hashes normalize CRLF to LF, while archive bytes are hashed without normalization. The seal is separate, avoiding a self-referencing hash. No production entry point or package command is added.

Freeze verification (2026-09-10): 14/14 synthetic protocol tests passed; existing `test-football-poisson-research-v1.ts` passed its numerical oracle, temporal exclusion, identity, sample gates and determinism checks. Scoped strict TypeScript and ESLint checks passed (ESLint emitted only a missing local React-detection warning in this worktree). The local archive byte hash matched the pinned SHA; its records were not evaluated. No engine/source or package changes were made.

Reproduce from a dependency-equipped checkout: `node_modules/.bin/tsx scripts/test-football-poisson-chronological-protocol-v1.ts` and `node_modules/.bin/tsx scripts/test-football-poisson-research-v1.ts` (Windows: use `.cmd`). This worktree used the existing runtime under `../yang-edge/node_modules/.bin/tsx.cmd`. No API key is needed. The test seal is checked, never regenerated by the tests.
