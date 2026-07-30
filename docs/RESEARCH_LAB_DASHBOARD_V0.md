# YANG EDGE Research Lab Dashboard v0

## Overview

Internal read-only dashboard at `/internal/research` for monitoring YANG EDGE research pipeline status.

## Route

```
/internal/research
/internal/research?date=2026-07-29
```

Default date: KST today. Invalid dates fallback to KST today.

## Key Properties

- **Read-only**: No data modification, no pipeline execution buttons
- **No authentication**: v0 has no login. `LOCAL / INTERNAL USE ONLY` warning displayed.
- **No public navigation**: Not linked from Header or any public page
- **No search engine indexing**: `robots: { index: false, follow: false }`
- **Artifact-based**: All data sourced from existing JSON artifacts in `data/`

## Sections

1. **Header** — YANG EDGE RESEARCH LAB / Internal Research Console
2. **Date Summary** — KST date with query param support
3. **Today's Research** — Summary cards (total, graded, hits, misses, accuracy, etc.)
4. **Pipeline Status** — Per-pipeline status cards (Schedule, Starter, Bullpen, Odds, Weather, Travel, Prediction, Result, Grade, Review)
5. **Today's Tasks** — Auto-generated from artifact state (pending results, missing starters, review pending, value edge unverified)
6. **Missed Items** — Table of detected issues with severity, count, reason
7. **Starter Dataset Health** — Dedicated card with expected/collected/missing rows and warning codes
8. **Review Queue Summary** — Total/pending/completed/hit/miss counts + top 5 candidates by confidence (Temporary Sort, not research priority)
9. **Recommended Commands** — Copy-only commands from existing `package.json` scripts
10. **Source Artifact Information** — Table of all artifact files with OK/FILE_NOT_FOUND status

## Status Values

- Pipeline: `COMPLETE | PARTIAL | WARNING | PENDING | NOT_AVAILABLE | FILE_NOT_FOUND`
- Task priority: `CRITICAL | HIGH | NORMAL | LOW`
- Starter warnings: `STARTER_ARTIFACT_NOT_FOUND | STARTER_DATASET_EMPTY | PROBABLE_STARTER_MISSING | STARTER_JOIN_FAILED | STARTER_ARTIFACT_STALE | STARTER_STATUS_UNKNOWN`

## Constraints

- `NOT_AVAILABLE` and `0` are distinct — never substituted
- No hardcoded numbers
- No task state persistence (no localStorage, no server storage)
- No execution buttons
- No API keys, env vars, raw provider responses, or PII displayed
- Starter missing cause is not assumed — only counts are shown

## Source Files

- `src/app/internal/research/page.tsx`
- `src/lib/internal/research-lab-reader.ts`

## Superseded By

v1 Operator Home adds an operator-friendly view while preserving v0 as the "시스템 상세" tab. See `docs/RESEARCH_LAB_OPERATOR_HOME_V1.md`.

## Future Phases

- Task state persistence
- Review prioritization scoring
- Pipeline execution buttons
- Real authentication
- Scheduler status monitoring
- Multi-sport support (KBO, Soccer)
- Historical date comparison
