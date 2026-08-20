# MLB Batter Pregame Live Ops v0

Research sidecar for `mlb-batter-dataset-v0`.

This is not a Prediction Model. Independent Statistical Model sample stays **0**.
Daily Mandatory denominators are unchanged.

## Operator command

```
npm run ops:mlb-batter-pregame -- YYYY-MM-DD
npm run ops:mlb-batter-pregame -- YYYY-MM-DD --dry-run
```

`--force` and `--fetch` are rejected. Live network is allowed only by the fetch gate below. Existing artifacts are write-once.

Dry-run: Provider calls = 0. No write.

## Integration point

Current production MLB Daily Pregame stages stay:

Schedule → Starter → Odds → Lineup → Input Audit → Prediction v0 → Snapshot Verify

Batter Dataset v0 is a **research sidecar after Expected / Confirmed Lineup** and **before** any future independent feature snapshot.

`ops:mlb-daily` / `daily:mlb-pregame-v0` do **not** read this dataset.
Prediction v0 does **not** call the builder or the live runner.

Recommended future research order:

Schedule → Starter → Odds → Expected / Confirmed Lineup → **Batter Dataset v0** → Bullpen → Environment → Future Independent Feature Snapshot → Future Independent Prediction

v0 does not add those later stages.

## Fetch gate policy

**Chosen: POLICY A — `FULL_SLATE_BEFORE_FIRST_PITCH_ONLY`**

| Policy | Behavior | v0 decision |
| --- | --- | --- |
| A Full slate before first pitch | Network hitting fetch only while every slate game is still in the future | **Default. Implemented.** |
| B Per-game cutoff | After game 1 starts, still fetch for unstarted games | **Not implemented in v0** |

Why A is the safer current structure:

- The builder already blocks `allowNetwork` unless `slateFullyPregame`.
- After first pitch, a live season gameLog can contain completed same-day rows. v0 already filters those rows, but a full-slate gate is a second lock so operators cannot accidentally fetch a mixed in-progress slate.
- POLICY B would let west-coast games collect confirmed lineups after east-coast first pitch, but it needs per-game commence checks plus the same as-of filter on every path. That is a later mission, not this one.

Closed gate means: no live Stats API fetch, no new artifact write. Historical completed days stay `NOT_BACKFILLABLE_V0`.

## Lineup readiness

Each team side is one of:

- `CONFIRMED_PRE_GAME` — official PRE_GAME confirmed lineup with playerId
- `EXPECTED_PRE_GAME` — operator expected observation (name + bats; `providerPlayerId` is always null)
- `UNAVAILABLE` — no usable pregame lineup

Rules:

- Official `POST_GAME` confirmed lineups are never stored as pregame CONFIRMED (`POSTGAME_LINEUP_EXCLUDED`).
- Expected is never auto-promoted to CONFIRMED.
- Missing playerId is not filled by name fuzzy matching.

**READY stats require official PRE_GAME confirmed lineup, or another legally allowed stable playerId source.** Expected name+bats cannot produce READY.

## Cache

Reuses `data/cache/research/mlb/raw/statsapi/` from `research-stats-cache`.

- One person fetch + one hitting gameLog fetch per unique playerId per run
- Duplicate batting-order IDs are deduped in memory
- Cache envelope: `pathQuery`, `fetchedAt`, `source=INTERNAL_RESEARCH_ONLY`
- `statsThroughDate` is stored on each batter row, not as a season-to-date dump
- Repeated runs reuse disk cache when present
- No API keys in cache files
- Terminal output is a short summary, not the raw payload

## As-of / leakage

- `statsThroughDate` = day before `min(dateKst, officialDate)`
- Target `gamePk` rows excluded
- Same-day / later gameLog rows excluded
- Current-season aggregate endpoint is not used
- Each slot stores `latestIncludedGameDate`, excluded-row warnings, and `sampleSize.{games,pa,ab}`

## Immutability

Once `data/research/mlb/YYYY-MM-DD-batter-dataset-v0.json` exists, live ops will not overwrite it.

- No `--force` on the live runner
- Pregame capture must not be replaced with postgame season stats
- Identical rebuild with the same `generatedAt` is deterministic (hash match)

If the fetch window is OPEN but no playerId exists yet, live ops **does not write**. That leaves room to freeze a later official PRE_GAME lineup still before first pitch.

## Day status

| Status | Meaning |
| --- | --- |
| `PREGAME_SAFE` | Gate was open at capture, integrity PASS, no postgame-as-confirmed, at least one CONFIRMED_PRE_GAME side with playerId, confirmed-id slots READY or PARTIAL, no cutoff-unsafe rows. **Not** all 270 slots READY. Missing expected/unavailable slots stay visible. |
| `PREGAME_PARTIAL` | Leakage-safe capture, but some confirmed playerId slots are STATS_MISSING / PROVIDER_ERROR / CUTOFF_UNSAFE |
| `NOT_READY` | No schedule, or no CONFIRMED_PRE_GAME playerId (expected name+bats only). Not written. |
| `CUTOFF_CLOSED` | At least one slate game has commenced. No live fetch. No new write. |
| `NOT_BACKFILLABLE_V0` | Completed/historical reconstruction (example: 2026-08-20). Do not relabel as PREGAME_SAFE. |

## Git seal

First real live day, operator may:

1. Run `ops:mlb-batter-pregame -- YYYY-MM-DD` before first pitch
2. Confirm leakage audit + hash in the short summary
3. `git add` the explicit dataset file
4. commit
5. push

This runner does **not** run git. No automatic commit or push.

## Daily Mandatory

Batter Dataset v0 is **not** added to the official Daily Mandatory denominator.

Stage weights stay:

- A_SLATE_SCHEDULE 10
- B_PREGAME_INPUT 20
- C_PREGAME_FREEZE 20
- D_PREGAME_GIT_SEAL 10
- E_RESULT_GRADE 15
- F_REVIEW_SCORECARD 20
- G_DAILY_CLOSE 5

Optional research must not raise or cut that percentage until live reliability is proven.

## Next operating day

1. `npm run ops:mlb-batter-pregame -- YYYY-MM-DD --dry-run`
2. Confirm schedule, first commence, gate OPEN, and playerId availability
3. If playerIds are still 0, wait for official PRE_GAME confirmed lineup; do not fuzzy-match names
4. Before first pitch: `npm run ops:mlb-batter-pregame -- YYYY-MM-DD`
5. Confirm Status / Hash / Leakage in the summary
6. Operator git-seal if the artifact should be frozen remotely
