# Official Forward canonical prediction policy V1

Owner authorized before target outcomes/grades are accessed, 2026-09-20.
Base HEAD: 424cbb51dd8667cbf62b01509d2e7a6472346186.

COUNT_KEY is API-Football providerFixtureId. Only Official
football-poisson-research-v1 / frozen source hash candidates are eligible.
Historical research, manual/external shadow and mirror copies are not independent
Official samples. Legacy identities must use their existing canonical contract;
missing identity never permits inventing a fixture ID.

Eligibility is established independently of probability values or outcomes:
exact positive provider fixture/team/league IDs consistent across pregame schedule,
input and snapshot; distinct home/away; actual observed NS schedule before cutoff;
cutoff <= createdAt <= receipt.sealedAt < scheduledStart; exact immutable input,
snapshot and receipt hash chain; no invalid/miss markers; official frozen model;
past-only same-league completed FT observations with actual fetched timestamps,
365-day lookback, unique IDs, source hashes and no target result/input contamination.
The target object may contain only the established pregame identity fields.

Valid seals are ordered by receipt.sealedAt ascending, then predictionCreatedAt
ascending. Byte-identical mirrors represent the same seal. If timestamps tie for
different seals, lexical SHA256 is the deterministic final tie-break, unrelated to
probability quality. Only the first eligible seal is CANONICAL. Other eligible
seals are DUPLICATE_NONCANONICAL. Ineligible evidence is
INVALID_FOR_CANONICAL_COUNT and remains preserved. Probability magnitudes, market
prices, predicted side, outcomes and grade success never participate in ranking.

Global Forward identity is its API_FOOTBALL fixture identity plus immutable schedule
and input. It is not required to have a later operator batch/target. Batch binding
is audited separately; absence of a September 20 operator scope does not invalidate
an otherwise valid September 13 global Forward seal. Explicit batch references
cannot manufacture a historical observation time.

Official performance evaluation includes each providerFixtureId at most once and
only its canonical Prediction. Duplicate evidence remains auditable and is excluded
from grading/evaluation denominators. Existing grades are neither read nor changed
in this mission. Future grade readers/writers must enforce this eligibility before
accessing grade bodies. Never change historical immutable grade or Prediction files.

Before new production, all authoritative global and named-batch Forward stores are
checked for that fixture and official model identity under one local fixture lock.
A valid existing seal yields EXISTING_OFFICIAL_PREDICTION; no new prediction or
automatic reseal. Identity disagreement fails closed. A crashed lock requires
attended recovery. Existing-scope linkage may reference a canonical seal only after
its separate temporal/binding contract passes; otherwise remain pending.

This policy does not approve a V4 model, Shadow, new weights/features, new sample
thresholds, retrospective Predictions or any target result/live/postgame access.
