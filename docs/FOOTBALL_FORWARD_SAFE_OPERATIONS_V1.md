# FOOTBALL_FORWARD_SAFE_OPERATIONS_V1

BASE_SHA = 2718899eda3a04d6e286b6138631908e457a73bd

This operations change resolves the three implementation gaps recorded in `FOOTBALL_FORWARD_DAILY_OPERATIONS_V1.md`: first-seen MISS classification, official FT collection, and append-only scorecards. The earlier document remains a historical policy freeze; its statements that these components were missing describe that earlier commit. Model, training rules, probabilities, argmax, thresholds and historical backtests remain unchanged.

## Entry points and deployment boundary

Run in the football research worktree. This host uses the existing checkout's Node/tsx installation and local environment file. Never print or commit that file.

```powershell
# Complete one-shot: discovery -> existing frozen pregame runner -> FT -> scorecards
node --env-file=C:/Users/TCTCTC/YANG-EDGE/yang-edge/.env.local C:/Users/TCTCTC/YANG-EDGE/yang-edge/node_modules/tsx/dist/cli.mjs scripts/run-football-forward-safe-operations-v1.ts --run

# Independent official FT collector; does not execute predictions
node --env-file=C:/Users/TCTCTC/YANG-EDGE/yang-edge/.env.local C:/Users/TCTCTC/YANG-EDGE/yang-edge/node_modules/tsx/dist/cli.mjs scripts/run-football-forward-postgame-v1.ts --run

# Local scorecard regeneration; append-only, no provider request or prediction
node C:/Users/TCTCTC/YANG-EDGE/yang-edge/node_modules/tsx/dist/cli.mjs scripts/football-forward-scorecard-v1.ts --run
```

The integrated entry point also accepts `--watch`, with a six-hour delay after each completed cycle. **It has not been started.** The older `run-football-forward-shadow-v1.ts --watch` remains pregame-only; use the integrated entry point for a future full-cycle watch. No startup task, service, scheduler, purchase, subscription change or main merge is included. PC shutdown, sleep, process termination and provider outages stop successful collection; this is not a hosted availability guarantee. One successful daily coverage check is still the operating objective.

Use one writer on one host. Integrated cycles and collectors have exclusive lock files; an existing lock stops a second invocation. A crash may leave a lock: verify the owning process has stopped and investigate partial evidence before manually clearing only the lock. Never remove evidence to restart a run. Do not run the older pregame CLI concurrently with the integrated CLI. Collector errors and partial discovery make a one-shot fail; later cycles retry only still-ungraded fixtures. The collector has a 100-request ceiling per cycle and 6.5-second spacing; exhausting this budget is an error, not successful coverage.

## Immutable observation ledger and absence states

All runtime evidence is LOCAL_ONLY under `data/cache/research/football/forward-shadow-v1/MODEL_FORWARD/`.

- `schedule-ledger/<fixtureId>/first.json` exclusively preserves first actual observation, identity, kickoff and firstSourceHash; recordedAt is the current time of ledger creation.
- `schedule-ledger/<fixtureId>/observations/<hash>.json` appends each projection, latestObservedAt, kickoff and source hash. Repeated identical observations are idempotent; schedule changes never rewrite first.json.
- Migration reads actual scheduleFetchedAt from pre-existing hash-verified run schedules, ordered by observation time. It does not use file mtime or invent historical observedAt. The original run-envelope hash is the migration source; new discovery hashes identify the whitelisted provider schedule projection. These are not claimed to be hashes of raw provider response bytes.
- Earlier evidence appearing after ledger initialization requires review rather than silently changing firstObservedAt.

Only firstObservedAt < kickoff, no valid seal, and now >= kickoff permits `MISSED_PREGAME_SNAPSHOT`. A first observation at or after kickoff creates `first-seen-after-kickoff.json`: FIRST_SEEN_AFTER_KICKOFF, MISS=false, BACKFILL=false, PREDICTION=false. It is separate from the MISS population. Both absence states permanently prohibit backfill, including a later reschedule. Existing MISS records remain byte-identical; no retrospective cleanup is performed. Cancelled/postponed/TBD fixtures are not assumed to have started.

Prediction admission remains NS and at least 60 seconds before kickoff; receipt must be before kickoff. Admission is not a promise that disk sealing completes 60 seconds before kickoff. The model's existing timing checks and late-seal invalidation remain in force.

## Official postgame path

The collector reads only sealed MODEL_FORWARD fixture identities. Before any result request it checks snapshot/input/receipt envelope hashes and links, fixture/league/team identity, frozen model identity, cutoff <= creation <= receipt < kickoff, forbidden-input flags, and absence of invalid/MISS/late-discovery markers.

Future fixtures stay pending without an API call. Existing grades are validated and skipped without an API call. Remaining past-kickoff candidates are fetched individually from the fixed official API-Football `/fixtures?id=` endpoint; redirects are forbidden. Only fixtureStatus FT and `score.fulltime.home/away` are projected. Identity and kickoff must match the sealed target; a provider schedule correction requires review. Non-FT responses remain pending; malformed/error/identity-mismatched responses cannot grade.

`providerFetchedAt` is the actual response-read completion time, with kickoff < providerFetchedAt <= gradedAt. `sourceHash` is SHA256 of the actual response text. Raw response text is used in memory and is not committed or persisted by this collector. The grade seals the projected result and source hash; independently revalidating the raw response bytes later would require a separate authorized local raw-retention step.

`postgame/<fixtureId>.json` is exclusive-create and contains fixtureId, predictionHash, actualScore, actualClass, correct1X2, gradedAt, providerFetchedAt, officialCompletionEvidence and sourceHash. Existing nested providerFetchedAt remains readable; new grades also expose the requested top-level field. A PASS stores actual results but correct1X2=null. Existing grade content and hash must validate before SKIP. Provider corrections do not overwrite/delete/recreate grades; correction review is separate. Pregame inputs, snapshots and receipts are never grading outputs.

## Daily scorecards and checkpoints

`scorecards/<UTC kickoff date>/<timestamp>-<uuid>.json` is append-only. A sealed prediction's original kickoff date determines its cohort even if later schedule projections change. Unsealed fixtures use the latest observed kickoff. Discovery reports define an inclusive UTC today-through-seven-days coverage window; the latest relevant report supplies coverage evidence. Failed or missing coverage is not a zero-fixture day. Historical uncovered dates may therefore have scheduled=null and coverageComplete=false.

Fields: scheduled, observedScheduled, eligible, predicted, pass, missed, firstSeenAfterKickoff, graded, pending, gradedPredicted, gradedPass, homePredictions, drawPredictions, awayPredictions, predictedCorrect, predictedIncorrect, accuracy, coverageComplete. Eligible includes valid seals plus current unsealed NS fixtures meeting the admission deadline. ObservedScheduled is the observed population, not a claim that unobserved fixtures do not exist. FIRST_SEEN_AFTER_KICKOFF remains separate; no MISS-rate denominator includes it.

For verified evidence, HOME+DRAW+AWAY=predicted; graded+pending=predicted+pass; predictedCorrect+predictedIncorrect=gradedPredicted. Accuracy is null until gradedPredicted>0 and excludes PASS. A corrupt grade/seal produces errors and null dependent counts, not fabricated zeros; checkpoint creation is blocked for that run.

Only GRADED_PREDICTED_UNIQUE advances checkpoints 25, 50, 100, 200. Exact first-N cohorts are ordered by gradedAt then numeric fixtureId; `milestones/<N>.json` seals fixture IDs, prediction hashes, grade hashes and gradedAt. Re-running does not announce the same crossing again. A previously sealed cohort that no longer matches requires review, never overwrite. No checkpoint review runs automatically. N<100 is not engine-change evidence; N=100 allows internal research review only, never automatic validation status. Historical and Forward results are never combined into one accuracy. Market/owner/external evidence cannot enter the model; market comparison remains a separate post-seal step.

## Verification, governance and handoff

See `data/audits/football-forward-safe-operations-v1.json` for real one-shot timestamps, aggregate counts, local report hashes, preservation checks and test results. No fixture payloads or provider responses are in that audit.

The real one-shot ran 2026-09-12 03:46:20.649–03:48:03.189 UTC: 16 discovery requests, complete four-league coverage, 67 existing seals (48 PREDICTED / 19 PASS), no new predictions, 67 pregame pending, 0 MISS, 0 first-seen-after-kickoff, 0 grades. Therefore no live FT response was requested; FT, non-FT and PASS grading were exercised with synthetic official-response fixtures in tests. Total graded PREDICTED/PASS are both 0; no milestone is reached and accuracy remains null.

Scorecards cover observed/report dates through 2026-09-19 UTC. The earlier failed coverage days September 10–11 retain scheduled=null and coverageComplete=false. All 219 pre-existing local evidence files, both historical result seals and the frozen model hash are unchanged. The prediction/calculation portion of the pregame code matches BASE_SHA exactly. All 26 tests pass (15 existing regression + 11 operations tests), with strict TypeScript and ESLint passing; the shared React lint configuration emits a package-detection warning in this worktree.

SAFE_FOR_WATCH=YES applies to an explicitly started single-host integrated foreground cycle under the documented limits. WATCH_STARTED=NO. Live FT grading has not yet occurred; no performance claim follows from this operational readiness result.

Regression command:

```powershell
node C:/Users/TCTCTC/YANG-EDGE/yang-edge/node_modules/tsx/dist/cli.mjs --test scripts/test-football-forward-shadow-v1.ts scripts/test-football-forward-daily-operations-v1.ts scripts/test-football-forward-safe-operations-v1.ts
```

Cursor handoff: retain this branch and the pre-existing untracked access-gate document. Review the sanitized audit, inspect local hash-verified evidence and validate locks before a manually authorized future run. Do not run a backtest, alter the model, reseal the 67 existing predictions, or start watch as part of this handoff. If a future official FT response is corrected, investigate separately and preserve the original grade.

MODEL_CHANGED=NO; ENGINE_CHANGED=NO; WEIGHTS_CHANGED=NO; THRESHOLD_CHANGED=NO; PREDICTION_LOGIC_CHANGED=NO; BACKTEST_RERUN=NO; ODDS_USED=NO; MARKET_USED=NO; WATCH_STARTED=NO.

MISS_ORCHESTRATION_CHANGED=YES; POSTGAME_AUTOMATION_ADDED=YES; SCORECARD_ADDED=YES.
