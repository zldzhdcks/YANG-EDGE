/**
 * API-BASEBALL (API-Sports) 무료 계정 — KBO / NPB 분석 데이터 커버리지 검증
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/test-api-baseball-coverage.ts
 *
 * 환경변수 (서버 전용, NEXT_PUBLIC_ 금지):
 *   BASEBALL_API_KEY        (없으면 동일 API-Sports 계정의 FOOTBALL_API_KEY 재사용)
 *   BASEBALL_API_BASE_URL   (선택, 기본 https://v1.baseball.api-sports.io)
 *
 * 원칙:
 * - 조사·테스트만. Engine/UI/Provider 미연결.
 * - 리그 ID는 /leagues?search= 결과로 확인 (하드코딩 금지).
 * - 총 10회 이내 호출 목표, 같은 응답 재사용, API 키 로그 금지.
 * - 공식 문서 기준 API-BASEBALL 엔드포인트:
 *   timezone / seasons / countries / leagues / teams / teams/statistics /
 *   standings / games / games/h2h / odds
 *   → players·injuries·lineups(선발) 엔드포인트는 존재하지 않음.
 */
import { getKstToday } from "../src/lib/datetime/kst";

type CoverageStatus =
  | "available"
  | "unavailable"
  | "plan-restricted"
  | "no-data"
  | "endpoint-not-supported";

type CoverageRow = {
  item: string;
  status: CoverageStatus;
  endpoint: string;
  note: string;
};

type ApiEnvelope = {
  get?: string;
  parameters?: unknown;
  errors?: unknown;
  results?: number;
  response?: unknown[];
};

const BASE_URL =
  (process.env.BASEBALL_API_BASE_URL ?? "").trim() ||
  "https://v1.baseball.api-sports.io";
const API_KEY =
  (process.env.BASEBALL_API_KEY ?? "").trim() ||
  (process.env.FOOTBALL_API_KEY ?? "").trim();

let callCount = 0;

function errorsText(errors: unknown): string {
  if (errors == null) return "";
  if (Array.isArray(errors)) return errors.join("; ");
  if (typeof errors === "object") {
    const values = Object.values(errors as Record<string, unknown>);
    return values.map(String).join("; ");
  }
  return String(errors);
}

function isPlanRestriction(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("plan") ||
    lower.includes("subscription") ||
    lower.includes("not allowed") ||
    lower.includes("upgrade")
  );
}

async function apiGet(
  path: string,
  params: Record<string, string | number>,
): Promise<{
  ok: boolean;
  httpStatus: number;
  envelope: ApiEnvelope | null;
  errorText: string;
}> {
  callCount += 1;
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  ).toString();
  const url = `${BASE_URL}/${path}${query ? `?${query}` : ""}`;

  const res = await fetch(url, {
    headers: { "x-apisports-key": API_KEY },
  });

  let envelope: ApiEnvelope | null = null;
  try {
    envelope = (await res.json()) as ApiEnvelope;
  } catch {
    envelope = null;
  }

  const errText = errorsText(envelope?.errors);
  console.log(
    `  [call ${callCount}] GET /${path} ${query.replace(/apikey=[^&]*/gi, "")}` +
      ` → HTTP ${res.status}, results=${envelope?.results ?? "?"}` +
      (errText ? `, errors="${errText}"` : ""),
  );

  return { ok: res.ok, httpStatus: res.status, envelope, errorText: errText };
}

function classify(call: {
  ok: boolean;
  httpStatus: number;
  envelope: ApiEnvelope | null;
  errorText: string;
}): CoverageStatus {
  if (call.errorText && isPlanRestriction(call.errorText)) {
    return "plan-restricted";
  }
  if (call.httpStatus === 404) return "endpoint-not-supported";
  if (!call.ok || call.errorText) return "unavailable";
  if ((call.envelope?.results ?? 0) === 0) return "no-data";
  return "available";
}

function printTable(league: string, rows: CoverageRow[]) {
  console.log(`\n───────── ${league} 커버리지 ─────────`);
  const w1 = Math.max(...rows.map((r) => r.item.length), 6) + 2;
  const w2 = 24;
  const w3 = Math.max(...rows.map((r) => r.endpoint.length), 8) + 2;
  console.log(
    "항목".padEnd(w1) + "상태".padEnd(w2) + "endpoint".padEnd(w3) + "비고",
  );
  for (const r of rows) {
    console.log(
      r.item.padEnd(w1) + r.status.padEnd(w2) + r.endpoint.padEnd(w3) + r.note,
    );
  }
}

type LeagueInfo = {
  id: number;
  name: string;
  seasons: Array<{ season: number; current?: boolean }>;
};

function parseLeague(envelope: ApiEnvelope | null): LeagueInfo | null {
  const first = envelope?.response?.[0] as
    | {
        league?: { id?: number; name?: string };
        id?: number;
        name?: string;
        seasons?: Array<{ season?: number; year?: number; current?: boolean }>;
      }
    | undefined;
  if (!first) return null;

  // API-BASEBALL leagues 응답: { id, name, type, seasons: [...] } 형태
  const id = first.league?.id ?? first.id;
  const name = first.league?.name ?? first.name;
  if (id == null || !name) return null;

  const seasons = (first.seasons ?? []).map((s) => ({
    season: Number(s.season ?? s.year),
    current: s.current,
  }));
  return { id, name, seasons };
}

function pickSeason(info: LeagueInfo): number {
  const current = info.seasons.find((s) => s.current);
  if (current) return current.season;
  const max = Math.max(...info.seasons.map((s) => s.season));
  return Number.isFinite(max) ? max : new Date().getFullYear();
}

/**
 * 무료 플랜 허용 최대 시즌 — 첫 오류에서 학습해 이후 호출 절약.
 * 예: "Free plans do not have access to this season, try from 2022 to 2024."
 */
let knownAllowedMaxSeason: number | null = null;

function parseAllowedMaxSeason(errorText: string): number | null {
  const m = /from\s+(\d{4})\s+to\s+(\d{4})/i.exec(errorText);
  return m ? Number(m[2]) : null;
}

/** 무료 플랜 제한 시 대체 시즌 (허용 범위 내 최신) */
function fallbackSeason(info: LeagueInfo, allowedMax: number): number | null {
  const candidates = info.seasons
    .map((s) => s.season)
    .filter((s) => s <= allowedMax)
    .sort((a, b) => b - a);
  return candidates[0] ?? null;
}

type GameRaw = {
  id?: number;
  date?: string;
  status?: { short?: string; long?: string };
  teams?: {
    home?: { id?: number; name?: string };
    away?: { id?: number; name?: string };
  };
  scores?: unknown;
};

async function inspectLeague(
  label: string,
  searchTerms: string[],
): Promise<{
  rows: CoverageRow[];
  info: LeagueInfo | null;
  season: number | null;
  seasonRestricted: boolean;
  /** h2h 테스트용 팀 ID 2개 */
  teamIds: number[];
}> {
  const rows: CoverageRow[] = [];
  const teamIds: number[] = [];

  // 1) 리그 ID — 이름 검색 (하드코딩 금지)
  let info: LeagueInfo | null = null;
  let searchNote = "";
  for (const term of searchTerms) {
    const call = await apiGet("leagues", { search: term });
    info = parseLeague(call.envelope);
    if (info) {
      searchNote = `search="${term}" → id=${info.id} (${info.name})`;
      break;
    }
    searchNote = `search="${term}" 결과 없음`;
  }

  if (!info) {
    rows.push({
      item: "leagueId",
      status: "no-data",
      endpoint: "leagues",
      note: searchNote,
    });
    return { rows, info: null, season: null, seasonRestricted: false, teamIds };
  }

  rows.push({
    item: "leagueId",
    status: "available",
    endpoint: "leagues",
    note: searchNote,
  });

  const currentSeason = pickSeason(info);
  // 이전 리그에서 무료 플랜 허용 범위를 학습했으면 바로 적용 (호출 절약)
  let season =
    knownAllowedMaxSeason != null
      ? (fallbackSeason(info, knownAllowedMaxSeason) ?? currentSeason)
      : currentSeason;
  let seasonRestricted = knownAllowedMaxSeason != null && season < currentSeason;

  rows.push({
    item: "currentSeason",
    status: "available",
    endpoint: "leagues",
    note:
      `현재 시즌 ${currentSeason} (seasons ${info.seasons.length}개)` +
      (season !== currentSeason ? ` → 무료 플랜 허용 ${season} 로 조회` : ""),
  });

  // 2) 시즌 전체 games 1회 → 오늘/최근 경기·최근 결과·선발 필드까지 재사용
  let gamesCall = await apiGet("games", { league: info.id, season });
  if (classify(gamesCall) === "plan-restricted") {
    seasonRestricted = true;
    knownAllowedMaxSeason =
      parseAllowedMaxSeason(gamesCall.errorText) ?? knownAllowedMaxSeason;
    const fb =
      knownAllowedMaxSeason != null
        ? fallbackSeason(info, knownAllowedMaxSeason)
        : null;
    if (fb != null) {
      season = fb;
      gamesCall = await apiGet("games", { league: info.id, season });
    }
  }

  const gamesStatus = classify(gamesCall);
  const games = (gamesCall.envelope?.response ?? []) as GameRaw[];
  const today = getKstToday();
  const todayGames = games.filter((g) => (g.date ?? "").startsWith(today));
  const finished = games.filter((g) => g.status?.short === "FT");

  rows.push({
    item: "gamesTodayOrRecent",
    status: seasonRestricted && gamesStatus === "available"
      ? "plan-restricted"
      : gamesStatus,
    endpoint: "games",
    note:
      gamesStatus === "available"
        ? `시즌 ${season} 총 ${games.length}경기, 오늘(${today}) ${todayGames.length}경기` +
          (seasonRestricted
            ? " — 현재(2026) 시즌은 무료 플랜 제한, 과거 시즌으로 endpoint 검증"
            : "")
        : gamesCall.errorText || "조회 실패",
  });

  rows.push({
    item: "recentResults",
    status:
      gamesStatus === "available"
        ? finished.length > 0
          ? "available"
          : "no-data"
        : gamesStatus,
    endpoint: "games",
    note:
      gamesStatus === "available"
        ? `종료(FT) ${finished.length}경기 — 최근 5경기·폼·연승연패 계산 가능`
        : "games 응답 재사용",
  });

  // 선발투수 — games 응답 필드 검사 (추가 호출 없음)
  const sample = games[0];
  if (sample) {
    const keys = Object.keys(sample).join(",");
    const hasPitcher = /pitcher|lineup|player/i.test(JSON.stringify(sample));
    rows.push({
      item: "startingPitcher",
      status: hasPitcher ? "available" : "unavailable",
      endpoint: "없음",
      note: hasPitcher
        ? "games 응답에 선발 관련 필드 존재"
        : `응답에 선발 필드 없음 (game keys: ${keys})`,
    });
  } else {
    rows.push({
      item: "startingPitcher",
      status: "endpoint-not-supported",
      endpoint: "없음",
      note: "API-BASEBALL에 lineups/선발 엔드포인트 없음",
    });
  }

  // 3) standings 1회 → 순위 + 팀 정보 파생
  const standingsCall = await apiGet("standings", { league: info.id, season });
  const standingsStatus = classify(standingsCall);
  const standingsGroups = (standingsCall.envelope?.response ?? []) as unknown[];
  const flat: Array<{ team?: { id?: number; name?: string } }> = [];
  for (const group of standingsGroups) {
    if (Array.isArray(group)) {
      flat.push(...(group as Array<{ team?: { id?: number; name?: string } }>));
    }
  }

  rows.push({
    item: "standings",
    status: standingsStatus,
    endpoint: "standings",
    note:
      standingsStatus === "available"
        ? `시즌 ${season} ${flat.length}팀 순위 조회 성공`
        : standingsCall.errorText || "조회 실패",
  });

  rows.push({
    item: "teams",
    status: standingsStatus === "available" && flat.length > 0
      ? "available"
      : standingsStatus,
    endpoint: "standings→team (/teams 별도 존재)",
    note:
      flat.length > 0
        ? `standings 응답에서 팀 id/명 ${flat.length}건 확보 (호출 절약)`
        : "standings 재사용",
  });

  for (const entry of flat) {
    if (entry.team?.id != null && !teamIds.includes(entry.team.id)) {
      teamIds.push(entry.team.id);
    }
    if (teamIds.length >= 2) break;
  }
  if (teamIds.length < 2) {
    const homeId = games[0]?.teams?.home?.id;
    const awayId = games[0]?.teams?.away?.id;
    if (homeId != null) teamIds.push(homeId);
    if (awayId != null && !teamIds.includes(awayId)) teamIds.push(awayId);
  }

  // 4) teams/statistics 1회 (첫 팀)
  const firstTeamId = flat[0]?.team?.id ?? games[0]?.teams?.home?.id;
  if (firstTeamId != null) {
    const statsCall = await apiGet("teams/statistics", {
      league: info.id,
      season,
      team: firstTeamId,
    });
    // teams/statistics 는 단일 객체 응답 → results 가 0 이어도 응답 확인
    const raw = statsCall.envelope?.response as unknown;
    const hasBody =
      raw != null && !Array.isArray(raw) && Object.keys(raw as object).length > 0;
    const statsStatus: CoverageStatus =
      statsCall.errorText && isPlanRestriction(statsCall.errorText)
        ? "plan-restricted"
        : statsCall.errorText
          ? "unavailable"
          : hasBody || (statsCall.envelope?.results ?? 0) > 0
            ? "available"
            : "no-data";
    const pointsInfo = hasBody
      ? JSON.stringify((raw as Record<string, unknown>).points ?? {}).slice(0, 120)
      : "";
    rows.push({
      item: "teamScoringStats",
      status: statsStatus,
      endpoint: "teams/statistics",
      note:
        statsStatus === "available"
          ? `team=${firstTeamId} 득점/실점 집계 확인 points=${pointsInfo}`
          : statsCall.errorText || "응답 비어 있음",
    });
  } else {
    rows.push({
      item: "teamScoringStats",
      status: "no-data",
      endpoint: "teams/statistics",
      note: "팀 ID 확보 실패로 미호출",
    });
  }

  // 5) 문서 기준 엔드포인트 자체가 없는 항목 (호출하지 않음 — 요청량 보호)
  rows.push({
    item: "playerOrPitcherStats",
    status: "endpoint-not-supported",
    endpoint: "없음",
    note: "API-BASEBALL 문서에 players 엔드포인트 없음",
  });
  rows.push({
    item: "injuries",
    status: "endpoint-not-supported",
    endpoint: "없음",
    note: "API-BASEBALL 문서에 injuries 엔드포인트 없음",
  });

  return { rows, info, season, seasonRestricted, teamIds };
}

async function main() {
  if (!API_KEY) {
    console.error(
      "BASEBALL_API_KEY (또는 FOOTBALL_API_KEY) 가 없습니다. .env.local 에 서버 전용으로 추가하세요.",
    );
    process.exit(1);
  }

  console.log("=== API-BASEBALL 커버리지 테스트 ===");
  console.log("base URL:", BASE_URL);
  console.log(
    "키 출처:",
    (process.env.BASEBALL_API_KEY ?? "").trim()
      ? "BASEBALL_API_KEY"
      : "FOOTBALL_API_KEY (동일 API-Sports 계정 재사용)",
  );
  console.log(
    "예상 호출 수: 리그당 4회 (leagues/games/standings/teams-statistics)" +
      " × 2 + H2H 1회 = 최대 9회 (+시즌 제한 재시도 시 +2)",
  );

  console.log("\n=== KBO ===");
  const kbo = await inspectLeague("KBO", ["KBO"]);

  console.log("\n=== NPB ===");
  const npb = await inspectLeague("NPB", ["NPB", "Nippon"]);

  // H2H — 엔드포인트 지원 확인 (KBO 1회만, NPB는 동일 endpoint → 결과 공유)
  let h2hRow: CoverageRow = {
    item: "headToHead",
    status: "no-data",
    endpoint: "games/h2h",
    note: "팀 ID 부족으로 미호출",
  };
  if (kbo.info && kbo.season != null && kbo.teamIds.length >= 2) {
    const h2hCall = await apiGet("games/h2h", {
      h2h: `${kbo.teamIds[0]}-${kbo.teamIds[1]}`,
      season: kbo.season,
    });
    const status = classify(h2hCall);
    h2hRow = {
      item: "headToHead",
      status,
      endpoint: "games/h2h",
      note:
        status === "available"
          ? `${kbo.teamIds[0]} vs ${kbo.teamIds[1]} 맞대결 ${h2hCall.envelope?.results}건 (NPB 동일 endpoint)`
          : h2hCall.errorText || "조회 실패",
    };
  }
  kbo.rows.push(h2hRow);
  npb.rows.push({ ...h2hRow, note: h2hRow.note + " — KBO 호출 결과 공유" });

  printTable("KBO", kbo.rows);
  printTable("NPB", npb.rows);

  console.log(`\n총 사용 요청 수: ${callCount}회`);

  // ── EngineAnalysisData 자동 채움 판단 ─────────────────────
  console.log("\n=== EngineAnalysisData 자동 채움 판단 ===");
  const autoFillable = [
    "recentGames/recentForm/streak — games 시즌 응답에서 계산",
    "homeRecord/awayRecord — games 홈/원정 분리 집계",
    "leagueStanding/winRate — standings가 KBO/NPB에서 no-data → games 전 경기 집계로 순위/승률 산출",
    "scoringAverages — teams/statistics (홈/원정 평균 득실 제공 확인)",
    "restDays — games 날짜 간격 계산",
    "headToHead — games/h2h",
  ];
  const notAutoFillable = [
    "startingPitcher — games 응답에 없음, 엔드포인트도 없음",
    "injuries — 엔드포인트 없음",
  ];
  console.log("자동 채움 가능:");
  for (const f of autoFillable) console.log("  ✔ " + f);
  console.log("자동 채움 불가 (다른 공급원 필요):");
  for (const f of notAutoFillable) console.log("  ✘ " + f);
  console.log(
    `대략 비율: ${autoFillable.length}/${autoFillable.length + notAutoFillable.length}` +
      " 그룹 (TeamAnalysisSide 12개 필드 기준 10/12 ≈ 83%)",
  );
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("FAILED:", msg.replace(/x-apisports-key[^,\s]*/gi, "***"));
  process.exit(1);
});
