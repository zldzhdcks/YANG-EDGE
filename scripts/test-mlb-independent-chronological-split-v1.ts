/**
 * MLB Independent chronological TRAIN / VALIDATION / HOLDOUT split tests.
 * No network. No trainer, model, or engine wiring.
 *
 *   npm run test:mlb-independent-chronological-split-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { IndependentJoinArtifactV1 } from "../src/lib/mlb/independent-join-v1";
import { independentJoinArtifactPath } from "../src/lib/mlb/independent-join-v1";
import { independentLabelArtifactPath } from "../src/lib/mlb/independent-label-v1";
import {
  independentSafeAFeatureArtifactPath,
  independentSafeAHistoricalSourcePath,
} from "../src/lib/mlb/independent-safe-a-v1/historical-source";
import { hashIndependentFeatureRowV1 } from "../src/lib/mlb/independent-safe-a-v1/materialize";
import {
  assertChronologicalSplitInvariantsV1,
  assignChronologicalPartitionsV1,
  independentSplitArtifactPath,
  independentSplitAuditPath,
  splitIndependentJoinV1,
} from "../src/lib/mlb/independent-split-v1";

const ROOT = process.cwd();
const LIB_DIR = path.join(ROOT, "src/lib/mlb/independent-split-v1");
const JOIN_BEFORE =
  "6f9e0875d453fe52de8d56fef0a25427270989123df568020c8e1d0fdd417127";
const FEATURE_BEFORE =
  "5f0cf297ebc9e5a1e0b10aad136632f51ddbc9f6b1560c676f3df2aa2ea8c753";
const LABEL_BEFORE =
  "9f52cd1de57567819dd7f6fea245baad1365a6eae12dadeafec76ead02d7a3da";
const SOURCE_BEFORE =
  "7a637e182a91a0b20e399ed2a4d98824c3a5916ac61cb6903e504a919a514e7d";

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

function loadJoin(): IndependentJoinArtifactV1 {
  return JSON.parse(readFileSync(independentJoinArtifactPath(), "utf8"));
}

function fixtureJoin(dateCount: number): IndependentJoinArtifactV1 {
  const join = clone(loadJoin());
  const dates: string[] = [];
  const seen = new Set<string>();
  for (const row of join.rows) {
    if (!seen.has(row.identity.officialDate)) {
      seen.add(row.identity.officialDate);
      dates.push(row.identity.officialDate);
      if (dates.length >= dateCount) break;
    }
  }
  const keep = new Set(dates);
  join.rows = join.rows.filter((r) => keep.has(r.identity.officialDate));
  join.independentModelSample = join.rows.length;
  return join;
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
  const joinHash = sha256File(independentJoinArtifactPath());
  assert.equal(joinHash, JOIN_BEFORE);
  const sealed = loadJoin();
  assert.equal(sealed.joinReady, true);
  assert.equal(sealed.datasetReady, false);
  assert.equal(sealed.independentModelSample, sealed.rows.length);
  assert.equal(sealed.rows.length, 2429);

  const full = splitIndependentJoinV1(sealed, {
    sourceJoinArtifactHash: joinHash,
    expectedSourceJoinHash: joinHash,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.equal(full.artifact.splitReady, true);
  assert.equal(full.artifact.datasetReady, true);
  assert.equal(full.artifact.researchOnly, true);
  assert.equal(full.artifact.engineAdmission, "PROHIBITED");
  assert.equal(full.artifact.independentModelSample, 2429);
  assert.equal(full.artifact.counts.total, 2429);
  assert.equal(
    full.artifact.counts.train +
      full.artifact.counts.validation +
      full.artifact.counts.holdout,
    2429,
  );
  assert.ok(full.artifact.counts.train > 0);
  assert.ok(full.artifact.counts.validation > 0);
  assert.ok(full.artifact.counts.holdout > 0);
  assert.ok(full.artifact.boundaries.trainEndDate < full.artifact.boundaries.validationStartDate);
  assert.ok(
    full.artifact.boundaries.validationEndDate <
      full.artifact.boundaries.holdoutStartDate,
  );
  assert.equal(full.audit.sameDateSplitCount, 0);
  assert.equal(full.audit.overlapCounts.trainValidation, 0);
  assert.equal(full.audit.overlapCounts.trainHoldout, 0);
  assert.equal(full.audit.overlapCounts.validationHoldout, 0);
  assert.equal(full.audit.unionMissingCount, 0);
  assert.equal(full.audit.unionExtraCount, 0);
  assert.equal(full.audit.chronologicalViolationCount, 0);
  assert.equal(full.audit.partitionLabelDistribution.total.HOME, 1267);
  assert.equal(full.audit.partitionLabelDistribution.total.AWAY, 1162);
  assert.equal(
    full.audit.partitionLabelDistribution.train.HOME +
      full.audit.partitionLabelDistribution.validation.HOME +
      full.audit.partitionLabelDistribution.holdout.HOME,
    1267,
  );
  assert.equal(
    full.audit.partitionLabelDistribution.train.AWAY +
      full.audit.partitionLabelDistribution.validation.AWAY +
      full.audit.partitionLabelDistribution.holdout.AWAY,
    1162,
  );
  assert.match(full.artifact.splitManifestHash, /^[a-f0-9]{64}$/);

  const shuffledJoin = clone(sealed);
  shuffledJoin.rows = shuffle(shuffledJoin.rows);
  const fromShuffled = splitIndependentJoinV1(shuffledJoin, {
    sourceJoinArtifactHash: joinHash,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.deepEqual(fromShuffled.artifact.boundaries, full.artifact.boundaries);
  assert.deepEqual(fromShuffled.artifact.trainGamePks, full.artifact.trainGamePks);
  assert.deepEqual(
    fromShuffled.artifact.validationGamePks,
    full.artifact.validationGamePks,
  );
  assert.deepEqual(fromShuffled.artifact.holdoutGamePks, full.artifact.holdoutGamePks);
  assert.deepEqual(fromShuffled.artifact.counts, full.artifact.counts);
  assert.equal(fromShuffled.artifact.splitManifestHash, full.artifact.splitManifestHash);
  console.log("SHUFFLED_JOIN_INPUT_SPLIT_IDENTICAL = PASS");

  const labelMutated = clone(sealed);
  for (const row of labelMutated.rows) {
    if (row.label.winner === "HOME") {
      row.label.winner = "AWAY";
      row.label.target = 0;
    } else {
      row.label.winner = "HOME";
      row.label.target = 1;
    }
  }
  const fromLabels = splitIndependentJoinV1(labelMutated, {
    sourceJoinArtifactHash: joinHash,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.deepEqual(fromLabels.artifact.boundaries, full.artifact.boundaries);
  assert.deepEqual(fromLabels.artifact.trainGamePks, full.artifact.trainGamePks);
  assert.deepEqual(
    fromLabels.artifact.validationGamePks,
    full.artifact.validationGamePks,
  );
  assert.deepEqual(fromLabels.artifact.holdoutGamePks, full.artifact.holdoutGamePks);
  console.log("LABEL_VALUES_DO_NOT_AFFECT_SPLIT = PASS");

  const featureMutated = clone(sealed);
  const target = featureMutated.rows[10]!;
  target.feature.home.restDaysBefore =
    target.feature.home.restDaysBefore == null
      ? 0
      : target.feature.home.restDaysBefore + 1;
  target.feature.featureHash = hashIndependentFeatureRowV1(target.feature);
  target.featureHash = target.feature.featureHash;
  const fromFeatures = splitIndependentJoinV1(featureMutated, {
    sourceJoinArtifactHash: joinHash,
    generatedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.deepEqual(fromFeatures.artifact.boundaries, full.artifact.boundaries);
  assert.deepEqual(fromFeatures.artifact.trainGamePks, full.artifact.trainGamePks);
  assert.deepEqual(
    fromFeatures.artifact.validationGamePks,
    full.artifact.validationGamePks,
  );
  assert.deepEqual(fromFeatures.artifact.holdoutGamePks, full.artifact.holdoutGamePks);
  console.log("FEATURE_VALUES_DO_NOT_AFFECT_SPLIT = PASS");

  const notReady = clone(sealed);
  (notReady as { joinReady: boolean }).joinReady = false;
  assertThrowsCode(
    () =>
      splitIndependentJoinV1(notReady, { sourceJoinArtifactHash: joinHash }),
    "JOIN_NOT_READY",
    "joinReady != true",
  );

  const countMismatch = clone(sealed);
  countMismatch.independentModelSample = sealed.rows.length - 1;
  assertThrowsCode(
    () =>
      splitIndependentJoinV1(countMismatch, {
        sourceJoinArtifactHash: joinHash,
      }),
    "JOIN_SAMPLE_COUNT_MISMATCH",
    "rows.length != independentModelSample",
  );

  const dup = clone(fixtureJoin(5));
  dup.rows.push(clone(dup.rows[0]!));
  dup.independentModelSample = dup.rows.length;
  assertThrowsCode(
    () => splitIndependentJoinV1(dup, { sourceJoinArtifactHash: joinHash }),
    "DUPLICATE_GAMEPK",
    "duplicate gamePk",
  );

  const missingPk = clone(fixtureJoin(5));
  (missingPk.rows[0]!.identity as { gamePk: number | null }).gamePk = null;
  assertThrowsCode(
    () =>
      splitIndependentJoinV1(missingPk, { sourceJoinArtifactHash: joinHash }),
    "MISSING_GAMEPK",
    "missing gamePk",
  );

  const identities = sealed.rows.map((r) => ({
    gamePk: r.identity.gamePk,
    officialDate: r.identity.officialDate,
    commenceTimeUtc: r.identity.commenceTimeUtc,
  }));
  const okMembership = assignChronologicalPartitionsV1(identities);

  const overlap = clone(okMembership);
  overlap.validationGamePks = [
    overlap.trainGamePks[0]!,
    ...overlap.validationGamePks,
  ];
  assertThrowsCode(
    () => assertChronologicalSplitInvariantsV1(identities, overlap),
    "PARTITION_OVERLAP",
    "partition overlap",
  );

  const missingUnion = clone(okMembership);
  missingUnion.trainGamePks = missingUnion.trainGamePks.slice(1);
  missingUnion.counts.train -= 1;
  assertThrowsCode(
    () => assertChronologicalSplitInvariantsV1(identities, missingUnion),
    "PARTITION_UNION_MISSING",
    "partition union missing row",
  );

  const sameDate = clone(okMembership);
  const trainSet = new Set(sameDate.trainGamePks);
  const dateCounts = new Map<string, number[]>();
  for (const row of identities) {
    if (!trainSet.has(row.gamePk)) continue;
    const list = dateCounts.get(row.officialDate) ?? [];
    list.push(row.gamePk);
    dateCounts.set(row.officialDate, list);
  }
  const multiDate = [...dateCounts.entries()].find(([, pks]) => pks.length >= 2);
  assert.ok(multiDate, "expected a multi-game officialDate in TRAIN");
  const movedPk = multiDate[1][1]!;
  sameDate.trainGamePks = sameDate.trainGamePks.filter((pk) => pk !== movedPk);
  sameDate.validationGamePks = [movedPk, ...sameDate.validationGamePks];
  assertThrowsCode(
    () => assertChronologicalSplitInvariantsV1(identities, sameDate),
    "SAME_DATE_SPLIT",
    "same officialDate split across boundaries",
  );

  const inverted = clone(okMembership);
  inverted.boundaries = {
    ...inverted.boundaries,
    trainEndDate: inverted.boundaries.holdoutEndDate,
    validationStartDate: inverted.boundaries.trainStartDate,
  };
  assertThrowsCode(
    () => assertChronologicalSplitInvariantsV1(identities, inverted),
    "CHRONOLOGICAL_INVERSION",
    "chronological inversion",
  );

  assertThrowsCode(
    () =>
      splitIndependentJoinV1(sealed, {
        sourceJoinArtifactHash: joinHash,
        expectedSourceJoinHash: "b".repeat(64),
      }),
    "TAMPERED_SOURCE_JOIN_HASH",
    "tampered sourceJoinArtifactHash",
  );

  const libFiles = ["split.ts", "index.ts"];
  for (const file of libFiles) {
    const text = readFileSync(path.join(LIB_DIR, file), "utf8");
    assert.equal(text.includes("Math.random"), false);
    assert.equal(text.includes("prediction-v0"), false);
    assert.equal(text.includes("statsapi.mlb.com"), false);
    assert.equal(text.includes("fetch("), false);
    assert.equal(text.includes("logistic"), false);
    assert.equal(text.includes("xgboost"), false);
    assert.equal(/\bodds\b/.test(text), false);
    assert.equal(/\bmarket\b/.test(text), false);
  }

  assert.equal(sha256File(independentJoinArtifactPath()), JOIN_BEFORE);
  assert.equal(sha256File(independentSafeAFeatureArtifactPath()), FEATURE_BEFORE);
  assert.equal(sha256File(independentLabelArtifactPath()), LABEL_BEFORE);
  assert.equal(sha256File(independentSafeAHistoricalSourcePath()), SOURCE_BEFORE);
  console.log("JOIN_ARTIFACT_CHANGED = NO");
  console.log("FEATURE_ARTIFACT_CHANGED = NO");
  console.log("LABEL_ARTIFACT_CHANGED = NO");
  console.log("HISTORICAL_SOURCE_CHANGED = NO");

  const splitPath = independentSplitArtifactPath();
  const auditPath = independentSplitAuditPath();
  if (existsSync(splitPath) && existsSync(auditPath)) {
    const persisted = JSON.parse(readFileSync(splitPath, "utf8"));
    const persistedAudit = JSON.parse(readFileSync(auditPath, "utf8"));
    const replay = splitIndependentJoinV1(sealed, {
      sourceJoinArtifactHash: JOIN_BEFORE,
      expectedSourceJoinHash: JOIN_BEFORE,
      generatedAt: persistedAudit.generatedAt,
    });
    assert.deepEqual(replay.artifact.boundaries, persisted.boundaries);
    assert.deepEqual(replay.artifact.trainGamePks, persisted.trainGamePks);
    assert.deepEqual(replay.artifact.validationGamePks, persisted.validationGamePks);
    assert.deepEqual(replay.artifact.holdoutGamePks, persisted.holdoutGamePks);
    assert.equal(replay.artifact.splitManifestHash, persisted.splitManifestHash);
    assert.equal(persisted.datasetReady, true);
    assert.equal(persisted.splitReady, true);
    assert.equal(persisted.independentModelSample, 2429);
    assert.equal(persistedAudit.datasetReady, true);
    console.log(`TRAIN=${persisted.counts.train}`);
    console.log(`VALIDATION=${persisted.counts.validation}`);
    console.log(`HOLDOUT=${persisted.counts.holdout}`);
  }

  console.log(`JOINED_ROWS=${sealed.rows.length}`);
  console.log(`INDEPENDENT_MODEL_SAMPLE=${full.artifact.independentModelSample}`);
  console.log(`TRAIN=${full.artifact.counts.train}`);
  console.log(`VALIDATION=${full.artifact.counts.validation}`);
  console.log(`HOLDOUT=${full.artifact.counts.holdout}`);
  console.log(`trainEndDate=${full.artifact.boundaries.trainEndDate}`);
  console.log(`validationStartDate=${full.artifact.boundaries.validationStartDate}`);
  console.log(`validationEndDate=${full.artifact.boundaries.validationEndDate}`);
  console.log(`holdoutStartDate=${full.artifact.boundaries.holdoutStartDate}`);
  console.log(`holdoutEndDate=${full.artifact.boundaries.holdoutEndDate}`);
  console.log("test:mlb-independent-chronological-split-v1 PASS");
  console.log("SPLIT_READY = true");
  console.log("DATASET_READY = true");
}

main();
