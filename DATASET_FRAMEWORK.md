# Research Dataset Framework v1

공통 연구 Dataset 계약. Bullpen, Starter, Weather, Travel 등이 동일한 metadata · hash · audit · scorecard · hypothesis 연계를 사용한다.

**Multi-sport boundary (MLB vs future sports, no schema change):** [MULTI_SPORT_RESEARCH_BOUNDARY.md](./MULTI_SPORT_RESEARCH_BOUNDARY.md)

```text
Engine 연결: PROHIBITED (기본)
적중률만으로 VALIDATED/PROMISING 승격 금지
prediction snapshot / hash 불변
```

---

## 1. Structure

```text
src/lib/research/
  types.ts          ResearchDatasetBase, Metadata, Status, VersionPolicy
  hash.ts           stable stringify + result/input hash
  audit.ts          ResearchAuditReport shell
  scorecard.ts      Variable Scorecard shell
  hypothesis.ts     Hypothesis Registry link types + PROMISING guard
  registry.ts       Dataset Registry + Bullpen v1.1 adapter example
  index.ts          public exports

data/research/registry.json   frozen registry snapshot (optional mirror)

DATASET_FRAMEWORK.md          this document
HYPOTHESIS_REGISTRY.md        human-readable hypotheses
```

---

## 2. Dataset Status

| Status | Meaning |
|--------|---------|
| `NOT_STARTED` | Registered placeholder, no builder |
| `COLLECTING` | Actively accumulating audited samples |
| `PROMISING` | Stable pre-game signal — **requires large sample**, not 14 games |
| `VALIDATED` | Passed scorecard + backtest gates (still not auto Engine) |
| `WEAK` | Signal unstable or contradicted |
| `REJECTED` | Falsified / abandoned |
| `SUPERSEDED` | Replaced by newer schema/builder |
| `ARCHIVED` | Kept for reproducibility only |

Hypothesis `currentStatus` (UNTESTED / COLLECTING / …) is separate from Dataset status.

---

## 3. Version Policy

| Field | Role |
|-------|------|
| `frameworkVersion` | Framework contract (`research-framework-v1`) |
| `schemaVersion` | On-disk JSON schema |
| `builderVersion` | Classifier/builder logic id |
| `compatibility` | `backward-compatible` \| `breaking` \| `experimental` |

Rules:

1. Breaking schema → bump `schemaVersion` major segment and keep prior artifacts read-only.
2. Logic change without schema break → bump `builderVersion`; re-audit; new `resultHash`.
3. Do not overwrite prior dated artifacts; write `…-vN.json` or new `dateKst` file.
4. Framework bump is independent of domain builders.

---

## 4. Hash Interface

```ts
import {
  buildResearchResultHash,
  buildResearchInputHash,
  verifyResearchHash,
} from "@/lib/research";

const resultHash = buildResearchResultHash({
  frameworkVersion: "research-framework-v1",
  datasetId: "mlb-bullpen-role",
  schemaVersion: "mlb-bullpen-role-dataset-v1.1",
  builderVersion: "bullpen-role-classifier-v1.1",
  body: deterministicPayload, // no generatedAt
});
```

Re-run with same raw/derived inputs must yield the same `resultHash`.

---

## 5. Audit Interface

Use `createResearchAuditShell` then attach domain checks:

- total rows / unique entities
- min-sample violations
- cache hit/miss
- network calls
- result hash + rerun match
- leakage = 0
- `engineConnected: false`
- `predictionSnapshotsUntouched: true`

---

## 6. Scorecard Interface

`ResearchVariableScorecard`:

- sample vs `minimumSampleTarget`
- leakage / reproducibility / legal / pre-game-only
- `verdict` with `autoApply: false` always
- `engineAdmission` default `PROHIBITED`

Fill only after audited multi-day samples.

---

## 7. Hypothesis Registry Link

Each dataset lists `hypothesisIds`. Rows follow `ResearchHypothesisLink`.

`assertHypothesisStatusGuard` forces `COLLECTING` if graded games &lt; 100 when status is PROMISING / READY_FOR_BACKTEST.

---

## 8. Registry Example

```ts
import {
  RESEARCH_DATASET_REGISTRY,
  getRegistryEntry,
  bullpenV11FrameworkMetadata,
} from "@/lib/research";

getRegistryEntry("mlb-bullpen-role");
// → COLLECTING, builder bullpen-role-classifier-v1.1, engineAdmission PROHIBITED

bullpenV11FrameworkMetadata();
// → ResearchDatasetMetadata pointing at existing v1.1 artifacts (no re-classify)
```

Static mirror: `data/research/registry.json`.

---

## 9. How to extend (e.g. Weather)

1. Add registry row with `status: NOT_STARTED`.
2. Define `schemaVersion` / `builderVersion` constants in domain module (`src/lib/mlb/weather-…`), **not** in Engine.
3. Emit `ResearchDatasetBase<WeatherPayload>` with Framework `meta`.
4. Write audit via `createResearchAuditShell`.
5. Register hypotheses in `HYPOTHESIS_REGISTRY.md` + link IDs.
6. Keep `engineAdmission: PROHIBITED` until full admission process.

Do **not** implement Starter/Weather/Travel builders in the Framework PR itself.

---

## 10. Connecting Bullpen v1.1 (adapter only)

Bullpen classifier code stays in `src/lib/mlb/classify-bullpen-role.ts` etc.

Framework connection:

1. Registry entry `mlb-bullpen-role` → existing artifact paths.
2. `bullpenV11FrameworkMetadata()` builds Framework metadata.
3. Future builds may wrap output `meta` with Framework fields **without** changing role scores.
4. Hypotheses `H-BP-ROLE-001`…`005` remain linked.

```text
┌─────────────────────┐
│ Research Framework  │
│ types/hash/audit/…  │
└─────────┬───────────┘
          │ registry + metadata adapter
          ▼
┌─────────────────────┐     artifacts
│ Bullpen v1.1 builder│ ──► data/research/mlb/*-v1_1.json
│ (unchanged logic)   │ ──► data/audits/*-v1_1-audit.json
└─────────────────────┘
          ✕
     EDGE Engine (forbidden)
```

---

## 11. Prohibitions

- Engine / weights / recommendation / Confidence / EDGE / Value Edge changes
- Prediction snapshot mutation
- SportsDataIO Scrambled
- MLB HTML crawling
- Public/commercial runtime wiring of `INTERNAL_RESEARCH_ONLY` sources
- Promoting Dataset to VALIDATED from a single slate
