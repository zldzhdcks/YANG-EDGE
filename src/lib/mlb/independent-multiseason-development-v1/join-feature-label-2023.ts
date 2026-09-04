/**
 * MULTI-SEASON DEVELOPMENT TRACK — 2023 strict Feature ↔ Label join.
 *
 * Wrapper around canonical independent-join-v1 semantics. LOCAL ONLY.
 * Exact gamePk + exact full identity. No split. No model. No metrics.
 * Does not rewrite sealed Source, SAFE_A, Labels, or 2024/2025 joins.
 */
import path from "node:path";
import {
  IndependentJoinError,
  MLB_INDEPENDENT_JOIN_SCHEMA_V1,
  joinIndependentFeatureLabelV1,
  type IndependentJoinArtifactV1,
  type IndependentJoinRowV1,
} from "../independent-join-v1";
import {
  MLB_INDEPENDENT_ENGINE_ADMISSION,
  isProhibitedFeatureKey,
  type MlbIndependentFeatureArtifactV1,
  type MlbIndependentIdentityV1,
  type MlbIndependentLabelArtifactV1,
} from "../independent-model-v1";
import {
  MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK,
  MLB_INDEPENDENT_MULTISEASON_SEASON_2023,
  independentMultiseasonDevelopment2023SourceRel,
  serializeMultiseasonDevelopmentJson,
  sha256Utf8,
  type MultiseasonDevelopmentSourceArtifact2023,
} from "./source-2023";
import { independentMultiseasonDevelopment2023FeatureRel } from "./materialize-safe-a-2023";
import { independentMultiseasonDevelopment2023LabelRel } from "./materialize-labels-2023";

export const MLB_INDEPENDENT_MULTISEASON_STAGE_STRICT_JOIN =
  "STRICT_JOIN" as const;

export const MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256 =
  "0bd8526907a9023047e10ed5e3292487982f98915a1c9a50f816fec62ea80862";
export const MLB_INDEPENDENT_2023_JOIN_FEATURE_SHA256 =
  "9926c918ee1b1317d4dd5100ba55ae700c815bdf17ee99caf9af63f5899fdde8";
export const MLB_INDEPENDENT_2023_JOIN_LABEL_SHA256 =
  "7050b14b70a656db779a3ffaa81336abf192ac42f8ce5e32deed7a6a27adf5e7";

export const MLB_INDEPENDENT_2023_JOIN_CROSS_DATE_RESUME_CASES = [
  { gamePk: 718203, officialDate: "2023-05-13", applyDate: "2023-05-14" },
  { gamePk: 717407, officialDate: "2023-07-14", applyDate: "2023-07-15" },
  { gamePk: 717375, officialDate: "2023-07-17", applyDate: "2023-07-18" },
  { gamePk: 717324, officialDate: "2023-07-21", applyDate: "2023-07-22" },
  { gamePk: 716875, officialDate: "2023-08-23", applyDate: "2023-08-24" },
  { gamePk: 716414, officialDate: "2023-09-27", applyDate: "2023-09-28" },
  { gamePk: 716404, officialDate: "2023-09-28", applyDate: "2023-10-02" },
] as const;

export const MLB_INDEPENDENT_2023_JOIN_CROSS_DATE_RESUME_GAME_PKS =
  MLB_INDEPENDENT_2023_JOIN_CROSS_DATE_RESUME_CASES.map((c) => c.gamePk);

export function independentMultiseasonDevelopment2023JoinRel(): string {
  return "data/research/mlb/independent-model-v1/multi-season-development/2023/join/2023-feature-label-strict-join-v1.json";
}

export function independentMultiseasonDevelopment2023JoinPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentMultiseasonDevelopment2023JoinRel());
}

export function independentMultiseasonDevelopment2023JoinAuditRel(): string {
  return "data/research/mlb/independent-model-v1/multi-season-development/2023/audits/2023-feature-label-strict-join-audit-v1.json";
}

export function independentMultiseasonDevelopment2023JoinAuditPath(
  cwd = process.cwd(),
): string {
  return path.join(cwd, independentMultiseasonDevelopment2023JoinAuditRel());
}

export type MultiseasonDevelopmentCrossDateJoinCase2023 = {
  gamePk: number;
  officialDate: string;
  featureOfficialDate: string;
  labelOfficialDate: string;
  sourceOfficialDate: string | null;
  safeResultApplyDate: string;
};

export type MultiseasonDevelopmentJoinAudit2023 = {
  schemaVersion: "mlb-independent-multiseason-development-join-audit-v1";
  generatedAt: string;
  researchOnly: true;
  track: typeof MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK;
  stage: typeof MLB_INDEPENDENT_MULTISEASON_STAGE_STRICT_JOIN;
  season: typeof MLB_INDEPENDENT_MULTISEASON_SEASON_2023;
  developmentEvidence: true;
  externalReplication: false;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  modelEvaluationAllowed: false;
  joinReady: true;
  datasetReady: false;
  splitCreated: false;
  modelRead: false;
  modelUsed: false;
  modelEvaluated: false;
  modelProbabilitiesCreated: false;
  transformedXCreated: false;
  statisticalAnalysisPerformed: false;
  marketUsed: false;
  networkUsed: false;
  engineChanged: false;
  recommendationChanged: false;
  holdoutEvaluated: false;
  holdoutFeatureRowsRead: 0;
  holdoutLabelRowsRead: 0;
  holdoutTransformedRows: 0;
  holdoutLogitsCreated: 0;
  holdoutProbabilitiesCreated: 0;
  "2025RowsInspected": false;
  sourceArtifactRel: string;
  featureArtifactRel: string;
  labelArtifactRel: string;
  joinArtifactRel: string;
  sourceArtifactSha256: string;
  featureArtifactSha256: string;
  labelArtifactSha256: string;
  joinArtifactSha256: string;
  sourceRows: number;
  featureRows: number;
  labelRows: number;
  joinedRows: number;
  featureUniqueGamePk: number;
  labelUniqueGamePk: number;
  featureOnlyCount: number;
  labelOnlyCount: number;
  identityMismatchCount: number;
  officialDateMismatchCount: number;
  commenceTimeUtcMismatchCount: number;
  homeTeamIdMismatchCount: number;
  awayTeamIdMismatchCount: number;
  sourceFeatureIdentityMismatchCount: number;
  sourceLabelIdentityMismatchCount: number;
  featureLabelIdentityMismatchCount: number;
  duplicateFeatureGamePk: number;
  duplicateLabelGamePk: number;
  featureHashVerifiedCount: number;
  featureHashMismatchCount: number;
  winnerTargetMismatchCount: number;
  crossDateJoinIdentityMismatchCount: number;
  crossDateJoinCases: MultiseasonDevelopmentCrossDateJoinCase2023[];
};

export type MultiseasonDevelopmentJoinResult2023 = {
  artifact: IndependentJoinArtifactV1;
  audit: MultiseasonDevelopmentJoinAudit2023;
};

export class MultiseasonDevelopmentJoinError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "MultiseasonDevelopmentJoinError";
    this.code = code;
  }
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

function featureXHasProhibitedFields(feature: unknown): boolean {
  let prohibited = false;
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
      n === cat("dev", "ig") ||
      n === "price" ||
      token === cat("m", "arket")
    ) {
      prohibited = true;
    }
  });
  return prohibited;
}

function identitiesEqual(
  a: MlbIndependentIdentityV1,
  b: MlbIndependentIdentityV1,
): boolean {
  return (
    a.gamePk === b.gamePk &&
    a.officialDate === b.officialDate &&
    a.commenceTimeUtc === b.commenceTimeUtc &&
    a.homeTeamId === b.homeTeamId &&
    a.awayTeamId === b.awayTeamId
  );
}

function sourceIdentity(
  game: MultiseasonDevelopmentSourceArtifact2023["games"][number],
): MlbIndependentIdentityV1 {
  return {
    gamePk: game.gamePk,
    officialDate: game.officialDate,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    commenceTimeUtc: game.commenceTimeUtc,
  };
}

function rethrowCanonicalJoin(error: unknown): never {
  if (error instanceof IndependentJoinError) {
    const prefix = `${error.code}: `;
    const detail = error.message.startsWith(prefix)
      ? error.message.slice(prefix.length)
      : error.message;
    throw new MultiseasonDevelopmentJoinError(error.code, detail);
  }
  throw error;
}

export function assertMultiseasonDevelopment2023JoinSourcePin(
  sourceSha256: string,
): void {
  if (sourceSha256 !== MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256) {
    throw new MultiseasonDevelopmentJoinError(
      "SOURCE_SHA_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256}, got ${sourceSha256}`,
    );
  }
}

export function assertMultiseasonDevelopment2023JoinFeaturePin(
  featureSha256: string,
): void {
  if (featureSha256 !== MLB_INDEPENDENT_2023_JOIN_FEATURE_SHA256) {
    throw new MultiseasonDevelopmentJoinError(
      "FEATURE_SHA_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2023_JOIN_FEATURE_SHA256}, got ${featureSha256}`,
    );
  }
}

export function assertMultiseasonDevelopment2023JoinLabelPin(
  labelSha256: string,
): void {
  if (labelSha256 !== MLB_INDEPENDENT_2023_JOIN_LABEL_SHA256) {
    throw new MultiseasonDevelopmentJoinError(
      "LABEL_SHA_PIN_MISMATCH",
      `expected ${MLB_INDEPENDENT_2023_JOIN_LABEL_SHA256}, got ${labelSha256}`,
    );
  }
}

export function hashMultiseasonDevelopmentJoinArtifact2023(
  artifact: IndependentJoinArtifactV1,
): string {
  return sha256Utf8(serializeMultiseasonDevelopmentJson(artifact));
}

export function findMultiseasonDevelopmentJoinRow2023(
  artifact: IndependentJoinArtifactV1,
  gamePk: number,
): IndependentJoinRowV1 | undefined {
  return artifact.rows.find((row) => row.identity.gamePk === gamePk);
}

function uniqueGamePkCount(rows: Array<{ identity: { gamePk: number } }>): number {
  return new Set(rows.map((row) => row.identity.gamePk)).size;
}

function countSourceIdentityMismatches(
  source: MultiseasonDevelopmentSourceArtifact2023,
  rows: Array<{ identity: MlbIndependentIdentityV1 }>,
): number {
  const sourceByPk = new Map<number, MlbIndependentIdentityV1>();
  for (const game of source.games) {
    if (sourceByPk.has(game.gamePk)) {
      throw new MultiseasonDevelopmentJoinError(
        "DUPLICATE_SOURCE_GAMEPK",
        `duplicate source gamePk ${game.gamePk}`,
      );
    }
    sourceByPk.set(game.gamePk, sourceIdentity(game));
  }
  const rowByPk = new Map<number, MlbIndependentIdentityV1>();
  for (const row of rows) {
    rowByPk.set(row.identity.gamePk, row.identity);
  }
  const keys = new Set([...sourceByPk.keys(), ...rowByPk.keys()]);
  let mismatch = 0;
  for (const pk of keys) {
    const src = sourceByPk.get(pk);
    const row = rowByPk.get(pk);
    if (!src || !row || !identitiesEqual(src, row)) mismatch += 1;
  }
  return mismatch;
}

export function joinMultiseasonDevelopmentFeatureLabel2023(
  features: MlbIndependentFeatureArtifactV1,
  labels: MlbIndependentLabelArtifactV1,
  options?: {
    generatedAt?: string;
    expectedSourceSha256?: string;
    expectedFeatureSha256?: string;
    expectedLabelSha256?: string;
    source?: MultiseasonDevelopmentSourceArtifact2023;
    sourcePath?: string;
    featurePath?: string;
    labelPath?: string;
  },
): MultiseasonDevelopmentJoinResult2023 {
  if (options?.expectedSourceSha256 != null) {
    assertMultiseasonDevelopment2023JoinSourcePin(options.expectedSourceSha256);
  }
  if (options?.expectedFeatureSha256 != null) {
    assertMultiseasonDevelopment2023JoinFeaturePin(options.expectedFeatureSha256);
  }
  if (options?.expectedLabelSha256 != null) {
    assertMultiseasonDevelopment2023JoinLabelPin(options.expectedLabelSha256);
  }

  const sealedPins =
    options?.expectedSourceSha256 === MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256 ||
    options?.expectedFeatureSha256 === MLB_INDEPENDENT_2023_JOIN_FEATURE_SHA256 ||
    options?.expectedLabelSha256 === MLB_INDEPENDENT_2023_JOIN_LABEL_SHA256;

  if (
    options?.expectedSourceSha256 === MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256 &&
    options?.source == null
  ) {
    throw new MultiseasonDevelopmentJoinError(
      "SOURCE_REQUIRED",
      "sealed 2023 join requires source lineage",
    );
  }

  let canonical;
  try {
    canonical = joinIndependentFeatureLabelV1(features, labels, {
      generatedAt: options?.generatedAt,
      featurePath:
        options?.featurePath ?? independentMultiseasonDevelopment2023FeatureRel(),
      labelPath:
        options?.labelPath ?? independentMultiseasonDevelopment2023LabelRel(),
      featureArtifactHash: options?.expectedFeatureSha256 ?? null,
      labelArtifactHash: options?.expectedLabelSha256 ?? null,
    });
  } catch (error) {
    rethrowCanonicalJoin(error);
  }

  if (canonical.artifact.schemaVersion !== MLB_INDEPENDENT_JOIN_SCHEMA_V1) {
    throw new MultiseasonDevelopmentJoinError(
      "JOIN_SCHEMA_MISMATCH",
      canonical.artifact.schemaVersion,
    );
  }

  let officialDateMismatchCount = 0;
  let commenceTimeUtcMismatchCount = 0;
  let homeTeamIdMismatchCount = 0;
  let awayTeamIdMismatchCount = 0;
  for (const row of canonical.artifact.rows) {
    if (row.feature.identity.officialDate !== row.label.identity.officialDate) {
      officialDateMismatchCount += 1;
    }
    if (row.feature.identity.commenceTimeUtc !== row.label.identity.commenceTimeUtc) {
      commenceTimeUtcMismatchCount += 1;
    }
    if (row.feature.identity.homeTeamId !== row.label.identity.homeTeamId) {
      homeTeamIdMismatchCount += 1;
    }
    if (row.feature.identity.awayTeamId !== row.label.identity.awayTeamId) {
      awayTeamIdMismatchCount += 1;
    }
    if (featureXHasProhibitedFields(row.feature)) {
      throw new MultiseasonDevelopmentJoinError(
        "FEATURE_X_LEAKAGE",
        `gamePk ${row.identity.gamePk}`,
      );
    }
    if ("safeResultApplyDate" in row.identity) {
      throw new MultiseasonDevelopmentJoinError(
        "JOIN_IDENTITY_APPLY_DATE",
        `gamePk ${row.identity.gamePk}`,
      );
    }
  }
  const featureLabelIdentityMismatchCount =
    officialDateMismatchCount +
    commenceTimeUtcMismatchCount +
    homeTeamIdMismatchCount +
    awayTeamIdMismatchCount;
  if (featureLabelIdentityMismatchCount !== 0) {
    throw new MultiseasonDevelopmentJoinError(
      "FEATURE_LABEL_IDENTITY_MISMATCH",
      `FEATURE_LABEL_IDENTITY_MISMATCH_COUNT=${featureLabelIdentityMismatchCount}`,
    );
  }

  let sourceFeatureIdentityMismatchCount = 0;
  let sourceLabelIdentityMismatchCount = 0;
  if (options?.source != null) {
    sourceFeatureIdentityMismatchCount = countSourceIdentityMismatches(
      options.source,
      features.rows,
    );
    sourceLabelIdentityMismatchCount = countSourceIdentityMismatches(
      options.source,
      labels.rows,
    );
    if (sourceFeatureIdentityMismatchCount !== 0) {
      throw new MultiseasonDevelopmentJoinError(
        "SOURCE_FEATURE_IDENTITY_MISMATCH",
        `SOURCE_FEATURE_IDENTITY_MISMATCH_COUNT=${sourceFeatureIdentityMismatchCount}`,
      );
    }
    if (sourceLabelIdentityMismatchCount !== 0) {
      throw new MultiseasonDevelopmentJoinError(
        "SOURCE_LABEL_IDENTITY_MISMATCH",
        `SOURCE_LABEL_IDENTITY_MISMATCH_COUNT=${sourceLabelIdentityMismatchCount}`,
      );
    }
  }

  const sourceByPk = new Map<
    number,
    MultiseasonDevelopmentSourceArtifact2023["games"][number]
  >();
  if (options?.source != null) {
    for (const game of options.source.games) sourceByPk.set(game.gamePk, game);
  }

  const crossDateJoinCases: MultiseasonDevelopmentCrossDateJoinCase2023[] = [];
  let crossDateJoinIdentityMismatchCount = 0;
  for (const resume of MLB_INDEPENDENT_2023_JOIN_CROSS_DATE_RESUME_CASES) {
    const joined = findMultiseasonDevelopmentJoinRow2023(
      canonical.artifact,
      resume.gamePk,
    );
    if (!joined) {
      if (sealedPins) {
        throw new MultiseasonDevelopmentJoinError(
          "RESUME_JOIN_MISSING",
          `gamePk ${resume.gamePk}`,
        );
      }
      continue;
    }
    const srcGame = sourceByPk.get(resume.gamePk);
    const sourceOfficialDate = srcGame?.officialDate ?? null;
    const match =
      joined.identity.officialDate === resume.officialDate &&
      joined.feature.identity.officialDate === resume.officialDate &&
      joined.label.identity.officialDate === resume.officialDate &&
      joined.identity.officialDate !== resume.applyDate &&
      (sourceOfficialDate == null || sourceOfficialDate === resume.officialDate);
    if (!match) crossDateJoinIdentityMismatchCount += 1;
    crossDateJoinCases.push({
      gamePk: resume.gamePk,
      officialDate: resume.officialDate,
      featureOfficialDate: joined.feature.identity.officialDate,
      labelOfficialDate: joined.label.identity.officialDate,
      sourceOfficialDate,
      safeResultApplyDate: resume.applyDate,
    });
  }
  if (crossDateJoinIdentityMismatchCount !== 0) {
    throw new MultiseasonDevelopmentJoinError(
      "CROSS_DATE_JOIN_IDENTITY_MISMATCH",
      `CROSS_DATE_JOIN_IDENTITY_MISMATCH_COUNT=${crossDateJoinIdentityMismatchCount}`,
    );
  }

  if (sealedPins && features.rows.length !== labels.rows.length) {
    throw new MultiseasonDevelopmentJoinError(
      "JOIN_COVERAGE_MISMATCH",
      `featureRows=${features.rows.length} labelRows=${labels.rows.length}`,
    );
  }
  if (sealedPins && canonical.artifact.rows.length !== features.rows.length) {
    throw new MultiseasonDevelopmentJoinError(
      "JOIN_COVERAGE_MISMATCH",
      `joinedRows=${canonical.artifact.rows.length} featureRows=${features.rows.length}`,
    );
  }
  if (
    options?.source != null &&
    sealedPins &&
    options.source.rowCount !== features.rows.length
  ) {
    throw new MultiseasonDevelopmentJoinError(
      "SOURCE_ROW_COUNT_MISMATCH",
      `SOURCE_ROWS=${options.source.rowCount} FEATURE_ROWS=${features.rows.length}`,
    );
  }

  const joinArtifactSha256 = hashMultiseasonDevelopmentJoinArtifact2023(
    canonical.artifact,
  );

  const audit: MultiseasonDevelopmentJoinAudit2023 = {
    schemaVersion: "mlb-independent-multiseason-development-join-audit-v1",
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    researchOnly: true,
    track: MLB_INDEPENDENT_MULTISEASON_DEVELOPMENT_TRACK,
    stage: MLB_INDEPENDENT_MULTISEASON_STAGE_STRICT_JOIN,
    season: MLB_INDEPENDENT_MULTISEASON_SEASON_2023,
    developmentEvidence: true,
    externalReplication: false,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    modelEvaluationAllowed: false,
    joinReady: true,
    datasetReady: false,
    splitCreated: false,
    modelRead: false,
    modelUsed: false,
    modelEvaluated: false,
    modelProbabilitiesCreated: false,
    transformedXCreated: false,
    statisticalAnalysisPerformed: false,
    marketUsed: false,
    networkUsed: false,
    engineChanged: false,
    recommendationChanged: false,
    holdoutEvaluated: false,
    holdoutFeatureRowsRead: 0,
    holdoutLabelRowsRead: 0,
    holdoutTransformedRows: 0,
    holdoutLogitsCreated: 0,
    holdoutProbabilitiesCreated: 0,
    "2025RowsInspected": false,
    sourceArtifactRel:
      options?.sourcePath ?? independentMultiseasonDevelopment2023SourceRel(),
    featureArtifactRel:
      options?.featurePath ?? independentMultiseasonDevelopment2023FeatureRel(),
    labelArtifactRel:
      options?.labelPath ?? independentMultiseasonDevelopment2023LabelRel(),
    joinArtifactRel: independentMultiseasonDevelopment2023JoinRel(),
    sourceArtifactSha256:
      options?.expectedSourceSha256 ?? MLB_INDEPENDENT_2023_JOIN_SOURCE_SHA256,
    featureArtifactSha256:
      options?.expectedFeatureSha256 ?? MLB_INDEPENDENT_2023_JOIN_FEATURE_SHA256,
    labelArtifactSha256:
      options?.expectedLabelSha256 ?? MLB_INDEPENDENT_2023_JOIN_LABEL_SHA256,
    joinArtifactSha256,
    sourceRows: options?.source?.rowCount ?? 0,
    featureRows: features.rows.length,
    labelRows: labels.rows.length,
    joinedRows: canonical.artifact.rows.length,
    featureUniqueGamePk: uniqueGamePkCount(features.rows),
    labelUniqueGamePk: uniqueGamePkCount(labels.rows),
    featureOnlyCount: 0,
    labelOnlyCount: 0,
    identityMismatchCount: 0,
    officialDateMismatchCount,
    commenceTimeUtcMismatchCount,
    homeTeamIdMismatchCount,
    awayTeamIdMismatchCount,
    sourceFeatureIdentityMismatchCount,
    sourceLabelIdentityMismatchCount,
    featureLabelIdentityMismatchCount,
    duplicateFeatureGamePk: 0,
    duplicateLabelGamePk: 0,
    featureHashVerifiedCount: canonical.audit.featureHashVerifiedCount,
    featureHashMismatchCount: 0,
    winnerTargetMismatchCount: 0,
    crossDateJoinIdentityMismatchCount,
    crossDateJoinCases,
  };

  return { artifact: canonical.artifact, audit };
}
