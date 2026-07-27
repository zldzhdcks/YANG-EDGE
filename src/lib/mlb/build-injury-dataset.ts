/**
 * MLB Injury Dataset v1 builder — PRE_GAME_ROSTER only.
 *
 * - 40Man roster status codes + optional note (no /injuries endpoint)
 * - Supplemental IL transactions (typeCode SC) when matched by player/team/date
 * - One row per injury-listed player per team per game
 * - No lineup absence inference, no expectedReturn/severity/MRI
 * - No Engine / Score / Framework imports
 */
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { getKstDateString } from "../datetime/kst";
import {
  createCacheUsage,
  getRawStatsJson,
  type CacheUsageStats,
} from "./research-stats-cache";
import {
  INJURY_BUILDER_VERSION,
  INJURY_COLLECTION_PHASE,
  INJURY_DATASET_ID,
  INJURY_PROVIDER_ID,
  INJURY_SCHEMA_VERSION,
  type BuildInjuryDatasetResult,
  type InjuryDataSource,
  type InjuryDatasetDocument,
  type InjuryDatasetRow,
} from "./injury-dataset-types";

const TRANSACTION_LOOKBACK_DAYS = 30;

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

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function addDaysKst(dateKst: string, delta: number): string {
  const ms = Date.parse(`${dateKst}T12:00:00+09:00`) + delta * 86400000;
  return getKstDateString(new Date(ms));
}

function cutoffOfficialDate(cutoffTime: string | null, dateKst: string): string {
  if (cutoffTime && /^\d{4}-\d{2}-\d{2}/.test(cutoffTime)) {
    return cutoffTime.slice(0, 10);
  }
  return dateKst;
}

/** MLB 40Man injured-list style codes observed in audit (D7/D10/D15/D60). */
function isInjuryListedStatus(code: string): boolean {
  return /^D\d+$/.test(code);
}

type TeamSlot = {
  gameId: string;
  gamePk: number;
  teamId: number;
  teamName: string;
  side: "home" | "away";
  cutoffTime: string | null;
};

type RosterPlayer = {
  playerId: number;
  playerName: string;
  statusCode: string;
  statusDescription: string | null;
  injuryNote: string | null;
};

type ParsedTransaction = {
  id: number;
  playerId: number;
  playerName: string;
  teamId: number | null;
  date: string;
  effectiveDate: string;
  typeCode: string;
  typeDesc: string | null;
  description: string | null;
};

async function loadTeamSlots(dateKst: string): Promise<TeamSlot[]> {
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
      `starter dataset missing (join for gamePk/teamId): ${starterPath}`,
    );
  }

  const pred = JSON.parse(await readFile(predPath, "utf8")) as {
    predictions?: unknown[];
  };
  const starter = JSON.parse(await readFile(starterPath, "utf8")) as {
    rows?: unknown[];
  };

  const predGameIds = new Set<string>();
  for (const raw of pred.predictions ?? []) {
    const p = asRecord(raw);
    const gameId = asString(p?.gameId);
    if (gameId) predGameIds.add(gameId);
  }

  const slots: TeamSlot[] = [];
  for (const raw of starter.rows ?? []) {
    const r = asRecord(raw);
    if (!r) continue;
    if (asString(r.predictionDate) !== dateKst) continue;
    const gameId = asString(r.gameId);
    const gamePk = asNumber(r.gamePk);
    const teamId = asNumber(r.teamId);
    const side = asString(r.side);
    if (!gameId || gamePk == null || teamId == null) continue;
    if (!predGameIds.has(gameId)) continue;
    if (side !== "home" && side !== "away") continue;

    slots.push({
      gameId,
      gamePk,
      teamId,
      teamName:
        side === "home"
          ? (asString(r.homeTeam) ?? "")
          : (asString(r.awayTeam) ?? ""),
      side,
      cutoffTime: asString(r.cutoffTime),
    });
  }

  return slots.sort(
    (a, b) => a.gamePk - b.gamePk || a.teamId - b.teamId,
  );
}

async function loadFortyManRoster(
  teamId: number,
  usage: CacheUsageStats,
): Promise<RosterPlayer[]> {
  const body = asRecord(
    await getRawStatsJson(
      `/api/v1/teams/${teamId}/roster?rosterType=40Man`,
      usage,
    ),
  );
  const roster = Array.isArray(body?.roster) ? body!.roster : [];
  const players: RosterPlayer[] = [];

  for (const raw of roster) {
    const row = asRecord(raw);
    if (!row) continue;
    const person = asRecord(row.person);
    const status = asRecord(row.status);
    const playerId = asNumber(person?.id);
    const playerName = asString(person?.fullName);
    const statusCode = asString(status?.code);
    if (playerId == null || !playerName || !statusCode) continue;

    players.push({
      playerId,
      playerName,
      statusCode,
      statusDescription: asString(status?.description),
      injuryNote: asString(row.note),
    });
  }

  return players;
}

function parseTransaction(raw: unknown): ParsedTransaction | null {
  const row = asRecord(raw);
  if (!row) return null;

  const id = asNumber(row.id);
  const person = asRecord(row.person);
  const playerId = asNumber(person?.id);
  const playerName = asString(person?.fullName);
  const date = asString(row.date);
  const effectiveDate = asString(row.effectiveDate) ?? date;
  const typeCode = asString(row.typeCode);
  const toTeam = asRecord(row.toTeam);
  const teamId = asNumber(toTeam?.id);

  if (id == null || playerId == null || !playerName || !date || !typeCode) {
    return null;
  }

  return {
    id,
    playerId,
    playerName,
    teamId,
    date,
    effectiveDate: effectiveDate ?? date,
    typeCode,
    typeDesc: asString(row.typeDesc),
    description: asString(row.description),
  };
}

async function loadTransactionsInWindow(
  startDate: string,
  endDate: string,
  usage: CacheUsageStats,
): Promise<ParsedTransaction[]> {
  const body = asRecord(
    await getRawStatsJson(
      `/api/v1/transactions?sportId=1&startDate=${startDate}&endDate=${endDate}`,
      usage,
    ),
  );
  const txs: ParsedTransaction[] = [];
  for (const raw of Array.isArray(body?.transactions) ? body!.transactions : []) {
    const parsed = parseTransaction(raw);
    if (parsed) txs.push(parsed);
  }
  return txs;
}

function findLatestTransaction(
  transactions: ParsedTransaction[],
  playerId: number,
  teamId: number,
  cutoffDate: string,
): ParsedTransaction | null {
  let latest: ParsedTransaction | null = null;
  for (const tx of transactions) {
    if (tx.playerId !== playerId) continue;
    if (tx.teamId != null && tx.teamId !== teamId) continue;
    if (tx.effectiveDate > cutoffDate) continue;
    if (!latest || tx.effectiveDate > latest.effectiveDate) {
      latest = tx;
    } else if (
      tx.effectiveDate === latest.effectiveDate &&
      tx.id > latest.id
    ) {
      latest = tx;
    }
  }
  return latest;
}

function hashableRowBody(row: InjuryDatasetRow): Record<string, unknown> {
  return {
    gameId: row.gameId,
    gamePk: row.gamePk,
    teamId: row.teamId,
    side: row.side,
    gameDate: row.gameDate,
    collectionPhase: row.collectionPhase,
    playerId: row.playerId,
    rosterStatusCode: row.rosterStatusCode,
    rosterStatusDescription: row.rosterStatusDescription,
    injuryListed: row.injuryListed,
    injuryNote: row.injuryNote,
    transactionType: row.transactionType,
    transactionDate: row.transactionDate,
    source: row.source,
    cutoffTime: row.cutoffTime,
    missing: row.missing,
    warnings: row.warnings,
  };
}

export function assertInjuryDatasetIntegrity(
  document: InjuryDatasetDocument,
): string[] {
  const issues: string[] = [];
  if (document.meta.engineAdmission !== "PROHIBITED") {
    issues.push("engineAdmission must be PROHIBITED");
  }
  for (const row of document.rows) {
    if (row.collectionPhase !== INJURY_COLLECTION_PHASE) {
      issues.push(`${row.gameId}/${row.playerId}: invalid collectionPhase`);
    }
    if (row.injuryListed !== true) {
      issues.push(`${row.gameId}/${row.playerId}: injuryListed must be true`);
    }
    if (!isInjuryListedStatus(row.rosterStatusCode)) {
      issues.push(
        `${row.gameId}/${row.playerId}: rosterStatusCode ${row.rosterStatusCode} not injury-listed`,
      );
    }
  }
  return issues;
}

export async function buildInjuryDatasetV1(input: {
  dateKst: string;
  predictionRaw: string;
}): Promise<BuildInjuryDatasetResult> {
  const predictionHash = sha256(input.predictionRaw);
  const usage = createCacheUsage();
  const slots = await loadTeamSlots(input.dateKst);

  const uniqueTeamIds = [...new Set(slots.map((s) => s.teamId))].sort(
    (a, b) => a - b,
  );
  const txStart = addDaysKst(input.dateKst, -TRANSACTION_LOOKBACK_DAYS);
  const transactions = await loadTransactionsInWindow(
    txStart,
    input.dateKst,
    usage,
  );

  const rosterByTeam = new Map<number, RosterPlayer[]>();
  let rosterCollected = 0;
  for (const teamId of uniqueTeamIds) {
    const roster = await loadFortyManRoster(teamId, usage);
    rosterByTeam.set(teamId, roster);
    rosterCollected += 1;
  }

  const generatedAt = new Date().toISOString();
  const rows: InjuryDatasetRow[] = [];
  let rowsWithTransaction = 0;

  for (const slot of slots) {
    const roster = rosterByTeam.get(slot.teamId) ?? [];
    const cutoffDate = cutoffOfficialDate(slot.cutoffTime, input.dateKst);

    for (const player of roster) {
      if (!isInjuryListedStatus(player.statusCode)) continue;

      const missing: string[] = [];
      const warnings: string[] = [];
      const tx = findLatestTransaction(
        transactions,
        player.playerId,
        slot.teamId,
        cutoffDate,
      );

      let source: InjuryDataSource = "mlb-stats-api-40man";
      let transactionType: string | null = null;
      let transactionDate: string | null = null;

      if (tx) {
        source = "mlb-stats-api-40man+transactions";
        transactionType = tx.typeCode;
        transactionDate = tx.effectiveDate;
        rowsWithTransaction += 1;
      } else {
        missing.push("transactionType", "transactionDate");
        warnings.push("NO_MATCHING_TRANSACTION_IN_WINDOW");
      }

      if (!player.statusDescription) {
        missing.push("rosterStatusDescription");
      }
      if (!slot.cutoffTime) {
        missing.push("cutoffTime");
      }

      const rowInputHash = sha256(
        stableStringify({
          gameId: slot.gameId,
          teamId: slot.teamId,
          playerId: player.playerId,
          predictionHash,
          statusCode: player.statusCode,
          txStart,
          txEnd: input.dateKst,
          transactionId: tx?.id ?? null,
        }),
      );

      const rowBody: Omit<InjuryDatasetRow, "inputHash" | "resultHash"> = {
        schemaVersion: INJURY_SCHEMA_VERSION,
        builderVersion: INJURY_BUILDER_VERSION,
        generatedAt,
        gameDate: input.dateKst,
        gameId: slot.gameId,
        gamePk: slot.gamePk,
        teamId: slot.teamId,
        teamName: slot.teamName,
        side: slot.side,
        collectionPhase: INJURY_COLLECTION_PHASE,
        cutoffTime: slot.cutoffTime,
        researchOnly: true,
        legalStatus: "INTERNAL_RESEARCH_ONLY",
        engineUseAllowed: false,
        playerId: player.playerId,
        playerName: player.playerName,
        rosterStatusCode: player.statusCode,
        rosterStatusDescription: player.statusDescription,
        injuryListed: true,
        injuryNote: player.injuryNote,
        transactionType,
        transactionDate,
        source,
        missing: [...new Set(missing)].sort(),
        warnings: [...new Set(warnings)].sort(),
      };

      const resultHash = sha256(
        stableStringify(hashableRowBody(rowBody as InjuryDatasetRow)),
      );

      rows.push({
        ...rowBody,
        inputHash: rowInputHash,
        resultHash,
      });
    }
  }

  rows.sort(
    (a, b) =>
      a.gamePk - b.gamePk ||
      a.teamId - b.teamId ||
      a.playerId - b.playerId,
  );

  const uniqueGameIds = new Set(slots.map((s) => s.gameId));
  const inputHashSha256 = sha256(
    stableStringify({
      dateKst: input.dateKst,
      predictionHash,
      txStart,
      txEnd: input.dateKst,
      teamIds: uniqueTeamIds,
      rowInputs: rows.map((r) => r.inputHash).sort(),
    }),
  );
  const resultHashSha256 = sha256(
    stableStringify(rows.map((r) => hashableRowBody(r))),
  );

  const document: InjuryDatasetDocument = {
    meta: {
      datasetId: INJURY_DATASET_ID,
      schemaVersion: INJURY_SCHEMA_VERSION,
      builderVersion: INJURY_BUILDER_VERSION,
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
      provider: {
        id: INJURY_PROVIDER_ID,
        displayName: "MLB Stats API",
      },
      legal: {
        mlbStatsSource: "INTERNAL_RESEARCH_ONLY",
        publicRuntimeUseAllowed: false,
        commercialRuntimeUseAllowed: false,
        rawResponseInResearchCacheOnly: true,
        mlbHtmlCrawling: false,
        sportsDataIoScrambled: false,
        lineupAbsenceInference: false,
      },
      notes: [
        "PRE_GAME_ROSTER only — 40Man roster + transactions; no /injuries endpoint.",
        "injuryListed derived from roster status code only (D* codes).",
        "No expectedReturn, severity, MRI, or lineup-absence inference.",
        "Engine admission PROHIBITED.",
      ],
    },
    cacheUsage: {
      rawHit: usage.rawHit,
      rawMiss: usage.rawMiss,
      derivedHit: usage.derivedHit,
      derivedMiss: usage.derivedMiss,
      networkCalls: usage.networkCalls,
    },
    summary: {
      totalGames: uniqueGameIds.size,
      teamsOnSlate: uniqueTeamIds.length,
      rosterCollected,
      transactionsInWindow: transactions.length,
      injuryListedRows: rows.length,
      rowsWithTransaction,
    },
    rows,
  };

  return { document, usage };
}
