# Multi-Sport Research Boundary

YANG EDGE 연구 시스템에서 **종목 공통 뼈대**와 **MLB 전용 도메인**의 경계를 정의한다.

이 문서는 설계·운영 가이드이며, Framework 타입·Registry schema·Dataset artifact를 변경하지 않는다. 두 번째 실제 종목 Dataset이 생기기 전까지 Multi-Sport Framework 확장은 하지 않는다.

**관련 문서:** [DATASET_FRAMEWORK.md](./DATASET_FRAMEWORK.md) · [DATASET_COMMON_AUDIT.md](./DATASET_COMMON_AUDIT.md) · [PROJECT_MEMORY.md](./PROJECT_MEMORY.md) §23–§24 · [DATA_SOURCES.md](./DATA_SOURCES.md) · [HYPOTHESIS_REGISTRY.md](./HYPOTHESIS_REGISTRY.md)

**Official conclusion:** `MULTI_SPORT_RESEARCH_BOUNDARY_DEFINED`

---

## 0. Supported sports and Betman league scope

### Supported sports (closed set)

| Code | Korean | Product research status |
|------|--------|-------------------------|
| `BASEBALL` | 야구 | MLB pipeline = **active research reference** |
| `SOCCER` | 축구 | **NOT_STARTED / FUTURE_GATED** (in scope, not shipped) |
| `BASKETBALL` | 농구 | **NOT_STARTED / FUTURE_GATED** (in scope, not shipped) |
| `VOLLEYBALL` | 배구 | **NOT_STARTED / FUTURE_GATED** (in scope, not shipped) |

**Excluded:** `TENNIS` / 테니스 and all other sports. Expanding the set requires an explicit operator decision plus legal/data review ([PROJECT_MEMORY.md](./PROJECT_MEMORY.md) §24).

### League scope (Betman-scheduled)

- Not a fixed famous-league whitelist (EPL / K League / MLB / NBA / …).
- A Betman-scheduled league — including non-major competitions (e.g. Norwegian football) — may become a **candidate** after activation gates (Betman confirmation, lawful data, ID mapping, snapshot/grade/review support, legal clearance).
- Games **not** on Betman are out of public analysis / recommendation scope.
- **Betman schedule ≠ official sports Provider API.** Match Provider calendars to Betman separately; never crawl Betman HTML, automate login, or treat Betman as a data Provider.

Common lifecycle below applies to these four sports only. Sport-specific payloads stay independent.

---

## 1. Common research lifecycle (sport-agnostic)

다음 절차는 종목과 무관하게 **보존**한다. MLB에서 이미 구현된 단계는 예시로만 언급하며, 다른 종목에 동일한 script 이름을 강제하지 않는다.

| Phase | Purpose | MLB example (reference only) |
|-------|---------|------------------------------|
| Hypothesis registration | `H-*` 가설을 Registry·Ledger에 등록; 상태 승격은 수동 | `HYPOTHESIS_REGISTRY.md`, `hypothesis-evidence-ledger.json` |
| Legal & data feasibility | 수집·저장·상업 이용 가능 여부 확인 | `INTERNAL_RESEARCH_ONLY`, API policy in `PROJECT_MEMORY` §14–15 |
| Pre-game snapshot freeze | 예측 당시 필드 동결; human gate | `save-mlb-research-prediction-snapshot.ts` |
| Automated grading | 불변 필드 유지, 결과 필드만 갱신 | `grade-mlb-research-predictions.ts` |
| Success / Failure review | 사후 흐름 분류; 원인 단정 금지 | `{date}-review.json`, flow review artifacts |
| Input / leakage / reproducibility audit | 누수·재현성·hash 검증 | Dataset audits, bullpen warm re-run, starter cutoff counters |
| Evidence & contradiction accumulation | 가설별 supporting/contradicting event 누적 | `hypothesis-evidence-ledger.json`, `contradiction-ledger-v1.json` |
| Coverage & sample check | 표본 수·registry·ledger 정합 | `dataset-coverage-dashboard-v1.json` |
| Backtest | Engine 전 게이트; 시장·기간별 별도 검증 | `PROJECT_MEMORY` §12 |
| Engine admission review | 종목·변수별 승인; 기본 `PROHIBITED` | Registry `engineAdmission`, Framework guards |

**원칙:** 생명주기 **순서와 감사 의무**는 공통이나, 각 단계의 **payload·분류 체계·API**는 종목별로 독립한다.

---

## 2. Common metadata candidates (documented only)

아래는 현재 MLB Starter / Bullpen / Lineup / Prediction / Coverage Dashboard에서 **실제로 반복 사용**되는 메타데이터 후보다. Framework에 **새 필드를 추가하지 않는다.** 문서상 계약 후보이며, 종목마다 필수는 아니다.

| Candidate | Typical location | MLB in use | Notes |
|-----------|------------------|:------------:|-------|
| `sport` | implicit via `league` / path | partial | Often implied (`mlb/` prefix); not a universal JSON field today |
| `league` | Framework metadata, predictions | yes | `ResearchLeagueScope` includes `MLB`; not all sports mapped yet |
| `gameId` | predictions, reviews, datasets | yes | Internal id e.g. `mlb-179589` |
| `gameDate` / `dateKst` | artifacts, meta | yes | KST slate date |
| `generatedAt` | meta on all research JSON | yes | ISO timestamp |
| `cutoffTime` | starter rows, pre-game freeze | yes (starter) | Entity-level as-of; not all domains |
| `collectionPhase` | lineup pre/post-game | yes (lineup) | e.g. post-game actual only in v1 |
| `datasetStatus` | Registry, artifact meta | yes | `COLLECTING`, `NOT_STARTED`, … |
| `schemaVersion` | Registry, artifact meta | yes | Per-dataset schema id |
| `builderVersion` | Registry, artifact meta | yes | Classifier/builder id |
| `researchOnly` | predictions, reviews, datasets | yes | Default true for research artifacts |
| `legalStatus` / `legal` | Framework metadata, reviews | yes | `INTERNAL_RESEARCH_ONLY`, source labels |
| `inputHash` / `inputHashSha256` | bullpen dataset (local) | partial | Bullpen fixes review hashes; Starter uses local hash |
| `resultHash` / `resultHashSha256` | dataset meta, audits | yes | Reproducibility gate |
| `hypothesisIds` | Registry, ledger | yes | `H-BP-*`, `H-ST-*`, `H-LU-*` |
| `engineAdmission` | Registry, ledger, dashboard | yes | Default `PROHIBITED` |
| `cacheUsage` | bullpen/starter artifacts | yes | raw/derived hit, `networkCalls` |
| `warnings` / missing state | reviews, field availability | yes | Viewer `COLLECTED` / `NOT_COLLECTED` / `AWAITING_RESEARCH` |

**Not forced globally:** `gamePk`, `probableStatus`, `primaryRole`, `battingOrder`, `joinQuality` — MLB domain only (see §3).

---

## 3. MLB-specific domain (not imposed on common Framework)

다음은 MLB 연구에서만 사용·의미가 있으며, **공통 Framework 계약으로 강제하지 않는다.**

| Domain | Examples in codebase | Framework relationship |
|--------|----------------------|------------------------|
| Starting pitcher | probable freeze, `postGameReview`, QS-adjacent stats | Starter builder independent; adapter maps metadata only |
| Bullpen role | CLOSER, SETUP, HL, UNKNOWN, roleScores | Classifier in `src/lib/mlb/*`; not in Framework types |
| Batting lineup / order | `battingOrder`, post-game actual nine | Lineup dataset v1; no Lineup Score |
| `gamePk` | MLB Stats API schedule/boxscore | Research cache only; not universal `gameId` |
| Probable pitcher | `PROBABLE_ONLY`, starter accumulation | Starter-specific |
| Pitcher ERA / WHIP / recent starts | starter `seasonStats`, `recentStarts` | As-of cutoff rules are starter-local |
| Closer / setup / high-leverage | bullpen role vocabulary | Frozen v1.1 classifier output |
| MLB Stats API cache layout | `data/cache/research/mlb/raw`, `derived/{domain}` | Path convention for MLB; not mandated for other sports |
| Baseball-specific review verdicts | `BULLPEN_FAILURE`, `STARTER_ADVANTAGE_REALIZED`, `ROLE_STRUCTURE_*` | Flow review scripts; not shared taxonomy |

**Evidence from audit:** Bullpen·Starter domain builders import `src/lib/research` **0** — Framework removal must not break collectors (`DATASET_COMMON_AUDIT.md`).

---

## 4. Future sport-specific domains (conceptual only)

지원 종목 중 **비-MLB** 영역. 실제 Dataset·schema·builder **없음** (`NOT_STARTED` / `FUTURE_GATED`). 확정 schema가 아니다. 해당 종목의 첫 artifact가 생긴 뒤에만 구체화한다. MLB schema에 강제하지 않는다.

### Soccer / 축구 (conceptual)

- Draw (무승부), formation, starting XI, substitutions, injuries, tactical matchup — **not defined as YANG EDGE fields today**

### Basketball / 농구 (conceptual)

- Starting five, rotation, minutes, back-to-back, pace / quarters — **not defined as YANG EDGE fields today**

### Volleyball / 배구 (conceptual)

- Sets, rotations, side-out scoring, libero — **not defined as YANG EDGE fields today**

### Explicitly out of scope

- Tennis and other non-supported sports — do not draft conceptual schemas here.

**금지:** 위 항목을 `ResearchDatasetBase` payload나 Registry에 placeholder로 넣지 않는다.

---

## 5. Abstraction principles

| Rule | Rationale |
|------|-----------|
| **No Multi-Sport Framework extension** until a second sport’s real Dataset artifact exists | Avoid designing for imaginary payloads |
| **Do not generalize MLB payload** into a generic “sport payload” | MLB fields are not universal |
| **Extract common structure only after repetition across ≥2 real sports** | e.g. `resultHash` pattern repeated in MLB bullpen + starter; not `primaryRole` |
| **Per-sport Dataset builders run independently** | No required import from Framework runtime |
| **Framework removable** | Removing `src/lib/research` registry must not prevent `build-mlb-*` scripts from running |
| **Engine admission per sport** | Each sport/variable passes its own backtest + admission review; no cross-sport auto-approve |

**Trigger for Multi-Sport extraction (see ROADMAP):**

1. First non-MLB research Dataset implemented (real JSON + audit).
2. MLB vs new sport **common / different** audit (same method as `DATASET_COMMON_AUDIT.md`).
3. Promote to Framework **only** fields/patterns repeated in both — not MLB-only fields.

---

## 6. ID and Viewer boundaries

### Identifiers

| Id | Role |
|----|------|
| **Internal `gameId`** | YANG EDGE canonical key in predictions, reviews, ledger (`mlb-*` today) |
| **Provider `externalId`** | API-BASEBALL / Stats API ids; mapping layer; not substituted for `gameId` in artifacts |

Other sports may use their own provider ids; the contract is **one stable internal game key** + optional external refs — not “always `gamePk`”.

### Research Analysis Viewer (`/analysis/[gameId]`)

**Common shell (sport-agnostic intent):**

- Match / schedule context
- Pre-game snapshot summary (if frozen)
- Result and grading status
- Success / Failure review availability
- Research status (`COLLECTED` / `PARTIAL` / `AWAITING_RESEARCH`)
- Technical metadata (collapsible)

**MLB-specific cards (optional, not mandatory for all sports):**

- Starter dataset section
- Bullpen role section
- Lineup section

**Rule:** Viewer must **not** require Starter / Bullpen / Lineup cards for every sport. New sports add **their own** optional sections when artifacts exist; common UI stays at lifecycle + status level.

Loader reference: `src/lib/research/load-research-analysis-view.ts` (MLB paths today; not a multi-sport abstraction).

---

## 7. What stays in Research Framework v1 (unchanged)

문서화 목적상, 현재 Framework가 **실제로** 담당하는 범위만 나열한다. 구조 변경 없음.

- Dataset Registry (`registry.ts` / `registry.json`) — registration, status, hypothesis links
- Metadata **adapters** (e.g. `bullpenV11FrameworkMetadata`, `starterV1FrameworkMetadata`, `lineupV1FrameworkMetadata`) — mapping only, no domain execution
- Hypothesis link types, evidence ledger schema (human + JSON)
- Hash / audit **shells** (domain builders may use local hash instead)
- Engine admission default `PROHIBITED`

**Not in Framework:** grading logic, flow review classifiers, bullpen role classifier, starter probable freeze, lineup builder, prediction Engine.

---

## 8. Current MLB pipeline (reference boundary)

MLB npm research aliases (`research:postgame`, `research:starter`, `research:bullpen-validate`, …) orchestrate **MLB scripts only**. They illustrate the common lifecycle for one sport; they are not a multi-sport scheduler.

Coverage Dashboard and Hypothesis Registry are **sport-neutral containers** that currently **hold MLB rows** (`mlb-starter`, `mlb-bullpen-role`, `mlb-lineup`).

---

## 9. Regression

| Check | Status |
|-------|--------|
| Code changes | 0 (this document pass) |
| Framework / Registry / MLB Dataset | unchanged |
| Engine | unchanged |
| Forces MLB fields as global contract | no |
| Multi-sport abstraction before 2nd sport | explicitly forbidden |

---

## Official conclusion

`MULTI_SPORT_RESEARCH_BOUNDARY_DEFINED`
