# Next-slate production and MLB adapter V1

Base: 6f2152e4cb681157b275ddb1a8d985252923d5a0.
Branch: agent/cursor/football-v31-third-real-batch-preflight-v1.

## Live disposition

No Operator Slate, Source Freeze or Scope Lock after September 20 exists.
INBOX 111 still has the same 13 September 19 screenshots. These are not a new
authoritative slate. No provider collection, real prediction, new scope, or real
terminal decision was executed. September 19/20 evidence remains unchanged:
160 terminal/receipt files match Git; all 84 separately recorded September 20
hashes match. September 20 remains 42 targets / 0 predictions / 42 PASS.

FINAL=NEXT_SLATE_SOURCE_REQUIRED. This is code-path readiness demonstrated by
synthetic integration, not certification of live provider payloads or performance.

## Operational entry point

`npm run research:daily-pregame-production -- --date YYYY-MM-DD`

Optional: `--plan EXPLICIT_LOCAL_JSON`. Without a plan, open targets stay pending.
The source and the scope lock must both match committed HEAD. Existing terminal
evidence is validated and preserved. Each target gets a fresh clock check before
work and after acquisition. Reached kickoff produces only
PASS_PREGAME_WINDOW_MISSED; missing/invalid/recoverable inputs before kickoff
produce no terminal PASS. Midday COVERAGE_INCOMPLETE is normal.

The plan has `scopeSha256` and `targets`, an object keyed by exact locked target ID.
Each target may supply one of these stages:

- `soccerCollection: {leagueId, season}`: collect official NS fixture identity.
  The league must exactly match an existing supported competition label. A sealed
  collection pointer includes operator ID, scope, source hash, real observation
  times and provider identity candidates. Unknown IDs stay REVIEW_REQUIRED.
- `soccer`: the existing fixtureEvidencePath/fixtureEvidenceHash, reviewed
  ExactBinding, historyPath/historyHash contract. Only exact evidence proceeds
  through unchanged frozen Forward v1, then the existing terminal writer. The
  collector is not imported by the prediction consumer. Historical observations
  must already be pinned; no latest-file discovery or hidden history API fetch.
- `mlbCollection`: MlbCollectionBinding, with exact provider game/team IDs,
  names, scope, kickoff and previously verified identity; explicit Odds API event
  ID and bookmaker key. No name similarity or nearest-time mapping is available.
- `mlb`: explicit manifest path/hash/target plus
  `evidenceReview: {status: "VERIFIED", manifestHash, reviewedAt}`. This review must
  refer to the completed collection and occur after its seal. The runner does
  not create that review. It is the real-evidence gate before real MLB execution.

Collection does not manufacture a new VERIFIED identity binding. After reviewing
the collected exact IDs, an operator supplies the pinned consumption-stage plan
and reruns the same command. Existing approved pinned plans run in one command.
No watcher, startup task or service is installed. A running PC and explicit runs
are still needed; execution frequency is not guaranteed by installing this code.

Mutable status is under data/audits/operational; it is explicitly not terminal
research evidence. Soccer success also emits a per-target production audit with
identity, scope, evidence/input/prediction hashes, timestamps and terminal receipt.
No target score/result is included.

## MLB concrete collection path

collection-adapter.ts connects the official sources to native Schedule, Starter,
Odds, Lineup documents and the existing sealed manifest's derived Summary.
MLB StatsAPI schedule requests are exact gamePk, with probablePitcher/lineups
hydration and a restricted field projection. Only Preview status is accepted.
The adapter never calls target boxscore, live feed or postgame review.

Both pitcher histories reuse buildDerivedPitcherStats unchanged, excluding the
target and filtering at actual collection-time availability, before future
kickoff. Prior-day pitching logs are historical features, not target outcomes.
Each starter retains its actual statistical as-of time. Nine distinct provider
lineup players per side are required before labeling that lineup confirmed.
Absent/unreleased lineups remain pending. No predicted lineup is substituted.

Odds use the existing ODDS_API_KEY and official The Odds API MLB endpoint.
An explicitly reviewed event ID and bookmaker are required. Exact event ID,
directed names and kickoff are checked; no selection by first/closest match.
This preserves the existing MLB market-prior input. Football never receives odds.
Secrets/credential-bearing request URLs are not persisted or printed.

All native bytes are sealed with actual collection/observation timestamps,
source identity/as-of, schema, target/start/scope and SHA256 references. Summary
is produced once at collection. Prediction reads only those pinned bytes, with
no provider, builder, latest-file lookup or directory fallback. Equality with the
legacy same-byte scoring fingerprint is tested. No statistical formula changed.

Failed collection leaves immutable orphan attempt files. The next run uses a new
attempt ID; a completed pointer prevents recollection. These files and local
MLB prediction snapshots are ignored by Git, as are the existing Forward caches.
No raw payload is included in this infrastructure commit.

## Terminal semantics and restart

The new MLB_SEALED_RESEARCH_V0 reference admits an immutable research prediction,
not a purchase pick or model graduation. Existing officialPick remains null and
officialStatus is preserved verbatim. Model status remains RESEARCH_BASELINE_V0.
Terminal payloads never substitute a recommended stake or modify model output.

Manifest scope, identity, bytes, timestamps, probabilities and pregame receipt
are validated. Audit reads after kickoff inspect inputs at the sealed prediction
time; the actual predictor still always uses the real clock. A recorded-time
inspection is not an execution-time override. No postgame rerun is needed.

Completed prediction/receipt pairs can be admitted after an interrupted terminal
step, while still pregame. Existing terminal decisions are preserved on restart.
Incomplete/corrupt receipt pairs fail closed and are not repaired automatically.
Concurrent publication is exclusive. A cutoff crossed during work cannot yield
a valid late terminal Prediction.

## Verification and handoff

Regression: all original 137 tests rerun. Additional suite:
`npm run test:next-slate-production-v1` covers concrete collector fixtures,
exact identities, same-byte scoring, no prediction network, terminal integrity,
pending/missed-window behavior, restart and acquisition outage recovery.
Focused TypeScript compilation includes all new entry points and tests.

Frozen Poisson source SHA256:
6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf.
Engine/config/scoring/weights/thresholds/R1 graduation are unchanged.

Next operator action: provide and human-verify a genuinely future slate, freeze
and lock it using the existing approved commands, commit the source/scope, then
provide exact reviewed provider identity and collection/consumption plans.
Run collection, inspect real evidence, and admit only safe pre-kickoff inputs.
Keep code readiness distinct from REAL_EVIDENCE_VERIFIED=false until that happens.
Do not reuse September 19/20 PASS targets or infer unknown Korean provider aliases.
No source/scope/terminal evidence commit was warranted in this mission.
