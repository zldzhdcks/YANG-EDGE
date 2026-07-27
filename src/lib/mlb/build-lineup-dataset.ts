/**
 * MLB Lineup Dataset v1 builder — post-game actual starting lineups only.
 *
 * - Uses boxscore players[].battingOrder *00 for starters
 * - Never uses team.battingOrder as starting lineup
 * - Never backfills preGame from post-game
 * - No battingSide / people API calls
 * - Engine admission PROHIBITED
 */
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  createCacheUsage,
  getRawStatsJson,
  type CacheUsageStats,
} from "./research-stats-cache";
import {
  LINEUP_BUILDER_VERSION,
  LINEUP_DATASET_ID,
  LINEUP_SCHEMA_VERSION,
  type LineupBatterRow,
  type LineupDatasetDocument,
  type LineupDatasetRow,
  type LineupSide,
  type LineupStatus,
  type LineupSubstituteRow,
} from "./lineup-dataset-types";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeys(obj[key]);
  }
  return out;
}

const STARTER_ORDER_RE = /^[1-9]00$/;

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

type GameTarget = {
  gameId: string;
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
  cutoffTime: string | null;
};

async function loadGameTargets(dateKst: string): Promise<GameTarget[]> {
  const starterPath = path.join(
    process.cwd(),
    "data/research/mlb",
    `${dateKst}-starter-dataset-v1.json`,
  );
  const predPath = path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${dateKst}.json`,
  );

  if (!(await fileExists(predPath))) {
    throw new Error(`prediction snapshot missing: ${predPath}`);
  }
  if (!(await fileExists(starterPath))) {
    throw new Error(
      `starter dataset missing (read-only join for gamePk): ${starterPath}`,
    );
  }

  const pred = JSON.parse(await readFile(predPath, "utf8")) as {
    predictions?: unknown[];
  };
  const starter = JSON.parse(await readFile(starterPath, "utf8")) as {
    rows?: unknown[];
  };

  const gradedIds = new Set<string>();
  const predMeta = new Map<
    string,
    { homeTeam: string; awayTeam: string }
  >();
  for (const raw of pred.predictions ?? []) {
    const p = asRecord(raw);
    if (!p) continue;
    const gameId = asString(p.gameId);
    if (!gameId) continue;
    if (asString(p.resultStatus) !== "graded") continue;
    gradedIds.add(gameId);
    predMeta.set(gameId, {
      homeTeam: asString(p.homeTeam) ?? "",
      awayTeam: asString(p.awayTeam) ?? "",
    });
  }

  const byGame = new Map<string, GameTarget>();
  for (const raw of starter.rows ?? []) {
    const r = asRecord(raw);
    if (!r) continue;
    const gameId = asString(r.gameId);
    const gamePk = asNumber(r.gamePk);
    if (!gameId || gamePk == null) continue;
    if (!gradedIds.has(gameId)) continue;
    if (byGame.has(gameId)) {
      const existing = byGame.get(gameId)!;
      if (existing.cutoffTime == null) {
        existing.cutoffTime = asString(r.cutoffTime);
      }
      continue;
    }
    const meta = predMeta.get(gameId);
    byGame.set(gameId, {
      gameId,
      gamePk,
      homeTeam: asString(r.homeTeam) ?? meta?.homeTeam ?? "",
      awayTeam: asString(r.awayTeam) ?? meta?.awayTeam ?? "",
      cutoffTime: asString(r.cutoffTime),
    });
  }

  const missingPk = [...gradedIds].filter((id) => !byGame.has(id));
  if (missingPk.length > 0) {
    throw new Error(
      `graded games missing gamePk join from starter dataset: ${missingPk.join(", ")}`,
    );
  }

  return [...byGame.values()].sort((a, b) => a.gamePk - b.gamePk);
}

type ExtractedSide = {
  teamId: number;
  teamName: string;
  starters: LineupBatterRow[];
  substitutes: LineupSubstituteRow[];
  lineupStatus: LineupStatus;
  warnings: string[];
  missingFields: string[];
  slotDuplicates: number;
  slotMissing: number;
  startersMarkedSubstitute: number;
};

function extractSide(teamRaw: unknown): ExtractedSide {
  const team = asRecord(teamRaw);
  const teamInfo = asRecord(team?.team);
  const teamId = asNumber(teamInfo?.id) ?? -1;
  const teamName = asString(teamInfo?.name) ?? "UNKNOWN";
  const players = asRecord(team?.players) ?? {};

  const starters: LineupBatterRow[] = [];
  const substitutes: LineupSubstituteRow[] = [];
  const warnings: string[] = [];
  let startersMarkedSubstitute = 0;

  for (const plRaw of Object.values(players)) {
    const pl = asRecord(plRaw);
    if (!pl) continue;
    const person = asRecord(pl.person);
    const playerId = asNumber(person?.id);
    const playerName = asString(person?.fullName) ?? "UNKNOWN";
    if (playerId == null) continue;

    const battingOrderCode =
      pl.battingOrder != null ? String(pl.battingOrder) : null;
    if (battingOrderCode == null) continue;

    const pos = asRecord(pl.position);
    const defensivePosition = asString(pos?.abbreviation);
    const gs = asRecord(pl.gameStatus);
    const isSubstitute = gs?.isSubstitute === true;

    if (STARTER_ORDER_RE.test(battingOrderCode)) {
      const slot = Number(battingOrderCode[0]);
      if (isSubstitute) {
        startersMarkedSubstitute += 1;
        warnings.push(
          `STARTER_SLOT_MARKED_SUBSTITUTE:${slot}:${playerId}`,
        );
        continue;
      }
      starters.push({
        slot,
        playerId,
        playerName,
        defensivePosition,
        isDh: defensivePosition === "DH",
        isSubstitute: false,
      });
      continue;
    }

    // Non-*00 battingOrder → substitute / later slot occupant
    const slotDigit = Number(battingOrderCode[0]);
    substitutes.push({
      slot: Number.isFinite(slotDigit) ? slotDigit : null,
      playerId,
      playerName,
      defensivePosition,
      battingOrderCode,
      isSubstitute: true,
    });
  }

  // Also catch isSubstitute with no battingOrder? Usually have codes.
  // Sort starters by slot
  starters.sort((a, b) => a.slot - b.slot);
  substitutes.sort((a, b) => {
    const sa = a.slot ?? 99;
    const sb = b.slot ?? 99;
    if (sa !== sb) return sa - sb;
    return a.battingOrderCode.localeCompare(b.battingOrderCode);
  });

  const slotCounts = new Map<number, number>();
  for (const s of starters) {
    slotCounts.set(s.slot, (slotCounts.get(s.slot) ?? 0) + 1);
  }
  let slotDuplicates = 0;
  let slotMissing = 0;
  for (let slot = 1; slot <= 9; slot += 1) {
    const n = slotCounts.get(slot) ?? 0;
    if (n === 0) {
      slotMissing += 1;
      warnings.push(`BATTING_SLOT_MISSING:${slot}`);
    } else if (n > 1) {
      slotDuplicates += n - 1;
      warnings.push(`BATTING_SLOT_DUPLICATE:${slot}:count=${n}`);
    }
  }

  const missingFields = ["battingSide", "preGameLineupSnapshot"];
  let lineupStatus: LineupStatus = "COMPLETE";
  if (
    starters.length !== 9 ||
    slotMissing > 0 ||
    slotDuplicates > 0 ||
    startersMarkedSubstitute > 0
  ) {
    lineupStatus = "INCOMPLETE";
    if (starters.length !== 9) {
      warnings.push(`STARTER_COUNT_${starters.length}_EXPECTED_9`);
    }
  }

  return {
    teamId,
    teamName,
    starters,
    substitutes,
    lineupStatus,
    warnings,
    missingFields,
    slotDuplicates,
    slotMissing,
    startersMarkedSubstitute,
  };
}

function hashableRowBody(row: LineupDatasetRow): unknown {
  return {
    schemaVersion: row.schemaVersion,
    builderVersion: row.builderVersion,
    gameDate: row.gameDate,
    gameId: row.gameId,
    gamePk: row.gamePk,
    teamId: row.teamId,
    teamName: row.teamName,
    opponentTeamId: row.opponentTeamId,
    opponentTeamName: row.opponentTeamName,
    side: row.side,
    lineupType: row.lineupType,
    collectionPhase: row.collectionPhase,
    preGameStatus: row.preGameStatus,
    sourceTimestamp: row.sourceTimestamp,
    cutoffTime: row.cutoffTime,
    lineupStatus: row.lineupStatus,
    battingOrder: row.battingOrder,
    substitutes: row.substitutes,
    missingFields: row.missingFields,
    warnings: row.warnings,
    researchOnly: row.researchOnly,
    legalStatus: row.legalStatus,
    engineUseAllowed: row.engineUseAllowed,
  };
}

async function readBoxscoreFetchedAt(
  gamePk: number,
): Promise<string | null> {
  const file = path.join(
    process.cwd(),
    "data/cache/research/mlb/raw/statsapi/api/v1/game",
    String(gamePk),
    "boxscore.json",
  );
  try {
    const raw = JSON.parse(await readFile(file, "utf8")) as {
      meta?: { fetchedAt?: string };
    };
    return asString(raw.meta?.fetchedAt);
  } catch {
    return null;
  }
}

function buildTeamRow(args: {
  generatedAt: string;
  dateKst: string;
  game: GameTarget;
  side: LineupSide;
  extracted: ExtractedSide;
  opponent: ExtractedSide;
  sourceTimestamp: string | null;
}): LineupDatasetRow {
  const inputHash = sha256(
    stableStringify({
      gamePk: args.game.gamePk,
      side: args.side,
      sourceTimestamp: args.sourceTimestamp,
      starterIds: args.extracted.starters.map((s) => [
        s.slot,
        s.playerId,
      ]),
      substituteIds: args.extracted.substitutes.map((s) => [
        s.battingOrderCode,
        s.playerId,
      ]),
    }),
  );

  const draft: LineupDatasetRow = {
    schemaVersion: LINEUP_SCHEMA_VERSION,
    builderVersion: LINEUP_BUILDER_VERSION,
    generatedAt: args.generatedAt,
    gameDate: args.dateKst,
    gameId: args.game.gameId,
    gamePk: args.game.gamePk,
    teamId: args.extracted.teamId,
    teamName: args.extracted.teamName,
    opponentTeamId: args.opponent.teamId,
    opponentTeamName: args.opponent.teamName,
    side: args.side,
    lineupType: "ACTUAL_STARTING",
    collectionPhase: "POST_GAME",
    preGameStatus: "NOT_COLLECTED",
    sourceTimestamp: args.sourceTimestamp,
    cutoffTime: args.game.cutoffTime,
    lineupStatus: args.extracted.lineupStatus,
    battingOrder: args.extracted.starters,
    substitutes: args.extracted.substitutes,
    missingFields: args.extracted.missingFields,
    warnings: args.extracted.warnings,
    researchOnly: true,
    legalStatus: "INTERNAL_RESEARCH_ONLY",
    engineUseAllowed: false,
    inputHash,
    resultHash: "",
  };
  draft.resultHash = sha256(stableStringify(hashableRowBody(draft)));
  return draft;
}

export type BuildLineupDatasetResult = {
  document: LineupDatasetDocument;
  predictionHash: string;
  usage: CacheUsageStats;
};

export async function buildLineupDatasetV1(input: {
  dateKst: string;
  predictionRaw: string;
}): Promise<BuildLineupDatasetResult> {
  const predictionHash = sha256(input.predictionRaw);
  const usage = createCacheUsage();
  const targets = await loadGameTargets(input.dateKst);
  const generatedAt = new Date().toISOString();
  const rows: LineupDatasetRow[] = [];

  for (const game of targets) {
    const boxBody = asRecord(
      await getRawStatsJson(`/api/v1/game/${game.gamePk}/boxscore`, usage),
    );
    const teams = asRecord(boxBody?.teams);
    const homeEx = extractSide(teams?.home);
    const awayEx = extractSide(teams?.away);
    const sourceTimestamp = await readBoxscoreFetchedAt(game.gamePk);

    rows.push(
      buildTeamRow({
        generatedAt,
        dateKst: input.dateKst,
        game,
        side: "home",
        extracted: homeEx,
        opponent: awayEx,
        sourceTimestamp,
      }),
      buildTeamRow({
        generatedAt,
        dateKst: input.dateKst,
        game,
        side: "away",
        extracted: awayEx,
        opponent: homeEx,
        sourceTimestamp,
      }),
    );
  }

  let battingSlotDuplicates = 0;
  let battingSlotMissing = 0;
  for (const row of rows) {
    const counts = new Map<number, number>();
    for (const b of row.battingOrder) {
      counts.set(b.slot, (counts.get(b.slot) ?? 0) + 1);
    }
    for (let slot = 1; slot <= 9; slot += 1) {
      const n = counts.get(slot) ?? 0;
      if (n === 0) battingSlotMissing += 1;
      if (n > 1) battingSlotDuplicates += n - 1;
    }
  }
  const substitutesSeparated = rows.reduce(
    (n, r) => n + r.substitutes.length,
    0,
  );
  const startersMarkedSubstitute = rows.reduce(
    (n, r) =>
      n +
      r.warnings.filter((w) => w.startsWith("STARTER_SLOT_MARKED_SUBSTITUTE"))
        .length,
    0,
  );
  const completeLineups = rows.filter((r) => r.lineupStatus === "COMPLETE")
    .length;
  const incompleteLineups = rows.filter((r) => r.lineupStatus === "INCOMPLETE")
    .length;
  const postGameStatuses: Record<LineupStatus, number> = {
    COMPLETE: completeLineups,
    INCOMPLETE: incompleteLineups,
  };

  const hashableRows = rows.map((r) => hashableRowBody(r));
  const inputHashSha256 = sha256(
    stableStringify({
      datasetId: LINEUP_DATASET_ID,
      schemaVersion: LINEUP_SCHEMA_VERSION,
      builderVersion: LINEUP_BUILDER_VERSION,
      dateKst: input.dateKst,
      predictionHash,
      games: targets.map((g) => ({
        gameId: g.gameId,
        gamePk: g.gamePk,
      })),
    }),
  );
  const resultHashSha256 = sha256(stableStringify(hashableRows));

  const totalStarters = rows.reduce((n, r) => n + r.battingOrder.length, 0);

  const document: LineupDatasetDocument = {
    meta: {
      datasetId: LINEUP_DATASET_ID,
      schemaVersion: LINEUP_SCHEMA_VERSION,
      builderVersion: LINEUP_BUILDER_VERSION,
      status: "COLLECTING",
      engineAdmission: "PROHIBITED",
      engineConnected: false,
      engineUseAllowed: false,
      researchOnly: true,
      dateKst: input.dateKst,
      generatedAt,
      predictionHashSha256: predictionHash,
      predictionUnchanged: true,
      inputHashSha256,
      resultHashSha256,
      legal: {
        mlbStatsSource: "INTERNAL_RESEARCH_ONLY",
        publicRuntimeUseAllowed: false,
        commercialRuntimeUseAllowed: false,
        rawResponseInResearchCacheOnly: true,
        mlbHtmlCrawling: false,
        sportsDataIoScrambled: false,
      },
      notes: [
        "postGameActualLineup only — review/label use",
        "preGameStatus=NOT_COLLECTED — no backfill from boxscore",
        "battingSide not collected (no people API)",
        "team.battingOrder not used for starters",
        "Engine admission PROHIBITED",
      ],
    },
    cacheUsage: { ...usage },
    summary: {
      totalGames: targets.length,
      teamLineups: rows.length,
      completeLineups,
      incompleteLineups,
      totalStarters,
      battingSlotDuplicates,
      battingSlotMissing,
      substitutesSeparated,
      startersMarkedSubstitute,
      preGameStatus: "NOT_COLLECTED",
      postGameStatuses,
      battingSideCollected: 0,
      peopleApiCalls: 0,
    },
    rows,
  };

  return { document, predictionHash, usage };
}

export function assertLineupDatasetIntegrity(
  document: LineupDatasetDocument,
): string[] {
  const errors: string[] = [];
  if (document.meta.engineAdmission !== "PROHIBITED") {
    errors.push("engineAdmission must be PROHIBITED");
  }
  if (document.meta.engineUseAllowed !== false) {
    errors.push("engineUseAllowed must be false");
  }
  if (document.summary.battingSideCollected !== 0) {
    errors.push("battingSide must not be collected in v1");
  }
  if (document.summary.peopleApiCalls !== 0) {
    errors.push("people API calls must be 0");
  }
  if (document.summary.preGameStatus !== "NOT_COLLECTED") {
    errors.push("preGameStatus must be NOT_COLLECTED for historical slate");
  }

  for (const row of document.rows) {
    if (row.preGameStatus !== "NOT_COLLECTED") {
      errors.push(`${row.gameId}/${row.side}: preGame backfill detected`);
    }
    if (row.collectionPhase !== "POST_GAME") {
      errors.push(`${row.gameId}/${row.side}: collectionPhase must be POST_GAME`);
    }
    if (row.lineupType !== "ACTUAL_STARTING") {
      errors.push(`${row.gameId}/${row.side}: lineupType must be ACTUAL_STARTING`);
    }
    if (row.battingOrder.some((b) => b.isSubstitute !== false)) {
      errors.push(`${row.gameId}/${row.side}: substitute in battingOrder`);
    }
    if (row.lineupStatus === "COMPLETE" && row.battingOrder.length !== 9) {
      errors.push(
        `${row.gameId}/${row.side}: COMPLETE but starter count != 9`,
      );
    }
    const slots = row.battingOrder.map((b) => b.slot).sort((a, b) => a - b);
    if (row.lineupStatus === "COMPLETE") {
      for (let i = 1; i <= 9; i += 1) {
        if (slots[i - 1] !== i) {
          errors.push(
            `${row.gameId}/${row.side}: COMPLETE slots not 1..9 unique`,
          );
          break;
        }
      }
    }
  }

  return errors;
}
