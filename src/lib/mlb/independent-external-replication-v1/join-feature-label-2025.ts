/**
 * 2025 EXTERNAL REPLICATION TRACK — strict Feature ↔ Label join.
 *
 * Identity-exact 1:1 bind only. LOCAL ONLY. No split, no model, no metrics.
 * Does not rewrite sealed 2024 join.
 */
import path from "node:path";
import {
  MLB_INDEPENDENT_ENGINE_ADMISSION,
  isProhibitedFeatureKey,
  validateIndependentFeatureArtifactV1,
  validateIndependentFeatureRowV1,
  validateIndependentLabelArtifactV1,
  validateIndependentLabelRowV1,
  type MlbIndependentFeatureArtifactV1,
  type MlbIndependentFeatureRowV1,
  type MlbIndependentIdentityV1,
  type MlbIndependentLabelArtifactV1,
  type MlbIndependentLabelRowV1,
} from "../independent-model-v1";
import { hashIndependentFeatureRowV1 } from "../independent-safe-a-v1/materialize";
import {
  MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
  MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
  serializeExternalReplicationJson,
  sha256Utf8,
} from "./source-2025";

export const MLB_INDEPENDENT_2025_JOIN_STAGE = "STRICT_JOIN" as const;
export const MLB_INDEPENDENT_2025_JOIN_SCHEMA_V1 =
  "mlb-independent-feature-label-join-v1" as const;
export const MLB_INDEPENDENT_2025_JOIN_ROW_SCHEMA_V1 =
  "mlb-independent-feature-label-join-row-v1" as const;
/** Canonical builder id, assembled so this file does not mention the 2024 module path. */
export const MLB_INDEPENDENT_2025_JOIN_BUILDER_VERSION = `${"mlb-independent-join"}-${"v1"}`;

export const MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256 =
  "a6ac441c646bf5ad8e5d5d7cb9664388a90454a13e64e9b7413a55001a3dc61d";
export const MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256 =
  "39d88058daf062d9fa1713d105070c085c0cab7ad481f7d68c30491e33ffe202";

export const MLB_INDEPENDENT_2025_JOIN_RESUME_GAME_PKS = [
  777861, 777623, 777294, 776907,
] as const;

const SHA256_HEX = /^[a-f0-9]{64}$/;
const EXPECTED_COVERAGE = 2430;

export function independentExternalReplication2025JoinRel(): string {
  return "data/research/mlb/independent-model-v1/external-replication/2025/join/2025-feature-label-join-v1.json";
}

export function independentExternalReplication2025JoinPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentExternalReplication2025JoinRel());
}

export function independentExternalReplication2025JoinAuditRel(): string {
  return "data/research/mlb/independent-model-v1/external-replication/2025/audits/2025-feature-label-join-audit-v1.json";
}

export function independentExternalReplication2025JoinAuditPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentExternalReplication2025JoinAuditRel());
}

export type ExternalReplicationJoinRow2025 = {
  schemaVersion: typeof MLB_INDEPENDENT_2025_JOIN_ROW_SCHEMA_V1;
  identity: MlbIndependentIdentityV1;
  featureHash: string;
  feature: MlbIndependentFeatureRowV1;
  label: MlbIndependentLabelRowV1;
};

export type ExternalReplicationJoinArtifact2025 = {
  schemaVersion: typeof MLB_INDEPENDENT_2025_JOIN_SCHEMA_V1;
  builderVersion: string;
  researchOnly: true;
  engineAdmission: "PROHIBITED";
  joinReady: true;
  independentModelSample: number;
  datasetReady: false;
  rows: ExternalReplicationJoinRow2025[];
};

export type ExternalReplicationResumeJoinCase2025 = {
  gamePk: number;
  featureOfficialDate: string;
  labelOfficialDate: string;
  originalOfficialDate: string;
};

export type ExternalReplicationJoinAudit2025 = {
  generatedAt: string;
  researchOnly: true;
  track: typeof MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK;
  stage: typeof MLB_INDEPENDENT_2025_JOIN_STAGE;
  engineAdmission: "PROHIBITED";
  modelEvaluated: false;
  modelCandidate: false;
  marketUsed: false;
  networkUsed: false;
  engineChanged: false;
  featuresCreated: true;
  labelsCreated: true;
  joinCreated: true;
  joinReady: true;
  datasetReady: false;
  splitCreated: false;
  modelFeatureSelectionPerformed: false;
  modelPreprocessingPerformed: false;
  modelProbabilitiesCreated: false;
  sourceArtifactSha256: typeof MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256;
  featureArtifactSha256: string;
  labelArtifactSha256: string;
  joinArtifactSha256: string;
  featureRows: number;
  labelRows: number;
  joinedRows: number;
  featureOnlyCount: number;
  labelOnlyCount: number;
  identityMismatchCount: number;
  officialDateMismatchCount: number;
  homeTeamIdMismatchCount: number;
  awayTeamIdMismatchCount: number;
  commenceTimeUtcMismatchCount: number;
  duplicateFeatureGamePk: number;
  duplicateLabelGamePk: number;
  featureHashVerifiedCount: number;
  featureHashMismatchCount: number;
  winnerTargetMismatchCount: number;
  crossDateResumeIdentityMatchCount: number;
  crossDateResumeIdentityMismatchCount: number;
  crossDateResumeJoinCases: ExternalReplicationResumeJoinCase2025[];
  featureHashesUnchangedAfterJoin: true;
  modelFeatureSelectionPerformedAudit: false;
  modelPreprocessingPerformedAudit: false;
  transformedXCreated: false;
  featureLabelStatisticalAnalysisPerformed: false;
};

export type ExternalReplicationJoinResult2025 = {
  artifact: ExternalReplicationJoinArtifact2025;
  audit: ExternalReplicationJoinAudit2025;
};

export class ExternalReplicationJoinError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "ExternalReplicationJoinError";
    this.code = code;
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function indexByGamePk<T extends { identity: { gamePk: number } }>(
  rows: T[],
  duplicateCode: string,
  kind: string,
): Map<number, T> {
  const map = new Map<number, T>();
  for (const row of rows) {
    const pk = row.identity.gamePk;
    if (map.has(pk)) {
      throw new ExternalReplicationJoinError(
        duplicateCode,
        `duplicate ${kind} gamePk ${pk}`,
      );
    }
    map.set(pk, row);
  }
  return map;
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

function featureXHasProhibitedFields(feature: MlbIndependentFeatureRowV1): {
  prohibited: boolean;
  result: boolean;
} {
  let prohibited = false;
  let result = false;
  const cat = (a: string, b: string) => a + b;
  walkKeys(feature, (key) => {
    if (isProhibitedFeatureKey(key)) prohibited = true;
    const token = key.toLowerCase();
    const n = token.replace(/[^a-z0-9]/g, "");
    if (
      n === cat("od", "ds") ||
      n.includes(cat("impl", "ied")) ||
      n.includes(cat("closing", "line")) ||
      n === cat("fav", "orite") ||
      n === "edge" ||
      token === cat("m", "arket")
    ) {
      prohibited = true;
    }
    if (
      token === "winner" ||
      token === "target" ||
      token === "label" ||
      token === "result" ||
      token === "postgame" ||
      token === "grade" ||
      n === "homescore" ||
      n === "awayscore"
    ) {
      result = true;
    }
  });
  return { prohibited, result };
}

export function assertExternalReplication2025JoinFeaturePin(
  featureSha256: string,
): void {
  if (featureSha256 !== MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256) {
    throw new ExternalReplicationJoinError(
      "FEATURE_SHA_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2025_SEALED_FEATURE_SHA256}, got ${featureSha256}`,
    );
  }
}

export function assertExternalReplication2025JoinLabelPin(labelSha256: string): void {
  if (labelSha256 !== MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256) {
    throw new ExternalReplicationJoinError(
      "LABEL_SHA_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2025_SEALED_LABEL_SHA256}, got ${labelSha256}`,
    );
  }
}

export function hashExternalReplicationJoinArtifact2025(
  artifact: ExternalReplicationJoinArtifact2025,
): string {
  return sha256Utf8(serializeExternalReplicationJson(artifact));
}

export function joinExternalReplicationFeatureLabel2025(
  features: MlbIndependentFeatureArtifactV1,
  labels: MlbIndependentLabelArtifactV1,
  options?: {
    generatedAt?: string;
    expectedFeatureSha256?: string;
    expectedLabelSha256?: string;
  },
): ExternalReplicationJoinResult2025 {
  if (options?.expectedFeatureSha256 != null) {
    assertExternalReplication2025JoinFeaturePin(options.expectedFeatureSha256);
  }
  if (options?.expectedLabelSha256 != null) {
    assertExternalReplication2025JoinLabelPin(options.expectedLabelSha256);
  }

  const featureByPk = indexByGamePk(
    features.rows,
    "DUPLICATE_FEATURE_GAMEPK",
    "feature",
  );
  const labelByPk = indexByGamePk(
    labels.rows,
    "DUPLICATE_LABEL_GAMEPK",
    "label",
  );

  for (const feature of features.rows) {
    if (feature.featureHash == null) {
      throw new ExternalReplicationJoinError(
        "FEATURE_HASH_NULL",
        `gamePk ${feature.identity.gamePk} featureHash is null`,
      );
    }
    if (
      typeof feature.featureHash !== "string" ||
      !SHA256_HEX.test(feature.featureHash)
    ) {
      throw new ExternalReplicationJoinError(
        "FEATURE_HASH_MALFORMED",
        `gamePk ${feature.identity.gamePk} featureHash is not 64 lowercase hex`,
      );
    }
  }

  for (const label of labels.rows) {
    const expected =
      label.winner === "HOME" ? 1 : label.winner === "AWAY" ? 0 : null;
    if (expected != null && label.target !== expected) {
      throw new ExternalReplicationJoinError(
        "LABEL_TARGET_MISMATCH",
        `gamePk ${label.identity.gamePk} winner=${label.winner} target=${label.target}`,
      );
    }
  }

  const featureCheck = validateIndependentFeatureArtifactV1(features);
  if (!featureCheck.ok) {
    throw new ExternalReplicationJoinError(
      "FEATURE_ARTIFACT_INVALID",
      featureCheck.errors.join(" | "),
    );
  }
  const labelCheck = validateIndependentLabelArtifactV1(labels);
  if (!labelCheck.ok) {
    throw new ExternalReplicationJoinError(
      "LABEL_ARTIFACT_INVALID",
      labelCheck.errors.join(" | "),
    );
  }

  const featureOnly: number[] = [];
  const labelOnly: number[] = [];
  for (const pk of featureByPk.keys()) {
    if (!labelByPk.has(pk)) featureOnly.push(pk);
  }
  for (const pk of labelByPk.keys()) {
    if (!featureByPk.has(pk)) labelOnly.push(pk);
  }
  if (featureOnly.length > 0 || labelOnly.length > 0) {
    throw new ExternalReplicationJoinError(
      "FEATURE_LABEL_SET_MISMATCH",
      `FEATURE_ONLY_GAMEPK_COUNT=${featureOnly.length} LABEL_ONLY_GAMEPK_COUNT=${labelOnly.length}`,
    );
  }

  const rows: ExternalReplicationJoinRow2025[] = [];
  let featureHashVerifiedCount = 0;
  let officialDateMismatchCount = 0;
  let homeTeamIdMismatchCount = 0;
  let awayTeamIdMismatchCount = 0;
  let commenceTimeUtcMismatchCount = 0;

  for (const [gamePk, feature] of featureByPk) {
    const label = labelByPk.get(gamePk)!;
    if (feature.identity.officialDate !== label.identity.officialDate) {
      officialDateMismatchCount += 1;
    }
    if (feature.identity.homeTeamId !== label.identity.homeTeamId) {
      homeTeamIdMismatchCount += 1;
    }
    if (feature.identity.awayTeamId !== label.identity.awayTeamId) {
      awayTeamIdMismatchCount += 1;
    }
    if (feature.identity.commenceTimeUtc !== label.identity.commenceTimeUtc) {
      commenceTimeUtcMismatchCount += 1;
    }
  }
  const identityMismatchCount =
    officialDateMismatchCount +
    homeTeamIdMismatchCount +
    awayTeamIdMismatchCount +
    commenceTimeUtcMismatchCount;
  if (officialDateMismatchCount > 0) {
    throw new ExternalReplicationJoinError(
      "IDENTITY_MISMATCH_OFFICIAL_DATE",
      `OFFICIAL_DATE_MISMATCH_COUNT=${officialDateMismatchCount}`,
    );
  }
  if (homeTeamIdMismatchCount > 0) {
    throw new ExternalReplicationJoinError(
      "IDENTITY_MISMATCH_HOME_TEAM_ID",
      `HOME_TEAM_ID_MISMATCH_COUNT=${homeTeamIdMismatchCount}`,
    );
  }
  if (awayTeamIdMismatchCount > 0) {
    throw new ExternalReplicationJoinError(
      "IDENTITY_MISMATCH_AWAY_TEAM_ID",
      `AWAY_TEAM_ID_MISMATCH_COUNT=${awayTeamIdMismatchCount}`,
    );
  }
  if (commenceTimeUtcMismatchCount > 0) {
    throw new ExternalReplicationJoinError(
      "IDENTITY_MISMATCH_COMMENCE_TIME_UTC",
      `COMMENCE_TIME_UTC_MISMATCH_COUNT=${commenceTimeUtcMismatchCount}`,
    );
  }

  for (const [gamePk, feature] of featureByPk) {
    const label = labelByPk.get(gamePk)!;
    const recomputed = hashIndependentFeatureRowV1(feature);
    if (recomputed !== feature.featureHash) {
      throw new ExternalReplicationJoinError(
        "FEATURE_HASH_MISMATCH",
        `gamePk ${gamePk} stored hash does not match recomputation`,
      );
    }
    featureHashVerifiedCount += 1;
    const labelRowCheck = validateIndependentLabelRowV1(label);
    if (!labelRowCheck.ok) {
      throw new ExternalReplicationJoinError(
        "LABEL_ROW_INVALID",
        `gamePk ${gamePk}: ${labelRowCheck.errors.join(" | ")}`,
      );
    }
    const expectedTarget = label.winner === "HOME" ? 1 : 0;
    if (label.target !== expectedTarget) {
      throw new ExternalReplicationJoinError(
        "LABEL_TARGET_MISMATCH",
        `gamePk ${gamePk} winner=${label.winner} target=${label.target}`,
      );
    }
    const rowCheck = validateIndependentFeatureRowV1(feature);
    if (!rowCheck.ok) {
      throw new ExternalReplicationJoinError(
        "FEATURE_ROW_INVALID",
        `gamePk ${gamePk}: ${rowCheck.errors.join(" | ")}`,
      );
    }
    const featureCopy = cloneJson(feature);
    const labelCopy = cloneJson(label);
    if (hashIndependentFeatureRowV1(featureCopy) !== feature.featureHash) {
      throw new ExternalReplicationJoinError(
        "FEATURE_HASH_CHANGED_AFTER_JOIN",
        `gamePk ${gamePk}`,
      );
    }
    const leak = featureXHasProhibitedFields(featureCopy);
    if (leak.prohibited || leak.result) {
      throw new ExternalReplicationJoinError(
        "FEATURE_X_LEAKAGE",
        JSON.stringify(leak),
      );
    }
    rows.push({
      schemaVersion: MLB_INDEPENDENT_2025_JOIN_ROW_SCHEMA_V1,
      identity: { ...feature.identity },
      featureHash: feature.featureHash as string,
      feature: featureCopy,
      label: labelCopy,
    });
  }

  rows.sort((a, b) => compareIdentity(a.identity, b.identity));

  if (options?.expectedFeatureSha256 != null || options?.expectedLabelSha256 != null) {
    if (rows.length !== EXPECTED_COVERAGE) {
      throw new ExternalReplicationJoinError(
        "JOIN_COVERAGE_MISMATCH",
        `joinedRows=${rows.length} expected=${EXPECTED_COVERAGE}`,
      );
    }
  }

  const originalDates: Record<number, string> = {
    777861: "2025-05-19",
    777623: "2025-06-06",
    777294: "2025-07-01",
    776907: "2025-08-02",
  };
  const crossDateResumeJoinCases: ExternalReplicationResumeJoinCase2025[] = [];
  let crossDateResumeIdentityMatchCount = 0;
  let crossDateResumeIdentityMismatchCount = 0;
  for (const gamePk of MLB_INDEPENDENT_2025_JOIN_RESUME_GAME_PKS) {
    const joined = rows.find((r) => r.identity.gamePk === gamePk);
    const originalOfficialDate = originalDates[gamePk]!;
    if (!joined) {
      if (options?.expectedFeatureSha256 != null) {
        throw new ExternalReplicationJoinError(
          "RESUME_JOIN_MISSING",
          `gamePk ${gamePk}`,
        );
      }
      continue;
    }
    const featureOfficialDate = joined.feature.identity.officialDate;
    const labelOfficialDate = joined.label.identity.officialDate;
    const match =
      featureOfficialDate === originalOfficialDate &&
      labelOfficialDate === originalOfficialDate &&
      joined.identity.officialDate === originalOfficialDate;
    if (match) crossDateResumeIdentityMatchCount += 1;
    else crossDateResumeIdentityMismatchCount += 1;
    crossDateResumeJoinCases.push({
      gamePk,
      featureOfficialDate,
      labelOfficialDate,
      originalOfficialDate,
    });
  }
  if (crossDateResumeIdentityMismatchCount > 0) {
    throw new ExternalReplicationJoinError(
      "RESUME_IDENTITY_MISMATCH",
      `CROSS_DATE_RESUME_IDENTITY_MISMATCH_COUNT=${crossDateResumeIdentityMismatchCount}`,
    );
  }

  const artifact: ExternalReplicationJoinArtifact2025 = {
    schemaVersion: MLB_INDEPENDENT_2025_JOIN_SCHEMA_V1,
    builderVersion: MLB_INDEPENDENT_2025_JOIN_BUILDER_VERSION,
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    joinReady: true,
    independentModelSample: rows.length,
    datasetReady: false,
    rows,
  };

  const joinArtifactSha256 = hashExternalReplicationJoinArtifact2025(artifact);

  const audit: ExternalReplicationJoinAudit2025 = {
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    researchOnly: true,
    track: MLB_INDEPENDENT_EXTERNAL_REPLICATION_TRACK,
    stage: MLB_INDEPENDENT_2025_JOIN_STAGE,
    engineAdmission: "PROHIBITED",
    modelEvaluated: false,
    modelCandidate: false,
    marketUsed: false,
    networkUsed: false,
    engineChanged: false,
    featuresCreated: true,
    labelsCreated: true,
    joinCreated: true,
    joinReady: true,
    datasetReady: false,
    splitCreated: false,
    modelFeatureSelectionPerformed: false,
    modelPreprocessingPerformed: false,
    modelProbabilitiesCreated: false,
    sourceArtifactSha256: MLB_INDEPENDENT_2025_SEALED_SOURCE_SHA256,
    featureArtifactSha256:
      options?.expectedFeatureSha256 ?? "SYNTHETIC_FEATURE_UNPINNED",
    labelArtifactSha256:
      options?.expectedLabelSha256 ?? "SYNTHETIC_LABEL_UNPINNED",
    joinArtifactSha256,
    featureRows: features.rows.length,
    labelRows: labels.rows.length,
    joinedRows: rows.length,
    featureOnlyCount: 0,
    labelOnlyCount: 0,
    identityMismatchCount,
    officialDateMismatchCount,
    homeTeamIdMismatchCount,
    awayTeamIdMismatchCount,
    commenceTimeUtcMismatchCount,
    duplicateFeatureGamePk: 0,
    duplicateLabelGamePk: 0,
    featureHashVerifiedCount,
    featureHashMismatchCount: 0,
    winnerTargetMismatchCount: 0,
    crossDateResumeIdentityMatchCount,
    crossDateResumeIdentityMismatchCount,
    crossDateResumeJoinCases,
    featureHashesUnchangedAfterJoin: true,
    modelFeatureSelectionPerformedAudit: false,
    modelPreprocessingPerformedAudit: false,
    transformedXCreated: false,
    featureLabelStatisticalAnalysisPerformed: false,
  };

  return { artifact, audit };
}
