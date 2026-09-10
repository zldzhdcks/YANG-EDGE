# Four major leagues historical archive V1

This mission expands official API-Football fixtures/results to La Liga (140), Serie A (135) and Bundesliga (78), API seasons 2023 and 2024. EPL's existing 760-match archive is verified and reused. No Poisson model, weight, minimum, availability lag, prediction or backtest code changes are part of this mission. No backtest is executed here; the previously sealed EPL baseline remains unchanged.

The EPL normalizer now accepts league identity and team-count parameters, with its original defaults and output preserved. Existing EPL unit tests and exact archive/audit reconstruction verify compatibility. New league records have the same fields, with the generic `football-league-historical-archive-v1` schema name. Identity is the exact provider fixture ID, never a name or nearest kickoff match. Only valid FT regulation scores become usable rows. Invalid/conflicting records are preserved locally in quarantine.

Counts come from the returned rows. Completeness checks compare the returned unique fixture inventory with every directed home/away pairing: 20 teams for La Liga/Serie A and 18 for Bundesliga. Expected counts are diagnostic denominators only. No missing match is invented, no outcome imputed and no date changed. Each season reports raw rows, canonical/usable counts, duplicates, missing scores/identity, kickoff range and completeness.

## Provider date metadata discrepancy

The first attempt stopped on a Serie A metadata inconsistency: its general 2023 season end was 2024-05-26, but an explicitly season-2023 FT fixture had kickoff 2024-06-02T16:00:00Z. The original failed receipt/raw payload remain local. Fixture-level league/season fields determine membership; the broad metadata window is now an audited discrepancy, not a reason to clip or drop a valid fixture. This is an ingestion metadata check, not a change to any frozen model or backtest temporal rule.

The completed La Liga archive was verified and reused. Partial Serie A responses lacked a completed provenance manifest, so they were not promoted or assigned reconstructed retrieval times: official responses were requested again and actual new `providerFetchedAt` values preserved. The resumed attempt then collected Bundesliga. The aggregate records both the successful attempt's call count and the prior failed attempt; there are no automatic retries or alternate data sources.

## Artifacts and governance

`data/audits/football-four-major-leagues-historical-archive-v1.json` is the aggregate review manifest. It includes all four league audits, seasons, date ranges, local archive paths and exact-byte SHA256 values. Only aggregate audit metadata is committed. Raw payload, normalized matches and quarantine stay under the existing gitignored `data/cache/research/football/historical-archive-v1/` root. The API key is read from the existing environment, never copied into code or artifacts.

Each new league has local `manifest.json`, `archive.json`, `quarantine.json`, league metadata and per-season raw/normalized files. `node scripts/ingest-football-four-leagues-v1.ts --verify <local-league-directory>` verifies file hashes and reconstructs the archive/audit from saved raw responses without network. EPL retains its existing verifier.

The existing same-day official API terms review and internal-local storage scope apply. Permanent retention, post-termination storage and future public/commercial rights remain unresolved as previously documented; this expansion grants no redistribution permission. Raw data is not pushed. `strictReplayEligible=false`, `resultCompletedAt=null` and retrospective historical role remain explicit. No historical observation timestamp is fabricated. No odds or provider prediction endpoints are used.

## Cursor / CTO handoff

Final provider inventory: EPL 760/760 canonical/usable, La Liga 760/760, Serie A 760/760, Bundesliga 616/615; total 2896/2895. EPL, La Liga and Serie A have complete 380-match seasons. Bundesliga returns 308 canonical rows per season: 306 regular-season matches plus 2 Relegation Round matches. Its 2023 season has 307 FT-usable rows and one PEN quarantine; 2024 has 308 FT-usable rows. Both regular-season subsets contain 306 FT rows, but this descriptive audit does not silently select a new evaluation cohort.

**4_MAJOR_LEAGUES_DATA_READY = NO.** Bundesliga remains INCOMPLETE under the homogeneous 18-team round-robin gate because the provider league response mixes stages. This is not a claim of missing provider rows. Ratios above 100% in its original inventory audit are ratios against 306 regular-season fixtures, not a quality score. All source rows remain available locally. `providerStageInventory` records the exact stage/status counts and canonical date ranges, including the quarantined fixture's date. Do not weaken the FT-only rule or delete playoffs merely to obtain an expected count.

Validation: new tests 7/7, existing EPL ingest tests 10/10, scoped strict typecheck and ESLint passed. All four archive hashes and offline rebuilds passed; previous EPL baseline result hash is unchanged. Official API calls total 14 including the interrupted first attempt; stage auditing and verification made zero network calls. `audit-football-four-leagues-stages-v1.ts` deterministically enriches the aggregate from local raw sources without modifying any archive.

Read the aggregate manifest and this document, then verify local archives where authorized access exists. The remote branch contains audit/code only; it is not a backup of the licensed local records. Preserve the local archive directories before deleting a worktree.

STOP after this mission. A new CTO-reviewed mission may independently evaluate the frozen Poisson V1 on each additional league. Do not run those evaluations now, modify V1 using the EPL result, generate betting outputs or merge main.
