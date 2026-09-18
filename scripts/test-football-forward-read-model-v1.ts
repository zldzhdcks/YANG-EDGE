/**
 * Official Forward evidence read model — fail-closed, provider-free.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_FORWARD_EVAL_REL,
  FORWARD_READ_MODEL_ERROR,
  ForwardReadModelError,
  loadFootballForwardEvidenceReadModel,
  ODDS_ROLE_OBSERVATION_ONLY,
  OFFICIAL_FORWARD_MODEL,
  OFFICIAL_FORWARD_MODEL_HASH,
} from "../src/lib/football/forward-read-model-v1";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const HASH_D = "d".repeat(64);
const KICKOFF = "2026-09-13T13:30:00.000Z";
const CREATED = "2026-09-13T07:32:18.853Z";
const SEALED = "2026-09-13T07:32:18.866Z";

function includedRow(overrides: Record<string, unknown> = {}) {
  return {
    fixtureId: 1001,
    kickoffUtc: KICKOFF,
    utcDate: "2026-09-13",
    predictedClass: "HOME",
    actualClass: "HOME",
    correct: true,
    pHome: 0.5,
    pDraw: 0.3,
    pAway: 0.2,
    maxProbability: 0.5,
    bucket: "50_60",
    snapshotHash: HASH_A,
    receiptHash: HASH_B,
    gradeHash: HASH_C,
    modelSourceHash: OFFICIAL_FORWARD_MODEL_HASH,
    validPregame: true,
    sealedAt: SEALED,
    predictionCreatedAt: CREATED,
    sealedAtBeforeKickoff: true,
    predictionCreatedAtBeforeKickoff: true,
    TARGET_RESULT_DATA_USED: false,
    ODDS_USED: false,
    MARKET_USED: false,
    PROVIDER_PREDICTION_USED: false,
    ...overrides,
  };
}

function validPayload(overrides: Record<string, unknown> = {}) {
  const included = (overrides.included as unknown[]) ?? [includedRow()];
  const totalGraded =
    typeof overrides.totalGradedOverride === "number"
      ? (overrides.totalGradedOverride as number)
      : included.length;
  delete overrides.totalGradedOverride;
  const correctCount = included.filter(
    (row) => (row as { correct?: boolean }).correct === true,
  ).length;
  const wrongCount = included.length - correctCount;
  return {
    schemaVersion: "FOOTBALL_FORWARD_CUMULATIVE_EVALUATION_V1",
    FORWARD_MODEL: OFFICIAL_FORWARD_MODEL,
    MODEL_HASH: OFFICIAL_FORWARD_MODEL_HASH,
    evaluatedAt: "2026-09-17T00:27:32.147Z",
    SAMPLE_INSUFFICIENT: true,
    ENGINE_CHANGE_ALLOWED: false,
    ODDS_USED: false,
    MARKET_USED: false,
    PROVIDER_PREDICTION_USED: false,
    TARGET_RESULT_DATA_USED: false,
    POSTGAME_DATA_USED_IN_PREDICTION: false,
    counts: {
      totalPredicted: totalGraded,
      totalGraded,
      pendingPredicted: 0,
      correct: correctCount,
      wrong: wrongCount,
      accuracy: totalGraded === 0 ? 0 : correctCount / totalGraded,
      pass: 0,
      pendingPass: 0,
      integrityExclusions: 0,
    },
    checkpoint: {
      checkpointTarget: 25,
      currentN: totalGraded,
      remaining: Math.max(0, 25 - totalGraded),
      checkpointReached: totalGraded >= 25,
      ENGINE_CHANGE_ALLOWED: false,
    },
    hypothesisObservations: [
      {
        flag: "NO_DRAW_PREDICTIONS",
        HYPOTHESIS_ONLY: true,
        detail: "Included PREDICTED+GRADED cohort has zero DRAW predictions. Descriptive only.",
      },
    ],
    included,
    ...overrides,
  };
}

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof ForwardReadModelError, String(err));
    assert.equal(err.code, code);
    return;
  }
  assert.fail(`expected ${code}`);
}

function readModelSource(): string {
  const dir = join(process.cwd(), "src/lib/football/forward-read-model-v1");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => readFileSync(join(dir, name), "utf8"))
    .join("\n");
}

test("1 valid committed cumulative evaluation builds", () => {
  const model = loadFootballForwardEvidenceReadModel();
  assert.equal(model.schemaVersion, "FOOTBALL_FORWARD_EVIDENCE_READ_MODEL_V1");
  assert.equal(model.generatedFrom, DEFAULT_FORWARD_EVAL_REL);
  assert.equal(model.model.version, OFFICIAL_FORWARD_MODEL);
  assert.equal(model.model.sourceHash, OFFICIAL_FORWARD_MODEL_HASH);
  assert.equal(model.model.researchOnly, true);
  assert.equal(model.model.calibrated, false);
  assert.equal(model.model.officialPick, null);
  assert.equal(model.sample.totalPredicted, 45);
  assert.equal(model.sample.totalGraded, 15);
  assert.equal(model.sample.pendingPredicted, 30);
  assert.equal(model.sample.correct, 10);
  assert.equal(model.sample.wrong, 5);
  assert.equal(model.sample.accuracy, 10 / 15);
  assert.equal(model.sample.pass, 19);
  assert.equal(model.sample.pendingPass, 13);
  assert.equal(model.sample.integrityExclusions, 0);
  assert.equal(model.sample.sampleInsufficient, true);
  assert.equal(model.checkpoint.currentN, 15);
  assert.equal(model.checkpoint.targetN, 25);
  assert.equal(model.checkpoint.remaining, 10);
  assert.equal(model.checkpoint.reached, false);
  assert.equal(model.checkpoint.engineChangeAllowed, false);
  assert.equal(model.integrity.oddsRole, ODDS_ROLE_OBSERVATION_ONLY);
  assert.equal(model.integrity.oddsUsed, false);
  assert.equal(model.integrity.marketUsed, false);
  assert.equal(model.integrity.providerPredictionUsed, false);
  assert.equal(model.integrity.targetResultDataUsed, false);
  assert.equal(model.integrity.postgameDataUsedInPrediction, false);
  assert.equal(model.gradedEvents.length, 15);
  assert.equal(new Set(model.gradedEvents.map((e) => e.fixtureId)).size, 15);
  for (const event of model.gradedEvents) {
    assert.ok(event.fixtureId > 0);
    assert.equal(event.modelVersion, OFFICIAL_FORWARD_MODEL);
    assert.equal(event.modelSourceHash, OFFICIAL_FORWARD_MODEL_HASH);
    assert.equal(event.provenance.oddsUsed, false);
    assert.equal(event.provenance.validPregame, true);
    if (event.identityStatus === "UNRESOLVED") {
      assert.equal(event.league, null);
      assert.equal(event.homeTeam, null);
      assert.equal(event.awayTeam, null);
    } else {
      assert.equal(event.identityStatus, "RESOLVED");
      assert.ok(event.league);
      assert.ok(event.homeTeam);
      assert.ok(event.awayTeam);
    }
  }
  for (const h of model.hypotheses) {
    assert.equal(h.HYPOTHESIS_ONLY, true);
  }
  const atletico = model.gradedEvents.find((e) => e.fixtureId === 1570384);
  assert.ok(atletico);
  assert.equal(atletico.identityStatus, "RESOLVED");
  assert.equal(atletico.league, "La Liga");
  assert.equal(atletico.homeTeam, "Atletico Madrid");
  assert.equal(atletico.awayTeam, "Osasuna");
});

test("2 model version mismatch fails closed", () => {
  expectCode(
    () =>
      loadFootballForwardEvidenceReadModel({
        document: validPayload({ FORWARD_MODEL: "football-v31-r1" }),
        identityIndex: new Map(),
      }),
    FORWARD_READ_MODEL_ERROR.FORWARD_MODEL_MISMATCH,
  );
});

test("3 modelSourceHash mismatch fails closed", () => {
  expectCode(
    () =>
      loadFootballForwardEvidenceReadModel({
        document: validPayload({
          included: [includedRow({ modelSourceHash: HASH_D })],
        }),
        identityIndex: new Map(),
      }),
    FORWARD_READ_MODEL_ERROR.FORWARD_MODEL_HASH_MISMATCH,
  );
});

test("4 correct + wrong != graded fails closed", () => {
  const payload = validPayload();
  (payload.counts as { correct: number }).correct = 0;
  (payload.counts as { wrong: number }).wrong = 0;
  (payload.counts as { accuracy: number }).accuracy = 0;
  expectCode(
    () =>
      loadFootballForwardEvidenceReadModel({
        document: payload,
        identityIndex: new Map(),
      }),
    FORWARD_READ_MODEL_ERROR.FORWARD_COUNT_MISMATCH,
  );
});

test("5 duplicate fixtureId fails closed", () => {
  expectCode(
    () =>
      loadFootballForwardEvidenceReadModel({
        document: validPayload({
          included: [includedRow(), includedRow()],
        }),
        identityIndex: new Map(),
      }),
    FORWARD_READ_MODEL_ERROR.FORWARD_DUPLICATE_FIXTURE,
  );
});

test("6 probabilities out of range fail closed", () => {
  expectCode(
    () =>
      loadFootballForwardEvidenceReadModel({
        document: validPayload({
          included: [includedRow({ pHome: 1.2, pDraw: 0, pAway: 0 })],
        }),
        identityIndex: new Map(),
      }),
    FORWARD_READ_MODEL_ERROR.FORWARD_PROBABILITY_INVALID,
  );
});

test("7 probability sum invalid fails closed", () => {
  expectCode(
    () =>
      loadFootballForwardEvidenceReadModel({
        document: validPayload({
          included: [includedRow({ pHome: 0.5, pDraw: 0.5, pAway: 0.5 })],
        }),
        identityIndex: new Map(),
      }),
    FORWARD_READ_MODEL_ERROR.FORWARD_PROBABILITY_INVALID,
  );
});

test("8 prediction timestamp >= kickoff fails closed", () => {
  expectCode(
    () =>
      loadFootballForwardEvidenceReadModel({
        document: validPayload({
          included: [includedRow({ predictionCreatedAt: KICKOFF })],
        }),
        identityIndex: new Map(),
      }),
    FORWARD_READ_MODEL_ERROR.FORWARD_PREGAME_INTEGRITY_FAILED,
  );
});

test("9 sealedAt >= kickoff fails closed", () => {
  expectCode(
    () =>
      loadFootballForwardEvidenceReadModel({
        document: validPayload({
          included: [includedRow({ sealedAt: KICKOFF })],
        }),
        identityIndex: new Map(),
      }),
    FORWARD_READ_MODEL_ERROR.FORWARD_PREGAME_INTEGRITY_FAILED,
  );
});

test("10 ODDS_USED=true fails closed", () => {
  expectCode(
    () =>
      loadFootballForwardEvidenceReadModel({
        document: validPayload({
          included: [includedRow({ ODDS_USED: true })],
        }),
        identityIndex: new Map(),
      }),
    FORWARD_READ_MODEL_ERROR.FORWARD_FORBIDDEN_INPUT_USED,
  );
});

test("11 TARGET_RESULT_DATA_USED=true fails closed", () => {
  expectCode(
    () =>
      loadFootballForwardEvidenceReadModel({
        document: validPayload({
          included: [includedRow({ TARGET_RESULT_DATA_USED: true })],
        }),
        identityIndex: new Map(),
      }),
    FORWARD_READ_MODEL_ERROR.FORWARD_FORBIDDEN_INPUT_USED,
  );
});

test("12 MARKET_USED=true fails closed", () => {
  expectCode(
    () =>
      loadFootballForwardEvidenceReadModel({
        document: validPayload({
          included: [includedRow({ MARKET_USED: true })],
        }),
        identityIndex: new Map(),
      }),
    FORWARD_READ_MODEL_ERROR.FORWARD_FORBIDDEN_INPUT_USED,
  );
});

test("13 PROVIDER_PREDICTION_USED=true fails closed", () => {
  expectCode(
    () =>
      loadFootballForwardEvidenceReadModel({
        document: validPayload({
          included: [includedRow({ PROVIDER_PREDICTION_USED: true })],
        }),
        identityIndex: new Map(),
      }),
    FORWARD_READ_MODEL_ERROR.FORWARD_FORBIDDEN_INPUT_USED,
  );
});

test("14 official evidence missing fails closed with no R1 fallback", () => {
  expectCode(
    () =>
      loadFootballForwardEvidenceReadModel({
        evalRel: "data/audits/football-forward-cumulative-evaluation-MISSING-v1.json",
        identityIndex: new Map(),
      }),
    FORWARD_READ_MODEL_ERROR.FORWARD_EVAL_MISSING,
  );
});

test("15 missing identity keeps the event UNRESOLVED", () => {
  const model = loadFootballForwardEvidenceReadModel({
    document: validPayload({
      included: [includedRow({ fixtureId: 9999999 })],
    }),
    identityIndex: new Map(),
  });
  assert.equal(model.gradedEvents.length, 1);
  assert.equal(model.gradedEvents[0].fixtureId, 9999999);
  assert.equal(model.gradedEvents[0].identityStatus, "UNRESOLVED");
  assert.equal(model.gradedEvents[0].league, null);
  assert.equal(model.gradedEvents[0].homeTeam, null);
  assert.equal(model.gradedEvents[0].awayTeam, null);
});

test("16 no network or provider invocation", () => {
  const source = readModelSource();
  for (const forbidden of [
    "api-football-provider",
    "get-football-provider",
    "dummy-football-provider",
    "the-odds-api",
    "v31-internal-research-console",
    "forward-shadow-v1",
    "predictFootball",
    "load-console-v1",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.equal(/\bfetch\s*\(/.test(source), false);
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = ((..._args: unknown[]) => {
    fetchCalls += 1;
    throw new Error("NETWORK_FORBIDDEN");
  }) as typeof fetch;
  try {
    loadFootballForwardEvidenceReadModel();
    loadFootballForwardEvidenceReadModel({
      document: validPayload(),
      identityIndex: new Map(),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(fetchCalls, 0);
});
