# Football Poisson cross-league validation V1 — protocol freeze

The adjacent JSON is the normative preregistration; the adjacent seal contains its canonical SHA256. Base: `66c2a3b76c9fe28ebee8e11017b39d2094619958`. **No La Liga, Serie A or Bundesliga backtest is executed in this mission.**

## Scope resolved before external performance

The owner/CTO research question is reproducibility across domestic top-tier **regular leagues**. Raw API-Football stage evidence verifies Bundesliga 616 canonical fixtures across two seasons: 612 regular fixtures and four `Relegation Round` fixtures. The regular cohort is 306 per season. All four playoffs are OUT_OF_SCOPE_STAGE for both training context and evaluation, independently of their FT/PEN status, scores or any prediction. The existing FT archive still contains 615 rows, with the remaining PEN record preserved in raw/quarantine. No archive bytes or hashes change.

The scope decision receives only fixture ID, league ID, season, provider round and kickoff. Exact provider regular-round labels are accepted (1–38 for La Liga/Serie A, 1–34 for Bundesliga); unknown labels stop for review. No fuzzy identity or date-window guessing. In-scope quality is checked after the stage decision; a bad in-scope record is INVALID, not silently excluded. Serie A's already documented general season-date metadata discrepancy does not alter its explicit fixture-season membership.

The prior four-league ingest manifest remains a historical record with DATA_READY=false for an unresolved mixed-stage response. This new scope preregistration resolves that research question without rewriting the earlier audit. It does not promote all 616 Bundesliga fixtures into a regular-league cohort.

## Frozen external evaluation contract

- La Liga 140: 2023 context 380; primary 2024 targets 380.
- Serie A 135: 2023 context 380; primary 2024 targets 380.
- Bundesliga 78: 2023 regular context 306; primary 2024 regular targets 306.
- Total external targets: 1066. Count mismatch is INVALID/STOP; never pad rows.

Each target uses only its own league's regular-stage history. EPL and other external leagues never enter that target's model input. Candidate history expands through 2023 and earlier eligible 2024 fixtures, while the existing effective 365-day lookback remains.

Cutoff is target kickoff minus 1 ms. Derived research availability is prior kickoff plus 48 hours and must be strictly earlier than cutoff. The 365-day lower boundary is inclusive. All same-kickoff targets share one immutable pre-group history; numeric fixture IDs order execution only. The legacy timestamp-slot adapter remains research-only and in memory. `IS_ACTUAL_OBSERVED_AT=false`, `STRICT_REPLAY=false`; no observation timestamps are fabricated.

The model and timestamp helper source hashes match the EPL freeze. Competition minimum 30, home/away venue minimum 5, prior strength 5, lookback 365 and maximum expected goals 10 remain unchanged. PASS rules and null probabilities stay intact, including for promoted/low-sample teams. The observed EPL DRAW issue causes no model changes.

Metrics, comparator, calibration, probability validation, tie-breaks and classification are copied exactly from the sealed EPL protocol. Retain each league's total/predicted/PASS counts, coverage, accuracy, natural-log loss (1e-15 scoring floor), unscaled multiclass Brier, class counts, DRAW recall, means, confusion matrix and all 30 calibration bins. Empty/small bins remain visible. The one comparator uses only the identical eligible history and the paired Poisson PREDICTED cohort. No new metric or pooled replacement result is added.

Each league is independently INVALID, INSUFFICIENT_EVALUATION, or BASELINE_MEASURED. Sufficiency remains predicted N >=200 and each actual class >=20 in that predicted cohort. PROMISING is not automatic. VALIDATED_MODEL remains NO.

## Preregistered questions and reporting

Q1 compares the unchanged league accuracies with EPL's approximately 51.84% descriptively; no new similarity threshold or success gate is invented. Q2 compares each league's fixed log loss and Brier against its single comparator. Q3 asks whether zero DRAW predictions recurs. Q4 compares outcome-specific calibration bins; Q5 compares coverage and PASS counts. These questions cannot be changed after external results.

Publish LALIGA_RESULT, SERIEA_RESULT and BUNDESLIGA_RESULT independently, with the existing sealed EPL baseline alongside them. No secondary pooled aggregate is preregistered in V1. Retain all outcomes and PASS rows; seal predictions before actual-label joins in the future execution mission. Use this cross-league protocol version/hash in each future result, with explicit league/season identity.

## Evidence, verification and handoff

`data/audits/football-cross-league-scope-v1.json` records verified actual counts, provider round labels and a canonical metadata-decision hash for each external league. It contains no goals, probabilities or performance. The read-only scope audit checks raw response/file hashes and retains all canonical stage rows in memory for counting, including the quarantined playoff. It writes no archive and calls no provider.

Hash policy matches the parent: recursively sorted object keys, preserved array order, compact UTF-8 JSON without newline; the seal is separate. Model source hashes normalize CRLF to LF, and archive hashes use exact file bytes. The config also pins the scope audit hash and the previously measured EPL result hash.

CTO/Cursor: review config, seal, scope audit and tests. The scope helpers are metadata selectors, not a new backtest runner. After a separate explicit execution request, adapt the existing offline runner to independent league inputs while preserving the frozen algorithm/metrics; verify the pinned hashes and all scope invariants first. Never call the old EPL runner on pooled data. Do not rerun EPL, tune V1, weaken PASS, use odds/provider predictions, access owner data, or merge main. Raw/per-match licensed records stay local. **STOP after protocol commit and push.**

Freeze verification: new protocol/scope tests 10/10, existing league archive tests 7/7, existing EPL protocol tests 14/14 and Poisson synthetic regression passed. Scoped strict TypeScript and ESLint passed; lint emitted only the existing worktree React-detection warning. Raw stage/file verification confirmed all external scope counts without prediction. No production/model/previous protocol or archive files changed.
