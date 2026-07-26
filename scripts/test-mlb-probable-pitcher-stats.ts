/**
 * 2026-07-27 KST MLB probable pitcher 경기 전 성적 커버리지 검증.
 *
 * - API-BASEBALL: players endpoint 없음 (실측 확인)
 * - MLB Stats API: people + gameLog 로 cutoff 이전 성적 재구성
 * - SportsDataIO Scrambled 미사용
 * - Engine / Baseline / Watchlist 미수정
 *
 * 실행:
 *   npx tsx scripts/test-mlb-probable-pitcher-stats.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildMlbPitcherGameCoverage,
  buildPitcherStatCandidate,
  type GameLogSplit,
  type PersonPayload,
} from "../src/lib/mlb/build-pitcher-stat-candidate";
import type { MlbPitcherGameCoverage } from "../src/lib/mlb/types-pitcher";

const TARGET_DATE_KST = "2026-07-27";
const SEASON = 2026;
const STATS_API_BASE = "https://statsapi.mlb.com";
const LINEUP_COVERAGE_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-statsapi-lineup-coverage.json`,
);
const ANALYSIS_COVERAGE_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-analysis-coverage.json`,
);
const WATCHLIST_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb.json`,
);
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-pitcher-stat-coverage.json`,
);

type LineupGame = {
  gamePk: number;
  homeTeam: string | null;
  awayTeam: string | null;
  startTimeKst: string | null;
  commenceTimeUtc: string | null;
  probablePitcherHome: { id: number | null; fullName: string | null } | null;
  probablePitcherAway: { id: number | null; fullName: string | null } | null;
};

type UsageCounter = {
  calls: number;
  remaining: number | null;
  limit: number | null;
};

const memoryCache = new Map<string, unknown>();

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

async function fetchJson(
  url: string,
  usage: UsageCounter,
  headers?: Record<string, string>,
): Promise<unknown> {
  if (memoryCache.has(url)) return memoryCache.get(url);

  usage.calls += 1;
  const response = await fetch(url, {
    headers: { Accept: "application/json", ...(headers ?? {}) },
    cache: "no-store",
  });
  const remaining = response.headers.get("x-ratelimit-requests-remaining");
  const limit = response.headers.get("x-ratelimit-requests-limit");
  if (remaining != null && remaining !== "") {
    const n = Number(remaining);
    if (Number.isFinite(n)) usage.remaining = n;
  }
  if (limit != null && limit !== "") {
    const n = Number(limit);
    if (Number.isFinite(n)) usage.limit = n;
  }

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url.replace(/apiKey=[^&]+/gi, "apiKey=***")}`);
  }
  memoryCache.set(url, data);
  return data;
}

async function probeApiBaseballPlayers(): Promise<{
  supported: boolean;
  calls: number;
  remaining: number | null;
  note: string;
}> {
  const base = (
    process.env.BASEBALL_API_BASE_URL ?? "https://v1.baseball.api-sports.io"
  ).replace(/\/$/, "");
  const key = (
    process.env.BASEBALL_API_KEY ??
    process.env.FOOTBALL_API_KEY ??
    ""
  ).trim();
  if (!key) {
    return {
      supported: false,
      calls: 0,
      remaining: null,
      note: "BASEBALL_API_KEY 미설정 — players 미호출",
    };
  }
  const usage: UsageCounter = { calls: 0, remaining: null, limit: null };
  const data = (await fetchJson(`${base}/players?search=Rasmussen`, usage, {
    "x-apisports-key": key,
  })) as { errors?: unknown; results?: number };
  const err =
    data.errors == null
      ? ""
      : typeof data.errors === "object"
        ? Object.values(data.errors as Record<string, unknown>).join("; ")
        : String(data.errors);
  const supported = !/do not exist|does not exist/i.test(err);
  return {
    supported,
    calls: usage.calls,
    remaining: usage.remaining,
    note: supported
      ? "players endpoint 응답 확인"
      : "players endpoint 없음 (API-BASEBALL 공식 응답)",
  };
}

async function loadPerson(
  playerId: number,
  usage: UsageCounter,
): Promise<PersonPayload | null> {
  const url = `${STATS_API_BASE}/api/v1/people/${playerId}`;
  const data = asRecord(await fetchJson(url, usage));
  const people = Array.isArray(data?.people) ? data.people : [];
  const person = asRecord(people[0]);
  if (!person) return null;
  return {
    id: asNumber(person.id) ?? undefined,
    fullName: asString(person.fullName) ?? undefined,
    pitchHand: asRecord(person.pitchHand)
      ? {
          code: asString(asRecord(person.pitchHand)?.code) ?? undefined,
          description:
            asString(asRecord(person.pitchHand)?.description) ?? undefined,
        }
      : undefined,
    currentTeam: asRecord(person.currentTeam)
      ? { name: asString(asRecord(person.currentTeam)?.name) ?? undefined }
      : undefined,
  };
}

async function loadGameLog(
  playerId: number,
  usage: UsageCounter,
): Promise<GameLogSplit[]> {
  const url =
    `${STATS_API_BASE}/api/v1/people/${playerId}/stats` +
    `?stats=gameLog&group=pitching&season=${SEASON}&sportId=1`;
  const data = asRecord(await fetchJson(url, usage));
  const stats = Array.isArray(data?.stats) ? data.stats : [];
  const first = asRecord(stats[0]);
  const splits = Array.isArray(first?.splits) ? first.splits : [];
  return splits.map((split) => {
    const row = asRecord(split) ?? {};
    return {
      date: asString(row.date) ?? undefined,
      isHome: typeof row.isHome === "boolean" ? row.isHome : undefined,
      game: asRecord(row.game)
        ? { gamePk: asNumber(asRecord(row.game)?.gamePk) ?? undefined }
        : undefined,
      team: asRecord(row.team)
        ? { name: asString(asRecord(row.team)?.name) ?? undefined }
        : undefined,
      opponent: asRecord(row.opponent)
        ? { name: asString(asRecord(row.opponent)?.name) ?? undefined }
        : undefined,
      stat: asRecord(row.stat) ?? undefined,
    };
  });
}

function loadLineupGames(raw: unknown): LineupGame[] {
  const root = asRecord(raw);
  const games = Array.isArray(root?.games) ? root.games : [];
  return games
    .map((game) => {
      const row = asRecord(game);
      if (!row) return null;
      const gamePk = asNumber(row.gamePk);
      if (gamePk == null) return null;
      const homeP = asRecord(row.probablePitcherHome);
      const awayP = asRecord(row.probablePitcherAway);
      return {
        gamePk,
        homeTeam: asString(row.homeTeam),
        awayTeam: asString(row.awayTeam),
        startTimeKst: asString(row.startTimeKst),
        commenceTimeUtc: asString(row.commenceTimeUtc),
        probablePitcherHome: homeP
          ? {
              id: asNumber(homeP.id),
              fullName: asString(homeP.fullName),
            }
          : null,
        probablePitcherAway: awayP
          ? {
              id: asNumber(awayP.id),
              fullName: asString(awayP.fullName),
            }
          : null,
      };
    })
    .filter((game): game is LineupGame => game != null);
}

function mapBaselineGameId(
  analysisRaw: unknown,
  homeTeam: string | null,
  awayTeam: string | null,
  commenceTimeUtc: string | null,
): string | null {
  const root = asRecord(analysisRaw);
  const games = Array.isArray(root?.games) ? root.games : [];
  const commence = commenceTimeUtc ? Date.parse(commenceTimeUtc) : NaN;
  for (const game of games) {
    const row = asRecord(game);
    const meta = asRecord(row?.game);
    if (!meta) continue;
    if (
      asString(meta.homeTeam) === homeTeam &&
      asString(meta.awayTeam) === awayTeam
    ) {
      const t = Date.parse(asString(meta.commenceTimeUtc) ?? "");
      if (
        !Number.isFinite(commence) ||
        !Number.isFinite(t) ||
        Math.abs(t - commence) <= 3 * 60 * 60 * 1000
      ) {
        const externalId = asString(meta.externalId);
        return externalId ? `mlb-${externalId}` : null;
      }
    }
  }
  return null;
}

function summarize(games: MlbPitcherGameCoverage[]) {
  const bothIdentified = games.filter(
    (g) =>
      g.home.identity.providerPlayerId != null &&
      g.away.identity.providerPlayerId != null &&
      g.home.status !== "AMBIGUOUS" &&
      g.away.status !== "AMBIGUOUS" &&
      g.home.status !== "UNAVAILABLE" &&
      g.away.status !== "UNAVAILABLE",
  ).length;

  const countStatus = (status: string) =>
    games.filter((g) => g.gameStatus === status).length;

  const sides = games.flatMap((g) => [g.home, g.away]);
  const eraRate =
    sides.length > 0
      ? Math.round(
          (sides.filter((s) => s.seasonEra != null).length / sides.length) *
            1000,
        ) / 10
      : 0;
  const whipRate =
    sides.length > 0
      ? Math.round(
          (sides.filter((s) => s.seasonWhip != null).length / sides.length) *
            1000,
        ) / 10
      : 0;
  const ipRate =
    sides.length > 0
      ? Math.round(
          (sides.filter((s) => s.inningsPitched != null).length /
            sides.length) *
            1000,
        ) / 10
      : 0;
  const recentRate =
    sides.length > 0
      ? Math.round(
          (sides.filter((s) => s.recentOutings.length > 0).length /
            sides.length) *
            1000,
        ) / 10
      : 0;

  const missing = new Map<string, number>();
  for (const side of sides) {
    for (const field of side.missingFields) {
      missing.set(field, (missing.get(field) ?? 0) + 1);
    }
  }
  const largestGaps = [...missing.entries()]
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count || a.field.localeCompare(b.field));

  return {
    totalGames: games.length,
    bothPitchersIdentified: bothIdentified,
    READY_FOR_BACKTEST: countStatus("READY_FOR_BACKTEST"),
    PARTIAL: countStatus("PARTIAL"),
    LEAKAGE_RISK: countStatus("LEAKAGE_RISK"),
    UNAVAILABLE: countStatus("UNAVAILABLE"),
    AMBIGUOUS: countStatus("AMBIGUOUS"),
    eraCoveragePercent: eraRate,
    whipCoveragePercent: whipRate,
    inningsCoveragePercent: ipRate,
    recentOutingCoveragePercent: recentRate,
    largestGaps,
    engineReadyNow: false,
    engineReadyReason:
      "MLB Stats API 상업 이용 가능 여부가 미확인이며, 공식 라이선스 계약 전 Engine 투입 보류. API-BASEBALL은 players 통계 endpoint 없음.",
    paidDataNeeded:
      "합법적으로 재배포·상업 이용이 확인된 투수 통계 소스(또는 MLB 공식 라이선스)가 추가로 필요할 수 있음",
  };
}

async function runOnce(): Promise<{
  games: MlbPitcherGameCoverage[];
  summary: ReturnType<typeof summarize>;
  apiUsage: Record<string, unknown>;
}> {
  const lineupRaw = JSON.parse(await readFile(LINEUP_COVERAGE_PATH, "utf8"));
  const analysisRaw = JSON.parse(await readFile(ANALYSIS_COVERAGE_PATH, "utf8"));
  // watchlist은 참조만 (수정 금지)
  await readFile(WATCHLIST_PATH, "utf8");

  const lineupGames = loadLineupGames(lineupRaw);
  if (lineupGames.length === 0) {
    throw new Error("lineup coverage games 없음");
  }

  const baseballProbe = await probeApiBaseballPlayers();
  const statsUsage: UsageCounter = { calls: 0, remaining: null, limit: null };

  const personCache = new Map<number, PersonPayload | null>();
  const gameLogCache = new Map<number, GameLogSplit[]>();

  const loadCachedPerson = async (id: number) => {
    if (personCache.has(id)) return personCache.get(id) ?? null;
    const person = await loadPerson(id, statsUsage);
    personCache.set(id, person);
    return person;
  };
  const loadCachedGameLog = async (id: number) => {
    if (gameLogCache.has(id)) return gameLogCache.get(id) ?? [];
    const splits = await loadGameLog(id, statsUsage);
    gameLogCache.set(id, splits);
    return splits;
  };

  const games: MlbPitcherGameCoverage[] = [];

  for (const game of lineupGames) {
    const cutoff = game.commenceTimeUtc;
    if (!cutoff) {
      continue;
    }
    const baselineGameId = mapBaselineGameId(
      analysisRaw,
      game.homeTeam,
      game.awayTeam,
      game.commenceTimeUtc,
    );

    const buildSide = async (
      probable: LineupGame["probablePitcherHome"],
      teamName: string | null,
    ) => {
      if (!probable?.id || !probable.fullName) {
        return buildPitcherStatCandidate({
          probableName: probable?.fullName ?? null,
          probableId: probable?.id ?? null,
          sideTeamName: teamName,
          mlbGamePk: game.gamePk,
          baselineGameId,
          cutoffTime: cutoff,
          person: null,
          gameLogSplits: null,
          seasonLiveStats: null,
          matchStatus: "UNAVAILABLE",
          apiBaseballPlayersSupported: baseballProbe.supported,
        });
      }

      // StatsAPI probable id는 이미 확정 ID — 이름 임의 매칭 불필요
      const person = await loadCachedPerson(probable.id);
      const gameLog = await loadCachedGameLog(probable.id);
      return buildPitcherStatCandidate({
        probableName: probable.fullName,
        probableId: probable.id,
        sideTeamName: teamName,
        mlbGamePk: game.gamePk,
        baselineGameId,
        cutoffTime: cutoff,
        person,
        gameLogSplits: gameLog,
        seasonLiveStats: null,
        matchStatus: "MATCHED",
        apiBaseballPlayersSupported: baseballProbe.supported,
      });
    };

    const home = await buildSide(game.probablePitcherHome, game.homeTeam);
    const away = await buildSide(game.probablePitcherAway, game.awayTeam);
    games.push(
      buildMlbPitcherGameCoverage({
        gamePk: game.gamePk,
        baselineGameId,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        commenceTimeUtc: game.commenceTimeUtc,
        startTimeKst: game.startTimeKst,
        home,
        away,
      }),
    );
  }

  games.sort((a, b) => {
    const t = (a.commenceTimeUtc ?? "").localeCompare(b.commenceTimeUtc ?? "");
    if (t !== 0) return t;
    return a.gamePk - b.gamePk;
  });

  return {
    games,
    summary: summarize(games),
    apiUsage: {
      apiBaseball: baseballProbe,
      mlbStatsApi: {
        calls: statsUsage.calls,
        remaining: statsUsage.remaining,
        uniquePitchers: personCache.size,
        cacheEntries: memoryCache.size,
      },
      sportsDataIo: {
        calls: 0,
        used: false,
        note: "Scrambled Trial 데이터 사용 금지 — 미호출",
      },
    },
  };
}

async function main() {
  console.log(`=== MLB Probable Pitcher Stats (${TARGET_DATE_KST} KST) ===`);
  console.log("SportsDataIO Scrambled 미사용. Engine 미연결.\n");

  memoryCache.clear();
  const first = await runOnce();
  memoryCache.clear();
  const second = await runOnce();

  const fingerprint = (games: MlbPitcherGameCoverage[]) =>
    stableStringify(
      games.map((g) => ({
        gamePk: g.gamePk,
        gameStatus: g.gameStatus,
        home: {
          id: g.home.identity.providerPlayerId,
          status: g.home.status,
          era: g.home.seasonEra,
          whip: g.home.seasonWhip,
          ip: g.home.inningsPitched,
          gs: g.home.gamesStarted,
          recent: g.home.recentOutings.length,
          missing: g.home.missingFields,
        },
        away: {
          id: g.away.identity.providerPlayerId,
          status: g.away.status,
          era: g.away.seasonEra,
          whip: g.away.seasonWhip,
          ip: g.away.inningsPitched,
          gs: g.away.gamesStarted,
          recent: g.away.recentOutings.length,
          missing: g.away.missingFields,
        },
      })),
    );

  const deterministic =
    fingerprint(first.games) === fingerprint(second.games);

  const output = {
    meta: {
      version: "mlb-pitcher-stat-coverage-v1",
      generatedAt: new Date().toISOString(),
      targetDateKst: TARGET_DATE_KST,
      inputs: {
        lineupCoverage: path.relative(process.cwd(), LINEUP_COVERAGE_PATH),
        analysisCoverage: path.relative(process.cwd(), ANALYSIS_COVERAGE_PATH),
        watchlist: path.relative(process.cwd(), WATCHLIST_PATH),
      },
      engineConnected: false,
      sportsDataIoUsed: false,
      mlbStatsApiCommercialUse: "미확인",
      note: "probable pitcher 기준 경기 전 성적 확보 가능 여부만 검증. Pitcher Advantage 미계산.",
    },
    apiUsage: first.apiUsage,
    summary: {
      ...first.summary,
      deterministic,
      dataSources: [
        "mlb-statsapi schedule probablePitchers (기존 lineup coverage)",
        "mlb-statsapi /api/v1/people/{id}",
        "mlb-statsapi /api/v1/people/{id}/stats?stats=gameLog&group=pitching",
        "api-baseball players: unsupported",
      ],
    },
    games: first.games.map((game) => ({
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      startTimeKst: game.startTimeKst,
      gamePk: game.gamePk,
      baselineGameId: game.baselineGameId,
      homePitcher: game.home.identity.fullName,
      awayPitcher: game.away.identity.fullName,
      homeProviderId: game.home.identity.providerPlayerId,
      awayProviderId: game.away.identity.providerPlayerId,
      homeEra: game.home.seasonEra,
      awayEra: game.away.seasonEra,
      homeWhip: game.home.seasonWhip,
      awayWhip: game.away.seasonWhip,
      homeIp: game.home.inningsPitched,
      awayIp: game.away.inningsPitched,
      homeGamesStarted: game.home.gamesStarted,
      awayGamesStarted: game.away.gamesStarted,
      homeRecentOutings: game.home.recentOutings.length,
      awayRecentOutings: game.away.recentOutings.length,
      cutoffTime: game.commenceTimeUtc,
      source: game.home.statsSource,
      status: game.gameStatus,
      missingFields: [
        ...new Set([
          ...game.home.missingFields.map((f) => `home.${f}`),
          ...game.away.missingFields.map((f) => `away.${f}`),
        ]),
      ],
      warnings: game.warnings,
      detail: game,
    })),
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  const s = output.summary;
  console.log(`양 팀 투수 식별 성공 경기: ${s.bothPitchersIdentified}/${s.totalGames}`);
  console.log(`READY_FOR_BACKTEST: ${s.READY_FOR_BACKTEST}`);
  console.log(`PARTIAL: ${s.PARTIAL}`);
  console.log(`LEAKAGE_RISK: ${s.LEAKAGE_RISK}`);
  console.log(`UNAVAILABLE: ${s.UNAVAILABLE}`);
  console.log(
    `ERA/WHIP/이닝 확보율: ${s.eraCoveragePercent}% / ${s.whipCoveragePercent}% / ${s.inningsCoveragePercent}%`,
  );
  console.log(`최근 등판 확보율: ${s.recentOutingCoveragePercent}%`);
  console.log(
    `가장 큰 공백: ${
      s.largestGaps[0]
        ? `${s.largestGaps[0].field}(${s.largestGaps[0].count})`
        : "없음"
    }`,
  );
  console.log(
    `API 요청량: StatsAPI ${asRecord(first.apiUsage.mlbStatsApi)?.calls} / API-BASEBALL ${asRecord(first.apiUsage.apiBaseball)?.calls}`,
  );
  console.log(`Engine 즉시 사용: ${s.engineReadyNow ? "가능" : "불가"}`);
  console.log(`결정성: ${deterministic ? "동일" : "불일치"}`);
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message.replace(/x-apisports-key[^,\s]*/gi, "***"));
  process.exitCode = 1;
});
