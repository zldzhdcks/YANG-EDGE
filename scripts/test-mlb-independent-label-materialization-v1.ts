/**
 * MLB Independent HOME_WIN label materialization tests.
 * No network. No feature mutation, join, trainer, or engine wiring.
 *
 *   npm run test:mlb-independent-label-materialization-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  validateIndependentLabelArtifactV1,
  validateIndependentLabelRowV1,
} from "../src/lib/mlb/independent-model-v1";
import {
  findLabelRow,
  independentLabelArtifactPath,
  independentLabelAuditPath,
  materializeIndependentLabelsV1,
} from "../src/lib/mlb/independent-label-v1";
import {
  buildHistoricalSourceArtifact,
  independentSafeAFeatureArtifactPath,
  independentSafeAHistoricalSourcePath,
  type MlbIndependentSafeAHistoricalGameV1,
  type MlbIndependentSafeAHistoricalSourceV1,
} from "../src/lib/mlb/independent-safe-a-v1/historical-source";

const ROOT = process.cwd();
const LIB_DIR = path.join(ROOT, "src/lib/mlb/independent-label-v1");
const FEATURE_BEFORE =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
const SOURCE_BEFORE =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function game(
  over: Partial<MlbIndependentSafeAHistoricalGameV1> &
    Pick<
      MlbIndependentSafeAHistoricalGameV1,
      "gamePk" | "officialDate" | "homeTeamId" | "awayTeamId" | "homeScore" | "awayScore"
    >,
): MlbIndependentSafeAHistoricalGameV1 {
  const hour = 17 + (over.gamePk % 6);
  return {
    commenceTimeUtc: `${over.officialDate}T${String(hour).padStart(2, "0")}:05:00.000Z`,
    gameType: "R",
    abstractGameState: "Final",
    detailedState: "Final",
    codedGameState: "F",
    statusCode: "F",
    doubleHeader: "N",
    gameNumber: 1,
    ifNecessary: "N",
    safeResultApplyDate: null,
    resultProvenanceStatus: "NOT_APPLICABLE",
    ...over,
  };
}

function sourceFrom(
  games: MlbIndependentSafeAHistoricalGameV1[],
): MlbIndependentSafeAHistoricalSourceV1 {
  return buildHistoricalSourceArtifact({
    games,
    collectedAt: "2026-09-02T00:00:00.000Z",
  });
}

function cloneSource(
  src: MlbIndependentSafeAHistoricalSourceV1,
): MlbIndependentSafeAHistoricalSourceV1 {
  return JSON.parse(JSON.stringify(src)) as MlbIndependentSafeAHistoricalSourceV1;
}

function patchGame(
  src: MlbIndependentSafeAHistoricalSourceV1,
  gamePk: number,
  over: Partial<MlbIndependentSafeAHistoricalGameV1>,
): MlbIndependentSafeAHistoricalSourceV1 {
  const copy = cloneSource(src);
  const row = copy.games.find((g) => g.gamePk === gamePk);
  assert.ok(row, `missing gamePk ${gamePk}`);
  Object.assign(row!, over);
  return copy;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = (i * 7 + 3) % (i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

function walkKeys(value: unknown, visit: (key: string) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item) => walkKeys(item, visit));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    visit(key);
    walkKeys(child, visit);
  }
}

function main(): void {
  const homeWin = sourceFrom([
    game({
      gamePk: 1,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: 5,
      awayScore: 2,
    }),
  ]);
  const homeWinResult = materializeIndependentLabelsV1(homeWin);
  const homeRow = findLabelRow(homeWinResult.artifact, 1);
  assert.ok(homeRow);
  assert.equal(homeRow.winner, "HOME");
  assert.equal(homeRow.target, 1);
  assert.equal(homeRow.identity.officialDate, "2024-04-01");
  assert.equal(homeRow.identity.homeTeamId, 101);
  assert.equal(homeRow.identity.awayTeamId, 102);
  assert.equal(validateIndependentLabelRowV1(homeRow).ok, true);

  const awayWin = sourceFrom([
    game({
      gamePk: 2,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: 2,
      awayScore: 5,
    }),
  ]);
  const awayRow = findLabelRow(materializeIndependentLabelsV1(awayWin).artifact, 2);
  assert.ok(awayRow);
  assert.equal(awayRow.winner, "AWAY");
  assert.equal(awayRow.target, 0);

  const mutated = materializeIndependentLabelsV1(
    patchGame(homeWin, 1, { homeScore: 2, awayScore: 5 }),
  );
  const mutatedRow = findLabelRow(mutated.artifact, 1);
  assert.equal(homeRow.target, 1);
  assert.equal(mutatedRow?.target, 0);
  assert.equal(mutatedRow?.winner, "AWAY");
  console.log("LABEL_RESPONDS_TO_RESULT_MUTATION = PASS");

  function excludeReason(
    over: Partial<MlbIndependentSafeAHistoricalGameV1> &
      Pick<
        MlbIndependentSafeAHistoricalGameV1,
        "gamePk" | "officialDate" | "homeTeamId" | "awayTeamId" | "homeScore" | "awayScore"
      >,
    reason: string,
  ): void {
    const result = materializeIndependentLabelsV1(sourceFrom([game(over)]));
    assert.equal(result.artifact.rows.length, 0, reason);
    assert.equal(result.excluded[0]?.reason, reason);
  }

  excludeReason(
    {
      gamePk: 10,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: null,
      awayScore: null,
      abstractGameState: "Final",
      detailedState: "Cancelled",
      codedGameState: "C",
      statusCode: "C",
    },
    "CANCELLED",
  );
  excludeReason(
    {
      gamePk: 11,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: null,
      awayScore: null,
      abstractGameState: "Final",
      detailedState: "Postponed",
      codedGameState: "N",
      statusCode: "N",
    },
    "POSTPONED",
  );
  excludeReason(
    {
      gamePk: 12,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: 1,
      awayScore: 0,
      abstractGameState: "Suspended",
      detailedState: "Suspended",
      codedGameState: "U",
      statusCode: "U",
    },
    "SUSPENDED",
  );
  excludeReason(
    {
      gamePk: 13,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: null,
      awayScore: null,
      abstractGameState: "Live",
      detailedState: "In Progress",
      codedGameState: "I",
      statusCode: "I",
    },
    "NOT_FINAL",
  );
  excludeReason(
    {
      gamePk: 14,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: null,
      awayScore: null,
      abstractGameState: "",
      detailedState: "",
      codedGameState: "",
      statusCode: "",
    },
    "UNKNOWN",
  );
  excludeReason(
    {
      gamePk: 15,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: 3,
      awayScore: 3,
    },
    "TIED_FINAL",
  );
  excludeReason(
    {
      gamePk: 16,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: null,
      awayScore: null,
    },
    "INVALID_SCORE",
  );

  const shuffledBase = sourceFrom([
    game({
      gamePk: 21,
      officialDate: "2024-04-02",
      homeTeamId: 103,
      awayTeamId: 104,
      homeScore: 4,
      awayScore: 1,
      commenceTimeUtc: "2024-04-02T20:10:00.000Z",
    }),
    game({
      gamePk: 20,
      officialDate: "2024-04-01",
      homeTeamId: 101,
      awayTeamId: 102,
      homeScore: 5,
      awayScore: 2,
      commenceTimeUtc: "2024-04-01T17:05:00.000Z",
    }),
    game({
      gamePk: 22,
      officialDate: "2024-04-01",
      homeTeamId: 105,
      awayTeamId: 106,
      homeScore: 0,
      awayScore: 1,
      commenceTimeUtc: "2024-04-01T23:10:00.000Z",
    }),
  ]);
  const ordered = materializeIndependentLabelsV1(shuffledBase);
  const shuffledSrc = cloneSource(shuffledBase);
  shuffledSrc.games = shuffle(shuffledSrc.games);
  const shuffled = materializeIndependentLabelsV1(shuffledSrc);
  assert.deepEqual(
    shuffled.artifact.rows.map((r) => r.identity.gamePk),
    ordered.artifact.rows.map((r) => r.identity.gamePk),
  );
  assert.deepEqual(shuffled.artifact.rows, ordered.artifact.rows);
  console.log("SHUFFLED_SOURCE_LABELS_IDENTICAL = PASS");

  const resume = sourceFrom([
    game({
      gamePk: 9300,
      officialDate: "2024-06-01",
      homeTeamId: 111,
      awayTeamId: 141,
      homeScore: 1,
      awayScore: 4,
      commenceTimeUtc: "2024-08-01T18:05:00.000Z",
      resumeDate: "2024-08-01T18:05:00.000Z",
      resumeGameDate: "2024-08-01",
      resumedFrom: "2024-06-01T23:10:00.000Z",
      resumedFromDate: "2024-06-01",
    }),
  ]);
  const resumeLabel = findLabelRow(
    materializeIndependentLabelsV1(resume).artifact,
    9300,
  );
  assert.ok(resumeLabel);
  assert.equal(resumeLabel.identity.officialDate, "2024-06-01");
  assert.equal(resumeLabel.winner, "AWAY");
  assert.equal(resumeLabel.target, 0);
  assert.equal("safeResultApplyDate" in resumeLabel, false);

  walkKeys(ordered.artifact, (key) => {
    const token = key.toLowerCase();
    assert.equal(token.includes("odds"), false, `odds key ${key}`);
    assert.equal(token.includes("market"), false, `market key ${key}`);
    assert.equal(token === "edge", false);
  });
  assert.equal(validateIndependentLabelArtifactV1(ordered.artifact).ok, true);

  const libFiles = ["materialize.ts", "index.ts"];
  for (const file of libFiles) {
    const text = readFileSync(path.join(LIB_DIR, file), "utf8");
    assert.equal(text.includes("independent-safe-a-v1/materialize"), false);
    assert.equal(text.includes("2024-safe-a-feature-artifact"), false);
    assert.equal(text.includes("materializeIndependentSafeAFeaturesV1"), false);
    assert.equal(text.includes("prediction-v0"), false);
    assert.equal(text.includes("statsapi.mlb.com"), false);
    assert.equal(text.includes("fetch("), false);
    assert.equal(text.includes("logistic"), false);
    assert.equal(text.includes("xgboost"), false);
  }
  console.log("LABEL_BUILDER_IMPORTS_FEATURE_ARTIFACT = NO");
  console.log("LABEL_BUILDER_IMPORTS_FEATURE_MATERIALIZER = NO");
  console.log("LABEL_BUILDER_MUTATES_FEATURE = NO");

  const sourcePath = independentSafeAHistoricalSourcePath();
  const featurePath = independentSafeAFeatureArtifactPath();
  assert.equal(sha256File(sourcePath), SOURCE_BEFORE);
  assert.equal(sha256File(featurePath), FEATURE_BEFORE);
  console.log("HISTORICAL_SOURCE_CHANGED = NO");
  console.log("FEATURE_ARTIFACT_CHANGED = NO");

  const labelPath = independentLabelArtifactPath();
  const auditPath = independentLabelAuditPath();
  if (existsSync(labelPath) && existsSync(auditPath) && existsSync(sourcePath)) {
    const realSource = JSON.parse(readFileSync(sourcePath, "utf8"));
    const realLabels = JSON.parse(readFileSync(labelPath, "utf8"));
    const realAudit = JSON.parse(readFileSync(auditPath, "utf8"));
    const replay = materializeIndependentLabelsV1(realSource, {
      sourcePath:
        "data/research/mlb/independent-model-v1/historical-source/2024-regular-season-v1.json",
      generatedAt: realAudit.generatedAt,
    });
    assert.equal(validateIndependentLabelArtifactV1(realLabels).ok, true);
    assert.equal(replay.artifact.rows.length, realLabels.rows.length);
    assert.deepEqual(
      replay.artifact.rows[0],
      realLabels.rows[0],
    );
    assert.deepEqual(
      replay.artifact.rows[replay.artifact.rows.length - 1],
      realLabels.rows[realLabels.rows.length - 1],
    );
    assert.equal(realLabels.independentModelSample, 0);
    assert.equal(realLabels.datasetReady, false);
    assert.equal(realLabels.target, "HOME_WIN");
    assert.equal(
      realLabels.rows.some(
        (r: { identity: { gamePk: number } }) => r.identity.gamePk === 746577,
      ),
      false,
    );
    assert.equal(realAudit.cancelled.labelCount, 0);
    assert.equal(realAudit.identity.duplicateGamePk, 0);
    assert.equal(realAudit.identity.sourceIdentityMismatch, 0);
    assert.equal(realAudit.researchState.DATASET_READY, false);
    assert.equal(realAudit.researchState.INDEPENDENT_MODEL_SAMPLE, 0);

    const r745180 = realLabels.rows.find(
      (r: { identity: { gamePk: number } }) => r.identity.gamePk === 745180,
    );
    const r746942 = realLabels.rows.find(
      (r: { identity: { gamePk: number } }) => r.identity.gamePk === 746942,
    );
    const r746755 = realLabels.rows.find(
      (r: { identity: { gamePk: number } }) => r.identity.gamePk === 746755,
    );
    assert.equal(r745180.identity.officialDate, "2024-05-21");
    assert.equal(r746942.identity.officialDate, "2024-06-26");
    assert.equal(r746755.identity.officialDate, "2024-08-27");
    assert.equal(r745180.winner, "HOME");
    assert.equal(r745180.target, 1);
    assert.equal(r746942.winner, "AWAY");
    assert.equal(r746942.target, 0);
    assert.equal(r746755.winner, "AWAY");
    assert.equal(r746755.target, 0);

    console.log(`LABEL_ROWS_CREATED=${realLabels.rows.length}`);
    console.log(`HOME_WINNER_COUNT=${realAudit.winnerDistribution.HOME}`);
    console.log(`AWAY_WINNER_COUNT=${realAudit.winnerDistribution.AWAY}`);
    console.log(`TARGET_1_COUNT=${realAudit.targetDistribution["1"]}`);
    console.log(`TARGET_0_COUNT=${realAudit.targetDistribution["0"]}`);
  }

  console.log("test:mlb-independent-label-materialization-v1 PASS");
  console.log("DATASET_READY = false");
  console.log("INDEPENDENT_MODEL_SAMPLE = 0");
}

main();
