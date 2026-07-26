/**
 * MLB Stats API — 선발투수/타순 공개 여부 검증.
 *
 * - mlb.com HTML 크롤링 없음
 * - 로그인·쿠키·브라우저 자동화 없음
 * - 확인된 공개 endpoint만 사용
 * - Engine / UI / 저장소 미연결
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/test-mlb-statsapi-lineups.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../src/lib/datetime/kst";

const TARGET_DATE_KST = "2026-07-27";
/** 실제 조회로 KST 2026-07-27 15경기가 모두 포함된 미국 캘린더 날짜 */
const SCHEDULE_DATE_US = "2026-07-26";
const BASE_URL = "https://statsapi.mlb.com";
const OUTPUT_PATH = path.join(
  process.cwd(),
  "data",
  "daily-tests",
  `${TARGET_DATE_KST}-mlb-statsapi-lineup-coverage.json`,
);

const MEMORY_CACHE = new Map<string, { fetchedAt: string; data: unknown }>();

type LineupCoverageStatus =
  | "PITCHERS_AND_LINEUPS"
  | "PITCHERS_ONLY"
  | "LINEUPS_ONLY"
  | "NOT_PUBLISHED"
  | "ENDPOINT_UNAVAILABLE"
  | "AMBIGUOUS";

type PitcherInfo = {
  id: number | null;
  fullName: string | null;
};

type GameCoverage = {
  gamePk: number;
  homeTeam: string | null;
  awayTeam: string | null;
  startTimeKst: string | null;
  commenceTimeUtc: string | null;
  probablePitcherHome: PitcherInfo | null;
  probablePitcherAway: PitcherInfo | null;
  confirmedStarterHome: PitcherInfo | null;
  confirmedStarterAway: PitcherInfo | null;
  homeBattingOrderCount: number;
  awayBattingOrderCount: number;
  lineupStatus:
    | "BOTH_PUBLISHED"
    | "HOME_ONLY"
    | "AWAY_ONLY"
    | "NOT_PUBLISHED";
  coverageStatus: LineupCoverageStatus;
  responseFetchedAt: string;
  source: string;
  detailedState: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pitcherFrom(raw: unknown): PitcherInfo | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asNumber(row.id);
  const fullName = asString(row.fullName);
  if (id == null && !fullName) return null;
  return { id, fullName };
}

async function fetchJson(
  pathnameAndQuery: string,
): Promise<{ data: unknown; fetchedAt: string; cached: boolean; status: number }> {
  const cacheKey = pathnameAndQuery;
  const cached = MEMORY_CACHE.get(cacheKey);
  if (cached) {
    return {
      data: cached.data,
      fetchedAt: cached.fetchedAt,
      cached: true,
      status: 200,
    };
  }

  const url = `${BASE_URL}${pathnameAndQuery}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const fetchedAt = new Date().toISOString();
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { parseError: true, excerpt: text.slice(0, 200) };
  }
  if (response.ok) {
    MEMORY_CACHE.set(cacheKey, { fetchedAt, data });
  }
  return { data, fetchedAt, cached: false, status: response.status };
}

function classifyLineupCounts(
  homeCount: number,
  awayCount: number,
): GameCoverage["lineupStatus"] {
  if (homeCount > 0 && awayCount > 0) return "BOTH_PUBLISHED";
  if (homeCount > 0) return "HOME_ONLY";
  if (awayCount > 0) return "AWAY_ONLY";
  return "NOT_PUBLISHED";
}

function classifyCoverage(input: {
  probableHome: boolean;
  probableAway: boolean;
  confirmedHome: boolean;
  confirmedAway: boolean;
  lineupStatus: GameCoverage["lineupStatus"];
}): LineupCoverageStatus {
  const pitchersReady =
    (input.probableHome && input.probableAway) ||
    (input.confirmedHome && input.confirmedAway);
  const lineupsReady = input.lineupStatus === "BOTH_PUBLISHED";
  const partialPitcher =
    input.probableHome !== input.probableAway ||
    input.confirmedHome !== input.confirmedAway;
  const partialLineup =
    input.lineupStatus === "HOME_ONLY" || input.lineupStatus === "AWAY_ONLY";

  if (partialPitcher || partialLineup) return "AMBIGUOUS";
  if (pitchersReady && lineupsReady) return "PITCHERS_AND_LINEUPS";
  if (pitchersReady) return "PITCHERS_ONLY";
  if (lineupsReady) return "LINEUPS_ONLY";
  return "NOT_PUBLISHED";
}

function mapScheduleGame(
  raw: unknown,
  fetchedAt: string,
): GameCoverage | null {
  const row = asRecord(raw);
  if (!row) return null;
  const gamePk = asNumber(row.gamePk);
  if (gamePk == null) return null;

  const gameDate = asString(row.gameDate);
  const kst = gameDate ? instantToKst(gameDate) : null;
  if (!kst || kst.date !== TARGET_DATE_KST) return null;

  const teams = asRecord(row.teams);
  const home = asRecord(teams?.home);
  const away = asRecord(teams?.away);
  const homeTeam = asString(asRecord(home?.team)?.name);
  const awayTeam = asString(asRecord(away?.team)?.name);
  const status = asRecord(row.status);

  const lineups = asRecord(row.lineups);
  const homePlayers = Array.isArray(lineups?.homePlayers)
    ? lineups.homePlayers
    : [];
  const awayPlayers = Array.isArray(lineups?.awayPlayers)
    ? lineups.awayPlayers
    : [];

  const probableHome = pitcherFrom(home?.probablePitcher);
  const probableAway = pitcherFrom(away?.probablePitcher);
  const lineupStatus = classifyLineupCounts(
    homePlayers.length,
    awayPlayers.length,
  );

  // schedule hydrate에는 confirmed starter 전용 필드가 확인되지 않음
  const confirmedHome = null;
  const confirmedAway = null;

  const coverageStatus = classifyCoverage({
    probableHome: probableHome != null,
    probableAway: probableAway != null,
    confirmedHome: false,
    confirmedAway: false,
    lineupStatus,
  });

  return {
    gamePk,
    homeTeam,
    awayTeam,
    startTimeKst: kst.time,
    commenceTimeUtc: gameDate,
    probablePitcherHome: probableHome,
    probablePitcherAway: probableAway,
    confirmedStarterHome: confirmedHome,
    confirmedStarterAway: confirmedAway,
    homeBattingOrderCount: homePlayers.length,
    awayBattingOrderCount: awayPlayers.length,
    lineupStatus,
    coverageStatus,
    responseFetchedAt: fetchedAt,
    source: `GET /api/v1/schedule?sportId=1&date=${SCHEDULE_DATE_US}&hydrate=probablePitcher,lineups`,
    detailedState: asString(status?.detailedState),
  };
}

async function main() {
  console.log(`=== MLB Stats API lineup coverage (${TARGET_DATE_KST} KST) ===`);
  console.log("HTML 크롤링 없음. 공개 Stats API만 사용.\n");

  let requestCount = 0;
  const endpointsUsed: string[] = [];
  const endpointSupport: Record<string, string> = {};

  // 1) 경기 목록 1회 (probablePitcher + lineups hydrate — 실제 응답으로 확인됨)
  const schedulePath = `/api/v1/schedule?sportId=1&date=${encodeURIComponent(SCHEDULE_DATE_US)}&hydrate=${encodeURIComponent("probablePitcher,lineups")}`;
  requestCount += 1;
  endpointsUsed.push("GET /api/v1/schedule (hydrate=probablePitcher,lineups)");
  const scheduleResult = await fetchJson(schedulePath);

  if (scheduleResult.status !== 200) {
    endpointSupport.schedule = `unavailable:${scheduleResult.status}`;
    const output = {
      meta: {
        version: "mlb-statsapi-lineup-coverage-v1",
        generatedAt: new Date().toISOString(),
        targetDateKst: TARGET_DATE_KST,
        scheduleDateUs: SCHEDULE_DATE_US,
        engineConnected: false,
        uiConnected: false,
        htmlCrawlingUsed: false,
      },
      legalNotes: [
        "공식 라이선스 계약 확인 전 공개 서비스 사용 보류",
        "페이지 HTML 크롤링 미사용",
        "데이터 재배포 권한 미확인",
        "상업적 사용 가능하다고 단정하지 않음",
      ],
      summary: {
        gamesQueriedSuccessfully: 0,
        probablePitcherBothSides: 0,
        confirmedStarterBothSides: 0,
        lineupsBothSides: 0,
        notPublished: 0,
        endpointsUsed,
        requestCount,
        commercialUseAllowed: "미확인 — 계약 전 사용 보류",
      },
      endpointSupport,
      games: [] as GameCoverage[],
    };
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log("schedule endpoint unavailable");
    return;
  }
  endpointSupport.schedule = "available";

  const root = asRecord(scheduleResult.data);
  const dates = Array.isArray(root?.dates) ? root.dates : [];
  const rawGames: unknown[] = [];
  for (const day of dates) {
    const dayRow = asRecord(day);
    if (Array.isArray(dayRow?.games)) rawGames.push(...dayRow.games);
  }

  const games = rawGames
    .map((raw) => mapScheduleGame(raw, scheduleResult.fetchedAt))
    .filter((game): game is GameCoverage => game != null)
    .sort((a, b) => {
      const t = (a.commenceTimeUtc ?? "").localeCompare(b.commenceTimeUtc ?? "");
      if (t !== 0) return t;
      return a.gamePk - b.gamePk;
    });

  // 2) endpoint 존재 확인용 — 샘플 gamePk 각 1회만 (전체 15경기 폴링 금지)
  const samplePk = games[0]?.gamePk ?? null;
  if (samplePk != null) {
    const feedPath = `/api/v1.1/game/${samplePk}/feed/live`;
    requestCount += 1;
    endpointsUsed.push("GET /api/v1.1/game/{gamePk}/feed/live (sample probe)");
    const feed = await fetchJson(feedPath);
    endpointSupport.gameFeedLive =
      feed.status === 200 ? "available" : `unavailable:${feed.status}`;

    if (feed.status === 200) {
      const feedRoot = asRecord(feed.data);
      const gameData = asRecord(feedRoot?.gameData);
      const abstractState = asString(
        asRecord(gameData?.status)?.abstractGameState,
      );
      // Live/Final 에서만 boxscore pitchers를 confirmed 후보로 인정 (Preview는 probable과 구분 필드 없음)
      if (abstractState === "Live" || abstractState === "Final") {
        const liveData = asRecord(feedRoot?.liveData);
        const boxscore = asRecord(liveData?.boxscore);
        const teams = asRecord(boxscore?.teams);
        const home = asRecord(teams?.home);
        const away = asRecord(teams?.away);
        const homePitchers = Array.isArray(home?.pitchers) ? home.pitchers : [];
        const awayPitchers = Array.isArray(away?.pitchers) ? away.pitchers : [];
        const homePlayers = asRecord(home?.players) ?? {};
        const awayPlayers = asRecord(away?.players) ?? {};
        const homeId = asNumber(homePitchers[0]);
        const awayId = asNumber(awayPitchers[0]);
        if (games[0]) {
          games[0].confirmedStarterHome =
            homeId == null
              ? null
              : {
                  id: homeId,
                  fullName: asString(
                    asRecord(asRecord(homePlayers[`ID${homeId}`])?.person)
                      ?.fullName,
                  ),
                };
          games[0].confirmedStarterAway =
            awayId == null
              ? null
              : {
                  id: awayId,
                  fullName: asString(
                    asRecord(asRecord(awayPlayers[`ID${awayId}`])?.person)
                      ?.fullName,
                  ),
                };
          games[0].coverageStatus = classifyCoverage({
            probableHome: games[0].probablePitcherHome != null,
            probableAway: games[0].probablePitcherAway != null,
            confirmedHome: games[0].confirmedStarterHome != null,
            confirmedAway: games[0].confirmedStarterAway != null,
            lineupStatus: games[0].lineupStatus,
          });
        }
      }
    }

    const boxPath = `/api/v1/game/${samplePk}/boxscore`;
    requestCount += 1;
    endpointsUsed.push("GET /api/v1/game/{gamePk}/boxscore (sample probe)");
    const box = await fetchJson(boxPath);
    endpointSupport.boxscore =
      box.status === 200 ? "available" : `unavailable:${box.status}`;
  }

  const probableBoth = games.filter(
    (g) => g.probablePitcherHome != null && g.probablePitcherAway != null,
  ).length;
  const confirmedBoth = games.filter(
    (g) => g.confirmedStarterHome != null && g.confirmedStarterAway != null,
  ).length;
  const lineupsBoth = games.filter(
    (g) => g.lineupStatus === "BOTH_PUBLISHED",
  ).length;
  const notPublished = games.filter(
    (g) => g.coverageStatus === "NOT_PUBLISHED",
  ).length;
  const ambiguous = games.filter(
    (g) => g.coverageStatus === "AMBIGUOUS",
  ).length;
  const pitchersOnly = games.filter(
    (g) => g.coverageStatus === "PITCHERS_ONLY",
  ).length;

  const output = {
    meta: {
      version: "mlb-statsapi-lineup-coverage-v1",
      generatedAt: new Date().toISOString(),
      targetDateKst: TARGET_DATE_KST,
      scheduleDateUs: SCHEDULE_DATE_US,
      baseUrl: BASE_URL,
      engineConnected: false,
      uiConnected: false,
      htmlCrawlingUsed: false,
      browserAutomationUsed: false,
      note: "공개 Stats API 조회·구조 검증만. 원본 전체 응답 미저장.",
    },
    legalNotes: [
      "공식 라이선스 계약 확인 전 공개 서비스 사용 보류",
      "페이지 HTML 크롤링 미사용",
      "데이터 재배포 권한 미확인",
      "상업적 사용 가능하다고 단정하지 않음",
    ],
    endpoints: {
      used: endpointsUsed,
      support: endpointSupport,
      hydrateConfirmedInResponse: ["probablePitcher", "lineups"],
      hydrateRejectedOrEmptyInResponse: ["lineup"],
      confirmedStarterNote:
        "Preview 상태 schedule/boxscore에서 probable과 구분되는 confirmed starter 전용 필드는 확인되지 않음. Live/Final pitchers[0]만 confirmed 후보로 인정.",
    },
    requestProtection: {
      scheduleCalls: 1,
      perGameMassPolling: false,
      duplicateGamePkCallsForbidden: true,
      inMemoryCacheEntries: MEMORY_CACHE.size,
      requestCount,
    },
    summary: {
      gamesQueriedSuccessfully: games.length,
      probablePitcherBothSides: probableBoth,
      confirmedStarterBothSides: confirmedBoth,
      lineupsBothSides: lineupsBoth,
      pitchersOnly,
      ambiguous,
      notPublished,
      endpointsUsed,
      requestCount,
      commercialUseAllowed: "미확인 — 공식 라이선스 계약 전 공개 서비스 사용 보류",
    },
    games,
  };

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`조회 성공 경기 수: ${games.length}`);
  console.log(`probable pitcher(양팀): ${probableBoth}`);
  console.log(`confirmed starter(양팀): ${confirmedBoth}`);
  console.log(`라인업(양팀): ${lineupsBoth}`);
  console.log(`NOT_PUBLISHED: ${notPublished}`);
  console.log(`AMBIGUOUS: ${ambiguous}`);
  console.log(`PITCHERS_ONLY: ${pitchersOnly}`);
  console.log(`사용 endpoint: ${endpointsUsed.join(" | ")}`);
  console.log(`요청 수: ${requestCount}`);
  console.log(
    "상업 서비스 사용 가능 여부: 미확인 — 공식 라이선스 계약 전 사용 보류",
  );
  console.log(`저장: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("FAILED:", message);
  process.exitCode = 1;
});
