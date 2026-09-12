# FOOTBALL FIRST LIVE FORWARD SNAPSHOT V1

FIRST_LIVE_RUN = VALID. coverageComplete = true.

Branch: agent/astra/football-historical-source-gate-v1

BASE_SHA: 1b1934525b2dec39094ab11b17d803b2f2c08d10

Forward implementation freeze: db7f81883da9215d5cc103a3b954fd35cac83409. Git diff verified no implementation/model changes since freeze. The intervening draw review only changed review/audit files. Prior untracked docs/FOOTBALL_CURRENT_SEASON_DATA_ACCESS_GATE_V1.md was preserved and excluded from this commit.

## Paid access

API-Football direct Pro confirmed by actual /status, active=true. All four league metadata, current fixtures and past FT requests succeeded; Free-plan denial is gone. Smoke test used 17 calls; the unchanged one-shot used 16 calls. Only official v3.football.api-sports.io was requested. No purchase or subscription change was performed by this mission.

- EPL (39): current=2026, 2026-08-21 through 2027-05-30; current/upcoming/past FT access all YES. Smoke history: 2025: 350 FT rows, 2026: 30 FT rows.
- La Liga (140): current=2026, 2026-08-15 through 2027-05-30; current/upcoming/past FT access all YES. Smoke history: 2025: 349 FT rows, 2026: 42 FT rows.
- Serie A (135): current=2026, 2026-08-22 through 2027-05-30; current/upcoming/past FT access all YES. Smoke history: 2025: 360 FT rows, 2026: 31 FT rows.
- Bundesliga (78): current=2026, 2026-08-28 through 2027-05-22; current/upcoming/past FT access all YES. Smoke history: 2025: 289 FT rows, 2026: 19 FT rows.

## Real execution and coverage

Actual UTC before launch: 2026-09-12T03:17:48Z. Runner started 2026-09-12T03:17:55.946Z; completed 2026-09-12T03:19:35.703Z; read-back verified 2026-09-12T03:20:09.191Z.

FIRST_LIVE_SLATE_DATE = 2026-09-12 (UTC).

Full runner window: today through seven days ahead, UTC. TOTAL_SCHEDULED=67; TOTAL_ELIGIBLE=67; TOTAL_PREDICTED=48; TOTAL_PASS=19; TOTAL_MISSED=0.

- EPL: scheduled 16, eligible 16, predicted 10, PASS 6, missed 0; training sample range 380–380, home venue 1–20, away venue 1–20.
- La Liga: scheduled 23, eligible 23, predicted 16, PASS 7, missed 0; training sample range 391–391, home venue 2–21, away venue 2–21.
- Serie A: scheduled 14, eligible 14, predicted 10, PASS 4, missed 0; training sample range 391–391, home venue 1–20, away venue 1–20.
- Bundesliga: scheduled 14, eligible 14, predicted 12, PASS 2, missed 0; training sample range 307–307, home venue 1–17, away venue 1–17.

First UTC slate only: scheduled 20, eligible 20, predicted 15, PASS 5, missed 0. This subset differs from the full seven-day window totals above.

No fabricated past MISS: smoke found no already-started fixture in the queried schedule; initial MODEL_FORWARD had no fixture snapshots; every first-run snapshot was newly SEALED. Fixtures unavailable during the old Free-plan period were not invented as MISS. PASS remains the frozen model's insufficient-data outcome, with null probabilities and reasons; provider errors were not converted into PASS.

## Snapshot verification

67 input/snapshot/receipt sets were read back and all canonical SHA256 values matched. Each receipt was sealed before target kickoff, with cutoff <= predictionCreatedAt <= sealedAt < kickoff. Training IDs/counts, venue counts, same-league 365-day window and all mandatory fields were verified. Each input FT observation's actual providerFetchedAt and source hash matched this run's history audit. Model probabilities were not regenerated during verification.

Target input and target schedule observation contain only the whitelisted identity/schedule keys; target result/score/winner/market fields are absent. Historical FT scores are permitted and used. Snapshot byte hashes were rechecked after verification. Exclusive-create wx/fsync behavior and overwrite/late-seal/PASS/temporal guards passed all 13 existing forward tests. No code changes were needed.

MODEL_VERSION = football-poisson-research-v1

MODEL_SOURCE_SHA256 = 6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf

FORWARD_SNAPSHOT_SHA256 = e6e5fd953242fe9463367dc247f2c2a5493c39b719f05fa5b774a00d6ee0a4ca

This is the hash of the canonical run-level prediction manifest payload containing ordered fixture/hash references. The separate provider run report hash is 88d7693a817132b5bb05b071c2949e6504787b16b88abaf0394b6e0233bda93a; it is not the Forward snapshot hash. Raw provider data and per-match input/prediction snapshots remain gitignored, LOCAL_ONLY. Git includes only this report and sanitized aggregate audit. Existing historical result hashes were separately verified unchanged.

## Watch and governance

WATCH_STARTED = NO. The owner has not confirmed keeping this PC running; no persistent process or scheduler was started. This successful one-shot does not imply daily monitoring is active. No postgame grading or backtest was run.

PAST_COMPLETED_RESULT_DATA_USED=YES; TARGET_RESULT_DATA_USED=NO; ODDS_USED=NO; MARKET_USED=NO; OWNER_SHADOW_USED=NO; EXTERNAL_SHADOW_USED=NO; PROVIDER_PREDICTION_USED=NO.

MODEL_CHANGED=NO; ENGINE_CHANGED=NO; WEIGHTS_CHANGED=NO; THRESHOLD_CHANGED=NO; RAW_PROVIDER_DATA_COMMITTED=NO; LOCAL_FIXTURE_SNAPSHOTS_COMMITTED=NO; API_KEY_COMMITTED=NO; MAIN_MERGED=NO.

FOOTBALL_FIRST_LIVE_FORWARD_SNAPSHOT_V1_READY_FOR_CTO_REVIEW
