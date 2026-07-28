# Market Intelligence Research Design

Companion design to [MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDIT_V1.md](./MULTI_SPORT_HISTORICAL_ODDS_COVERAGE_AUDIT_V1.md).

**Status:** Design only. No Dataset Builder, Registry, Framework, Prediction, or Engine changes.

**Charter:** [docs/DEVELOPMENT_COMPLIANCE_CHARTER.md](./docs/DEVELOPMENT_COMPLIANCE_CHARTER.md)

**Timeline schema pre-design:** [HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md](./HISTORICAL_ODDS_TIMELINE_DATASET_V1_DESIGN.md) · [MARKET_MOVEMENT_SEMANTICS_V1.md](./MARKET_MOVEMENT_SEMANTICS_V1.md)  
**MLB h2h probe:** [MLB_H2H_HISTORICAL_ODDS_PROBE_V1.md](./MLB_H2H_HISTORICAL_ODDS_PROBE_V1.md) (`PLAN_BLOCKED` on free plan)  
**Hypothesis Registry (MI):** [MARKET_INTELLIGENCE_HYPOTHESIS_REGISTRY_V1.md](./MARKET_INTELLIGENCE_HYPOTHESIS_REGISTRY_V1.md) · [MARKET_INTELLIGENCE_RESEARCH_WORKFLOW.md](./MARKET_INTELLIGENCE_RESEARCH_WORKFLOW.md) — separate from Prediction [HYPOTHESIS_REGISTRY.md](./HYPOTHESIS_REGISTRY.md)

---

## 1. Purpose

Investigate whether **reproducible** relationships exist between:

- overseas market snapshots over time, and
- actual game results,

**without** claiming that line movement causes wins.

Market Intelligence hypotheses live in a **separate** registry from Prediction Research and must not directly influence Prediction/Engine.

Domestic proto odds stay under operator/OCR policy; they are not assumed to have a Historical Provider.

---

## 2. Historical odds row candidate (not implemented)

| Field | Notes |
|-------|-------|
| sport | BASEBALL / SOCCER / BASKETBALL / VOLLEYBALL |
| league | Product league label |
| gameId | Internal research id |
| providerGameId | Provider event id |
| marketType | e.g. h2h, spreads, totals |
| period | FULL / 1H / SET / … (sport-specific) |
| line | Handicap / total line when applicable |
| snapshotTime | Provider snapshot timestamp |
| scheduledStartTimeAtSnapshot | Commence time as known at snapshot |
| provider | e.g. THE_ODDS_API |
| region | us / uk / eu / au / … |
| bookmaker | Bookmaker key |
| selectionCode | HOME / AWAY / DRAW / OVER / UNDER / … |
| oddsDecimal | Decimal price |
| marketRuleStatus | VERIFIED / PARTIAL / UNVERIFIED / CONFLICTING / UNKNOWN |
| collectionPhase | PRE_GAME_MARKET only for prediction research |
| sourceTimestamp | Ingest time |
| legalStatus | INTERNAL_RESEARCH_ONLY until cleared |
| inputHash / resultHash | Reproducibility |
| warnings / missing | Required |

---

## 3. Odds timeline candidate (not implemented)

Per game:

| Field | Notes |
|-------|-------|
| openingSnapshot | Research-defined first usable pre-game snapshot |
| timelineSnapshots | Ordered intermediate snapshots |
| latestPreGameSnapshot | Last snapshot with `snapshotTime < start` |
| closingCandidateSnapshot | Alias of latest pre-game — **not** official Closing |
| snapshotCount | Count |
| firstSnapshotAt / lastPreGameSnapshotAt | Bounds |
| movementCount | Reserved — **do not compute in audit phase** |
| bookmakerCount | Distinct books observed |

**Hard rule:** POST_START / POST_GAME snapshots never enter PRE_GAME Prediction features.

---

## 4. Timing vocabulary

| Label | Definition |
|-------|------------|
| OPENING | First retained pre-game snapshot |
| INTERMEDIATE | Between opening and latest pre-game |
| LATEST_PRE_GAME | Last snapshot before scheduled start |
| CLOSING_CANDIDATE | Same as latest pre-game when no official Closing exists |
| POST_START | After commence — leakage risk |
| POST_GAME | After final |

Do not invent “CLOSING” as a provider fact unless the provider documents it.

---

## 5. Future line-movement research candidates (labels only)

Hypothesis / taxonomy **candidates** — not facts, not registered hypotheses in this mission:

- ODDS_SHORTENING
- ODDS_DRIFTING
- FAVORITE_FLIP
- UNDERDOG_TO_FAVORITE
- REVERSAL
- LATE_MOVE
- EARLY_MOVE
- CONSENSUS_MOVE
- BOOKMAKER_DIVERGENCE
- STEAM_MOVE_CANDIDATE
- REVERSE_LINE_MOVEMENT_CANDIDATE

Do not treat these terms as verified edges. No Engine weight mapping.

---

## 6. Result-join research possibilities (no calculations now)

Structural joins that **may** become research later:

1. Odds band → observed win rate
2. Opening → Latest direction → outcomes
3. Move magnitude bands → outcomes
4. Favorite / underdog flips → outcomes
5. Domestic vs overseas difference (only when domestic rights + market rules verified)
6. Bookmaker consensus vs result
7. Prediction probability vs market probability
8. Closing Line Value **candidate** (using CLOSING_CANDIDATE only)
9. Starter / lineup / injury / weather co-movement with market (cutoff-safe joins only)

All require: cutoff integrity, verified market rules, licensed storage, and sample thresholds.

---

## 7. Compliance gates before any Builder

From Charter + coverage audit:

1. LEGAL_GATE
2. LICENSE_GATE
3. CACHE_GATE
4. REDISTRIBUTION_GATE
5. COST_GATE
6. DATA_QUALITY_GATE
7. MARKET_RULE_GATE

If any gate fails → Historical Odds Builder not recommended.

---

## 8. Recommended next step

**MLB h2h Historical Coverage Probe** (minimal paid Historical calls, documentation-only expansion of verification statuses).

Not next: multi-sport season download, volleyball Odds API assumption, Closing-as-fact, Engine admission.
