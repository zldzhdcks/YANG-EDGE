/**
 * MLB Independent Model v1 — strict Feature ↔ Label join.
 *
 * Pure / local-only. No network. Does not mutate sealed feature or label artifacts.
 * No split, trainer, model, or probability.
 */
import path from "node:path";
import {
  MLB_INDEPENDENT_ENGINE_ADMISSION,
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

export const MLB_INDEPENDENT_JOIN_SCHEMA_V1 =
  "mlb-independent-feature-label-join-v1" as const;
export const MLB_INDEPENDENT_JOIN_ROW_SCHEMA_V1 =
  "mlb-independent-feature-label-join-row-v1" as const;
export const MLB_INDEPENDENT_JOIN_BUILDER_VERSION =
  "mlb-independent-join-v1" as const;

const SHA256_HEX = /^[a-f0-9]{64}$/;

export function independentJoinArtifactRel(): string {
  return "data/research/mlb/independent-model-v1/join/2024-feature-label-join-v1.json";
}

export function independentJoinArtifactPath(cwd = process.cwd()): string {
  return path.join(cwd, independentJoinArtifactRel());
}

export function independentJoinAuditRel(): string {
  return "data/research/mlb/independent-model-v1/audits/2024-feature-label-join-audit-v1.json";
}

export function independentJoinAuditPath(cwd = process.cwd()): string {
  return path.join(cwd, independentJoinAuditRel());
}

export type IndependentJoinRowV1 = {
  schemaVersion: typeof MLB_INDEPENDENT_JOIN_ROW_SCHEMA_V1;
  identity: MlbIndependentIdentityV1;
  featureHash: string;
  feature: MlbIndependentFeatureRowV1;
  label: MlbIndependentLabelRowV1;
};

export type IndependentJoinArtifactV1 = {
  schemaVersion: typeof MLB_INDEPENDENT_JOIN_SCHEMA_V1;
  builderVersion: typeof MLB_INDEPENDENT_JOIN_BUILDER_VERSION;
  researchOnly: true;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  joinReady: true;
  independentModelSample: number;
  datasetReady: false;
  rows: IndependentJoinRowV1[];
};

export type IndependentJoinAuditV1 = {
  generatedAt: string;
  featurePath: string;
  labelPath: string;
  featureRows: number;
  labelRows: number;
  joinedRows: number;
  featureOnlyCount: number;
  labelOnlyCount: number;
  identityMismatchCount: number;
  duplicateFeatureGamePk: number;
  duplicateLabelGamePk: number;
  featureHashVerifiedCount: number;
  featureHashMismatchCount: number;
  winnerTargetMismatchCount: number;
  resumeCases: Array<{
    gamePk: number;
    featureOfficialDate: string;
    labelOfficialDate: string;
    winner: "HOME" | "AWAY";
    target: 0 | 1;
  }>;
  cancelled: { gamePk: 746577; joinCount: number };
  inputArtifactHashes: {
    feature: string | null;
    label: string | null;
  };
  independentModelSample: number;
  datasetReady: false;
  joinReady: true;
};

export type IndependentJoinResultV1 = {
  artifact: IndependentJoinArtifactV1;
  audit: IndependentJoinAuditV1;
};

export class IndependentJoinError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "IndependentJoinError";
    this.code = code;
  }
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
      throw new IndependentJoinError(
        duplicateCode,
        `duplicate ${kind} gamePk ${pk}`,
      );
    }
    map.set(pk, row);
  }
  return map;
}

function assertIdentitiesMatch(
  feature: MlbIndependentIdentityV1,
  label: MlbIndependentIdentityV1,
): void {
  if (feature.officialDate !== label.officialDate) {
    throw new IndependentJoinError(
      "IDENTITY_MISMATCH_OFFICIAL_DATE",
      `gamePk ${feature.gamePk} officialDate feature=${feature.officialDate} label=${label.officialDate}`,
    );
  }
  if (feature.homeTeamId !== label.homeTeamId) {
    throw new IndependentJoinError(
      "IDENTITY_MISMATCH_HOME_TEAM_ID",
      `gamePk ${feature.gamePk} homeTeamId mismatch`,
    );
  }
  if (feature.awayTeamId !== label.awayTeamId) {
    throw new IndependentJoinError(
      "IDENTITY_MISMATCH_AWAY_TEAM_ID",
      `gamePk ${feature.gamePk} awayTeamId mismatch`,
    );
  }
  if (feature.commenceTimeUtc !== label.commenceTimeUtc) {
    throw new IndependentJoinError(
      "IDENTITY_MISMATCH_COMMENCE_TIME_UTC",
      `gamePk ${feature.gamePk} commenceTimeUtc mismatch`,
    );
  }
}

function assertFeatureHashAuthentic(row: MlbIndependentFeatureRowV1): void {
  if (row.featureHash == null) {
    throw new IndependentJoinError(
      "FEATURE_HASH_NULL",
      `gamePk ${row.identity.gamePk} featureHash is null`,
    );
  }
  if (typeof row.featureHash !== "string" || !SHA256_HEX.test(row.featureHash)) {
    throw new IndependentJoinError(
      "FEATURE_HASH_MALFORMED",
      `gamePk ${row.identity.gamePk} featureHash is not 64 lowercase hex`,
    );
  }
  const recomputed = hashIndependentFeatureRowV1(row);
  if (recomputed !== row.featureHash) {
    throw new IndependentJoinError(
      "FEATURE_HASH_MISMATCH",
      `gamePk ${row.identity.gamePk} stored hash does not match recomputation`,
    );
  }
}

function assertLabelTarget(row: MlbIndependentLabelRowV1): void {
  const check = validateIndependentLabelRowV1(row);
  if (!check.ok) {
    throw new IndependentJoinError(
      "LABEL_ROW_INVALID",
      `gamePk ${row.identity.gamePk}: ${check.errors.join(" | ")}`,
    );
  }
  const expected = row.winner === "HOME" ? 1 : 0;
  if (row.target !== expected) {
    throw new IndependentJoinError(
      "LABEL_TARGET_MISMATCH",
      `gamePk ${row.identity.gamePk} winner=${row.winner} target=${row.target}`,
    );
  }
}

export function joinIndependentFeatureLabelV1(
  features: MlbIndependentFeatureArtifactV1,
  labels: MlbIndependentLabelArtifactV1,
  options?: {
    generatedAt?: string;
    featurePath?: string;
    labelPath?: string;
    featureArtifactHash?: string | null;
    labelArtifactHash?: string | null;
  },
): IndependentJoinResultV1 {
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
      throw new IndependentJoinError(
        "FEATURE_HASH_NULL",
        `gamePk ${feature.identity.gamePk} featureHash is null`,
      );
    }
    if (
      typeof feature.featureHash !== "string" ||
      !SHA256_HEX.test(feature.featureHash)
    ) {
      throw new IndependentJoinError(
        "FEATURE_HASH_MALFORMED",
        `gamePk ${feature.identity.gamePk} featureHash is not 64 lowercase hex`,
      );
    }
  }

  for (const label of labels.rows) {
    const expected =
      label.winner === "HOME" ? 1 : label.winner === "AWAY" ? 0 : null;
    if (expected != null && label.target !== expected) {
      throw new IndependentJoinError(
        "LABEL_TARGET_MISMATCH",
        `gamePk ${label.identity.gamePk} winner=${label.winner} target=${label.target}`,
      );
    }
  }

  const featureCheck = validateIndependentFeatureArtifactV1(features);
  if (!featureCheck.ok) {
    throw new IndependentJoinError(
      "FEATURE_ARTIFACT_INVALID",
      featureCheck.errors.join(" | "),
    );
  }
  const labelCheck = validateIndependentLabelArtifactV1(labels);
  if (!labelCheck.ok) {
    throw new IndependentJoinError(
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
    throw new IndependentJoinError(
      "FEATURE_LABEL_SET_MISMATCH",
      `FEATURE_ONLY_GAMEPK_COUNT=${featureOnly.length} LABEL_ONLY_GAMEPK_COUNT=${labelOnly.length}`,
    );
  }

  const rows: IndependentJoinRowV1[] = [];
  let featureHashVerifiedCount = 0;

  for (const [gamePk, feature] of featureByPk) {
    const label = labelByPk.get(gamePk)!;
    assertIdentitiesMatch(feature.identity, label.identity);
    assertFeatureHashAuthentic(feature);
    featureHashVerifiedCount += 1;
    assertLabelTarget(label);
    const rowCheck = validateIndependentFeatureRowV1(feature);
    if (!rowCheck.ok) {
      throw new IndependentJoinError(
        "FEATURE_ROW_INVALID",
        `gamePk ${gamePk}: ${rowCheck.errors.join(" | ")}`,
      );
    }

    rows.push({
      schemaVersion: MLB_INDEPENDENT_JOIN_ROW_SCHEMA_V1,
      identity: { ...feature.identity },
      featureHash: feature.featureHash as string,
      feature,
      label,
    });
  }

  rows.sort((a, b) => compareIdentity(a.identity, b.identity));

  const artifact: IndependentJoinArtifactV1 = {
    schemaVersion: MLB_INDEPENDENT_JOIN_SCHEMA_V1,
    builderVersion: MLB_INDEPENDENT_JOIN_BUILDER_VERSION,
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    joinReady: true,
    independentModelSample: rows.length,
    datasetReady: false,
    rows,
  };

  const resumePks = [745180, 746942, 746755];
  const resumeCases = resumePks
    .map((gamePk) => {
      const joined = rows.find((r) => r.identity.gamePk === gamePk);
      if (!joined) return null;
      return {
        gamePk,
        featureOfficialDate: joined.feature.identity.officialDate,
        labelOfficialDate: joined.label.identity.officialDate,
        winner: joined.label.winner,
        target: joined.label.target,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const audit: IndependentJoinAuditV1 = {
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    featurePath:
      options?.featurePath ??
      "data/research/mlb/independent-model-v1/features/2024-safe-a-feature-artifact-v1.json",
    labelPath:
      options?.labelPath ??
      "data/research/mlb/independent-model-v1/labels/2024-home-win-label-artifact-v1.json",
    featureRows: features.rows.length,
    labelRows: labels.rows.length,
    joinedRows: rows.length,
    featureOnlyCount: 0,
    labelOnlyCount: 0,
    identityMismatchCount: 0,
    duplicateFeatureGamePk: 0,
    duplicateLabelGamePk: 0,
    featureHashVerifiedCount,
    featureHashMismatchCount: 0,
    winnerTargetMismatchCount: 0,
    resumeCases,
    cancelled: {
      gamePk: 746577,
      joinCount: rows.filter((r) => r.identity.gamePk === 746577).length,
    },
    inputArtifactHashes: {
      feature: options?.featureArtifactHash ?? null,
      label: options?.labelArtifactHash ?? null,
    },
    independentModelSample: rows.length,
    datasetReady: false,
    joinReady: true,
  };

  return { artifact, audit };
}
