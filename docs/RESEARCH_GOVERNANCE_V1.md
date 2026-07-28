# Research Governance & Core Principles v1

**Status:** `DOCUMENTATION_ONLY`  
**Scope:** Research philosophy, operating principles, data principles, quality principles  
**Not in this document:** Trust Score calculation, Engine/Prediction/Dataset/Framework changes, Registry implementation, new API/UI

YANG EDGE is intended to operate for **5+ years**. This document records the research governance that should remain stable across that horizon.

Related charter (compliance / public / commercial gates): [DEVELOPMENT_COMPLIANCE_CHARTER.md](./DEVELOPMENT_COMPLIANCE_CHARTER.md)

---

## 1. Mission

YANG EDGE is **not** a sports prediction website.

It is an **AI Sports Research Platform**.

The goal is not high hit rate alone.

The goal is to accumulate:

- **reproducible research**
- **verifiable Knowledge**

Hit rate matters only when it is produced under evidence, review, and clear admission rules.

---

## 2. Core Philosophy

1. **모든 경기는 연구 대상이다.**  
   Fame of the league does not decide research scope. If a game is in Betman scope (baseball / soccer / basketball / volleyball), it belongs in the research slate.

2. **신뢰할 수 없는 분석은 만들지 않는다.**  
   Incomplete data, unverified markets, or missing identity must not be dressed as confident prediction.

3. **모르면 PASS한다.**  
   When the platform cannot support a trustworthy analysis, the official action is PASS — not a forced pick.

4. **PASS도 연구 데이터다.**  
   A recorded PASS with reasons is more valuable than a silent omission or a fabricated edge.

5. **실패도 Knowledge다.**  
   Wrong predictions, blocked analyses, and missing datasets are inputs to Learning — not shame to hide.

6. **Evidence 없이 Engine 수정 금지.**  
   Engine changes require Review → Evidence → Decision. Intuition and single-slate outcomes are not enough.

7. **시간이 지날수록 프로젝트 가치가 증가해야 한다.**  
   Artifacts, audits, Knowledge, and operator discipline must compound. Disposable one-off scripts that leave no trail do not.

---

## 3. Project Assets

### Data Asset

Provider-backed schedules, identity artifacts, operator inputs, odds observations, research datasets, and audits.

**Why it matters:** Without durable, attributable data, no prediction or Knowledge claim is reproducible.

### Knowledge Asset

Structured conclusions that survive beyond a single slate: what worked, what failed, what remains unknown, and under which conditions.

**Why it matters:** Hit rate without Knowledge decays. Knowledge without evidence is folklore.

### Trust Asset

The platform’s right to be believed — by the operator first, and by any future public audience only after clearance.

**Why it matters:** Trust is earned by PASS discipline, honest missing-data labels, and refusal to invent confidence.

### Automation Asset

Scripts, builders, validators, and pipelines that make daily research repeatable without changing Engine admission.

**Why it matters:** Manual heroics do not scale for 5+ years; automation must preserve audit trails and legal boundaries.

### Operator Asset

The human who confirms Betman scope, OCR/manual inputs, starter announcements, and review gates.

**Why it matters:** Betman is not a crawlable Provider. Lawful operator confirmation is part of the system, not an afterthought.

---

## 4. Research Flow

```
Game
  ↓
Identity
  ↓
Collection
  ↓
Prediction
  ↓
Result
  ↓
Review
  ↓
Learning
  ↓
Knowledge
  ↓
Evidence
  ↓
Decision
```

After **Decision**, Engine Update may occur **only when** Decision explicitly authorizes it.

Skipping Review / Evidence / Decision and patching the Engine is prohibited.

---

## 5. Engine Rule

Engine modification **must** follow:

1. **Review**
2. **Evidence**
3. **Decision**

Forbidden:

- changing weights “by feel”
- changing Engine because today’s Prediction looked wrong
- promoting a one-day slate into a permanent rule without archiveable Evidence

Prediction output alone is never sufficient Evidence for an Engine change.

---

## 6. PASS Policy

PASS is **not** failure.

PASS is the **official state** meaning:

> We will not provide a trustworthy analysis for this game under current data and admission rules.

Rules:

- Every PASS **must** record reason codes (missing identity, missing dataset, market rule unverified, pipeline not implemented, legal block, etc.).
- PASS games remain in **Result → Review → Learning** scope.
- Hiding PASS / unmatched / blocked games from research coverage is prohibited.
- PASS must never be relabeled as an AI pick, sharp money, or “expert” recommendation.

---

## 7. Coverage Policy

Research scope (product sports):

- Baseball (야구)
- Soccer (축구)
- Basketball (농구)
- Volleyball (배구)

**Excluded:** Tennis and all other sports until an explicit operator decision and legal/data review.

**Betman rule:** Games scheduled on Betman for those four sports are research candidates. Non-famous leagues are not excluded by fame.

**Coverage goal:** Missing games → **0** (operator slate completeness).  
If analysis is impossible → **PASS**, not deletion from the slate.

Betman remains **scope input only** — not an official schedule / result / odds Provider. Crawl / login automation / hidden Betman API use remain prohibited.

---

## 8. Trust Policy

At present, YANG EDGE does **not** invent a numeric Trust Score.

Reason: insufficient Evidence to justify a calibrated score.

Allowed interim labels only:

| Label | Meaning |
|-------|---------|
| `HIGH` | Strong, reviewable Evidence for the claim |
| `MEDIUM` | Partial Evidence; usable for research with caveats |
| `LOW` | Weak Evidence; do not treat as decision-grade |
| `UNKNOWN` | Trust not assessed / insufficient basis |

Numeric Trust Score frameworks are deferred to a future document (see §12).

---

## 9. Knowledge Policy

New Knowledge is created **only when Evidence is sufficient**.

Never confuse:

| Kind | Role |
|------|------|
| **Hypothesis** | Testable claim under study |
| **Question** | Open research question |
| **Conclusion** | Evidence-backed Knowledge |

A hypothesis is not a conclusion. A question is not Knowledge.  
Registry / card systems for these distinctions are future work (§12).

---

## 10. Decision Policy

The Roadmap is shaped by **Evidence**, not impulse.

New Dataset, new Engine work, and new product features require:

- Review of current coverage / failures / PASS reasons
- Evidence that the change addresses a real gap
- An explicit Decision (and audit trail when the process matures)

“It would be cool” is not a Decision input.

---

## 11. Long-term Vision

YANG EDGE is **not** primarily a machine that must emit a Prediction every day.

It is a system that must **accumulate Knowledge every day**.

Daily Prediction is valuable when:

- Identity is matched
- Required datasets exist
- Admission rules allow it
- Result / Review / Learning can close the loop

Otherwise, the correct daily output may be PASS — with reasons — and that still advances the project.

---

## 12. Future Documents

Planned separate documents (not implemented in this pass):

| Future document | Intent |
|-----------------|--------|
| Research Trust Framework | Formal trust labels / eventual score design |
| Research Question Registry | Open questions, not conclusions |
| Missing Knowledge Registry | Known unknowns and coverage gaps |
| Engine Registry | Engine versions, admission, change history |
| Decision Archive | Evidence-backed roadmap decisions |
| Game Knowledge Card | Per-game research memory after review |
| Operator Console | Operator workflows for slate / starters / odds |
| OCR Workflow | Screenshot → draft → operator VERIFIED (never auto) |
| AI Capability Dashboard | What the platform can / cannot claim today |

Until those exist, this Governance document is the standing reference for research principles.

---

## Compliance note

This document does **not** grant public display or commercial use rights.  
Public / commercial gates remain under [DEVELOPMENT_COMPLIANCE_CHARTER.md](./DEVELOPMENT_COMPLIANCE_CHARTER.md) and per-Provider legal status.

---

**Marker:** `RESEARCH_GOVERNANCE_V1_CREATED`
