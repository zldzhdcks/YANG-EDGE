/**
 * Frozen KBO/NPB daily slate from primary research artifacts.
 * No Provider / Odds API calls. Excludes *.rev-*.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "@/lib/datetime/kst";
import { resolveKboTeamIdentity } from "@/lib/kbo/resolve-kbo-team-identity";
import { resolveNpbTeamIdentity } from "@/lib/npb/resolve-npb-team-identity";
import type { GameData } from "@/types/game";

export type BaseballSlateOfficialStatus =
  | "ELIGIBLE"
  | "PASS"
  | "BLOCKED"
  | "UNKNOWN";

export type BaseballSlateGameView = {
  league: "KBO" | "NPB";
  gameId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  scheduledStartTime: string;
  officialStatus: BaseballSlateOfficialStatus;
  officialPick: string | null;
  domesticOddsAvailable: boolean;
  overseasOddsAvailable: boolean;
  personnelAvailable: boolean;
  sourceRunId: string;
  sourceArtifacts: string[];
  sources: string[];
  aliasesMerged: string[];
  warnings: string[];
};

export type FrozenBaseballSlateResult = {
  dateKst: string;
  kbo: BaseballSlateGameView[];
  npb: BaseballSlateGameView[];
  games: GameData[];
  meta: {
    kboRawCount: number;
    kboUniqueCount: number;
    npbRawCount: number;
    npbUniqueCount: number;
    kboPath: string | null;
    npbPath: string | null;
    usedFrozenKbo: boolean;
    usedFrozenNpb: boolean;
  };
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

async function readJson(rel: string, cwd: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path.join(cwd, rel), "utf8")) as unknown;
  } catch {
    return null;
  }
}

function startKey(iso: string | null): string {
  if (!iso) return "unknown";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  // bucket to nearest 30 minutes to merge alias duplicates
  const bucket = Math.floor(ms / (30 * 60 * 1000));
  return String(bucket);
}

function preferredDisplayName(
  a: string,
  b: string,
): string {
  return a.length >= b.length ? a : b;
}

function toGameData(view: BaseballSlateGameView): GameData {
  const kst = instantToKst(view.scheduledStartTime);
  return {
    id: view.gameId,
    sport: "baseball",
    league: view.league,
    homeTeam: view.homeTeamName,
    awayTeam: view.awayTeamName,
    startTime: kst?.time ?? "TBD",
    date: kst?.date ?? view.scheduledStartTime.slice(0, 10),
    aiAnalysisAvailable: false,
    externalProvider:
      view.league === "KBO" ? "api-baseball" : "thesportsdb",
  };
}

type RawSchedGame = {
  gameId: string;
  home: string;
  away: string;
  scheduledStartTime: string;
  source: string | null;
  provider: string | null;
};

function parseScheduleGames(doc: Record<string, unknown>): RawSchedGame[] {
  const games = Array.isArray(doc.games) ? doc.games : [];
  return games
    .map((raw) => {
      const g = asRecord(raw);
      if (!g) return null;
      const gameId = asString(g.gameId);
      const home = asString(g.home);
      const away = asString(g.away);
      const scheduledStartTime = asString(g.scheduledStartTime);
      if (!gameId || !home || !away || !scheduledStartTime) return null;
      return {
        gameId,
        home,
        away,
        scheduledStartTime,
        source: asString(g.source),
        provider: asString(g.provider),
      };
    })
    .filter((x): x is RawSchedGame => x != null);
}

type PredEnrich = {
  officialStatus: BaseballSlateOfficialStatus;
  officialPick: string | null;
  domesticOddsAvailable: boolean;
  overseasOddsAvailable: boolean;
  personnelAvailable: boolean;
};

async function loadPredictionEnrichment(
  league: "kbo" | "npb",
  dateKst: string,
  cwd: string,
): Promise<Map<string, PredEnrich>> {
  const rel = `data/predictions/${league}/${dateKst}.json`;
  const doc = asRecord(await readJson(rel, cwd));
  const map = new Map<string, PredEnrich>();
  if (!doc) return map;
  const games = Array.isArray(doc.games) ? doc.games : [];
  for (const raw of games) {
    const g = asRecord(raw);
    if (!g) continue;
    const gameId = asString(g.gameId);
    if (!gameId) continue;
    const statusRaw = asString(g.officialStatus)?.toUpperCase();
    const officialStatus: BaseballSlateOfficialStatus =
      statusRaw === "ELIGIBLE" ||
      statusRaw === "PASS" ||
      statusRaw === "BLOCKED"
        ? statusRaw
        : "UNKNOWN";
    const odds = asRecord(g.odds);
    const domestic = odds ? asRecord(odds.domesticProto) : null;
    const overseas = odds ? asRecord(odds.overseas) : null;
    const starter = asRecord(g.starter);
    const lineup = asRecord(g.lineup);
    map.set(gameId, {
      officialStatus,
      officialPick: asString(g.officialPick),
      domesticOddsAvailable:
        domestic != null ||
        asString(asRecord(odds?.namespaces)?.DOMESTIC_PROTO) != null,
      overseasOddsAvailable:
        overseas != null ||
        asString(asRecord(odds?.namespaces)?.OVERSEAS_MARKET) === "COLLECTED",
      personnelAvailable:
        starter != null ||
        lineup != null ||
        asString(g.personnelHash) != null,
    });
  }
  return map;
}

function buildKboViews(
  rows: RawSchedGame[],
  runId: string,
  pathRel: string,
  pred: Map<string, PredEnrich>,
): BaseballSlateGameView[] {
  return rows.map((row) => {
    const home = resolveKboTeamIdentity(row.home);
    const away = resolveKboTeamIdentity(row.away);
    const enrich = pred.get(row.gameId);
    const warnings: string[] = [];
    if (home.mappingStatus === "UNMATCHED") warnings.push("HOME_UNMATCHED");
    if (away.mappingStatus === "UNMATCHED") warnings.push("AWAY_UNMATCHED");
    return {
      league: "KBO" as const,
      gameId: row.gameId,
      homeTeamId: home.canonicalTeamId ?? `kbo-raw-${row.home}`,
      awayTeamId: away.canonicalTeamId ?? `kbo-raw-${row.away}`,
      homeTeamName: home.canonicalNameKo ?? row.home,
      awayTeamName: away.canonicalNameKo ?? row.away,
      scheduledStartTime: row.scheduledStartTime,
      officialStatus: enrich?.officialStatus ?? "UNKNOWN",
      officialPick: enrich?.officialPick ?? null,
      domesticOddsAvailable: enrich?.domesticOddsAvailable ?? false,
      overseasOddsAvailable: enrich?.overseasOddsAvailable ?? false,
      personnelAvailable: enrich?.personnelAvailable ?? false,
      sourceRunId: runId,
      sourceArtifacts: [pathRel],
      sources: [row.source ?? row.provider ?? "KBO_SCHEDULE"].filter(Boolean),
      aliasesMerged: [],
      warnings,
    };
  });
}

function dedupeNpbViews(
  rows: RawSchedGame[],
  runId: string,
  pathRel: string,
  pred: Map<string, PredEnrich>,
): BaseballSlateGameView[] {
  type Acc = {
    view: BaseballSlateGameView;
    score: number;
  };
  const byCanon = new Map<string, Acc>();

  for (const row of rows) {
    const home = resolveNpbTeamIdentity(row.home);
    const away = resolveNpbTeamIdentity(row.away);
    const warnings: string[] = [];
    if (home.mappingStatus === "UNMATCHED") warnings.push("HOME_UNMATCHED");
    if (away.mappingStatus === "UNMATCHED") warnings.push("AWAY_UNMATCHED");

    const homeId = home.canonicalTeamId;
    const awayId = away.canonicalTeamId;
    // Without canonical ids, do not fuzzy-merge — keep isolated with warning
    const key =
      homeId && awayId
        ? `${homeId}|${awayId}|${startKey(row.scheduledStartTime)}`
        : `raw|${row.gameId}`;

    const enrich =
      pred.get(row.gameId) ??
      // try match prediction by canonical after merge
      null;

    const score =
      (row.home.length + row.away.length) +
      (row.provider === "API_BASEBALL" || row.source === "API_BASEBALL"
        ? 50
        : 0) +
      (row.source === "THESPORTSDB" ? 10 : 0);

    const existing = byCanon.get(key);
    if (!existing) {
      const view: BaseballSlateGameView = {
        league: "NPB",
        gameId: row.gameId,
        homeTeamId: homeId ?? `npb-raw-${row.home}`,
        awayTeamId: awayId ?? `npb-raw-${row.away}`,
        homeTeamName: home.canonicalNameEn ?? row.home,
        awayTeamName: away.canonicalNameEn ?? row.away,
        scheduledStartTime: row.scheduledStartTime,
        officialStatus: enrich?.officialStatus ?? "UNKNOWN",
        officialPick: enrich?.officialPick ?? null,
        domesticOddsAvailable: enrich?.domesticOddsAvailable ?? false,
        overseasOddsAvailable: enrich?.overseasOddsAvailable ?? false,
        personnelAvailable: enrich?.personnelAvailable ?? false,
        sourceRunId: runId,
        sourceArtifacts: [pathRel],
        sources: [row.source ?? row.provider ?? "NPB_SCHEDULE"].filter(
          Boolean,
        ) as string[],
        aliasesMerged: [row.home, row.away],
        warnings,
      };
      byCanon.set(key, { view, score });
      continue;
    }

    const merged = existing.view;
    merged.sources = [
      ...new Set([
        ...merged.sources,
        row.source ?? row.provider ?? "NPB_SCHEDULE",
      ]),
    ];
    merged.aliasesMerged = [
      ...new Set([...merged.aliasesMerged, row.home, row.away]),
    ];
    merged.warnings = [...new Set([...merged.warnings, ...warnings])];
    if (score > existing.score) {
      merged.gameId = row.gameId;
      merged.homeTeamName = preferredDisplayName(
        home.canonicalNameEn ?? row.home,
        merged.homeTeamName,
      );
      merged.awayTeamName = preferredDisplayName(
        away.canonicalNameEn ?? row.away,
        merged.awayTeamName,
      );
      merged.scheduledStartTime = row.scheduledStartTime;
      existing.score = score;
    } else {
      merged.homeTeamName = preferredDisplayName(
        merged.homeTeamName,
        home.canonicalNameEn ?? row.home,
      );
      merged.awayTeamName = preferredDisplayName(
        merged.awayTeamName,
        away.canonicalNameEn ?? row.away,
      );
    }
    const enrichHit = pred.get(merged.gameId) ?? pred.get(row.gameId);
    if (enrichHit) {
      merged.officialStatus = enrichHit.officialStatus;
      merged.officialPick = enrichHit.officialPick;
      merged.domesticOddsAvailable = enrichHit.domesticOddsAvailable;
      merged.overseasOddsAvailable = enrichHit.overseasOddsAvailable;
      merged.personnelAvailable = enrichHit.personnelAvailable;
    }
  }

  // Second pass: attach prediction by canonical team match when gameIds differ
  const views = [...byCanon.values()].map((a) => a.view);
  for (const view of views) {
    if (view.officialStatus !== "UNKNOWN") continue;
    for (const [predId, enrich] of pred) {
      // soft match unused; prediction rows share alias gameIds
      void predId;
      void enrich;
    }
  }
  return views;
}

export async function loadFrozenBaseballSlate(input: {
  dateKst: string;
  league?: string | null;
  cwd?: string;
}): Promise<FrozenBaseballSlateResult> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const wanted = input.league?.trim().toUpperCase() ?? null;
  const wantKbo = !wanted || wanted === "KBO";
  const wantNpb = !wanted || wanted === "NPB";

  let kbo: BaseballSlateGameView[] = [];
  let npb: BaseballSlateGameView[] = [];
  let kboRaw = 0;
  let npbRaw = 0;
  let kboPath: string | null = null;
  let npbPath: string | null = null;

  if (wantKbo) {
    kboPath = `data/research/kbo/${dateKst}-schedule-v1.json`;
    const doc = asRecord(await readJson(kboPath, cwd));
    if (doc && !kboPath.includes(".rev-")) {
      const rows = parseScheduleGames(doc);
      kboRaw = rows.length;
      const runId = asString(doc.runId) ?? "unknown";
      const pred = await loadPredictionEnrichment("kbo", dateKst, cwd);
      kbo = buildKboViews(rows, runId, kboPath, pred);
    } else {
      kboPath = null;
    }
  }

  if (wantNpb) {
    npbPath = `data/research/npb/${dateKst}-schedule-v1.json`;
    const doc = asRecord(await readJson(npbPath, cwd));
    if (doc) {
      const rows = parseScheduleGames(doc);
      npbRaw = rows.length;
      const runId = asString(doc.runId) ?? "unknown";
      const pred = await loadPredictionEnrichment("npb", dateKst, cwd);
      npb = dedupeNpbViews(rows, runId, npbPath, pred);
    } else {
      npbPath = null;
    }
  }

  const views = [...kbo, ...npb];
  return {
    dateKst,
    kbo,
    npb,
    games: views.map(toGameData),
    meta: {
      kboRawCount: kboRaw,
      kboUniqueCount: kbo.length,
      npbRawCount: npbRaw,
      npbUniqueCount: npb.length,
      kboPath,
      npbPath,
      usedFrozenKbo: kbo.length > 0,
      usedFrozenNpb: npb.length > 0,
    },
  };
}

/** Test helper: dedupe raw NPB schedule-like rows */
export function dedupeNpbScheduleRowsForTest(
  rows: Array<{
    gameId: string;
    home: string;
    away: string;
    scheduledStartTime: string;
    source?: string;
    provider?: string;
  }>,
): BaseballSlateGameView[] {
  return dedupeNpbViews(
    rows.map((r) => ({
      gameId: r.gameId,
      home: r.home,
      away: r.away,
      scheduledStartTime: r.scheduledStartTime,
      source: r.source ?? null,
      provider: r.provider ?? null,
    })),
    "test",
    "test.json",
    new Map(),
  );
}
