# Market Intelligence Hypothesis Registry v1

**Status:** `DESIGN_ONLY`  
**Official conclusion:** `MARKET_INTELLIGENCE_HYPOTHESIS_REGISTRY_V1_DESIGNED`

No Builder · Dataset artifact · Registry code · Prediction · Engine · Viewer · Historical API in this mission.

## References

- [docs/DEVELOPMENT_COMPLIANCE_CHARTER.md](./docs/DEVELOPMENT_COMPLIANCE_CHARTER.md)
- [MARKET_INTELLIGENCE_RESEARCH_DESIGN.md](./MARKET_INTELLIGENCE_RESEARCH_DESIGN.md)
- [MARKET_INTELLIGENCE_RESEARCH_WORKFLOW.md](./MARKET_INTELLIGENCE_RESEARCH_WORKFLOW.md)
- [HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md](./HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md)
- [MARKET_MOVEMENT_SEMANTICS_V1.md](./MARKET_MOVEMENT_SEMANTICS_V1.md)
- [HYPOTHESIS_REGISTRY.md](./HYPOTHESIS_REGISTRY.md) — **Prediction Research** registry (separate)
- Engine Admission / Research Quality dashboards — governance patterns only (no code change)

Audit: `data/audits/market-intelligence-hypothesis-registry-v1-pre-design.json`

---

## 1. Research separation (mandatory)

| Axis | Registry | Studies | May write |
|------|----------|---------|-----------|
| **Prediction Research** | [HYPOTHESIS_REGISTRY.md](./HYPOTHESIS_REGISTRY.md) (`H-BP-*`, `H-ST-*`, …) | Game / lineup / starter / bullpen / outcome prediction features | Prediction datasets, grades |
| **Market Intelligence** | This design (`MI-*` candidates) | Market prices, bookmakers, movement, consensus, CLV **candidates** | Timeline refs + MI evidence only |

**Hard boundary:**

- Prediction Engine **does not read** Market Intelligence Hypothesis Registry.
- Market Intelligence hypotheses **do not** mutate Prediction snapshots, EDGE scores, or Engine weights.
- The two layers **must not directly influence** each other.
- Any future connection requires a **separate, manual Engine-admission procedure** after both sides pass their gates — never automatic.

```text
Prediction Research  →  studies games / predictions
Market Intelligence  →  studies markets / odds timelines
         ✕ direct coupling forbidden
```

---

## 2. Hypothesis model (candidates)

| Field | Role |
|-------|------|
| `hypothesisId` | Stable id, e.g. `MI-OD-001` (prefix `MI-`) |
| `title` | Short name |
| `description` | Testable claim in **price/market language** (not “will raise hit rate”) |
| `category` | See §3 |
| `status` | See §4 |
| `createdAt` | ISO |
| `createdBy` | Operator / researcher label |
| `researchOnly` | Default `true` |
| `legalStatus` | Default `INTERNAL_RESEARCH_ONLY` until cleared |
| `engineAdmission` | Default `PROHIBITED` |
| `evidenceCount` | Count of evidence events |
| `sampleCount` | Graded/evaluable samples |
| `worked` / `failed` / `pending` | Measurable counters only |
| `backtestStatus` | e.g. `NOT_STARTED` / `RUNNING` / `COMPLETE` / `BLOCKED` |
| `promotionStatus` | Manual gate position (not auto) |

**Forbidden in v1 design implementation:** Confidence Score · Accuracy Score · Importance · Weight · autoApply=`true`.

---

## 3. Categories

| Category | Meaning (research variable) |
|----------|------------------------------|
| `OPENING_DRIFT` | OPENING_CANDIDATE → LATEST_PRE_GAME price change patterns |
| `LATE_MOVE` | Moves near start (window TBD) |
| `BOOKMAKER_DISAGREEMENT` | Dispersion across books |
| `CONSENSUS` | Multi-book aggregate candidates (formula unset) |
| `CLV` | Decision-time vs latest-pre-game candidates |
| `MOVEMENT_SPEED` | Rate of price change candidates |
| `VOLATILITY` | Oscillation / revision frequency candidates |
| `LINE_MOVEMENT` | Line/point moves (spreads/totals) when markets verified |
| `OTHER` | Explicitly labeled; do not force-fit |

Semantics must follow [MARKET_MOVEMENT_SEMANTICS_V1.md](./MARKET_MOVEMENT_SEMANTICS_V1.md): no Steam/Sharp auto-facts; no win-probability claims from decimal shortening alone.

---

## 4. Lifecycle / status

| Status | Meaning |
|--------|---------|
| `IDEA` | Documented idea; no collection |
| `COLLECTING` | Evidence accumulating |
| `UNDER_BACKTEST` | Formal backtest in progress |
| `NEEDS_MORE_SAMPLE` | Below target / inconclusive |
| `READY_FOR_REVIEW` | Human research review |
| `REJECTED` | Falsified or abandoned — **kept**, not deleted |
| `APPROVED_FOR_ENGINE_REVIEW` | Eligible to enter Engine review queue only |
| `ENGINE_APPROVED` | Engine review passed on paper |

**Critical:** `ENGINE_APPROVED` ≠ automatic Engine wiring / weight apply. Still requires a separate admission + change control step.

---

## 5. Evidence model

| Field | Role |
|-------|------|
| `evidenceId` | Stable event id |
| `hypothesisId` | Parent |
| `datasetId` | Source dataset id (timeline / operator / other) |
| `gameId` | Internal game id when applicable |
| `sport` / `league` | Scope |
| `observedValue` | Measurable market observation |
| `expectedDirection` | Pre-declared direction/label |
| `actualOutcome` | Graded market/result join (contract-specific) |
| `worked` | boolean / enum — only after grading contract |
| `notes` | Free text |
| `sourceType` | See below |

### `sourceType` candidates

- `HISTORICAL_ODDS_TIMELINE` (read-only reference)
- `LIVE_ODDS_SNAPSHOT` (forward archive)
- `DOMESTIC_OPERATOR_VERIFIED`
- `PREDICTION_DATASET` (read-only cross-ref for CLV-style studies — **does not** write prediction)
- `OTHER`

Evidence is **append-only**. Hypotheses never rewrite Historical Timeline raw rows.

---

## 6. Sample policy

| Field | Role |
|-------|------|
| `sampleCount` | Evaluable n |
| `worked` / `failed` / `pending` / `void` | Counters |
| `sampleWindow` | Date/league window label |
| `minimumTarget` | Gate threshold |

### Minimum target candidates (not enforced in code)

| Target | Use |
|--------|-----|
| **100** | First review eligibility candidate |
| **500** | Stronger stability candidate |
| **1000** | Long-horizon candidate |

Do not mark PROMISING / Engine-ready from one slate or n≪100 (same spirit as Prediction registry).

---

## 7. Promotion gate (manual only)

```text
IDEA
  ↓
COLLECTING
  ↓
≥100 samples (candidate)
  ↓
≥500 samples (candidate)
  ↓
Backtest
  ↓
READY_FOR_REVIEW
  ↓
APPROVED_FOR_ENGINE_REVIEW
  ↓
ENGINE_APPROVED   ← still not auto-wired
  ↓
Separate Engine admission change control (future)
```

**Automatic promotion is forbidden.**

Blocked while:

- `marketRuleStatus != VERIFIED` for compared markets
- Historical/legal/cache gates fail for the cited data
- Evidence uses POST_START leakage

---

## 8. Rejection policy

If a hypothesis fails:

1. Set `status = REJECTED`
2. Keep id, description, sample counters, evidence links, final notes
3. **Do not delete** the row or purge the ledger

Rejected hypotheses remain part of the research audit trail.

---

## 9. Prediction boundary

| Action | Allowed? |
|--------|----------|
| MI hypothesis cites prediction decision time for CLV candidate | Yes (read-only) |
| Prediction Engine reads MI registry | **No** |
| MI status changes EDGE / Confidence / Weights | **No** |
| Shared autoApply bridge | **No** |

---

## 10. Historical Odds boundary

| Action | Allowed? |
|--------|----------|
| Hypothesis references Timeline dataset / game timeline summary | Yes |
| Hypothesis mutates raw timeline rows | **No** |
| Bulk Historical API from registry tools | **No** (separate probe/builder missions) |

Paid Historical remains **HOLD** per business audit; registry design does not authorize spend.

---

## 11. Compliance defaults

```text
researchOnly: true
legalStatus: INTERNAL_RESEARCH_ONLY
engineAdmission: PROHIBITED
autoApply: false   // if field exists later
```

Charter: Evidence First · no Engine rule without sample/audit/backtest.

---

## 12. Id namespace

| Prefix | Domain |
|--------|--------|
| `H-BP-*` / `H-ST-*` / `H-LU-*` … | Prediction Research (existing) |
| `MI-*` | Market Intelligence (this registry) |

Do not reuse Prediction ids for market hypotheses.

---

## 13. Storage candidates (not created)

| Artifact | Role |
|----------|------|
| `MARKET_INTELLIGENCE_HYPOTHESIS_REGISTRY.md` (future ops file) | Human status summary |
| `data/research/market-intelligence/hypothesis-evidence-ledger.json` | Append-only evidence |
| Framework `ResearchHypothesisLink` | **Not extended** in this mission |

Until implementation mission: keep design docs only.

---

## 14. Remaining issues

1. No paid Historical → limited evidence sources until forward archive or HOLD lifted.
2. Market rules mostly `UNVERIFIED` → Backtest/Engine path blocked.
3. Consensus/CLV/speed formulas unset.
4. Separate ops markdown + ledger not instantiated yet (by design).
5. Must not merge into Prediction `HYPOTHESIS_REGISTRY.md` without an explicit dual-registry policy decision.
