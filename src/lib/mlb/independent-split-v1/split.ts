/**
 * MLB Independent Model v1 — chronological TRAIN / VALIDATION / HOLDOUT split.
 *
 * Pure / local-only. No network. Does not mutate sealed join / feature / label artifacts.
 * No trainer, model, or probability. Membership uses officialDate + row count only.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import {
  MLB_INDEPENDENT_ENGINE_ADMISSION,
  MLB_INDEPENDENT_TEAM_SIDE_KEYS_V1,
  validateIndependentFeatureRowV1,
  validateIndependentLabelRowV1,
  type MlbIndependentIdentityV1,
  type MlbIndependentTeamSideFeaturesV1,
} from "../independent-model-v1";
import {
  type IndependentJoinArtifactV1,
  type IndependentJoinRowV1,
} from "../independent-join-v1";
import { hashIndependentFeatureRowV1 } from "../independent-safe-a-v1/materialize";

export const MLB_INDEPENDENT_SPLIT_SCHEMA_V1 =
  "mlb-independent-chronological-split-v1" as const;
export const MLB_INDEPENDENT_SPLIT_BUILDER_VERSION =
  "mlb-independent-split-v1" as const;
export const MLB_INDEPENDENT_SPLIT_POLICY_V1 =
  "CHRONOLOGICAL_OFFICIAL_DATE_60_20_20" as const;

export const MLB_INDEPENDENT_SPLIT_TARGET_TRAIN_RATIO = 0.6;
export const MLB_INDEPENDENT_SPLIT_TARGET_VALIDATION_RATIO = 0.2;
export const MLB_INDEPENDENT_SPLIT_TARGET_HOLDOUT_RATIO = 0.2;

/** Official sealed 2024 Feature↔Label join artifact SHA-256. Production pin only. */
export const MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1 =
  "6f9e0875d453fe52de8d56fef0a25427270989123df568020c8e1d0fdd417127";

const SHA256_HEX = /^[a-f0-9]{64}$/;

export function sha256JoinBytesV1(joinBuf: Buffer): string {
  return createHash("sha256").update(joinBuf).digest("hex");
}

export function independentSplitArtifactRel(): string {
  return "data/research/mlb/independent-model-v1/split/2024-chronological-split-v1.json";
}

export function independentSplitArtifactPath(cwd = process.cwd()): string {
  return path.join(cwd, independentSplitArtifactRel());
}

export function independentSplitAuditRel(): string {
  return "data/research/mlb/independent-model-v1/audits/2024-chronological-split-audit-v1.json";
}

export function independentSplitAuditPath(cwd = process.cwd()): string {
  return path.join(cwd, independentSplitAuditRel());
}

export type IndependentSplitBoundariesV1 = {
  trainStartDate: string;
  trainEndDate: string;
  validationStartDate: string;
  validationEndDate: string;
  holdoutStartDate: string;
  holdoutEndDate: string;
};

export type IndependentSplitCountsV1 = {
  train: number;
  validation: number;
  holdout: number;
  total: number;
};

export type IndependentSplitArtifactV1 = {
  schemaVersion: typeof MLB_INDEPENDENT_SPLIT_SCHEMA_V1;
  builderVersion: typeof MLB_INDEPENDENT_SPLIT_BUILDER_VERSION;
  researchOnly: true;
  engineAdmission: typeof MLB_INDEPENDENT_ENGINE_ADMISSION;
  sourceJoinArtifactHash: string;
  independentModelSample: number;
  splitReady: true;
  datasetReady: true;
  policy: typeof MLB_INDEPENDENT_SPLIT_POLICY_V1;
  boundaries: IndependentSplitBoundariesV1;
  counts: IndependentSplitCountsV1;
  trainGamePks: number[];
  validationGamePks: number[];
  holdoutGamePks: number[];
  splitManifestHash: string;
};

export type IndependentSplitLabelDistV1 = {
  HOME: number;
  AWAY: number;
  HOME_RATE: number;
};

export type IndependentSplitNullFieldAuditV1 = {
  nullCount: number;
  nonNullCount: number;
  nullRate: number;
};

export type IndependentSplitAuditV1 = {
  generatedAt: string;
  sourceJoinPath: string;
  sourceJoinHash: string;
  totalRows: number;
  targetRatio: {
    train: typeof MLB_INDEPENDENT_SPLIT_TARGET_TRAIN_RATIO;
    validation: typeof MLB_INDEPENDENT_SPLIT_TARGET_VALIDATION_RATIO;
    holdout: typeof MLB_INDEPENDENT_SPLIT_TARGET_HOLDOUT_RATIO;
  };
  actualCounts: IndependentSplitCountsV1;
  actualRatios: {
    train: number;
    validation: number;
    holdout: number;
  };
  boundaries: IndependentSplitBoundariesV1;
  sameDateSplitCount: number;
  overlapCounts: {
    trainValidation: number;
    trainHoldout: number;
    validationHoldout: number;
  };
  unionMissingCount: number;
  unionExtraCount: number;
  chronologicalViolationCount: number;
  partitionLabelDistribution: {
    train: IndependentSplitLabelDistV1;
    validation: IndependentSplitLabelDistV1;
    holdout: IndependentSplitLabelDistV1;
    total: IndependentSplitLabelDistV1;
  };
  partitionFeatureNullAudit: {
    train: Record<string, IndependentSplitNullFieldAuditV1>;
    validation: Record<string, IndependentSplitNullFieldAuditV1>;
    holdout: Record<string, IndependentSplitNullFieldAuditV1>;
  };
  splitManifestHash: string;
  independentModelSample: number;
  splitReady: true;
  datasetReady: true;
};

export type IndependentSplitResultV1 = {
  artifact: IndependentSplitArtifactV1;
  audit: IndependentSplitAuditV1;
};

export type IndependentSplitIdentityV1 = {
  gamePk: number;
  officialDate: string;
  commenceTimeUtc: string;
};

export type IndependentSplitMembershipV1 = {
  boundaries: IndependentSplitBoundariesV1;
  counts: IndependentSplitCountsV1;
  trainGamePks: number[];
  validationGamePks: number[];
  holdoutGamePks: number[];
};

export class IndependentSplitError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "IndependentSplitError";
    this.code = code;
  }
}

function compareIdentity(
  a: IndependentSplitIdentityV1,
  b: IndependentSplitIdentityV1,
): number {
  if (a.officialDate !== b.officialDate) {
    return a.officialDate < b.officialDate ? -1 : 1;
  }
  if (a.commenceTimeUtc !== b.commenceTimeUtc) {
    return a.commenceTimeUtc < b.commenceTimeUtc ? -1 : 1;
  }
  return a.gamePk - b.gamePk;
}

function ratio(part: number, total: number): number {
  return total === 0 ? 0 : part / total;
}

function labelDist(rows: IndependentJoinRowV1[]): IndependentSplitLabelDistV1 {
  let HOME = 0;
  let AWAY = 0;
  for (const row of rows) {
    if (row.label.winner === "HOME") HOME += 1;
    else AWAY += 1;
  }
  return { HOME, AWAY, HOME_RATE: ratio(HOME, HOME + AWAY) };
}

function nullAuditForRows(
  rows: IndependentJoinRowV1[],
): Record<string, IndependentSplitNullFieldAuditV1> {
  const keys: string[] = [];
  for (const side of ["home", "away"] as const) {
    for (const field of MLB_INDEPENDENT_TEAM_SIDE_KEYS_V1) {
      keys.push(`${side}.${field}`);
    }
  }
  keys.push(
    "headToHeadGamesBefore",
    "headToHeadHomeWinsBefore",
    "headToHeadAwayWinsBefore",
  );
  const out: Record<string, IndependentSplitNullFieldAuditV1> = {};
  for (const key of keys) {
    let nullCount = 0;
    let nonNullCount = 0;
    for (const row of rows) {
      const value = readFeatureField(row, key);
      if (value === null) nullCount += 1;
      else nonNullCount += 1;
    }
    out[key] = {
      nullCount,
      nonNullCount,
      nullRate: ratio(nullCount, nullCount + nonNullCount),
    };
  }
  return out;
}

function readFeatureField(
  row: IndependentJoinRowV1,
  key: string,
): unknown {
  if (key.startsWith("home.") || key.startsWith("away.")) {
    const [side, field] = key.split(".") as [
      "home" | "away",
      keyof MlbIndependentTeamSideFeaturesV1,
    ];
    return row.feature[side][field];
  }
  return row.feature[key as "headToHeadGamesBefore"];
}

function closestPrefixIndex(
  prefixCounts: number[],
  target: number,
  minIndex: number,
  maxIndex: number,
): number {
  let best = minIndex;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let i = minIndex; i <= maxIndex; i += 1) {
    const diff = Math.abs(prefixCounts[i]! - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

export function hashIndependentSplitManifestV1(input: {
  sourceJoinArtifactHash: string;
  boundaries: IndependentSplitBoundariesV1;
  trainGamePks: number[];
  validationGamePks: number[];
  holdoutGamePks: number[];
}): string {
  const canonical = JSON.stringify({
    sourceJoinArtifactHash: input.sourceJoinArtifactHash,
    boundaries: {
      trainStartDate: input.boundaries.trainStartDate,
      trainEndDate: input.boundaries.trainEndDate,
      validationStartDate: input.boundaries.validationStartDate,
      validationEndDate: input.boundaries.validationEndDate,
      holdoutStartDate: input.boundaries.holdoutStartDate,
      holdoutEndDate: input.boundaries.holdoutEndDate,
    },
    trainGamePks: input.trainGamePks,
    validationGamePks: input.validationGamePks,
    holdoutGamePks: input.holdoutGamePks,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function assignChronologicalPartitionsV1(
  identities: IndependentSplitIdentityV1[],
): IndependentSplitMembershipV1 {
  if (identities.length === 0) {
    throw new IndependentSplitError(
      "EMPTY_JOIN",
      "join rows are empty",
    );
  }
  const sorted = [...identities].sort(compareIdentity);
  const groups: Array<{ officialDate: string; rows: IndependentSplitIdentityV1[] }> =
    [];
  for (const row of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.officialDate === row.officialDate) {
      last.rows.push(row);
    } else {
      groups.push({ officialDate: row.officialDate, rows: [row] });
    }
  }
  if (groups.length < 3) {
    throw new IndependentSplitError(
      "INSUFFICIENT_OFFICIAL_DATES",
      `need at least 3 officialDate groups, got ${groups.length}`,
    );
  }

  const prefixCounts: number[] = [];
  let cum = 0;
  for (const group of groups) {
    cum += group.rows.length;
    prefixCounts.push(cum);
  }
  const total = sorted.length;
  const trainTarget = MLB_INDEPENDENT_SPLIT_TARGET_TRAIN_RATIO * total;
  const trainValTarget =
    (MLB_INDEPENDENT_SPLIT_TARGET_TRAIN_RATIO +
      MLB_INDEPENDENT_SPLIT_TARGET_VALIDATION_RATIO) *
    total;

  const trainEndIndex = closestPrefixIndex(
    prefixCounts,
    trainTarget,
    0,
    groups.length - 3,
  );
  const validationEndIndex = closestPrefixIndex(
    prefixCounts,
    trainValTarget,
    trainEndIndex + 1,
    groups.length - 2,
  );

  const trainGamePks: number[] = [];
  const validationGamePks: number[] = [];
  const holdoutGamePks: number[] = [];
  for (let i = 0; i < groups.length; i += 1) {
    const pks = groups[i]!.rows.map((r) => r.gamePk);
    if (i <= trainEndIndex) trainGamePks.push(...pks);
    else if (i <= validationEndIndex) validationGamePks.push(...pks);
    else holdoutGamePks.push(...pks);
  }

  const membership: IndependentSplitMembershipV1 = {
    boundaries: {
      trainStartDate: groups[0]!.officialDate,
      trainEndDate: groups[trainEndIndex]!.officialDate,
      validationStartDate: groups[trainEndIndex + 1]!.officialDate,
      validationEndDate: groups[validationEndIndex]!.officialDate,
      holdoutStartDate: groups[validationEndIndex + 1]!.officialDate,
      holdoutEndDate: groups[groups.length - 1]!.officialDate,
    },
    counts: {
      train: trainGamePks.length,
      validation: validationGamePks.length,
      holdout: holdoutGamePks.length,
      total,
    },
    trainGamePks,
    validationGamePks,
    holdoutGamePks,
  };
  assertChronologicalSplitInvariantsV1(sorted, membership);
  return membership;
}

export function assertChronologicalSplitInvariantsV1(
  identities: IndependentSplitIdentityV1[],
  membership: IndependentSplitMembershipV1,
): void {
  const byPk = new Map<number, IndependentSplitIdentityV1>();
  for (const row of identities) {
    if (row.gamePk == null || !Number.isInteger(row.gamePk)) {
      throw new IndependentSplitError(
        "MISSING_GAMEPK",
        "identity is missing integer gamePk",
      );
    }
    if (byPk.has(row.gamePk)) {
      throw new IndependentSplitError(
        "DUPLICATE_GAMEPK",
        `duplicate gamePk ${row.gamePk}`,
      );
    }
    byPk.set(row.gamePk, row);
  }

  const trainSet = new Set(membership.trainGamePks);
  const validationSet = new Set(membership.validationGamePks);
  const holdoutSet = new Set(membership.holdoutGamePks);
  const trainValidation = [...trainSet].filter((pk) => validationSet.has(pk));
  const trainHoldout = [...trainSet].filter((pk) => holdoutSet.has(pk));
  const validationHoldout = [...validationSet].filter((pk) =>
    holdoutSet.has(pk),
  );
  if (
    trainValidation.length > 0 ||
    trainHoldout.length > 0 ||
    validationHoldout.length > 0
  ) {
    throw new IndependentSplitError(
      "PARTITION_OVERLAP",
      `train∩validation=${trainValidation.length} train∩holdout=${trainHoldout.length} validation∩holdout=${validationHoldout.length}`,
    );
  }

  const union = new Set([
    ...membership.trainGamePks,
    ...membership.validationGamePks,
    ...membership.holdoutGamePks,
  ]);
  const missing = [...byPk.keys()].filter((pk) => !union.has(pk));
  const extra = [...union].filter((pk) => !byPk.has(pk));
  if (missing.length > 0) {
    throw new IndependentSplitError(
      "PARTITION_UNION_MISSING",
      `union missing ${missing.length} gamePk`,
    );
  }
  if (extra.length > 0) {
    throw new IndependentSplitError(
      "PARTITION_UNION_EXTRA",
      `union extra ${extra.length} gamePk`,
    );
  }

  const dateOwner = new Map<string, "train" | "validation" | "holdout">();
  const assignDate = (
    pks: number[],
    partition: "train" | "validation" | "holdout",
  ) => {
    for (const pk of pks) {
      const date = byPk.get(pk)!.officialDate;
      const prior = dateOwner.get(date);
      if (prior != null && prior !== partition) {
        throw new IndependentSplitError(
          "SAME_DATE_SPLIT",
          `officialDate ${date} appears in ${prior} and ${partition}`,
        );
      }
      dateOwner.set(date, partition);
    }
  };
  assignDate(membership.trainGamePks, "train");
  assignDate(membership.validationGamePks, "validation");
  assignDate(membership.holdoutGamePks, "holdout");

  const maxTrain = membership.boundaries.trainEndDate;
  const minVal = membership.boundaries.validationStartDate;
  const maxVal = membership.boundaries.validationEndDate;
  const minHold = membership.boundaries.holdoutStartDate;
  if (!(maxTrain < minVal) || !(maxVal < minHold)) {
    throw new IndependentSplitError(
      "CHRONOLOGICAL_INVERSION",
      `trainEnd=${maxTrain} validation=${minVal}..${maxVal} holdoutStart=${minHold}`,
    );
  }
}

function identitiesMatch(
  a: MlbIndependentIdentityV1,
  b: MlbIndependentIdentityV1,
): boolean {
  return (
    a.gamePk === b.gamePk &&
    a.officialDate === b.officialDate &&
    a.homeTeamId === b.homeTeamId &&
    a.awayTeamId === b.awayTeamId &&
    a.commenceTimeUtc === b.commenceTimeUtc
  );
}

export function verifyIndependentJoinArtifactForSplitV1(
  join: IndependentJoinArtifactV1,
): void {
  if (join.joinReady !== true) {
    throw new IndependentSplitError(
      "JOIN_NOT_READY",
      "joinReady != true",
    );
  }
  if (join.datasetReady !== false) {
    throw new IndependentSplitError(
      "JOIN_DATASET_READY_INVALID",
      "join artifact datasetReady must remain false",
    );
  }
  if (!Array.isArray(join.rows)) {
    throw new IndependentSplitError("JOIN_ROWS_MISSING", "join.rows missing");
  }
  if (join.rows.length !== join.independentModelSample) {
    throw new IndependentSplitError(
      "JOIN_SAMPLE_COUNT_MISMATCH",
      `rows.length=${join.rows.length} independentModelSample=${join.independentModelSample}`,
    );
  }
  const seen = new Set<number>();
  for (const row of join.rows) {
    const pk = row.identity?.gamePk;
    if (pk == null || !Number.isInteger(pk)) {
      throw new IndependentSplitError(
        "MISSING_GAMEPK",
        "join row missing integer gamePk",
      );
    }
    if (seen.has(pk)) {
      throw new IndependentSplitError(
        "DUPLICATE_GAMEPK",
        `duplicate gamePk ${pk}`,
      );
    }
    seen.add(pk);
    if (!identitiesMatch(row.identity, row.feature.identity)) {
      throw new IndependentSplitError(
        "IDENTITY_MISMATCH",
        `gamePk ${pk} join identity != feature identity`,
      );
    }
    if (!identitiesMatch(row.identity, row.label.identity)) {
      throw new IndependentSplitError(
        "IDENTITY_MISMATCH",
        `gamePk ${pk} join identity != label identity`,
      );
    }
    if (row.featureHash == null || row.feature.featureHash == null) {
      throw new IndependentSplitError(
        "FEATURE_HASH_NULL",
        `gamePk ${pk} featureHash is null`,
      );
    }
    if (
      typeof row.featureHash !== "string" ||
      !SHA256_HEX.test(row.featureHash) ||
      typeof row.feature.featureHash !== "string" ||
      !SHA256_HEX.test(row.feature.featureHash)
    ) {
      throw new IndependentSplitError(
        "FEATURE_HASH_MALFORMED",
        `gamePk ${pk} featureHash is not 64 lowercase hex`,
      );
    }
    if (row.featureHash !== row.feature.featureHash) {
      throw new IndependentSplitError(
        "FEATURE_HASH_MISMATCH",
        `gamePk ${pk} join featureHash != feature.featureHash`,
      );
    }
    const recomputed = hashIndependentFeatureRowV1(row.feature);
    if (recomputed !== row.featureHash) {
      throw new IndependentSplitError(
        "FEATURE_HASH_MISMATCH",
        `gamePk ${pk} stored hash does not match recomputation`,
      );
    }
    const featureCheck = validateIndependentFeatureRowV1(row.feature);
    if (!featureCheck.ok) {
      throw new IndependentSplitError(
        "FEATURE_ROW_INVALID",
        `gamePk ${pk}: ${featureCheck.errors.join(" | ")}`,
      );
    }
    const labelCheck = validateIndependentLabelRowV1(row.label);
    if (!labelCheck.ok) {
      throw new IndependentSplitError(
        "LABEL_ROW_INVALID",
        `gamePk ${pk}: ${labelCheck.errors.join(" | ")}`,
      );
    }
    const expected = row.label.winner === "HOME" ? 1 : 0;
    if (row.label.target !== expected) {
      throw new IndependentSplitError(
        "LABEL_TARGET_MISMATCH",
        `gamePk ${pk} winner=${row.label.winner} target=${row.label.target}`,
      );
    }
  }
}

export function assertSealedJoinArtifactBytesV1(joinBuf: Buffer): string {
  const actualJoinHash = sha256JoinBytesV1(joinBuf);
  if (actualJoinHash !== MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1) {
    throw new IndependentSplitError(
      "SEALED_JOIN_ARTIFACT_HASH_MISMATCH",
      `actualJoinHash=${actualJoinHash} sealed=${MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1}`,
    );
  }
  return actualJoinHash;
}

export function splitSealedIndependentJoinBytesV1(
  joinBuf: Buffer,
  options?: {
    sourceJoinPath?: string;
    generatedAt?: string;
  },
): IndependentSplitResultV1 {
  const actualJoinHash = assertSealedJoinArtifactBytesV1(joinBuf);
  const join = JSON.parse(joinBuf.toString("utf8")) as IndependentJoinArtifactV1;
  return splitIndependentJoinV1(join, {
    sourceJoinArtifactHash: actualJoinHash,
    expectedSourceJoinHash: MLB_INDEPENDENT_2024_SEALED_JOIN_SHA256_V1,
    sourceJoinPath:
      options?.sourceJoinPath ??
      "data/research/mlb/independent-model-v1/join/2024-feature-label-join-v1.json",
    generatedAt: options?.generatedAt,
  });
}

export function splitIndependentJoinV1(
  join: IndependentJoinArtifactV1,
  options: {
    sourceJoinArtifactHash: string;
    expectedSourceJoinHash: string;
    sourceJoinPath?: string;
    generatedAt?: string;
    verifyJoinIntegrity?: boolean;
  },
): IndependentSplitResultV1 {
  if (
    typeof options.sourceJoinArtifactHash !== "string" ||
    !SHA256_HEX.test(options.sourceJoinArtifactHash)
  ) {
    throw new IndependentSplitError(
      "SOURCE_JOIN_HASH_MALFORMED",
      "sourceJoinArtifactHash must be 64 lowercase hex",
    );
  }
  if (
    typeof options.expectedSourceJoinHash !== "string" ||
    !SHA256_HEX.test(options.expectedSourceJoinHash)
  ) {
    throw new IndependentSplitError(
      "EXPECTED_SOURCE_JOIN_HASH_REQUIRED",
      "expectedSourceJoinHash is required 64 lowercase hex",
    );
  }
  if (options.expectedSourceJoinHash !== options.sourceJoinArtifactHash) {
    throw new IndependentSplitError(
      "TAMPERED_SOURCE_JOIN_HASH",
      "expectedSourceJoinHash does not match sourceJoinArtifactHash",
    );
  }
  if (options.verifyJoinIntegrity !== false) {
    verifyIndependentJoinArtifactForSplitV1(join);
  }

  const membership = assignChronologicalPartitionsV1(
    join.rows.map((row) => ({
      gamePk: row.identity.gamePk,
      officialDate: row.identity.officialDate,
      commenceTimeUtc: row.identity.commenceTimeUtc,
    })),
  );

  const byPk = new Map<number, IndependentJoinRowV1>();
  for (const row of join.rows) {
    byPk.set(row.identity.gamePk, row);
  }
  const trainRows = membership.trainGamePks.map((pk) => byPk.get(pk)!);
  const validationRows = membership.validationGamePks.map((pk) => byPk.get(pk)!);
  const holdoutRows = membership.holdoutGamePks.map((pk) => byPk.get(pk)!);

  const splitManifestHash = hashIndependentSplitManifestV1({
    sourceJoinArtifactHash: options.sourceJoinArtifactHash,
    boundaries: membership.boundaries,
    trainGamePks: membership.trainGamePks,
    validationGamePks: membership.validationGamePks,
    holdoutGamePks: membership.holdoutGamePks,
  });

  const artifact: IndependentSplitArtifactV1 = {
    schemaVersion: MLB_INDEPENDENT_SPLIT_SCHEMA_V1,
    builderVersion: MLB_INDEPENDENT_SPLIT_BUILDER_VERSION,
    researchOnly: true,
    engineAdmission: MLB_INDEPENDENT_ENGINE_ADMISSION,
    sourceJoinArtifactHash: options.sourceJoinArtifactHash,
    independentModelSample: join.rows.length,
    splitReady: true,
    datasetReady: true,
    policy: MLB_INDEPENDENT_SPLIT_POLICY_V1,
    boundaries: membership.boundaries,
    counts: membership.counts,
    trainGamePks: membership.trainGamePks,
    validationGamePks: membership.validationGamePks,
    holdoutGamePks: membership.holdoutGamePks,
    splitManifestHash,
  };

  const total = join.rows.length;
  const trainDist = labelDist(trainRows);
  const validationDist = labelDist(validationRows);
  const holdoutDist = labelDist(holdoutRows);
  const totalDist = labelDist(join.rows);

  const audit: IndependentSplitAuditV1 = {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    sourceJoinPath:
      options.sourceJoinPath ??
      "data/research/mlb/independent-model-v1/join/2024-feature-label-join-v1.json",
    sourceJoinHash: options.sourceJoinArtifactHash,
    totalRows: total,
    targetRatio: {
      train: MLB_INDEPENDENT_SPLIT_TARGET_TRAIN_RATIO,
      validation: MLB_INDEPENDENT_SPLIT_TARGET_VALIDATION_RATIO,
      holdout: MLB_INDEPENDENT_SPLIT_TARGET_HOLDOUT_RATIO,
    },
    actualCounts: membership.counts,
    actualRatios: {
      train: ratio(membership.counts.train, total),
      validation: ratio(membership.counts.validation, total),
      holdout: ratio(membership.counts.holdout, total),
    },
    boundaries: membership.boundaries,
    sameDateSplitCount: 0,
    overlapCounts: {
      trainValidation: 0,
      trainHoldout: 0,
      validationHoldout: 0,
    },
    unionMissingCount: 0,
    unionExtraCount: 0,
    chronologicalViolationCount: 0,
    partitionLabelDistribution: {
      train: trainDist,
      validation: validationDist,
      holdout: holdoutDist,
      total: totalDist,
    },
    partitionFeatureNullAudit: {
      train: nullAuditForRows(trainRows),
      validation: nullAuditForRows(validationRows),
      holdout: nullAuditForRows(holdoutRows),
    },
    splitManifestHash,
    independentModelSample: join.rows.length,
    splitReady: true,
    datasetReady: true,
  };

  return { artifact, audit };
}
