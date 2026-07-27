# Postgame ↔ Bullpen Validation Deduplication Audit v1

Read-only audit of `run-mlb-postgame-pipeline.ts` vs `validate-mlb-bullpen-v1_1-date.ts` before 2026-07-28 full-slate processing.

**Machine-readable:** `data/audits/postgame-bullpen-deduplication-audit-v1.json`

**Official conclusion (audit):** `POSTGAME_BULLPEN_DEDUPLICATION_PLAN_READY`

**Implementation status:** `POSTGAME_BULLPEN_DEDUPLICATION_READY` — `--skip-postgame-steps` on `validate-mlb-bullpen-v1_1-date.ts`; npm alias `research:bullpen-validate`; local tsx spawn in research orchestrators.

---

## Executive summary

Both entry points share **four identical sub-steps** when the bullpen validator sees `slate.finished > 0`:

1. `grade-mlb-research-predictions.ts`
2. `review-mlb-failed-game-flow.ts`
3. `review-mlb-success-game-flow.ts`
4. `refresh-site-feedback-learning.ts`

Running `research:postgame` **and then** `validate-mlb-bullpen-v1_1-date.ts` duplicates API work and overwrites the same artifacts twice. Immutable prediction fields stay safe (validate already checks this), but flow-review fetches are **not cache-shared** with grade — the waste is real.

There is **no separate** “Success Review” / “Failure Review” script. Grading emits `{date}-review.json`; only **flow review** scripts exist.

---

## Postgame pipeline steps

`npm run research:postgame -- YYYY-MM-DD` → `scripts/run-mlb-postgame-pipeline.ts`

| # | Step | Script | Primary outputs |
|---|------|--------|-----------------|
| 1 | Grade | `grade-mlb-research-predictions.ts` | `data/predictions/mlb/{date}.json`, `{date}-review.json`, cache `data/cache/mlb-game-results/{date}.json` |
| 2 | Failure flow review | `review-mlb-failed-game-flow.ts` | `{date}-failure-flow-review.json` |
| 3 | Success flow review | `review-mlb-success-game-flow.ts` | `{date}-success-flow-review.json` |
| 4 | Feedback/Learning | `refresh-site-feedback-learning.ts` | `data/predictions/{date}-mlb-review.json`, `data/learning/dashboard.json` |

**Does not run:** bullpen dataset, pregame bullpen risk audit, daily report, starter accumulation, lineup, research ops, `RESEARCH_LOG.md`.

---

## Bullpen validation steps

`tsx --env-file=.env.local scripts/validate-mlb-bullpen-v1_1-date.ts YYYY-MM-DD` (no npm alias)

| # | Step | Condition | Duplicate? |
|---|------|-----------|:----------:|
| 0 | `fetchSlate()` API-BASEBALL status | always | partial† |
| 1–3 | Grade + failure/success flow reviews | `finished > 0` | **yes** |
| 4 | `audit-mlb-pregame-bullpen-risk.ts` | `finished > 0` | no |
| 5 | `build-mlb-bullpen-role-dataset-v1_1.ts` | `finished > 0` | no |
| 6 | Bullpen warm re-run (cache check) | `finished > 0` | no (intentional) |
| 7–8 | H-BP-ROLE-006 survey + H-BP-007 observation | always | no |
| 9 | `bullpen-v1_1-validation-{date}.json` | always | no |
| 10 | `build-mlb-bullpen-v1_1-daily-report.ts` | always | no |
| 11 | `refresh-site-feedback-learning.ts` | `pipelineRan` | **yes** |

† Slate status fetch overlaps grade’s API-BASEBALL date query.

**Gate:** If `slate.finished === 0`, steps 1–6 and 11 are skipped; validation report + daily report still written with `AWAITING` metrics.

---

## Duplicated artifacts (overwrite paths)

| Artifact | Impact |
|----------|--------|
| `data/predictions/mlb/{date}.json` | Result fields refreshed; immutable keys preserved |
| `data/predictions/mlb/{date}-review.json` | Full rewrite |
| `data/predictions/mlb/{date}-failure-flow-review.json` | Full rewrite |
| `data/predictions/mlb/{date}-success-flow-review.json` | Full rewrite |
| `data/predictions/{date}-mlb-review.json` | Mirror rewrite |
| `data/learning/dashboard.json` | Aggregate rewrite |
| `data/cache/mlb-game-results/{date}.json` | May refresh if second grade run is outside 5‑min TTL |

**Unique to bullpen validate:** `{date}-mlb-pregame-bullpen-risk.json`, `{date}-bullpen-role-dataset-v1_1.json`, `bullpen-v1_1-validation-{date}.json`, daily report, H-BP-006/007 observation files.

---

## API / cache duplication vs drift

| Concern | Assessment |
|---------|------------|
| API/time waste | **High** when both pipelines run — ~2× slate fetch + ~2× per-game boxscore work for flow reviews |
| Grade cache | Second grade within 5 min often hits disk cache (`data/cache/mlb-game-results/`) |
| Flow review cache | **None** (`cache: no-store`); always refetches |
| Prediction immutable hash | **Low drift** — validate asserts unchanged slice |
| Review / flow labels | **Low–medium** — stable if API payloads unchanged |
| Bullpen classifier hash | **Low** — frozen v1.1 + warm re-run check inside validate |

**Verdict:** Duplication is primarily **API/time cost**, not prediction-contract drift.

---

## Canonical responsibility (proposed)

| Entry | Should own |
|-------|------------|
| **`research:postgame`** | Game-result lifecycle for site: grade → flow reviews → Feedback/Learning |
| **`validate-mlb-bullpen-v1_1-date.ts`** | Bullpen-only validation: pregame risk audit → bullpen dataset → validation report → daily report → H-BP observations |
| **`research:starter`** | Starter dataset + post-game starter review (neither pipeline above) |
| **`research:lineup`** | Lineup dataset (full slate guard) |
| **`research:ops`** | Correlation → contradiction → dashboard → starter summary |

**Structure mismatch today:** validate embeds the full postgame chain as prerequisites.

---

## Three dedupe alternatives (not implemented)

| # | Approach | Pros | Cons |
|---|----------|------|------|
| **1** | Postgame first; validate with `--skip-postgame-steps` | Smallest change (validate only); keeps separate entrypoints | Needs flag / detection |
| **2** | Postgame calls bullpen tail | Single command | Blurs site vs research scope; larger postgame change |
| **3** | Freshness skip if review artifacts + immutable hash current | Handles accidental re-runs | Partial-slate freshness rules needed |

**Recommended minimal fix:** **Alternative 1** — **implemented** as `--skip-postgame-steps` + postgame artifact guard on `validate-mlb-bullpen-v1_1-date.ts`.

---

## 2026-07-28 execution guidance

### Full slate (all games Final)

**Until dedupe ships — do not run both pipelines back-to-back.**

| Operator intent | Single command |
|-----------------|----------------|
| Bullpen validation + site refresh | `validate-mlb-bullpen-v1_1-date.ts 2026-07-28` alone (superset) |
| Site refresh only (no bullpen validation artifacts) | `npm run research:postgame -- 2026-07-28` |

**Target order after dedupe (AC-03):**

```
npm run research:postgame -- 2026-07-28
npm run research:starter -- 2026-07-28
npm run research:bullpen-validate -- 2026-07-28 --skip-postgame-steps
npm run research:lineup -- 2026-07-28
npm run research:ops -- 2026-07-28
```

### Partial slate (some games still pending)

| Script | Behavior |
|--------|----------|
| `research:postgame` | Runs all steps; grade marks unfinished as `pending` |
| `validate-mlb-bullpen-v1_1-date.ts` | `finished === 0` → skip grade/bullpen/refresh; `finished > 0` → runs embedded postgame+bullpen on available targets |
| `research:lineup` | **Blocked** until all predictions `graded` (full slate guard) |

---

## `refresh:feedback-learning` tsx status

| Field | Value |
|-------|-------|
| Alias | `refresh:feedback-learning` |
| Command | `tsx --env-file=.env.local ...` |
| Local pinned tsx | **Yes** (aligned with `research:*`) |

---

## Regression

| Check | Result |
|-------|--------|
| Code changes | 0 |
| Dataset artifacts | 0 |
| Prediction hash (2026-07-27) | `621f4dbc2ad7439804f88ba213452e5e2675396e889a26580f79b11ad9e58051` |
| Engine / Framework | 0 |
| Build | Pass |

---

## Related docs

- [RESEARCH_PIPELINE_AUTOMATION_AUDIT_V1.md](./RESEARCH_PIPELINE_AUTOMATION_AUDIT_V1.md) — order issue #1 (overlap already noted)
- [data/audits/postgame-bullpen-deduplication-audit-v1.json](./data/audits/postgame-bullpen-deduplication-audit-v1.json)
