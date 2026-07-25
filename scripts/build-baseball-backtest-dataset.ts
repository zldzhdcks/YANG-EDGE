/**
 * API-BASEBALL 2024 KBO·NPB 종료 경기 → EDGE Engine 백테스트 로컬 데이터셋
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/build-baseball-backtest-dataset.ts
 *
 * 환경변수 (서버 전용, NEXT_PUBLIC_ 금지):
 *   BASEBALL_API_KEY        (없으면 FOOTBALL_API_KEY 재사용)
 *   BASEBALL_API_BASE_URL   (선택, 기본 https://v1.baseball.api-sports.io)
 *
 * - 총 API 호출 2회 (KBO 1 + NPB 1)
 * - Engine / UI / Provider 미연결
 * - API 키 로그 금지
 * - 임의 데이터 생성 금지
 */
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const BASE_URL =
  (process.env.BASEBALL_API_BASE_URL ?? "").trim() ||
  "https://v1.baseball.api-sports.io";
const API_KEY =
  (process.env.BASEBALL_API_KEY ?? "").trim() ||
  (process.env.FOOTBALL_API_KEY ?? "").trim();

const SEASON = 2024;
const LEAGUES = [
  { leagueId: 5, leagueName: "KBO" },
  { leagueId: 2, leagueName: "NPB" },
] as const;

const OUT_PATH = path.join(
  process.cwd(),
  "data",
  "backtest",
  "baseball-2024.json",
);

/** 종료로 인정하는 status.short (API-BASEBALL) */
const FINISHED_STATUS = new Set(["FT", "AOT", "AP"]);

type Winner = "home" | "away" | "draw";

type BacktestGame = {
  providerGameId: number;
  leagueId: number;
  leagueName: string;
  season: number;
  date: string;
  startTime: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  winner: Winner;
  status: string;
};

type DatasetFile = {
  meta: {
    generatedAt: string;
    season: number;
    leagues: Array<{ leagueId: number; leagueName: string }>;
    totalGames: number;
    note: string;
  };
  games: BacktestGame[];
};

type RawGame = {
  id?: number;
  date?: string;
  time?: string;
  timestamp?: number;
  status?: { short?: string; long?: string };
  league?: { id?: number; name?: string; season?: number };
  teams?: {
    home?: { id?: number; name?: string };
    away?: { id?: number; name?: string };
  };
  scores?: {
    home?: {
      total?: number | null;
      hits?: number | null;
      errors?: number | null;
      innings?: Record<string, number | null>;
    };
    away?: {
      total?: number | null;
      hits?: number | null;
      errors?: number | null;
      innings?: Record<string, number | null>;
    };
  };
};

type ExcludeReason =
  | "not-finished"
  | "missing-id"
  | "missing-teams"
  | "null-score"
  | "invalid-date"
  | "duplicate";

let callCount = 0;

function maskKey(text: string): string {
  return text.replace(/x-apisports-key[^,\s]*/gi, "***").replace(
    /api[_-]?key[=:]\s*[^\s&]+/gi,
    "apiKey=***",
  );
}

async function fetchLeagueGames(leagueId: number): Promise<{
  games: RawGame[];
  remaining: string | null;
  used: string | null;
}> {
  callCount += 1;
  const url = `${BASE_URL}/games?league=${leagueId}&season=${SEASON}`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": API_KEY },
  });

  const remaining = res.headers.get("x-ratelimit-requests-remaining");
  const used = res.headers.get("x-ratelimit-requests-used");

  const body = (await res.json()) as {
    results?: number;
    errors?: unknown;
    response?: RawGame[];
  };

  if (!res.ok) {
    throw new Error(
      maskKey(`HTTP ${res.status} league=${leagueId}: ${JSON.stringify(body.errors ?? body)}`),
    );
  }

  const err =
    body.errors == null
      ? ""
      : typeof body.errors === "object"
        ? Object.values(body.errors as Record<string, unknown>).join("; ")
        : String(body.errors);
  if (err) {
    throw new Error(maskKey(`API error league=${leagueId}: ${err}`));
  }

  console.log(
    `  [call ${callCount}] GET /games league=${leagueId}&season=${SEASON}` +
      ` → HTTP ${res.status}, results=${body.results ?? body.response?.length ?? 0}` +
      ` remaining=${remaining ?? "?"} used=${used ?? "?"}`,
  );

  return {
    games: Array.isArray(body.response) ? body.response : [],
    remaining,
    used,
  };
}

function parseDateParts(raw: RawGame): { date: string; startTime: string } | null {
  // date 예: "2024-03-23T05:00:00+00:00"
  const iso = (raw.date ?? "").trim();
  if (!iso) return null;

  const dateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  if (!dateMatch) return null;
  const date = dateMatch[1];

  // time 필드가 "HH:MM" 또는 "HH:MM:SS" 인 경우 우선
  const timeField = (raw.time ?? "").trim();
  if (/^\d{2}:\d{2}/.test(timeField)) {
    return { date, startTime: timeField.slice(0, 5) };
  }

  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  // UTC 시각을 HH:mm 으로 보관 (백테스트용 — 원본 타임스탬프 기준)
  const d = new Date(t);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return { date, startTime: `${hh}:${mm}` };
}

function readScore(side: RawGame["scores"], which: "home" | "away"): number | null {
  const total = side?.[which]?.total;
  if (total == null) return null;
  if (typeof total !== "number" || !Number.isFinite(total)) return null;
  return total;
}

function mapGame(
  raw: RawGame,
  leagueId: number,
  leagueName: string,
): { game: BacktestGame } | { exclude: ExcludeReason } {
  const status = (raw.status?.short ?? "").trim().toUpperCase();
  if (!FINISHED_STATUS.has(status)) {
    return { exclude: "not-finished" };
  }

  if (raw.id == null || !Number.isFinite(raw.id)) {
    return { exclude: "missing-id" };
  }

  const homeId = raw.teams?.home?.id;
  const awayId = raw.teams?.away?.id;
  const homeName = raw.teams?.home?.name?.trim();
  const awayName = raw.teams?.away?.name?.trim();
  if (
    homeId == null ||
    awayId == null ||
    !homeName ||
    !awayName ||
    !Number.isFinite(homeId) ||
    !Number.isFinite(awayId)
  ) {
    return { exclude: "missing-teams" };
  }

  const homeScore = readScore(raw.scores, "home");
  const awayScore = readScore(raw.scores, "away");
  if (homeScore == null || awayScore == null) {
    return { exclude: "null-score" };
  }

  const parts = parseDateParts(raw);
  if (!parts) return { exclude: "invalid-date" };

  let winner: Winner;
  if (homeScore > awayScore) winner = "home";
  else if (awayScore > homeScore) winner = "away";
  else winner = "draw";

  return {
    game: {
      providerGameId: raw.id,
      leagueId,
      leagueName,
      season: SEASON,
      date: parts.date,
      startTime: parts.startTime,
      homeTeamId: homeId,
      homeTeamName: homeName,
      awayTeamId: awayId,
      awayTeamName: awayName,
      homeScore,
      awayScore,
      winner,
      status,
    },
  };
}

function containsSecrets(jsonText: string): string[] {
  const hits: string[] = [];
  if (/x-apisports-key/i.test(jsonText)) hits.push("x-apisports-key header");
  if (/api[_-]?key/i.test(jsonText)) hits.push("apiKey field");
  if (API_KEY && jsonText.includes(API_KEY)) hits.push("raw API key value");
  if (/Bearer\s+[A-Za-z0-9._\-]+/i.test(jsonText)) hits.push("Bearer token");
  return hits;
}

async function main() {
  if (!API_KEY) {
    console.error(
      "BASEBALL_API_KEY (또는 FOOTBALL_API_KEY) 가 없습니다. .env.local 에 서버 전용으로 추가하세요.",
    );
    process.exit(1);
  }

  console.log("=== 백테스트 데이터셋 빌드 (API-BASEBALL 2024) ===");
  console.log("목표 API 호출: 2회 (KBO + NPB)");
  console.log("출력:", OUT_PATH);

  const excludeCounts: Record<ExcludeReason, number> = {
    "not-finished": 0,
    "missing-id": 0,
    "missing-teams": 0,
    "null-score": 0,
    "invalid-date": 0,
    duplicate: 0,
  };

  const byLeague: Record<string, { kept: number; raw: number }> = {};
  const collected: BacktestGame[] = [];
  const seenIds = new Set<number>();
  let lastRemaining: string | null = null;
  let lastUsed: string | null = null;

  for (const league of LEAGUES) {
    console.log(`\n--- ${league.leagueName} (id=${league.leagueId}) ---`);
    const { games: rawGames, remaining, used } = await fetchLeagueGames(
      league.leagueId,
    );
    lastRemaining = remaining;
    lastUsed = used;
    byLeague[league.leagueName] = { kept: 0, raw: rawGames.length };

    for (const raw of rawGames) {
      const mapped = mapGame(raw, league.leagueId, league.leagueName);
      if ("exclude" in mapped) {
        excludeCounts[mapped.exclude] += 1;
        continue;
      }
      if (seenIds.has(mapped.game.providerGameId)) {
        excludeCounts.duplicate += 1;
        continue;
      }
      seenIds.add(mapped.game.providerGameId);
      collected.push(mapped.game);
      byLeague[league.leagueName].kept += 1;
    }
  }

  collected.sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    if (d !== 0) return d;
    const t = a.startTime.localeCompare(b.startTime);
    if (t !== 0) return t;
    return a.providerGameId - b.providerGameId;
  });

  const dataset: DatasetFile = {
    meta: {
      generatedAt: new Date().toISOString(),
      season: SEASON,
      leagues: LEAGUES.map((l) => ({
        leagueId: l.leagueId,
        leagueName: l.leagueName,
      })),
      totalGames: collected.length,
      note: "향후 각 경기 이전 데이터만 사용해 특징을 계산해야 함",
    },
    games: collected,
  };

  const jsonText = `${JSON.stringify(dataset, null, 2)}\n`;
  const secrets = containsSecrets(jsonText);
  if (secrets.length > 0) {
    console.error("민감정보 감지 — 파일 저장 중단:", secrets.join(", "));
    process.exit(1);
  }

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, jsonText, "utf8");
  const fileStat = await stat(OUT_PATH);
  const sizeKb = (fileStat.size / 1024).toFixed(1);

  const first = collected[0];
  const last = collected[collected.length - 1];
  const excludedTotal = Object.values(excludeCounts).reduce((a, b) => a + b, 0);

  console.log("\n=== 검증 출력 ===");
  console.log(`API 호출 수        : ${callCount}`);
  console.log(`KBO 저장 경기 수   : ${byLeague.KBO?.kept ?? 0} (원본 ${byLeague.KBO?.raw ?? 0})`);
  console.log(`NPB 저장 경기 수   : ${byLeague.NPB?.kept ?? 0} (원본 ${byLeague.NPB?.raw ?? 0})`);
  console.log(`전체 저장 경기 수  : ${collected.length}`);
  console.log(`제외 경기 수       : ${excludedTotal}`);
  for (const [reason, count] of Object.entries(excludeCounts)) {
    if (count > 0) console.log(`  - ${reason}: ${count}`);
  }
  console.log(
    "첫 경기            :",
    first
      ? `${first.date} ${first.startTime} [${first.leagueName}] ${first.homeTeamName} ${first.homeScore}-${first.awayScore} ${first.awayTeamName}`
      : "(없음)",
  );
  console.log(
    "마지막 경기        :",
    last
      ? `${last.date} ${last.startTime} [${last.leagueName}] ${last.homeTeamName} ${last.homeScore}-${last.awayScore} ${last.awayTeamName}`
      : "(없음)",
  );
  console.log(`중복 제거          : ${excludeCounts.duplicate}`);
  console.log(`파일 크기          : ${sizeKb} KB (${fileStat.size} bytes)`);
  console.log(`민감정보 포함      : 없음`);
  console.log(`API remaining/used : ${lastRemaining ?? "?"} / ${lastUsed ?? "?"}`);
  console.log(`저장 경로          : ${OUT_PATH}`);
}

main().catch((e) => {
  console.error("FAILED:", maskKey(e instanceof Error ? e.message : String(e)));
  process.exit(1);
});
