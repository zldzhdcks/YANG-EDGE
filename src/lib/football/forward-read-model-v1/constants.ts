export const FORWARD_READ_MODEL_SCHEMA_VERSION =
  "FOOTBALL_FORWARD_EVIDENCE_READ_MODEL_V1" as const;

export const EXPECTED_EVAL_SCHEMA_VERSION =
  "FOOTBALL_FORWARD_CUMULATIVE_EVALUATION_V1" as const;

export const OFFICIAL_FORWARD_MODEL = "football-poisson-research-v1" as const;

/** Official Poisson research source hash. Not a promotion signal. */
export const OFFICIAL_FORWARD_MODEL_HASH =
  "6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf" as const;

export const DEFAULT_FORWARD_EVAL_REL =
  "data/audits/football-forward-cumulative-evaluation-v1.json" as const;

export const COMMITTED_SCHEDULE_DIR_REL = "data/research/football" as const;

export const COMMITTED_POSTGAME_REVIEW_DIR_REL = "data/audits" as const;

export const FOOTBALL_FORWARD_POSTGAME_REVIEW_FILE_RE =
  /^\d{4}-\d{2}-\d{2}-football-forward-postgame-review-v1\.json$/;

export const FOOTBALL_FORWARD_POSTGAME_REVIEW_SCHEMA_RE =
  /^yang-edge-\d{4}-\d{2}-\d{2}-football-forward-postgame-review-v1$/;

export const ODDS_ROLE_OBSERVATION_ONLY = "OBSERVATION_ONLY" as const;

export const PROBABILITY_SUM_EPSILON = 1e-6;

export const OUTCOME_CLASSES = ["HOME", "DRAW", "AWAY"] as const;
export type OutcomeClass = (typeof OUTCOME_CLASSES)[number];
