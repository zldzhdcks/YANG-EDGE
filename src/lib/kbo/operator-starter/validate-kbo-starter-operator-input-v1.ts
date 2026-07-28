import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getKboIdentityProvider } from "../kbo-identity-feature-flag";
import { getKboIdentityArtifactPath } from "../kbo-identity-artifact-path";
import {
  KBO_STARTER_OPERATOR_INPUT_SCHEMA_VERSION,
  type KboStarterGameInput,
  type KboStarterOperatorInputAuditV1,
  type KboStarterOperatorInputStatus,
  type KboStarterOperatorInputV1,
  type KboStarterOperatorReviewStatus,
  type KboStarterSideInput,
  type KboStarterSourceReference,
  type KboStarterSourceReferenceType,
} from "./kbo-starter-operator-input-types";

type IdentityRow = {
  internalGameId: string;
  providerGameId: string;
  homeTeam: { canonicalNameKo: string | null; providerName: string | null };
  awayTeam: { canonicalNameKo: string | null; providerName: string | null };
  time: { startTimeKst: string | null };
};

type IdentityDocument = {
  meta: { dateKst: string; resultHashSha256: string };
  rows: IdentityRow[];
};

const REVIEW_STATUSES = new Set<KboStarterOperatorReviewStatus>([
  "DRAFT",
  "VERIFIED",
  "REJECTED",
]);

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) out[key] = sortKeys(obj[key]);
  return out;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function parseMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

export function starterInputPath(dateKst: string, cwd = process.cwd()): string {
  return path.join(
    cwd,
    "data/operator-input/kbo",
    `${dateKst}-starter-confirmation-v1.json`,
  );
}

export async function loadKboIdentityForStarterValidation(
  dateKst: string,
  cwd = process.cwd(),
): Promise<{ document: IdentityDocument; provider: string } | null> {
  const preferred = getKboIdentityProvider();
  const preferredPath = getKboIdentityArtifactPath(dateKst, preferred, cwd);
  const preferredDoc = await readJsonIfExists<IdentityDocument>(preferredPath);
  if (preferredDoc && preferredDoc.rows.length > 0) {
    return { document: preferredDoc, provider: preferred };
  }

  const fallback = preferred === "API_BASEBALL" ? "THESPORTSDB" : "API_BASEBALL";
  const fallbackPath = getKboIdentityArtifactPath(dateKst, fallback, cwd);
  const fallbackDoc = await readJsonIfExists<IdentityDocument>(fallbackPath);
  if (fallbackDoc && fallbackDoc.rows.length > 0) {
    return { document: fallbackDoc, provider: fallback };
  }

  return null;
}

function emptyStarterSide(): KboStarterSideInput {
  return {
    playerId: null,
    playerName: null,
    throwingHand: null,
    starterStatus: "NOT_ANNOUNCED",
    sourceType: null,
    sourceReference: null,
    announcedAt: null,
    capturedAt: null,
    mappingStatus: "UNMATCHED",
    notes: null,
  };
}

export function buildKboStarterConfirmationDraftV1(args: {
  dateKst: string;
  identity: IdentityDocument;
  now?: string;
}): KboStarterOperatorInputV1 {
  const now = args.now ?? new Date().toISOString();
  return {
    schemaVersion: KBO_STARTER_OPERATOR_INPUT_SCHEMA_VERSION,
    targetDateKst: args.dateKst,
    sourceType: "OPERATOR_VERIFIED",
    reviewStatus: "DRAFT",
    createdAt: now,
    updatedAt: now,
    games: args.identity.rows.map((row, index) => ({
      operatorStarterInputId: `KBO-STARTER-${args.dateKst.replace(/-/g, "")}-${String(index + 1).padStart(2, "0")}`,
      internalGameId: row.internalGameId,
      providerGameId: row.providerGameId,
      awayTeam:
        row.awayTeam.canonicalNameKo ?? row.awayTeam.providerName ?? "",
      homeTeam:
        row.homeTeam.canonicalNameKo ?? row.homeTeam.providerName ?? "",
      scheduledStartTimeKst: row.time.startTimeKst ?? "",
      awayStarter: emptyStarterSide(),
      homeStarter: emptyStarterSide(),
      capturedAt: null,
      enteredAt: null,
      reviewedAt: null,
      reviewedBy: null,
      reviewStatus: "DRAFT",
      sourceReference: null,
      mappingStatus: "MATCHED",
      warnings: [],
      blockingReasons: [],
    })),
  };
}

function identityHomeAway(row: IdentityRow): { home: string; away: string } {
  return {
    home: row.homeTeam.canonicalNameKo ?? row.homeTeam.providerName ?? "",
    away: row.awayTeam.canonicalNameKo ?? row.awayTeam.providerName ?? "",
  };
}

function validateGameIdentity(
  game: KboStarterGameInput,
  row: IdentityRow | undefined,
): {
  mappingStatus: KboStarterGameInput["mappingStatus"];
  blocking: string[];
} {
  if (!row) {
    return {
      mappingStatus: "IDENTITY_PROVIDER_GAME_MISSING",
      blocking: ["IDENTITY_PROVIDER_GAME_MISSING"],
    };
  }

  const expected = identityHomeAway(row);
  const mismatches: string[] = [];
  if (game.internalGameId !== row.internalGameId) {
    mismatches.push("INTERNAL_GAME_ID_MISMATCH");
  }
  if (game.providerGameId !== row.providerGameId) {
    mismatches.push("PROVIDER_GAME_ID_MISMATCH");
  }
  if (game.homeTeam !== expected.home) {
    mismatches.push("HOME_TEAM_MISMATCH");
  }
  if (game.awayTeam !== expected.away) {
    mismatches.push("AWAY_TEAM_MISMATCH");
  }
  if (
    parseMs(game.scheduledStartTimeKst) !== parseMs(row.time.startTimeKst)
  ) {
    mismatches.push("START_TIME_MISMATCH");
  }

  if (mismatches.length > 0) {
    return { mappingStatus: "UNMATCHED", blocking: mismatches };
  }
  return { mappingStatus: "MATCHED", blocking: [] };
}

function hasStarterName(starter: KboStarterSideInput): boolean {
  return typeof starter.playerName === "string" && starter.playerName.trim() !== "";
}

function resolvePlayerMappingStatus(
  starter: KboStarterSideInput,
): KboStarterSideInput["mappingStatus"] {
  if (!hasStarterName(starter)) return "UNMATCHED";
  if (starter.playerId != null && starter.playerId.trim() !== "") {
    return "MATCHED";
  }
  return "NAME_ONLY";
}

function sourceReferencePresent(ref: KboStarterSourceReference | null): boolean {
  if (!ref) return false;
  return (
    ref.sourceType != null &&
    (ref.sourceName != null ||
      ref.sourceUrl != null ||
      ref.sourceTitle != null ||
      ref.capturedBy != null)
  );
}

function validateCutoff(game: KboStarterGameInput): string[] {
  const blocking: string[] = [];
  const startMs = parseMs(game.scheduledStartTimeKst);
  if (startMs == null) {
    blocking.push("START_TIME_UNKNOWN");
    return blocking;
  }

  const capturedMs = parseMs(game.capturedAt);
  if (capturedMs == null) {
    blocking.push("CAPTURED_AT_MISSING");
  } else if (capturedMs >= startMs) {
    blocking.push("CAPTURED_AFTER_GAME_START");
  }

  for (const side of [game.awayStarter, game.homeStarter]) {
    const announcedMs = parseMs(side.announcedAt);
    if (announcedMs != null && announcedMs >= startMs) {
      blocking.push("ANNOUNCED_AFTER_GAME_START");
    }
  }

  return blocking;
}

function mediaSecondaryOnly(
  game: KboStarterGameInput,
): boolean {
  const types = new Set<KboStarterSourceReferenceType>();
  if (game.sourceReference?.sourceType) {
    types.add(game.sourceReference.sourceType);
  }
  for (const side of [game.awayStarter, game.homeStarter]) {
    if (side.sourceType) types.add(side.sourceType);
    if (side.sourceReference?.sourceType) {
      types.add(side.sourceReference.sourceType);
    }
  }
  return types.size === 1 && types.has("MEDIA_SECONDARY");
}

function validateVerifiedGame(
  game: KboStarterGameInput,
  identityMatch: ReturnType<typeof validateGameIdentity>,
): string[] {
  const blocking = [...identityMatch.blocking, ...validateCutoff(game)];

  if (identityMatch.mappingStatus !== "MATCHED") {
    blocking.push("IDENTITY_NOT_MATCHED");
  }
  if (!hasStarterName(game.awayStarter)) {
    blocking.push("AWAY_STARTER_MISSING");
  }
  if (!hasStarterName(game.homeStarter)) {
    blocking.push("HOME_STARTER_MISSING");
  }
  if (!sourceReferencePresent(game.sourceReference)) {
    blocking.push("SOURCE_REFERENCE_MISSING");
  }
  if (mediaSecondaryOnly(game)) {
    blocking.push("MEDIA_SECONDARY_CANNOT_VERIFY_ALONE");
  }

  return [...new Set(blocking)];
}

export function computeKboStarterOperatorStableInputHash(
  input: KboStarterOperatorInputV1,
): string {
  const games = input.games.map((game) => ({
    internalGameId: game.internalGameId,
    providerGameId: game.providerGameId,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    scheduledStartTimeKst: game.scheduledStartTimeKst,
    awayStarter: {
      playerId: game.awayStarter.playerId,
      playerName: game.awayStarter.playerName,
      throwingHand: game.awayStarter.throwingHand,
      starterStatus: game.awayStarter.starterStatus,
      announcedAt: game.awayStarter.announcedAt,
      capturedAt: game.awayStarter.capturedAt,
      mappingStatus: game.awayStarter.mappingStatus,
    },
    homeStarter: {
      playerId: game.homeStarter.playerId,
      playerName: game.homeStarter.playerName,
      throwingHand: game.homeStarter.throwingHand,
      starterStatus: game.homeStarter.starterStatus,
      announcedAt: game.homeStarter.announcedAt,
      capturedAt: game.homeStarter.capturedAt,
      mappingStatus: game.homeStarter.mappingStatus,
    },
    capturedAt: game.capturedAt,
    reviewStatus: game.reviewStatus,
    sourceReference: game.sourceReference,
  }));

  return sha256(
    stableStringify({
      schemaVersion: input.schemaVersion,
      targetDateKst: input.targetDateKst,
      sourceType: input.sourceType,
      reviewStatus: input.reviewStatus,
      games,
    }),
  );
}

export async function validateKboStarterOperatorInputV1(params: {
  dateKst: string;
  cwd?: string;
}): Promise<{
  input: KboStarterOperatorInputV1 | null;
  identity: IdentityDocument | null;
  identityProvider: string | null;
  audit: KboStarterOperatorInputAuditV1;
}> {
  const cwd = params.cwd ?? process.cwd();
  const inputPath = starterInputPath(params.dateKst, cwd);
  const identityLoad = await loadKboIdentityForStarterValidation(
    params.dateKst,
    cwd,
  );

  const globalBlocking: string[] = [];
  const globalWarnings: string[] = [];
  const globalMissing: string[] = [];

  if (!identityLoad) {
    globalMissing.push("NO_IDENTITY_GAMES_AVAILABLE");
    return {
      input: null,
      identity: null,
      identityProvider: null,
      audit: {
        meta: {
          version: "kbo-starter-operator-input-v1",
          generatedAt: new Date().toISOString(),
          conclusion: "KBO_STARTER_OPERATOR_INPUT_VALIDATED",
        },
        targetDateKst: params.dateKst,
        identityProvider: null,
        identityGames: 0,
        inputGames: 0,
        matchedGames: 0,
        unmatchedGames: 0,
        ambiguousGames: 0,
        awayStartersEntered: 0,
        homeStartersEntered: 0,
        confirmedStarters: 0,
        probableStarters: 0,
        verifiedGames: 0,
        draftGames: 0,
        rejectedGames: 0,
        cutoffViolations: 0,
        sourceReferenceMissing: 0,
        inputStatus: "NOT_ENTERED",
        stableInputHashSha256: null,
        blockingReasons: [],
        warnings: [],
        missing: globalMissing,
        predictionReadiness: "NOT_IMPLEMENTED",
        engineImpact: 0,
        noIdentityGamesAvailable: true,
      },
    };
  }

  const { document: identity, provider: identityProvider } = identityLoad;
  const identityById = new Map(
    identity.rows.map((row) => [row.internalGameId, row] as const),
  );

  const inputExists = await fileExists(inputPath);
  if (!inputExists) {
    globalMissing.push("STARTER_INPUT_NOT_ENTERED");
    return {
      input: null,
      identity,
      identityProvider,
      audit: {
        meta: {
          version: "kbo-starter-operator-input-v1",
          generatedAt: new Date().toISOString(),
          conclusion: "KBO_STARTER_OPERATOR_INPUT_VALIDATED",
        },
        targetDateKst: params.dateKst,
        identityProvider,
        identityGames: identity.rows.length,
        inputGames: 0,
        matchedGames: 0,
        unmatchedGames: 0,
        ambiguousGames: 0,
        awayStartersEntered: 0,
        homeStartersEntered: 0,
        confirmedStarters: 0,
        probableStarters: 0,
        verifiedGames: 0,
        draftGames: 0,
        rejectedGames: 0,
        cutoffViolations: 0,
        sourceReferenceMissing: 0,
        inputStatus: "NOT_ENTERED",
        stableInputHashSha256: null,
        blockingReasons: [],
        warnings: ["OPERATOR_REVIEW_REQUIRED"],
        missing: globalMissing,
        predictionReadiness: "NOT_IMPLEMENTED",
        engineImpact: 0,
      },
    };
  }

  const input = JSON.parse(await readFile(inputPath, "utf8")) as KboStarterOperatorInputV1;

  if (input.schemaVersion !== KBO_STARTER_OPERATOR_INPUT_SCHEMA_VERSION) {
    globalBlocking.push("INVALID_SCHEMA_VERSION");
  }
  if (input.targetDateKst !== params.dateKst) {
    globalBlocking.push("DATE_MISMATCH");
  }
  if (!REVIEW_STATUSES.has(input.reviewStatus)) {
    globalBlocking.push("INVALID_TOP_LEVEL_REVIEW_STATUS");
  }

  let matchedGames = 0;
  let unmatchedGames = 0;
  let ambiguousGames = 0;
  let awayStartersEntered = 0;
  let homeStartersEntered = 0;
  let confirmedStarters = 0;
  let probableStarters = 0;
  let verifiedGames = 0;
  let draftGames = 0;
  let rejectedGames = 0;
  let cutoffViolations = 0;
  let sourceReferenceMissing = 0;

  for (const game of input.games) {
    if (!REVIEW_STATUSES.has(game.reviewStatus)) {
      globalBlocking.push("INVALID_GAME_REVIEW_STATUS");
    }

    const row = identityById.get(game.internalGameId);
    const identityMatch = validateGameIdentity(game, row);

    if (identityMatch.mappingStatus === "MATCHED") matchedGames += 1;
    else if (identityMatch.mappingStatus === "AMBIGUOUS") ambiguousGames += 1;
    else unmatchedGames += 1;

    const localBlocking = [...game.blockingReasons, ...identityMatch.blocking];
    const localWarnings = [...game.warnings];

    const awayMapping = resolvePlayerMappingStatus(game.awayStarter);
    const homeMapping = resolvePlayerMappingStatus(game.homeStarter);

    if (hasStarterName(game.awayStarter)) awayStartersEntered += 1;
    if (hasStarterName(game.homeStarter)) homeStartersEntered += 1;

    for (const side of [game.awayStarter, game.homeStarter]) {
      if (
        side.starterStatus === "CONFIRMED" ||
        side.starterStatus === "OPERATOR_VERIFIED"
      ) {
        confirmedStarters += 1;
      }
      if (side.starterStatus === "PROBABLE") probableStarters += 1;
    }

    if (awayMapping === "NAME_ONLY") {
      localWarnings.push("NAME_ONLY_PLAYER_IDENTITY");
    }
    if (homeMapping === "NAME_ONLY") {
      localWarnings.push("NAME_ONLY_PLAYER_IDENTITY");
    }
    if (game.awayStarter.starterStatus === "PROBABLE") {
      localWarnings.push("STARTER_PROBABLE_ONLY");
    }
    if (game.homeStarter.starterStatus === "PROBABLE") {
      localWarnings.push("STARTER_PROBABLE_ONLY");
    }
    if (
      game.sourceReference?.sourceType === "MEDIA_SECONDARY" ||
      game.awayStarter.sourceType === "MEDIA_SECONDARY" ||
      game.homeStarter.sourceType === "MEDIA_SECONDARY"
    ) {
      localWarnings.push("MEDIA_SECONDARY_SOURCE");
    }
    if (!game.awayStarter.announcedAt || !game.homeStarter.announcedAt) {
      localWarnings.push("ANNOUNCEMENT_TIME_UNKNOWN");
    }
    if (
      game.awayStarter.throwingHand == null ||
      game.awayStarter.throwingHand === "UNKNOWN" ||
      game.homeStarter.throwingHand == null ||
      game.homeStarter.throwingHand === "UNKNOWN"
    ) {
      localWarnings.push("THROWING_HAND_UNKNOWN");
    }

    const cutoffBlocking =
      game.reviewStatus === "VERIFIED" ? validateCutoff(game) : [];
    if (validateCutoff(game).length > 0) {
      cutoffViolations += 1;
    }
    if (cutoffBlocking.length > 0) {
      localBlocking.push(...cutoffBlocking);
    }

    if (!sourceReferencePresent(game.sourceReference)) {
      sourceReferenceMissing += 1;
      localWarnings.push("SOURCE_REFERENCE_MISSING");
    }

    if (game.reviewStatus === "VERIFIED") {
      const verifiedBlocking = validateVerifiedGame(game, identityMatch);
      if (verifiedBlocking.length > 0) {
        globalBlocking.push(...verifiedBlocking);
        localBlocking.push(...verifiedBlocking);
      } else {
        verifiedGames += 1;
      }
    } else if (game.reviewStatus === "DRAFT") {
      draftGames += 1;
      localWarnings.push("OPERATOR_REVIEW_REQUIRED");
    } else if (game.reviewStatus === "REJECTED") {
      rejectedGames += 1;
    }

    globalWarnings.push(...localWarnings);
    globalBlocking.push(...localBlocking);
  }

  if (input.reviewStatus === "VERIFIED") {
    const allGamesVerified =
      input.games.length > 0 &&
      input.games.every((g) => g.reviewStatus === "VERIFIED");
    if (!allGamesVerified) {
      globalBlocking.push("TOP_LEVEL_VERIFIED_BUT_NOT_ALL_GAMES_VERIFIED");
    }
    for (const game of input.games) {
      const verifiedBlocking = validateVerifiedGame(
        game,
        validateGameIdentity(game, identityById.get(game.internalGameId)),
      );
      if (verifiedBlocking.length > 0) {
        globalBlocking.push(...verifiedBlocking);
      }
    }
  }

  const uniqueBlocking = [...new Set(globalBlocking)];
  const uniqueWarnings = [...new Set(globalWarnings)];
  const uniqueMissing = [...new Set(globalMissing)];

  let inputStatus: KboStarterOperatorInputStatus = "DRAFT";
  if (uniqueBlocking.length > 0) {
    inputStatus = "BLOCKED";
  } else if (input.games.length === 0) {
    inputStatus = "NOT_ENTERED";
  } else if (verifiedGames > 0 && verifiedGames < input.games.length) {
    inputStatus = "PARTIALLY_VERIFIED";
  } else if (
    verifiedGames === input.games.length &&
    input.games.length > 0 &&
    input.reviewStatus === "VERIFIED" &&
    input.games.every((g) => g.reviewStatus === "VERIFIED")
  ) {
    inputStatus = "VERIFIED_FOR_RESEARCH_INPUT";
  } else if (draftGames === input.games.length) {
    inputStatus = "DRAFT";
  } else if (rejectedGames > 0) {
    inputStatus = "BLOCKED";
  }

  const stableInputHashSha256 = computeKboStarterOperatorStableInputHash(input);

  return {
    input,
    identity,
    identityProvider,
    audit: {
      meta: {
        version: "kbo-starter-operator-input-v1",
        generatedAt: new Date().toISOString(),
        conclusion: "KBO_STARTER_OPERATOR_INPUT_VALIDATED",
      },
      targetDateKst: params.dateKst,
      identityProvider,
      identityGames: identity.rows.length,
      inputGames: input.games.length,
      matchedGames,
      unmatchedGames,
      ambiguousGames,
      awayStartersEntered,
      homeStartersEntered,
      confirmedStarters,
      probableStarters,
      verifiedGames,
      draftGames,
      rejectedGames,
      cutoffViolations,
      sourceReferenceMissing,
      inputStatus,
      stableInputHashSha256,
      blockingReasons: uniqueBlocking,
      warnings: uniqueWarnings,
      missing: uniqueMissing,
      predictionReadiness: "NOT_IMPLEMENTED",
      engineImpact: 0,
    },
  };
}

export async function ensureKboStarterConfirmationDraftFile(params: {
  dateKst: string;
  cwd?: string;
}): Promise<{ created: boolean; path: string }> {
  const cwd = params.cwd ?? process.cwd();
  const filePath = starterInputPath(params.dateKst, cwd);
  if (await fileExists(filePath)) {
    return { created: false, path: filePath };
  }

  const identityLoad = await loadKboIdentityForStarterValidation(
    params.dateKst,
    cwd,
  );
  if (!identityLoad || identityLoad.document.rows.length === 0) {
    return { created: false, path: filePath };
  }

  const draft = buildKboStarterConfirmationDraftV1({
    dateKst: params.dateKst,
    identity: identityLoad.document,
  });
  await writeFile(filePath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  return { created: true, path: filePath };
}
