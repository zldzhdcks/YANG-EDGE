# KBO Research Pipeline v1 — Pre-design

Read-only design note. **No Builder / Dataset / Prediction / Viewer / Engine / Registry implementation in this pass.**

**Related:** [KBO_MLB_COMMON_DIFFERENCE_AUDIT.md](./KBO_MLB_COMMON_DIFFERENCE_AUDIT.md) · [MULTI_SPORT_RESEARCH_BOUNDARY.md](./MULTI_SPORT_RESEARCH_BOUNDARY.md) · [DATA_SOURCES.md](./DATA_SOURCES.md) · audits under `data/audits/kbo-*`

**Official conclusion:** `READY_FOR_KBO_MINIMAL_RESEARCH_DATASET` (next mission selects **one** minimal Dataset only)

---

## 1. Current KBO status in the repo (code facts)

| Surface | Status |
|---------|--------|
| Schedule Provider | **Partial** — TheSportsDB `eventsday` for league id `4830` (`TheSportsDbProvider`) → `GameData[]` |
| Odds mapping | **Partial** — Odds API sport-key resolver includes `KBO`; match tolerance tests exist |
| Team display aliases | **Present** — `src/lib/teams/team-aliases.ts` KBO Korean/English names |
| Internal gameId (schedule path) | Slug style via `buildGameId` → `kbo-{home}-{away}` (TheSportsDB path) |
| Dummy Engine / home samples | **Dummy only** — `kbo-lg-doosan`, etc. in `dummyAnalysisData` / constants |
| Research Prediction snapshot | **None** under `data/predictions/kbo/` (MLB-only research freeze) |
| Research Datasets (Starter/Bullpen/…) | **None** — all under `data/research/mlb/` |
| Research Viewer | **MLB paths only** — `load-research-analysis-view.ts` |
| Grade / Success / Failure review | **MLB scripts only** |
| Registry | **No `kbo-*` Dataset IDs** (correct — do not register until Provider + legal clearance) |

**Boundary:** Betman (배트맨) defines **which games may enter scope**; it is **not** a sports data Provider. No Betman HTML crawl / login automation. Multi-sport Daily Slate operator input: [BETMAN_DAILY_FULL_SLATE_COVERAGE_V1.md](./BETMAN_DAILY_FULL_SLATE_COVERAGE_V1.md).

---

## 2. Schedule vs Betman scope

| Concern | Rule |
|---------|------|
| Analysis candidate set | Games **scheduled on Betman** (operator-confirmed or other lawful path) |
| Schedule / results / stats bytes | Lawful Providers only (TheSportsDB, API-BASEBALL, Odds API, SportsDataIO non-scrambled after clearance, …) |
| Matching | Provider calendar ↔ Betman slate are **separate lists**; join by team+start window after mapping — never use Betman HTML as source of truth |

---

## 3. Provider candidates (not selected)

See audit JSON for field-level matrix. Summary:

| Provider | Schedule | Results | Starter / Lineup / Bullpen / Injury | Odds | Legal label (this audit) |
|----------|:--------:|:-------:|:-----------------------------------:|:----:|--------------------------|
| TheSportsDB | Yes (≤3/league free) | Limited past/next | No research-grade | No | `NEEDS_LEGAL_REVIEW` / plan limits |
| API-BASEBALL (API-Sports) | Yes (KBO league discoverable) | Games FT etc. | **No** players/injuries/lineups endpoints (repo probe) | Odds endpoint exists (plan-dependent) | `NEEDS_LEGAL_REVIEW` · research candidate |
| SportsDataIO | Candidate | Candidate | Candidate if non-scrambled | — | `COMMERCIAL_LICENSE_REQUIRED` · Scrambled **BLOCKED** |
| Official KBO / partners | Unknown without contract | Unknown | Unknown | — | `NEEDS_LEGAL_REVIEW` — **no HTML crawl alternative** |
| The Odds API | No | No | No | KBO keys in resolver | `PER_USE_LEGAL_REVIEW_REQUIRED` |
| Betman site | Scope only | — | — | — | **BLOCKED** as data Provider |

**Do not force a Provider pick in this mission.**

---

## 4. Game ID strategy (proposal only — no code change)

| Id | Role |
|----|------|
| **Internal `gameId`** | YANG EDGE canonical key in artifacts |
| **Provider `externalId`** | API-BASEBALL / TheSportsDB event id |
| **Betman round fixture id** | Scope / purchase context only — **never** primary `gameId` |

**Recommendation (document only):** prefer **`kbo-{providerGameId}`** when a stable numeric/string Provider id exists (parallel to MLB `mlb-{externalId}`).

Avoid using slug-only `kbo-{home}-{away}` as the **research primary** key (doubleheaders / postponed rematches collide). Slug ids may remain for legacy Dummy / TheSportsDB UI until a research freeze path exists.

Alternate `baseball-kbo-{providerGameId}` is unnecessary if league prefix `kbo-` is already unique in the product.

---

## 5. Prediction snapshot feasibility (pre-freeze)

| Field | Feasibility |
|-------|-------------|
| `homeTeam` / `awayTeam` / `league` / `startTimeKst` | **Collectible** from schedule Providers (after mapping) |
| `probable starter` | **NOT_COLLECTED** via API-BASEBALL (no endpoint in repo probe); **Prediction BLOCKED** — see [KBO_STARTER_DATA_SOURCE_READINESS_AUDIT_V1.md](./KBO_STARTER_DATA_SOURCE_READINESS_AUDIT_V1.md) |
| `market odds` | **Candidate** via The Odds API (legal per-use) — not auto-assumed complete |
| `baselinePick` / `modelProbability` / `confidence` / `edgeScore` / `valueEdge` | Require analysis pipeline + legal inputs — **FUTURE_GATED**; Dummy values **forbidden** for research freeze |

---

## 6. Grading compatibility (schema change forbidden here)

MLB research grade statuses today: `pending` | `graded` | `inconclusive` | `postponed` | `cancelled`. Draw maps toward inconclusive / non-hit paths.

KBO-specific outcomes to **document for a future grade adapter** (no code now):

- Regulation draw (무승부)
- Called game / no-game (노게임)
- Suspended (서스펜디드)
- Void / forfeit variants if Provider exposes them

Proposal only: extend result taxonomy in a **KBO grade adapter** later; do not overload MLB scripts silently.

---

## 7. First Dataset priority (next mission picks **one**)

Recommended order by **data feasibility first** (not Engine importance):

1. **Schedule / Result Identity** — stable `gameId` + final score/status join (unlocks grade loop)
2. Starter — **blocked** until lawful probable/confirmed source ([KBO_STARTER_DATA_SOURCE_READINESS_AUDIT_V1.md](./KBO_STARTER_DATA_SOURCE_READINESS_AUDIT_V1.md): operator input v1 recommended first)
3. Lineup — post-game more likely than pre-game; Provider TBD
4. Bullpen — appearance logs Provider TBD
5. Travel / Rest — schedule+venue derived (pattern reusable; Korea venues)
6. Weather — Korea forecast Provider TBD (NOAA US-only insufficient)
7. Injury — API-BASEBALL unsupported; other source TBD
8. Odds History — Odds API candidate after legal review

**Next mission:** implement **only #1** (or the single Dataset chosen after this audit), not the full stack.

---

## 8. Abstraction trigger (this pass)

KBO is the **first non-MLB league** under supported sport `BASEBALL`. Lifecycle patterns (freeze → grade → review → hash → `researchOnly` → Engine PROHIBITED) are **COMMON_CANDIDATE / COMMON_CONFIRMED** at the **process** level.

**No Framework field promotion** until a real KBO Dataset JSON + audit exists and a second common/difference pass promotes only repeated fields.

Conclusion for this mission: **`COMMON_EXTRACTION_CANDIDATES_FOUND`** + **Framework change = none**.

---

## 9. Explicit non-goals

- No `kbo-*` Registry rows / placeholders
- No Dummy KBO research Prediction
- No copy-paste MLB builders with rename
- No Betman or KBO official-site HTML crawling
- No KBO Weights / Engine
