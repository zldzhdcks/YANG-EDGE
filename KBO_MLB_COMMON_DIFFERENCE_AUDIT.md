# KBO ↔ MLB Common / Difference Audit v1

Read-only. Classifies lifecycle and domain items for a future KBO research path. **No Framework / Registry / Builder changes.**

**Method:** same spirit as `DATASET_COMMON_AUDIT.md` / `MULTI_SPORT_RESEARCH_BOUNDARY.md` §5 — extract only after real repetition; this pass records **candidates** before any KBO Dataset artifact exists.

**Official conclusion:** `COMMON_EXTRACTION_CANDIDATES_FOUND` (Framework unchanged)

---

## Labels

| Label | Meaning |
|-------|---------|
| `COMMON_CONFIRMED` | Already enforced identically in MLB research ops and clearly sport-agnostic |
| `COMMON_CANDIDATE` | Should repeat for KBO at process level; not yet proven on a KBO artifact |
| `MLB_ONLY` | MLB Provider / domain vocabulary; do not force onto KBO |
| `KBO_SPECIFIC` | KBO rules / Providers / naming — design separately |
| `UNKNOWN` | Insufficient evidence in repo or ToS |

---

## 1. Lifecycle / research ops

| Item | Class | Notes |
|------|-------|-------|
| Pre-game prediction snapshot freeze | `COMMON_CANDIDATE` | MLB human-gate freeze pattern; no KBO freeze file yet |
| `resultStatus` | `COMMON_CANDIDATE` | Needed; KBO may need extra enum values |
| Automatic grade (immutable prediction fields) | `COMMON_CANDIDATE` | Adapter per league; do not reuse MLB script blindly |
| Success / Failure review | `COMMON_CANDIDATE` | Lifecycle yes; verdict codes may differ |
| `cutoffTime` | `COMMON_CANDIDATE` | Entity as-of; domain-specific meaning |
| `collectionPhase` | `COMMON_CANDIDATE` | pre/post-game phases |
| `legalStatus` / `researchOnly` | `COMMON_CONFIRMED` | Product policy already sport-agnostic |
| `inputHash` / `resultHash` | `COMMON_CONFIRMED` | Reproducibility shells |
| `cacheUsage` | `COMMON_CANDIDATE` | Pattern yes; cache paths must be `kbo/` not `mlb/` |
| `warnings` / `missing` | `COMMON_CONFIRMED` | Viewer availability vocabulary |
| Engine Admission `PROHIBITED` default | `COMMON_CONFIRMED` | Per-league admission later |
| Evidence / Contradiction Ledgers | `COMMON_CANDIDATE` | Containers are sport-neutral; rows MLB today |
| Sample Growth / Completeness / Gate / Quality dashboards | `COMMON_CANDIDATE` | Add KBO rows only after real datasets |
| MLB Stats API cache layout | `MLB_ONLY` | |
| Bullpen role classifier vocabulary | `MLB_ONLY` | Do not copy labels as KBO truth |

---

## 2. Baseball domain datasets

| Dataset | MLB schema reuse | Field names | Builder reuse | Provider join | KBO gaps | Legal | Judgment |
|---------|------------------|-------------|---------------|---------------|----------|-------|----------|
| Starter | Partial template only | Partial | **No** copy-paste | API-BASEBALL: no pitcher endpoint (repo probe) | Probable/confirmed source TBD | TBD | `KBO_SPECIFIC` source; `COMMON_CANDIDATE` freeze pattern |
| Bullpen | Role taxonomy **not** portable | No | No | Appearance logs TBD | Role disclosure differs | TBD | `KBO_SPECIFIC` |
| Lineup | Post-game actual pattern reusable | Partial | No | Boxscore Provider TBD | Announce timing / DH | TBD | `COMMON_CANDIDATE` phase; `KBO_SPECIFIC` join |
| Weather | Forecast snapshot idea | Partial | No | NOAA US-only insufficient | Korea forecast Provider | TBD | `KBO_SPECIFIC` Provider |
| Travel / Rest | Haversine + restDays pattern | High | Logic candidate after venues | Schedule+venue | Korea distances / Mon off days | TBD | `COMMON_CANDIDATE` method |
| Odds History | Opening/latest/move pattern | High | Candidate | Odds API KBO keys | Proto/Betman odds **not** auto-cleared | Odds API review | `COMMON_CANDIDATE` + legal gate |
| Injury | Presence pattern | Partial | No | Not on API-BASEBALL | Roster/IL semantics | TBD | `KBO_SPECIFIC` |
| Schedule Integrity | Identity + FT join | High | New builder | TheSportsDB / API-BASEBALL | Status codes / no-game | Provider ToS | **First Dataset candidate** |

---

## 3. KBO-specific differences (facts / open questions — not Engine variables)

Recorded as **research questions** or known product facts — **not** as EDGE factors:

| Topic | Audit note |
|-------|------------|
| Foreign starter share | Rule/roster caps differ from MLB — measure only after lawful roster feed |
| Rotation structure | Do not assume 5-man MLB rotation |
| Bullpen role publicity | Official closer/setup labels may be weaker than MLB media convention |
| Doubleheader | Identity must not collapse to `kbo-home-away` slug alone |
| Rainout / no-game / suspended | Need Provider status mapping; MLB grade enum incomplete |
| Extra innings / draw | KBO draw possible in some contexts — grade adapter TBD |
| Postseason | Separate slate rules; out of v1 minimal path |
| DH | League uses DH — lineup schema must not assume NL-only rules |
| Lineup announcement timing | UNKNOWN without Provider; do not invent |
| Entry registration / release | Roster transactions — UNKNOWN / FUTURE |
| Travel distances | Korea geography — compute only from licensed venue coords |
| Monday rest pattern | Cultural/schedule pattern — observe from schedule, do not hard-code Engine weight |
| Status codes | Provider-specific; map explicitly |
| Team names KO/EN | Aliases exist in `team-aliases.ts`; Provider strings still need join tests |

---

## 4. What actually repeats vs what only “looks similar”

**Actually repeating (process):** freeze → grade → review → hash → researchOnly → Engine PROHIBITED → sample gates.

**Looks similar because both are baseball:** starter/bullpen/lineup vocabulary — **do not** treat as identical schemas.

**Provider-bound:** MLB Stats API `gamePk`, API-BASEBALL MLB ids, NOAA US weather — **not** KBO defaults.

---

## 5. Abstraction trigger answer

| Question | Answer |
|----------|--------|
| Repeated structure MLB↔KBO today? | Lifecycle + metadata **candidates** only (no KBO Dataset yet) |
| Similar only because baseball? | Starter/Bullpen/Lineup domains |
| Provider-bound? | Yes — Stats API / NOAA / MLB paths |
| Promote to Framework now? | **No** |
| Trigger conclusion | `COMMON_EXTRACTION_CANDIDATES_FOUND` |

---

## 6. Next step

Choose **one** minimal KBO Dataset (recommended: Schedule / Result Identity) after Provider + legal mini-clearance. Then re-run common/difference on **real** artifacts before any Framework field add.
