# FOOTBALL V3 FEATURE DATA ACCESS GATE V1

V3_DATA_GATE = V3_PARTIAL_DATA_READY. API-Football Pro remains the primary internal data path. Actual fixture statistics contain xG, shots and shots on target, but xG is absent in two current-season samples. This gate establishes conditional access and inventory, not a complete research dataset or model readiness. No model, backtest, feature formula, imputation or specification was implemented.

## Git and evidence

BASE_SHA = 8a00f9c36c343e8623a6cbc3ca88e995792c3b9b
BRANCH = agent/astra/football-historical-source-gate-v1
EXPECTED_HEAD = VERIFIED against local HEAD and origin before work. Existing untracked FOOTBALL_CURRENT_SEASON_DATA_ACCESS_GATE_V1.md preserved.

Audit canonical-payload SHA256 = 37aef3e80f6559fcc0c272e99ed0dfef8c187aaa809475744ec4d66b195d82e5
Probe interval = 2026-09-12T06:01:13.495Z to 2026-09-12T06:03:21.892Z
Official API calls = 53; statistics samples = 36. No alternative account/API, purchase or subscription change. Raw responses and probe code are outside the repository at C:\Users\TCTCTC\YANG-EDGE\YANG-EDGE-INBOX\football-v3-feature-access-gate-v1\2026-09-12T06-01-13-495Z\probe-report.json. The committed JSON contains presence/schema/provenance metadata, not raw feature values.

## API-Football endpoint and schema evidence

Actual /status confirms active Pro, a 7,500/day quota and 300/minute rate-limit header. Sampling was paced below 29/minute. Published Pro price is USD19/month; no additional plan is needed for this sampled endpoint access. [Official pricing](https://www.api-football.com/pricing).

- GET /leagues?id={39|140|135|78}&season={2023|2024|2026}: all 12 responses included the requested season and statistics_fixtures=true. All four season-2026 records explicitly had current=true. This league flag does not guarantee each statistic or fixture.
- GET /fixtures?league={id}&season=2026: actual fixture metadata inventory, including exact fixture/team/league/season IDs and kickoff. Historical counts use the unchanged hash-verified local official archives.
- GET /fixtures/statistics?fixture={id}: two expected team blocks, each with statistics[{type,value}]. Both exact team IDs must match the canonical fixture. The fixture binding comes from the request parameter; the statistics blocks do not themselves supply league/season/kickoff. Identity never uses team-name similarity or nearest kickoff.
- Exact types observed: expected_goals; Total Shots; Shots on Goal; Ball Possession; Corner Kicks. The xG values are provider-produced team-level fixture aggregates, not a new YANG EDGE xG estimate or provider 1X2 prediction. Non-null numeric/type checks passed. String, null and absent-field distinctions are retained in raw evidence.

The official guide documents fixture team statistics and variable/null coverage. The dynamic v3 documentation body was not extractable in the web reader; direct authenticated endpoint responses establish actual xG presence here. [Statistics guide](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide), [v3 documentation](https://www.api-football.com/documentation-v3).

The older research/FOOTBALL_PLAYER_DATA_INTAKE_PRIORITY_V1.md claim that xG is unavailable is superseded for this gate by these actual observations. That historical document was not modified.

## Coverage sample — not a census

Selection was recorded before requests: within each league/season FT Regular Season cohort ordered by kickoff then numeric fixture ID, select the first, floor((N−1)/2), and last index. No replacement based on values, missingness or outcomes. Three fixtures per cell cannot estimate whole-season completeness. The percentages below are sample percentages only; stats_available_total and full-season coverage remain UNKNOWN/null. Coverage excludes inherited Bundesliga relegation playoffs from the research cohort without deleting them from existing archives.

- EPL 2023: total fixture inventory 380; completed Regular Season 380; sampled 3; stats available 3/3; xG 3/3 (100.00%); shots 3/3 (100.00%); SOT 3/3 (100.00%).
- EPL 2024: total fixture inventory 380; completed Regular Season 380; sampled 3; stats available 3/3; xG 3/3 (100.00%); shots 3/3 (100.00%); SOT 3/3 (100.00%).
- La Liga 2023: total fixture inventory 380; completed Regular Season 380; sampled 3; stats available 3/3; xG 3/3 (100.00%); shots 3/3 (100.00%); SOT 3/3 (100.00%).
- La Liga 2024: total fixture inventory 380; completed Regular Season 380; sampled 3; stats available 3/3; xG 3/3 (100.00%); shots 3/3 (100.00%); SOT 3/3 (100.00%).
- Serie A 2023: total fixture inventory 380; completed Regular Season 380; sampled 3; stats available 3/3; xG 3/3 (100.00%); shots 3/3 (100.00%); SOT 3/3 (100.00%).
- Serie A 2024: total fixture inventory 380; completed Regular Season 380; sampled 3; stats available 3/3; xG 3/3 (100.00%); shots 3/3 (100.00%); SOT 3/3 (100.00%).
- Bundesliga 2023: total fixture inventory 306; completed Regular Season 306; sampled 3; stats available 3/3; xG 3/3 (100.00%); shots 3/3 (100.00%); SOT 3/3 (100.00%).
- Bundesliga 2024: total fixture inventory 306; completed Regular Season 306; sampled 3; stats available 3/3; xG 3/3 (100.00%); shots 3/3 (100.00%); SOT 3/3 (100.00%).
- EPL 2026: total fixture inventory 380; completed Regular Season 30; sampled 3; stats available 3/3; xG 3/3 (100.00%); shots 3/3 (100.00%); SOT 3/3 (100.00%).
- La Liga 2026: total fixture inventory 380; completed Regular Season 42; sampled 3; stats available 3/3; xG 2/3 (66.67%); shots 3/3 (100.00%); SOT 3/3 (100.00%).
- Serie A 2026: total fixture inventory 380; completed Regular Season 31; sampled 3; stats available 3/3; xG 3/3 (100.00%); shots 3/3 (100.00%); SOT 3/3 (100.00%).
- Bundesliga 2026: total fixture inventory 306; completed Regular Season 19; sampled 3; stats available 3/3; xG 2/3 (66.67%); shots 3/3 (100.00%); SOT 3/3 (100.00%).

Historical 2023/24 + 2024/25: 2,892 Regular Season fixtures in the archives; 24/24 sampled fixtures had both teams' xG, shots and SOT. Current 2026/27: 1,446 fixture records, 122 FT Regular Season fixtures at retrieval; 12 sampled, xG 10/12 and shots/SOT 12/12. Never report 24/24 as 2,892/2,892 or 12/12 as full current-season coverage.

Current missing-xG evidence:

- La Liga, fixture 1570381: kickoff 2026-09-11T19:00:00.000Z, fetched 2026-09-12T06:03:01.873Z; expected_goals absent from both team blocks, while shots/SOT are present. Response SHA256 d9496e7c03bc32d1544727990e41106e689b954c5843a86f2865708a4f2d5a26.
- Bundesliga, fixture 1575164: kickoff 2026-09-11T18:30:00.000Z, fetched 2026-09-12T06:03:21.175Z; expected_goals absent from both team blocks, while shots/SOT are present. Response SHA256 26b28e39bdfab359741d523972c0439a6b16b59e48a4ec9443696b312e381321.

Both fixtures kicked off the previous day, roughly 11–12 hours before collection. Delayed xG publication is a possible explanation, not an established fact; a single observation cannot distinguish delay from permanent absence or a provider correction. No re-fetch/backfill or fabricated xG was used to improve sample coverage.

## Required feature matrix

The companion JSON featureMatrix has all required columns: FEATURE, SOURCE, 2023_24, 2024_25, CURRENT, COVERAGE, TIMESTAMP_MODEL, LEGAL_INTERNAL_USE, LEAKAGE_RISK and READY_FOR_V3. AVAILABLE in seasonal columns means observed/access-computable, never a census claim. All rows have LEGAL_INTERNAL_USE=CONDITIONAL.

- xG: SOURCE=API_FOOTBALL /fixtures/statistics?fixture={fixtureId}; 2023_24=AVAILABLE; 2024_25=AVAILABLE; CURRENT=PARTIAL; READY_FOR_V3=CONDITIONAL_NOT_MANDATORY.
- shots: SOURCE=API_FOOTBALL /fixtures/statistics?fixture={fixtureId}; 2023_24=AVAILABLE; 2024_25=AVAILABLE; CURRENT=AVAILABLE; READY_FOR_V3=CONDITIONAL_ACCESS_READY.
- shotsOnTarget: SOURCE=API_FOOTBALL /fixtures/statistics?fixture={fixtureId}; 2023_24=AVAILABLE; 2024_25=AVAILABLE; CURRENT=AVAILABLE; READY_FOR_V3=CONDITIONAL_ACCESS_READY.
- possession: SOURCE=API_FOOTBALL /fixtures/statistics?fixture={fixtureId}; 2023_24=AVAILABLE; 2024_25=AVAILABLE; CURRENT=AVAILABLE; READY_FOR_V3=TIER_2_SURVEY_ONLY.
- corners: SOURCE=API_FOOTBALL /fixtures/statistics?fixture={fixtureId}; 2023_24=AVAILABLE; 2024_25=AVAILABLE; CURRENT=AVAILABLE; READY_FOR_V3=TIER_2_SURVEY_ONLY.
- bigChances: SOURCE=API_FOOTBALL /fixtures/statistics?fixture={fixtureId}; 2023_24=NOT_AVAILABLE; 2024_25=NOT_AVAILABLE; CURRENT=NOT_AVAILABLE; READY_FOR_V3=NO.
- restDays: SOURCE=YANG_EDGE deterministic derivation from API_FOOTBALL fixture identity/kickoffs and prior FT results (form only); 2023_24=AVAILABLE; 2024_25=AVAILABLE; CURRENT=AVAILABLE; READY_FOR_V3=CONDITIONAL_COMPUTABLE.
- fixtureCongestion: SOURCE=YANG_EDGE deterministic derivation from API_FOOTBALL fixture identity/kickoffs and prior FT results (form only); 2023_24=AVAILABLE; 2024_25=AVAILABLE; CURRENT=AVAILABLE; READY_FOR_V3=CONDITIONAL_COMPUTABLE.
- teamFormIndicators: SOURCE=YANG_EDGE deterministic derivation from API_FOOTBALL fixture identity/kickoffs and prior FT results (form only); 2023_24=AVAILABLE; 2024_25=AVAILABLE; CURRENT=AVAILABLE; READY_FOR_V3=TIER_2_SURVEY_ONLY.

For fixture statistics, COVERAGE is the sample inventory above and historical/full-current coverage is unknown. TIMESTAMP_MODEL is prior-match postgame evidence with actual retrieval time, not historical publication time; LEAKAGE_RISK is high if target or later-revised data enters prediction. For schedule/form rows, coverage is league-only fixtures/results; timestamp risk is post-cutoff schedule revision and omitted competitions. No feature specification is selected.

Tier 2: possession and corners present in all 36 sampled fixtures. Big Chances was not observed in any sampled team block; this is NOT_AVAILABLE in sampled schema, not proof that every possible endpoint lacks it. Team form is derivable from prior FT results, but a latest full-season aggregate would introduce hindsight into an earlier target; no provider form endpoint or formula was adopted. Lineups, injuries and suspensions remain outside this V3 gate.

## Provenance and temporal gate

A future feature record can link fixtureId, leagueId, season, kickoffUtc, homeTeamId and awayTeamId from fixture metadata to each team's exact statistics type/value. Record the actual providerFetchedAt, exact source endpoint and SHA256 of response bytes. The JSON featureRecordProvenanceContract documents that field mapping; it is a provenance inventory, not a model-feature specification.

Target T's own xG/shots/SOT/possession/corners/postgame fields are forbidden inputs. Only earlier completed same-scope fixtures passing a prospectively fixed research availability rule may contribute. Historical statistics fetched now are retrospective final/revised data: original publication time and revision history are UNKNOWN, strictReplayEligible=false. Never replace original observedAt with kickoff or a synthetic past timestamp.

For actual forward research, prior statistics must have been observed non-null at providerFetchedAt <= predictionCreatedAt, with completed-status evidence. A later correction has a new retrieval timestamp and cannot alter a sealed prior input. No Forward implementation was touched. Existing v1/v2 48-hour availability is not proof that xG is published by 48 hours; this mission selects no V3 lag, missing-data rule, rolling window or formula.

REST_DAYS_COMPUTABLE=YES and CONGESTION_COMPUTABLE=YES as arithmetic on schedule identities/kickoffs. However, a league-only predecessor is not necessarily the team's previous match: domestic cups and continental competitions may be missing. Early archive boundaries may have no known predecessor. A later scope decision and all-competition schedule coverage audit are needed before describing these as true team rest/workload. Candidate 7/14-day windows are not chosen or implemented.

## Rights evidence and limits

The owner supplied a summary of API_FOOTBALL_DASHBOARD_CHAT_AI guidance during this mission. It is now preserved in JSON rightsEvidence with its evidence chain. No original dashboard transcript was independently inspected; original chat time is unknown. HUMAN_SUPPORT_CONFIRMATION=NO; FORMAL_WRITTEN_LICENSE=NO.

The owner reports that private internal storage, raw-response retention after subscription, and long-term minimal derived/audit snapshots were permitted by that Chat AI, subject to no redistribution, resale or customer-facing data service. Accordingly:

- INTERNAL_RAW_RETENTION = SUPPORTED_BY_PROVIDER_CHAT_AI_GUIDANCE
- DERIVED_FEATURE_RETENTION = SUPPORTED_BY_PROVIDER_CHAT_AI_GUIDANCE
- POST_SUBSCRIPTION_RETENTION = SUPPORTED_BY_PROVIDER_CHAT_AI_GUIDANCE
- LEGAL_INTERNAL_USE = CONDITIONAL
- PUBLIC_RAW_FEATURE_DISPLAY = UNRESOLVED
- COMMERCIAL_PUBLIC_RIGHTS = UNRESOLVED

Official terms allow building projects, restrict direct data resale and do not confer all league/federation publication or commercial rights. They do not explicitly resolve perpetual raw/derived retention for this use. Operational cache guidance is supporting context, not a permanent license. The Chat AI summary is not elevated to a contract or legal clearance. Public use still needs separate written/provider or rights-holder review. [Official terms](https://www.api-football.com/terms), [cache guidance](https://www.api-football.com/news/post/how-to-save-calls-to-the-api).

## One contingency provider, no switch

Sportmonks was investigated only after two current xG gaps appeared. Its team xG endpoint /v3/football/expected/fixtures, or fixture include=xGFixture, exposes fixture_id, participant_id, type_id and data.value. Fixture statistics document shots-total and shots-on-target. No Sportmonks account or live API was accessed. [Expected endpoint](https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/expected-xg/get-expected-by-team), [statistics types](https://docs.sportmonks.com/v3/definitions/types/statistics/fixture-statistics).

Its xG coverage lists EPL 8, La Liga 564, Serie A 384 and Bundesliga 82. Basic xG is post-match; account entitlement and every-season completeness still need confirmation. Its xG FAQ says availability from the 2024 season onward, so a complete 2023/24 substitute is NOT VERIFIED. Do not silently map this wording to full 2023/24 coverage. [Coverage](https://docs.sportmonks.com/v3/tutorials-and-guides/tutorials/expected/coverage), [xG product](https://www.sportmonks.com/football-api/xg-data/).

Published Starter is EUR29/month for five leagues and 2,000 calls per entity/hour. The xG page displays Basic EUR15/month equivalent when billed yearly; xG entitlement is additional and historical access starts at EUR29 one-time. Exact combined monthly checkout price/package is UNKNOWN; no quote is inferred by mixing billing cycles. [Pricing](https://www.sportmonks.com/football-api/plans-pricing/), [xG pricing](https://www.sportmonks.com/football-api/xg-data/).

Sportmonks terms permit storage of delivered data and restrict resale; app monetization is described as possible in principle. Exact post-termination/derived retention and public-use scope remain review-required. A separate adapter and explicit provider ID crosswalk would be necessary; xG models cannot be assumed interchangeable. Do not patch missing API-Football values with unverified cross-provider values. [Terms](https://www.sportmonks.com/terms-of-service/).

ALTERNATIVE_PROVIDER_REQUIRED=NO for the recommended initial set. Reconsider a provider only if a future requirement makes complete xG mandatory and the primary census/latency evidence cannot support it. No provider is selected as a substitute and no payment occurred.

## Decision and next bounded mission

XG_PRIMARY_AVAILABLE=YES; XG_AVAILABLE=PARTIAL.
SHOTS_AVAILABLE=AVAILABLE_IN_SAMPLES; SOT_AVAILABLE=AVAILABLE_IN_SAMPLES.
API_FOOTBALL_V3_SUITABILITY=CONDITIONAL_INTERNAL_ACCESS.
V3_DATA_GATE=V3_PARTIAL_DATA_READY (choice B only).

V3_RECOMMENDED_INITIAL_FEATURE_SET: prior-completed-match Total Shots, prior-completed-match Shots on Goal, schedule-derived rest candidate and schedule-derived congestion candidate. Treat xG as optional pending coverage/availability review. This is an access recommendation, not a performance claim or a choice of formula, window, imputation or model architecture.

A subsequent separately scoped data mission should: inventory all 2,892 historical regular fixtures for per-team statistics completeness; retain missing/absent/null distinctions; inspect xG publication latency with actual future retrieval timestamps; establish required schedule competition coverage; and review an explicit availability/missingness contract before any V3 fitting. No such census, monitoring job, feature engine or backtest was started here.

H2 remains BEST_DESCRIPTIVE_CANDIDATE=H2, SCREEN_RESULT=SCREEN_NO, MODEL_PROMOTED=NO. It may be a RESEARCH_BACKBONE_CANDIDATE only and is forbidden in Forward.

## Verification and handoff

All 53 calls returned HTTP200 without provider errors. Raw hashes were rechecked for 52 retained responses; /status was sanitized instead of retaining account details. Sample numeric-field checks found no invalid values. League/team identities matched; all historical archive hashes were verified. 633 protected files remained unchanged; before/after SHA256 df994d101bf7b327ee08db318c7d77169edf0bb679f2347315bda2037197cfa2. No model tests/backtests were needed for this docs/inventory-only task.

Cursor can read this document and its sealed JSON, then use the private probe report/source hashes to locate local evidence. Do not upload raw files, re-fetch to conceal missingness, modify prior evidence or start V3 without the next authorized mission. The untracked old access-gate document is untouched.

V3_IMPLEMENTED=NO
V3_BACKTEST_EXECUTED=NO
V2_CHANGED=NO
H2_CHANGED=NO
FORWARD_V1_CHANGED=NO
ODDS_USED=NO
MARKET_USED=NO
MAIN_MERGED=NO

FOOTBALL_V3_FEATURE_DATA_ACCESS_GATE_V1_READY_FOR_CTO_REVIEW

STOP.
