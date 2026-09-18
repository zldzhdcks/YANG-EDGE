import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import {
  DAILY_SCOPE_LOCK_SCHEMA_VERSION,
  RESEARCH_TARGET_SCOPE_LOCK_MECHANISM,
  RESEARCH_TARGET_SCOPE_LOCK_POLICY_VERSION,
  type ResearchTargetScopeLockDocument,
  type ResearchTargetScopeLockResult,
} from "./types";
import { admitResearchTargetScopeSource } from "./admit-source";
import { assertExplicitDateKst, researchTargetScopeLockRel } from "./paths";
import {
  semanticLockFingerprint,
  sortExclusionsDeterministic,
  sortTargetsDeterministic,
} from "./policy";

function buildDocument(input: {
  dateKst: string;
  createdAt: string;
  sourceClass: ResearchTargetScopeLockDocument["source"]["class"];
  sourceRel: string;
  sourceSha256: string;
  targets: ResearchTargetScopeLockDocument["targets"];
  exclusions: ResearchTargetScopeLockDocument["exclusions"];
}): ResearchTargetScopeLockDocument {
  const targets = sortTargetsDeterministic(input.targets);
  const exclusions = sortExclusionsDeterministic(input.exclusions);
  const bySport: Record<string, number> = {};
  for (const t of targets) {
    bySport[t.sport] = (bySport[t.sport] ?? 0) + 1;
  }
  const empty = targets.length === 0;
  return {
    schemaVersion: DAILY_SCOPE_LOCK_SCHEMA_VERSION,
    lockMechanism: RESEARCH_TARGET_SCOPE_LOCK_MECHANISM,
    policyVersion: RESEARCH_TARGET_SCOPE_LOCK_POLICY_VERSION,
    dateKst: input.dateKst,
    lockStatus: "LOCKED",
    scopeLockStatus: empty ? "EMPTY_ADMISSIBLE" : "COMPLETE",
    status: empty ? "TARGET_SCOPE_NO_ADMISSIBLE_TARGETS" : "LOCKED",
    createdAt: input.createdAt,
    scopeLockedAt: input.createdAt,
    source: {
      class: input.sourceClass,
      rel: input.sourceRel,
      sha256: input.sourceSha256,
    },
    targetCount: targets.length,
    officialDenominator: targets.length,
    targets,
    exclusions,
    sports: Object.keys(bySport).sort(),
    observedScope: {
      total: targets.length,
      bySport,
    },
    scopeShrinkAfterLockForbidden: true,
    researchOnly: true,
    prediction: "NONE",
    engine: "NONE",
    recommendation: "NONE",
    predictionInput: false,
    engineAdmission: "PROHIBITED",
    fuzzyMatchingUsed: false,
    invariant:
      "EVERY_LOCKED_TARGET_REQUIRES_EXACTLY_ONE_SEALED_PREDICTION_OR_PASS",
    note: empty
      ? "Valid zero-admissible research target cohort. Distinct from SOURCE_MISSING."
      : "Research target cohort locked from committed deterministic slate source. Not a Prediction/PASS artifact.",
  };
}

function fingerprintDoc(doc: ResearchTargetScopeLockDocument): string {
  return semanticLockFingerprint({
    dateKst: doc.dateKst,
    sourceSha256: doc.source.sha256,
    sourceRel: doc.source.rel,
    targets: doc.targets,
    exclusions: doc.exclusions,
    status: doc.status,
  });
}

async function exclusiveWriteJson(
  absPath: string,
  value: unknown,
): Promise<"CREATED" | "EXISTS"> {
  await mkdir(path.dirname(absPath), { recursive: true });
  try {
    const fh = await open(absPath, "wx");
    try {
      await fh.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    } finally {
      await fh.close();
    }
    return "CREATED";
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    if (code === "EEXIST") return "EXISTS";
    throw err;
  }
}

function missingResult(dateKst: string): ResearchTargetScopeLockResult {
  return {
    dateKst,
    status: "TARGET_SCOPE_SOURCE_MISSING",
    lockCreated: false,
    targetCount: null,
    targetCountAuthoritative: false,
    excludedCount: 0,
    outputPath: null,
    sourcePath: null,
    sourceStatus: "MISSING",
    document: null,
    message:
      "No committed admissible research slate source. TARGET_COUNT is not authoritative zero.",
  };
}

/**
 * Build and immutably lock the research-target cohort for an explicit KST date.
 * Does not invent a slate when none exists.
 */
export async function lockResearchTargetScope(input: {
  dateKst: string;
  cwd?: string;
  createdAt?: string;
}): Promise<ResearchTargetScopeLockResult> {
  const dateKst = assertExplicitDateKst(input.dateKst);
  const cwd = input.cwd ?? process.cwd();
  const outputRel = researchTargetScopeLockRel(dateKst);
  const outputAbs = path.join(cwd, outputRel);
  const createdAt = input.createdAt ?? new Date().toISOString();

  const admission = admitResearchTargetScopeSource({ dateKst, cwd });
  if (admission.kind === "MISSING") {
    return missingResult(dateKst);
  }
  if (admission.kind === "INVALID") {
    return {
      dateKst,
      status: "TARGET_SCOPE_SOURCE_INVALID",
      lockCreated: false,
      targetCount: null,
      targetCountAuthoritative: false,
      excludedCount: 0,
      outputPath: null,
      sourcePath: admission.rel,
      sourceStatus: "INVALID",
      document: null,
      message: admission.message,
    };
  }
  if (admission.kind === "CONFLICT") {
    return {
      dateKst,
      status: "TARGET_SCOPE_CONFLICT",
      lockCreated: false,
      targetCount: null,
      targetCountAuthoritative: false,
      excludedCount: 0,
      outputPath: null,
      sourcePath: admission.rel,
      sourceStatus: "CONFLICT",
      document: null,
      message: admission.message,
    };
  }

  const payload = admission.payload;
  const document = buildDocument({
    dateKst,
    createdAt,
    sourceClass: payload.class,
    sourceRel: payload.rel,
    sourceSha256: payload.sha256,
    targets: payload.targets,
    exclusions: payload.exclusions,
  });

  const write = await exclusiveWriteJson(outputAbs, document);
  if (write === "CREATED") {
    return {
      dateKst,
      status:
        document.targetCount === 0
          ? "TARGET_SCOPE_NO_ADMISSIBLE_TARGETS"
          : "LOCKED",
      lockCreated: true,
      targetCount: document.targetCount,
      targetCountAuthoritative: true,
      excludedCount: document.exclusions.length,
      outputPath: outputRel,
      sourcePath: payload.rel,
      sourceStatus:
        document.targetCount === 0 ? "NO_ADMISSIBLE" : "FOUND",
      document,
      message:
        document.targetCount === 0
          ? "Valid zero-admissible cohort locked."
          : "Research target scope locked.",
    };
  }

  let existingRaw: string;
  try {
    existingRaw = await readFile(outputAbs, "utf8");
  } catch {
    return {
      dateKst,
      status: "SCOPE_LOCK_CONFLICT",
      lockCreated: false,
      targetCount: null,
      targetCountAuthoritative: false,
      excludedCount: 0,
      outputPath: outputRel,
      sourcePath: payload.rel,
      sourceStatus: "FOUND",
      document: null,
      message: "EXISTING_LOCK_UNREADABLE",
    };
  }

  let existing: ResearchTargetScopeLockDocument;
  try {
    existing = JSON.parse(existingRaw) as ResearchTargetScopeLockDocument;
  } catch {
    return {
      dateKst,
      status: "SCOPE_LOCK_CONFLICT",
      lockCreated: false,
      targetCount: null,
      targetCountAuthoritative: false,
      excludedCount: 0,
      outputPath: outputRel,
      sourcePath: payload.rel,
      sourceStatus: "FOUND",
      document: null,
      message: "EXISTING_LOCK_INVALID_JSON",
    };
  }

  if (
    existing.schemaVersion === DAILY_SCOPE_LOCK_SCHEMA_VERSION &&
    existing.dateKst === dateKst &&
    existing.lockMechanism === RESEARCH_TARGET_SCOPE_LOCK_MECHANISM &&
    fingerprintDoc(existing) === fingerprintDoc(document)
  ) {
    return {
      dateKst,
      status: "IDEMPOTENT_EXISTING",
      lockCreated: false,
      targetCount: existing.targetCount,
      targetCountAuthoritative: true,
      excludedCount: existing.exclusions?.length ?? 0,
      outputPath: outputRel,
      sourcePath: payload.rel,
      sourceStatus: "FOUND",
      document: existing,
      message: "Existing lock is semantically identical; no rewrite.",
    };
  }

  return {
    dateKst,
    status: "SCOPE_LOCK_CONFLICT",
    lockCreated: false,
    targetCount: existing.targetCount ?? null,
    targetCountAuthoritative: false,
    excludedCount: 0,
    outputPath: outputRel,
    sourcePath: payload.rel,
    sourceStatus: "FOUND",
    document: null,
    message: "Existing lock differs; rewrite forbidden.",
  };
}
