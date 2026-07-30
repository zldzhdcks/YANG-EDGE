import "server-only";

import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getKstToday } from "@/lib/datetime/kst";
import { getKboIdentityArtifactPath } from "@/lib/kbo/kbo-identity-artifact-path";
import { getKboIdentityProvider } from "@/lib/kbo/kbo-identity-feature-flag";
import type {
  KboOperatorGameMarketInput,
  KboOperatorMarketInput,
  KboOperatorMarketInputV2,
} from "@/lib/kbo/operator-input-v2/kbo-operator-market-input-types";
import type { KboLineupConfirmationDocument } from "@/lib/kbo/operator-lineup-confirmation-types";
import type { KboScheduleResultIdentityDocument, KboScheduleResultIdentityRow } from "@/lib/kbo/schedule-result-identity-types";

type ParsedLineupRow = {
  slot: number;
  playerName: string;
  position: string | null;
};

export type KboOperatorInputGameView = {
  internalGameId: string;
  providerGameId: string | null;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  startTimeKst: string | null;
  domesticHomeOdds: string;
  domesticAwayOdds: string;
  overseasHomeOdds: string;
  overseasAwayOdds: string;
  oddsSourceNote: string;
  oddsConfirmed: boolean;
  homeStarter: string | null;
  awayStarter: string | null;
  homeLineupStatus: string;
  awayLineupStatus: string;
  homeLineupPaste: string;
  awayLineupPaste: string;
  homeLineupSourceNote: string;
  awayLineupSourceNote: string;
  homeLineupParsedCount: number;
  awayLineupParsedCount: number;
};

export type KboOperatorInputBridgeData = {
  dateKst: string;
  schedulePath: string | null;
  marketsPath: string;
  lineupPath: string;
  scheduleExists: boolean;
  games: KboOperatorInputGameView[];
  inputStatus: {
    domestic: "PASS" | "PARTIAL" | "MISSING";
    overseas: "PASS" | "PARTIAL" | "MISSING";
    lineup: "PASS" | "PARTIAL" | "MISSING";
  };
  builderCommand: string;
};

export type SaveMarketsPayload = {
  dateKst: string;
  sourceLabel: string;
  enteredBy: string;
  games: Array<{
    internalGameId: string;
    providerGameId: string | null;
    homeTeam: string;
    awayTeam: string;
    canonicalHomeTeamId: string | null;
    canonicalAwayTeamId: string | null;
    startTimeKst: string | null;
    domesticHomeOdds: string;
    domesticAwayOdds: string;
    overseasHomeOdds: string;
    overseasAwayOdds: string;
    sourceNote: string;
    confirmed: boolean;
  }>;
};

export type SaveLineupPayload = {
  dateKst: string;
  games: Array<{
    internalGameId: string;
    providerGameId: string | null;
    homeTeam: string;
    awayTeam: string;
    startTimeKst: string | null;
    homeSourceNote: string;
    awaySourceNote: string;
    homeVerified: boolean;
    awayVerified: boolean;
    homePaste: string;
    awayPaste: string;
  }>;
};

export type SaveResult = {
  ok: boolean;
  path: string | null;
  savedAtKst: string | null;
  status: "PASS" | "PARTIAL" | "FAIL";
  message: string;
  errors: string[];
};

function kstNowIso(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = `${kst.getUTCMonth() + 1}`.padStart(2, "0");
  const dd = `${kst.getUTCDate()}`.padStart(2, "0");
  const hh = `${kst.getUTCHours()}`.padStart(2, "0");
  const mi = `${kst.getUTCMinutes()}`.padStart(2, "0");
  const ss = `${kst.getUTCSeconds()}`.padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+09:00`;
}

function formatKstHm(iso: string): string {
  if (!iso) return "";
  const dt = new Date(iso);
  return dt.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

function normalizeOddsInput(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 1) return null;
  return Number(n.toFixed(2));
}

function makeOperatorGameId(dateKst: string, homeTeam: string, awayTeam: string): string {
  return `KBO-${dateKst.replace(/-/g, "")}-${homeTeam}-${awayTeam}`
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9가-힣-]/g, "")
    .toUpperCase();
}

function makeSelection(label: string, code: "HOME" | "AWAY", odds: number) {
  return {
    selectionCode: code,
    selectionLabel: label,
    odds,
    reviewStatus: "VERIFIED" as const,
  };
}

function buildDomesticMarket(game: SaveMarketsPayload["games"][number]): KboOperatorMarketInput | null {
  const home = normalizeOddsInput(game.domesticHomeOdds);
  const away = normalizeOddsInput(game.domesticAwayOdds);
  if (home == null || away == null) return null;
  return {
    operatorMarketId: `${game.internalGameId}-domestic-moneyline`,
    marketType: "MONEYLINE_2WAY",
    period: "FULL_GAME",
    line: null,
    displayLabel: "승패",
    reviewStatus: game.confirmed ? "VERIFIED" : "DRAFT",
    selections: [
      makeSelection("홈 승", "HOME", home),
      makeSelection("원정 승", "AWAY", away),
    ],
    notes: game.sourceNote || undefined,
  };
}

function buildManualOverseasMarket(game: SaveMarketsPayload["games"][number]): KboOperatorMarketInput | null {
  const home = normalizeOddsInput(game.overseasHomeOdds);
  const away = normalizeOddsInput(game.overseasAwayOdds);
  if (home == null || away == null) return null;
  return {
    operatorMarketId: `${game.internalGameId}-overseas-moneyline`,
    marketType: "OTHER",
    period: "FULL_GAME",
    line: null,
    displayLabel: "해외 승패",
    reviewStatus: game.confirmed ? "VERIFIED" : "DRAFT",
    selections: [
      makeSelection("홈 승", "HOME", home),
      makeSelection("원정 승", "AWAY", away),
    ],
    notes: "MANUAL_OVERSEAS_INPUT",
  };
}

function parseLineupPaste(text: string): { parsed: ParsedLineupRow[]; invalid: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed: ParsedLineupRow[] = [];
  const invalid: string[] = [];
  for (const line of lines) {
    const match = line.match(/^(\d{1,2})[.)]?\s+(.+?)(?:\s+([^\s].*))?$/u);
    if (!match) {
      invalid.push(line);
      continue;
    }
    const slot = Number(match[1]);
    if (!Number.isInteger(slot) || slot < 1 || slot > 9) {
      invalid.push(line);
      continue;
    }
    const playerName = (match[2] ?? "").trim();
    const position = (match[3] ?? "").trim() || null;
    if (!playerName) {
      invalid.push(line);
      continue;
    }
    parsed.push({ slot, playerName, position });
  }
  return { parsed, invalid };
}

function lineupStatusForEntries(count: number, verified: boolean): "CONFIRMED" | "PARTIAL" | "NOT_CONFIRMED" {
  if (count >= 9 && verified) return "CONFIRMED";
  if (count > 0) return "PARTIAL";
  return "NOT_CONFIRMED";
}

function documentStatusFromGames(
  games: KboLineupConfirmationDocument["games"],
  totalScheduleGames: number,
): "CONFIRMED" | "PARTIAL" | "NOT_CONFIRMED" {
  if (games.length === 0) return "NOT_CONFIRMED";
  const allConfirmed = games.every((game) => game.reviewStatus === "CONFIRMED");
  if (allConfirmed && games.length === totalScheduleGames) return "CONFIRMED";
  return "PARTIAL";
}

export function getKboOperatorInputPaths(dateKst: string): {
  schedulePath: string;
  marketsPath: string;
  lineupPath: string;
} {
  const cwd = process.cwd();
  return {
    schedulePath: getKboIdentityArtifactPath(dateKst, getKboIdentityProvider(), cwd),
    marketsPath: path.join(cwd, "data", "operator-input", "kbo", `${dateKst}-operator-markets-v2.json`),
    lineupPath: path.join(cwd, "data", "operator-input", "kbo", `${dateKst}-lineup-confirmation-v1.json`),
  };
}

function mapScheduleRowToView(
  row: KboScheduleResultIdentityRow,
  marketDoc: KboOperatorMarketInputV2 | null,
  lineupDoc: KboLineupConfirmationDocument | null,
  starterDoc: Record<string, unknown> | null,
): KboOperatorInputGameView {
  const gameMarkets = marketDoc?.games.find((game) => game.internalGameId === row.internalGameId);
  const domestic = gameMarkets?.markets.find(
    (market) => market.marketType === "MONEYLINE_2WAY" && market.period === "FULL_GAME",
  );
  const manualOverseas = gameMarkets?.markets.find(
    (market) => market.marketType === "OTHER" && market.period === "FULL_GAME" && market.displayLabel === "해외 승패",
  );
  const getOdds = (market: KboOperatorMarketInput | undefined, code: "HOME" | "AWAY") =>
    market?.selections.find((selection) => selection.selectionCode === code)?.odds;
  const lineupGame = lineupDoc?.games.find((game) => game.internalGameId === row.internalGameId);
  const starterGames = Array.isArray(starterDoc?.games) ? starterDoc.games : [];
  const starterGame = starterGames.find((game) => typeof game === "object" && game && (game as { internalGameId?: string }).internalGameId === row.internalGameId) as
    | { homeStarter?: { playerName?: string }; awayStarter?: { playerName?: string } }
    | undefined;
  const homeLineupText = lineupGame?.homeLineup.batters
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((batter) => `${batter.slot} ${batter.playerName}${batter.position ? ` ${batter.position}` : ""}`)
    .join("\n") ?? "";
  const awayLineupText = lineupGame?.awayLineup.batters
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((batter) => `${batter.slot} ${batter.playerName}${batter.position ? ` ${batter.position}` : ""}`)
    .join("\n") ?? "";
  return {
    internalGameId: row.internalGameId,
    providerGameId: row.providerGameId,
    homeTeam: row.homeTeam.canonicalNameKo ?? row.homeTeam.providerName,
    awayTeam: row.awayTeam.canonicalNameKo ?? row.awayTeam.providerName,
    homeTeamId: row.homeTeam.canonicalTeamId,
    awayTeamId: row.awayTeam.canonicalTeamId,
    startTimeKst: row.time.startTimeKst,
    domesticHomeOdds: getOdds(domestic, "HOME")?.toString() ?? "",
    domesticAwayOdds: getOdds(domestic, "AWAY")?.toString() ?? "",
    overseasHomeOdds: getOdds(manualOverseas, "HOME")?.toString() ?? "",
    overseasAwayOdds: getOdds(manualOverseas, "AWAY")?.toString() ?? "",
    oddsSourceNote: domestic?.notes ?? manualOverseas?.notes ?? "",
    oddsConfirmed: domestic?.reviewStatus === "VERIFIED" || manualOverseas?.reviewStatus === "VERIFIED",
    homeStarter: starterGame?.homeStarter?.playerName ?? null,
    awayStarter: starterGame?.awayStarter?.playerName ?? null,
    homeLineupStatus: lineupGame?.homeLineup.status ?? "NOT_CONFIRMED",
    awayLineupStatus: lineupGame?.awayLineup.status ?? "NOT_CONFIRMED",
    homeLineupPaste: homeLineupText,
    awayLineupPaste: awayLineupText,
    homeLineupSourceNote: lineupGame?.homeLineup.sourceNote ?? "",
    awayLineupSourceNote: lineupGame?.awayLineup.sourceNote ?? "",
    homeLineupParsedCount: lineupGame?.homeLineup.batters.length ?? 0,
    awayLineupParsedCount: lineupGame?.awayLineup.batters.length ?? 0,
  };
}

function computeInputStatus(games: KboOperatorInputGameView[]): KboOperatorInputBridgeData["inputStatus"] {
  const domesticCount = games.filter((game) => normalizeOddsInput(game.domesticHomeOdds) != null && normalizeOddsInput(game.domesticAwayOdds) != null).length;
  const overseasCount = games.filter((game) => normalizeOddsInput(game.overseasHomeOdds) != null && normalizeOddsInput(game.overseasAwayOdds) != null).length;
  const lineupTeamsConfirmed = games.flatMap((game) => [game.homeLineupStatus, game.awayLineupStatus]);
  const lineupConfirmed = lineupTeamsConfirmed.filter((status) => status === "CONFIRMED").length;
  const lineupPartial = lineupTeamsConfirmed.filter((status) => status === "PARTIAL").length;
  const gameCount = games.length;
  const teamCount = gameCount * 2;
  return {
    domestic:
      domesticCount === 0 ? "MISSING" : domesticCount === gameCount ? "PASS" : "PARTIAL",
    overseas:
      overseasCount === 0 ? "MISSING" : overseasCount === gameCount ? "PASS" : "PARTIAL",
    lineup:
      lineupConfirmed === 0 && lineupPartial === 0
        ? "MISSING"
        : lineupConfirmed === teamCount
          ? "PASS"
          : "PARTIAL",
  };
}

export async function loadKboOperatorInputBridgeData(
  dateKst: string = getKstToday(),
): Promise<KboOperatorInputBridgeData> {
  const { schedulePath, marketsPath, lineupPath } = getKboOperatorInputPaths(dateKst);
  const starterPath = path.join(process.cwd(), "data", "operator-input", "kbo", `${dateKst}-starter-confirmation-v1.json`);
  const scheduleDoc = await readJson<KboScheduleResultIdentityDocument>(schedulePath);
  const marketDoc = await readJson<KboOperatorMarketInputV2>(marketsPath);
  const lineupDoc = await readJson<KboLineupConfirmationDocument>(lineupPath);
  const starterDoc = await readJson<Record<string, unknown>>(starterPath);
  const rows = scheduleDoc?.rows ?? [];
  const games = rows.map((row) => mapScheduleRowToView(row, marketDoc, lineupDoc, starterDoc));
  return {
    dateKst,
    schedulePath: (await exists(schedulePath)) ? path.relative(process.cwd(), schedulePath) : null,
    marketsPath: path.relative(process.cwd(), marketsPath),
    lineupPath: path.relative(process.cwd(), lineupPath),
    scheduleExists: rows.length > 0,
    games,
    inputStatus: computeInputStatus(games),
    builderCommand: `npm run research:kbo-daily -- ${dateKst}`,
  };
}

function validateMarketPayloadAgainstSchedule(
  payload: SaveMarketsPayload,
  scheduleRows: KboScheduleResultIdentityRow[],
): string[] {
  const errors: string[] = [];
  const scheduleMap = new Map(scheduleRows.map((row) => [row.internalGameId, row] as const));
  if (!payload.dateKst) errors.push("DATE_REQUIRED");
  for (const game of payload.games) {
    const row = scheduleMap.get(game.internalGameId);
    if (!row) {
      errors.push(`SCHEDULE_GAME_NOT_FOUND:${game.internalGameId}`);
      continue;
    }
    const expectedHome = row.homeTeam.canonicalNameKo ?? row.homeTeam.providerName;
    const expectedAway = row.awayTeam.canonicalNameKo ?? row.awayTeam.providerName;
    if (expectedHome !== game.homeTeam || expectedAway !== game.awayTeam) {
      errors.push(`TEAM_MISMATCH:${game.internalGameId}`);
    }
    const domHome = game.domesticHomeOdds.trim();
    const domAway = game.domesticAwayOdds.trim();
    const ovsHome = game.overseasHomeOdds.trim();
    const ovsAway = game.overseasAwayOdds.trim();
    const domesticSome = domHome !== "" || domAway !== "";
    const overseasSome = ovsHome !== "" || ovsAway !== "";
    if (domesticSome && (normalizeOddsInput(domHome) == null || normalizeOddsInput(domAway) == null)) {
      errors.push(`INVALID_DOMESTIC_ODDS:${game.internalGameId}`);
    }
    if (overseasSome && (normalizeOddsInput(ovsHome) == null || normalizeOddsInput(ovsAway) == null)) {
      errors.push(`INVALID_OVERSEAS_ODDS:${game.internalGameId}`);
    }
  }
  return errors;
}

export async function saveKboOperatorMarkets(payload: SaveMarketsPayload): Promise<SaveResult> {
  const { schedulePath, marketsPath } = getKboOperatorInputPaths(payload.dateKst);
  const scheduleDoc = await readJson<KboScheduleResultIdentityDocument>(schedulePath);
  if (!scheduleDoc) {
    return {
      ok: false,
      path: null,
      savedAtKst: null,
      status: "FAIL",
      message: "Schedule artifact not found",
      errors: ["SCHEDULE_REQUIRED"],
    };
  }
  const errors = validateMarketPayloadAgainstSchedule(payload, scheduleDoc.rows);
  const hasAnyData = payload.games.some((game) =>
    game.domesticHomeOdds.trim() ||
    game.domesticAwayOdds.trim() ||
    game.overseasHomeOdds.trim() ||
    game.overseasAwayOdds.trim(),
  );
  if (!hasAnyData) errors.push("EMPTY_MARKET_SAVE_NOT_ALLOWED");
  if (errors.length > 0) {
    return {
      ok: false,
      path: null,
      savedAtKst: null,
      status: "FAIL",
      message: "Validation failed",
      errors,
    };
  }

  const existing = (await readJson<KboOperatorMarketInputV2>(marketsPath)) ?? null;
  const savedAt = kstNowIso();
  const games: KboOperatorGameMarketInput[] = payload.games.map((game) => {
    const domestic = buildDomesticMarket(game);
    const overseas = buildManualOverseasMarket(game);
    const markets = [domestic, overseas].filter((market): market is KboOperatorMarketInput => market != null);
    const reviewStatus: "DRAFT" | "VERIFIED" = game.confirmed ? "VERIFIED" : "DRAFT";
    return {
      operatorGameId: makeOperatorGameId(payload.dateKst, game.homeTeam, game.awayTeam),
      internalGameId: game.internalGameId,
      providerGameId: game.providerGameId,
      homeTeamText: game.homeTeam,
      awayTeamText: game.awayTeam,
      canonicalHomeTeamId: game.canonicalHomeTeamId,
      canonicalAwayTeamId: game.canonicalAwayTeamId,
      startTimeKst: game.startTimeKst ?? "",
      mappingStatus: "MATCHED" as const,
      reviewStatus,
      blockingReasons: [],
      markets,
      notes: game.sourceNote || undefined,
    };
  }).filter((game) => game.markets.length > 0);

  const reviewStatus =
    games.length > 0 && games.every((game) => game.reviewStatus === "VERIFIED")
      ? "VERIFIED"
      : "DRAFT";
  const doc: KboOperatorMarketInputV2 = {
    dateKst: payload.dateKst,
    round: existing?.round ?? "",
    capturedAt: savedAt,
    enteredAt: savedAt,
    enteredBy: payload.enteredBy || "operator",
    sourceLabel: payload.sourceLabel || "OPERATOR_INPUT_BRIDGE",
    inputMethod: "MANUAL",
    reviewStatus,
    games,
    metadata: {
      sourceType: "SCREENSHOT_TRANSCRIPTION",
      screenshotCount: existing?.metadata.screenshotCount ?? null,
      notes: "Saved from internal research operator input bridge.",
    },
  };
  await writeJsonAtomic(marketsPath, doc);
  const inputStatus = computeInputStatus((await loadKboOperatorInputBridgeData(payload.dateKst)).games);
  return {
    ok: true,
    path: path.relative(process.cwd(), marketsPath),
    savedAtKst: formatKstHm(savedAt),
    status: inputStatus.domestic === "PASS" && inputStatus.overseas === "PASS" ? "PASS" : "PARTIAL",
    message: "저장 완료",
    errors: [],
  };
}

function buildLineupTeamEntry(
  side: "HOME" | "AWAY",
  team: string,
  paste: string,
  sourceNote: string,
  operatorVerified: boolean,
  enteredAt: string,
): { entry: KboLineupConfirmationDocument["games"][number]["homeLineup"]; invalid: string[] } {
  const { parsed, invalid } = parseLineupPaste(paste);
  const dedupSlot = new Set<number>();
  const dedupPlayers = new Set<string>();
  const batters = [];
  for (const row of parsed) {
    const key = row.playerName.trim().toLowerCase();
    if (dedupSlot.has(row.slot)) {
      invalid.push(`${row.slot} ${row.playerName}`);
      continue;
    }
    if (dedupPlayers.has(key)) {
      invalid.push(`${row.slot} ${row.playerName}`);
      continue;
    }
    dedupSlot.add(row.slot);
    dedupPlayers.add(key);
    batters.push({
      slot: row.slot,
      playerName: row.playerName,
      position: row.position,
      starter: true,
    });
  }
  batters.sort((a, b) => a.slot - b.slot);
  const status = lineupStatusForEntries(batters.length, operatorVerified);
  return {
    entry: {
      side,
      team,
      status,
      operatorVerified,
      enteredAt: batters.length > 0 ? enteredAt : null,
      sourceNote: sourceNote || null,
      batters,
    },
    invalid,
  };
}

export async function saveKboLineupConfirmation(payload: SaveLineupPayload): Promise<SaveResult> {
  const { schedulePath, lineupPath } = getKboOperatorInputPaths(payload.dateKst);
  const scheduleDoc = await readJson<KboScheduleResultIdentityDocument>(schedulePath);
  if (!scheduleDoc) {
    return {
      ok: false,
      path: null,
      savedAtKst: null,
      status: "FAIL",
      message: "Schedule artifact not found",
      errors: ["SCHEDULE_REQUIRED"],
    };
  }
  const scheduleMap = new Map(scheduleDoc.rows.map((row) => [row.internalGameId, row] as const));
  const savedAt = kstNowIso();
  const errors: string[] = [];
  const games: KboLineupConfirmationDocument["games"] = [];

  for (const game of payload.games) {
    const row = scheduleMap.get(game.internalGameId);
    if (!row) {
      errors.push(`SCHEDULE_GAME_NOT_FOUND:${game.internalGameId}`);
      continue;
    }
    const expectedHome = row.homeTeam.canonicalNameKo ?? row.homeTeam.providerName;
    const expectedAway = row.awayTeam.canonicalNameKo ?? row.awayTeam.providerName;
    if (expectedHome !== game.homeTeam || expectedAway !== game.awayTeam) {
      errors.push(`TEAM_MISMATCH:${game.internalGameId}`);
      continue;
    }
    const homeBuilt = buildLineupTeamEntry("HOME", game.homeTeam, game.homePaste, game.homeSourceNote, game.homeVerified, savedAt);
    const awayBuilt = buildLineupTeamEntry("AWAY", game.awayTeam, game.awayPaste, game.awaySourceNote, game.awayVerified, savedAt);
    if (homeBuilt.invalid.length > 0) {
      errors.push(`HOME_LINEUP_PARSE_ERROR:${game.internalGameId}:${homeBuilt.invalid.join("|")}`);
    }
    if (awayBuilt.invalid.length > 0) {
      errors.push(`AWAY_LINEUP_PARSE_ERROR:${game.internalGameId}:${awayBuilt.invalid.join("|")}`);
    }
    const hasAny = homeBuilt.entry.batters.length > 0 || awayBuilt.entry.batters.length > 0;
    if (!hasAny) continue;
    const reviewStatus =
      homeBuilt.entry.status === "CONFIRMED" && awayBuilt.entry.status === "CONFIRMED"
        ? "CONFIRMED"
        : homeBuilt.entry.status !== "NOT_CONFIRMED" || awayBuilt.entry.status !== "NOT_CONFIRMED"
          ? "PARTIAL"
          : "NOT_CONFIRMED";
    games.push({
      lineupInputId: `${game.internalGameId}-lineup`,
      internalGameId: game.internalGameId,
      providerGameId: game.providerGameId,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      scheduledStartTimeKst: game.startTimeKst,
      reviewStatus,
      enteredAt: savedAt,
      homeLineup: homeBuilt.entry,
      awayLineup: awayBuilt.entry,
    });
  }

  if (errors.length > 0) {
    return {
      ok: false,
      path: null,
      savedAtKst: null,
      status: "FAIL",
      message: "Validation failed",
      errors,
    };
  }

  const existing = (await readJson<KboLineupConfirmationDocument>(lineupPath)) ?? null;
  const doc: KboLineupConfirmationDocument = {
    schemaVersion: "kbo-lineup-confirmation-v1",
    targetDateKst: payload.dateKst,
    sourceType: "OPERATOR_VERIFIED",
    reviewStatus: documentStatusFromGames(games, scheduleDoc.rows.length),
    createdAt: existing?.createdAt ?? savedAt,
    updatedAt: savedAt,
    games,
    metadata: {
      inputMethod: "MANUAL",
      notes: "Saved from internal research operator input bridge.",
    },
  };
  await writeJsonAtomic(lineupPath, doc);
  const inputStatus = computeInputStatus((await loadKboOperatorInputBridgeData(payload.dateKst)).games);
  return {
    ok: true,
    path: path.relative(process.cwd(), lineupPath),
    savedAtKst: formatKstHm(savedAt),
    status: inputStatus.lineup === "PASS" ? "PASS" : "PARTIAL",
    message: "저장 완료",
    errors: [],
  };
}
