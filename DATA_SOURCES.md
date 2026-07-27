# Data Sources

## Priority order (research sourcing)

1. API-BASEBALL (commercial subscription in use)
2. The Odds API
3. SportsDataIO (non-scrambled only; Scrambled permanently prohibited)
4. MLB Stats API
5. Other sources (case-by-case legal review)

## MLB Stats API

```text
INTERNAL_RESEARCH_ONLY
NO_PUBLIC_RUNTIME_CONNECTION
NO_COMMERCIAL_RUNTIME_CONNECTION
COMMERCIAL_USE_NOT_CONFIRMED
```

Allowed:

- Internal research scripts under `scripts/`
- Research disk cache under `data/cache/research/mlb/`
- Derived bullpen features for audits and datasets under `data/research/` and `data/audits/`
- Derived starter dataset features under `data/research/mlb/*-starter-dataset-v1.json` and `data/cache/research/mlb/derived/starter/` (INTERNAL_RESEARCH_ONLY)
- Derived lineup dataset features under `data/research/mlb/*-lineup-dataset-v1.json` (INTERNAL_RESEARCH_ONLY; post-game actual starting lineups; Engine PROHIBITED)

Prohibited:

- Import into public Next.js runtime / API routes serving customers
- Commercial product features that depend on Stats API payloads
- MLB.com HTML crawling
- SportsDataIO Scrambled data

Research cache must not store API keys. Prefer derived fields; raw cache is research-only and must remain offline from public runtime.
