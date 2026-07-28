# YANG EDGE Project Roadmap v2

**Status:** `DOCUMENTATION_ONLY` — direction & phase planning  
**Perspective:** AI Sports Research Platform (not a prediction-site product plan)  
**Companion:** [RESEARCH_GOVERNANCE_V1.md](./RESEARCH_GOVERNANCE_V1.md) · code inventory: [ROADMAP.md](../ROADMAP.md)

This document reorganizes confirmed project direction. It does **not** implement Operator Console, OCR, Soccer full pipeline, Trust scoring, new Dataset/Engine/API/UI, or Registries.

---

## 1. Vision

YANG EDGE is an **AI Sports Research Platform**.

**Prediction is not the purpose.**  
Prediction is a **result of Research** — produced only when Identity, Collection, admission rules, and Evidence allow it.

The project goal is to accumulate **Evidence** so that better decisions follow:

- which games to analyze or PASS
- which datasets to build next
- when (and whether) to change the Engine
- when a public product claim is honest enough to ship

---

## 2. Core Pillars

### ① Research

Identity → Collection → Prediction (or PASS) → Result → Review → Learning.  
Every Betman-scoped baseball / soccer / basketball / volleyball game is a research candidate.

### ② Trust

Refuse untrustworthy analysis. Prefer PASS with reasons over fabricated confidence.  
No numeric Trust Score until Evidence supports it (labels only: HIGH / MEDIUM / LOW / UNKNOWN).

### ③ Knowledge

Hypotheses, questions, and conclusions must stay distinct.  
Knowledge grows from Review + Evidence — not from a single day’s pick list.

### ④ Automation

Scripts and pipelines compound operator capacity.  
Automation proposes and prepares; it does not silently change Engine admission or invent verified facts.

### ⑤ Product

Public UX exists to explain verified research — not to sell unverified picks.  
Product layers open only after Research Core, Governance, and legal gates allow it.

---

## 3. Project Layers

### Layer 1 — Research Core

The durable research loop:

| Component | Role |
|-----------|------|
| Identity | Stable game / team identity from lawful Providers |
| Dataset | Research datasets with cutoff and audit |
| Prediction | Snapshot when admitted — never forced |
| Review | Post-game grade / flow / contradiction review |
| Learning | Feedback that updates research memory |
| Evidence | Archiveable basis for decisions |
| Governance | Principles that outlive any single feature |

### Layer 2 — Research Director Console

Operator-facing system (future):

- slate / inbox / approval without repetitive busywork
- AI proposes; operator judges and approves
- **Not implemented in this roadmap pass**

### Layer 3 — Public Product

User-facing site:

- schedules, explanations, and only cleared research claims
- membership / public accuracy claims remain FUTURE_GATED
- **Design-stage relative to Research Core**

---

## 4. Current Status

| Area | Status |
|------|--------|
| Research Core | **Nearly complete** (MLB research loop active; KBO identity / operator inputs / multi-sport slate coverage progressing) |
| Governance | **Complete** (v1 principles documented) |
| Dataset | **In progress** (MLB datasets active; non-MLB datasets gated / partial) |
| Operator Console | **Design stage** |
| Product UX | **Design stage** (public prototype + labeled samples; not research-grade product open) |
| OCR | **Planned** (operator-reviewed only; never auto-VERIFIED) |
| Soccer Pipeline | **Planned** |
| Basketball | **Planned** |
| Volleyball | **Planned** |

Code-level “what works today” remains in [ROADMAP.md](../ROADMAP.md). This v2 document is the **direction** map.

---

## 5. Operator Philosophy

Operators do **not** perform endless repetitive work.

- **AI proposes** tasks, drafts, and candidates.
- Operators perform **judgment and approval**.
- Unverified OCR / crawl / invented IDs never become VERIFIED by automation alone.

---

## 6. AI Philosophy

AI does **not** grow by itself.

Required sequence:

```
Review
  ↓
Evidence
  ↓
Proposal
  ↓
Approval
  ↓
Release
```

AI must **not** modify the Engine without Evidence and Approval.  
Feelings and single Prediction outcomes are not Release criteria.

---

## 7. Research Asset

The same asset classes as Governance v1:

| Asset | Meaning |
|-------|---------|
| **Data Asset** | Provider + operator artifacts with provenance |
| **Knowledge Asset** | Evidence-backed conclusions and structured unknowns |
| **Trust Asset** | Right to be believed — earned by PASS discipline |
| **Automation Asset** | Repeatable pipelines with audits |
| **Operator Asset** | Human confirmation and admission gates |

---

## 8. Weekly KPI

Check weekly (direction metrics — not a dashboard build in this pass):

| KPI | Intent |
|-----|--------|
| **Coverage** | Betman slate games accounted for (missing → 0 goal) |
| **PASS** | Honest non-analysis rate with reasons recorded |
| **Unknown** | Gaps still unlabeled or unresolved |
| **Review Completion** | Post-game / research reviews closed |
| **Knowledge Growth** | New Evidence-backed Knowledge (not raw pick count) |
| **Operator Time** | Hours spent on judgment vs busywork |

---

## 9. Development Principle

1. Prefer **new Knowledge** over new features.  
2. Prefer **operator efficiency** over new screens.  
3. Prefer **Evidence** over AI spectacle.

If a change does not improve Research, Trust, Knowledge, Automation, or lawful Product readiness — it waits.

---

## 10. Next Phases

| Phase | Name | Status |
|------:|------|--------|
| 1 | Research Framework | **Completed** |
| 2 | Governance | **Completed** |
| 3 | Research Director Console | **Next** |
| 4 | OCR Automation | Planned |
| 5 | Soccer Full Pipeline | Planned |
| 6 | Multi Sport Expansion | Planned |
| 7 | Public Open Beta | Planned (legal + Evidence gated) |

**Next recommended work:** Phase 3 — Research Director Console (design → minimal operator loop).  
Do **not** skip to Public Open Beta or Engine rewrites without Evidence.

---

## 11. Future Vision

Long-term, YANG EDGE aims to be a platform that does not merely **use** AI,

but **researches**, **validates**, and **grows** AI under Review → Evidence → Proposal → Approval → Release.

Daily Prediction may occur.  
Daily **Knowledge accumulation** must occur.

---

## Document roles

| Document | Role |
|----------|------|
| [PROJECT_ROADMAP_V2.md](./PROJECT_ROADMAP_V2.md) | Direction & phases (this file) |
| [ROADMAP.md](../ROADMAP.md) | Code-backed status inventory |
| [RESEARCH_GOVERNANCE_V1.md](./RESEARCH_GOVERNANCE_V1.md) | Standing research principles |
| [DEVELOPMENT_COMPLIANCE_CHARTER.md](./DEVELOPMENT_COMPLIANCE_CHARTER.md) | Legal / public / commercial gates |

---

**Marker:** `PROJECT_ROADMAP_V2_CREATED`
