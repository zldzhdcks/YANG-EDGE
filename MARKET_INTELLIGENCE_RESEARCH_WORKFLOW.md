# Market Intelligence Research Workflow

Companion to [MARKET_INTELLIGENCE_HYPOTHESIS_REGISTRY_V1.md](./MARKET_INTELLIGENCE_HYPOTHESIS_REGISTRY_V1.md).

**Status:** Design only. No automation, Builder, or Engine wiring.

---

## 1. Two research tracks

```text
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   Prediction Research       │     │  Market Intelligence        │
│   (game / prediction)       │     │  (market / odds)            │
│   HYPOTHESIS_REGISTRY.md    │     │  MI Hypothesis Registry     │
└──────────────┬──────────────┘     └──────────────┬──────────────┘
               │                                   │
               │         no direct influence       │
               └────────────────╳──────────────────┘
```

Operators may **read** both for human insight. Systems must not couple them.

---

## 2. Day-to-day MI loop

1. **Idea** — write `MI-*` hypothesis in price/market language.
2. **Collect** — cite Timeline / operator / live snapshot evidence (append-only).
3. **Grade** — only with market-specific grading contract + cutoff integrity.
4. **Count** — update sample/worked/failed/pending/void (measurable only).
5. **Review** — human status change only (no auto promotion).
6. **Reject or continue** — never delete rejected hypotheses.
7. **Engine path** — only after explicit multi-gate approval; still no autoApply.

---

## 3. What to write vs forbid

### Write

- observed odds/line changes
- bookmaker disagreement metrics
- pre-declared expectedDirection vs graded outcome
- missing/void reasons
- license/legal warnings on evidence

### Forbid

- “this move means higher win probability”
- Steam / Sharp / smart-money as facts
- Confidence / Importance / Weight scores
- Editing Historical raw timelines from the registry
- Auto-promoting status at 100/500/1000 samples

---

## 4. Data dependencies

| Dependency | MI use |
|------------|--------|
| Historical Odds Timeline Dataset | Read-only evidence source (when available) |
| Live / forward odds archive | Read-only until Historical paid path exists |
| Operator domestic markets | Separate `sourceType`; DRAFT excluded |
| Prediction snapshot | Optional read-only for CLV decision time |
| Game result identity | Outcome join via market contract |

---

## 5. Relation to dashboards

Engine Admission / Research Quality dashboards (existing Prediction research ops) are **patterns** for gates and sample honesty.

MI gets its own future dashboard rows only after registry ops artifacts exist — **not** by silently folding `MI-*` into Prediction dashboard metrics.

---

## 6. Compliance checklist before any MI Engine mention

- [ ] `researchOnly=true`
- [ ] `engineAdmission=PROHIBITED` unless separately cleared
- [ ] market rules VERIFIED for the tested market
- [ ] sample target met (100/500/1000 as chosen)
- [ ] backtest artifact exists
- [ ] no POST_START leakage
- [ ] legal/license/cache/redistribution gates reviewed for cited odds source
- [ ] Prediction Engine still does not import MI registry
