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
