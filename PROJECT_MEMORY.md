# YANG EDGE PROJECT MEMORY

> **Document purpose**
>
> `PROJECT_MEMORY.md` is the shared operating constitution of YANG EDGE.
> It defines the project's philosophy, research process, Engine change policy,
> data-quality standards, legal boundaries, API policy, and development workflow.
>
> This document must be used as the default decision framework in:
>
> - New ChatGPT conversations
> - Cursor development sessions
> - Research reviews
> - QA audits
> - Backtests
> - Future team onboarding
> - Product and commercialization decisions

---

## 1. YANG EDGE Philosophy

YANG EDGE is not a project whose primary purpose is to increase short-term prediction accuracy.

YANG EDGE is a project to build a **verifiable AI prediction engine**.

A prediction is not treated as useful merely because it was correct.
A variable is not treated as valid merely because it explains one result.
An Engine change is not justified merely because recent performance was poor.

YANG EDGE operates the following research cycle:

```text
Prediction
↓
Snapshot Storage
↓
Automatic Grading
↓
Success Review
↓
Failure Review
↓
Input Audit
↓
Data Leakage Audit
↓
Hypothesis Validation
↓
Sufficient Sample Accumulation
↓
Backtest
↓
Engine Integration Review
```

The objective is not to create an AI that occasionally produces convincing answers.

The objective is to create a system in which:

- predictions are preserved,
- inputs are auditable,
- calculations are reproducible,
- success and failure are both reviewed,
- hypotheses can be rejected,
- variables can be independently evaluated,
- and Engine changes can be justified with evidence.

---

## 2. Core Research Principles

YANG EDGE prioritizes the following:

```text
1. Data Quality
2. Data Accumulation
3. Variable Validation
4. Backtesting
5. Engine Modification
```

The Engine is always the final stage.

The project must not prioritize Engine complexity over research reliability.

New features, larger models, additional weights, and more variables are not automatically progress.

A new validation method is often more valuable than a new feature.

---

## 3. Engine Change Policy

The Engine must not be modified unless all required validation conditions are satisfied.

### Required conditions

- Data Leakage Audit: `0`
- Input Audit: passed
- Same input produces the same result
- Prediction hash and source snapshot are preserved
- Sufficient sample size has been accumulated
- Backtest has passed
- Success Review has been completed
- Failure Review has been completed
- Variable Scorecard has been validated
- Data source and collection process are legally acceptable
- The change can be reproduced independently

Until these conditions are satisfied:

```text
NO_ENGINE_CHANGE
NO_WEIGHT_CHANGE
NO_RECOMMENDATION_CHANGE
NO_CONFIDENCE_CHANGE
NO_EDGE_SCORE_CHANGE
NO_VALUE_EDGE_CHANGE
```

Engine changes must never be based on intuition, pressure, recent losses, or a small number of games.

---

## 4. Actions We Never Take

YANG EDGE never changes any of the following based on one game or a small sample:

- Engine logic
- Weights
- Recommendation rules
- Confidence
- EDGE Score
- Value Edge
- Pick thresholds
- Market interpretation rules
- Variable importance
- Sport-specific adjustments

A single result may create a research question.

A single result must never create an Engine change.

---

## 5. New Variable Admission Process

Every new variable must pass the full admission process below.

```text
Hypothesis Registration
↓
Data Availability Check
↓
Legal and Terms-of-Use Review
↓
Collection of at Least 100 Games
↓
Success Review
↓
Failure Review
↓
Backtest
↓
Variable Scorecard Creation
↓
Validation on at Least Several Hundred Games
↓
Engine Integration Review
↓
Final Application
```

A variable that has not passed this process must not be connected to the Engine.

### Minimum interpretation standard

The first 100 games are for:

- pipeline verification,
- missing-data discovery,
- schema validation,
- basic directional analysis,
- and early failure detection.

They are not sufficient for final Engine integration.

Final Engine integration requires at least several hundred games and may require substantially more depending on:

- effect size,
- missing-data rate,
- league differences,
- season effects,
- interaction with other variables,
- market type,
- and instability over time.

---

## 6. Hypothesis Registry Policy

All research variables must begin as registered hypotheses.

Each hypothesis should include:

```text
Hypothesis ID
Variable Name
Research Question
Expected Direction
Pre-game Data Availability
Source
Legal Status
Collection Window
Minimum Sample
Success Criteria
Failure Criteria
Confounding Risks
Leakage Risks
Backtest Plan
Current Status
```

Recommended status values:

```text
PROPOSED
LEGAL_REVIEW
DATA_COLLECTION
DATA_QUALITY_WARNING
READY_FOR_REVIEW
BACKTESTING
REJECTED
INCONCLUSIVE
VALIDATED
ENGINE_REVIEW
APPROVED
```

A hypothesis may be rejected.

Rejection is considered a valid research result.

---

## 7. Variable Scorecard Policy

Every variable must have its own scorecard.

The scorecard should evaluate at least:

- sample size,
- missing-data rate,
- data freshness,
- data-source stability,
- leakage risk,
- reproducibility,
- univariate explanatory power,
- pre-game predictive power,
- false positive rate,
- false negative rate,
- success-case behavior,
- failure-case behavior,
- league consistency,
- season consistency,
- interaction risk,
- backtest result,
- legal usability,
- Engine integration status.

A variable must not be judged only by whether it helped explain failed games.

Post-game explanatory power and pre-game predictive power are different.

---

## 8. MLB Research Status

The current MLB system is not a formal recommendation product.

It is a **Research Pipeline**.

The correct sequence is:

```text
Research
↓
Validation
↓
Accumulation
↓
Backtest
↓
Engine Integration
```

Current MLB predictions must be understood as research snapshots.

They do not represent a commercially validated recommendation system.

### Current official research state

```text
DATA_QUALITY_WARNINGS_ONLY
INVESTIGATE_MORE

NO_ENGINE_CHANGE
NO_WEIGHT_CHANGE
NO_RECOMMENDATION_CHANGE
```

### Current research snapshot

Date:

```text
2026-07-27
```

Status:

```text
15 MLB research snapshots stored
14 games graded
6 hits
8 misses
42.9% hit rate
1 game pending at the time of the snapshot
```

Completed research infrastructure:

- Snapshot Storage
- Automatic Grading
- Success Review
- Failure Review
- Feedback Center
- Learning Dashboard
- Input Audit
- Leakage Audit
- Market Audit
- Engine Reproduction Audit
- Bullpen Research

Audit results:

```text
Leakage: 0
Engine reproduction mismatch: 0
Market calculation error: 0
Value Edge calculation error: 0
Prediction hash preserved
```

This sample is too small to justify any Engine conclusion.

---

## 9. Success and Failure Review Principles

Successes and failures must be reviewed with equal seriousness.

### Success Review

The purpose of Success Review is to determine:

- whether the prediction was correct for the expected reason,
- whether the input advantage actually materialized,
- whether the result was robust,
- whether luck dominated the result,
- and whether the same logic is repeatable.

### Failure Review

The purpose of Failure Review is to determine:

- whether the input was wrong,
- whether the input was missing,
- whether the Engine interpreted the input incorrectly,
- whether the market assumption was wrong,
- whether the result was random,
- whether a hidden variable may exist,
- and whether the failure suggests a research hypothesis.

Success Review must not become confirmation bias.

Failure Review must not become post-hoc overfitting.

---

## 10. Bullpen Research Principles

Bullpen data currently shows post-game explanatory value.

However:

```text
Post-game explanatory value
does not prove
pre-game predictive value.
```

Therefore:

```text
Bullpen Engine integration is prohibited.
```

The project will continue accumulating a Bullpen Role Dataset.

The research objective is not to prove that bullpen variables are useful.

The objective is to test whether bullpen variables have stable, reproducible, pre-game predictive value.

### Current Bullpen research state

Initial simple bullpen variables included:

- recent 3-day usage,
- recent 7-day ERA,
- WHIP.

These variables showed weak explanatory power.

Current conclusion:

```text
SAMPLE_ACCUMULATION_PRIORITY
```

Bullpen Role Dataset v1:

```text
428 rows
421 unique players

CLOSER: 31
SETUP: 75
HIGH_LEVERAGE: 98
MIDDLE: 1
LONG: 110
OPENER: 5
MOP_UP: 27
UNKNOWN: 81
```

Role-based audit:

```text
Bullpen-related failed games: 6
Pre-game warnings: 5
Protected successful games: 5
Pre-game stability detections: 1
```

This result is only a research signal.

It is not sufficient for Engine integration.

---

## 11. Bullpen Classifier Audit

Bullpen Role Classifier v1 official status:

```text
MULTIPLE_ISSUES_FOUND
ENGINE_CONNECTION_PROHIBITED
```

Known issues:

- severe MIDDLE underclassification,
- LONG overclassification,
- starter slot 0 included in `avgOuts`,
- role-priority bias,
- 47 LONG classifications with fewer than 3 samples,
- excessive dependence on average outs,
- weak handling of multi-role pitchers,
- no persistent disk cache,
- 733 MLB Stats API calls in the audited run.

Required v1.1 work:

```text
1. Exclude starter slot 0
2. Redesign MIDDLE and LONG classification
3. Add minimum-sample policy
4. Review primaryRole + secondaryRoles structure
5. Add raw and derived cache layers
6. Re-evaluate the existing 14 graded games
```

v1.1 must be audited before any further interpretation.

---

## 12. Backtest Principles

A backtest must preserve the information available at the prediction time.

Backtests must not use:

- post-game statistics,
- revised lineups unavailable at snapshot time,
- final bullpen usage,
- closing information unavailable at prediction time,
- results,
- hidden future-derived labels,
- corrected data that was not available at the original snapshot time,
- manually selected favorable samples.

Every backtest should preserve:

```text
Prediction timestamp
Input timestamp
Source snapshot
Market snapshot
Engine version
Variable version
Prediction hash
Audit result
```

A backtest without point-in-time integrity is not valid.

---

## 13. Data Quality Standard

Data quality is more important than model performance.

Every dataset should be reviewed for:

- source identity,
- collection timestamp,
- event timestamp,
- timezone,
- home/away mapping,
- team identity mapping,
- player identity mapping,
- duplicates,
- missing fields,
- stale values,
- sample count,
- schema version,
- point-in-time validity,
- legal usability,
- reproducibility.

A high hit rate with poor data integrity is treated as failure.

A low hit rate with clean, reproducible data may still produce valuable research.

---

## 14. API Policy

API use must prioritize legality, licensing clarity, point-in-time reliability, and commercial usability.

Current API priority:

```text
1. API-BASEBALL
2. The Odds API
3. SportsDataIO
4. MLB Stats API
5. Other sources
```

This order is a research and sourcing priority, not automatic permission for every use case.

Every provider must still be reviewed for:

- plan limitations,
- redistribution rights,
- caching rights,
- commercial use,
- attribution,
- rate limits,
- derivative-data restrictions,
- and public display rights.

### MLB Stats API

Policy:

```text
INTERNAL_RESEARCH_ONLY
NO_PUBLIC_RUNTIME_CONNECTION
NO_COMMERCIAL_RUNTIME_CONNECTION
COMMERCIAL_USE_NOT_CONFIRMED
```

MLB Stats API data may be used only for internal research unless commercial and public-service rights are explicitly confirmed.

### SportsDataIO Scrambled Data

Policy:

```text
PERMANENTLY_PROHIBITED
```

Scrambled or obfuscated SportsDataIO data must not be used.

### Crawling

Policy:

```text
NO_UNAUTHORIZED_CRAWLING
NO_MLB_HTML_CRAWLING
NO_UNVERIFIED_REPUBLICATION
```

If legality or terms-of-use compliance is uncertain, the method is blocked until reviewed.

---

## 15. Legal and Commercialization Principles

Legal uncertainty must not be ignored for speed.

Before a dataset or API is used in a public or commercial runtime, verify:

- commercial-use rights,
- display rights,
- redistribution rights,
- caching rights,
- attribution requirements,
- derivative-data restrictions,
- user-data implications,
- and contract or plan restrictions.

Internal research permission does not automatically imply commercial permission.

Public availability does not automatically imply legal permission to crawl, store, transform, or redistribute.

When uncertainty exists:

```text
BLOCK_FIRST
VERIFY_SECOND
USE_ONLY_AFTER_CLEARANCE
```

---

## 16. Research Roadmap

Current planned research areas:

```text
Bullpen Role Classifier v1.1
Starter Dataset
Lineup Dataset
Market Movement
Weather
Travel
Rest
Umpire
Variable Scorecards
Hypothesis Registry
```

These are research candidates, not approved Engine variables.

Each must pass the New Variable Admission Process.

---

## 17. Development Workflow

YANG EDGE development always follows this order:

```text
Result Analysis
↓
Cause Discussion
↓
Devil's Advocate Review
↓
Alternative Hypothesis Review
↓
Research Direction Decision
↓
Cursor Prompt
```

The assistant must not jump directly from a result to a large architectural conclusion.

Before writing a Cursor prompt:

1. Interpret the user's result first.
2. Identify weaknesses in the current interpretation.
3. Present a Devil's Advocate counterargument.
4. Review at least one alternative hypothesis.
5. Separate work that should be done now from work that should be deferred.
6. Reach a shared research direction before implementation begins.

### Architecture and Framework Gate

Before proposing a new architecture or shared Research Framework, verify:

- At least two real use cases reveal repeated structure.
- The abstraction does not create premature overengineering.
- There is clear ROI compared with continuing the current research.
- An unstable implementation will not be frozen into a shared standard.
- A smaller experiment cannot validate the need first.

Practical rule:

> Do not extract a shared abstraction from only one unstable real-world case.

Current application of this rule:

```text
Bullpen Role Classifier v1.1
↓
Re-evaluate the existing 14 games
↓
Starter Dataset v1
↓
Bullpen vs Starter Common/Difference Audit
↓
Extract only repeated structure
↓
Minimal Research Framework v1
```

The full Research Framework remains deferred until Bullpen v1.1 and Starter Dataset v1 reveal actual repeated requirements.

### Cursor Prompt Format

Every Cursor prompt must be provided as one immediately copyable code block.

Rules:

- Explanations and judgments must remain outside the code block.
- Do not split one prompt across multiple sections or blocks.
- The code block must contain only the actual Cursor instruction.
- Keep prompts as short as practical.
- Include only:
  - objective,
  - files or areas to inspect,
  - prohibited changes,
  - implementation scope,
  - validation requirements,
  - completion report format.
- Do not include commentary that interferes with full-copy use.
- Do not propose large architecture before at least two real cases reveal repeated structure.

Cursor prompts must be written only after the research direction is agreed.

They must also:

- preserve existing snapshots,
- preserve prediction hashes,
- avoid silent schema changes,
- avoid unrelated refactoring,
- and produce an auditable completion report.

We do not begin with code.

We begin with judgment, counterargument, and evidence.

---

## 17.1 Development Session Rules

Until the project owner explicitly says:

```text
여기까지만 하자
```

the assistant must not:

- describe the workday or session as finished,
- suggest postponing the work until tomorrow,
- provide Git save, commit, or push commands,
- provide server shutdown commands.

Current conversation instructions from the project owner take precedence over older wording in this document.

---

## 18. Roles and Decision Framework

YANG EDGE development is reviewed through four simultaneous roles.

### CTO

Responsible for:

- architecture,
- priorities,
- technical debt,
- system boundaries,
- scalability,
- source strategy,
- and commercialization risk.

### AI Research Lead

Responsible for:

- hypothesis design,
- sample-size policy,
- leakage prevention,
- overfitting prevention,
- variable validation,
- and research interpretation.

### QA Lead

Responsible for:

- reproducibility,
- audit coverage,
- data integrity,
- mapping correctness,
- calculation correctness,
- regression prevention,
- and completion criteria.

### Data Scientist

Responsible for:

- success and failure patterns,
- variable scorecards,
- effect analysis,
- uncertainty,
- false positives,
- false negatives,
- subgroup behavior,
- and backtest interpretation.

No single role may override data integrity.

---

## 19. Git and Session Closure Policy

Git save, commit, push, and server shutdown commands are provided only when the project owner explicitly says:

```text
여기까지만 하자
```

Until then, development and research continue without forced session closure.

---

## 20. Final Principle

YANG EDGE does not aim to build:

> “an AI that gets predictions right.”

YANG EDGE aims to build:

> **“an AI that validates itself and improves through evidence.”**

We value new validation more than new features.

We value reproducibility more than impressive results.

We value data quality more than short-term accuracy.

We value the ability to reject a hypothesis more than the desire to prove it.

No variable enters the Engine because it sounds reasonable.

No Engine change is accepted because one result was disappointing.

Every meaningful change must leave an auditable trail.

---

## 21. Official One-Line Mission

> **YANG EDGE is a verifiable sports prediction research system that stores every prediction, audits every input, reviews every success and failure, and changes its Engine only after sufficient evidence.**

---

## 22. Product Vision and Direction (July 2026)

This section defines the product direction for July 2026. It does not override research principles in Sections 1–20. It separates **current private research** from **future public product** and blocks unverified capabilities from being documented as shipped features.

### 22.1 Product Vision

YANG EDGE is **not** a simple win/loss prediction site.

YANG EDGE aims to become an **AI sports analysis platform that explains why the AI reached its judgment** — using verified data to present reasoning, confidence, risk, market difference, and key variables in language the user can understand.

The core product UX goal is:

> **Make “why did the AI think that?” the easiest thing for the user to understand.**

This vision is compatible with the research constitution: explanations must come from auditable artifacts, not from model improvisation.

### 22.2 Product Stage Separation

```text
Current Stage:  PRIVATE_RESEARCH_PROTOTYPE
Future Stage:   PUBLIC_AI_SPORTS_ANALYSIS_PLATFORM
```

**Current stage (now):**

- Single-operator use (찬양님)
- Research data accumulation
- Research Analysis Viewer and post-game review are priorities
- MLB research pipeline, audits, and hypothesis registry are active
- Public UI may show schedules and **labeled sample** analysis only where documented

**Future stage (gated):**

- Public or paid features are **not implemented** until data, legal, sample-size, and backtest gates pass
- No membership billing, OCR product features, proto odds automation, or public accuracy marketing before clearance

### 22.3 Explanation Policy

LLM and natural-language layers must follow:

```text
NO_FACT_CREATION
NO_INFERENCE_BEYOND_ARTIFACTS
STRUCTURED_VERIFIED_DATA_ONLY
```

Rules:

- LLM must **not** invent new facts, statistics, or analysis reasons
- LLM may explain only **structured, verified data** already present in artifacts
- Missing data must be shown as **not collected**, **awaiting research**, or **not yet validated** — never guessed
- Every explanation must remain traceable to **source**, **cutoff time**, and **missing-field status**

This policy applies to future public explanation features and to any LLM-assisted copy generation for product surfaces.

### 22.4 Future Public Card Direction

Future public game cards (not current UI) may eventually include:

- Match, league, kickoff/first-pitch time
- **Validated** AI probability (only after Engine and backtest gates)
- **Validated** Confidence (definition frozen and audited)
- **Defined** Risk (from approved taxonomy)
- TODAY EDGE PICK indicator (only when pick policy is validated and legally cleared)

**Current sample/dummy stage:**

- Must **not** be presented as real recommendations
- Must retain sample/dummy labeling consistent with ROADMAP and COPY

### 22.5 Future Detail Page Direction

Future public detail pages (not current Research Viewer) may eventually include:

- Match basics
- AI prediction (validated)
- Validated market types only
- Confidence / Risk
- Value Edge (where market and Engine validation allow)
- Evidence-based AI analysis report (artifact-bound)
- Visualizations (derived from verified fields only)
- Post-game result and review

Market-specific outputs require **separate validation** before offering:

```text
Moneyline / 1X2
Handicap / Run line
Over/Under
Predicted score
```

Each market type needs its own sample, backtest, and legal review. Partial validation does not authorize presenting unvalidated markets as product features.

### 22.6 Accuracy Transparency Policy

When a public accuracy dashboard exists, YANG EDGE will **not hide** hit rates.

Rules:

- Include only **pre-stored predictions** (point-in-time snapshots), never retrofitted picks
- Always show **sample size**, **period**, **sport**, **league**, **market type**, and **pending/void** criteria alongside any rate
- **Never** use unverified example hit rates as product performance
- **Never** use hit rate as marketing before minimum sample and backtest criteria pass

Internal research snapshots (e.g. small MLB samples) are research signals, not public performance claims.

### 22.7 Membership Direction

Free / Basic / Premium are **future revenue model candidates only** — not implemented.

- Premium’s intended value is **deeper explanation of why the AI judged as it did** — not access to unvalidated analysis
- **Do not sell** unvalidated analysis as a paid feature
- Before any payment implementation: terms of service, privacy policy, refund policy, and business/tax review are **mandatory**

### 22.8 Korean Proto / Odds Policy

- **The Odds API** is a reference odds provider; terms and display rights still require per-use review
- **Korean proto (스포츠토토/프로토) odds–based Value Edge** is a **long-term candidate only**
- Until official use, storage, and redistribution rights are confirmed: **no public or commercial feature** may depend on proto odds
- Operator manual entry must record **source**, **inputTime**, **operator**, and **revision history**
- **Permanently prohibited:**

```text
NO_BETMAN_HTML_CRAWLING
NO_LOGIN_AUTOMATION
NO_HTML_PARSING_OF_BETMAN
NO_AUTOMATED_SCREEN_CAPTURE_AT_SCALE
NO_BULK_REDISTRIBUTION_OF_UNLICENSED_ODDS
NO_TREATING_BETMAN_AS_OFFICIAL_SPORTS_API
```

Betman schedule alignment for which games may enter research/public analysis is defined in §24 — it does **not** authorize crawling Betman.
### 22.9 OCR Admin Policy

OCR is a **future operator-only manual input assist candidate** — not a member feature.

- Not offered to end users
- Prefer **local processing** of images the operator lawfully possesses
- OCR output is **never auto-finalized** — operator review required before persistence
- Persist **team names**, **odds**, **round/issue number**, **input timestamp**, and **edit history**
- **Auto Engine recalculation** after OCR odds is prohibited until both **usage rights** for that odds source and **Engine validation** for that market path are complete

### 22.10 Public Safety Boundary

YANG EDGE does **not**:

- Purchase bets on behalf of users
- Broker, arrange, or automate betting purchases
- Provide automated betting execution

YANG EDGE must **not**:

- Use names, design, or copy that could be confused with official **Sports Toto** or **Betman** services
- Imply guaranteed accuracy or profit

All analysis is **reference information only**. Accuracy and profit are **not guaranteed**.

---

## 23. Multi-Sport Research Boundary (long-term)

These principles apply within the **four supported sports** (§24). They do **not** authorize immediate Framework or code changes.

```text
Preserve:     common research lifecycle (hypothesis → snapshot → grade → review → audit → evidence → coverage → backtest → engine gate)
Isolate:      per-sport dataset payload, classifiers, caches, and review taxonomies
Forbid:       multi-sport Framework extension until a second real sport Dataset exists
Extract:      shared metadata/patterns only after repetition across ≥2 implemented sports
Independence: per-sport builders must run without Framework imports; Framework removal must not break collectors
```

Full boundary specification: [MULTI_SPORT_RESEARCH_BOUNDARY.md](./MULTI_SPORT_RESEARCH_BOUNDARY.md).

---

## 24. Supported Sports and Betman (배트맨) Scope

### 24.1 Supported sports (closed set)

YANG EDGE research and future public analysis target **only** these four sports:

```text
BASEBALL     / 야구
SOCCER       / 축구
BASKETBALL   / 농구
VOLLEYBALL   / 배구
```

**Excluded** from current and long-term support unless the operator explicitly decides otherwise **and** separate legal/data review passes:

```text
TENNIS / 테니스
and all other sports (e.g. ice hockey as product scope)
```

Adding a fifth sport requires an explicit operator decision and a dedicated legal/data review. Do not treat ledger UI labels or marketing copy as expansion of this set.

### 24.2 League selection (Betman-scheduled, not fame-fixed)

- Leagues are **not** limited to a fixed list of famous competitions (EPL, K League, MLB, NBA, etc.).
- A **non-major league** (e.g. Norwegian football) may become a research candidate **if and only if** it is actually scheduled on **Betman (배트맨)** and activation gates in §24.3 pass.
- Games **not** scheduled on Betman are **out of scope** for YANG EDGE public analysis and recommendation surfaces.
- Official sports data Provider calendars and Betman schedules are **separate lists**; they may be matched, but Betman is never treated as an official sports data API.

### 24.3 Activation gates (before research enablement)

A Betman-scheduled league/game becomes an active research target only when **all** of the following hold:

1. Betman schedule presence confirmed (operator manual check or other **lawful** path)
2. Lawful schedule / result / stats data available from an approved Provider or cleared source
3. Team and league identity mapping feasible
4. Snapshot → grade → Success/Failure Review pipeline supportable for that market shape
5. Legal use scope confirmed for that source

Being a supported **sport** alone does **not** authorize Confidence, Value Edge, or Engine recommendations.

### 24.4 Meaning of “Betman scope”

`배트맨 기준` means **aligning which games YANG EDGE may analyze with Betman scheduling**.

It does **not** mean:

```text
NO_BETMAN_HTML_CRAWLING
NO_LOGIN_AUTOMATION
NO_HTML_PARSING_OF_BETMAN
NO_BULK_COPY_OF_BETMAN_PAGES
NO_TREATING_BETMAN_AS_OFFICIAL_SPORTS_API
```

Schedule confirmation uses **operator manual verification** or other **lawful, permitted** data paths. Future admin tooling should record **source**, **confirmedAt**, **operator**, and **revision history** (same discipline as proto odds manual entry).

### 24.5 Per-sport implementation status (documentation only)

| Sport | Status | Note |
|-------|--------|------|
| Baseball (MLB research) | **Active research reference** | Real pipeline, datasets, Viewer paths exist |
| Soccer | **NOT_STARTED / FUTURE_GATED** | In-scope sport; no completed Dataset/Engine validation |
| Basketball | **NOT_STARTED / FUTURE_GATED** | In-scope sport; no completed Dataset/Engine validation |
| Volleyball | **NOT_STARTED / FUTURE_GATED** | In-scope sport; no completed Dataset/Engine validation |

Do not document soccer, basketball, or volleyball as shipped analysis capabilities.
