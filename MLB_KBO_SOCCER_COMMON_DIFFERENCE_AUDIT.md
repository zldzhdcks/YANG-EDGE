# MLB / KBO / Soccer Common-Difference Audit v1

세 참조 축을 비교한다.

- MLB: active research reference
- KBO: first non-MLB real dataset implemented
- Soccer: pre-design audit only

분류값:

- `COMMON_CONFIRMED`
- `COMMON_CANDIDATE`
- `BASEBALL_ONLY`
- `SOCCER_SPECIFIC`
- `PROVIDER_SPECIFIC`
- `UNKNOWN`

## Lifecycle / metadata

| Item | Classification | Notes |
|---|---|---|
| Pre-game snapshot freeze | `COMMON_CANDIDATE` | MLB implemented; KBO identity and soccer identity will likely need it later |
| `cutoffTime` | `COMMON_CONFIRMED` | MLB starter/lineup, KBO identity, soccer fixture audits all require as-of boundaries |
| `collectionPhase` | `COMMON_CONFIRMED` | MLB lineup, KBO identity, soccer identity candidate all split pre/post states |
| `resultStatus` | `COMMON_CONFIRMED` | Taxonomy values differ, but presence of normalized result state is common |
| automatic grade | `COMMON_CANDIDATE` | MLB implemented; KBO/soccer need sport-specific result contracts |
| Success Review | `COMMON_CANDIDATE` | lifecycle likely reusable, payload taxonomy not yet |
| Failure Review | `COMMON_CANDIDATE` | same as above |
| Evidence Ledger | `COMMON_CONFIRMED` | sport-neutral container already exists |
| Contradiction Ledger | `COMMON_CONFIRMED` | sport-neutral container already exists |
| Sample Growth | `COMMON_CONFIRMED` | cross-sport research governance concern |
| Completeness Trend | `COMMON_CONFIRMED` | applies across datasets/sports |
| Engine Admission Gate | `COMMON_CONFIRMED` | explicit `PROHIBITED` default across MLB/KBO and soccer design |
| Provider Adapter | `COMMON_CONFIRMED` | MLB/KBO implementations and soccer schedule provider path support this |
| Service Layer | `COMMON_CONFIRMED` | KBO implemented; soccer current provider flow also points this way |
| Pure Builder | `COMMON_CONFIRMED` | MLB and KBO research builders follow this boundary |
| Feature Flag | `COMMON_CANDIDATE` | KBO implemented for collection; soccer should mirror meaning split later |
| `cacheUsage` | `COMMON_CONFIRMED` | MLB and KBO use it; soccer provider already caches |
| `inputHash` | `COMMON_CONFIRMED` | reproducibility requirement crosses sports |
| `resultHash` | `COMMON_CONFIRMED` | reproducibility requirement crosses sports |
| `warnings` | `COMMON_CONFIRMED` | provider limits / partial data must stay explicit |
| `missing` | `COMMON_CONFIRMED` | same |
| `legalStatus` | `COMMON_CONFIRMED` | mandatory across all sports |
| `researchOnly` | `COMMON_CONFIRMED` | all current research artifacts/default gates |
| `engineAdmission` | `COMMON_CONFIRMED` | same governance field across all sports |

## Domain payloads

| Item | Classification | Notes |
|---|---|---|
| Starting pitcher / probable starter | `BASEBALL_ONLY` | baseball-specific |
| Bullpen role | `BASEBALL_ONLY` | baseball-specific |
| Batting lineup order | `BASEBALL_ONLY` | baseball-specific |
| Draw as core primary result | `SOCCER_SPECIFIC` | central to soccer match result |
| Starting XI | `SOCCER_SPECIFIC` | differs from baseball lineup semantics |
| Formation | `SOCCER_SPECIFIC` | soccer-only tactical field |
| Bench / substitution structure | `SOCCER_SPECIFIC` | soccer-specific lifecycle |
| Referee dataset relevance | `SOCCER_SPECIFIC` | materially relevant, unlike current MLB/KBO artifacts |
| League table context | `SOCCER_SPECIFIC` | more directly tied to match context |
| Travel / rest | `COMMON_CANDIDATE` | likely common, sport-specific payloads differ |
| Weather | `COMMON_CANDIDATE` | likely common, provider/legal details vary |
| Injury / absence | `COMMON_CANDIDATE` | common concept, payload varies a lot |
| Odds history | `COMMON_CANDIDATE` | common concept, market structure differs |
| Schedule / result identity | `COMMON_CONFIRMED` | already real in KBO, strongly indicated for soccer |

## Provider / ID layer

| Item | Classification | Notes |
|---|---|---|
| internal stable `gameId` + external provider id split | `COMMON_CONFIRMED` | MLB/KBO practice and soccer requirement |
| provider league id separation | `COMMON_CONFIRMED` | especially needed for soccer multi-league scope |
| Betman scope reference separated from provider ids | `COMMON_CONFIRMED` | policy repeated across KBO and soccer design |
| team alias display mapping | `COMMON_CONFIRMED` | exists in baseball and football code |
| string-only team identity matching | `UNKNOWN` / avoid | works partially today, but not robust enough for soccer |

## Conclusions

- Repeated enough to remain design candidates now: lifecycle shell, legal/meta/hash/audit/cache/provider boundaries.
- Not repeated enough to generalize into Framework payloads: baseball roles, soccer formations, market grading schemas.
- Soccer strengthens the case for a common **design vocabulary**, not a common **runtime provider contract** yet.

## Official conclusion

- Multi-sport trigger conclusion: `COMMON_CONTRACT_DESIGN_CANDIDATE`
- Framework action now: `NO_FRAMEWORK_CHANGE`
