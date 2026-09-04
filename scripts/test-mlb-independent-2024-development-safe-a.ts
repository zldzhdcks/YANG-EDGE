/**
 * 2024 development-visible SAFE_A subset tests.
 * Streaming extract. Holdout Feature objects never JSON.parse'd.
 *
 *   npm run test:mlb-independent-2024-development-safe-a
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { independentSafeAFeatureArtifactPath } from "../src/lib/mlb/independent-safe-a-v1/historical-source";
import { hashIndependentFeatureRowV1 } from "../src/lib/mlb/independent-safe-a-v1/materialize";
import {
  hashIndependentSplitManifestV1,
  independentSplitArtifactPath,
  type IndependentSplitArtifactV1,
} from "../src/lib/mlb/independent-split-v1";
import {
  MLB_INDEPENDENT_ENGINE_ADMISSION,
  MLB_INDEPENDENT_FEATURE_BUILDER_VERSION,
  MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1,
  MLB_INDEPENDENT_FEATURE_SCHEMA_V1,
  type MlbIndependentFeatureRowV1,
} from "../src/lib/mlb/independent-model-v1";
import {
  MLB_INDEPENDENT_2024_SEALED_SAFE_A_SHA256,
  MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_SHA256,
  MultiseasonStabilityError,
  extract2024DevelopmentSafeAFromBytes,
  extractIdentityGamePk,
  findTopLevelRowsArrayStart,
  hash2024DevelopmentSafeASubsetArtifact,
  hashMultiseasonStabilityBytes,
  independent2024DevelopmentSafeASubsetPath,
  iterateTopLevelArrayObjects,
  serializeMultiseasonStabilityJson,
  skipJsonValue,
} from "../src/lib/mlb/independent-multiseason-stability-v1";

const ROOT = process.cwd();
const LIB_FILE = path.join(
  ROOT,
  "src/lib/mlb/independent-multiseason-stability-v1/extract-2024-development-safe-a.ts",
);
const SCRIPT_FILE = path.join(
  ROOT,
  "scripts/materialize-mlb-independent-2024-development-safe-a.ts",
);
const HOLDOUT_SENTINEL = 0.4242424242424242;

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function teamSide(over: { winRateBefore?: number | null } = {}): MlbIndependentFeatureRowV1["home"] {
  return {
    gamesPlayedBefore: 2,
    winsBefore: 1,
    lossesBefore: 1,
    winRateBefore: over.winRateBefore === undefined ? 0.5 : over.winRateBefore,
    last5WinsBefore: 1,
    last5LossesBefore: 1,
    last5WinRateBefore: 0.5,
    runsScoredAverageBefore: 4,
    runsAllowedAverageBefore: 3,
    last5RunsScoredAverageBefore: 4,
    last5RunsAllowedAverageBefore: 3,
    homeWinRateBefore: 0.5,
    awayWinRateBefore: 0.5,
    currentWinStreakBefore: 1,
    currentLossStreakBefore: 0,
    restDaysBefore: 1,
  };
}

function featureRow(
  gamePk: number,
  officialDate: string,
  over: { winRateBefore?: number | null; note?: string } = {},
): MlbIndependentFeatureRowV1 {
  const row: MlbIndependentFeatureRowV1 = {
    schemaVersion: MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1,
    identity: {
      gamePk,
      officialDate,
      homeTeamId: 111,
      awayTeamId: 147,
      commenceTimeUtc: `${officialDate}T17:05:00.000Z`,
    },
    featureClass: "SAFE_HISTORICALLY_RECONSTRUCTABLE",
    temporalPolicy: "HISTORICAL_RECONSTRUCTION_D1",
    temporalPhase: "HISTORICAL_RECONSTRUCTION",
    statsThroughDate: "2024-04-01",
    asOf: "2024-04-01",
    cutoffTime: over.note ?? null,
    home: teamSide({ winRateBefore: over.winRateBefore }),
    away: teamSide(),
    headToHeadGamesBefore: 0,
    headToHeadHomeWinsBefore: 0,
    headToHeadAwayWinsBefore: 0,
    featureHash: null,
  };
  row.featureHash = hashIndependentFeatureRowV1(row);
  return row;
}

function featureArtifact(rows: MlbIndependentFeatureRowV1[]) {
  return {
    schemaVersion: MLB_INDEPENDENT_FEATURE_SCHEMA_V1,
    builderVersion: MLB_INDEPENDENT_FEATURE_BUILDER_VERSION,
    researchOnly: true as const,
    independentModelSample: 0 as const,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    datasetReady: false as const,
    temporalPolicy: "HISTORICAL_RECONSTRUCTION_D1" as const,
    featureClass: "SAFE_HISTORICALLY_RECONSTRUCTABLE" as const,
    writeOnce: true as const,
    rows,
  };
}

function splitFor(pks: {
  train: number[];
  validation: number[];
  holdout: number[];
}): IndependentSplitArtifactV1 {
  const boundaries = {
    trainStartDate: "2024-03-20",
    trainEndDate: "2024-07-19",
    validationStartDate: "2024-07-20",
    validationEndDate: "2024-08-24",
    holdoutStartDate: "2024-08-25",
    holdoutEndDate: "2024-09-30",
  };
  const sourceJoinArtifactHash = "aa".repeat(32);
  const splitManifestHash = hashIndependentSplitManifestV1({
    sourceJoinArtifactHash,
    boundaries,
    trainGamePks: pks.train,
    validationGamePks: pks.validation,
    holdoutGamePks: pks.holdout,
  });
  return {
    schemaVersion: "mlb-independent-chronological-split-v1",
    builderVersion: "mlb-independent-split-v1",
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    sourceJoinArtifactHash,
    independentModelSample: pks.train.length + pks.validation.length + pks.holdout.length,
    splitReady: true,
    datasetReady: true,
    policy: "CHRONOLOGICAL_OFFICIAL_DATE_60_20_20",
    boundaries,
    counts: {
      train: pks.train.length,
      validation: pks.validation.length,
      holdout: pks.holdout.length,
      total: pks.train.length + pks.validation.length + pks.holdout.length,
    },
    trainGamePks: pks.train,
    validationGamePks: pks.validation,
    holdoutGamePks: pks.holdout,
    splitManifestHash,
  };
}

function assertThrowsCode(fn: () => unknown, code: string, label: string): void {
  try {
    fn();
  } catch (e) {
    const err = e as { code?: string; message?: string };
    assert.equal(
      err.code,
      code,
      `${label}: expected ${code}, got ${err.code} (${err.message})`,
    );
    return;
  }
  assert.fail(`${label}: expected throw ${code}`);
}

function main(): void {
  const tricky = `{
  "rows": [
    {"identity":{"gamePk":11},"note":"he said \\"hello\\" and used C:\\\\path","nested":{"a":[1,{"b":"} extra {"}],"arr":[{"x":1}]}},
    {"identity":{"gamePk":22},"home":{"winRateBefore":${HOLDOUT_SENTINEL}}}
  ]
}`;
  const rowsStart = findTopLevelRowsArrayStart(tricky);
  const rawRows: string[] = [];
  iterateTopLevelArrayObjects(tricky, rowsStart, (raw) => rawRows.push(raw));
  assert.equal(rawRows.length, 2);
  assert.equal(extractIdentityGamePk(rawRows[0]!), 11);
  assert.equal(extractIdentityGamePk(rawRows[1]!), 22);
  assert.equal(rawRows[0]!.includes("hello"), true);
  assert.equal(rawRows[0]!.includes("C:\\\\path") || rawRows[0]!.includes("C:\\path"), true);
  const afterFirst = skipJsonValue(tricky, rowsStart);
  assert.equal(typeof afterFirst, "number");
  console.log("SCANNER_NESTED_ESCAPED_BOUNDARIES = PASS");

  const train = featureRow(101, "2024-04-02");
  const validation = featureRow(202, "2024-08-01");
  const holdout = featureRow(303, "2024-09-01", { winRateBefore: HOLDOUT_SENTINEL });
  const shuffled = featureArtifact([holdout, validation, train]);
  const bytes = Buffer.from(serializeMultiseasonStabilityJson(shuffled), "utf8");
  const membership = splitFor({
    train: [101],
    validation: [202],
    holdout: [303],
  });

  const parsedPayloads: string[] = [];
  const realParse = JSON.parse;
  (JSON as unknown as { parse: typeof JSON.parse }).parse = ((
    text: string,
    reviver?: (this: unknown, key: string, value: unknown) => unknown,
  ) => {
    parsedPayloads.push(text);
    return realParse(text, reviver);
  }) as typeof JSON.parse;
  let extracted;
  try {
    extracted = extract2024DevelopmentSafeAFromBytes(bytes, membership);
  } finally {
    (JSON as unknown as { parse: typeof JSON.parse }).parse = realParse;
  }

  assert.equal(extracted.artifact.rows.length, 2);
  assert.equal(extracted.audit.developmentRowsOutput, 2);
  assert.equal(extracted.audit.holdoutRowsSkippedWithoutFeatureParse, 1);
  assert.equal(extracted.audit.holdoutFeatureObjectsParsed, 0);
  assert.equal(extracted.audit.fullArtifactJsonParsed, false);
  assert.equal(extracted.audit.holdoutRowsWritten, 0);
  assert.equal(
    extracted.artifact.rows.some((r) => r.identity.gamePk === 303),
    false,
  );
  assert.equal(
    extracted.artifact.rows.map((r) => r.identity.gamePk).join(","),
    "101,202",
  );
  for (const payload of parsedPayloads) {
    assert.equal(
      payload.includes(String(HOLDOUT_SENTINEL)),
      false,
      "Holdout Feature object JSON.parse is not used",
    );
    const hasRowsAndAllPks =
      payload.includes('"rows"') &&
      payload.includes("101") &&
      payload.includes("202") &&
      payload.includes("303") &&
      payload.includes("winRateBefore");
    assert.equal(hasRowsAndAllPks, false, "full artifact JSON.parse is not used");
  }
  console.log("HOLDOUT_FEATURE_OBJECT_JSON_PARSE = NOT_USED");
  console.log("FULL_ARTIFACT_JSON_PARSE = NOT_USED");
  console.log("HOLDOUT_OUTPUT_BLOCK = PASS");

  const resorted = extract2024DevelopmentSafeAFromBytes(
    Buffer.from(
      serializeMultiseasonStabilityJson(featureArtifact([validation, holdout, train])),
      "utf8",
    ),
    membership,
    { generatedAt: "2026-09-04T00:00:00.000Z" },
  );
  const baseline = extract2024DevelopmentSafeAFromBytes(bytes, membership, {
    generatedAt: "2026-09-04T00:00:00.000Z",
  });
  assert.deepEqual(resorted.artifact.rows, baseline.artifact.rows);
  assert.equal(
    hash2024DevelopmentSafeASubsetArtifact(resorted.artifact),
    hash2024DevelopmentSafeASubsetArtifact(baseline.artifact),
  );
  for (let i = 1; i < baseline.artifact.rows.length; i += 1) {
    const prev = baseline.artifact.rows[i - 1]!.identity;
    const cur = baseline.artifact.rows[i]!.identity;
    const ordered =
      prev.officialDate < cur.officialDate ||
      (prev.officialDate === cur.officialDate &&
        (prev.commenceTimeUtc < cur.commenceTimeUtc ||
          (prev.commenceTimeUtc === cur.commenceTimeUtc && prev.gamePk < cur.gamePk)));
    assert.equal(ordered, true);
  }
  console.log("OUTPUT_SORT_ORDER = PASS");
  console.log("DEVELOPMENT_SUBSET_DETERMINISM = PASS");

  assertThrowsCode(
    () =>
      extract2024DevelopmentSafeAFromBytes(bytes, membership, {
        expectedFeatureSha256: "ff".repeat(32),
      }),
    "FEATURE_SHA_PIN_MISMATCH",
    "feature sha",
  );
  assertThrowsCode(
    () =>
      extract2024DevelopmentSafeAFromBytes(bytes, membership, {
        expectedSplitManifestHash: "ff".repeat(32),
      }),
    "SPLIT_MANIFEST_PIN_MISMATCH",
    "split pin",
  );
  const overlapTv = splitFor({ train: [101, 202], validation: [202], holdout: [303] });
  assertThrowsCode(
    () => extract2024DevelopmentSafeAFromBytes(bytes, overlapTv),
    "TRAIN_VALIDATION_OVERLAP",
    "train/validation overlap",
  );
  const overlapDh = splitFor({ train: [101], validation: [202], holdout: [202] });
  assertThrowsCode(
    () => extract2024DevelopmentSafeAFromBytes(bytes, overlapDh),
    "DEVELOPMENT_HOLDOUT_OVERLAP",
    "development/holdout overlap",
  );
  const missingDev = splitFor({ train: [101, 999], validation: [202], holdout: [303] });
  assertThrowsCode(
    () => extract2024DevelopmentSafeAFromBytes(bytes, missingDev),
    "MISSING_DEVELOPMENT_GAME_PK",
    "missing development",
  );
  const unknown = splitFor({ train: [101], validation: [202], holdout: [] });
  assertThrowsCode(
    () => extract2024DevelopmentSafeAFromBytes(bytes, unknown),
    "UNKNOWN_GAME_PK",
    "unknown gamePk",
  );
  const dupBytes = Buffer.from(
    serializeMultiseasonStabilityJson(featureArtifact([train, clone(train), validation, holdout])),
    "utf8",
  );
  assertThrowsCode(
    () => extract2024DevelopmentSafeAFromBytes(dupBytes, membership),
    "DUPLICATE_OUTPUT_GAME_PK",
    "duplicate output",
  );
  console.log("MEMBERSHIP_AND_PIN_BLOCKS = PASS");

  const libText = readFileSync(LIB_FILE, "utf8");
  const scriptText = readFileSync(SCRIPT_FILE, "utf8");
  for (const text of [libText, scriptText]) {
    assert.equal(text.includes("independent-logistic-v1"), false);
    assert.equal(text.includes("independent-logistic-v2a"), false);
    assert.equal(text.includes("independent-logistic-v2b"), false);
    assert.equal(text.includes("independent-logistic-v2c"), false);
    assert.equal(text.includes("independent-label-v1"), false);
    assert.equal(text.includes("getRawStatsJson"), false);
    assert.equal(text.includes("statsapi.mlb.com"), false);
    assert.equal(text.includes("the-odds-api"), false);
    assert.equal(text.includes("oddsapi"), false);
    assert.equal(text.includes("fetch("), false);
    assert.equal(text.includes("JSON.parse(utf8)"), false);
    assert.equal(text.includes("JSON.parse(featureBytes"), false);
    assert.equal(text.includes("rocAuc"), false);
    assert.equal(text.includes("logLoss"), false);
    assert.equal(text.includes("brier"), false);
  }
  assert.equal(libText.includes("parseDevelopmentFeatureRow"), true);
  console.log("NO_MODEL_IMPORTS = PASS");
  console.log("NO_LABELS = PASS");
  console.log("NO_MARKET = PASS");
  console.log("NO_STATISTICS_METRICS = PASS");
  console.log("NETWORK_USED = NO");

  const featurePath = independentSafeAFeatureArtifactPath();
  const splitPath = independentSplitArtifactPath();
  assert.equal(sha256File(featurePath), MLB_INDEPENDENT_2024_SEALED_SAFE_A_SHA256);
  const sealedSplit = JSON.parse(readFileSync(splitPath, "utf8")) as IndependentSplitArtifactV1;
  assert.equal(sealedSplit.splitManifestHash, MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_SHA256);
  assert.equal(sealedSplit.trainGamePks.length, 1463);
  assert.equal(sealedSplit.validationGamePks.length, 483);
  assert.equal(sealedSplit.holdoutGamePks.length, 483);
  const sealedBytes = readFileSync(featurePath);
  assert.equal(hashMultiseasonStabilityBytes(sealedBytes), MLB_INDEPENDENT_2024_SEALED_SAFE_A_SHA256);

  const sealedParsedPayloads: string[] = [];
  (JSON as unknown as { parse: typeof JSON.parse }).parse = ((
    text: string,
    reviver?: (this: unknown, key: string, value: unknown) => unknown,
  ) => {
    sealedParsedPayloads.push(typeof text === "string" ? text : String(text));
    return realParse(text, reviver);
  }) as typeof JSON.parse;
  let sealed;
  try {
    sealed = extract2024DevelopmentSafeAFromBytes(sealedBytes, sealedSplit, {
      expectedFeatureSha256: MLB_INDEPENDENT_2024_SEALED_SAFE_A_SHA256,
      expectedSplitManifestHash: MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_SHA256,
      generatedAt: "2026-09-04T00:00:00.000Z",
    });
  } finally {
    (JSON as unknown as { parse: typeof JSON.parse }).parse = realParse;
  }

  assert.equal(sealed.audit.fullFeatureRowsSealed, 2429);
  assert.equal(sealed.audit.trainMembership, 1463);
  assert.equal(sealed.audit.validationMembership, 483);
  assert.equal(sealed.audit.developmentMembership, 1946);
  assert.equal(sealed.audit.holdoutMembership, 483);
  assert.equal(sealed.audit.developmentRowsOutput, 1946);
  assert.equal(sealed.audit.holdoutRowsSkippedWithoutFeatureParse, 483);
  assert.equal(sealed.audit.holdoutFeatureObjectsParsed, 0);
  assert.equal(sealed.audit.holdoutRowsWritten, 0);
  assert.equal(sealed.audit.missingDevelopmentGamePkCount, 0);
  assert.equal(sealed.audit.unknownGamePkCount, 0);
  assert.equal(sealed.audit.duplicateOutputGamePkCount, 0);
  assert.equal(sealed.audit.featureHashVerifiedCount, 1946);
  assert.equal(sealed.audit.featureHashMismatchCount, 0);
  assert.equal(sealed.audit.fullArtifactJsonParsed, false);
  assert.equal(sealed.audit.labelsRead, false);
  assert.equal(sealed.audit.modelsRead, false);
  assert.equal(sealed.audit.stabilityStatisticsCalculated, false);
  assert.equal(sealed.artifact.rows.length, 1946);
  assert.equal(sealed.artifact.datasetReady, false);
  assert.equal(sealed.artifact.researchOnly, true);
  const outPks = new Set(sealed.artifact.rows.map((r) => r.identity.gamePk));
  assert.equal(outPks.size, 1946);
  for (const pk of sealedSplit.holdoutGamePks) {
    assert.equal(outPks.has(pk), false);
  }
  for (const pk of sealedSplit.trainGamePks) assert.equal(outPks.has(pk), true);
  for (const pk of sealedSplit.validationGamePks) assert.equal(outPks.has(pk), true);
  const holdoutPkSet = new Set(sealedSplit.holdoutGamePks);
  for (const payload of sealedParsedPayloads) {
    if (!payload.startsWith("{") || payload.length < 200) continue;
    if (!payload.includes('"home"') || !payload.includes("winRateBefore")) continue;
    const parsedPk = (realParse(payload) as { identity?: { gamePk?: number } }).identity?.gamePk;
    if (parsedPk != null) {
      assert.equal(holdoutPkSet.has(parsedPk), false, `parsed holdout feature row ${parsedPk}`);
    }
  }
  assert.equal(sha256File(featurePath), MLB_INDEPENDENT_2024_SEALED_SAFE_A_SHA256);
  assert.equal(sha256File(splitPath), sha256File(splitPath));
  console.log("SEALED_1946_COVERAGE = PASS");
  console.log("FEATURE_HASH_VERIFICATION = PASS");
  console.log("FULL_2024_SAFE_A_UNCHANGED = PASS");

  if (existsSync(independent2024DevelopmentSafeASubsetPath())) {
    const persisted = JSON.parse(
      readFileSync(independent2024DevelopmentSafeASubsetPath(), "utf8"),
    );
    assert.equal(persisted.rows.length, 1946);
    assert.equal(
      hash2024DevelopmentSafeASubsetArtifact(persisted),
      hash2024DevelopmentSafeASubsetArtifact(sealed.artifact),
    );
  }

  console.log("test:mlb-independent-2024-development-safe-a PASS");
}

main();
