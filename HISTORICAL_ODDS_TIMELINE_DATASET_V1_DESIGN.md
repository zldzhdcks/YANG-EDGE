# Historical Odds Timeline Dataset v1 Design

**Status:** `DESIGN_ONLY`  
**Engine admission:** `PROHIBITED`  
**Historical API calls:** none in this mission  
**Builder / Registry / Framework / Types code:** not implemented

**Official conclusion:** `HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGNED`

## References

- [MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDIT_V1.md](./MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDIT_V1.md)
- [MARKET_INTELLIGENCE_RESEARCH_DESIGN.md](./MARKET_INTELLIGENCE_RESEARCH_DESIGN.md)
- [MARKET_MOVEMENT_SEMANTICS_V1.md](./MARKET_MOVEMENT_SEMANTICS_V1.md)
- [docs/DEVELOPMENT_COMPLIANCE_CHARTER.md](./docs/DEVELOPMENT_COMPLIANCE_CHARTER.md)

Audit: `data/audits/historical-odds-timeline-dataset-v1-pre-design-audit.json`

---

## 1. Current Odds History limitations (project audit)

### MLB Odds History Dataset v1

| Topic | Current behavior | Gap for Timeline v1 |
|-------|------------------|---------------------|
| Stored fields | `openingOdds`, `latestOdds`, `marketProbability`, `movement`, `bookmaker=AGGREGATE_BEST`, `bookmakerCount`, `oddsEventId` | No per-bookmaker raw prices; no multi-snapshot timeline |
| Opening / Latest | From frozen **prediction snapshot** (+ optional live timeline enrichment) | Not Historical API snapshots; not provider Opening |
| Bookmaker raw | **Lost** — collapsed to `AGGREGATE_BEST` | Must preserve bookmaker keys before any aggregate |
| Markets | `h2h` only | Spreads/totals/period markets not in History v1 |
| Closing | Explicitly not collected | Keep as `CLOSING_CANDIDATE` only later |
| Sport scope | MLB only | Need BASEBALL/SOCCER/BASKETBALL/VOLLEYBALL-capable schema |

### KBO Odds Comparison v1

| Topic | Current behavior | Relation to Timeline |
|-------|------------------|----------------------|
| Domestic | Operator input `DOMESTIC_PROTO_OPERATOR_INPUT` | Must stay **separate sourceType** — never mixed as Overseas Provider Raw |
| Overseas | The Odds API + `AGGREGATE_BEST` + `h2h` | Aggregate loses bookmaker timeline; comparison ≠ Historical Timeline |
| Market rules | Often `MARKET_RULE_UNVERIFIED` | Timeline may store rows; Backtest/Engine still blocked |

**Conclusion:** Current History/Comparison are **summary / comparison** layers. Timeline Dataset v1 must prioritize **raw snapshot rows**, then optional derived summaries.

---

## 2. Hierarchy

```text
Sport
  ↓
League
  ↓
Game (internal identity)
  ↓
Odds Provider (+ providerEventId)
  ↓
Bookmaker (canonical key)
  ↓
Market (canonical type + period + line)
  ↓
Snapshot (time + phase + pre-game flag)
  ↓
Selection (code + oddsDecimal + optional point)
```

| Layer | Identifier | Responsibility |
|-------|------------|----------------|
| Sport | `BASEBALL` / `SOCCER` / `BASKETBALL` / `VOLLEYBALL` | Product scope |
| League | Product league label + optional provider league key | Scope / partition |
| Game | `internalGameId` | Join to schedule/result identity |
| Odds Provider | `providerId` + `providerEventId` | Source of odds snapshots |
| Bookmaker | `bookmakerKey` | Price source within provider |
| Market | `marketKey` + `canonicalMarketType` + `period` + `line` | Contract boundary |
| Snapshot | `snapshotId` / (`snapshotTime` + keys) | Point-in-time observation |
| Selection | `selectionCode` (+ `participantRef`) | Priced outcome |

---

## 3. Game identity

```text
internalGameId
sport
league
season
providerGameRefs[]   // odds + schedule/result refs separated
scheduledStartTime   // current known start (may change)
dateKst
homeParticipant
awayParticipant
gameIdentityStatus
```

Rules:

- Odds Provider `providerEventId` ≠ schedule/result Provider game id.
- Do **not** auto-join Historical Odds to results by team-name string alone.
- Prefer canonical team ids / verified crosswalk (same spirit as KBO identity `providerRefs`).

---

## 4. Provider model

```text
providerId
providerEventId
providerSportKey
providerLeagueKey
region
sourceTimestamp
retrievedAt
legalStatus
cachePolicyStatus
redistributionStatus
```

Allowed `providerId` candidates (verified/mentioned in project audits only):

- `THE_ODDS_API`
- `SPORTSDATAIO`
- `API_SPORTS`
- `LICENSED_FEED`

Do not invent unverified provider ids. Volleyball may require `LICENSED_FEED` / other — still `NOT_VERIFIED` until audit.

`sourceType` on rows:

- `OVERSEAS_PROVIDER`
- `DOMESTIC_OPERATOR_VERIFIED` (separate store / never mixed as overseas raw)

---

## 5. Bookmaker model

```text
bookmakerKey          // canonical
bookmakerName         // display as observed
region
lastUpdateAtSnapshot
status
```

- Do not store bookmaker as a free-form label alone.
- Name variants map to one `bookmakerKey` (Registry design later — **not implemented now**).
- `AGGREGATE_BEST` is a **derived policy label**, not a bookmaker, and not Consensus.

---

## 6. Market model

```text
marketKey                 // provider key e.g. h2h, spreads
canonicalMarketType
period
line                      // null when N/A
marketRuleStatus
ruleReference
selections[]
```

### canonicalMarketType candidates

`MONEYLINE_2WAY` · `MONEYLINE_3WAY` · `SPREAD` · `TOTAL` · `BTTS` · `DOUBLE_CHANCE` · `DRAW_NO_BET` · `SET_HANDICAP` · `OTHER`

Do not force unsupported markets into enums; use `OTHER` + `marketKey` + warning.

### period candidates

`FULL_GAME` · `FIRST_HALF` · `SECOND_HALF` · `QUARTER_1` · `SET_1` · `OTHER`

Sport-specific periods stay `SPORT_SPECIFIC` / `MARKET_SPECIFIC`.

---

## 7. Market rules

`marketRuleStatus`: `VERIFIED` | `PARTIAL` | `UNVERIFIED` | `CONFLICTING` | `UNKNOWN`

`ruleReference` candidates: official provider docs · league rules · licensed contract · operator legal note.

Verify before Backtest/Engine:

- OT / extra innings inclusion
- draw handling
- penalties inclusion
- cancel / postpone / void
- handicap basis
- set / quarter basis

If `UNVERIFIED`: raw timeline + movement **candidates** may still be stored; **cross-market compare / Backtest / Engine input forbidden**.

---

## 8. Snapshot model

```text
snapshotId
snapshotTime
retrievedAt
scheduledStartTimeAtSnapshot
phase
isPreGame
providerLastUpdate
bookmakerLastUpdate
markets / selections (via row store)
inputHash
```

### phase

`OPENING_CANDIDATE` · `INTERMEDIATE` · `LATEST_PRE_GAME` · `CLOSING_CANDIDATE` · `POST_START` · `POST_GAME`

- Provider-defined Opening absent → use **`OPENING_CANDIDATE`**, never claim official Opening.
- Official Closing absent → **`CLOSING_CANDIDATE`** optional alias of latest pre-game; **no `closingOdds` field**.

### Pre-game cutoff

```text
isPreGame = true  iff  snapshotTime < scheduledStartTimeAtSnapshot
```

If start time changes:

1. Preserve `scheduledStartTimeAtSnapshot` on each row.
2. Reclassification against final start requires a **separate audit** — do not silently rewrite past phases.

---

## 9. Selection model

```text
selectionCode
selectionLabel
participantRef
oddsDecimal
point
status
sourceName
```

`selectionCode` candidates: `HOME` · `DRAW` · `AWAY` · `OVER` · `UNDER` · `YES` · `NO` · `PARTICIPANT` · `OTHER`

`participantRef` links team/player identity when available.

### Odds validation candidates

- Prefer `finite` and `oddsDecimal > 1.0` for research-ready values.
- If provider returns `1.0` / special / non-decimal, keep **raw** side-channel (`rawOddsText` / `rawOddsStatus`) — do not coerce.
- Forbidden: quiet string→number conversion; `≤ 0`; `NaN`; missing→`1.0`.

---

## 10. Storage model comparison

### A. Nested Document

Game → Provider → Bookmaker → Market → Snapshots

| Pros | Cons |
|------|------|
| Human-readable per game | Deep nesting; partial re-fetch awkward |
| Natural hierarchy | Hashing large trees brittle |
| Good for small samples | Bookmaker compare across games harder |

### B. Normalized Row Store

One row = game + provider + bookmaker + market + snapshot + selection

| Pros | Cons |
|------|------|
| Stable hash after sort | Verbose JSON |
| Easy partial recollect / filter | Need derived summary for readability |
| Analytics / future DB migration friendly | Cross-field duplication |

### Recommendation

**Raw = Normalized Snapshot Rows** + **Derived = Game Timeline Summary**

```text
rawRows[]
timelineSummary[]   // derived only; optional; not source of truth
```

No artifact files created in this mission.

---

## 11. Raw vs Derived

### Raw (preserve)

Provider ids · bookmaker · market · snapshotTime · selection · odds · line · provider timestamps · marketRuleStatus · scheduledStartTimeAtSnapshot · legal/cache statuses · hashes · warnings/missing

### Derived summary candidates (not computed now)

`firstSnapshotAt` · `latestPreGameAt` · `snapshotCount` · `movementCount` · `openingCandidate` · `latestPreGame` · min/max odds · direction · volatility · bookmaker consensus metrics

---

## 12. Opening / Latest / Closing policy

| Concept | Field | Policy |
|---------|-------|--------|
| Opening | `openingCandidate` | First observed pre-game snapshot for game×provider×bookmaker×market×period×line×selection |
| Official Opening | `officialOpeningStatus` | `PROVIDER_DEFINED` / `FIRST_OBSERVED_ONLY` / `NOT_AVAILABLE` / `UNKNOWN` |
| Latest pre-game | `latestPreGameSnapshot` | Latest with `snapshotTime < scheduledStartTimeAtSnapshot` |
| Closing | — | **No `closingOdds` field**; optional `CLOSING_CANDIDATE` phase only |

---

## 13. Consensus vs AGGREGATE_BEST

- **Consensus** (future): computed from preserved bookmaker odds (median/mean/weighted/best/worst/dispersion — formula **not selected**).
- **AGGREGATE_BEST**: current project policy that **collapses** books to a single best price — useful for UI/summary, **not** a consensus substitute, and **not** raw timeline.

---

## 14. Outcome join

```text
internalGameId
market grading contract
resultStatus
selectionOutcome
voidReason
gradedAt
```

Do not grade all markets with a single moneyline winner. Each market needs its own grading contract.

---

## 15. Domestic boundary

| | Overseas Provider Raw | Domestic Operator |
|--|----------------------|-------------------|
| `sourceType` | `OVERSEAS_PROVIDER` | `DOMESTIC_OPERATOR_VERIFIED` |
| Storage | Timeline raw rows | Separate operator market archive |
| DRAFT | n/a | **Excluded** from verified Historical research samples |
| Fields | provider snapshots | `capturedAt` / `enteredAt` / `reviewedAt` / `reviewStatus` / `operatorMarketId` |

---

## 16. Multi-sport field classification

| Element | Class |
|---------|-------|
| Game Identity, Provider shell, Bookmaker shell, Snapshot time, Selection oddsDecimal, Market Rule status, Outcome join keys, legal/hash/missing | `COMMON_CANDIDATE` → promote to `COMMON_CONFIRMED` after probe |
| Movement / Consensus / CLV definitions | `COMMON_CANDIDATE` (semantics doc) |
| Period sets (SET/QUARTER/HALF) | `SPORT_SPECIFIC` |
| Line / handicap / set handicap | `MARKET_SPECIFIC` |
| Provider sport keys / regions / quota | `PROVIDER_SPECIFIC` |
| Volleyball Odds API coverage | `UNKNOWN` / gap |

Framework implementation: **forbidden** in this mission.

---

## 17. Dataset metadata candidate

```text
datasetId: historical-odds-timeline
schemaVersion: historical-odds-timeline-dataset-v1
builderVersion: (future)
generatedAt
researchOnly: true
legalStatus
engineAdmission: PROHIBITED
sourceProvider
sportScope
leagueScope
collectionPhase
inputHash
resultHash
cacheUsage
warnings
missing
licenseGates
```

Dataset status while gates fail: **`DESIGN_ONLY`**.

---

## 18. Path recommendation

**Recommended raw layout:**

```text
data/research/market-intelligence/raw/{provider}/{sport}/{league}/{dateKst}.json
```

Why: slate-day batching matches Odds API sport-day pulls; fewer files than per-game; clearer provider partitions.

**Derived:**

```text
data/research/market-intelligence/derived/{sport}/{league}/{internalGameId}-timeline-summary-v1.json
```

**Directories are not created in this mission.**

### Git / capacity policy

| Store | Content |
|-------|---------|
| Git | Schema docs · audits · tiny samples only |
| Local / secured object storage | Raw Historical timelines |
| Do not | Commit full multi-year raw Historical Odds into Git |

JSON artifacts remain OK for small probes; large archives need object storage / DB later (not introduced now).

---

## 19. Hash policy

- **Raw row hash:** stable identity of provider payload slice for that row (excluding `retrievedAt` / wall-clock ingest when possible).
- **Dataset hash:** sort rows by  
  `gameId → provider → bookmaker → market → line → snapshotTime → selectionCode`  
  then hash body excluding execution timestamps.

---

## 20. Duplicate policy

Dedupe key candidate:

`provider + providerEventId + bookmakerKey + marketKey + period + line + snapshotTime + selectionCode`

- Exact duplicate → dedupe allowed.
- Same keys but different odds → keep revision (`revision` / `observedAt` / `rawPayloadHash`) — may be provider correction.

---

## 21. Missing codes

`NO_EVENT_IDENTITY` · `NO_BOOKMAKERS` · `NO_MARKETS` · `NO_PRE_GAME_SNAPSHOT` · `NO_LATEST_PRE_GAME` · `MARKET_RULE_UNVERIFIED` · `SELECTION_MAPPING_FAILED` · `START_TIME_UNKNOWN` · `LEGAL_GATE_BLOCKED` · `PLAN_BLOCKED` · `CACHE_POLICY_UNKNOWN`

Never replace missing odds with `0` or empty-as-1.0.

---

## 22. Compliance gates (Charter)

| Gate | Pre-design status |
|------|-------------------|
| LEGAL_GATE | NOT_PASSED |
| LICENSE_GATE | NOT_PASSED |
| CACHE_GATE | NOT_PASSED |
| REDISTRIBUTION_GATE | NOT_PASSED |
| COST_GATE | NOT_PASSED |
| DATA_QUALITY_GATE | NOT_PASSED |
| MARKET_RULE_GATE | NOT_PASSED |

→ Builder deferred; status **`DESIGN_ONLY`**.

---

## 23. First Probe input contract (MLB h2h)

| Constraint | Value |
|------------|-------|
| Sport / League | BASEBALL / MLB |
| Market | `h2h` → `MONEYLINE_2WAY` |
| Scope | 1 representative date **or** 1 game |
| Max snapshots | ≤ 12 (opening candidate + sparse intermediates + latest pre-game) |
| Max bookmakers | ≤ 10 (or first N returned; document truncation) |
| API credit ceiling | ≤ 50 credits (featured historical ≈ 10 × regions × markets × pulls) |
| Bulk | Forbidden |
| Closing field | Forbidden |
| Domestic mix | Forbidden |

### Probe outputs (validation checklist)

1. Schema Fit  
2. Provider Field Gap  
3. Market Rule Gap  
4. Cost (credits used)  
5. License Gate notes  

No Engine / Prediction wiring.

### Probe execution note (2026-07-28)

Minimal probe script: `scripts/probe-mlb-h2h-historical-odds-v1.ts`  
Result: **`PLAN_BLOCKED`** (`HISTORICAL_UNAVAILABLE_ON_FREE_USAGE_PLAN`).  
Report: [MLB_H2H_HISTORICAL_ODDS_PROBE_V1.md](./MLB_H2H_HISTORICAL_ODDS_PROBE_V1.md).  
Schema fit against live Historical payload remains **pending paid plan**.

---

## 24. Impact

| Area | Impact |
|------|--------|
| Framework / Registry / Types code | 0 |
| Builder / Dataset artifacts | 0 |
| Prediction / Engine / Viewer | 0 |
| Historical API | 0 calls |

---

## 25. Remaining issues

1. Gates still fail — no Builder.
2. Volleyball / KBL provider gap unresolved.
3. Official Opening/Closing still unavailable on The Odds API docs.
4. Movement/Consensus/CLV formulas intentionally unset.
5. Bookmaker Registry not designed beyond key candidate.
