import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertExplicitDateKst,
  gameRepresentsDateKst,
  isResearchSlateSourceFreezeDocument,
  isValidIsoTimestamp,
  operatorBetmanDailySlateRel,
  researchSlateSourceFreezeRel,
} from "./paths";
import type {
  FrozenSlateGame,
  ResearchSlateSourceFreezeDocument,
  ResearchSlateSourceFreezeResult,
} from "./types";
import {
  RESEARCH_SLATE_SOURCE_FREEZE_MECHANISM,
  RESEARCH_SLATE_SOURCE_FREEZE_SCHEMA_VERSION,
} from "./types";

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function semanticFingerprint(doc: ResearchSlateSourceFreezeDocument): string {
  const payload = {
    dateKst: doc.dateKst,
    sourceSha256: doc.source.sha256,
    sourceRel: doc.source.rel,
    sourceGameCount: doc.sourceGameCount,
    games: doc.games,
  };
  return sha256Text(JSON.stringify(payload));
}

/** Exclusive create via wx. Not temp+fsync+rename crash-atomic publication. */
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

type ParseOutcome =
  | { kind: "MISSING" }
  | {
      kind: "NOT_VERIFIED";
      rel: string;
      reviewStatus: string | null;
      scopeCompletenessStatus: string | null;
      message: string;
    }
  | {
      kind: "INVALID";
      rel: string;
      reviewStatus: string | null;
      scopeCompletenessStatus: string | null;
      message: string;
    }
  | {
      kind: "OK";
      rel: string;
      rawText: string;
      sha256: string;
      reviewedAt: string;
      games: FrozenSlateGame[];
    };

function parseOperatorInput(dateKst: string, cwd: string): ParseOutcome {
  const rel = operatorBetmanDailySlateRel(dateKst);
  const abs = path.join(cwd, rel);
  if (!existsSync(abs)) return { kind: "MISSING" };

  const rawText = readFileSync(abs, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      kind: "INVALID",
      rel,
      reviewStatus: null,
      scopeCompletenessStatus: null,
      message: "JSON_PARSE_FAILED",
    };
  }

  const doc = asRecord(parsed);
  if (!doc) {
    return {
      kind: "INVALID",
      rel,
      reviewStatus: null,
      scopeCompletenessStatus: null,
      message: "NOT_OBJECT",
    };
  }

  const reviewStatus = asString(doc.reviewStatus);
  const scopeCompletenessStatus =
    asString(doc.scopeCompletenessStatus) ?? "UNVERIFIED";

  if (doc.schemaVersion !== "betman-daily-slate-v1") {
    return {
      kind: "INVALID",
      rel,
      reviewStatus,
      scopeCompletenessStatus,
      message: "SCHEMA_MISMATCH",
    };
  }
  if (asString(doc.targetDateKst) !== dateKst) {
    return {
      kind: "INVALID",
      rel,
      reviewStatus,
      scopeCompletenessStatus,
      message: "DATE_MISMATCH",
    };
  }
  if (asString(doc.sourceType) !== "OPERATOR_MANUAL") {
    return {
      kind: "INVALID",
      rel,
      reviewStatus,
      scopeCompletenessStatus,
      message: "SOURCE_TYPE_MUST_BE_OPERATOR_MANUAL",
    };
  }
  if (reviewStatus !== "VERIFIED") {
    return {
      kind: "NOT_VERIFIED",
      rel,
      reviewStatus,
      scopeCompletenessStatus,
      message: "TOP_LEVEL_REVIEW_NOT_VERIFIED",
    };
  }
  if (scopeCompletenessStatus !== "COMPLETE") {
    return {
      kind: "NOT_VERIFIED",
      rel,
      reviewStatus,
      scopeCompletenessStatus,
      message: "SCOPE_COMPLETENESS_NOT_COMPLETE",
    };
  }
  const reviewedAt = asString(doc.reviewedAt);
  if (!reviewedAt || !isValidIsoTimestamp(reviewedAt)) {
    return {
      kind: "INVALID",
      rel,
      reviewStatus,
      scopeCompletenessStatus,
      message: "REVIEWED_AT_REQUIRED",
    };
  }
  if (!Array.isArray(doc.games)) {
    return {
      kind: "INVALID",
      rel,
      reviewStatus,
      scopeCompletenessStatus,
      message: "GAMES_NOT_ARRAY",
    };
  }

  const seen = new Set<string>();
  const games: FrozenSlateGame[] = [];
  for (const row of doc.games) {
    const g = asRecord(row);
    if (!g) {
      return {
        kind: "INVALID",
        rel,
        reviewStatus,
        scopeCompletenessStatus,
        message: "GAME_NOT_OBJECT",
      };
    }
    const operatorSlateGameId = asString(g.operatorSlateGameId);
    if (!operatorSlateGameId) {
      return {
        kind: "INVALID",
        rel,
        reviewStatus,
        scopeCompletenessStatus,
        message: "MISSING_OPERATOR_SLATE_GAME_ID",
      };
    }
    if (seen.has(operatorSlateGameId)) {
      return {
        kind: "INVALID",
        rel,
        reviewStatus,
        scopeCompletenessStatus,
        message: `DUPLICATE_OPERATOR_SLATE_GAME_ID:${operatorSlateGameId}`,
      };
    }
    seen.add(operatorSlateGameId);

    const sport = asString(g.sport);
    const homeTeamRaw = asString(g.homeTeamRaw);
    const awayTeamRaw = asString(g.awayTeamRaw);
    const scheduledStartTimeKst = asString(g.scheduledStartTimeKst);
    if (!sport) {
      return {
        kind: "INVALID",
        rel,
        reviewStatus,
        scopeCompletenessStatus,
        message: `MISSING_SPORT:${operatorSlateGameId}`,
      };
    }
    if (!homeTeamRaw) {
      return {
        kind: "INVALID",
        rel,
        reviewStatus,
        scopeCompletenessStatus,
        message: `MISSING_HOME:${operatorSlateGameId}`,
      };
    }
    if (!awayTeamRaw) {
      return {
        kind: "INVALID",
        rel,
        reviewStatus,
        scopeCompletenessStatus,
        message: `MISSING_AWAY:${operatorSlateGameId}`,
      };
    }
    if (!scheduledStartTimeKst) {
      return {
        kind: "INVALID",
        rel,
        reviewStatus,
        scopeCompletenessStatus,
        message: `MISSING_SCHEDULED_START:${operatorSlateGameId}`,
      };
    }
    if (!gameRepresentsDateKst(scheduledStartTimeKst, dateKst)) {
      return {
        kind: "INVALID",
        rel,
        reviewStatus,
        scopeCompletenessStatus,
        message: `CROSS_DATE_GAME:${operatorSlateGameId}`,
      };
    }
    if (asString(g.reviewStatus) !== "VERIFIED") {
      return {
        kind: "INVALID",
        rel,
        reviewStatus,
        scopeCompletenessStatus,
        message: `GAME_REVIEW_NOT_VERIFIED:${operatorSlateGameId}`,
      };
    }
    if (asString(g.operatorHomeAwayStatus) !== "VERIFIED") {
      return {
        kind: "INVALID",
        rel,
        reviewStatus,
        scopeCompletenessStatus,
        message: `HOME_AWAY_NOT_VERIFIED:${operatorSlateGameId}`,
      };
    }

    games.push({
      operatorSlateGameId,
      sport,
      competitionNameRaw: asString(g.competitionNameRaw),
      competitionNameKo: asString(g.competitionNameKo),
      operatorGameNumber: asString(g.operatorGameNumber),
      homeTeamRaw,
      awayTeamRaw,
      scheduledStartTimeKst,
      providerGameId: asString(g.providerGameId),
      providerFixtureId: asString(g.providerFixtureId),
    });
  }

  return {
    kind: "OK",
    rel,
    rawText,
    sha256: sha256Text(rawText),
    reviewedAt,
    games,
  };
}

function buildDocument(input: {
  dateKst: string;
  frozenAt: string;
  rel: string;
  sha256: string;
  reviewedAt: string;
  games: FrozenSlateGame[];
}): ResearchSlateSourceFreezeDocument {
  return {
    schemaVersion: RESEARCH_SLATE_SOURCE_FREEZE_SCHEMA_VERSION,
    freezeMechanism: RESEARCH_SLATE_SOURCE_FREEZE_MECHANISM,
    dateKst: input.dateKst,
    frozenAt: input.frozenAt,
    researchOnly: true,
    source: {
      class: "OPERATOR_BETMAN_DAILY_SLATE",
      rel: input.rel,
      sha256: input.sha256,
      sourceType: "OPERATOR_MANUAL",
      reviewStatus: "VERIFIED",
      scopeCompletenessStatus: "COMPLETE",
      reviewedAt: input.reviewedAt,
    },
    sourceGameCount: input.games.length,
    games: input.games,
    marketDataIncluded: false,
    providerCalls: 0,
    networkCalls: 0,
    fuzzyMatchingUsed: false,
    invariant:
      "FROZEN_SOURCE_REPRESENTS_COMPLETE_MANUALLY_VERIFIED_OPERATOR_SLATE",
  };
}

/**
 * Freeze the complete manually verified operator slate for an explicit KST date.
 * Preserves all observed sports (including research-unsupported). No Provider calls.
 */
export async function freezeResearchSlateSource(input: {
  dateKst: string;
  cwd?: string;
  frozenAt?: string;
}): Promise<ResearchSlateSourceFreezeResult> {
  const dateKst = assertExplicitDateKst(input.dateKst);
  const cwd = input.cwd ?? process.cwd();
  const outputRel = researchSlateSourceFreezeRel(dateKst);
  const outputAbs = path.join(cwd, outputRel);
  const frozenAt = input.frozenAt ?? new Date().toISOString();

  const parsed = parseOperatorInput(dateKst, cwd);
  if (parsed.kind === "MISSING") {
    return {
      dateKst,
      status: "SOURCE_FREEZE_INPUT_MISSING",
      freezeCreated: false,
      inputPath: operatorBetmanDailySlateRel(dateKst),
      outputPath: null,
      inputReviewStatus: null,
      scopeCompletenessStatus: null,
      sourceGameCount: null,
      sourceGameCountAuthoritative: false,
      sourceRawSha256: null,
      document: null,
      message:
        "Operator daily slate missing. SOURCE_GAME_COUNT is not authoritative zero.",
      networkCalls: 0,
      providerCalls: 0,
    };
  }
  if (parsed.kind === "NOT_VERIFIED") {
    return {
      dateKst,
      status: "SOURCE_FREEZE_NOT_VERIFIED",
      freezeCreated: false,
      inputPath: parsed.rel,
      outputPath: null,
      inputReviewStatus: parsed.reviewStatus,
      scopeCompletenessStatus: parsed.scopeCompletenessStatus,
      sourceGameCount: null,
      sourceGameCountAuthoritative: false,
      sourceRawSha256: null,
      document: null,
      message: parsed.message,
      networkCalls: 0,
      providerCalls: 0,
    };
  }
  if (parsed.kind === "INVALID") {
    return {
      dateKst,
      status: "SOURCE_FREEZE_INPUT_INVALID",
      freezeCreated: false,
      inputPath: parsed.rel,
      outputPath: null,
      inputReviewStatus: parsed.reviewStatus,
      scopeCompletenessStatus: parsed.scopeCompletenessStatus,
      sourceGameCount: null,
      sourceGameCountAuthoritative: false,
      sourceRawSha256: null,
      document: null,
      message: parsed.message,
      networkCalls: 0,
      providerCalls: 0,
    };
  }

  const document = buildDocument({
    dateKst,
    frozenAt,
    rel: parsed.rel,
    sha256: parsed.sha256,
    reviewedAt: parsed.reviewedAt,
    games: parsed.games,
  });

  const write = await exclusiveWriteJson(outputAbs, document);
  if (write === "CREATED") {
    return {
      dateKst,
      status: "SOURCE_FREEZE_CREATED",
      freezeCreated: true,
      inputPath: parsed.rel,
      outputPath: outputRel,
      inputReviewStatus: "VERIFIED",
      scopeCompletenessStatus: "COMPLETE",
      sourceGameCount: document.sourceGameCount,
      sourceGameCountAuthoritative: true,
      sourceRawSha256: parsed.sha256,
      document,
      message: "Research slate source freeze created.",
      networkCalls: 0,
      providerCalls: 0,
    };
  }

  let existingRaw: string;
  try {
    existingRaw = await readFile(outputAbs, "utf8");
  } catch {
    return {
      dateKst,
      status: "SOURCE_FREEZE_CONFLICT",
      freezeCreated: false,
      inputPath: parsed.rel,
      outputPath: outputRel,
      inputReviewStatus: "VERIFIED",
      scopeCompletenessStatus: "COMPLETE",
      sourceGameCount: null,
      sourceGameCountAuthoritative: false,
      sourceRawSha256: parsed.sha256,
      document: null,
      message: "EXISTING_FREEZE_UNREADABLE",
      networkCalls: 0,
      providerCalls: 0,
    };
  }

  let existingParsed: unknown;
  try {
    existingParsed = JSON.parse(existingRaw);
  } catch {
    return {
      dateKst,
      status: "SOURCE_FREEZE_CONFLICT",
      freezeCreated: false,
      inputPath: parsed.rel,
      outputPath: outputRel,
      inputReviewStatus: "VERIFIED",
      scopeCompletenessStatus: "COMPLETE",
      sourceGameCount: null,
      sourceGameCountAuthoritative: false,
      sourceRawSha256: parsed.sha256,
      document: null,
      message: "EXISTING_FREEZE_INVALID_JSON",
      networkCalls: 0,
      providerCalls: 0,
    };
  }

  if (!isResearchSlateSourceFreezeDocument(existingParsed)) {
    return {
      dateKst,
      status: "SOURCE_FREEZE_CONFLICT",
      freezeCreated: false,
      inputPath: parsed.rel,
      outputPath: outputRel,
      inputReviewStatus: "VERIFIED",
      scopeCompletenessStatus: "COMPLETE",
      sourceGameCount: null,
      sourceGameCountAuthoritative: false,
      sourceRawSha256: parsed.sha256,
      document: null,
      message: "EXISTING_FREEZE_SCHEMA_MISMATCH",
      networkCalls: 0,
      providerCalls: 0,
    };
  }

  if (
    existingParsed.dateKst === dateKst &&
    existingParsed.source.sha256 === parsed.sha256 &&
    semanticFingerprint(existingParsed) === semanticFingerprint(document)
  ) {
    return {
      dateKst,
      status: "IDEMPOTENT_EXISTING",
      freezeCreated: false,
      inputPath: parsed.rel,
      outputPath: outputRel,
      inputReviewStatus: "VERIFIED",
      scopeCompletenessStatus: "COMPLETE",
      sourceGameCount: existingParsed.sourceGameCount,
      sourceGameCountAuthoritative: true,
      sourceRawSha256: existingParsed.source.sha256,
      document: existingParsed,
      message: "Existing freeze is semantically identical; no rewrite.",
      networkCalls: 0,
      providerCalls: 0,
    };
  }

  return {
    dateKst,
    status: "SOURCE_FREEZE_CONFLICT",
    freezeCreated: false,
    inputPath: parsed.rel,
    outputPath: outputRel,
    inputReviewStatus: "VERIFIED",
    scopeCompletenessStatus: "COMPLETE",
    sourceGameCount: existingParsed.sourceGameCount,
    sourceGameCountAuthoritative: false,
    sourceRawSha256: parsed.sha256,
    document: null,
    message: "Existing freeze differs; rewrite forbidden.",
    networkCalls: 0,
    providerCalls: 0,
  };
}
