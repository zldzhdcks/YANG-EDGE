# FOOTBALL V31 R1 PROSPECTIVE COMPARATOR AMENDMENT V1

BASE_SHA: `3373696409b92470769a465eb4066270402de3b7`

This amendment precedes the first real R1 prediction (zero real seals). It changes the prospective comparison contract, not any model, fitted parameter, actual-observed selector, historical evidence, promotion rule or official Forward artifact. After the first real seal this comparator contract is frozen. Any later change requires a separately named prospective cohort and prior authorization, never revision of existing evidence.

## Why and roles

An earlier official v1 prediction and a later R1 prediction mix model effects with information-timing effects. Primary prospective comparison therefore requires one target, one cutoffAt, one predictionCreatedAt evidence view, and exactly the same causal base-result history for:

- `V1_SAME_CUTOFF_RESEARCH_COMPARATOR`: unchanged `football-poisson-research-v1`.
- `H2_SAME_CUTOFF_RESEARCH_COMPARATOR`: unchanged frozen H2 backbone.
- `V31_R1_PROSPECTIVE_SHADOW`: unchanged prospective R1 adapter and final 2023 parameters.

`OFFICIAL_FORWARD_REFERENCE_ONLY` is optional fixture ID / snapshot hash metadata. It is not a comparator input and never supplies probabilities or timestamps to the three research calculations. The caller must verify an official seal and its pregame validity before attaching a reference. Missing or invalid references remain null. Official artifacts remain read-only; no official runner is imported or invoked.

## Same-cutoff evidence contract

Use the existing foundation `select` unchanged. It requires genuine provider observation and local seal at or before cutoff, completed prior fixtures in the same league within 365 days, and exact identities. Newer missing observations do not fall back to older complete observations. No fabricated observedAt, target results, odds, owner input, external analysis or recommendation modules.

The selected result-only projection supplies the same baseHistoryIds and baseHistoryHash to all three models. V1/H2 receive no xG/shots/SOT values. R1 alone receives the matching actual-observed features. Frozen V1 internally sorts source IDs; equality is checked as an exact ID set, while the common envelope records deterministic chronological order.

**Boundary integrity:** frozen V1 excludes completion.resultObservedAt equal to cutoff, while the existing R1 selector includes equality. If any selected completion observation equals cutoff, the comparator fails closed with `SAME_CUTOFF_OBSERVATION_BOUNDARY`, before model execution. Do not remove that row, alter its timestamp, or change a model. A subsequent actual cutoff can be used before the deadline. The selector itself remains byte-for-byte unchanged. This is an integrity gate, not a sample or performance threshold.

H2 comparator fitting uses the frozen H2 procedure on this common history. R1 performs its unchanged internal H2 fitting. Exact equality assertions bind comparator rates, parameter hash and history hash to R1's internal offset whenever R1 predicts. No final R1 map/beta fitting occurs.

- FINAL_R1_MAP_HASH: `244c2ef4f930855271744e39f0de44598ec6c929ac18edd4c6f72965eb8a4a26`
- FINAL_R1_BETA_HASH: `dc8f9faa4a09429ddfdd46631502375540e25fdbb37f84a1f92f6ceeb21e2ab4`
- V1 source SHA256 (LF): `6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf`
- R1 adapter SHA256 (LF): `125f715c85a5199b7f5725949c4b1ff6f12b1e5d6ef65095c5af0d0673682b6b`
- H2 source SHA256 (LF): `fab9d235b885207a0feba198f1e777f0a8ee0577e50d14f317613e7dcfef0aea`

## Envelope and storage

Implementation: `scripts/football-v31-r1-comparator-v1/`.

`compare(target, cutoffAt, predictionCreatedAt, observations)` returns a recursively frozen bundle. All result hashes bind their own common context, status, reasons, probabilities, class, rates and model provenance. The bundle includes baseHistoryIds/hash, featureObservationIds/hashes/counts and inputSnapshotHash. R1 includes map/beta/adapter hashes; H2 includes its actual fitted parameter hash (null on pre-fit PASS). A same-target envelope carries all three independent predictions.

`seal(root, bundle, observations)` adds actual sealedAt, validates the envelope and observation/raw links, and enforces at least 60 seconds before kickoff. The only supported root ends in `football-v31-r1-prospective-shadow-v1`; storage is under `V31_R1_PROSPECTIVE_SHADOW/fixtures/<id>/`. MODEL_FORWARD and owner/external namespaces are rejected. An exclusive fixture-directory reservation prevents overwrite. A partial write remains blocked for explicit audit; never reset or backfill it. Input and prediction are individually SHA256 sealed. No new revision workflow is enabled here.

This amended envelope is the required first-run format. The earlier foundation single-R1 `sealPregame` is retained for regression provenance, not the authorized first-run entry point. Postgame remains a separate append-only stage; a consumer must validate this amended envelope and grade each individual prediction hash without modifying it. The old single-result grade reader must not be applied directly to this envelope. This mission does not execute grading or start an operational runner.

## PASS and checkpoint policy

R1 feature insufficiency preserves its PASS, with reason/counts. It does not erase or skip otherwise valid V1/H2 predictions. Each model's own frozen base-history gates also preserve PASS. FAIL/INVALID blocks sealing and is never relabeled PASS.

`pairedSets` validates unique target envelopes and returns a full sorted target denominator plus separate exact R1–V1 and R1–H2 PREDICTED sets. Never filter away PASS from full coverage. Postgame reviews restrict each paired comparison to completed, separately graded members and must report paired counts, all targets, model-specific PASS and pending counts.

At 25/50/100/200 graded R1 PREDICTED milestones, primary comparisons are R1 vs same-cutoff V1 and R1 vs same-cutoff H2. Existing official comparison is secondary timing-confounded operational context only when a valid pregame reference exists; it is not timing-matched validation. Historical and prospective accuracy remain separate. No interim tuning; N<100 cannot justify an engine change; N=100 permits internal research review only. No automatic model promotion.

## First-run preflight and authorization

`preflight-v1.ts` reads the sealed foundation census and actual observation registry, checks zero real fixture directories, and requests each stored target through the existing official fixture endpoint. It projects only identity, kickoff and status, recording actual fetch time and response SHA256. It neither reads score fields nor stores raw target payloads. No fitting, probability computation, snapshot creation, watch, service, purchase or subscription change is called.

The census records FUTURE, NS, at least 60 seconds remaining, and potentially sufficient frozen base/feature gates. Identity changes and provider failures are NOT_VERIFIED; no invented fixture or MISS. Changed kickoff is explicit. Eligibility is rechecked at preflight completion. These are transient readiness observations, not guaranteed future execution results; the first authorized run must refresh status and deadlines again.

FIRST_RUN_READY requires the implemented comparator, new and existing tests passing, unchanged map/beta/selector, at least one verified potentially eligible future target, and zero real predictions. This readiness report does **not** authorize execution. No real fitting/prediction, grading, watch or model promotion in this mission.

## Validation and handoff

Existing 212 tests plus comparator tests, strict TypeScript and ESLint are required. Tests use synthetic fixtures only. The preflight audit records final test receipts, source hashes and preservation checks. Keep the untracked access-gate document and all historical/official artifacts intact.

Next authorized first run must use `compare` and the amended `seal`, recheck provider status and deadline, load unchanged final parameters, retain individual PASS results, and freeze this contract after the first seal. Never invoke historical evaluators or the official Forward writer. Before the separate postgame mission, supply a grader for this envelope as described above; never mutate a pregame file. Raw evidence remains LOCAL_ONLY. No main merge.
