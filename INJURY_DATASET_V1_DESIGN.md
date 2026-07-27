# MLB Injury Dataset v1 — Pre-design

Read-only feasibility audit. **No builder, no Injury Score, no Engine, no Viewer UI.**

**Machine-readable audit:** `data/audits/injury-dataset-v1-pre-design-audit.json`

**Registry:** No `mlb-injury` entry — **unchanged** (no registry write in this audit).

**Related survey (read-only):** `data/research/mlb/h-bp-role-006-availability-survey.json` — roster/IL collectability for bullpen availability; not an injury dataset builder.

**Official conclusion:** `READY_FOR_MINIMAL_INJURY_DATASET_DESIGN`

**Implementation decision:** `HOLD` — minimal schema design approved; builder blocked until canonical Provider policy, player-game join granularity, and cutoff versioning are signed off.

---

## 1. Research purpose

Collect **factual player availability / injury-list context** knowable at or before each game’s research `cutoffTime`.

This is **not**:

- An Injury Score or Engine weight
- A substitute for official lineup confirmation
- Inference from “player did not start” without an authoritative roster/transaction signal
- Team-site or press-report scraping

Goals:

- Join roster / transaction facts to `gameId` / `gamePk` / `teamId` / `playerId` at a documented freeze
- Separate **pre-game roster snapshot** from **post-game observed absence**
- Record `source`, `collectionPhase`, `missing`, `warnings` — never invent IL status
- Follow Starter/Bullpen/Lineup patterns: raw cache, derived dataset, `resultHash`, `engineAdmission: PROHIBITED`

---

## 2. Audited slate scope

| Date (KST) | Games | Team slots | Notes |
|------------|------:|-----------:|-------|
| 2026-07-27 | 15 | 30 | Same prediction/starter join window as Weather/Travel audits |
| 2026-07-28 | 12 | 24 | Includes temporary venue slate (Athletics) |

**Total audited games:** 27

Join path (same as other MLB research datasets):

```text
prediction.gameId
  → starter-dataset-v1 (gamePk, teamId, side, cutoffTime)
  → team roster / transaction sources (this audit)
```

Prediction hash and immutable fields are **unchanged** by this audit.

---

## 3. Candidate providers (pre-game vs post-game)

### 3.1 MLB Stats API — **primary research candidate**

| Endpoint | HTTP | Pre-game | Post-game | Role |
|----------|:----:|:--------:|:---------:|------|
| `GET /api/v1/teams/{id}/roster?rosterType=40Man` | 200 | ✓ | ✓ | Authoritative 40-man roster + `status.code` / `status.description` |
| `GET /api/v1/teams/{id}/roster?rosterType=active` | 200 | ✓ | ✓ | Active 26 only — **insufficient alone** for IL/DL rows |
| `GET /api/v1/injuries?sportId=1&teamId={id}` | **404** | ✗ | ✗ | **Not available** — do not depend |
| `GET /api/v1/transactions?sportId=1&startDate=&endDate=` | 200 | ✓ (filtered) | ✓ | IL placement/activation events (`typeCode=SC`) |
| `GET /api/v1/game/{gamePk}/playByPlay` | 200 | ✗ | ✓ | In-game injury delays — sparse, unstructured |

**40Man probe (24 teams on 2026-07-27 schedule date fetch):**

| `status.code` | Count (aggregated) | Meaning (observed) |
|---------------|-------------------:|--------------------|
| `A` | 622 | Active |
| `D60` | 128 | Injured 60-Day |
| `D15` | 41 | Injured 15-Day |
| `D10` | 45 | Injured 10-Day |
| `D7` | 2 | Injured 7-Day |
| `RM` | 232 | Reserve / minors |
| `NYR` | 3 | Not yet reported |

**451** non-active 40-man rows across slate teams; **200** rows include a free-text `note` (e.g. `"Right shoulder impingement"`). Notes are **partial** — not guaranteed for every IL row.

**Transactions probe (2026-07-01 → 2026-07-27):** 1,702 rows; IL-related `SC` (Status Change) descriptions include placement/activation narrative and often body-part text in **free text**, not structured fields.

**Legal:** `INTERNAL_RESEARCH_ONLY` (existing MLB Stats API policy). Commercial/public runtime unconfirmed.

### 3.2 SportsDataIO — **secondary candidate (blocked on current trial)**

| Endpoint | Trial status | Pre-game | Post-game |
|----------|--------------|:--------:|:---------:|
| `/scores/json/Injuries` | 404 unsupported | ✗ | ✗ |
| `/projections/json/InjuredPlayers` | 200 (296 rows) | ✓* | ✓* |

Observed raw fields: `PlayerID`, `InjuryStatus`, `InjuryBodyPart`, `InjuryStartDate`, `InjuryNotes`, `Status`, `TeamID`, …

**Trial blocker:** response values include literal `"Scrambled"` for injury fields → **PERMANENTLY_PROHIBITED** per project policy until a **non-scrambled paid** subscription is verified.

**Legal:** Requires subscription terms review; not prioritized above MLB Stats API for v1.

### 3.3 API-BASEBALL (grading baseline)

Current MLB pipeline parses scores/status only — **no injury endpoint wired**. API-Football `/injuries` exists for soccer only; **not applicable** to MLB v1.

### 3.4 Prohibited sources

- MLB.com / team-site HTML injury reports
- Press scraping, social media, beat-writer feeds
- Betman HTML
- SportsDataIO Scrambled payloads
- “Did not appear in lineup” as standalone injury proof (lineup dataset is POST_GAME actual)

---

## 4. Field availability matrix

Legend: ✓ = directly available · ~ = partial / parse-required · ✗ = unavailable · PG = pre-game · PO = post-game

| Field | MLB 40Man roster | MLB transactions | SportsDataIO InjuredPlayers | PG | PO |
|-------|:----------------:|:----------------:|:---------------------------:|:--:|:--:|
| **player** (`playerId`, name) | ✓ `person.id`, `fullName` | ✓ `person` | ✓ `PlayerID`, names | ✓ | ✓ |
| **status** (IL10/IL15/IL60/DTD/etc.) | ✓ `status.code`, `status.description` | ~ from `typeDesc` + description | ✓ `InjuryStatus`, `Status` | ✓ | ✓ |
| **injury type** (narrative) | ~ `note` (optional) | ~ description text | ~ `InjuryNotes` | ~ | ~ |
| **body part** | ~ `note` (optional) | ~ description text | ✓ `InjuryBodyPart`* | ~ | ~ |
| **expected return** | ✗ | ✗ | ✗ | ✗ | ✗ |
| **announcement time** | ✗ (only collection `asOf`) | ~ `date` / `effectiveDate` (calendar) | ~ `InjuryStartDate` (date) | ~ | ~ |
| **last updated** | ✗ | ✗ | ✗ | ✗ | ✗ |
| **source** | ✓ endpoint label | ✓ endpoint label | ✓ provider label | ✓ | ✓ |

\* SportsDataIO body part unavailable on Scrambled trial.

### 4.1 Pre-game collectible (recommended v1 scope)

- 40-man roster snapshot per team at/before `cutoffTime`
- Roster `status.code` in `{D7,D10,D15,D60,...}` → `injuryListed=true` (label only — not severity score)
- Optional `note` text when present
- Transaction rows with `effectiveDate <= cutoffDate` and IL-related `SC` descriptions (append-only snapshot; no NLP inference beyond storing official text)

### 4.2 Post-game only (separate phase — not backfilled into pre-game)

- In-game PBP injury / injury-delay events (`game_advisory`, rare structured `injuryType` in some feeds)
- Lineup actual absence vs roster expectation (comparison audit only)
- IL activations announced after first pitch

### 4.3 Explicitly unavailable (do not invent)

| Field / concept | Reason |
|-----------------|--------|
| `expectedReturn` | No structured field in Stats API or SportsDataIO response reviewed |
| `lastUpdated` timestamp | Rosters/transactions expose dates, not authoritative feed revision time |
| Precise announcement clock time | Transaction `date` is calendar date only |
| Day-to-day / game-time decision | Not in API; requires press inference |
| Injury severity grade / MRI | Not in official API |
| `/api/v1/injuries` dedicated feed | HTTP 404 on live probe |
| SportsDataIO Scrambled values | Policy prohibited |
| Active-roster-only IL list | `rosterType=active` omits IL players |

---

## 5. Leakage risks

| Risk | Mitigation |
|------|------------|
| Post-game IL activation backfilled into pre-game row | Freeze roster/transactions at `cutoffTime`; separate `POST_GAME_ROSTER_CONTEXT` phase |
| Transaction with `effectiveDate` after cutoff used pre-game | Filter `effectiveDate <= cutoffDate`; warn `TRANSACTION_AFTER_CUTOFF` |
| Retroactive IL placement in description | Store `effectiveDate`, `resolutionDate`, raw `description`; flag retroactive text |
| Lineup absence used as injury proxy | Forbidden — lineup dataset is post-game actual |
| SportsDataIO refresh after cutoff without versioning | Append-only snapshots + `inputHash`; do not rewrite historical rows |
| In-game PBP injury in pre-game features | PBP is POST_GAME only |
| Using graded game outcome fields | Forbidden — no `predictionHit` / result linkage in dataset rows |
| Engine early admission | Remains **PROHIBITED** until hypothesis + legal gates |

---

## 6. Legal status

| Source | Research use | Public/commercial | Notes |
|--------|:------------:|:-----------------:|-------|
| MLB Stats API (40Man, transactions) | Allowed internal | **Not confirmed** | Existing `INTERNAL_RESEARCH_ONLY` policy |
| MLB Stats API `/injuries` | N/A (404) | N/A | Do not crawl MLB.com injury pages instead |
| SportsDataIO InjuredPlayers | Trial only today | Requires paid + review | Scrambled **prohibited** |
| API-BASEBALL MLB injuries | Not wired | N/A | Out of v1 scope |
| Team / press injury reports | **Blocked** | **Blocked** | No HTML scraping |

Display of IL status or injury notes in public product UI requires separate legal review even when research collection is allowed.

---

## 7. Minimal schema draft (not implemented)

**Granularity (candidate):** one row per **player** per **game** where roster status ≠ active **or** IL-related transaction exists in window — linked via starter join.

Alternative team-level summary row rejected for v1 — loses player identity needed for starter/lineup cross-check research.

### Metadata (per row)

`schemaVersion`, `builderVersion`, `gameDate`, `gameId`, `gamePk`, `teamId`, `teamName`, `side`, `playerId`, `playerName`, `collectionPhase`, `generatedAt`, `cutoffTime`, `source`, `sourceEndpoint`, `researchOnly`, `legalStatus`, `inputHash`, `resultHash`, `warnings`, `missing`, `joinQuality`, `engineAdmission`

### Payload (candidates)

`rosterStatusCode`, `rosterStatusDescription`, `injuryListed`, `injuryNote`, `transactionId`, `transactionDate`, `transactionEffectiveDate`, `transactionDescription`, `transactionTypeCode`, `bodyPartText`, `statusCategory` (IL / PATERNITY / BEREAVEMENT / SUSPENDED / OTHER — derived from code/description label only)

Unconfirmed → `null` + `missing` — never invented.

### Collection phases

| Phase | Value | Use |
|-------|-------|-----|
| Pre-game roster snapshot | `PRE_GAME_ROSTER_INJURY` | Default v1 |
| Post-game observed | `POST_GAME_INJURY_EVENT` | PBP / activation audit only |

---

## 8. API volume estimate (100-game slate)

| Operation | Cold (approx.) | Warm rerun |
|-----------|---------------:|-----------:|
| 40Man roster × ~30 teams | ~30 | 0 (cache) |
| Transactions date-range (season window) | 1–7 | 0 |
| Per-player people hydrate | **Avoid** at scale | — |

Align cache with Starter/Bullpen: `data/cache/research/mlb/raw/statsapi/`.

---

## 9. Open questions

1. Canonical Provider: Stats API 40Man-only vs 40Man + transactions vs paid SportsDataIO
2. Transaction description storage: raw text only vs light pattern tags (must not invent structured injury type)
3. Player-game join for non-roster pitchers (opponent bench relevance scope)
4. Whether paternity/bereavement/suspension belong in “injury” dataset or sibling availability dataset
5. `mlb-injury` registry naming vs `mlb-availability` — deferred (no registry write in this audit)

---

## 10. Implementation gate

| Gate | Status |
|------|--------|
| Minimal schema design | **GO** |
| Builder | **HOLD** |
| Hypothesis registration | **BLOCKED** |
| Engine | **BLOCKED** |
| Registry | **BLOCKED** (no entry created) |
| Viewer | **BLOCKED** |

---

## Regression (this audit)

- [x] No builder code
- [x] No Framework / Registry / Engine / Viewer changes
- [x] No hypothesis registration
- [x] Prediction hash untouched
- [x] Weather / Travel builder artifacts untouched
