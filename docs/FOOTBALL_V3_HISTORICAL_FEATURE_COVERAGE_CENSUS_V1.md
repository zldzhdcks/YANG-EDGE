# FOOTBALL V3 HISTORICAL FEATURE COVERAGE CENSUS V1

COVERAGE CENSUS ONLY. All 2,892 frozen historical fixtures were queried once at the official fixture-statistics endpoint. No model, backtest, feature formula, availability lag or missingness treatment was selected or executed.

## Provenance

BASE_SHA = c549fed2c1dd6c329c640853df835f168d108e5e
BRANCH = agent/astra/football-historical-source-gate-v1
Started = 2026-09-12T06:18:23.453Z
Completed = 2026-09-12T06:30:54.057Z
Audit canonical-payload SHA256 = 0f215fba91a68cdd0a4a53b5124a311f193821baddd2ff1764d8942cb8718c41
Frozen cohort IDs SHA256 = ad5cfb6fb08d9ce790596d5cd1c74dad1106c80e903769e66b4ee9c044813d14
Local full audit SHA256 = 7d7de9c17c2b74ee6e881405b47a6a4218d116b8404993b74aae765b7872d732
Probe source SHA256 = f2c894af67704d5bcd79a82f9ab2348b8e7fbe82acd7acf4bf610bda3390dab3

The cohort is the existing hash-verified API-Football Regular Season FT archive population, seasons 2023 and 2024, independently checked against the frozen parent ID hashes. No fixture additions, deletions, fuzzy joins or inferred identities. Existing Bundesliga playoff exclusions are inherited, not newly selected. Raw responses remain outside Git at C:/Users/TCTCTC/YANG-EDGE/YANG-EDGE-INBOX/football-v3-historical-feature-census-v1/2026-09-12T06-18-23-453Z. The existing untracked access-gate document is preserved.

## Classification and denominators

The census plan and synthetic checks preceded API requests. Each feature records both exact team IDs and VALUE, NULL, ABSENT, BLOCK_UNAVAILABLE, or schema-error state; values themselves are not in committed metadata. Numeric zero is present, never treated as null.

General fixture states are COMPLETE_BOTH_TEAMS, PARTIAL_ONE_TEAM, MISSING_BOTH, STATISTICS_UNAVAILABLE and API_ERROR. Empty statistics are unavailable; one valid team is partial. Invalid identities/duplicates/values fail closed into API_ERROR with a distinct error kind rather than being silently repaired. STATISTICS_AVAILABLE_FIXTURES counts a valid non-empty statistics response for at least one expected team.

Special exclusive classes are COMPLETE (two values), PARTIAL (one), NULL (zero values and at least one explicit null), MISSING (zero values and no explicit null, including unavailable statistics), and ERROR. Thus a valid/null pair is PARTIAL and also has an any-null flag; an absent/null pair is NULL and retains both flags. No value is imputed. General MISSING includes NULL and unavailable cases; the special MISSING count excludes the separately reported NULL. These are audit labels, not a future model missingness policy.

COVERAGE_PERCENT = COMPLETE_BOTH_TEAMS / all fixtures in the cell × 100. No record is removed from the denominator. This is actual census coverage at these retrieval times, not a sample rate or a strict replay claim.

## League × season × feature census

- EPL 2023 xG: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- EPL 2023 shots: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- EPL 2023 sot: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- EPL 2024 xG: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- EPL 2024 shots: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- EPL 2024 sot: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- La Liga 2023 xG: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- La Liga 2023 shots: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- La Liga 2023 sot: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- La Liga 2024 xG: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- La Liga 2024 shots: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- La Liga 2024 sot: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- Serie A 2023 xG: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- Serie A 2023 shots: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- Serie A 2023 sot: TOTAL=380; STATS_AVAILABLE=380; COMPLETE=380; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- Serie A 2024 xG: TOTAL=380; STATS_AVAILABLE=379; COMPLETE=379; PARTIAL=0; MISSING_GENERAL=1; UNAVAILABLE=1; API_ERROR=0; COVERAGE=99.736842%. Special MISSING=1, NULL=0.
- Serie A 2024 shots: TOTAL=380; STATS_AVAILABLE=379; COMPLETE=379; PARTIAL=0; MISSING_GENERAL=1; UNAVAILABLE=1; API_ERROR=0; COVERAGE=99.736842%. Special MISSING=1, NULL=0.
- Serie A 2024 sot: TOTAL=380; STATS_AVAILABLE=379; COMPLETE=379; PARTIAL=0; MISSING_GENERAL=1; UNAVAILABLE=1; API_ERROR=0; COVERAGE=99.736842%. Special MISSING=1, NULL=0.
- Bundesliga 2023 xG: TOTAL=306; STATS_AVAILABLE=306; COMPLETE=306; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- Bundesliga 2023 shots: TOTAL=306; STATS_AVAILABLE=306; COMPLETE=306; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- Bundesliga 2023 sot: TOTAL=306; STATS_AVAILABLE=306; COMPLETE=306; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- Bundesliga 2024 xG: TOTAL=306; STATS_AVAILABLE=306; COMPLETE=306; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- Bundesliga 2024 shots: TOTAL=306; STATS_AVAILABLE=306; COMPLETE=306; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.
- Bundesliga 2024 sot: TOTAL=306; STATS_AVAILABLE=306; COMPLETE=306; PARTIAL=0; MISSING_GENERAL=0; UNAVAILABLE=0; API_ERROR=0; COVERAGE=100.000000%. Special MISSING=0, NULL=0.

## Overall and readiness

- xG: COMPLETE=2891; PARTIAL=0; MISSING=1; NULL=0; ERROR=0; COVERAGE=99.965422%; READINESS=READY_WITH_MISSINGNESS_PROTOCOL. Any-null fixtures=0; any-absent fixtures=0.
- shots: COMPLETE=2891; PARTIAL=0; MISSING=1; NULL=0; ERROR=0; COVERAGE=99.965422%; READINESS=READY_WITH_MISSINGNESS_PROTOCOL. Any-null fixtures=0; any-absent fixtures=0.
- sot: COMPLETE=2891; PARTIAL=0; MISSING=1; NULL=0; ERROR=0; COVERAGE=99.965422%; READINESS=READY_WITH_MISSINGNESS_PROTOCOL. Any-null fixtures=0; any-absent fixtures=0.

Shots AND SOT complete: 2891/2892. All three complete: 2891/2892. A one-feature success never substitutes for joint completeness.

The shared missing fixture is 1223728 (Serie A, season 2024, kickoff 2025-02-06T19:45:00.000Z). HTTP 200 returned no statistics team blocks: STATISTICS_UNAVAILABLE for all three features. It remains in the denominator and is not imputed or replaced. Serie A 2024 coverage is 379/380 (99.736842%); every other league-season cell is complete.

READY_AS_PRIMARY means complete historical coverage only, subject to unchanged conditional internal rights and a future temporal protocol. READY_WITH_MISSINGNESS_PROTOCOL means incomplete data requires a separately specified treatment before use. NOT_READY means no complete cases or unresolved errors. No handling method or mandatory model input is selected here.

## Missing fixture lists and hashes

The committed audit includes exact fixture IDs and hashes for non-complete, missing-only, null-only, partial and API-error lists for each feature. IDs remain in frozen league/season/kickoff/ID census order; hashes are SHA256 of compact JSON numeric-ID arrays. Empty lists are retained.

- xG nonComplete: count=1; SHA256=3900c1f995121f36992518a72f155c03f917aab645ffe5db0644afab5ba58cc5.
- xG missing: count=1; SHA256=3900c1f995121f36992518a72f155c03f917aab645ffe5db0644afab5ba58cc5.
- xG null: count=0; SHA256=4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945.
- xG partial: count=0; SHA256=4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945.
- xG apiError: count=0; SHA256=4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945.
- shots nonComplete: count=1; SHA256=3900c1f995121f36992518a72f155c03f917aab645ffe5db0644afab5ba58cc5.
- shots missing: count=1; SHA256=3900c1f995121f36992518a72f155c03f917aab645ffe5db0644afab5ba58cc5.
- shots null: count=0; SHA256=4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945.
- shots partial: count=0; SHA256=4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945.
- shots apiError: count=0; SHA256=4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945.
- sot nonComplete: count=1; SHA256=3900c1f995121f36992518a72f155c03f917aab645ffe5db0644afab5ba58cc5.
- sot missing: count=1; SHA256=3900c1f995121f36992518a72f155c03f917aab645ffe5db0644afab5ba58cc5.
- sot null: count=0; SHA256=4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945.
- sot partial: count=0; SHA256=4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945.
- sot apiError: count=0; SHA256=4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945.

## Two current-season xG rechecks

- Fixture 1570381, La Liga: STILL_MISSING. Previous observation 2026-09-12T06:03:01.873Z, SHA256 d9496e7c03bc32d1544727990e41106e689b954c5843a86f2865708a4f2d5a26; new observation 2026-09-12T06:30:52.971Z, SHA256 d9496e7c03bc32d1544727990e41106e689b954c5843a86f2865708a4f2d5a26. Team states: 536:ABSENT, 532:ABSENT.
- Fixture 1575164, Bundesliga: STILL_MISSING. Previous observation 2026-09-12T06:03:21.175Z, SHA256 26b28e39bdfab359741d523972c0439a6b16b59e48a4ec9443696b312e381321; new observation 2026-09-12T06:30:53.354Z, SHA256 26b28e39bdfab359741d523972c0439a6b16b59e48a4ec9443696b312e381321. Team states: 182:ABSENT, 174:ABSENT.

Each was re-queried exactly once; original evidence was not overwritten. NOW_AVAILABLE means the field became observable between observations, not an exact publication timestamp. STILL_MISSING means absent at this second observation, not proof of permanent absence. These two cases establish neither overall current-season coverage nor a general availability lag.

## Temporal and rights limits

Current retrieval of historical statistics is retrospective final/revised evidence, not original pregame or strict-replay data. Target T own statistics are forbidden. Only previous completed fixtures may be used under a future availability contract; no lag is chosen in this census. No timestamp is backdated.

LEGAL_INTERNAL_USE=CONDITIONAL. Raw responses are local only. The previous gate retains the user-reported provider Chat AI guidance for raw/derived/post-subscription storage; HUMAN_SUPPORT_CONFIRMATION=NO and FORMAL_WRITTEN_LICENSE=NO. PUBLIC_RAW_FEATURE_DISPLAY and commercial/public rights remain UNRESOLVED. No stronger license finding is made.

## Validation and Cursor handoff

2895 requests total (status + 2892 historical + 2 current), max 240/minute and 4 concurrent. No automatic retries, billing changes or alternative providers. Classifier synthetic tests 10/10; frozen ID count/order and all aggregation partitions checked. 2894 raw response SHA256 values rechecked. 635 protected files unchanged, including V2, Forward, historical archives and prior gate; before/after digest 66d4082e8f489ad8cb6ca1c70a3b84eee3ce598abf77eb355b5337b122e4bfff.

Raw responses, receipts, plan, historical records and current rechecks remain in the local run directory. Local helper source is in its parent directory: census.mjs and summarize.cjs. The census has completed; do not rerun collection or duplicate API calls when resuming. The committed JSON contains only fixture metadata, presence/null states, hashes and retrieval timestamps, not raw statistics values. Do not upload raw responses. Next work is CTO review and a separately authorized V3 feature/availability protocol; no automatic modeling or imputation follows from readiness. Preserve all prior artifacts and the untracked access-gate document; no main merge.

V3_IMPLEMENTED=NO
V3_BACKTEST_EXECUTED=NO
FEATURE_FORMULA_SELECTED=NO
MISSINGNESS_RULE_SELECTED=NO
V2_CHANGED=NO
FORWARD_V1_CHANGED=NO

FOOTBALL_V3_HISTORICAL_FEATURE_COVERAGE_CENSUS_V1_READY_FOR_CTO_REVIEW

STOP.
