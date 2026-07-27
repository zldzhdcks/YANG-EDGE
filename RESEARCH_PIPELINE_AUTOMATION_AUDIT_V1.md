# Research Pipeline Automation Audit v1

**Date:** 2026-07-27  
**Scope:** Identify manual steps, classify automation candidates, verify pipeline order. No implementation.

**Forbidden:** Engine / Dataset / Framework / Hypothesis changes · new auto-execution · scheduler.

---

## Summary

| Category | Count |
|----------|-------|
| Manual steps identified | 15 |
| Automation candidates | 6 |
| Intentionally manual | 8 |
| Pipeline order issues | 4 (documented) |

**Official conclusion:** `PIPELINE_AUTOMATION_AUDIT_COMPLETED`

---

## Implementation Status (v1)

| Item | Status |
|------|--------|
| AC-01 npm script aliases | **implemented** (local pinned `tsx` via devDependency) |
| AC-02 `run-mlb-research-ops-pipeline-v1.ts` | **implemented** |
| AC-05 starter summary tail (`research:starter`) | **implemented** |
| Lineup Final / full-slate guard | **implemented** |
| AC-03 extend postgame with flags | **partial** — `--skip-postgame-steps` on bullpen validate (not postgame flags) |
| AC-04 pre-game orchestrator | deferred |
| AC-06 feedback refresh documentation | deferred (already in postgame pipeline) |

### npm aliases

```
research:starter          → accumulation + summary
research:bullpen          → build-mlb-bullpen-role-dataset-v1_1.ts
research:lineup           → build-mlb-lineup-dataset-v1.ts (full slate guard)
research:postgame         → run-mlb-postgame-pipeline.ts
research:ops              → run-mlb-research-ops-pipeline-v1.ts
research:dashboard        → build-dataset-coverage-dashboard-v1.ts
research:starter-summary  → summarize-mlb-starter-accumulation-v1.ts
```

Date forwarding: `npm run research:ops -- YYYY-MM-DD`

Execution: `research:*` aliases invoke the project-local `tsx` binary (`devDependency`, lockfile-pinned) — no `npx` fetch on first run.

**Official conclusion (implementation):** `RESEARCH_PIPELINE_AUTOMATION_V1_READY`

---

## Manual Steps (current)

All `research:*` npm aliases use lockfile-pinned local `tsx` (`npm run research:<name> -- YYYY-MM-DD`). Scripts not yet aliased still require manual `tsx --env-file=.env.local scripts/...`.

### Pre-game (per slate date)

| # | Step | Command | Orchestrated? |
|---|------|---------|---------------|
| 1 | Daily baseline | `build-mlb-daily-baseline.ts` | Yes (7 sub-steps) |
| 2 | Prediction snapshot freeze | `save-mlb-research-prediction-snapshot.ts` | No — **human gate** |
| 3 | Starter accumulation | `run-mlb-starter-accumulation-v1.ts [date]` | Yes |
| 4 | Bullpen dataset v1.1 | `build-mlb-bullpen-role-dataset-v1_1.ts [date]` | No |

### Post-game (after Final)

| # | Step | Command | Orchestrated? |
|---|------|---------|---------------|
| 5 | Postgame pipeline | `run-mlb-postgame-pipeline.ts [date]` | Yes (grade → reviews → feedback/learning) |
| 6 | Bullpen validate | `validate-mlb-bullpen-v1_1-date.ts [date]` | Yes — use `--skip-postgame-steps` after postgame |
| 7 | Lineup dataset | `build-mlb-lineup-dataset-v1.ts [date]` | No |

### Research ops (periodic)

| # | Step | Command |
|---|------|---------|
| 8 | Dataset correlation audit | `audit-dataset-correlation-v1.ts [date]` |
| 9 | Contradiction ledger | `build-contradiction-ledger-v1.ts` |
| 10 | Contradiction severity | `build-contradiction-severity-audit-v1.ts` |
| 11 | Coverage dashboard | `build-dataset-coverage-dashboard-v1.ts` |
| 12 | Starter accumulation summary | `summarize-mlb-starter-accumulation-v1.ts` |
| 13 | Bullpen accumulation validate | `validate-mlb-bullpen-v1_1-accumulation.ts` |

### Documentation / deploy

| # | Step | Command |
|---|------|---------|
| 14 | Research log entry | Manual `RESEARCH_LOG.md` one-liner |
| 15 | Site build | `npm run build` |

### package.json scripts (reference)

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "refresh:feedback-learning": "tsx --env-file=.env.local scripts/refresh-site-feedback-learning.ts"
}
```

Only `refresh:feedback-learning` wraps a research script. All other pipeline steps are manual CLI invocations.

---

## Automation Candidates

| ID | Proposal | Steps | Risk |
|----|----------|-------|------|
| AC-01 | npm script aliases | starter, postgame, bullpen, lineup, dashboard | Low |
| AC-02 | `run-mlb-research-ops-pipeline.ts` | correlation → ledger → severity → dashboard | Low |
| AC-03 | Extend postgame with optional flags | starter postgame, bullpen validate, lineup | Medium |
| AC-04 | Pre-game orchestrator (post-snapshot) | starter pre-game + bullpen v1.1 | Medium |
| AC-05 | Auto-run accumulation summary | after each starter accumulation | Low |
| AC-06 | Document feedback refresh as canonical postgame tail | already in `run-mlb-postgame-pipeline` | Low |

**Not proposed (out of scope):** cron, webhooks, Engine wiring, Framework registry changes, hypothesis promotion.

---

## Intentionally Manual

| ID | Step | Reason |
|----|------|--------|
| IM-01 | Prediction snapshot freeze | Immutable contract; human gate |
| IM-02 | Hypothesis status promotion | Evidence threshold + research decision |
| IM-03 | Classifier / Engine / weights | Affects immutable prediction fields |
| IM-04 | Scheduler / cron | Forbidden in audit scope |
| IM-05 | PROJECT_MEMORY.md | User rule |
| IM-06 | Purchase / betting decisions | Human judgment |
| IM-07 | Framework registry (e.g. lineup) | Framework structure change forbidden |
| IM-08 | RESEARCH_LOG narrative | Human audit trail |

---

## Pipeline Order (verified)

### Canonical pre-game

```
build-mlb-daily-baseline.ts
  → save-mlb-research-prediction-snapshot.ts (human gate)
  → run-mlb-starter-accumulation-v1.ts (pre-game)
  → build-mlb-bullpen-role-dataset-v1_1.ts
```

### Canonical post-game

```
run-mlb-postgame-pipeline.ts
  → run-mlb-starter-accumulation-v1.ts (post-game review)
  → validate-mlb-bullpen-v1_1-date.ts --skip-postgame-steps
  → build-mlb-lineup-dataset-v1.ts
```

`research:bullpen-validate` npm alias added. Superset (no flag) still runs grade + reviews + bullpen + refresh for standalone use.

### Canonical research ops

```
audit-dataset-correlation-v1.ts
  → build-contradiction-ledger-v1.ts
  → build-contradiction-severity-audit-v1.ts
  → build-dataset-coverage-dashboard-v1.ts
  → summarize-mlb-starter-accumulation-v1.ts (periodic)
```

### Order issues

1. **bullpen-validate duplicates postgame grade+review** — **mitigated:** `--skip-postgame-steps` + `research:bullpen-validate` alias.
2. **lineup-dataset has no postgame guard** — operator must wait for Final; builder fails gracefully otherwise.
3. **research-ops unchained** — AC-02 would enforce order.
4. **14+ scripts absent from package.json** — AC-01 aliases reduce operator error.

---

## Regression

| Check | Result |
|-------|--------|
| Prediction hash (2026-07-27) | `621f4dbc2ad7439804f88ba213452e5e2675396e889a26580f79b11ad9e58051` — unchanged |
| Dataset changes | 0 |
| Engine impact | 0 |
| Build | See completion report |

---

## Generated Files

- `data/audits/research-pipeline-automation-audit-v1.json`
- `RESEARCH_PIPELINE_AUTOMATION_AUDIT_V1.md` (this file)

---

## Official Conclusion

`PIPELINE_AUTOMATION_AUDIT_COMPLETED`
