import {
  EXPECTED_EVAL_SCHEMA_VERSION,
  ODDS_ROLE_OBSERVATION_ONLY,
  OFFICIAL_FORWARD_MODEL,
  OFFICIAL_FORWARD_MODEL_HASH,
  OUTCOME_CLASSES,
  PROBABILITY_SUM_EPSILON,
  type OutcomeClass,
} from "./constants";
import { fail, FORWARD_READ_MODEL_ERROR } from "./errors";
import type {
  FootballForwardEvidenceReadModel,
  ForwardGradedEvent,
  ForwardHypothesisObservation,
  ResolvedFixtureIdentity,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      `${label} must be an object`,
    );
  }
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      `${label} must be a non-empty string`,
    );
  }
  return value;
}

function requireIsoTimestamp(value: unknown, label: string): string {
  const text = requireString(value, label);
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      `${label} is not a valid ISO timestamp`,
    );
  }
  return text;
}

function requireNonNegativeInt(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      `${label} must be a non-negative integer`,
    );
  }
  return value;
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      `${label} must be a boolean`,
    );
  }
  return value;
}

function requireFalse(value: unknown, label: string): false {
  if (value === true) {
    fail(FORWARD_READ_MODEL_ERROR.FORWARD_FORBIDDEN_INPUT_USED, label);
  }
  if (value !== false) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      `${label} must be boolean false`,
    );
  }
  return false;
}

function requireOutcomeClass(value: unknown, label: string): OutcomeClass {
  if (
    value !== "HOME" &&
    value !== "DRAW" &&
    value !== "AWAY"
  ) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      `${label} must be one of ${OUTCOME_CLASSES.join("/")}`,
    );
  }
  return value;
}

function requireUnitProbability(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    fail(FORWARD_READ_MODEL_ERROR.FORWARD_PROBABILITY_INVALID, label);
  }
  return value;
}

function requireHash(value: unknown, label: string): string {
  const text = requireString(value, label);
  if (!/^[0-9a-f]{64}$/i.test(text)) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      `${label} must be a 64-char hex digest`,
    );
  }
  return text;
}

function parseHypotheses(value: unknown): ForwardHypothesisObservation[] {
  if (!Array.isArray(value)) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      "hypothesisObservations must be an array",
    );
  }
  return value.map((row, i) => {
    const rec = requireRecord(row, `hypothesisObservations[${i}]`);
    if (rec.HYPOTHESIS_ONLY !== true) {
      fail(
        FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
        `hypothesisObservations[${i}].HYPOTHESIS_ONLY must be true`,
      );
    }
    return {
      flag: requireString(rec.flag, `hypothesisObservations[${i}].flag`),
      HYPOTHESIS_ONLY: true,
      detail: requireString(rec.detail, `hypothesisObservations[${i}].detail`),
    };
  });
}

function mapIdentity(
  fixtureId: number,
  identityIndex: ReadonlyMap<number, ResolvedFixtureIdentity>,
): Pick<
  ForwardGradedEvent,
  "identityStatus" | "league" | "homeTeam" | "awayTeam"
> {
  const found = identityIndex.get(fixtureId);
  if (!found) {
    return {
      identityStatus: "UNRESOLVED",
      league: null,
      homeTeam: null,
      awayTeam: null,
    };
  }
  return {
    identityStatus: "RESOLVED",
    league: found.league,
    homeTeam: found.homeTeam,
    awayTeam: found.awayTeam,
  };
}

function parseIncludedRow(
  row: unknown,
  index: number,
  officialHash: string,
  identityIndex: ReadonlyMap<number, ResolvedFixtureIdentity>,
): ForwardGradedEvent {
  const rec = requireRecord(row, `included[${index}]`);
  const fixtureId = rec.fixtureId;
  if (typeof fixtureId !== "number" || !Number.isSafeInteger(fixtureId) || fixtureId <= 0) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      `included[${index}].fixtureId must be a positive integer`,
    );
  }
  const kickoffUtc = requireIsoTimestamp(
    rec.kickoffUtc,
    `included[${index}].kickoffUtc`,
  );
  const predictionCreatedAt = requireIsoTimestamp(
    rec.predictionCreatedAt,
    `included[${index}].predictionCreatedAt`,
  );
  const sealedAt = requireIsoTimestamp(
    rec.sealedAt,
    `included[${index}].sealedAt`,
  );
  const kickoffMs = Date.parse(kickoffUtc);
  if (Date.parse(predictionCreatedAt) >= kickoffMs) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_PREGAME_INTEGRITY_FAILED,
      `included[${index}] predictionCreatedAt is not before kickoff`,
    );
  }
  if (Date.parse(sealedAt) >= kickoffMs) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_PREGAME_INTEGRITY_FAILED,
      `included[${index}] sealedAt is not before kickoff`,
    );
  }
  if (rec.validPregame !== true) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_PREGAME_INTEGRITY_FAILED,
      `included[${index}].validPregame`,
    );
  }
  if (rec.sealedAtBeforeKickoff !== true) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_PREGAME_INTEGRITY_FAILED,
      `included[${index}].sealedAtBeforeKickoff`,
    );
  }
  if (rec.predictionCreatedAtBeforeKickoff !== true) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_PREGAME_INTEGRITY_FAILED,
      `included[${index}].predictionCreatedAtBeforeKickoff`,
    );
  }

  const pHome = requireUnitProbability(rec.pHome, `included[${index}].pHome`);
  const pDraw = requireUnitProbability(rec.pDraw, `included[${index}].pDraw`);
  const pAway = requireUnitProbability(rec.pAway, `included[${index}].pAway`);
  if (Math.abs(pHome + pDraw + pAway - 1) > PROBABILITY_SUM_EPSILON) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_PROBABILITY_INVALID,
      `included[${index}] home+draw+away is not 1`,
    );
  }

  const modelSourceHash = requireHash(
    rec.modelSourceHash,
    `included[${index}].modelSourceHash`,
  );
  if (modelSourceHash !== officialHash) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_MODEL_HASH_MISMATCH,
      `included[${index}].modelSourceHash`,
    );
  }

  const predictedClass = requireOutcomeClass(
    rec.predictedClass,
    `included[${index}].predictedClass`,
  );
  const actualClass = requireOutcomeClass(
    rec.actualClass,
    `included[${index}].actualClass`,
  );
  const correct = requireBoolean(rec.correct, `included[${index}].correct`);
  if (correct !== (predictedClass === actualClass)) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      `included[${index}].correct does not match predicted/actual class`,
    );
  }

  requireFalse(rec.ODDS_USED, `included[${index}].ODDS_USED`);
  requireFalse(rec.MARKET_USED, `included[${index}].MARKET_USED`);
  requireFalse(
    rec.PROVIDER_PREDICTION_USED,
    `included[${index}].PROVIDER_PREDICTION_USED`,
  );
  requireFalse(
    rec.TARGET_RESULT_DATA_USED,
    `included[${index}].TARGET_RESULT_DATA_USED`,
  );

  return {
    fixtureId,
    ...mapIdentity(fixtureId, identityIndex),
    kickoffUtc,
    predictionCreatedAt,
    sealedAt,
    modelVersion: OFFICIAL_FORWARD_MODEL,
    modelSourceHash,
    probabilities: { home: pHome, draw: pDraw, away: pAway },
    predictedClass,
    actualClass,
    correct,
    probabilityBucket: requireString(rec.bucket, `included[${index}].bucket`),
    provenance: {
      snapshotHash: requireHash(
        rec.snapshotHash,
        `included[${index}].snapshotHash`,
      ),
      receiptHash: requireHash(
        rec.receiptHash,
        `included[${index}].receiptHash`,
      ),
      gradeHash: requireHash(rec.gradeHash, `included[${index}].gradeHash`),
      validPregame: true,
      sealedBeforeKickoff: true,
      predictionCreatedBeforeKickoff: true,
      oddsUsed: false,
      marketUsed: false,
      providerPredictionUsed: false,
      targetResultDataUsed: false,
    },
  };
}

export function buildForwardReadModelFromPayload(input: {
  payload: Record<string, unknown>;
  generatedFrom: string;
  identityIndex: ReadonlyMap<number, ResolvedFixtureIdentity>;
}): FootballForwardEvidenceReadModel {
  const { payload, generatedFrom, identityIndex } = input;
  if (payload.schemaVersion !== EXPECTED_EVAL_SCHEMA_VERSION) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      `schemaVersion=${String(payload.schemaVersion)}`,
    );
  }
  const version = requireString(payload.FORWARD_MODEL, "FORWARD_MODEL");
  if (version !== OFFICIAL_FORWARD_MODEL) {
    fail(FORWARD_READ_MODEL_ERROR.FORWARD_MODEL_MISMATCH, version);
  }
  const sourceHash = requireHash(payload.MODEL_HASH, "MODEL_HASH");
  if (sourceHash !== OFFICIAL_FORWARD_MODEL_HASH) {
    fail(FORWARD_READ_MODEL_ERROR.FORWARD_MODEL_HASH_MISMATCH, "MODEL_HASH");
  }

  const evaluatedAt = requireIsoTimestamp(payload.evaluatedAt, "evaluatedAt");
  const sampleInsufficient = requireBoolean(
    payload.SAMPLE_INSUFFICIENT,
    "SAMPLE_INSUFFICIENT",
  );
  const engineChangeAllowedTop = requireBoolean(
    payload.ENGINE_CHANGE_ALLOWED,
    "ENGINE_CHANGE_ALLOWED",
  );

  requireFalse(payload.ODDS_USED, "ODDS_USED");
  requireFalse(payload.MARKET_USED, "MARKET_USED");
  requireFalse(payload.PROVIDER_PREDICTION_USED, "PROVIDER_PREDICTION_USED");
  requireFalse(payload.TARGET_RESULT_DATA_USED, "TARGET_RESULT_DATA_USED");
  requireFalse(
    payload.POSTGAME_DATA_USED_IN_PREDICTION,
    "POSTGAME_DATA_USED_IN_PREDICTION",
  );

  const counts = requireRecord(payload.counts, "counts");
  const totalPredicted = requireNonNegativeInt(
    counts.totalPredicted,
    "counts.totalPredicted",
  );
  const totalGraded = requireNonNegativeInt(
    counts.totalGraded,
    "counts.totalGraded",
  );
  const pendingPredicted = requireNonNegativeInt(
    counts.pendingPredicted,
    "counts.pendingPredicted",
  );
  const correct = requireNonNegativeInt(counts.correct, "counts.correct");
  const wrong = requireNonNegativeInt(counts.wrong, "counts.wrong");
  const pass = requireNonNegativeInt(counts.pass, "counts.pass");
  const pendingPass = requireNonNegativeInt(
    counts.pendingPass,
    "counts.pendingPass",
  );
  const integrityExclusions = requireNonNegativeInt(
    counts.integrityExclusions,
    "counts.integrityExclusions",
  );
  if (typeof counts.accuracy !== "number" || !Number.isFinite(counts.accuracy)) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      "counts.accuracy must be a finite number",
    );
  }
  if (correct + wrong !== totalGraded) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_COUNT_MISMATCH,
      "correct + wrong != totalGraded",
    );
  }
  if (totalPredicted < totalGraded) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_COUNT_MISMATCH,
      "totalPredicted < totalGraded",
    );
  }
  if (pendingPredicted + totalGraded > totalPredicted) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_COUNT_MISMATCH,
      "pendingPredicted + totalGraded exceeds totalPredicted",
    );
  }
  if (totalGraded > 0) {
    const expectedAccuracy = correct / totalGraded;
    if (Math.abs(counts.accuracy - expectedAccuracy) > 1e-12) {
      fail(
        FORWARD_READ_MODEL_ERROR.FORWARD_COUNT_MISMATCH,
        "counts.accuracy does not match correct/totalGraded",
      );
    }
  }

  const checkpoint = requireRecord(payload.checkpoint, "checkpoint");
  const currentN = requireNonNegativeInt(
    checkpoint.currentN,
    "checkpoint.currentN",
  );
  const targetN = requireNonNegativeInt(
    checkpoint.checkpointTarget,
    "checkpoint.checkpointTarget",
  );
  const remaining = requireNonNegativeInt(
    checkpoint.remaining,
    "checkpoint.remaining",
  );
  const reached = requireBoolean(
    checkpoint.checkpointReached,
    "checkpoint.checkpointReached",
  );
  const engineChangeAllowed = requireBoolean(
    checkpoint.ENGINE_CHANGE_ALLOWED,
    "checkpoint.ENGINE_CHANGE_ALLOWED",
  );
  if (engineChangeAllowed !== engineChangeAllowedTop) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      "ENGINE_CHANGE_ALLOWED disagrees between root and checkpoint",
    );
  }
  if (currentN !== totalGraded) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_COUNT_MISMATCH,
      "checkpoint.currentN != counts.totalGraded",
    );
  }
  if (remaining !== Math.max(0, targetN - currentN)) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_COUNT_MISMATCH,
      "checkpoint.remaining is inconsistent",
    );
  }
  if (reached !== currentN >= targetN) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_COUNT_MISMATCH,
      "checkpoint.checkpointReached is inconsistent",
    );
  }

  if (!Array.isArray(payload.included)) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_SCHEMA_INVALID,
      "included must be an array",
    );
  }
  if (payload.included.length !== totalGraded) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_COUNT_MISMATCH,
      "included.length != totalGraded",
    );
  }

  const seen = new Set<number>();
  const gradedEvents: ForwardGradedEvent[] = [];
  for (let i = 0; i < payload.included.length; i++) {
    const event = parseIncludedRow(
      payload.included[i],
      i,
      sourceHash,
      identityIndex,
    );
    if (seen.has(event.fixtureId)) {
      fail(
        FORWARD_READ_MODEL_ERROR.FORWARD_DUPLICATE_FIXTURE,
        String(event.fixtureId),
      );
    }
    seen.add(event.fixtureId);
    gradedEvents.push(event);
  }

  const derivedCorrect = gradedEvents.filter((e) => e.correct).length;
  const derivedWrong = gradedEvents.filter((e) => !e.correct).length;
  if (derivedCorrect !== correct || derivedWrong !== wrong) {
    fail(
      FORWARD_READ_MODEL_ERROR.FORWARD_COUNT_MISMATCH,
      "included W/L does not match counts",
    );
  }

  return {
    schemaVersion: "FOOTBALL_FORWARD_EVIDENCE_READ_MODEL_V1",
    generatedFrom,
    evaluatedAt,
    model: {
      version,
      sourceHash,
      researchOnly: true,
      calibrated: false,
      officialPick: null,
    },
    sample: {
      totalPredicted,
      totalGraded,
      pendingPredicted,
      correct,
      wrong,
      accuracy: counts.accuracy,
      pass,
      pendingPass,
      integrityExclusions,
      sampleInsufficient,
    },
    checkpoint: {
      currentN,
      targetN,
      remaining,
      reached,
      engineChangeAllowed,
    },
    integrity: {
      oddsRole: ODDS_ROLE_OBSERVATION_ONLY,
      oddsUsed: false,
      marketUsed: false,
      providerPredictionUsed: false,
      targetResultDataUsed: false,
      postgameDataUsedInPrediction: false,
      integrityExclusions,
    },
    hypotheses: parseHypotheses(payload.hypothesisObservations),
    gradedEvents,
  };
}
