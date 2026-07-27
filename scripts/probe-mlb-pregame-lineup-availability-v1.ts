/**
 * Pre-game Lineup Availability Probe v1 — append-only research observations.
 *
 * - Schedule hydrate=lineups only for not-yet-started games (no post-game boxscore backfill)
 * - Starting slot rule: battingOrder /^[1-9]00$/ + isSubstitute !== true (when present)
 * - H-LU-003 observation link; hypothesis status unchanged
 * - Engine / prediction / Lineup Dataset v1 actual artifact: PROHIBITED mutation
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/probe-mlb-pregame-lineup-availability-v1.ts YYYY-MM-DD
 *   npm run research:lineup-probe -- YYYY-MM-DD
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../src/lib/datetime/kst";
import {
  createCacheUsage,
  getRawStatsJson,
  type CacheUsageStats,
} from "../src/lib/mlb/research-stats-cache";

const DATE =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-28";

const PROBE_VERSION = "mlb-pregame-lineup-availability-probe-v1";
const STARTER_ORDER_RE = /^[1-9]00$/;

type LineupAvailabilityStatus =
  | "COMPLETE"
  | "PARTIAL"
  | "NOT_AVAILABLE"
  | "GAME_STARTED"
  | "FINAL"
  | "SOURCE_ERROR";

type MinutesBucket =
  | "GT_180"
  | "M121_180"
  | "M91_120"
  | "M61_90"
  | "M31_60"
  | "M0_30"
  | "STARTED_OR_FINAL";

type ProbeRow = {
  gameDate: string;
  gameId: string;
  gamePk: number;
  homeTeam: string;
  awayTeam: string;
  startTimeKst: string;
  probedAt: string;
  minutesToStart: number | null;
  minutesBucket: MinutesBucket;
  homeLineupAvailability: LineupAvailabilityStatus;
  awayLineupAvailability: LineupAvailabilityStatus;
  homeStarterCount: number;
  awayStarterCount: number;
  bothSidesAvailable: boolean;
  sourceTimestamp: string | null;
  sourceEndpoint: string;
  scheduleDetailedState: string | null;
  cacheUsage: CacheUsageStats;
  warnings: string[];
  researchOnly: true;
  legalStatus: "INTERNAL_RESEARCH_ONLY";
  hypothesisObservation: "H-LU-003";
};

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

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function usScheduleDateFromInstant(isoOrDate: string | Date): string {
  const d =
    isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function kstStartInstant(dateKst: string, startTimeKst: string): Date | null {
  if (!/^\d{2}:\d{2}$/.test(startTimeKst)) return null;
  const d = new Date(`${dateKst}T${startTimeKst}:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function minutesBucket(
  minutes: number | null,
  excluded: boolean,
): MinutesBucket {
  if (excluded || minutes == null || minutes < 0) return "STARTED_OR_FINAL";
  if (minutes > 180) return "GT_180";
  if (minutes >= 121) return "M121_180";
  if (minutes >= 91) return "M91_120";
  if (minutes >= 61) return "M61_90";
  if (minutes >= 31) return "M31_60";
  return "M0_30";
}

function extractSideFromSchedulePlayers(
  playersRaw: unknown[],
): {
  availability: LineupAvailabilityStatus;
  starterCount: number;
  warnings: string[];
} {
  const warnings: string[] = [];
  const slots = new Set<number>();

  for (const raw of playersRaw) {
    const pl = asRecord(raw);
    if (!pl) continue;
    const gs = asRecord(pl.gameStatus);
    if (gs?.isSubstitute === true) continue;

    const battingOrderCode =
      pl.battingOrder != null ? String(pl.battingOrder) : null;
    if (battingOrderCode == null) continue;

    if (STARTER_ORDER_RE.test(battingOrderCode)) {
      slots.add(Number(battingOrderCode[0]));
      continue;
    }

    warnings.push(`NON_STARTER_ORDER_CODE:${battingOrderCode}`);
  }

  const starterCount = slots.size;
  let availability: LineupAvailabilityStatus = "NOT_AVAILABLE";
  if (starterCount === 9) {
    availability = "COMPLETE";
  } else if (starterCount > 0) {
    availability = "PARTIAL";
  } else if (playersRaw.length > 0) {
    warnings.push("PLAYERS_PRESENT_BUT_NO_*00_STARTER_SLOTS");
    availability = "PARTIAL";
  }

  return { availability, starterCount, warnings };
}

function isFinalState(input: {
  resultStatus: string | null;
  abstractState: string | null;
  detailedState: string | null;
}): boolean {
  if (input.resultStatus === "graded") return true;
  const abs = (input.abstractState ?? "").toLowerCase();
  const det = (input.detailedState ?? "").toLowerCase();
  return abs === "final" || det.includes("final") || det.includes("game over");
}

function isStartedState(input: {
  minutesToStart: number | null;
  abstractState: string | null;
  detailedState: string | null;
}): boolean {
  if (input.minutesToStart != null && input.minutesToStart < 0) return true;
  const abs = (input.abstractState ?? "").toLowerCase();
  const det = (input.detailedState ?? "").toLowerCase();
  return (
    abs === "live" ||
    det.includes("in progress") ||
    det.includes("warmup") ||
    det === "in progress"
  );
}

type ScheduleGame = {
  gamePk: number;
  gameDate: string | null;
  homeTeam: string;
  awayTeam: string;
  startTimeKst: string | null;
  abstractState: string | null;
  detailedState: string | null;
  homePlayers: unknown[];
  awayPlayers: unknown[];
  sourceFetchedAt: string | null;
};

async function loadScheduleGames(
  usDates: string[],
  usage: CacheUsageStats,
): Promise<Map<number, ScheduleGame>> {
  const byPk = new Map<number, ScheduleGame>();

  for (const usDate of usDates) {
    const hydrate = encodeURIComponent("probablePitcher,lineups");
    const pathQuery = `/api/v1/schedule?sportId=1&date=${encodeURIComponent(usDate)}&hydrate=${hydrate}`;
    let body: unknown;
    let fetchedAt: string | null = null;
    try {
      body = await getRawStatsJson(pathQuery, usage);
      const cachePath = path.join(
        process.cwd(),
        "data/cache/research/mlb/raw/statsapi",
        `api_v1_schedule_sportId_1_date_${usDate}_hydrate_probablePitcher_lineups.json`,
      );
      try {
        const cached = JSON.parse(await readFile(cachePath, "utf8")) as {
          meta?: { fetchedAt?: string };
        };
        fetchedAt = asString(cached.meta?.fetchedAt);
      } catch {
        fetchedAt = new Date().toISOString();
      }
    } catch (e) {
      throw new Error(
        `schedule fetch failed for ${usDate}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    const root = asRecord(body);
    const dates = Array.isArray(root?.dates) ? root.dates : [];
    for (const day of dates) {
      const dayRow = asRecord(day);
      const games = Array.isArray(dayRow?.games) ? dayRow.games : [];
      for (const raw of games) {
        const row = asRecord(raw);
        if (!row) continue;
        const gamePk = asNumber(row.gamePk);
        if (gamePk == null) continue;
        const gameDate = asString(row.gameDate);
        const kst = gameDate ? instantToKst(gameDate) : null;
        const teams = asRecord(row.teams);
        const home = asRecord(teams?.home);
        const away = asRecord(teams?.away);
        const status = asRecord(row.status);
        const lineups = asRecord(row.lineups);
        const homePlayers = Array.isArray(lineups?.homePlayers)
          ? lineups.homePlayers
          : [];
        const awayPlayers = Array.isArray(lineups?.awayPlayers)
          ? lineups.awayPlayers
          : [];

        byPk.set(gamePk, {
          gamePk,
          gameDate,
          homeTeam: asString(asRecord(home?.team)?.name) ?? "",
          awayTeam: asString(asRecord(away?.team)?.name) ?? "",
          startTimeKst: kst?.time ?? null,
          abstractState: asString(status?.abstractGameState),
          detailedState: asString(status?.detailedState),
          homePlayers,
          awayPlayers,
          sourceFetchedAt: fetchedAt,
        });
      }
    }
  }

  return byPk;
}

type PredGame = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  startTimeKst: string;
  resultStatus: string | null;
  gamePk: number | null;
  cutoffTime: string | null;
};

async function main() {
  console.log(`=== Pre-game Lineup Availability Probe v1 (${DATE}) ===`);

  const predPath = path.join(
    process.cwd(),
    "data/predictions/mlb",
    `${DATE}.json`,
  );
  const starterPath = path.join(
    process.cwd(),
    "data/research/mlb",
    `${DATE}-starter-dataset-v1.json`,
  );
  const probePath = path.join(
    process.cwd(),
    "data/research/mlb",
    `${DATE}-pregame-lineup-availability-probes-v1.json`,
  );
  const auditPath = path.join(
    process.cwd(),
    "data/audits",
    `${DATE}-pregame-lineup-availability-probe-v1.json`,
  );

  const predRawBefore = await readFile(predPath, "utf8");
  const predHashBefore = sha256(predRawBefore);

  if (!(await fileExists(starterPath))) {
    throw new Error(`starter dataset missing for gamePk join: ${starterPath}`);
  }

  const pred = JSON.parse(predRawBefore) as { predictions?: unknown[] };
  const starter = JSON.parse(await readFile(starterPath, "utf8")) as {
    rows?: unknown[];
  };

  const gamePkById = new Map<string, number>();
  const cutoffById = new Map<string, string | null>();
  for (const raw of starter.rows ?? []) {
    const r = asRecord(raw);
    if (!r) continue;
    const gameId = asString(r.gameId);
    const gamePk = asNumber(r.gamePk);
    if (gameId && gamePk != null) {
      gamePkById.set(gameId, gamePk);
      cutoffById.set(gameId, asString(r.cutoffTime));
    }
  }

  const predGames: PredGame[] = [];
  for (const raw of pred.predictions ?? []) {
    const p = asRecord(raw);
    if (!p) continue;
    const gameId = asString(p.gameId);
    if (!gameId) continue;
    predGames.push({
      gameId,
      homeTeam: asString(p.homeTeam) ?? "",
      awayTeam: asString(p.awayTeam) ?? "",
      startTimeKst: asString(p.startTimeKst) ?? "TBD",
      resultStatus: asString(p.resultStatus),
      gamePk: gamePkById.get(gameId) ?? null,
      cutoffTime: cutoffById.get(gameId) ?? null,
    });
  }

  if (predGames.length === 0) {
    throw new Error(`no prediction games for ${DATE}`);
  }

  const probedAt = new Date().toISOString();
  const probedAtKey = probedAt.slice(0, 19);

  const usDates = new Set<string>();
  for (const g of predGames) {
    if (g.cutoffTime) {
      usDates.add(usScheduleDateFromInstant(g.cutoffTime));
    }
    const start = kstStartInstant(DATE, g.startTimeKst);
    if (start) usDates.add(usScheduleDateFromInstant(start));
  }
  if (usDates.size === 0) {
    const d = new Date(`${DATE}T12:00:00+09:00`);
    usDates.add(usScheduleDateFromInstant(d));
    const prev = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    usDates.add(usScheduleDateFromInstant(prev));
  }

  const usage = createCacheUsage();
  const scheduleByPk = await loadScheduleGames([...usDates].sort(), usage);

  const newRows: ProbeRow[] = [];
  const runCache: CacheUsageStats = { ...usage };

  for (const g of predGames) {
    if (g.gamePk == null) {
      newRows.push({
        gameDate: DATE,
        gameId: g.gameId,
        gamePk: -1,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        startTimeKst: g.startTimeKst,
        probedAt,
        minutesToStart: null,
        minutesBucket: "STARTED_OR_FINAL",
        homeLineupAvailability: "SOURCE_ERROR",
        awayLineupAvailability: "SOURCE_ERROR",
        homeStarterCount: 0,
        awayStarterCount: 0,
        bothSidesAvailable: false,
        sourceTimestamp: null,
        sourceEndpoint:
          "GET /api/v1/schedule?hydrate=probablePitcher,lineups",
        scheduleDetailedState: null,
        cacheUsage: { ...runCache },
        warnings: ["GAMEPK_MISSING_FROM_STARTER_DATASET"],
        researchOnly: true,
        legalStatus: "INTERNAL_RESEARCH_ONLY",
        hypothesisObservation: "H-LU-003",
      });
      continue;
    }

    const sched = scheduleByPk.get(g.gamePk);
    const startInstant = kstStartInstant(DATE, g.startTimeKst);
    const minutesToStart =
      startInstant != null
        ? Math.round((startInstant.getTime() - Date.parse(probedAt)) / 60000)
        : null;

    const finalState = isFinalState({
      resultStatus: g.resultStatus,
      abstractState: sched?.abstractState ?? null,
      detailedState: sched?.detailedState ?? null,
    });
    const startedState =
      !finalState &&
      isStartedState({
        minutesToStart,
        abstractState: sched?.abstractState ?? null,
        detailedState: sched?.detailedState ?? null,
      });

    if (finalState) {
      newRows.push({
        gameDate: DATE,
        gameId: g.gameId,
        gamePk: g.gamePk,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        startTimeKst: g.startTimeKst,
        probedAt,
        minutesToStart,
        minutesBucket: "STARTED_OR_FINAL",
        homeLineupAvailability: "FINAL",
        awayLineupAvailability: "FINAL",
        homeStarterCount: 0,
        awayStarterCount: 0,
        bothSidesAvailable: false,
        sourceTimestamp: sched?.sourceFetchedAt ?? null,
        sourceEndpoint:
          "GET /api/v1/schedule?hydrate=probablePitcher,lineups",
        scheduleDetailedState: sched?.detailedState ?? null,
        cacheUsage: { ...runCache },
        warnings: ["EXCLUDED_FINAL_NO_PREGAME_PROBE"],
        researchOnly: true,
        legalStatus: "INTERNAL_RESEARCH_ONLY",
        hypothesisObservation: "H-LU-003",
      });
      continue;
    }

    if (startedState) {
      newRows.push({
        gameDate: DATE,
        gameId: g.gameId,
        gamePk: g.gamePk,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        startTimeKst: g.startTimeKst,
        probedAt,
        minutesToStart,
        minutesBucket: "STARTED_OR_FINAL",
        homeLineupAvailability: "GAME_STARTED",
        awayLineupAvailability: "GAME_STARTED",
        homeStarterCount: 0,
        awayStarterCount: 0,
        bothSidesAvailable: false,
        sourceTimestamp: sched?.sourceFetchedAt ?? null,
        sourceEndpoint:
          "GET /api/v1/schedule?hydrate=probablePitcher,lineups",
        scheduleDetailedState: sched?.detailedState ?? null,
        cacheUsage: { ...runCache },
        warnings: ["EXCLUDED_STARTED_NO_PREGAME_PROBE"],
        researchOnly: true,
        legalStatus: "INTERNAL_RESEARCH_ONLY",
        hypothesisObservation: "H-LU-003",
      });
      continue;
    }

    if (!sched) {
      newRows.push({
        gameDate: DATE,
        gameId: g.gameId,
        gamePk: g.gamePk,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        startTimeKst: g.startTimeKst,
        probedAt,
        minutesToStart,
        minutesBucket: minutesBucket(minutesToStart, false),
        homeLineupAvailability: "SOURCE_ERROR",
        awayLineupAvailability: "SOURCE_ERROR",
        homeStarterCount: 0,
        awayStarterCount: 0,
        bothSidesAvailable: false,
        sourceTimestamp: null,
        sourceEndpoint:
          "GET /api/v1/schedule?hydrate=probablePitcher,lineups",
        scheduleDetailedState: null,
        cacheUsage: { ...runCache },
        warnings: ["SCHEDULE_GAME_NOT_FOUND"],
        researchOnly: true,
        legalStatus: "INTERNAL_RESEARCH_ONLY",
        hypothesisObservation: "H-LU-003",
      });
      continue;
    }

    const homeEx = extractSideFromSchedulePlayers(sched.homePlayers);
    const awayEx = extractSideFromSchedulePlayers(sched.awayPlayers);
    const warnings = [
      ...homeEx.warnings.map((w) => `home:${w}`),
      ...awayEx.warnings.map((w) => `away:${w}`),
      "PREGAME_SCHEDULE_LINEUPS_ONLY_NO_BOXSCORE_BACKFILL",
    ];

    newRows.push({
      gameDate: DATE,
      gameId: g.gameId,
      gamePk: g.gamePk,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      startTimeKst: g.startTimeKst,
      probedAt,
      minutesToStart,
      minutesBucket: minutesBucket(minutesToStart, false),
      homeLineupAvailability: homeEx.availability,
      awayLineupAvailability: awayEx.availability,
      homeStarterCount: homeEx.starterCount,
      awayStarterCount: awayEx.starterCount,
      bothSidesAvailable:
        homeEx.availability === "COMPLETE" &&
        awayEx.availability === "COMPLETE",
      sourceTimestamp: sched.sourceFetchedAt,
      sourceEndpoint: "GET /api/v1/schedule?hydrate=probablePitcher,lineups",
      scheduleDetailedState: sched.detailedState,
      cacheUsage: { ...runCache },
      warnings,
      researchOnly: true,
      legalStatus: "INTERNAL_RESEARCH_ONLY",
      hypothesisObservation: "H-LU-003",
    });
  }

  type ProbeFile = {
    meta: Record<string, unknown>;
    probes: ProbeRow[];
  };

  let existing: ProbeFile = {
    meta: {
      version: PROBE_VERSION,
      dateKst: DATE,
      hypothesisLink: "H-LU-003",
      appendOnly: true,
      engineConnected: false,
      researchOnly: true,
      legalStatus: "INTERNAL_RESEARCH_ONLY",
      note: "Pre-game schedule lineups only — never backfill from post-game boxscore",
    },
    probes: [],
  };

  if (await fileExists(probePath)) {
    existing = JSON.parse(await readFile(probePath, "utf8")) as ProbeFile;
    if (!Array.isArray(existing.probes)) existing.probes = [];
  }

  const existingKeys = new Set(
    existing.probes.map((r) => `${r.gamePk}|${r.probedAt.slice(0, 19)}`),
  );

  let appended = 0;
  let skippedDuplicate = 0;
  for (const row of newRows) {
    const key = `${row.gamePk}|${probedAtKey}`;
    if (existingKeys.has(key)) {
      skippedDuplicate += 1;
      continue;
    }
    existing.probes.push(row);
    existingKeys.add(key);
    appended += 1;
  }

  existing.meta = {
    ...existing.meta,
    version: PROBE_VERSION,
    dateKst: DATE,
    lastRunAt: probedAt,
    totalProbeRows: existing.probes.length,
    hypothesisLink: "H-LU-003",
    hypothesisStatusPromotion: false,
    predictionHashSha256: predHashBefore,
    appendOnly: true,
  };

  const preGameRows = newRows.filter(
    (r) =>
      r.homeLineupAvailability !== "FINAL" &&
      r.homeLineupAvailability !== "GAME_STARTED" &&
      r.homeLineupAvailability !== "SOURCE_ERROR",
  );
  const bothComplete = preGameRows.filter((r) => r.bothSidesAvailable).length;
  const oneComplete = preGameRows.filter(
    (r) =>
      !r.bothSidesAvailable &&
      (r.homeLineupAvailability === "COMPLETE" ||
        r.awayLineupAvailability === "COMPLETE"),
  ).length;
  const neitherComplete = preGameRows.filter(
    (r) =>
      r.homeLineupAvailability !== "COMPLETE" &&
      r.awayLineupAvailability !== "COMPLETE",
  ).length;
  const startedOrFinal = newRows.filter(
    (r) =>
      r.homeLineupAvailability === "FINAL" ||
      r.homeLineupAvailability === "GAME_STARTED",
  ).length;

  const bucketKeys: MinutesBucket[] = [
    "GT_180",
    "M121_180",
    "M91_120",
    "M61_90",
    "M31_60",
    "M0_30",
    "STARTED_OR_FINAL",
  ];
  const bucketSummary: Record<
    string,
    { games: number; bothComplete: number }
  > = {};
  for (const b of bucketKeys) {
    bucketSummary[b] = { games: 0, bothComplete: 0 };
  }
  for (const r of newRows) {
    bucketSummary[r.minutesBucket].games += 1;
    if (r.bothSidesAvailable) {
      bucketSummary[r.minutesBucket].bothComplete += 1;
    }
  }

  const audit = {
    meta: {
      version: `${PROBE_VERSION}-audit`,
      kind: "pregame-lineup-availability-probe-audit",
      dateKst: DATE,
      probedAt,
      generatedAt: new Date().toISOString(),
      hypothesisLink: "H-LU-003",
      hypothesisStatusPromotion: false,
      engineConnected: false,
      engineAdmission: "PROHIBITED",
      researchOnly: true,
      predictionHashSha256: predHashBefore,
      predictionUnchanged: true,
      lineupDatasetImpact: 0,
      preGameBackfill: 0,
      scheduleUsDates: [...usDates].sort(),
      conclusion: "PREGAME_LINEUP_AVAILABILITY_COLLECTION_STARTED",
      note: "Buckets are descriptive only — do not auto-select collection cadence",
    },
    summary: {
      targetGames: predGames.length,
      preGameGames: preGameRows.length,
      bothSidesComplete: bothComplete,
      oneSideComplete: oneComplete,
      neitherComplete: neitherComplete,
      gameStartedOrFinal: startedOrFinal,
      sourceErrors: newRows.filter(
        (r) => r.homeLineupAvailability === "SOURCE_ERROR",
      ).length,
      minutesToStartBuckets: bucketSummary,
      appendedRows: appended,
      skippedDuplicateRows: skippedDuplicate,
    },
    cache: runCache,
    probeArtifact: probePath.replace(process.cwd() + path.sep, ""),
  };

  await mkdir(path.dirname(probePath), { recursive: true });
  await writeFile(probePath, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
  await mkdir(path.dirname(auditPath), { recursive: true });
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  const predHashAfter = sha256(await readFile(predPath, "utf8"));
  if (predHashAfter !== predHashBefore) {
    throw new Error("prediction snapshot mutated");
  }

  console.log(`targetGames=${predGames.length}`);
  console.log(`preGameGames=${preGameRows.length}`);
  console.log(`bothSidesComplete=${bothComplete}`);
  console.log(`oneSideComplete=${oneComplete}`);
  console.log(`neitherComplete=${neitherComplete}`);
  console.log(`startedOrFinal=${startedOrFinal}`);
  console.log(
    `cache rawHit/miss=${runCache.rawHit}/${runCache.rawMiss} network=${runCache.networkCalls}`,
  );
  console.log(`appended=${appended} skippedDuplicate=${skippedDuplicate}`);
  console.log(`저장: ${probePath}`);
  console.log(`감사: ${auditPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
