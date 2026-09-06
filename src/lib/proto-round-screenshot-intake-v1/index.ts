import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveCanonicalPathBySha256 } from "./dedupe";
import { sha256FileBytes } from "./hash";
import {
  absFromOperatorRelative,
  assertSafeProtoRoundCoords,
  comparePosixPath,
  intakeManifestRelative,
  OPERATOR_ROOT_NAME,
  protoRoundIdentity,
  resolveOperatorRoot,
  roundConfigRelative,
  roundDirectoryRelative,
  roundFileRelativeFromAbs,
  screenshotDirectoryRelative,
} from "./paths";
import {
  DEDUPE_POLICY_V1,
  DEFAULT_TIMEZONE,
  GROUPING_POLICY,
  INTAKE_SCHEMA_VERSION,
  ROUND_CONFIG_SCHEMA_VERSION,
  SUPPORTED_IMAGE_EXTENSIONS,
  type FileStatus,
  type InitProtoRoundResult,
  type IntakeManifestSummaryV1,
  type IntakeManifestV1,
  type PhysicalFileRecordV1,
  type ProtoRoundConfigV1,
  type ScanProtoRoundResult,
} from "./types";

export * from "./dedupe";
export * from "./hash";
export * from "./paths";
export * from "./types";

const SUPPORTED_EXT = new Set<string>(SUPPORTED_IMAGE_EXTENSIONS);

export function isSupportedImageExtension(extension: string): boolean {
  return SUPPORTED_EXT.has(extension.toLowerCase());
}

export function fileExtensionLower(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

function isoNow(): string {
  return new Date().toISOString();
}

function summarize(files: PhysicalFileRecordV1[]): IntakeManifestSummaryV1 {
  let canonicalImageCount = 0;
  let duplicateExactCount = 0;
  let unsupportedFileCount = 0;
  let extractionEligibleCount = 0;
  for (const f of files) {
    if (f.fileStatus === "CANONICAL_IMAGE") canonicalImageCount += 1;
    else if (f.fileStatus === "DUPLICATE_EXACT") duplicateExactCount += 1;
    else unsupportedFileCount += 1;
    if (f.extractionEligible) extractionEligibleCount += 1;
  }
  return {
    physicalFileCount: files.length,
    canonicalImageCount,
    duplicateExactCount,
    unsupportedFileCount,
    extractionEligibleCount,
  };
}

async function pathExists(abs: string): Promise<boolean> {
  try {
    await stat(abs);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return false;
    throw err;
  }
}

/** Temp file + rename inside the same .yang-edge directory. Does not touch screenshots. */
async function writeJsonAtomic(abs: string, value: unknown): Promise<void> {
  const dir = path.dirname(abs);
  await mkdir(dir, { recursive: true });
  const body = `${JSON.stringify(value, null, 2)}\n`;
  const tmp = path.join(dir, `${path.basename(abs)}.${process.pid}.tmp`);
  await writeFile(tmp, body, "utf8");
  try {
    await rename(tmp, abs);
  } catch {
    await unlink(abs).catch(() => undefined);
    await rename(tmp, abs);
  }
}

function assertRoundConfigSchema(doc: unknown): ProtoRoundConfigV1 {
  const schema =
    doc && typeof doc === "object"
      ? (doc as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  if (schema !== ROUND_CONFIG_SCHEMA_VERSION) {
    throw new Error(
      `UNSUPPORTED_PROTO_ROUND_CONFIG_SCHEMA: ${String(schema)}`,
    );
  }
  return doc as ProtoRoundConfigV1;
}

function assertIntakeManifestSchema(doc: unknown): IntakeManifestV1 {
  const schema =
    doc && typeof doc === "object"
      ? (doc as { meta?: { schemaVersion?: unknown } }).meta?.schemaVersion
      : undefined;
  if (schema !== INTAKE_SCHEMA_VERSION) {
    throw new Error(
      `UNSUPPORTED_INTAKE_MANIFEST_SCHEMA: ${String(schema)}`,
    );
  }
  return doc as IntakeManifestV1;
}

function resolveRoot(opts?: {
  repoRoot?: string;
  operatorRootAbs?: string;
}): string {
  return resolveOperatorRoot({
    repoRoot: opts?.repoRoot,
    operatorRootAbs: opts?.operatorRootAbs,
  });
}

export async function loadRoundConfig(
  operatorRootAbs: string,
  year: number,
  round: number,
): Promise<ProtoRoundConfigV1 | null> {
  assertSafeProtoRoundCoords(year, round);
  const abs = absFromOperatorRelative(
    operatorRootAbs,
    roundConfigRelative(year, round),
  );
  try {
    const raw = await readFile(abs, "utf8");
    return assertRoundConfigSchema(JSON.parse(raw));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw err;
  }
}

export async function loadIntakeManifest(
  operatorRootAbs: string,
  year: number,
  round: number,
): Promise<IntakeManifestV1 | null> {
  assertSafeProtoRoundCoords(year, round);
  const abs = absFromOperatorRelative(
    operatorRootAbs,
    intakeManifestRelative(year, round),
  );
  try {
    const raw = await readFile(abs, "utf8");
    return assertIntakeManifestSchema(JSON.parse(raw));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw err;
  }
}

function buildRoundConfig(
  year: number,
  round: number,
  createdAt: string,
): ProtoRoundConfigV1 {
  const identity = protoRoundIdentity(year, round);
  return {
    schemaVersion: ROUND_CONFIG_SCHEMA_VERSION,
    operatorRoot: OPERATOR_ROOT_NAME,
    year: identity.year,
    round: identity.round,
    roundLabel: identity.roundLabel,
    protoRoundKey: identity.protoRoundKey,
    createdAt,
    timezone: DEFAULT_TIMEZONE,
    groupingPolicy: GROUPING_POLICY,
    calendarDateSplit: false,
  };
}

/** Direct children only. Screenshots live in the round folder, not nested INBOX. */
async function collectRoundScreenshotFiles(roundAbs: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(roundAbs, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw err;
  }
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.name === ".yang-edge") continue;
    if (!entry.isFile()) continue;
    out.push(path.join(roundAbs, entry.name));
  }
  out.sort((a, b) =>
    comparePosixPath(
      roundFileRelativeFromAbs(roundAbs, a),
      roundFileRelativeFromAbs(roundAbs, b),
    ),
  );
  return out;
}

function filesystemIso(ms: number | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

export async function initProtoRound(opts: {
  repoRoot?: string;
  operatorRootAbs?: string;
  year: number;
  round: number;
  now?: () => string;
}): Promise<InitProtoRoundResult> {
  const { year, round } = assertSafeProtoRoundCoords(opts.year, opts.round);
  const operatorRootAbs = resolveRoot(opts);
  const identity = protoRoundIdentity(year, round);
  const roundRel = roundDirectoryRelative(year, round);
  const configRel = roundConfigRelative(year, round);
  const roundAbs = absFromOperatorRelative(operatorRootAbs, roundRel);
  const configAbs = absFromOperatorRelative(operatorRootAbs, configRel);

  const roundExisted = await pathExists(roundAbs);
  await mkdir(roundAbs, { recursive: true });

  const existing = await loadRoundConfig(operatorRootAbs, year, round);
  let wroteRoundConfig = false;
  if (!existing) {
    await writeJsonAtomic(
      configAbs,
      buildRoundConfig(year, round, (opts.now ?? isoNow)()),
    );
    wroteRoundConfig = true;
  }

  return {
    action: "init",
    year: identity.year,
    round: identity.round,
    roundLabel: identity.roundLabel,
    protoRoundKey: identity.protoRoundKey,
    operatorRoot: OPERATOR_ROOT_NAME,
    operatorRootAbs,
    roundRelativePath: roundRel,
    screenshotDirectoryAbs: roundAbs,
    roundConfigRelativePath: configRel,
    createdRoundDirectory: !roundExisted,
    wroteRoundConfig,
  };
}

export async function scanProtoRoundInbox(opts: {
  repoRoot?: string;
  operatorRootAbs?: string;
  year: number;
  round: number;
  now?: () => string;
}): Promise<ScanProtoRoundResult> {
  const { year, round } = assertSafeProtoRoundCoords(opts.year, opts.round);
  const operatorRootAbs = resolveRoot(opts);
  const scannedAt = (opts.now ?? isoNow)();
  const identity = protoRoundIdentity(year, round);

  await initProtoRound({
    operatorRootAbs,
    year,
    round,
    now: () => scannedAt,
  });

  const previous = await loadIntakeManifest(operatorRootAbs, year, round);
  const previousByPath = new Map(
    (previous?.files ?? []).map((f) => [f.relativePath, f] as const),
  );
  const previousCanonicalBySha256 = new Map<string, string>();
  for (const f of previous?.files ?? []) {
    if (f.fileStatus === "CANONICAL_IMAGE" && f.canonicalRelativePath) {
      previousCanonicalBySha256.set(f.sha256, f.canonicalRelativePath);
    } else if (f.fileStatus === "CANONICAL_IMAGE") {
      previousCanonicalBySha256.set(f.sha256, f.relativePath);
    }
  }

  const roundRel = screenshotDirectoryRelative(year, round);
  const roundAbs = absFromOperatorRelative(operatorRootAbs, roundRel);
  const presentAbs = await collectRoundScreenshotFiles(roundAbs);

  const pending: Array<{
    relativePath: string;
    fileName: string;
    extension: string;
    byteSize: number;
    sha256: string;
    firstSeenAt: string;
    lastSeenAt: string;
    filesystemMtime: string | null;
    filesystemBirthtime: string | null;
    supported: boolean;
  }> = [];

  for (const abs of presentAbs) {
    const relativePath = roundFileRelativeFromAbs(roundAbs, abs);
    const fileName = path.basename(abs);
    const extension = fileExtensionLower(fileName);
    const st = await stat(abs);
    const sha256 = await sha256FileBytes(abs);
    const prior = previousByPath.get(relativePath);
    const firstSeenAt =
      prior && prior.sha256 === sha256 ? prior.firstSeenAt : scannedAt;
    pending.push({
      relativePath,
      fileName,
      extension,
      byteSize: st.size,
      sha256,
      firstSeenAt,
      lastSeenAt: scannedAt,
      filesystemMtime: filesystemIso(st.mtimeMs),
      filesystemBirthtime: filesystemIso(st.birthtimeMs),
      supported: isSupportedImageExtension(extension),
    });
  }

  pending.sort((a, b) => comparePosixPath(a.relativePath, b.relativePath));

  const canonicalBySha = resolveCanonicalPathBySha256(
    pending
      .filter((p) => p.supported)
      .map((p) => ({
        relativePath: p.relativePath,
        sha256: p.sha256,
        firstSeenAt: p.firstSeenAt,
      })),
    previousCanonicalBySha256,
  );

  const files: PhysicalFileRecordV1[] = pending.map((p) => {
    if (!p.supported) {
      return {
        relativePath: p.relativePath,
        fileName: p.fileName,
        extension: p.extension,
        byteSize: p.byteSize,
        sha256: p.sha256,
        firstSeenAt: p.firstSeenAt,
        lastSeenAt: p.lastSeenAt,
        filesystemMtime: p.filesystemMtime,
        filesystemBirthtime: p.filesystemBirthtime,
        fileStatus: "UNSUPPORTED_FILE" satisfies FileStatus,
        canonicalSha256: null,
        duplicateOfSha256: null,
        canonicalRelativePath: null,
        extractionEligible: false,
        extractionStatus: "NOT_EXTRACTED",
        timingClassification: "UNCLASSIFIED",
      };
    }
    const canonicalRelativePath = canonicalBySha.get(p.sha256)!;
    const isCanonical = canonicalRelativePath === p.relativePath;
    return {
      relativePath: p.relativePath,
      fileName: p.fileName,
      extension: p.extension,
      byteSize: p.byteSize,
      sha256: p.sha256,
      firstSeenAt: p.firstSeenAt,
      lastSeenAt: p.lastSeenAt,
      filesystemMtime: p.filesystemMtime,
      filesystemBirthtime: p.filesystemBirthtime,
      fileStatus: isCanonical ? "CANONICAL_IMAGE" : "DUPLICATE_EXACT",
      canonicalSha256: p.sha256,
      duplicateOfSha256: isCanonical ? null : p.sha256,
      canonicalRelativePath,
      extractionEligible: isCanonical,
      extractionStatus: "NOT_EXTRACTED",
      timingClassification: "UNCLASSIFIED",
    };
  });

  const roundConfig = await loadRoundConfig(operatorRootAbs, year, round);
  const firstInitializedAt =
    previous?.meta.firstInitializedAt ??
    roundConfig?.createdAt ??
    scannedAt;

  files.sort((a, b) => comparePosixPath(a.relativePath, b.relativePath));
  const summary = summarize(files);
  const manifest: IntakeManifestV1 = {
    meta: {
      schemaVersion: INTAKE_SCHEMA_VERSION,
      operatorRoot: OPERATOR_ROOT_NAME,
      year: identity.year,
      round: identity.round,
      roundLabel: identity.roundLabel,
      protoRoundKey: identity.protoRoundKey,
      timezone: DEFAULT_TIMEZONE,
      firstInitializedAt,
      lastScanAt: scannedAt,
      groupingPolicy: GROUPING_POLICY,
      calendarDateSplit: false,
      rawImageStorage: "LOCAL_ONLY",
      ocrStatus: "NOT_IMPLEMENTED",
      oddsExtractionStatus: "NOT_IMPLEMENTED",
      exactImageDedupe: DEDUPE_POLICY_V1.exactImageDedupe,
      nearImageDedupe: DEDUPE_POLICY_V1.nearImageDedupe,
      rowObservationDedupe: DEDUPE_POLICY_V1.rowObservationDedupe,
      filesystemTimeTreatedAsVerifiedCaptureTime: false,
    },
    summary,
    files,
  };

  const manifestRel = intakeManifestRelative(year, round);
  await writeJsonAtomic(
    absFromOperatorRelative(operatorRootAbs, manifestRel),
    manifest,
  );

  const previousCanonicalImageCount =
    previous?.summary.canonicalImageCount ?? 0;

  return {
    action: "scan",
    year: identity.year,
    round: identity.round,
    roundLabel: identity.roundLabel,
    protoRoundKey: identity.protoRoundKey,
    operatorRoot: OPERATOR_ROOT_NAME,
    operatorRootAbs,
    roundRelativePath: roundRel,
    screenshotDirectoryAbs: roundAbs,
    manifestRelativePath: manifestRel,
    summary,
    previousCanonicalImageCount,
    canonicalImageDelta:
      summary.canonicalImageCount - previousCanonicalImageCount,
  };
}
