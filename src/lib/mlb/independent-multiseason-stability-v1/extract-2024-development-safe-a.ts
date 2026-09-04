/**
 * MULTI-SEASON STABILITY — extract 2024 TRAIN+VALIDATION SAFE_A rows.
 *
 * Streams sealed SAFE_A bytes. JSON.parse is used only on:
 *   1. identity objects (membership)
 *   2. development-visible Feature rows (TRAIN ∪ VALIDATION)
 *
 * Holdout Feature objects are never JSON.parse'd.
 * The complete 2429-row artifact is never JSON.parse'd.
 * LOCAL ONLY. No statistics. No labels. No model.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import {
  MLB_INDEPENDENT_ENGINE_ADMISSION,
  MLB_INDEPENDENT_FEATURE_BUILDER_VERSION,
  MLB_INDEPENDENT_FEATURE_SCHEMA_V1,
  validateIndependentFeatureArtifactV1,
  validateIndependentFeatureRowV1,
  type MlbIndependentFeatureArtifactV1,
  type MlbIndependentFeatureRowV1,
  type MlbIndependentIdentityV1,
} from "../independent-model-v1";
import { hashIndependentFeatureRowV1 } from "../independent-safe-a-v1/materialize";
import {
  hashIndependentSplitManifestV1,
  type IndependentSplitArtifactV1,
} from "../independent-split-v1";

export const MLB_INDEPENDENT_MULTISEASON_STABILITY_STAGE_SUBSET =
  "SAFE_2024_DEVELOPMENT_SUBSET" as const;
export const MLB_INDEPENDENT_MULTISEASON_STABILITY_PURPOSE =
  "MULTI_SEASON_SAFE_A_STABILITY_INPUT" as const;

export const MLB_INDEPENDENT_2024_SEALED_SAFE_A_SHA256 =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
export const MLB_INDEPENDENT_2024_SEALED_SPLIT_MANIFEST_SHA256 =
  "a72b8586971ee81a04e119c7d860f226abb503b5cc2341bb370d49d2fb47e71d";

export function independent2024DevelopmentSafeASubsetRel(): string {
  return "data/research/mlb/independent-model-v1/multi-season-stability/inputs/2024/2024-train-validation-safe-a-subset-v1.json";
}

export function independent2024DevelopmentSafeASubsetPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independent2024DevelopmentSafeASubsetRel());
}

export function independent2024DevelopmentSafeASubsetAuditRel(): string {
  return "data/research/mlb/independent-model-v1/multi-season-stability/audits/2024-train-validation-safe-a-subset-audit-v1.json";
}

export function independent2024DevelopmentSafeASubsetAuditPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independent2024DevelopmentSafeASubsetAuditRel());
}

export type MultiseasonStabilityDevelopmentSubsetAudit2024 = {
  schemaVersion: "mlb-independent-multiseason-stability-development-subset-audit-v1";
  generatedAt: string;
  researchOnly: true;
  stage: typeof MLB_INDEPENDENT_MULTISEASON_STABILITY_STAGE_SUBSET;
  purpose: typeof MLB_INDEPENDENT_MULTISEASON_STABILITY_PURPOSE;
  developmentVisible: true;
  holdoutProtected: true;
  modelEvaluationAllowed: false;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  sourceFeatureArtifactSha256: string;
  splitManifestHash: string;
  subsetArtifactSha256: string;
  fullFeatureRowsSealed: number;
  trainMembership: number;
  validationMembership: number;
  developmentMembership: number;
  holdoutMembership: number;
  developmentRowsOutput: number;
  missingDevelopmentGamePkCount: number;
  unknownGamePkCount: number;
  holdoutRowsOutput: number;
  duplicateOutputGamePkCount: number;
  featureHashVerifiedCount: number;
  featureHashMismatchCount: number;
  fullArtifactJsonParsed: false;
  developmentFeatureRowsParsed: number;
  holdoutFeatureObjectsParsed: 0;
  holdoutFeatureValuesInspected: false;
  holdoutRowsSkippedWithoutFeatureParse: number;
  holdoutRowsWritten: 0;
  labelsRead: false;
  modelsRead: false;
  stabilityStatisticsCalculated: false;
  networkUsed: false;
  engineChanged: false;
  "2025RowsInspected": false;
  holdoutEvaluated: false;
};

export type MultiseasonStabilityDevelopmentSubsetResult2024 = {
  artifact: MlbIndependentFeatureArtifactV1;
  audit: MultiseasonStabilityDevelopmentSubsetAudit2024;
};

export class MultiseasonStabilityError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "MultiseasonStabilityError";
    this.code = code;
  }
}

export function serializeMultiseasonStabilityJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function hashMultiseasonStabilityUtf8(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function hashMultiseasonStabilityBytes(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function hash2024DevelopmentSafeASubsetArtifact(
  artifact: MlbIndependentFeatureArtifactV1,
): string {
  return hashMultiseasonStabilityUtf8(serializeMultiseasonStabilityJson(artifact));
}

function skipWs(s: string, i: number): number {
  while (i < s.length && (s[i] === " " || s[i] === "\n" || s[i] === "\r" || s[i] === "\t")) {
    i += 1;
  }
  return i;
}

function skipJsonString(s: string, i: number): number {
  if (s[i] !== '"') {
    throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `expected string at ${i}`);
  }
  i += 1;
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === "\\") {
      const esc = s[i + 1];
      if (esc == null) {
        throw new MultiseasonStabilityError("JSON_SCAN_ERROR", "truncated escape");
      }
      if (esc === "u") {
        if (i + 5 >= s.length) {
          throw new MultiseasonStabilityError("JSON_SCAN_ERROR", "truncated unicode escape");
        }
        i += 6;
        continue;
      }
      i += 2;
      continue;
    }
    if (ch === '"') return i + 1;
    i += 1;
  }
  throw new MultiseasonStabilityError("JSON_SCAN_ERROR", "unterminated string");
}

function readJsonString(s: string, i: number): { value: string; end: number } {
  const end = skipJsonString(s, i);
  return { value: JSON.parse(s.slice(i, end)) as string, end };
}

function skipJsonNumber(s: string, i: number): number {
  const start = i;
  if (s[i] === "-") i += 1;
  if (s[i] === "0") i += 1;
  else {
    if (s[i] == null || s[i]! < "1" || s[i]! > "9") {
      throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `bad number at ${start}`);
    }
    while (i < s.length && s[i]! >= "0" && s[i]! <= "9") i += 1;
  }
  if (s[i] === ".") {
    i += 1;
    if (s[i] == null || s[i]! < "0" || s[i]! > "9") {
      throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `bad fraction at ${start}`);
    }
    while (i < s.length && s[i]! >= "0" && s[i]! <= "9") i += 1;
  }
  if (s[i] === "e" || s[i] === "E") {
    i += 1;
    if (s[i] === "+" || s[i] === "-") i += 1;
    if (s[i] == null || s[i]! < "0" || s[i]! > "9") {
      throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `bad exponent at ${start}`);
    }
    while (i < s.length && s[i]! >= "0" && s[i]! <= "9") i += 1;
  }
  return i;
}

function skipLiteral(s: string, i: number, lit: string): number {
  if (s.slice(i, i + lit.length) !== lit) {
    throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `expected ${lit} at ${i}`);
  }
  return i + lit.length;
}

export function skipJsonValue(s: string, i: number): number {
  i = skipWs(s, i);
  const ch = s[i];
  if (ch == null) throw new MultiseasonStabilityError("JSON_SCAN_ERROR", "unexpected end");
  if (ch === '"') return skipJsonString(s, i);
  if (ch === "{") return skipJsonObject(s, i);
  if (ch === "[") return skipJsonArray(s, i);
  if (ch === "t") return skipLiteral(s, i, "true");
  if (ch === "f") return skipLiteral(s, i, "false");
  if (ch === "n") return skipLiteral(s, i, "null");
  if (ch === "-" || (ch >= "0" && ch <= "9")) return skipJsonNumber(s, i);
  throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `unexpected ${ch} at ${i}`);
}

function skipJsonObject(s: string, i: number): number {
  if (s[i] !== "{") {
    throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `expected { at ${i}`);
  }
  i = skipWs(s, i + 1);
  if (s[i] === "}") return i + 1;
  while (i < s.length) {
    i = skipWs(s, i);
    i = skipJsonString(s, i);
    i = skipWs(s, i);
    if (s[i] !== ":") {
      throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `expected : at ${i}`);
    }
    i = skipJsonValue(s, i + 1);
    i = skipWs(s, i);
    if (s[i] === "}") return i + 1;
    if (s[i] !== ",") {
      throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `expected , or } at ${i}`);
    }
    i += 1;
  }
  throw new MultiseasonStabilityError("JSON_SCAN_ERROR", "unterminated object");
}

function skipJsonArray(s: string, i: number): number {
  if (s[i] !== "[") {
    throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `expected [ at ${i}`);
  }
  i = skipWs(s, i + 1);
  if (s[i] === "]") return i + 1;
  while (i < s.length) {
    i = skipJsonValue(s, i);
    i = skipWs(s, i);
    if (s[i] === "]") return i + 1;
    if (s[i] !== ",") {
      throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `expected , or ] at ${i}`);
    }
    i += 1;
  }
  throw new MultiseasonStabilityError("JSON_SCAN_ERROR", "unterminated array");
}

export function sliceJsonValue(s: string, i: number): { raw: string; end: number } {
  const start = skipWs(s, i);
  const end = skipJsonValue(s, start);
  return { raw: s.slice(start, end), end };
}

export function extractIdentityGamePk(rowRaw: string): number {
  let i = skipWs(rowRaw, 0);
  if (rowRaw[i] !== "{") {
    throw new MultiseasonStabilityError("JSON_SCAN_ERROR", "row is not an object");
  }
  i = skipWs(rowRaw, i + 1);
  if (rowRaw[i] === "}") {
    throw new MultiseasonStabilityError("JSON_SCAN_ERROR", "row missing identity");
  }
  while (i < rowRaw.length) {
    i = skipWs(rowRaw, i);
    const key = readJsonString(rowRaw, i);
    i = skipWs(rowRaw, key.end);
    if (rowRaw[i] !== ":") {
      throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `expected : after key at ${i}`);
    }
    i += 1;
    if (key.value === "identity") {
      const ident = sliceJsonValue(rowRaw, i);
      const parsed = JSON.parse(ident.raw) as MlbIndependentIdentityV1;
      if (!Number.isInteger(parsed.gamePk) || parsed.gamePk <= 0) {
        throw new MultiseasonStabilityError("JSON_SCAN_ERROR", "identity.gamePk invalid");
      }
      return parsed.gamePk;
    }
    i = skipJsonValue(rowRaw, i);
    i = skipWs(rowRaw, i);
    if (rowRaw[i] === "}") break;
    if (rowRaw[i] !== ",") {
      throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `expected , or } at ${i}`);
    }
    i += 1;
  }
  throw new MultiseasonStabilityError("JSON_SCAN_ERROR", "identity.gamePk not found");
}

export function iterateTopLevelArrayObjects(
  s: string,
  arrayStart: number,
  visit: (raw: string) => void,
): number {
  let i = skipWs(s, arrayStart);
  if (s[i] !== "[") {
    throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `expected [ at ${i}`);
  }
  i = skipWs(s, i + 1);
  if (s[i] === "]") return i + 1;
  while (i < s.length) {
    const obj = sliceJsonValue(s, i);
    visit(obj.raw);
    i = skipWs(s, obj.end);
    if (s[i] === "]") return i + 1;
    if (s[i] !== ",") {
      throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `expected , or ] at ${i}`);
    }
    i += 1;
  }
  throw new MultiseasonStabilityError("JSON_SCAN_ERROR", "unterminated rows array");
}

export function findTopLevelRowsArrayStart(s: string): number {
  let i = skipWs(s, 0);
  if (s[i] !== "{") {
    throw new MultiseasonStabilityError("JSON_SCAN_ERROR", "artifact is not an object");
  }
  i = skipWs(s, i + 1);
  if (s[i] === "}") {
    throw new MultiseasonStabilityError("ROWS_ARRAY_MISSING", "empty artifact");
  }
  while (i < s.length) {
    i = skipWs(s, i);
    const key = readJsonString(s, i);
    i = skipWs(s, key.end);
    if (s[i] !== ":") {
      throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `expected : at ${i}`);
    }
    i += 1;
    if (key.value === "rows") {
      i = skipWs(s, i);
      if (s[i] !== "[") {
        throw new MultiseasonStabilityError("ROWS_ARRAY_MISSING", "rows is not an array");
      }
      return i;
    }
    i = skipJsonValue(s, i);
    i = skipWs(s, i);
    if (s[i] === "}") {
      throw new MultiseasonStabilityError("ROWS_ARRAY_MISSING", "rows key missing");
    }
    if (s[i] !== ",") {
      throw new MultiseasonStabilityError("JSON_SCAN_ERROR", `expected , or } at ${i}`);
    }
    i += 1;
  }
  throw new MultiseasonStabilityError("ROWS_ARRAY_MISSING", "rows key missing");
}

function uniqueSet(pks: number[], kind: string): Set<number> {
  const set = new Set<number>();
  for (const pk of pks) {
    if (set.has(pk)) {
      throw new MultiseasonStabilityError(
        "DUPLICATE_MEMBERSHIP_GAME_PK",
        `duplicate ${kind} gamePk ${pk}`,
      );
    }
    set.add(pk);
  }
  return set;
}

function overlapCount(a: Set<number>, b: Set<number>): number {
  let n = 0;
  for (const pk of a) if (b.has(pk)) n += 1;
  return n;
}

function compareIdentity(
  a: MlbIndependentIdentityV1,
  b: MlbIndependentIdentityV1,
): number {
  if (a.officialDate !== b.officialDate) {
    return a.officialDate < b.officialDate ? -1 : 1;
  }
  if (a.commenceTimeUtc !== b.commenceTimeUtc) {
    return a.commenceTimeUtc < b.commenceTimeUtc ? -1 : 1;
  }
  return a.gamePk - b.gamePk;
}

function parseDevelopmentFeatureRow(rowRaw: string): MlbIndependentFeatureRowV1 {
  return JSON.parse(rowRaw) as MlbIndependentFeatureRowV1;
}

export function extract2024DevelopmentSafeAFromBytes(
  featureBytes: Buffer,
  split: IndependentSplitArtifactV1,
  options?: {
    generatedAt?: string;
    expectedFeatureSha256?: string;
    expectedSplitManifestHash?: string;
  },
): MultiseasonStabilityDevelopmentSubsetResult2024 {
  const featureSha256 = hashMultiseasonStabilityBytes(featureBytes);
  if (
    options?.expectedFeatureSha256 != null &&
    featureSha256 !== options.expectedFeatureSha256
  ) {
    throw new MultiseasonStabilityError(
      "FEATURE_SHA_PIN_MISMATCH",
      `expected ${options.expectedFeatureSha256} got ${featureSha256}`,
    );
  }

  const splitManifestHash = hashIndependentSplitManifestV1({
    sourceJoinArtifactHash: split.sourceJoinArtifactHash,
    boundaries: split.boundaries,
    trainGamePks: split.trainGamePks,
    validationGamePks: split.validationGamePks,
    holdoutGamePks: split.holdoutGamePks,
  });
  if (split.splitManifestHash !== splitManifestHash) {
    throw new MultiseasonStabilityError(
      "SPLIT_MANIFEST_MISMATCH",
      `artifact ${split.splitManifestHash} recomputed ${splitManifestHash}`,
    );
  }
  if (
    options?.expectedSplitManifestHash != null &&
    splitManifestHash !== options.expectedSplitManifestHash
  ) {
    throw new MultiseasonStabilityError(
      "SPLIT_MANIFEST_PIN_MISMATCH",
      `expected ${options.expectedSplitManifestHash} got ${splitManifestHash}`,
    );
  }

  const train = uniqueSet(split.trainGamePks, "TRAIN");
  const validation = uniqueSet(split.validationGamePks, "VALIDATION");
  const holdout = uniqueSet(split.holdoutGamePks, "HOLDOUT");
  const trainValidationOverlap = overlapCount(train, validation);
  if (trainValidationOverlap !== 0) {
    throw new MultiseasonStabilityError(
      "TRAIN_VALIDATION_OVERLAP",
      `TRAIN_VALIDATION_OVERLAP=${trainValidationOverlap}`,
    );
  }
  const development = new Set<number>([...train, ...validation]);
  const developmentHoldoutOverlap = overlapCount(development, holdout);
  if (developmentHoldoutOverlap !== 0) {
    throw new MultiseasonStabilityError(
      "DEVELOPMENT_HOLDOUT_OVERLAP",
      `DEVELOPMENT_HOLDOUT_OVERLAP=${developmentHoldoutOverlap}`,
    );
  }

  const utf8 = featureBytes.toString("utf8");
  const rowsStart = findTopLevelRowsArrayStart(utf8);
  const output: MlbIndependentFeatureRowV1[] = [];
  const seen = new Set<number>();
  let holdoutRowsSkippedWithoutFeatureParse = 0;
  let unknownGamePkCount = 0;
  let fullFeatureRowsSealed = 0;

  iterateTopLevelArrayObjects(utf8, rowsStart, (rowRaw) => {
    fullFeatureRowsSealed += 1;
    const gamePk = extractIdentityGamePk(rowRaw);
    if (seen.has(gamePk)) {
      throw new MultiseasonStabilityError(
        "DUPLICATE_OUTPUT_GAME_PK",
        `duplicate source gamePk ${gamePk}`,
      );
    }
    seen.add(gamePk);
    if (holdout.has(gamePk)) {
      holdoutRowsSkippedWithoutFeatureParse += 1;
      return;
    }
    if (!development.has(gamePk)) {
      unknownGamePkCount += 1;
      throw new MultiseasonStabilityError(
        "UNKNOWN_GAME_PK",
        `UNKNOWN_GAME_PK_COUNT gamePk=${gamePk}`,
      );
    }
    const row = parseDevelopmentFeatureRow(rowRaw);
    const rowCheck = validateIndependentFeatureRowV1(row);
    if (!rowCheck.ok) {
      throw new MultiseasonStabilityError(
        "FEATURE_ROW_INVALID",
        `gamePk ${gamePk}: ${rowCheck.errors.join(" | ")}`,
      );
    }
    if (row.identity.gamePk !== gamePk) {
      throw new MultiseasonStabilityError(
        "IDENTITY_MISMATCH",
        `scanned gamePk ${gamePk} parsed ${row.identity.gamePk}`,
      );
    }
    if (row.featureHash == null) {
      throw new MultiseasonStabilityError("FEATURE_HASH_NULL", `gamePk ${gamePk}`);
    }
    const recomputed = hashIndependentFeatureRowV1(row);
    if (recomputed !== row.featureHash) {
      throw new MultiseasonStabilityError(
        "FEATURE_HASH_MISMATCH",
        `gamePk ${gamePk}`,
      );
    }
    output.push(row);
  });

  const missing = [...development].filter((pk) => !seen.has(pk)).length;
  if (missing !== 0) {
    throw new MultiseasonStabilityError(
      "MISSING_DEVELOPMENT_GAME_PK",
      `MISSING_DEVELOPMENT_GAME_PK_COUNT=${missing}`,
    );
  }
  if (holdoutRowsSkippedWithoutFeatureParse !== holdout.size) {
    throw new MultiseasonStabilityError(
      "HOLDOUT_SKIP_COUNT_MISMATCH",
      `skipped=${holdoutRowsSkippedWithoutFeatureParse} holdout=${holdout.size}`,
    );
  }
  if (output.length !== development.size) {
    throw new MultiseasonStabilityError(
      "DEVELOPMENT_ROW_COUNT_MISMATCH",
      `output=${output.length} development=${development.size}`,
    );
  }

  output.sort((a, b) => compareIdentity(a.identity, b.identity));

  const artifact: MlbIndependentFeatureArtifactV1 = {
    schemaVersion: MLB_INDEPENDENT_FEATURE_SCHEMA_V1,
    builderVersion: MLB_INDEPENDENT_FEATURE_BUILDER_VERSION,
    researchOnly: true,
    independentModelSample: 0,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    datasetReady: false,
    temporalPolicy: "HISTORICAL_RECONSTRUCTION_D1",
    featureClass: "SAFE_HISTORICALLY_RECONSTRUCTABLE",
    writeOnce: true,
    rows: output,
  };
  const artifactCheck = validateIndependentFeatureArtifactV1(artifact);
  if (!artifactCheck.ok) {
    throw new MultiseasonStabilityError(
      "FEATURE_ARTIFACT_INVALID",
      artifactCheck.errors.join(" | "),
    );
  }

  const subsetArtifactSha256 = hash2024DevelopmentSafeASubsetArtifact(artifact);
  const audit: MultiseasonStabilityDevelopmentSubsetAudit2024 = {
    schemaVersion: "mlb-independent-multiseason-stability-development-subset-audit-v1",
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    researchOnly: true,
    stage: MLB_INDEPENDENT_MULTISEASON_STABILITY_STAGE_SUBSET,
    purpose: MLB_INDEPENDENT_MULTISEASON_STABILITY_PURPOSE,
    developmentVisible: true,
    holdoutProtected: true,
    modelEvaluationAllowed: false,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    sourceFeatureArtifactSha256: featureSha256,
    splitManifestHash,
    subsetArtifactSha256,
    fullFeatureRowsSealed,
    trainMembership: train.size,
    validationMembership: validation.size,
    developmentMembership: development.size,
    holdoutMembership: holdout.size,
    developmentRowsOutput: output.length,
    missingDevelopmentGamePkCount: 0,
    unknownGamePkCount,
    holdoutRowsOutput: 0,
    duplicateOutputGamePkCount: 0,
    featureHashVerifiedCount: output.length,
    featureHashMismatchCount: 0,
    fullArtifactJsonParsed: false,
    developmentFeatureRowsParsed: output.length,
    holdoutFeatureObjectsParsed: 0,
    holdoutFeatureValuesInspected: false,
    holdoutRowsSkippedWithoutFeatureParse,
    holdoutRowsWritten: 0,
    labelsRead: false,
    modelsRead: false,
    stabilityStatisticsCalculated: false,
    networkUsed: false,
    engineChanged: false,
    "2025RowsInspected": false,
    holdoutEvaluated: false,
  };

  return { artifact, audit };
}
