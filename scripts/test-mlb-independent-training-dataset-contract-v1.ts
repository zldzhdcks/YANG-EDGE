/**
 * MLB Independent Training Dataset Contract v1 — deterministic tests.
 * Contract only. No dataset materialization, trainer, or network.
 *
 *   npm run test:mlb-independent-training-dataset-contract-v1
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  MLB_INDEPENDENT_AWAY_WIN,
  MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1,
  MLB_INDEPENDENT_CLASS_B_ADMITTED_IN_V1_CORE,
  MLB_INDEPENDENT_CLASS_B_TEMPORAL_POLICY_V1,
  MLB_INDEPENDENT_CONTRACT_STATUS,
  MLB_INDEPENDENT_DATASET_READY,
  MLB_INDEPENDENT_FEATURE_CLASS_A_V1,
  MLB_INDEPENDENT_FEATURE_CLASS_B_V1,
  MLB_INDEPENDENT_FEATURE_CLASS_C_V1,
  MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1,
  MLB_INDEPENDENT_FEATURE_SCHEMA_V1,
  MLB_INDEPENDENT_HOME_WIN,
  MLB_INDEPENDENT_JOIN_CONTRACT_V1,
  MLB_INDEPENDENT_LABEL_EXCLUDED_STATUS_V1,
  MLB_INDEPENDENT_LABEL_ROW_SCHEMA_V1,
  MLB_INDEPENDENT_LABEL_SCHEMA_V1,
  MLB_INDEPENDENT_MODEL_SAMPLE,
  MLB_INDEPENDENT_PROHIBITED_FEATURE_KEYS_V1,
  MLB_INDEPENDENT_SPLIT_CONTRACT_V1,
  MLB_INDEPENDENT_TEMPORAL_POLICY_V1,
  isProhibitedFeatureKey,
  isRealCalendarDate,
  normalizeFeatureKeyToken,
  previousOfficialDate,
  validateIndependentFeatureArtifactV1,
  validateIndependentFeatureRowV1,
  validateIndependentLabelArtifactV1,
  validateIndependentLabelRowV1,
  type MlbIndependentFeatureArtifactV1,
  type MlbIndependentFeatureRowV1,
  type MlbIndependentLabelArtifactV1,
  type MlbIndependentLabelRowV1,
  type MlbIndependentTeamSideFeaturesV1,
} from "../src/lib/mlb/independent-model-v1";

const ROOT = process.cwd();
const MODULE_DIR = path.join(ROOT, "src/lib/mlb/independent-model-v1");

const COMMENCE = "2026-08-17T17:10:00.000Z";
const OFFICIAL = "2026-08-17";
const STATS_D1 = "2026-08-16";

function teamSide(
  over: Partial<MlbIndependentTeamSideFeaturesV1> = {},
): MlbIndependentTeamSideFeaturesV1 {
  return {
    gamesPlayedBefore: 40,
    winsBefore: 22,
    lossesBefore: 18,
    winRateBefore: 0.55,
    last5WinsBefore: 3,
    last5LossesBefore: 2,
    last5WinRateBefore: 0.6,
    runsScoredAverageBefore: 4.4,
    runsAllowedAverageBefore: 3.9,
    last5RunsScoredAverageBefore: 5.0,
    last5RunsAllowedAverageBefore: 3.2,
    homeWinRateBefore: 0.58,
    awayWinRateBefore: 0.52,
    currentWinStreakBefore: 2,
    currentLossStreakBefore: 0,
    restDaysBefore: 1,
    ...over,
  };
}

function validFeatureRow(
  over: Record<string, unknown> = {},
): MlbIndependentFeatureRowV1 {
  const statsThroughDate =
    typeof over.statsThroughDate === "string"
      ? over.statsThroughDate
      : STATS_D1;
  const base: MlbIndependentFeatureRowV1 = {
    schemaVersion: MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1,
    identity: {
      gamePk: 823590,
      officialDate: OFFICIAL,
      homeTeamId: 121,
      awayTeamId: 120,
      commenceTimeUtc: COMMENCE,
    },
    featureClass: "SAFE_HISTORICALLY_RECONSTRUCTABLE",
    temporalPolicy: MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1,
    temporalPhase: "HISTORICAL_RECONSTRUCTION",
    statsThroughDate,
    asOf: statsThroughDate,
    cutoffTime: null,
    home: teamSide(),
    away: teamSide({
      winsBefore: 18,
      lossesBefore: 22,
      winRateBefore: 0.45,
    }),
    headToHeadGamesBefore: 6,
    headToHeadHomeWinsBefore: 4,
    headToHeadAwayWinsBefore: 2,
    featureHash: null,
  };
  return { ...base, ...over } as MlbIndependentFeatureRowV1;
}

function validLabelRow(
  winner: "HOME" | "AWAY",
  over: Record<string, unknown> = {},
): MlbIndependentLabelRowV1 {
  const base: MlbIndependentLabelRowV1 = {
    schemaVersion: MLB_INDEPENDENT_LABEL_ROW_SCHEMA_V1,
    identity: {
      gamePk: 823590,
      officialDate: OFFICIAL,
      homeTeamId: 121,
      awayTeamId: 120,
      commenceTimeUtc: COMMENCE,
    },
    status: "FINAL",
    winner,
    target: winner === "HOME" ? MLB_INDEPENDENT_HOME_WIN : MLB_INDEPENDENT_AWAY_WIN,
    labelSource: "official-result-artifact",
  };
  return { ...base, ...over } as MlbIndependentLabelRowV1;
}

function validFeatureArtifact(
  rows: MlbIndependentFeatureRowV1[],
): MlbIndependentFeatureArtifactV1 {
  return {
    schemaVersion: MLB_INDEPENDENT_FEATURE_SCHEMA_V1,
    builderVersion: "mlb-independent-feature-contract-v1",
    researchOnly: true,
    independentModelSample: 0,
    engineAdmission: "PROHIBITED",
    datasetReady: false,
    temporalPolicy: MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1,
    featureClass: "SAFE_HISTORICALLY_RECONSTRUCTABLE",
    writeOnce: true,
    rows,
  };
}

function validLabelArtifact(
  rows: MlbIndependentLabelRowV1[],
): MlbIndependentLabelArtifactV1 {
  return {
    schemaVersion: MLB_INDEPENDENT_LABEL_SCHEMA_V1,
    builderVersion: "mlb-independent-label-contract-v1",
    researchOnly: true,
    independentModelSample: 0,
    engineAdmission: "PROHIBITED",
    datasetReady: false,
    target: "HOME_WIN",
    labelSource: "official-result-artifact",
    rows,
  };
}

function assertFail(
  result: { ok: boolean; errors: string[] },
  needle: string,
  label: string,
): void {
  assert.equal(result.ok, false, `${label} should fail`);
  assert.ok(
    result.errors.some((e) => e.includes(needle)),
    `${label} expected error containing ${needle}, got: ${result.errors.join(" | ")}`,
  );
}

function assertPass(
  result: { ok: boolean; errors: string[] },
  label: string,
): void {
  assert.equal(result.ok, true, `${label} should pass: ${result.errors.join(" | ")}`);
}

function importedSpecifiers(src: string): string[] {
  const out: string[] = [];
  const re = /\bfrom\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]!);
  return out;
}

function main(): void {
  assert.equal(MLB_INDEPENDENT_CONTRACT_STATUS, "CONTRACT_READY");
  assert.equal(MLB_INDEPENDENT_DATASET_READY, false);
  assert.equal(MLB_INDEPENDENT_MODEL_SAMPLE, 0);
  assert.equal(MLB_INDEPENDENT_JOIN_CONTRACT_V1.joinImplemented, false);
  assert.equal(MLB_INDEPENDENT_SPLIT_CONTRACT_V1.randomRowSplitAllowed, false);
  assert.equal(
    MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1,
    "HISTORICAL_RECONSTRUCTION_D1",
  );
  assert.equal(
    MLB_INDEPENDENT_CLASS_B_TEMPORAL_POLICY_V1,
    "TRUE_PREGAME_SOURCE_BEFORE_CUTOFF",
  );
  assert.notEqual(
    MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1,
    MLB_INDEPENDENT_CLASS_B_TEMPORAL_POLICY_V1,
  );
  assert.equal(MLB_INDEPENDENT_CLASS_B_ADMITTED_IN_V1_CORE, false);
  assert.equal(
    MLB_INDEPENDENT_TEMPORAL_POLICY_V1,
    MLB_INDEPENDENT_CLASS_A_TEMPORAL_POLICY_V1,
  );
  assert.equal(
    MLB_INDEPENDENT_FEATURE_SCHEMA_V1,
    "mlb-independent-feature-artifact-v1",
  );
  assert.equal(
    MLB_INDEPENDENT_LABEL_SCHEMA_V1,
    "mlb-independent-label-artifact-v1",
  );
  assert.notEqual(
    MLB_INDEPENDENT_FEATURE_SCHEMA_V1,
    MLB_INDEPENDENT_LABEL_SCHEMA_V1,
  );
  assert.notEqual(
    MLB_INDEPENDENT_FEATURE_ROW_SCHEMA_V1,
    MLB_INDEPENDENT_LABEL_ROW_SCHEMA_V1,
  );
  assert.ok(MLB_INDEPENDENT_FEATURE_CLASS_A_V1.includes("winRateBefore"));
  assert.ok(
    MLB_INDEPENDENT_FEATURE_CLASS_B_V1.includes("probableStartingPitcherIdentity"),
  );
  assert.ok(MLB_INDEPENDENT_FEATURE_CLASS_C_V1.includes("marketPrior"));
  assert.ok(MLB_INDEPENDENT_FEATURE_CLASS_C_V1.includes("closingOdds"));
  assert.ok(
    (MLB_INDEPENDENT_PROHIBITED_FEATURE_KEYS_V1 as readonly string[]).includes(
      "closingOdds",
    ),
  );
  assert.equal(previousOfficialDate(OFFICIAL), "2026-08-16");
  assert.equal(isRealCalendarDate("2026-08-17"), true);
  assert.equal(isRealCalendarDate("2026-02-31"), false);
  assert.equal(isRealCalendarDate("2024-02-29"), true);

  for (const variant of [
    "marketPrior",
    "MarketPrior",
    "MARKETPRIOR",
    "market_prior",
    "MARKET_PRIOR",
    "market-prior",
    "Market-Prior",
    "market prior",
  ]) {
    assert.equal(normalizeFeatureKeyToken(variant), "marketprior", variant);
    assert.equal(isProhibitedFeatureKey(variant), true, variant);
  }
  for (const variant of ["closingOdds", "closing_odds", "CLOSING_ODDS"]) {
    assert.equal(normalizeFeatureKeyToken(variant), "closingodds", variant);
    assert.equal(isProhibitedFeatureKey(variant), true, variant);
  }
  assert.equal(isProhibitedFeatureKey("winRateBefore"), false);

  // Case A: D-1 statsThroughDate PASS
  const passRow = validFeatureRow();
  assertPass(validateIndependentFeatureRowV1(passRow), "Case A D-1");
  assert.equal(passRow.statsThroughDate, "2026-08-16");
  assert.equal(passRow.asOf, "2026-08-16");
  assert.equal(passRow.temporalPolicy, "HISTORICAL_RECONSTRUCTION_D1");
  assert.equal(passRow.temporalPhase, "HISTORICAL_RECONSTRUCTION");
  assert.equal(passRow.cutoffTime, null);
  assert.equal(passRow.featureHash, null);

  // Case B: D-2 (or earlier) is still leakage-safe
  assertPass(
    validateIndependentFeatureRowV1(
      validFeatureRow({ statsThroughDate: "2026-08-15", asOf: "2026-08-15" }),
    ),
    "Case B D-2",
  );
  assertPass(
    validateIndependentFeatureRowV1(
      validFeatureRow({ statsThroughDate: "2026-08-01", asOf: "2026-08-01" }),
    ),
    "sparse D-16 window",
  );

  // Case C: later reconstruction wall-clock is not a row field and must not fail
  const reconstructed2024 = validFeatureRow({
    identity: {
      gamePk: 745123,
      officialDate: "2024-06-10",
      homeTeamId: 121,
      awayTeamId: 120,
      commenceTimeUtc: "2024-06-10T23:10:00.000Z",
    },
    statsThroughDate: "2024-06-09",
    asOf: "2024-06-09",
    cutoffTime: null,
  });
  assertPass(
    validateIndependentFeatureRowV1(reconstructed2024),
    "Case C 2024 game reconstructed later with D-1 cutoff",
  );

  // asOf instant after commence is allowed when asOf calendar date = statsThroughDate
  assertPass(
    validateIndependentFeatureRowV1(
      validFeatureRow({
        identity: {
          gamePk: 823590,
          officialDate: OFFICIAL,
          homeTeamId: 121,
          awayTeamId: 120,
          commenceTimeUtc: "2026-08-16T20:00:00.000Z",
        },
        statsThroughDate: "2026-08-16",
        asOf: "2026-08-16T23:00:00.000Z",
        cutoffTime: "2026-08-30T00:00:00.000Z",
      }),
    ),
    "Class A asOf/cutoff not live-capture compared to commence",
  );

  // same-day / DH Game 1 → Game 2
  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({ statsThroughDate: OFFICIAL, asOf: OFFICIAL }),
    ),
    "FEATURE_D1_POLICY_VIOLATION",
    "same-day / doubleheader same officialDate",
  );

  // future stats window
  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({ statsThroughDate: "2026-08-18", asOf: "2026-08-18" }),
    ),
    "FEATURE_D1_POLICY_VIOLATION",
    "future statsThroughDate",
  );

  // reconstruction timestamp stuffed into asOf is the wrong semantic
  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({ asOf: "2026-08-30" }),
    ),
    "FEATURE_ASOF_NOT_EQUAL_STATS_THROUGH_DATE",
    "asOf reconstruction wall-clock",
  );

  // PASS: label FINAL HOME / AWAY
  const homeLabel = validLabelRow("HOME");
  const awayLabel = validLabelRow("AWAY");
  assertPass(validateIndependentLabelRowV1(homeLabel), "HOME→1");
  assertPass(validateIndependentLabelRowV1(awayLabel), "AWAY→0");
  assert.equal(homeLabel.target, 1);
  assert.equal(awayLabel.target, 0);

  assertFail(
    validateIndependentLabelRowV1(validLabelRow("HOME", { target: 0 })),
    "LABEL_TARGET_MISMATCH",
    "HOME→0",
  );
  assertFail(
    validateIndependentLabelRowV1(validLabelRow("AWAY", { target: 1 })),
    "LABEL_TARGET_MISMATCH",
    "AWAY→1",
  );
  assertFail(
    validateIndependentLabelRowV1(validLabelRow("HOME", { winner: "DRAW", target: 1 })),
    "LABEL_WINNER_DRAW",
    "DRAW",
  );
  assertFail(
    validateIndependentLabelRowV1(validLabelRow("HOME", { winner: null })),
    "LABEL_WINNER_NULL",
    "null winner",
  );
  for (const status of MLB_INDEPENDENT_LABEL_EXCLUDED_STATUS_V1) {
    assertFail(
      validateIndependentLabelRowV1(validLabelRow("HOME", { status })),
      "LABEL_STATUS_NOT_ELIGIBLE",
      `label ${status}`,
    );
  }

  const featureArt = validFeatureArtifact([passRow]);
  const labelArt = validLabelArtifact([homeLabel]);
  assertPass(validateIndependentFeatureArtifactV1(featureArt), "feature artifact");
  assertPass(validateIndependentLabelArtifactV1(labelArt), "label artifact");
  assert.notEqual(featureArt.schemaVersion, labelArt.schemaVersion);
  assert.equal(featureArt.independentModelSample, 0);
  assert.equal(labelArt.independentModelSample, 0);

  const prohibitedCases: Array<[string, unknown]> = [
    ["marketOdds", 1.91],
    ["marketProbability", 0.54],
    ["marketPrior", 0],
    ["MARKET_PRIOR", 0],
    ["market-prior", 0],
    ["closingOdds", 1.91],
    ["closing_odds", 1.91],
    ["CLOSING_ODDS", 1.91],
    ["valueEdge", 0.04],
    ["homeScore", 3],
    ["awayScore", 2],
    ["actualWinner", "HOME"],
    ["grade", "CORRECT"],
  ];
  for (const [key, injected] of prohibitedCases) {
    assertFail(
      validateIndependentFeatureRowV1({ ...passRow, [key]: injected }),
      "FEATURE_PROHIBITED_KEY",
      `feature.${key}`,
    );
  }
  assertFail(
    validateIndependentFeatureRowV1({ ...passRow, marketPrior: 0 }),
    "FEATURE_PROHIBITED_KEY:marketPrior",
    "marketPrior=0",
  );
  assertFail(
    validateIndependentFeatureRowV1({
      ...passRow,
      home: { ...passRow.home, marketPrior: 0 },
    }),
    "FEATURE_PROHIBITED_KEY:home.marketPrior",
    "nested home.marketPrior=0",
  );
  assertFail(
    validateIndependentFeatureRowV1({
      ...passRow,
      home: { ...passRow.home, MARKET_PRIOR: 0 },
    }),
    "FEATURE_PROHIBITED_KEY",
    "nested home.MARKET_PRIOR",
  );
  assertFail(
    validateIndependentFeatureRowV1({
      ...passRow,
      home: { ...passRow.home, closing_odds: 1.9 },
    }),
    "FEATURE_PROHIBITED_KEY",
    "nested home.closing_odds",
  );
  assertFail(
    validateIndependentFeatureRowV1({
      ...passRow,
      injection: { market: { odds: 1.9 } },
    } as unknown as MlbIndependentFeatureRowV1),
    "FEATURE_PROHIBITED_KEY",
    "nested injection.market",
  );

  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({ identity: { ...passRow.identity, gamePk: 0 } }),
    ),
    "INVALID_GAME_PK",
    "invalid gamePk",
  );
  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({ identity: { ...passRow.identity, homeTeamId: 0 } }),
    ),
    "INVALID_HOME_TEAM_ID",
    "homeTeamId <= 0",
  );
  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({ identity: { ...passRow.identity, awayTeamId: -1 } }),
    ),
    "INVALID_AWAY_TEAM_ID",
    "awayTeamId <= 0",
  );
  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({
        identity: { ...passRow.identity, homeTeamId: 121, awayTeamId: 121 },
      }),
    ),
    "HOME_AWAY_TEAM_ID_EQUAL",
    "homeTeamId === awayTeamId",
  );
  assertFail(
    validateIndependentFeatureRowV1({
      ...passRow,
      identity: {
        gamePk: 823590,
        officialDate: OFFICIAL,
        homeTeamId: 121,
        awayTeamId: 120,
      },
    }),
    "MISSING_COMMENCE_TIME_UTC",
    "missing commenceTimeUtc",
  );
  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({
        identity: { ...passRow.identity, commenceTimeUtc: "not-a-timestamp" },
      }),
    ),
    "MALFORMED_COMMENCE_TIME_UTC",
    "malformed commenceTimeUtc",
  );
  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({
        identity: { ...passRow.identity, commenceTimeUtc: "2026-08-17" },
      }),
    ),
    "MALFORMED_COMMENCE_TIME_UTC",
    "date-only commenceTimeUtc",
  );
  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({
        identity: { ...passRow.identity, officialDate: "2026/08/17" },
      }),
    ),
    "MALFORMED_OFFICIAL_DATE",
    "malformed officialDate",
  );
  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({
        identity: { ...passRow.identity, officialDate: "2026-02-31" },
      }),
    ),
    "MALFORMED_OFFICIAL_DATE",
    "nonexistent calendar date 2026-02-31",
  );

  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({ temporalPhase: "UNKNOWN" }),
    ),
    "FEATURE_UNKNOWN_TEMPORAL_PHASE_CANNOT_PROMOTE_TO_PREGAME",
    "UNKNOWN temporal phase",
  );
  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({ temporalPhase: "TRUE_PREGAME_OBSERVATION" }),
    ),
    "FEATURE_CLASS_NOT_ADMITTED_IN_V1_CORE",
    "TRUE_PREGAME_OBSERVATION phase on v1 core",
  );
  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({
        temporalPolicy: MLB_INDEPENDENT_CLASS_B_TEMPORAL_POLICY_V1,
      }),
    ),
    "FEATURE_TEMPORAL_POLICY_MISMATCH",
    "Class B temporal policy on Class A row",
  );
  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({
        featureClass: "SAFE_ONLY_WITH_PREGAME_PROVENANCE",
        temporalPolicy: MLB_INDEPENDENT_CLASS_B_TEMPORAL_POLICY_V1,
        temporalPhase: "TRUE_PREGAME_OBSERVATION",
        probableStartingPitcherIdentity: "Gerrit Cole",
      }),
    ),
    "FEATURE_CLASS_NOT_ADMITTED_IN_V1_CORE",
    "class B on v1 core",
  );

  assertFail(
    validateIndependentLabelRowV1(
      validLabelRow("HOME", {
        identity: {
          gamePk: "not-a-pk",
          officialDate: "17-08-2026",
          homeTeamId: 121,
          awayTeamId: 120,
          commenceTimeUtc: COMMENCE,
        },
      }),
    ),
    "INVALID_GAME_PK",
    "label identity malformed",
  );

  const fakeHash = "a".repeat(64);
  assertPass(
    validateIndependentFeatureRowV1(validFeatureRow({ featureHash: fakeHash })),
    "structurally valid candidate hash (authenticity not verified)",
  );
  assertFail(
    validateIndependentFeatureRowV1(
      validFeatureRow({ featureHash: "A".repeat(64) }),
    ),
    "featureHash:MALFORMED",
    "uppercase hash",
  );
  assertFail(
    validateIndependentFeatureRowV1(validFeatureRow({ featureHash: "abc" })),
    "featureHash:MALFORMED",
    "short hash",
  );

  const files = readdirSync(MODULE_DIR).filter((n) => n.endsWith(".ts"));
  assert.deepEqual(files.sort(), ["contract.ts", "index.ts", "validate.ts"]);
  const forbidden = [
    "prediction-v0",
    "/edge/",
    "lib/edge",
    "recommendation",
    "build-mlb-official-results",
    "grade-mlb",
    "mlb-prediction-review",
  ];
  for (const file of files) {
    const src = readFileSync(path.join(MODULE_DIR, file), "utf8");
    const specs = importedSpecifiers(src);
    for (const spec of specs) {
      assert.ok(
        spec.startsWith("./"),
        `${file} may only use relative local imports, got ${spec}`,
      );
      for (const bad of forbidden) {
        assert.ok(
          !spec.includes(bad),
          `${file} imported forbidden module ${spec}`,
        );
      }
    }
  }
  const contractSrc = readFileSync(path.join(MODULE_DIR, "contract.ts"), "utf8");
  assert.equal(
    importedSpecifiers(contractSrc).length,
    0,
    "contract.ts must have zero imports",
  );
  const validateSrc = readFileSync(path.join(MODULE_DIR, "validate.ts"), "utf8");
  const validateImports = importedSpecifiers(validateSrc);
  assert.deepEqual(validateImports, ["./contract"]);

  console.log("test:mlb-independent-training-dataset-contract-v1 PASS");
  console.log("INDEPENDENT_MODEL_SAMPLE = 0");
  console.log("DATASET_ROWS_CREATED = 0");
  console.log("CONTRACT_STATUS = CONTRACT_READY");
}

main();
