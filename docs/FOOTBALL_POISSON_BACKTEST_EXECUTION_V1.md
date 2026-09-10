# Football Poisson chronological baseline V1 execution

Execution is explicitly authorized by the owner's 2026-09-10 request. The earlier protocol's no-execution flag describes its freeze mission; the protocol bytes remain unchanged. This implementation does not edit the model, its timestamp helper or any production entry point.

The core module projects target identity/time fields only. Eligible histories are selected with the frozen 48-hour strict availability and 365-day lookback, then adapted to the model's legacy timestamp parameter in memory. Serialized provenance remains `derivedResearchAvailableAt`, `IS_ACTUAL_OBSERVED_AT=false`, `STRICT_REPLAY_PROVENANCE=false`. Identical kickoff targets use the same history snapshot. Actual target scores are joined only after **all predictions** are durably written and read back with a matching hash.

The CLI verifies HEAD, branch, remote tracking HEAD, protocol/archive/source hashes and canonical cohort contracts. It creates an exclusive local run directory before prediction. The directory and execution receipt persist on failure, preventing a silent retry. A valid run writes the local per-match result and a tracked aggregate review seal; raw provider records and per-match outputs stay gitignored. Result SHA256 hashes exact UTF-8 result-file bytes including the final newline. Execution code hashes normalize CRLF to LF and are captured before predictions. The code is not modified after viewing the actual results.

Network entry points are denied for execution. Neither odds, provider prediction, owner data nor external clients are imported by the computation path. The unchanged model imports a timestamp-only helper in an odds-named directory, which supplies no market information. Git push is a separate administrative action after execution and is outside `NETWORK_CALLS=0` for the backtest process.

Pre-execution checks: existing Poisson regression, frozen protocol tests, new synthetic runner tests, scoped strict TypeScript and ESLint. Run the tests with the existing `tsx` runtime. Only after passing these checks, invoke `scripts/run-football-poisson-chronological-backtest-v1.ts --execute-once`. Do not invoke again after the result is sealed. Synthetic tests never read the real historical archive.

Review artifacts:

- `data/audits/football-poisson-chronological-backtest-v1.json`: aggregate summary, all Poisson/comparator calibration bins, governance, input/code hashes and local result SHA.
- `data/cache/research/football/poisson-chronological-backtest-v1/predictions-before-labels.json`: local pre-label predictions.
- `data/cache/research/football/poisson-chronological-backtest-v1/football-poisson-chronological-backtest-v1.json`: local complete result.
- `data/cache/research/football/poisson-chronological-backtest-v1/execution-start.json`: pre-result code/input receipt.

Cursor/CTO handoff: inspect the tracked review seal and frozen inputs; verify the exact-byte local result SHA where authorized local data access exists; inspect runner/tests and the pre-label artifact. Do not rerun, tune, create V2 or merge main. If the run is INVALID, preserve its receipt/error and stop for review. Classification never automatically becomes PROMISING or VALIDATED_MODEL. The original retrospective-archive and assumed-availability limitations still apply even when the run passes its contracts.
