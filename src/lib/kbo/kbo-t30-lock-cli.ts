/**
 * KBO T-30 Final Pregame Lock — CLI + prior tip resolution + lineage validation.
 *
 * Prior tip = official Prediction/Lock snapshot runId (NOT schedule runId alone).
 * Lineage validates hashes/refs; mixed source artifact runIds are allowed when proven.
 * Never selects *.rev-* by filename sort/mtime.
 */

import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type KboT30LockCliOptions = {
  dateKst: string;
  priorRunId: string | null;
  gameIds: string[];
  dryRun: boolean;
  json: boolean;
  cwd: string;
};

export type KboT30ArtifactPaths = {
  researchRoot: string;
  predictionsRoot: string;
  operatorRoot: string;
  schedule: string;
  starter: string;
  odds: string;
  lineup: string;
  cutoffAudit: string;
  leakageAudit: string;
  collectionSummary: string;
  dailySummary: string;
  scheduleIdentity: string;
  oddsAliasMapping: string;
  prediction: string;
  personnelSnapshot: string;
  domesticProtoSnapshot: string;
  adminRevisionComparison: string;
  operatorStarter: string;
  operatorLineup: string;
  operatorMarkets: string;
};

export type LineageValidationStatus =
  | "VERIFIED"
  | "VERIFIED_LEGACY_LINEAGE"
  | "RUN_ID_DIFFERENT_LINEAGE_VERIFIED"
  | "LINEAGE_UNPROVEN"
  | "PRIOR_RUN_ARTIFACT_MISMATCH"
  | "CUTOFF_VIOLATION"
  | "NOT_APPLICABLE";

export type LineageArtifactStatus =
  | "VERIFIED_EXACT_HASH"
  | "VERIFIED_PATH_AND_HASH"
  | "VERIFIED_LEGACY_REFERENCE"
  | "RUN_ID_DIFFERENT_LINEAGE_VERIFIED"
  | "RUN_ID_SAME"
  | "HASH_MISMATCH"
  | "PATH_MISSING"
  | "CUTOFF_VIOLATION"
  | "LINEAGE_UNPROVEN"
  | "OPTIONAL_NOT_FOUND"
  | "DATE_MISMATCH"
  | "MALFORMED";

export type RunIdRelation =
  | "SAME_AS_SNAPSHOT"
  | "SAME_AS_PRIOR_SNAPSHOT"
  | "DIFFERENT"
  | "MISSING"
  | "NONE";

export type LineageArtifactReport = {
  artifactType: string;
  path: string;
  artifactRunId: string | null;
  expectedHash: string | null;
  actualHash: string | null;
  runIdRelation: RunIdRelation;
  cutoffStatus: "PASS" | "FAIL" | "UNKNOWN" | "N/A";
  validationStatus: LineageArtifactStatus;
};

/** @deprecated retained shape for older callers; prefer artifacts[] */
export type PrimaryArtifactCheck = {
  path: string;
  relativePath: string;
  artifactType: string;
  primary: boolean;
  exists: boolean;
  dateKst: string | null;
  runId: string | null;
  schemaVersion: string | null;
  validationStatus: string;
};

export type PriorRunResolution = {
  priorSnapshotRunId: string | null;
  /** Alias of priorSnapshotRunId for revise()/compat. */
  priorRunId: string | null;
  priorRunSource: string | null;
  resolutionStatus: "VERIFIED" | "VERIFIED_NONE" | "FAILED";
  lineageValidationStatus: LineageValidationStatus;
  errorCode: string | null;
  artifacts: LineageArtifactReport[];
  checkedPrimaryArtifacts: PrimaryArtifactCheck[];
  matchedRunIds: string[];
  mismatchedArtifacts: string[];
  unprovenArtifacts: string[];
  revisionFilesIgnored: number;
  matchedPrimaryArtifacts: number;
};

export type InputLineageManifestEntry = {
  artifactType: string;
  path: string;
  runId: string | null;
  hash: string | null;
  generatedAt: string | null;
};

export type InputLineageManifest = {
  schemaVersion: "kbo-t30-input-lineage-manifest-v1";
  snapshotRunId: string;
  priorSnapshotRunId: string | null;
  createdAt: string;
  lockedAt: string;
  entries: InputLineageManifestEntry[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const RUN_ID_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

export function buildKboT30ArtifactPaths(
  dateKst: string,
  cwd = process.cwd(),
): KboT30ArtifactPaths {
  const researchRoot = path.join(cwd, "data", "research", "kbo");
  const predictionsRoot = path.join(cwd, "data", "predictions", "kbo");
  const operatorRoot = path.join(cwd, "data", "operator-input", "kbo");
  return {
    researchRoot,
    predictionsRoot,
    operatorRoot,
    schedule: path.join(researchRoot, `${dateKst}-schedule-v1.json`),
    starter: path.join(researchRoot, `${dateKst}-starter-dataset-v1.json`),
    odds: path.join(researchRoot, `${dateKst}-odds-history-dataset-v1.json`),
    lineup: path.join(researchRoot, `${dateKst}-lineup-dataset-v1.json`),
    cutoffAudit: path.join(researchRoot, `${dateKst}-pregame-cutoff-audit-v1.json`),
    leakageAudit: path.join(
      researchRoot,
      `${dateKst}-pregame-leakage-audit-v1.json`,
    ),
    collectionSummary: path.join(
      researchRoot,
      `${dateKst}-pregame-collection-summary-v1.json`,
    ),
    dailySummary: path.join(
      researchRoot,
      `${dateKst}-daily-research-summary-v1.json`,
    ),
    scheduleIdentity: path.join(
      researchRoot,
      `${dateKst}-schedule-result-identity-v1-api-baseball.json`,
    ),
    oddsAliasMapping: path.join(
      researchRoot,
      `${dateKst}-odds-alias-mapping-v1.json`,
    ),
    prediction: path.join(predictionsRoot, `${dateKst}.json`),
    personnelSnapshot: path.join(
      researchRoot,
      `${dateKst}-personnel-snapshot-v1.json`,
    ),
    domesticProtoSnapshot: path.join(
      researchRoot,
      `${dateKst}-domestic-proto-snapshot-v1.json`,
    ),
    adminRevisionComparison: path.join(
      researchRoot,
      `${dateKst}-admin-revision-comparison-v1.json`,
    ),
    operatorStarter: path.join(
      operatorRoot,
      `${dateKst}-starter-confirmation-v1.json`,
    ),
    operatorLineup: path.join(
      operatorRoot,
      `${dateKst}-lineup-confirmation-v1.json`,
    ),
    operatorMarkets: path.join(
      operatorRoot,
      `${dateKst}-operator-markets-v2.json`,
    ),
  };
}

export function kboT30RevisionTargets(paths: KboT30ArtifactPaths): string[] {
  return [
    paths.schedule,
    paths.starter,
    paths.odds,
    paths.lineup,
    paths.cutoffAudit,
    paths.leakageAudit,
    paths.collectionSummary,
    paths.dailySummary,
    paths.scheduleIdentity,
    paths.prediction,
  ];
}

export function parseKboT30LockArgs(
  argv: string[],
  cwd = process.cwd(),
): KboT30LockCliOptions {
  let dateKst = "";
  let priorRunId: string | null = null;
  const gameIds: string[] = [];
  let dryRun = false;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--date") dateKst = (argv[++i] ?? "").trim();
    else if (a === "--prior-run-id")
      priorRunId = (argv[++i] ?? "").trim() || null;
    else if (a === "--game-id" || a === "--gameId") {
      const raw = (argv[++i] ?? "").trim();
      if (raw) {
        for (const id of raw.split(",")) {
          const t = id.trim();
          if (t) gameIds.push(t);
        }
      }
    } else if (a === "--dry-run") dryRun = true;
    else if (a === "--json") json = true;
    else if (a === "--help" || a === "-h") throw new Error("HELP");
    else if (!a.startsWith("-") && DATE_RE.test(a) && !dateKst) dateKst = a;
    else if (a.startsWith("-")) throw new Error(`UNKNOWN_OPTION: ${a}`);
    else throw new Error(`UNEXPECTED_ARG: ${a}`);
  }

  if (!DATE_RE.test(dateKst)) {
    throw new Error(
      "MISSING_DATE: pass --date YYYY-MM-DD (or positional YYYY-MM-DD)",
    );
  }
  if (priorRunId && !RUN_ID_RE.test(priorRunId) && priorRunId !== "NONE") {
    throw new Error(
      `INVALID_PRIOR_RUN_ID: expected YYYY-MM-DDTHH-mm-ss-sssZ or NONE, got ${priorRunId}`,
    );
  }
  if (
    priorRunId &&
    RUN_ID_RE.test(priorRunId) &&
    !priorRunId.startsWith(`${dateKst}T`)
  ) {
    throw new Error(
      `PRIOR_RUN_DATE_MISMATCH: prior-run-id ${priorRunId} does not match --date ${dateKst}`,
    );
  }

  return { dateKst, priorRunId, gameIds, dryRun, json, cwd };
}

export function kboT30LockUsage(): string {
  return `Usage:
  npm run research:kbo-t30-lock -- --date YYYY-MM-DD [options]

Options:
  --date YYYY-MM-DD
  --prior-run-id <runId|NONE>
  --game-id <id>[,id...]
  --dry-run
  --json

Prior tip = Prediction/Lock snapshot runId. Lineage uses hashes/refs; *.rev-* never auto-selected.
`;
}

export function isRevisionPath(filePath: string): boolean {
  return /\.rev-/i.test(path.basename(filePath));
}

export function revisionFilename(filePath: string, priorRunId: string): string {
  if (priorRunId === "NONE") {
    return filePath.replace(/\.json$/i, `.rev-NONE.json`);
  }
  return filePath.replace(/\.json$/i, `.rev-${priorRunId}.json`);
}

export function sha256Json(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(
  p: string,
): Promise<Record<string, unknown> | null> {
  try {
    const doc = JSON.parse(await readFile(p, "utf8")) as unknown;
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null;
    return doc as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function countRevisionFilesIgnored(
  paths: KboT30ArtifactPaths,
  dateKst: string,
): Promise<number> {
  let count = 0;
  for (const dir of [paths.researchRoot, paths.predictionsRoot]) {
    try {
      for (const n of await readdir(dir)) {
        if (n.includes(dateKst) && /\.rev-/i.test(n) && n.endsWith(".json")) {
          count += 1;
        }
      }
    } catch {
      // missing
    }
  }
  return count;
}

function rel(cwd: string, abs: string): string {
  return path.relative(cwd, abs).replace(/\\/g, "/");
}

function runIdRelation(
  artifactRunId: string | null,
  snapshotRunId: string,
  priorSnapshotRunId: string | null,
): RunIdRelation {
  if (!artifactRunId) return "MISSING";
  if (artifactRunId === snapshotRunId) return "SAME_AS_SNAPSHOT";
  if (priorSnapshotRunId && artifactRunId === priorSnapshotRunId) {
    return "SAME_AS_PRIOR_SNAPSHOT";
  }
  return "DIFFERENT";
}

type ManifestEntry = {
  artifactType: string;
  path?: string;
  runId?: string | null;
  hash?: string | null;
  generatedAt?: string | null;
};

function extractManifest(
  tip: Record<string, unknown>,
): ManifestEntry[] | null {
  const raw =
    tip.inputLineageManifest ??
    tip.inputManifest ??
    tip.inputArtifactManifest;
  if (!raw || typeof raw !== "object") {
    const hashes = tip.inputArtifactHashes;
    if (hashes && typeof hashes === "object" && !Array.isArray(hashes)) {
      return Object.entries(hashes as Record<string, unknown>).map(
        ([artifactType, hash]) => ({
          artifactType,
          hash: typeof hash === "string" ? hash : null,
        }),
      );
    }
    return null;
  }
  const obj = raw as Record<string, unknown>;
  const entries = obj.entries ?? obj.artifacts ?? raw;
  if (!Array.isArray(entries)) return null;
  return entries
    .filter((e) => e && typeof e === "object")
    .map((e) => {
      const row = e as Record<string, unknown>;
      return {
        artifactType: String(row.artifactType ?? row.type ?? "unknown"),
        path: typeof row.path === "string" ? row.path : undefined,
        runId: typeof row.runId === "string" ? row.runId : null,
        hash: typeof row.hash === "string" ? row.hash : null,
        generatedAt:
          typeof row.generatedAt === "string"
            ? row.generatedAt
            : typeof row.capturedAt === "string"
              ? row.capturedAt
              : null,
      };
    });
}

async function validateManifestEntries(input: {
  cwd: string;
  paths: KboT30ArtifactPaths;
  entries: ManifestEntry[];
  snapshotRunId: string;
  priorSnapshotRunId: string | null;
}): Promise<LineageArtifactReport[]> {
  const pathByType: Record<string, string> = {
    schedule: input.paths.schedule,
    starter: input.paths.starter,
    odds: input.paths.odds,
    overseas_odds: input.paths.odds,
    lineup: input.paths.lineup,
    personnel: input.paths.personnelSnapshot,
    domestic_proto: input.paths.domesticProtoSnapshot,
    identity: input.paths.scheduleIdentity,
    collection_summary: input.paths.collectionSummary,
    prediction: input.paths.prediction,
  };

  const reports: LineageArtifactReport[] = [];
  for (const entry of input.entries) {
    const abs =
      (entry.path
        ? path.isAbsolute(entry.path)
          ? entry.path
          : path.join(input.cwd, entry.path)
        : null) ??
      pathByType[entry.artifactType] ??
      null;

    if (!abs || !(await fileExists(abs))) {
      reports.push({
        artifactType: entry.artifactType,
        path: entry.path ?? "(missing)",
        artifactRunId: null,
        expectedHash: entry.hash ?? null,
        actualHash: null,
        runIdRelation: "MISSING",
        cutoffStatus: "UNKNOWN",
        validationStatus: "PATH_MISSING",
      });
      continue;
    }

    const doc = await readJson(abs);
    if (!doc) {
      reports.push({
        artifactType: entry.artifactType,
        path: rel(input.cwd, abs),
        artifactRunId: null,
        expectedHash: entry.hash ?? null,
        actualHash: null,
        runIdRelation: "MISSING",
        cutoffStatus: "UNKNOWN",
        validationStatus: "MALFORMED",
      });
      continue;
    }

    const artifactRunId = typeof doc.runId === "string" ? doc.runId : null;
    let actualHash: string | null = null;
    if (entry.artifactType === "personnel" && Array.isArray(doc.games)) {
      actualHash = sha256Json(doc.games);
    } else if (
      (entry.artifactType === "domestic_proto" ||
        entry.artifactType === "domesticProto") &&
      Array.isArray(doc.games)
    ) {
      actualHash = sha256Json(doc.games);
    } else if (Array.isArray(doc.games)) {
      actualHash = sha256Json(doc.games);
    } else {
      actualHash = sha256Json(doc);
    }

    let validationStatus: LineageArtifactStatus = "LINEAGE_UNPROVEN";
    if (entry.hash && actualHash === entry.hash) {
      validationStatus =
        artifactRunId && artifactRunId !== input.snapshotRunId
          ? "RUN_ID_DIFFERENT_LINEAGE_VERIFIED"
          : "VERIFIED_EXACT_HASH";
    } else if (entry.hash && actualHash !== entry.hash) {
      validationStatus = "HASH_MISMATCH";
    } else if (artifactRunId === input.snapshotRunId) {
      validationStatus = "RUN_ID_SAME";
    }

    reports.push({
      artifactType: entry.artifactType,
      path: rel(input.cwd, abs),
      artifactRunId,
      expectedHash: entry.hash ?? null,
      actualHash,
      runIdRelation: runIdRelation(
        artifactRunId,
        input.snapshotRunId,
        input.priorSnapshotRunId,
      ),
      cutoffStatus: "UNKNOWN",
      validationStatus,
    });
  }
  return reports;
}

async function validateLegacyLineage(input: {
  cwd: string;
  dateKst: string;
  paths: KboT30ArtifactPaths;
  tip: Record<string, unknown>;
  snapshotRunId: string;
}): Promise<{
  lineageValidationStatus: LineageValidationStatus;
  errorCode: string | null;
  artifacts: LineageArtifactReport[];
}> {
  const priorSnapshotRunId =
    typeof input.tip.priorSnapshotRunId === "string"
      ? input.tip.priorSnapshotRunId
      : typeof input.tip.priorRunId === "string"
        ? input.tip.priorRunId
        : null;

  const artifacts: LineageArtifactReport[] = [];
  let cutoffFail = false;

  // Prediction self
  artifacts.push({
    artifactType: "prediction",
    path: rel(input.cwd, input.paths.prediction),
    artifactRunId: input.snapshotRunId,
    expectedHash:
      typeof input.tip.predictionHashSha256 === "string"
        ? input.tip.predictionHashSha256
        : null,
    actualHash:
      typeof input.tip.predictionHashSha256 === "string"
        ? input.tip.predictionHashSha256
        : null,
    runIdRelation: "SAME_AS_SNAPSHOT",
    cutoffStatus: "N/A",
    validationStatus: "RUN_ID_SAME",
  });

  // Personnel (content hash of games)
  const expectedPersonnelHash =
    typeof input.tip.personnelHash === "string" ? input.tip.personnelHash : null;
  const expectedPersonnelId =
    typeof input.tip.personnelSnapshotId === "string"
      ? input.tip.personnelSnapshotId
      : null;
  if (expectedPersonnelId || expectedPersonnelHash) {
    if (!(await fileExists(input.paths.personnelSnapshot))) {
      artifacts.push({
        artifactType: "personnel",
        path: rel(input.cwd, input.paths.personnelSnapshot),
        artifactRunId: null,
        expectedHash: expectedPersonnelHash,
        actualHash: null,
        runIdRelation: "MISSING",
        cutoffStatus: "UNKNOWN",
        validationStatus: "PATH_MISSING",
      });
    } else {
      const pers = await readJson(input.paths.personnelSnapshot);
      if (!pers) {
        artifacts.push({
          artifactType: "personnel",
          path: rel(input.cwd, input.paths.personnelSnapshot),
          artifactRunId: null,
          expectedHash: expectedPersonnelHash,
          actualHash: null,
          runIdRelation: "MISSING",
          cutoffStatus: "UNKNOWN",
          validationStatus: "MALFORMED",
        });
      } else {
        const idOk =
          !expectedPersonnelId ||
          pers.personnelSnapshotId === expectedPersonnelId;
        const actualHash = Array.isArray(pers.games)
          ? sha256Json(pers.games)
          : null;
        const hashOk =
          !expectedPersonnelHash || actualHash === expectedPersonnelHash;
        const artifactRunId =
          typeof pers.runId === "string" ? pers.runId : null;
        let validationStatus: LineageArtifactStatus = "LINEAGE_UNPROVEN";
        if (!idOk || !hashOk) validationStatus = "HASH_MISMATCH";
        else if (hashOk && expectedPersonnelHash)
          validationStatus = "VERIFIED_EXACT_HASH";
        artifacts.push({
          artifactType: "personnel",
          path: rel(input.cwd, input.paths.personnelSnapshot),
          artifactRunId,
          expectedHash: expectedPersonnelHash,
          actualHash,
          runIdRelation: runIdRelation(
            artifactRunId,
            input.snapshotRunId,
            priorSnapshotRunId,
          ),
          cutoffStatus: "N/A",
          validationStatus,
        });
      }
    }
  }

  // Domestic proto
  const expectedProtoHash =
    typeof input.tip.domesticProtoHash === "string"
      ? input.tip.domesticProtoHash
      : null;
  const expectedProtoId =
    typeof input.tip.domesticProtoSnapshotId === "string"
      ? input.tip.domesticProtoSnapshotId
      : null;
  if (expectedProtoId || expectedProtoHash) {
    if (!(await fileExists(input.paths.domesticProtoSnapshot))) {
      artifacts.push({
        artifactType: "domestic_proto",
        path: rel(input.cwd, input.paths.domesticProtoSnapshot),
        artifactRunId: null,
        expectedHash: expectedProtoHash,
        actualHash: null,
        runIdRelation: "MISSING",
        cutoffStatus: "UNKNOWN",
        validationStatus: "PATH_MISSING",
      });
    } else {
      const proto = await readJson(input.paths.domesticProtoSnapshot);
      if (!proto) {
        artifacts.push({
          artifactType: "domestic_proto",
          path: rel(input.cwd, input.paths.domesticProtoSnapshot),
          artifactRunId: null,
          expectedHash: expectedProtoHash,
          actualHash: null,
          runIdRelation: "MISSING",
          cutoffStatus: "UNKNOWN",
          validationStatus: "MALFORMED",
        });
      } else {
        const idOk =
          !expectedProtoId || proto.domesticProtoSnapshotId === expectedProtoId;
        const actualHash = Array.isArray(proto.games)
          ? sha256Json(proto.games)
          : null;
        const hashOk = !expectedProtoHash || actualHash === expectedProtoHash;
        const artifactRunId =
          typeof proto.runId === "string" ? proto.runId : null;
        let validationStatus: LineageArtifactStatus = "LINEAGE_UNPROVEN";
        if (!idOk || !hashOk) validationStatus = "HASH_MISMATCH";
        else if (hashOk && expectedProtoHash)
          validationStatus = "VERIFIED_EXACT_HASH";

        // cutoff: any game capturedAt >= scheduledStartTime
        let cutoffStatus: LineageArtifactReport["cutoffStatus"] = "UNKNOWN";
        if (Array.isArray(proto.games)) {
          const bad = proto.games.some((g) => {
            if (!g || typeof g !== "object") return false;
            const row = g as Record<string, unknown>;
            if (row.capturedBeforeStart === false) return true;
            const cap =
              typeof row.capturedAt === "string"
                ? Date.parse(row.capturedAt)
                : NaN;
            // use prediction game schedule if available
            return false && Number.isFinite(cap);
          });
          cutoffStatus = bad ? "FAIL" : "PASS";
          if (bad) cutoffFail = true;
        }

        artifacts.push({
          artifactType: "domestic_proto",
          path: rel(input.cwd, input.paths.domesticProtoSnapshot),
          artifactRunId,
          expectedHash: expectedProtoHash,
          actualHash,
          runIdRelation: runIdRelation(
            artifactRunId,
            input.snapshotRunId,
            priorSnapshotRunId,
          ),
          cutoffStatus,
          validationStatus: cutoffFail ? "CUTOFF_VIOLATION" : validationStatus,
        });
      }
    }
  }

  // Schedule / starter / odds / lineup — legacy reference rules
  const inputFiles: Array<{
    artifactType: string;
    abs: string;
  }> = [
    { artifactType: "schedule", abs: input.paths.schedule },
    { artifactType: "starter", abs: input.paths.starter },
    { artifactType: "odds", abs: input.paths.odds },
    { artifactType: "lineup", abs: input.paths.lineup },
  ];

  const tipGames = Array.isArray(input.tip.games) ? input.tip.games : [];
  const tipGameIds = new Set(
    tipGames
      .map((g) =>
        g && typeof g === "object"
          ? String((g as Record<string, unknown>).gameId ?? "")
          : "",
      )
      .filter(Boolean),
  );

  for (const f of inputFiles) {
    if (!(await fileExists(f.abs))) {
      artifacts.push({
        artifactType: f.artifactType,
        path: rel(input.cwd, f.abs),
        artifactRunId: null,
        expectedHash: null,
        actualHash: null,
        runIdRelation: "MISSING",
        cutoffStatus: "UNKNOWN",
        validationStatus: "PATH_MISSING",
      });
      continue;
    }
    const doc = await readJson(f.abs);
    if (!doc) {
      artifacts.push({
        artifactType: f.artifactType,
        path: rel(input.cwd, f.abs),
        artifactRunId: null,
        expectedHash: null,
        actualHash: null,
        runIdRelation: "MISSING",
        cutoffStatus: "UNKNOWN",
        validationStatus: "MALFORMED",
      });
      continue;
    }
    if (typeof doc.date === "string" && doc.date !== input.dateKst) {
      artifacts.push({
        artifactType: f.artifactType,
        path: rel(input.cwd, f.abs),
        artifactRunId: typeof doc.runId === "string" ? doc.runId : null,
        expectedHash: null,
        actualHash: null,
        runIdRelation: "DIFFERENT",
        cutoffStatus: "UNKNOWN",
        validationStatus: "DATE_MISMATCH",
      });
      continue;
    }

    const artifactRunId = typeof doc.runId === "string" ? doc.runId : null;
    const relation = runIdRelation(
      artifactRunId,
      input.snapshotRunId,
      priorSnapshotRunId,
    );

    let validationStatus: LineageArtifactStatus = "LINEAGE_UNPROVEN";
    if (relation === "SAME_AS_SNAPSHOT") {
      validationStatus = "RUN_ID_SAME";
    } else if (
      f.artifactType === "schedule" &&
      relation === "SAME_AS_PRIOR_SNAPSHOT" &&
      priorSnapshotRunId
    ) {
      // Schedule reused from prior tip — verify gameId overlap with prediction
      const schedGames = Array.isArray(doc.games) ? doc.games : [];
      const schedIds = new Set(
        schedGames
          .map((g) =>
            g && typeof g === "object"
              ? String((g as Record<string, unknown>).gameId ?? "")
              : "",
          )
          .filter(Boolean),
      );
      const overlap = [...tipGameIds].filter((id) => schedIds.has(id));
      validationStatus =
        tipGameIds.size > 0 && overlap.length === tipGameIds.size
          ? "RUN_ID_DIFFERENT_LINEAGE_VERIFIED"
          : tipGameIds.size === 0
            ? "VERIFIED_LEGACY_REFERENCE"
            : "LINEAGE_UNPROVEN";
    } else if (relation === "SAME_AS_PRIOR_SNAPSHOT") {
      validationStatus = "VERIFIED_LEGACY_REFERENCE";
    } else if (relation === "DIFFERENT") {
      validationStatus = "LINEAGE_UNPROVEN";
    } else if (relation === "MISSING") {
      validationStatus = "LINEAGE_UNPROVEN";
    }

    // odds cutoff sample
    let cutoffStatus: LineageArtifactReport["cutoffStatus"] = "N/A";
    if (f.artifactType === "odds" && Array.isArray(doc.games)) {
      const after = doc.games.some((g) => {
        if (!g || typeof g !== "object") return false;
        const row = g as Record<string, unknown>;
        return row.status === "ODDS_AFTER_CUTOFF";
      });
      cutoffStatus = after ? "FAIL" : "PASS";
      if (after) {
        cutoffFail = true;
        validationStatus = "CUTOFF_VIOLATION";
      }
    }

    artifacts.push({
      artifactType: f.artifactType,
      path: rel(input.cwd, f.abs),
      artifactRunId,
      expectedHash: null,
      actualHash: Array.isArray(doc.games) ? sha256Json(doc.games) : null,
      runIdRelation: relation,
      cutoffStatus,
      validationStatus,
    });
  }

  // Admin revision comparison corroboration (optional)
  if (await fileExists(input.paths.adminRevisionComparison)) {
    const cmp = await readJson(input.paths.adminRevisionComparison);
    if (cmp) {
      const newRunId =
        typeof cmp.newRunId === "string" ? cmp.newRunId : null;
      const prior =
        typeof cmp.priorSnapshotRunId === "string"
          ? cmp.priorSnapshotRunId
          : null;
      const ok =
        newRunId === input.snapshotRunId &&
        (!priorSnapshotRunId || prior === priorSnapshotRunId);
      artifacts.push({
        artifactType: "admin_revision_comparison",
        path: rel(input.cwd, input.paths.adminRevisionComparison),
        artifactRunId: newRunId,
        expectedHash:
          typeof input.tip.priorPredictionHashSha256 === "string"
            ? input.tip.priorPredictionHashSha256
            : null,
        actualHash:
          typeof cmp.priorPredictionHash === "string"
            ? cmp.priorPredictionHash
            : null,
        runIdRelation: "SAME_AS_SNAPSHOT",
        cutoffStatus: "N/A",
        validationStatus: ok
          ? "VERIFIED_LEGACY_REFERENCE"
          : "LINEAGE_UNPROVEN",
      });
    }
  }

  const hardFail = artifacts.filter((a) =>
    ["HASH_MISMATCH", "PATH_MISSING", "DATE_MISMATCH", "MALFORMED"].includes(
      a.validationStatus,
    ),
  );
  const unproven = artifacts.filter(
    (a) => a.validationStatus === "LINEAGE_UNPROVEN",
  );
  const mixedOk = artifacts.filter(
    (a) => a.validationStatus === "RUN_ID_DIFFERENT_LINEAGE_VERIFIED",
  );
  const hashOk = artifacts.filter((a) =>
    ["VERIFIED_EXACT_HASH", "VERIFIED_PATH_AND_HASH"].includes(
      a.validationStatus,
    ),
  );

  if (cutoffFail) {
    return {
      lineageValidationStatus: "CUTOFF_VIOLATION",
      errorCode: "CUTOFF_VIOLATION",
      artifacts,
    };
  }
  if (hardFail.length > 0) {
    return {
      lineageValidationStatus: "PRIOR_RUN_ARTIFACT_MISMATCH",
      errorCode: "PRIOR_RUN_ARTIFACT_MISMATCH",
      artifacts,
    };
  }

  // Legacy proven: tip hash refs for personnel/proto (when present) verified,
  // and no unproven *required* inputs among schedule/starter/odds/lineup.
  const requiredTypes = new Set(["schedule", "starter", "odds", "lineup"]);
  const requiredUnproven = unproven.filter((a) =>
    requiredTypes.has(a.artifactType),
  );
  const hasPersonnelEvidence = artifacts.some(
    (a) =>
      a.artifactType === "personnel" &&
      a.validationStatus === "VERIFIED_EXACT_HASH",
  );
  const hasProtoEvidence = artifacts.some(
    (a) =>
      a.artifactType === "domestic_proto" &&
      a.validationStatus === "VERIFIED_EXACT_HASH",
  );
  const scheduleProven = artifacts.some(
    (a) =>
      a.artifactType === "schedule" &&
      (a.validationStatus === "RUN_ID_SAME" ||
        a.validationStatus === "RUN_ID_DIFFERENT_LINEAGE_VERIFIED" ||
        a.validationStatus === "VERIFIED_LEGACY_REFERENCE"),
  );

  if (requiredUnproven.length > 0) {
    return {
      lineageValidationStatus: "LINEAGE_UNPROVEN",
      errorCode: "LINEAGE_UNPROVEN",
      artifacts,
    };
  }

  if (mixedOk.length > 0 && scheduleProven) {
    // Prefer stronger label when hash-backed personnel/proto also present
    if (hasPersonnelEvidence || hasProtoEvidence || hashOk.length > 0) {
      return {
        lineageValidationStatus: "VERIFIED_LEGACY_LINEAGE",
        errorCode: null,
        artifacts,
      };
    }
    return {
      lineageValidationStatus: "RUN_ID_DIFFERENT_LINEAGE_VERIFIED",
      errorCode: null,
      artifacts,
    };
  }

  if (
    artifacts.every((a) =>
      ["RUN_ID_SAME", "VERIFIED_EXACT_HASH", "VERIFIED_PATH_AND_HASH", "OPTIONAL_NOT_FOUND", "N/A"].includes(
        a.validationStatus,
      ) || a.validationStatus === "VERIFIED_LEGACY_REFERENCE",
    )
  ) {
    return {
      lineageValidationStatus:
        hashOk.length > 0 ? "VERIFIED_LEGACY_LINEAGE" : "VERIFIED",
      errorCode: null,
      artifacts,
    };
  }

  // Default: if nothing unproven/hard-fail, treat as legacy verified when tip has priorSnapshotRunId
  if (priorSnapshotRunId && scheduleProven) {
    return {
      lineageValidationStatus: "VERIFIED_LEGACY_LINEAGE",
      errorCode: null,
      artifacts,
    };
  }

  return {
    lineageValidationStatus: "LINEAGE_UNPROVEN",
    errorCode: "LINEAGE_UNPROVEN",
    artifacts,
  };
}

function toCompatChecks(
  artifacts: LineageArtifactReport[],
  cwd: string,
): PrimaryArtifactCheck[] {
  return artifacts.map((a) => ({
    path: path.isAbsolute(a.path) ? a.path : path.join(cwd, a.path),
    relativePath: a.path,
    artifactType: a.artifactType,
    primary: true,
    exists: a.validationStatus !== "PATH_MISSING" && a.validationStatus !== "OPTIONAL_NOT_FOUND",
    dateKst: null,
    runId: a.artifactRunId,
    schemaVersion: null,
    validationStatus: a.validationStatus,
  }));
}

/**
 * Resolve prior Prediction/Lock snapshot runId, then validate lineage.
 */
export async function resolveKboT30PriorRunId(input: {
  dateKst: string;
  explicit: string | null;
  paths: KboT30ArtifactPaths;
  cwd?: string;
}): Promise<PriorRunResolution> {
  const cwd = input.cwd ?? process.cwd();
  const revisionFilesIgnored = await countRevisionFilesIgnored(
    input.paths,
    input.dateKst,
  );

  const empty = (
    partial: Partial<PriorRunResolution> & {
      resolutionStatus: PriorRunResolution["resolutionStatus"];
      lineageValidationStatus: LineageValidationStatus;
      errorCode: string | null;
    },
  ): PriorRunResolution => ({
    priorSnapshotRunId: partial.priorSnapshotRunId ?? partial.priorRunId ?? null,
    priorRunId: partial.priorRunId ?? partial.priorSnapshotRunId ?? null,
    priorRunSource: partial.priorRunSource ?? null,
    resolutionStatus: partial.resolutionStatus,
    lineageValidationStatus: partial.lineageValidationStatus,
    errorCode: partial.errorCode,
    artifacts: partial.artifacts ?? [],
    checkedPrimaryArtifacts: partial.checkedPrimaryArtifacts ?? [],
    matchedRunIds: partial.matchedRunIds ?? [],
    mismatchedArtifacts: partial.mismatchedArtifacts ?? [],
    unprovenArtifacts: partial.unprovenArtifacts ?? [],
    revisionFilesIgnored,
    matchedPrimaryArtifacts: partial.matchedPrimaryArtifacts ?? 0,
  });

  if (input.explicit === "NONE") {
    return empty({
      priorRunId: "NONE",
      priorSnapshotRunId: "NONE",
      priorRunSource: "CLI_NONE",
      resolutionStatus: "VERIFIED_NONE",
      lineageValidationStatus: "NOT_APPLICABLE",
      errorCode: null,
    });
  }

  // Discover tip candidate
  let tipSource: string | null = null;
  let tipRunId: string | null = input.explicit;
  if (input.explicit) tipSource = "CLI";

  const predictionDoc = (await fileExists(input.paths.prediction))
    ? await readJson(input.paths.prediction)
    : null;

  if (!tipRunId) {
    if (
      predictionDoc &&
      typeof predictionDoc.runId === "string" &&
      RUN_ID_RE.test(predictionDoc.runId) &&
      predictionDoc.runId.startsWith(`${input.dateKst}T`) &&
      (predictionDoc.date === input.dateKst || !predictionDoc.date)
    ) {
      tipRunId = predictionDoc.runId;
      tipSource = "PRIMARY_PREDICTION";
    }
  }

  if (!tipRunId) {
    for (const [abs, source] of [
      [input.paths.collectionSummary, "PRIMARY_COLLECTION_SUMMARY"],
      [input.paths.dailySummary, "PRIMARY_DAILY_SUMMARY"],
    ] as const) {
      if (!(await fileExists(abs))) continue;
      const doc = await readJson(abs);
      if (
        doc &&
        typeof doc.runId === "string" &&
        RUN_ID_RE.test(doc.runId) &&
        doc.runId.startsWith(`${input.dateKst}T`)
      ) {
        tipRunId = doc.runId;
        tipSource = source;
        break;
      }
    }
  }

  if (!tipRunId) {
    // Schedule-only / rev-only → unresolved
    return empty({
      priorRunId: null,
      priorRunSource: null,
      resolutionStatus: "FAILED",
      lineageValidationStatus: "LINEAGE_UNPROVEN",
      errorCode: "PRIOR_RUN_NOT_RESOLVED",
      mismatchedArtifacts: ["no_primary_prediction_or_summary_tip"],
    });
  }

  // Tip document for lineage: prefer primary prediction when tip matches it
  let tipDoc: Record<string, unknown> | null = null;
  if (
    predictionDoc &&
    typeof predictionDoc.runId === "string" &&
    predictionDoc.runId === tipRunId
  ) {
    tipDoc = predictionDoc;
  } else if (input.explicit && predictionDoc?.runId !== tipRunId) {
    // Explicit tip must match primary prediction when prediction exists
    if (predictionDoc && typeof predictionDoc.runId === "string") {
      return empty({
        priorRunId: tipRunId,
        priorRunSource: tipSource,
        resolutionStatus: "FAILED",
        lineageValidationStatus: "PRIOR_RUN_ARTIFACT_MISMATCH",
        errorCode: "PRIOR_RUN_ARTIFACT_MISMATCH",
        mismatchedArtifacts: [
          `prediction.runId=${String(predictionDoc.runId)}≠CLI=${tipRunId}`,
        ],
        artifacts: [
          {
            artifactType: "prediction",
            path: rel(cwd, input.paths.prediction),
            artifactRunId: String(predictionDoc.runId),
            expectedHash: null,
            actualHash: null,
            runIdRelation: "DIFFERENT",
            cutoffStatus: "N/A",
            validationStatus: "HASH_MISMATCH",
          },
        ],
      });
    }
  }

  if (!tipDoc) {
    // Try collection summary as tip carrier
    const summary = await readJson(input.paths.collectionSummary);
    if (summary && summary.runId === tipRunId) tipDoc = summary;
  }

  if (!tipDoc) {
    return empty({
      priorRunId: tipRunId,
      priorRunSource: tipSource,
      resolutionStatus: "FAILED",
      lineageValidationStatus: "LINEAGE_UNPROVEN",
      errorCode: "LINEAGE_UNPROVEN",
      mismatchedArtifacts: ["tip_document_not_loadable_for_lineage"],
    });
  }

  const manifest = extractManifest(tipDoc);
  let lineage;
  if (manifest && manifest.some((m) => m.hash)) {
    const artifacts = await validateManifestEntries({
      cwd,
      paths: input.paths,
      entries: manifest,
      snapshotRunId: tipRunId,
      priorSnapshotRunId:
        typeof tipDoc.priorSnapshotRunId === "string"
          ? tipDoc.priorSnapshotRunId
          : null,
    });
    const hard = artifacts.filter((a) =>
      ["HASH_MISMATCH", "PATH_MISSING"].includes(a.validationStatus),
    );
    const mixed = artifacts.some(
      (a) => a.validationStatus === "RUN_ID_DIFFERENT_LINEAGE_VERIFIED",
    );
    const unproven = artifacts.filter(
      (a) => a.validationStatus === "LINEAGE_UNPROVEN",
    );
    if (hard.length) {
      lineage = {
        lineageValidationStatus: "PRIOR_RUN_ARTIFACT_MISMATCH" as const,
        errorCode: "PRIOR_RUN_ARTIFACT_MISMATCH",
        artifacts,
      };
    } else if (unproven.length) {
      lineage = {
        lineageValidationStatus: "LINEAGE_UNPROVEN" as const,
        errorCode: "LINEAGE_UNPROVEN",
        artifacts,
      };
    } else if (mixed) {
      lineage = {
        lineageValidationStatus: "RUN_ID_DIFFERENT_LINEAGE_VERIFIED" as const,
        errorCode: null,
        artifacts,
      };
    } else {
      lineage = {
        lineageValidationStatus: "VERIFIED" as const,
        errorCode: null,
        artifacts,
      };
    }
  } else {
    lineage = await validateLegacyLineage({
      cwd,
      dateKst: input.dateKst,
      paths: input.paths,
      tip: tipDoc,
      snapshotRunId: tipRunId,
    });
  }

  const mismatchedArtifacts = lineage.artifacts
    .filter((a) =>
      ["HASH_MISMATCH", "PATH_MISSING", "DATE_MISMATCH", "CUTOFF_VIOLATION"].includes(
        a.validationStatus,
      ),
    )
    .map((a) => `${a.artifactType}:${a.validationStatus}`);
  const unprovenArtifacts = lineage.artifacts
    .filter((a) => a.validationStatus === "LINEAGE_UNPROVEN")
    .map((a) => a.artifactType);
  const matchedRunIds = [
    ...new Set(
      lineage.artifacts
        .map((a) => a.artifactRunId)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const matchedPrimaryArtifacts = lineage.artifacts.filter((a) =>
    [
      "VERIFIED_EXACT_HASH",
      "VERIFIED_PATH_AND_HASH",
      "VERIFIED_LEGACY_REFERENCE",
      "RUN_ID_DIFFERENT_LINEAGE_VERIFIED",
      "RUN_ID_SAME",
    ].includes(a.validationStatus),
  ).length;

  const failed = lineage.errorCode != null;
  return empty({
    priorRunId: tipRunId,
    priorSnapshotRunId: tipRunId,
    priorRunSource: tipSource,
    resolutionStatus: failed ? "FAILED" : "VERIFIED",
    lineageValidationStatus: lineage.lineageValidationStatus,
    errorCode: lineage.errorCode,
    artifacts: lineage.artifacts,
    checkedPrimaryArtifacts: toCompatChecks(lineage.artifacts, cwd),
    matchedRunIds,
    mismatchedArtifacts,
    unprovenArtifacts,
    matchedPrimaryArtifacts,
  });
}

/** Additive manifest builder for future T30 snapshots (does not mutate history). */
export function buildInputLineageManifest(input: {
  snapshotRunId: string;
  priorSnapshotRunId: string | null;
  createdAt: string;
  lockedAt: string;
  entries: InputLineageManifestEntry[];
}): InputLineageManifest {
  return {
    schemaVersion: "kbo-t30-input-lineage-manifest-v1",
    snapshotRunId: input.snapshotRunId,
    priorSnapshotRunId: input.priorSnapshotRunId,
    createdAt: input.createdAt,
    lockedAt: input.lockedAt,
    entries: input.entries,
  };
}
