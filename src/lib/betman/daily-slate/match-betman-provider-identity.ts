import { readFile } from "node:fs/promises";
import path from "node:path";
import { getKboIdentityProvider } from "../../kbo/kbo-identity-feature-flag";
import { getKboIdentityArtifactPath } from "../../kbo/kbo-identity-artifact-path";
import type {
  BetmanDailySlateGameInput,
  BetmanIdentityMatchStatus,
  BetmanSupportedSport,
} from "./betman-daily-slate-types";

type IdentityMatch = {
  identityStatus: BetmanIdentityMatchStatus;
  internalGameId: string | null;
  providerGameId: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  startTimeKst: string | null;
  providerLeagueId: string | null;
  competitionHint: string | null;
};

type KboIdentityRow = {
  internalGameId: string;
  providerGameId: string;
  homeTeam: { canonicalNameKo: string | null; providerName: string | null };
  awayTeam: { canonicalNameKo: string | null; providerName: string | null };
  time: { startTimeKst: string | null };
};

type MlbPredictionRow = {
  gameId: string;
  externalId: string;
  homeTeam: string;
  awayTeam: string;
  startTimeKst: string;
  missingFactors?: string[];
  baselinePick?: string;
  modelProbability?: number;
  confidence?: number;
  recommendationGrade?: string;
  edgeScore?: number;
};

type SoccerFixtureRow = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  leagueId: string | null;
  leagueName: string | null;
  startTimeKst: string;
};

function parseMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function competitionHint(raw: string): string {
  return raw.trim().toUpperCase();
}

function isKboCompetition(competitionNameRaw: string): boolean {
  const hint = competitionHint(competitionNameRaw);
  return (
    hint.includes("KBO") ||
    hint.includes("KBO리그") ||
    hint.includes("KOREAN BASEBALL")
  );
}

function isMlbCompetition(competitionNameRaw: string): boolean {
  const hint = competitionHint(competitionNameRaw);
  return hint.includes("MLB") || hint.includes("MAJOR LEAGUE");
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function loadKboRows(dateKst: string, cwd: string): Promise<KboIdentityRow[]> {
  const provider = getKboIdentityProvider();
  const primaryPath = getKboIdentityArtifactPath(dateKst, provider, cwd);
  const doc = await readJsonIfExists<{ rows: KboIdentityRow[] }>(primaryPath);
  if (doc?.rows?.length) return doc.rows;
  const fallback = provider === "API_BASEBALL" ? "THESPORTSDB" : "API_BASEBALL";
  const fallbackPath = getKboIdentityArtifactPath(dateKst, fallback, cwd);
  const fallbackDoc = await readJsonIfExists<{ rows: KboIdentityRow[] }>(
    fallbackPath,
  );
  return fallbackDoc?.rows ?? [];
}

async function loadMlbPredictions(
  dateKst: string,
  cwd: string,
): Promise<MlbPredictionRow[]> {
  const doc = await readJsonIfExists<{ predictions: MlbPredictionRow[] }>(
    path.join(cwd, "data/predictions/mlb", `${dateKst}.json`),
  );
  return doc?.predictions ?? [];
}

async function loadSoccerFixturesFromCache(
  dateKst: string,
  cwd: string,
): Promise<SoccerFixtureRow[]> {
  const cacheDir = path.join(cwd, "data/cache/research/soccer/raw");
  try {
    const { readdir, readFile: rf } = await import("node:fs/promises");
    const files = await readdir(cacheDir);
    const rows: SoccerFixtureRow[] = [];
    for (const file of files) {
      if (!file.includes(dateKst)) continue;
      const body = JSON.parse(await rf(path.join(cacheDir, file), "utf8")) as {
        body?: { response?: Array<Record<string, unknown>> };
        response?: Array<Record<string, unknown>>;
      };
      const fixtures = body.body?.response ?? body.response ?? [];
      for (const fixture of fixtures) {
        const f = fixture as {
          fixture?: { id?: number; date?: string };
          teams?: { home?: { name?: string }; away?: { name?: string } };
          league?: { id?: number; name?: string };
        };
        if (!f.fixture?.id) continue;
        rows.push({
          fixtureId: String(f.fixture.id),
          homeTeam: f.teams?.home?.name ?? "",
          awayTeam: f.teams?.away?.name ?? "",
          leagueId: f.league?.id != null ? String(f.league.id) : null,
          leagueName: f.league?.name ?? null,
          startTimeKst: f.fixture.date ?? "",
        });
      }
    }
    return rows;
  } catch {
    return [];
  }
}

function matchKboRow(
  game: BetmanDailySlateGameInput,
  rows: KboIdentityRow[],
): IdentityMatch {
  if (game.providerGameId) {
    const byId = rows.find((r) => r.providerGameId === game.providerGameId);
    if (byId) {
      return {
        identityStatus: "MATCHED",
        internalGameId: byId.internalGameId,
        providerGameId: byId.providerGameId,
        homeTeam: byId.homeTeam.canonicalNameKo ?? byId.homeTeam.providerName,
        awayTeam: byId.awayTeam.canonicalNameKo ?? byId.awayTeam.providerName,
        startTimeKst: byId.time.startTimeKst,
        providerLeagueId: "5",
        competitionHint: "KBO",
      };
    }
    return {
      identityStatus: "PROVIDER_GAME_MISSING",
      internalGameId: null,
      providerGameId: game.providerGameId,
      homeTeam: null,
      awayTeam: null,
      startTimeKst: null,
      providerLeagueId: "5",
      competitionHint: "KBO",
    };
  }

  const startMs = parseMs(game.scheduledStartTimeKst);
  const candidates = rows.filter((row) => {
    const home = row.homeTeam.canonicalNameKo ?? row.homeTeam.providerName ?? "";
    const away = row.awayTeam.canonicalNameKo ?? row.awayTeam.providerName ?? "";
    const homeMatch =
      normalizeText(home) === normalizeText(game.homeTeamRaw) ||
      normalizeText(home).includes(normalizeText(game.homeTeamRaw)) ||
      normalizeText(game.homeTeamRaw).includes(normalizeText(home));
    const awayMatch =
      normalizeText(away) === normalizeText(game.awayTeamRaw) ||
      normalizeText(away).includes(normalizeText(game.awayTeamRaw)) ||
      normalizeText(game.awayTeamRaw).includes(normalizeText(away));
    const timeMatch =
      startMs != null &&
      parseMs(row.time.startTimeKst) != null &&
      startMs === parseMs(row.time.startTimeKst);
    return homeMatch && awayMatch && timeMatch;
  });

  if (candidates.length === 1) {
    const row = candidates[0]!;
    return {
      identityStatus: "MATCHED",
      internalGameId: row.internalGameId,
      providerGameId: row.providerGameId,
      homeTeam: row.homeTeam.canonicalNameKo ?? row.homeTeam.providerName,
      awayTeam: row.awayTeam.canonicalNameKo ?? row.awayTeam.providerName,
      startTimeKst: row.time.startTimeKst,
      providerLeagueId: "5",
      competitionHint: "KBO",
    };
  }
  if (candidates.length > 1) {
    return {
      identityStatus: "AMBIGUOUS",
      internalGameId: null,
      providerGameId: null,
      homeTeam: null,
      awayTeam: null,
      startTimeKst: null,
      providerLeagueId: "5",
      competitionHint: "KBO",
    };
  }
  return {
    identityStatus: "UNMATCHED",
    internalGameId: null,
    providerGameId: null,
    homeTeam: null,
    awayTeam: null,
    startTimeKst: null,
    providerLeagueId: "5",
    competitionHint: "KBO",
  };
}

function matchMlbRow(
  game: BetmanDailySlateGameInput,
  rows: MlbPredictionRow[],
): IdentityMatch {
  if (game.providerGameId) {
    const byId = rows.find((r) => r.externalId === game.providerGameId);
    if (byId) {
      return {
        identityStatus: "MATCHED",
        internalGameId: byId.gameId,
        providerGameId: byId.externalId,
        homeTeam: byId.homeTeam,
        awayTeam: byId.awayTeam,
        startTimeKst: game.scheduledStartTimeKst,
        providerLeagueId: "1",
        competitionHint: "MLB",
      };
    }
  }
  const startMs = parseMs(game.scheduledStartTimeKst);
  const candidates = rows.filter((row) => {
    const homeMatch =
      normalizeText(row.homeTeam).includes(normalizeText(game.homeTeamRaw)) ||
      normalizeText(game.homeTeamRaw).includes(normalizeText(row.homeTeam));
    const awayMatch =
      normalizeText(row.awayTeam).includes(normalizeText(game.awayTeamRaw)) ||
      normalizeText(game.awayTeamRaw).includes(normalizeText(row.awayTeam));
    return homeMatch && awayMatch;
  });
  if (candidates.length === 1) {
    const row = candidates[0]!;
    return {
      identityStatus: "MATCHED",
      internalGameId: row.gameId,
      providerGameId: row.externalId,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      startTimeKst: game.scheduledStartTimeKst,
      providerLeagueId: "1",
      competitionHint: "MLB",
    };
  }
  if (candidates.length > 1) {
    return {
      identityStatus: "AMBIGUOUS",
      internalGameId: null,
      providerGameId: null,
      homeTeam: null,
      awayTeam: null,
      startTimeKst: null,
      providerLeagueId: "1",
      competitionHint: "MLB",
    };
  }
  if (startMs == null) {
    return {
      identityStatus: "TIME_MISMATCH",
      internalGameId: null,
      providerGameId: null,
      homeTeam: null,
      awayTeam: null,
      startTimeKst: null,
      providerLeagueId: "1",
      competitionHint: "MLB",
    };
  }
  return {
    identityStatus: "UNMATCHED",
    internalGameId: null,
    providerGameId: null,
    homeTeam: null,
    awayTeam: null,
    startTimeKst: null,
    providerLeagueId: "1",
    competitionHint: "MLB",
  };
}

function matchSoccerRow(
  game: BetmanDailySlateGameInput,
  rows: SoccerFixtureRow[],
): IdentityMatch {
  if (game.providerFixtureId) {
    const byId = rows.find((r) => r.fixtureId === game.providerFixtureId);
    if (byId) {
      return {
        identityStatus: "MATCHED",
        internalGameId: `soccer-${byId.fixtureId}`,
        providerGameId: byId.fixtureId,
        homeTeam: byId.homeTeam,
        awayTeam: byId.awayTeam,
        startTimeKst: game.scheduledStartTimeKst,
        providerLeagueId: byId.leagueId,
        competitionHint: byId.leagueName,
      };
    }
  }
  const candidates = rows.filter((row) => {
    const homeMatch =
      normalizeText(row.homeTeam).includes(normalizeText(game.homeTeamRaw)) ||
      normalizeText(game.homeTeamRaw).includes(normalizeText(row.homeTeam));
    const awayMatch =
      normalizeText(row.awayTeam).includes(normalizeText(game.awayTeamRaw)) ||
      normalizeText(game.awayTeamRaw).includes(normalizeText(row.awayTeam));
    return homeMatch && awayMatch;
  });
  if (candidates.length === 1) {
    const row = candidates[0]!;
    return {
      identityStatus: "MATCHED",
      internalGameId: `soccer-${row.fixtureId}`,
      providerGameId: row.fixtureId,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      startTimeKst: game.scheduledStartTimeKst,
      providerLeagueId: row.leagueId,
      competitionHint: row.leagueName,
    };
  }
  if (candidates.length > 1) {
    return {
      identityStatus: "AMBIGUOUS",
      internalGameId: null,
      providerGameId: null,
      homeTeam: null,
      awayTeam: null,
      startTimeKst: null,
      providerLeagueId: null,
      competitionHint: null,
    };
  }
  return {
    identityStatus: rows.length === 0 ? "PROVIDER_NOT_IMPLEMENTED" : "UNMATCHED",
    internalGameId: null,
    providerGameId: null,
    homeTeam: null,
    awayTeam: null,
    startTimeKst: null,
    providerLeagueId: null,
    competitionHint: null,
  };
}

export async function matchBetmanGameProviderIdentity(params: {
  dateKst: string;
  game: BetmanDailySlateGameInput;
  sport: BetmanSupportedSport;
  cwd?: string;
}): Promise<IdentityMatch> {
  const cwd = params.cwd ?? process.cwd();
  const { game, sport } = params;

  if (game.manualIdentityReference) {
    return {
      identityStatus: "MATCHED",
      internalGameId: game.manualIdentityReference,
      providerGameId: game.providerGameId ?? game.providerFixtureId,
      homeTeam: game.homeTeamRaw,
      awayTeam: game.awayTeamRaw,
      startTimeKst: game.scheduledStartTimeKst,
      providerLeagueId: null,
      competitionHint: game.competitionNameRaw,
    };
  }

  if (sport === "BASEBALL") {
    if (isKboCompetition(game.competitionNameRaw)) {
      return matchKboRow(game, await loadKboRows(params.dateKst, cwd));
    }
    if (isMlbCompetition(game.competitionNameRaw)) {
      return matchMlbRow(game, await loadMlbPredictions(params.dateKst, cwd));
    }
    const kbo = await loadKboRows(params.dateKst, cwd);
    const kboMatch = matchKboRow(game, kbo);
    if (kboMatch.identityStatus === "MATCHED") return kboMatch;
    const mlbMatch = matchMlbRow(
      game,
      await loadMlbPredictions(params.dateKst, cwd),
    );
    if (mlbMatch.identityStatus === "MATCHED") return mlbMatch;
    return kbo.length > 0 || (await loadMlbPredictions(params.dateKst, cwd)).length > 0
      ? kboMatch.identityStatus === "UNMATCHED"
        ? mlbMatch
        : kboMatch
      : {
          identityStatus: "PROVIDER_NOT_IMPLEMENTED",
          internalGameId: null,
          providerGameId: null,
          homeTeam: null,
          awayTeam: null,
          startTimeKst: null,
          providerLeagueId: null,
          competitionHint: null,
        };
  }

  if (sport === "SOCCER") {
    return matchSoccerRow(
      game,
      await loadSoccerFixturesFromCache(params.dateKst, cwd),
    );
  }

  return {
    identityStatus: "PROVIDER_NOT_IMPLEMENTED",
    internalGameId: null,
    providerGameId: null,
    homeTeam: null,
    awayTeam: null,
    startTimeKst: null,
    providerLeagueId: null,
    competitionHint: null,
  };
}

export async function loadMlbPredictionForGame(
  dateKst: string,
  internalGameId: string | null,
  cwd = process.cwd(),
): Promise<MlbPredictionRow | null> {
  if (!internalGameId) return null;
  const rows = await loadMlbPredictions(dateKst, cwd);
  return rows.find((r) => r.gameId === internalGameId) ?? null;
}

export async function loadKboOddsComparisonExists(
  dateKst: string,
  internalGameId: string | null,
  cwd = process.cwd(),
): Promise<boolean> {
  if (!internalGameId) return false;
  const doc = await readJsonIfExists<{ rows: Array<{ gameId: string }> }>(
    path.join(cwd, "data/research/kbo", `${dateKst}-odds-comparison-v1.json`),
  );
  return doc?.rows?.some((r) => r.gameId === internalGameId) ?? false;
}
