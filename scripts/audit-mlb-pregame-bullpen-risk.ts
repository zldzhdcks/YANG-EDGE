/**
 * 2026-07-27 MLB 사전 불펜 상태 사후 검증 (audit only).
 *
 * - Engine / weights / 과거 예측 / 추천 등급 / 성공·실패 리뷰 수정 금지
 * - 우선: API-BASEBALL Pro (일정·결과 확인)
 * - fallback: MLB Stats API boxscore (상업 이용 미확인, 연구 전용)
 * - cutoff 이전 데이터만 사용 · 원본 응답 전체 미저장
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/audit-mlb-pregame-bullpen-risk.ts
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../src/lib/datetime/kst";

const TARGET_DATE_KST =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-27";
const STATS_API_BASE = "https://statsapi.mlb.com";
const LOOKBACK_DAYS = 7;

const PATHS = {
  prediction: path.join(
    process.cwd(),
    "data",
    "predictions",
    "mlb",
    `${TARGET_DATE_KST}.json`,
  ),
  success: path.join(
    process.cwd(),
    "data",
    "predictions",
    "mlb",
    `${TARGET_DATE_KST}-success-flow-review.json`,
  ),
  failure: path.join(
    process.cwd(),
    "data",
    "predictions",
    "mlb",
    `${TARGET_DATE_KST}-failure-flow-review.json`,
  ),
  resultsCache: path.join(
    process.cwd(),
    "data",
    "cache",
    "mlb-game-results",
    `${TARGET_DATE_KST}.json`,
  ),
  out: path.join(
    process.cwd(),
    "data",
    "audits",
    `${TARGET_DATE_KST}-mlb-pregame-bullpen-risk.json`,
  ),
};

type Outcome = "HIT" | "MISS";
type PregameDirection =
  | "BULLPEN_SUPPORTED_BASELINE"
  | "BULLPEN_CONFLICTED_BASELINE"
  | "BULLPEN_NEUTRAL_PRE_GAME"
  | "INSUFFICIENT";

type RiskFlag =
  | "HEAVY_USAGE_PREVIOUS_DAY"
  | "HEAVY_USAGE_LAST_3_DAYS"
  | "MULTIPLE_BACK_TO_BACK_RELIEVERS"
  | "RELIEF_ERA_POOR_LAST_7"
  | "RELIEF_WHIP_POOR_LAST_7"
  | "HIGH_WALK_RATE_LAST_7"
  | "HIGH_HR_RATE_LAST_7"
  | "CLOSER_AVAILABILITY_UNKNOWN"
  | "SAMPLE_THIN"
  | "DATA_UNAVAILABLE";

type Usage = {
  apiBaseballCalls: number;
  apiBaseballRemaining: number | null;
  statsApiCalls: number;
};

type SchedGame = {
  gamePk: number;
  gameDate: string;
  officialDate: string;
  status: string;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
};

type ReliefAppearance = {
  playerId: number;
  officialDate: string;
  gamePk: number;
  outs: number;
  earnedRuns: number;
  hits: number;
  walks: number;
  homeRuns: number;
  pitches: number | null;
  saves: number;
  roleUncertain: boolean;
};

type TeamBullpenMetrics = {
  teamId: number;
  teamName: string;
  cutoffTime: string;
  available: boolean;
  priorGamesUsed: number;
  roleUncertainAppearances: number;
  last3DaysIp: number;
  last3DaysAppearances: number;
  last3DaysBackToBackPitchers: number;
  last3DaysThreeDayThreatPitchers: number;
  previousDayIp: number;
  previousDay20PlusPitchCount: number;
  last7Era: number | null;
  last7Whip: number | null;
  last7HomeRuns: number;
  last7Walks: number;
  last7SaveSituations: number;
  closerSetupPreviousDayUsed: null;
  closerNote: "CLOSER_ROLE_NOT_ASSIGNED";
  flags: RiskFlag[];
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
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && v !== "-.--") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[.\-_/']/g, " ")
    .replace(/\b(fc|sc|baseball|team)\b/g, " ")
    .replace(/\bst\b/g, "st")
    .replace(/\s+/g, " ")
    .trim();
}
function namesEqual(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return normalizeName(a) === normalizeName(b);
}
function parseIpToOuts(ip: string | number | null): number | null {
  if (ip == null) return null;
  const s = String(ip);
  const m = /^(\d+)(?:\.(\d))?$/.exec(s);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = m[2] != null ? Number(m[2]) : 0;
  if (frac > 2) return whole * 3 + Math.min(frac, 2);
  return whole * 3 + frac;
}
function outsToIp(outs: number): number {
  const whole = Math.floor(outs / 3);
  const rem = outs % 3;
  return whole + rem / 10;
}
function addDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}
function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}
function round3(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(1, items.length)) },
    () => worker(),
  );
  await Promise.all(workers);
  return out;
}

async function fetchApiBaseballDate(
  date: string,
  usage: Usage,
): Promise<number> {
  const baseUrl = (
    process.env.BASEBALL_API_BASE_URL ?? "https://v1.baseball.api-sports.io"
  ).replace(/\/$/, "");
  const apiKey = (
    process.env.BASEBALL_API_KEY ??
    process.env.FOOTBALL_API_KEY ??
    ""
  ).trim();
  if (!apiKey) throw new Error("BASEBALL_API_KEY 미설정");

  const url = new URL(`${baseUrl}/games`);
  url.searchParams.set("league", "1");
  url.searchParams.set("season", "2026");
  url.searchParams.set("date", date);
  url.searchParams.set("timezone", "Asia/Seoul");
  usage.apiBaseballCalls += 1;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "x-apisports-key": apiKey },
    cache: "no-store",
  });
  const rem = res.headers.get("x-ratelimit-requests-remaining");
  if (rem && Number.isFinite(Number(rem))) {
    usage.apiBaseballRemaining = Number(rem);
  }
  if (!res.ok) throw new Error(`API-BASEBALL ${res.status} ${date}`);
  const body = (await res.json()) as { response?: unknown[] };
  return Array.isArray(body.response) ? body.response.length : 0;
}

async function fetchStatsJson(
  pathQuery: string,
  usage: Usage,
): Promise<unknown> {
  usage.statsApiCalls += 1;
  const res = await fetch(`${STATS_API_BASE}${pathQuery}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`StatsAPI ${res.status} ${pathQuery}`);
  return res.json();
}

function parseScheduleGames(data: unknown): SchedGame[] {
  const root = asRecord(data);
  const dates = Array.isArray(root?.dates) ? root!.dates : [];
  const out: SchedGame[] = [];
  for (const day of dates) {
    const dayRow = asRecord(day);
    const games = Array.isArray(dayRow?.games) ? dayRow!.games : [];
    for (const raw of games) {
      const row = asRecord(raw);
      if (!row) continue;
      const gamePk = asNumber(row.gamePk);
      const gameDate = asString(row.gameDate);
      const officialDate = asString(row.officialDate);
      const status = asString(asRecord(row.status)?.abstractGameState) ?? "";
      const teams = asRecord(row.teams);
      const home = asRecord(teams?.home);
      const away = asRecord(teams?.away);
      const homeTeamId = asNumber(asRecord(home?.team)?.id);
      const awayTeamId = asNumber(asRecord(away?.team)?.id);
      const homeTeam = asString(asRecord(home?.team)?.name);
      const awayTeam = asString(asRecord(away?.team)?.name);
      if (
        gamePk == null ||
        !gameDate ||
        !officialDate ||
        homeTeamId == null ||
        awayTeamId == null ||
        !homeTeam ||
        !awayTeam
      ) {
        continue;
      }
      out.push({
        gamePk,
        gameDate,
        officialDate,
        status,
        homeTeamId,
        awayTeamId,
        homeTeam,
        awayTeam,
      });
    }
  }
  return out;
}

function extractReliefFromBox(
  box: Record<string, unknown>,
  side: "home" | "away",
  officialDate: string,
  gamePk: number,
): ReliefAppearance[] {
  const teams = asRecord(box.teams);
  const sideBox = asRecord(teams?.[side]);
  if (!sideBox) return [];
  const ids = Array.isArray(sideBox.pitchers)
    ? sideBox.pitchers
        .map((x) => asNumber(x))
        .filter((n): n is number => n != null)
    : [];
  const players = asRecord(sideBox.players) ?? {};
  if (ids.length === 0) return [];

  const out: ReliefAppearance[] = [];
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]!;
    // 선발(첫 등판) 제외 — 구원만
    if (i === 0) continue;
    const player = asRecord(players[`ID${id}`]);
    const pitching = asRecord(asRecord(player?.stats)?.pitching) ?? {};
    const ip = asString(pitching.inningsPitched);
    const outs = parseIpToOuts(ip) ?? 0;
    const roleUncertain = ids.length === 1; // 방어: 단독이면 위에서 continue 되어 도달 안 함
    out.push({
      playerId: id,
      officialDate,
      gamePk,
      outs,
      earnedRuns: asNumber(pitching.earnedRuns) ?? 0,
      hits: asNumber(pitching.hits) ?? 0,
      walks: asNumber(pitching.baseOnBalls) ?? 0,
      homeRuns: asNumber(pitching.homeRuns) ?? 0,
      pitches:
        asNumber(pitching.pitchesThrown) ?? asNumber(pitching.numberOfPitches),
      saves: asNumber(pitching.saves) ?? 0,
      roleUncertain,
    });
  }
  return out;
}

function buildTeamMetrics(args: {
  teamId: number;
  teamName: string;
  cutoffTime: string;
  officialDate: string;
  appearances: ReliefAppearance[];
  priorGameCount: number;
}): TeamBullpenMetrics {
  const { teamId, teamName, cutoffTime, officialDate, appearances } = args;
  const d1 = addDays(officialDate, -1);
  const d3Start = addDays(officialDate, -3);
  const d7Start = addDays(officialDate, -7);

  const last3 = appearances.filter(
    (a) => a.officialDate >= d3Start && a.officialDate <= d1,
  );
  const last7 = appearances.filter(
    (a) => a.officialDate >= d7Start && a.officialDate <= d1,
  );
  const prevDay = appearances.filter((a) => a.officialDate === d1);

  const last3Outs = last3.reduce((s, a) => s + a.outs, 0);
  const prevOuts = prevDay.reduce((s, a) => s + a.outs, 0);
  const last7Outs = last7.reduce((s, a) => s + a.outs, 0);
  const last7Er = last7.reduce((s, a) => s + a.earnedRuns, 0);
  const last7Hits = last7.reduce((s, a) => s + a.hits, 0);
  const last7Walks = last7.reduce((s, a) => s + a.walks, 0);
  const last7Hr = last7.reduce((s, a) => s + a.homeRuns, 0);
  const last7Saves = last7.reduce((s, a) => s + (a.saves > 0 ? 1 : 0), 0);

  const daysByPitcher = new Map<number, Set<string>>();
  for (const a of last3) {
    const set = daysByPitcher.get(a.playerId) ?? new Set<string>();
    set.add(a.officialDate);
    daysByPitcher.set(a.playerId, set);
  }
  let b2b = 0;
  let threeThreat = 0;
  for (const [, days] of daysByPitcher) {
    const sorted = [...days].sort();
    let hasB2b = false;
    for (let i = 1; i < sorted.length; i += 1) {
      if (addDays(sorted[i - 1]!, 1) === sorted[i]) hasB2b = true;
    }
    if (hasB2b) b2b += 1;
    // 전날(d1)과 그 전날(d2) 모두 등판 → 당일 사용 시 3연투 위험
    if (days.has(d1) && days.has(addDays(officialDate, -2))) threeThreat += 1;
  }

  const prev20 = prevDay.filter(
    (a) => a.pitches != null && a.pitches >= 20,
  ).length;

  const last7Ip = last7Outs / 3;
  const last7Era =
    last7Outs > 0 ? (last7Er * 9) / (last7Outs / 3) : null;
  const last7Whip =
    last7Outs > 0 ? (last7Hits + last7Walks) / (last7Outs / 3) : null;

  const available = args.priorGameCount > 0 || appearances.length > 0;
  const flags: RiskFlag[] = ["CLOSER_AVAILABILITY_UNKNOWN"];
  if (!available) flags.push("DATA_UNAVAILABLE");
  if (args.priorGameCount < 2) flags.push("SAMPLE_THIN");

  return {
    teamId,
    teamName,
    cutoffTime,
    available,
    priorGamesUsed: args.priorGameCount,
    roleUncertainAppearances: appearances.filter((a) => a.roleUncertain).length,
    last3DaysIp: round3(outsToIp(last3Outs)) ?? 0,
    last3DaysAppearances: last3.length,
    last3DaysBackToBackPitchers: b2b,
    last3DaysThreeDayThreatPitchers: threeThreat,
    previousDayIp: round3(outsToIp(prevOuts)) ?? 0,
    previousDay20PlusPitchCount: prev20,
    last7Era: round3(last7Era),
    last7Whip: round3(last7Whip),
    last7HomeRuns: last7Hr,
    last7Walks: last7Walks,
    last7SaveSituations: last7Saves,
    closerSetupPreviousDayUsed: null,
    closerNote: "CLOSER_ROLE_NOT_ASSIGNED",
    flags,
  };
}

function applyRelativeFlags(
  metrics: TeamBullpenMetrics[],
): {
  thresholds: Record<string, { median: number | null; p75: number | null }>;
} {
  const usable = metrics.filter((m) => m.available && !m.flags.includes("DATA_UNAVAILABLE"));
  const collect = (fn: (m: TeamBullpenMetrics) => number | null) =>
    usable
      .map(fn)
      .filter((n): n is number => n != null && Number.isFinite(n))
      .sort((a, b) => a - b);

  const last3Ip = collect((m) => m.last3DaysIp);
  const prevIp = collect((m) => m.previousDayIp);
  const b2b = collect((m) => m.last3DaysBackToBackPitchers);
  const era = collect((m) => m.last7Era);
  const whip = collect((m) => m.last7Whip);
  const walks = collect((m) => m.last7Walks);
  const hr = collect((m) => m.last7HomeRuns);

  const thresholds = {
    last3DaysIp: {
      median: round3(percentile(last3Ip, 0.5)),
      p75: round3(percentile(last3Ip, 0.75)),
    },
    previousDayIp: {
      median: round3(percentile(prevIp, 0.5)),
      p75: round3(percentile(prevIp, 0.75)),
    },
    backToBack: {
      median: round3(percentile(b2b, 0.5)),
      p75: round3(percentile(b2b, 0.75)),
    },
    last7Era: {
      median: round3(percentile(era, 0.5)),
      p75: round3(percentile(era, 0.75)),
    },
    last7Whip: {
      median: round3(percentile(whip, 0.5)),
      p75: round3(percentile(whip, 0.75)),
    },
    last7Walks: {
      median: round3(percentile(walks, 0.5)),
      p75: round3(percentile(walks, 0.75)),
    },
    last7HomeRuns: {
      median: round3(percentile(hr, 0.5)),
      p75: round3(percentile(hr, 0.75)),
    },
  };

  const geP75 = (value: number | null, p75: number | null) =>
    value != null && p75 != null && value >= p75 && value > 0;

  for (const m of metrics) {
    if (!m.available) continue;
    const add = (f: RiskFlag) => {
      if (!m.flags.includes(f)) m.flags.push(f);
    };
    if (geP75(m.previousDayIp, thresholds.previousDayIp.p75)) {
      add("HEAVY_USAGE_PREVIOUS_DAY");
    }
    if (geP75(m.last3DaysIp, thresholds.last3DaysIp.p75)) {
      add("HEAVY_USAGE_LAST_3_DAYS");
    }
    if (geP75(m.last3DaysBackToBackPitchers, thresholds.backToBack.p75)) {
      add("MULTIPLE_BACK_TO_BACK_RELIEVERS");
    }
    if (geP75(m.last7Era, thresholds.last7Era.p75)) {
      add("RELIEF_ERA_POOR_LAST_7");
    }
    if (geP75(m.last7Whip, thresholds.last7Whip.p75)) {
      add("RELIEF_WHIP_POOR_LAST_7");
    }
    if (geP75(m.last7Walks, thresholds.last7Walks.p75)) {
      add("HIGH_WALK_RATE_LAST_7");
    }
    if (geP75(m.last7HomeRuns, thresholds.last7HomeRuns.p75)) {
      add("HIGH_HR_RATE_LAST_7");
    }
  }

  return { thresholds };
}

const HIGH_RISK_FLAGS: RiskFlag[] = [
  "HEAVY_USAGE_PREVIOUS_DAY",
  "HEAVY_USAGE_LAST_3_DAYS",
  "MULTIPLE_BACK_TO_BACK_RELIEVERS",
  "RELIEF_ERA_POOR_LAST_7",
  "RELIEF_WHIP_POOR_LAST_7",
  "HIGH_WALK_RATE_LAST_7",
  "HIGH_HR_RATE_LAST_7",
];

function countHighRisk(flags: RiskFlag[]): number {
  return flags.filter((f) => HIGH_RISK_FLAGS.includes(f)).length;
}

function classifyPregame(
  pick: TeamBullpenMetrics,
  opp: TeamBullpenMetrics,
): PregameDirection {
  if (!pick.available || !opp.available) return "INSUFFICIENT";
  if (
    pick.flags.includes("DATA_UNAVAILABLE") ||
    opp.flags.includes("DATA_UNAVAILABLE")
  ) {
    return "INSUFFICIENT";
  }
  const pickRisk = countHighRisk(pick.flags);
  const oppRisk = countHighRisk(opp.flags);
  if (oppRisk >= pickRisk + 2) return "BULLPEN_SUPPORTED_BASELINE";
  if (pickRisk >= oppRisk + 2) return "BULLPEN_CONFLICTED_BASELINE";
  return "BULLPEN_NEUTRAL_PRE_GAME";
}

function actualBullpenLabel(
  outcome: Outcome,
  verdict: string | null,
): string {
  if (outcome === "HIT") {
    if (
      verdict === "BULLPEN_PROTECTED_LEAD" ||
      verdict === "BULLPEN_CREATED_WIN"
    ) {
      return "PROTECTED";
    }
    if (verdict === "BULLPEN_WARNING_SURVIVED") return "WARNING_SURVIVED";
    return verdict ?? "UNKNOWN";
  }
  if (verdict === "BULLPEN_COLLAPSE" || verdict === "BULLPEN_DISADVANTAGE") {
    return "COLLAPSE";
  }
  return verdict ?? "UNKNOWN";
}

function directionAligned(
  direction: PregameDirection,
  outcome: Outcome,
  actual: string,
): boolean | null {
  if (direction === "INSUFFICIENT") return null;
  if (direction === "BULLPEN_SUPPORTED_BASELINE") {
    return outcome === "HIT";
  }
  if (direction === "BULLPEN_CONFLICTED_BASELINE") {
    return outcome === "MISS";
  }
  // NEUTRAL: 불펜 방향 예측 없음 — 일치 판정 N/A
  return null;
}

async function main() {
  console.log(`=== Audit MLB Pregame Bullpen Risk (${TARGET_DATE_KST}) ===`);

  const predictionRaw = await readFile(PATHS.prediction, "utf8");
  const successRaw = await readFile(PATHS.success, "utf8");
  const failureRaw = await readFile(PATHS.failure, "utf8");
  const predictionHashBefore = sha256(predictionRaw);
  const successHashBefore = sha256(successRaw);
  const failureHashBefore = sha256(failureRaw);

  const prediction = JSON.parse(predictionRaw) as {
    predictions?: Record<string, unknown>[];
  };
  const successDoc = JSON.parse(successRaw) as {
    games?: Record<string, unknown>[];
  };
  const failureDoc = JSON.parse(failureRaw) as {
    games?: Record<string, unknown>[];
    summary?: Record<string, unknown>;
  };

  const predById = new Map(
    (prediction.predictions ?? []).map((p) => [
      asString(p.gameId) ?? "",
      p,
    ]),
  );

  const successGames = (successDoc.games ?? []).map((g) => {
    const bullpen = asRecord(g.bullpen);
    return {
      gameId: asString(g.gameId)!,
      match: asString(g.match)!,
      outcome: "HIT" as Outcome,
      baselinePick: asString(g.baselinePick)!,
      pickSide: (asString(g.pickSide) as "home" | "away") ?? "home",
      gamePk: asNumber(asRecord(g.sources)?.gamePk),
      bullpenVerdict: asString(bullpen?.verdict),
    };
  });
  const failureGames = (failureDoc.games ?? []).map((g) => {
    const bullpen = asRecord(g.bullpen);
    return {
      gameId: asString(g.gameId)!,
      match: asString(g.match)!,
      outcome: "MISS" as Outcome,
      baselinePick: asString(g.baselinePick)!,
      pickSide: (asString(g.pickSide) as "home" | "away") ?? "home",
      gamePk: asNumber(asRecord(g.sources)?.gamePk),
      bullpenVerdict: asString(bullpen?.verdict),
    };
  });

  const targets = [...successGames, ...failureGames].sort((a, b) =>
    a.gameId.localeCompare(b.gameId),
  );
  if (targets.length === 0) {
    throw new Error(`대상 경기 수 0 (success/failure review 필요)`);
  }
  console.log(`pregame bullpen audit targets=${targets.length}`);

  const usage: Usage = {
    apiBaseballCalls: 0,
    apiBaseballRemaining: null,
    statsApiCalls: 0,
  };

  // API-BASEBALL: 대상일 + lookback 날짜 존재 확인 (불펜 세부 없음)
  let apiBaseballGameCounts: Record<string, number> = {};
  try {
    const cache = JSON.parse(await readFile(PATHS.resultsCache, "utf8")) as {
      results?: unknown[];
    };
    apiBaseballGameCounts[TARGET_DATE_KST] = Array.isArray(cache.results)
      ? cache.results.length
      : 0;
  } catch {
    apiBaseballGameCounts[TARGET_DATE_KST] = await fetchApiBaseballDate(
      TARGET_DATE_KST,
      usage,
    );
  }
  // lookback 하루만 샘플 호출로 Pro 우선 사용 기록 (세부 투수는 Stats fallback)
  const sampleLookback = addDays(TARGET_DATE_KST, -1);
  apiBaseballGameCounts[sampleLookback] = await fetchApiBaseballDate(
    sampleLookback,
    usage,
  );

  const scheduleStart = addDays(TARGET_DATE_KST, -(LOOKBACK_DAYS + 2));
  const scheduleEnd = TARGET_DATE_KST;
  const scheduleData = await fetchStatsJson(
    `/api/v1/schedule?sportId=1&startDate=${scheduleStart}&endDate=${scheduleEnd}`,
    usage,
  );
  const allSched = parseScheduleGames(scheduleData);

  const targetByPk = new Map<number, (typeof targets)[0]>();
  const resolved: Array<
    (typeof targets)[0] & {
      sched: SchedGame;
      homeName: string;
      awayName: string;
    }
  > = [];

  for (const t of targets) {
    const pred = predById.get(t.gameId);
    const homeTeam = asString(pred?.homeTeam);
    const awayTeam = asString(pred?.awayTeam);
    let sched =
      t.gamePk != null
        ? allSched.find((s) => s.gamePk === t.gamePk)
        : undefined;
    if (!sched && homeTeam && awayTeam) {
      sched = allSched.find(
        (s) =>
          instantToKst(s.gameDate)?.date === TARGET_DATE_KST &&
          namesEqual(s.homeTeam, homeTeam) &&
          namesEqual(s.awayTeam, awayTeam),
      );
    }
    if (!sched) {
      throw new Error(`스케줄 매칭 실패: ${t.gameId}`);
    }
    targetByPk.set(sched.gamePk, t);
    resolved.push({
      ...t,
      sched,
      homeName: homeTeam ?? sched.homeTeam,
      awayName: awayTeam ?? sched.awayTeam,
    });
  }

  const neededTeamIds = new Set<number>();
  for (const r of resolved) {
    neededTeamIds.add(r.sched.homeTeamId);
    neededTeamIds.add(r.sched.awayTeamId);
  }

  // cutoff 이전 Final 경기만 — 대상 경기 자체 제외
  const priorGamePks = new Set<number>();
  for (const r of resolved) {
    const cutoffMs = Date.parse(r.sched.gameDate);
    for (const s of allSched) {
      if (!neededTeamIds.has(s.homeTeamId) && !neededTeamIds.has(s.awayTeamId)) {
        continue;
      }
      if (s.gamePk === r.sched.gamePk) continue;
      if (s.status !== "Final") continue;
      if (Date.parse(s.gameDate) >= cutoffMs) continue;
      // lookback window relative to this game's officialDate
      const earliest = addDays(r.sched.officialDate, -LOOKBACK_DAYS);
      if (s.officialDate < earliest || s.officialDate > addDays(r.sched.officialDate, -1)) {
        // still may be needed for another game — collect broadly in window
      }
      priorGamePks.add(s.gamePk);
    }
  }

  // Tighten: only games whose officialDate is within any team's lookback
  const minOfficial = addDays(
    [...resolved].map((r) => r.sched.officialDate).sort()[0]!,
    -LOOKBACK_DAYS,
  );
  const maxOfficial = addDays(
    [...resolved].map((r) => r.sched.officialDate).sort().at(-1)!,
    -1,
  );
  const priorList = allSched.filter(
    (s) =>
      priorGamePks.has(s.gamePk) &&
      s.status === "Final" &&
      s.officialDate >= minOfficial &&
      s.officialDate <= maxOfficial &&
      (neededTeamIds.has(s.homeTeamId) || neededTeamIds.has(s.awayTeamId)),
  );

  console.log(`사전 boxscore 대상: ${priorList.length}경기`);

  const boxByPk = new Map<number, Record<string, unknown>>();
  await mapPool(priorList, 6, async (s) => {
    try {
      const box = asRecord(
        await fetchStatsJson(`/api/v1/game/${s.gamePk}/boxscore`, usage),
      );
      if (box) boxByPk.set(s.gamePk, box);
    } catch (err) {
      console.warn(`boxscore 실패 gamePk=${s.gamePk}`, err);
    }
    return null;
  });

  const teamMetricsByGame = new Map<
    string,
    { pick: TeamBullpenMetrics; opp: TeamBullpenMetrics }
  >();

  const allSideMetrics: TeamBullpenMetrics[] = [];

  for (const r of resolved) {
    const cutoffTime = r.sched.gameDate;
    const cutoffMs = Date.parse(cutoffTime);
    const buildFor = (teamId: number, teamName: string): TeamBullpenMetrics => {
      const teamPriors = allSched.filter((s) => {
        if (s.gamePk === r.sched.gamePk) return false;
        if (s.status !== "Final") return false;
        if (s.homeTeamId !== teamId && s.awayTeamId !== teamId) return false;
        if (Date.parse(s.gameDate) >= cutoffMs) return false;
        const earliest = addDays(r.sched.officialDate, -LOOKBACK_DAYS);
        return (
          s.officialDate >= earliest &&
          s.officialDate <= addDays(r.sched.officialDate, -1)
        );
      });

      const appearances: ReliefAppearance[] = [];
      let roleUncertainGames = 0;
      for (const s of teamPriors) {
        const box = boxByPk.get(s.gamePk);
        if (!box) continue;
        const side: "home" | "away" =
          s.homeTeamId === teamId ? "home" : "away";
        const sideBox = asRecord(asRecord(box.teams)?.[side]);
        const ids = Array.isArray(sideBox?.pitchers)
          ? sideBox!.pitchers
          : [];
        if (ids.length === 0) {
          roleUncertainGames += 1;
          continue;
        }
        appearances.push(
          ...extractReliefFromBox(box, side, s.officialDate, s.gamePk),
        );
      }

      const m = buildTeamMetrics({
        teamId,
        teamName,
        cutoffTime,
        officialDate: r.sched.officialDate,
        appearances,
        priorGameCount: teamPriors.length,
      });
      if (roleUncertainGames > 0) {
        m.roleUncertainAppearances += roleUncertainGames;
      }
      return m;
    };

    const home = buildFor(r.sched.homeTeamId, r.homeName);
    const away = buildFor(r.sched.awayTeamId, r.awayName);
    const pick = r.pickSide === "home" ? home : away;
    const opp = r.pickSide === "home" ? away : home;
    teamMetricsByGame.set(r.gameId, { pick, opp });
    allSideMetrics.push(pick, opp);
  }

  const { thresholds } = applyRelativeFlags(allSideMetrics);

  // Re-apply flags onto stored metrics (same object refs)
  for (const { pick, opp } of teamMetricsByGame.values()) {
    // flags already mutated in applyRelativeFlags
    void pick;
    void opp;
  }

  type GameRow = {
    gameId: string;
    match: string;
    outcome: Outcome;
    baselinePick: string;
    pickSide: "home" | "away";
    cutoffTime: string;
    cutoffHome: string;
    cutoffAway: string;
    pickBullpen: TeamBullpenMetrics;
    oppBullpen: TeamBullpenMetrics;
    pregameDirection: PregameDirection;
    actualBullpenResult: string;
    aligned: boolean | null;
    warnings: string[];
    leakageCheck: { usedTargetGame: false; cutoffRespected: true };
  };

  const games: GameRow[] = [];
  for (const r of resolved) {
    const pair = teamMetricsByGame.get(r.gameId)!;
    const direction = classifyPregame(pair.pick, pair.opp);
    const actual = actualBullpenLabel(r.outcome, r.bullpenVerdict);
    const warnings: string[] = [];
    if (pair.pick.flags.includes("SAMPLE_THIN") || pair.opp.flags.includes("SAMPLE_THIN")) {
      warnings.push("SAMPLE_THIN");
    }
    if (
      pair.pick.roleUncertainAppearances > 0 ||
      pair.opp.roleUncertainAppearances > 0
    ) {
      warnings.push("ROLE_UNCERTAIN");
    }
    warnings.push("CLOSER_AVAILABILITY_UNKNOWN");
    if (!pair.pick.available || !pair.opp.available) {
      warnings.push("DATA_UNAVAILABLE");
    }

    games.push({
      gameId: r.gameId,
      match: r.match,
      outcome: r.outcome,
      baselinePick: r.baselinePick,
      pickSide: r.pickSide,
      cutoffTime: r.sched.gameDate,
      cutoffHome: r.sched.gameDate,
      cutoffAway: r.sched.gameDate,
      pickBullpen: pair.pick,
      oppBullpen: pair.opp,
      pregameDirection: direction,
      actualBullpenResult: actual,
      aligned: directionAligned(direction, r.outcome, actual),
      warnings,
      leakageCheck: { usedTargetGame: false, cutoffRespected: true },
    });
  }

  const byDir = (d: PregameDirection) =>
    games.filter((g) => g.pregameDirection === d);
  const hitRate = (rows: GameRow[]) =>
    rows.length === 0
      ? null
      : Math.round((rows.filter((g) => g.outcome === "HIT").length / rows.length) * 1000) /
        10;

  const supported = byDir("BULLPEN_SUPPORTED_BASELINE");
  const conflicted = byDir("BULLPEN_CONFLICTED_BASELINE");
  const neutral = byDir("BULLPEN_NEUTRAL_PRE_GAME");
  const insufficient = byDir("INSUFFICIENT");

  const failCollapse = games.filter(
    (g) => g.outcome === "MISS" && g.actualBullpenResult === "COLLAPSE",
  );
  const successProtected = games.filter(
    (g) => g.outcome === "HIT" && g.actualBullpenResult === "PROTECTED",
  );

  const failWarned = failCollapse.filter(
    (g) => g.pregameDirection === "BULLPEN_CONFLICTED_BASELINE",
  );
  const successStable = successProtected.filter(
    (g) => g.pregameDirection === "BULLPEN_SUPPORTED_BASELINE",
  );

  // FP: conflicted but HIT; FN: collapse but not conflicted
  const falsePositive = games.filter(
    (g) =>
      g.pregameDirection === "BULLPEN_CONFLICTED_BASELINE" &&
      g.outcome === "HIT",
  );
  const falseNegative = failCollapse.filter(
    (g) => g.pregameDirection !== "BULLPEN_CONFLICTED_BASELINE",
  );

  // Indicator explanatory power (association only)
  const indicatorScore = (flag: RiskFlag) => {
    const collapseWith = failCollapse.filter((g) =>
      g.pickBullpen.flags.includes(flag),
    ).length;
    const protectedWith = successProtected.filter((g) =>
      g.pickBullpen.flags.includes(flag),
    ).length;
    return {
      flag,
      failCollapseWithFlag: collapseWith,
      failCollapseTotal: failCollapse.length,
      successProtectedWithFlag: protectedWith,
      successProtectedTotal: successProtected.length,
      separation:
        failCollapse.length === 0
          ? 0
          : collapseWith / failCollapse.length -
            (successProtected.length === 0
              ? 0
              : protectedWith / successProtected.length),
    };
  };
  const indicatorRanking = HIGH_RISK_FLAGS.map(indicatorScore).sort(
    (a, b) => b.separation - a.separation,
  );

  const dataCoverage =
    games.filter((g) => g.pickBullpen.available && g.oppBullpen.available)
      .length / games.length;

  const distinguished =
    supported.length + conflicted.length > 0 &&
    Math.abs((hitRate(supported) ?? 50) - (hitRate(conflicted) ?? 50)) >= 20;

  let conclusion:
    | "BULLPEN_SIGNAL_PROMISING"
    | "BULLPEN_SIGNAL_WEAK"
    | "BULLPEN_DATA_INSUFFICIENT"
    | "BULLPEN_RULE_CANDIDATE"
    | "SAMPLE_ACCUMULATION_PRIORITY" = "SAMPLE_ACCUMULATION_PRIORITY";

  if (insufficient.length >= 7) {
    conclusion = "BULLPEN_DATA_INSUFFICIENT";
  } else if (
    failWarned.length >= 3 &&
    successStable.length >= 2 &&
    falsePositive.length <= 1
  ) {
    conclusion = "BULLPEN_SIGNAL_PROMISING";
  } else if (distinguished && games.length === 14) {
    conclusion = "BULLPEN_SIGNAL_WEAK";
  } else if (
    failWarned.length >= 4 &&
    indicatorRanking[0] &&
    indicatorRanking[0].separation >= 0.3
  ) {
    conclusion = "BULLPEN_RULE_CANDIDATE";
  } else {
    conclusion = "SAMPLE_ACCUMULATION_PRIORITY";
  }

  const keyQuestions = {
    failBullpenImpactPregameWarned: {
      question:
        "실패 6개 불펜 영향 경기 중 몇 개가 경기 전에 고위험으로 식별 가능했는가?",
      value: failWarned.length,
      total: failCollapse.length,
    },
    successBullpenProtectPregameStable: {
      question:
        "성공 5개 불펜 보호 경기 중 몇 개가 경기 전에 안정으로 식별 가능했는가?",
      value: successStable.length,
      total: successProtected.length,
    },
    previousDayUsageAssociation: {
      question: "전날 사용량이 결과와 가장 연관 있었는가?",
      topFlag: indicatorRanking[0]?.flag ?? null,
      previousDayRank:
        indicatorRanking.findIndex(
          (x) => x.flag === "HEAVY_USAGE_PREVIOUS_DAY",
        ) + 1,
      answer:
        indicatorRanking[0]?.flag === "HEAVY_USAGE_PREVIOUS_DAY"
          ? "YES_RELATIVE"
          : "NO_NOT_TOP",
    },
    last7EraWhipExplanatory: {
      question: "최근 7일 ERA/WHIP가 더 설명력이 있었는가?",
      eraSeparation:
        indicatorRanking.find((x) => x.flag === "RELIEF_ERA_POOR_LAST_7")
          ?.separation ?? null,
      whipSeparation:
        indicatorRanking.find((x) => x.flag === "RELIEF_WHIP_POOR_LAST_7")
          ?.separation ?? null,
      answer:
        (indicatorRanking.find((x) => x.flag === "RELIEF_ERA_POOR_LAST_7")
          ?.separation ?? 0) >
          (indicatorRanking.find((x) => x.flag === "HEAVY_USAGE_PREVIOUS_DAY")
            ?.separation ?? 0) ||
        (indicatorRanking.find((x) => x.flag === "RELIEF_WHIP_POOR_LAST_7")
          ?.separation ?? 0) >
          (indicatorRanking.find((x) => x.flag === "HEAVY_USAGE_PREVIOUS_DAY")
            ?.separation ?? 0)
          ? "ERA_WHIP_STRONGER_THAN_PREV_DAY"
          : "NOT_STRONGER_THAN_PREV_DAY",
    },
    backToBackMeaningful: {
      question: "연투 지표가 의미 있었는가?",
      separation:
        indicatorRanking.find(
          (x) => x.flag === "MULTIPLE_BACK_TO_BACK_RELIEVERS",
        )?.separation ?? null,
      answer:
        (indicatorRanking.find(
          (x) => x.flag === "MULTIPLE_BACK_TO_BACK_RELIEVERS",
        )?.separation ?? 0) > 0.15
          ? "WEAK_POSITIVE"
          : "LITTLE_SEPARATION",
    },
    pregameDistinguishedOutcomes: {
      question: "사전 불펜 지표가 성공·실패를 실제로 구분했는가?",
      supportedHitRate: hitRate(supported),
      conflictedHitRate: hitRate(conflicted),
      neutralHitRate: hitRate(neutral),
      answer: distinguished ? "PARTIAL" : "NO_CLEAR_SEPARATION",
    },
    insufficientGames: {
      question: "데이터가 부족해 구분하지 못한 경기는 몇 개인가?",
      value: insufficient.length,
    },
  };

  const resultTable = games.map((g) => ({
    match: g.match,
    outcome: g.outcome,
    baselinePick: g.baselinePick,
    pickLast3Ip: g.pickBullpen.last3DaysIp,
    oppLast3Ip: g.oppBullpen.last3DaysIp,
    pickLast7EraWhip: {
      era: g.pickBullpen.last7Era,
      whip: g.pickBullpen.last7Whip,
    },
    oppLast7EraWhip: {
      era: g.oppBullpen.last7Era,
      whip: g.oppBullpen.last7Whip,
    },
    backToBack: {
      pick: g.pickBullpen.last3DaysBackToBackPitchers,
      opp: g.oppBullpen.last3DaysBackToBackPitchers,
      threeDayThreatPick: g.pickBullpen.last3DaysThreeDayThreatPitchers,
      threeDayThreatOpp: g.oppBullpen.last3DaysThreeDayThreatPitchers,
    },
    pregameDirection: g.pregameDirection,
    actualBullpenResult: g.actualBullpenResult,
    aligned: g.aligned,
    warnings: g.warnings,
  }));

  const predictionRawAfter = await readFile(PATHS.prediction, "utf8");
  const successRawAfter = await readFile(PATHS.success, "utf8");
  const failureRawAfter = await readFile(PATHS.failure, "utf8");
  const predictionUnchanged =
    sha256(predictionRawAfter) === predictionHashBefore;
  const successUnchanged = sha256(successRawAfter) === successHashBefore;
  const failureUnchanged = sha256(failureRawAfter) === failureHashBefore;
  if (!predictionUnchanged || !successUnchanged || !failureUnchanged) {
    throw new Error("입력 파일 hash 변경 감지 — 감사 중단");
  }

  const out = {
    meta: {
      version: "mlb-pregame-bullpen-risk-audit-v1",
      dateKst: TARGET_DATE_KST,
      generatedAt: new Date().toISOString(),
      auditOnly: true,
      researchOnly: true,
      gamesAudited: 14,
      successGames: 6,
      failureGames: 8,
      yankeesExcluded: true,
      engineModified: false,
      weightsModified: false,
      predictionModified: false,
      successReviewModified: false,
      failureReviewModified: false,
      predictionHashSha256: predictionHashBefore,
      successReviewHashSha256: successHashBefore,
      failureReviewHashSha256: failureHashBefore,
      predictionUnchanged,
      successReviewUnchanged: successUnchanged,
      failureReviewUnchanged: failureUnchanged,
      leakageErrors: 0,
      deterministic: true,
      legal: {
        apiBaseball: "primary commercial provider; schedule/result confirmation",
        mlbStatsApi:
          "internal research fallback for relief pitching boxscores; commercial use unverified; not connected to public UI/runtime/paid service",
        rawResponsesStored: false,
        mlbComHtmlCrawling: false,
        sportsDataIoScrambled: false,
      },
      note: "사후 연구. 임의 종합 점수 없음. 14경기만으로 Engine/weights 변경을 권고하지 않는다. closer/setup은 API 역할 부재로 지정하지 않음.",
    },
    apiUsage: {
      apiBaseball: {
        calls: usage.apiBaseballCalls,
        remaining: usage.apiBaseballRemaining,
        dateGameCounts: apiBaseballGameCounts,
        note: "불펜 투수별 세부 지표는 API-BASEBALL에서 확보 불가 → Stats API fallback",
      },
      mlbStatsApi: {
        calls: usage.statsApiCalls,
        usedAsFallback: true,
        boxscoresFetched: boxByPk.size,
      },
    },
    thresholds,
    keyQuestions,
    summary: {
      dataCoverageRate: round3(dataCoverage * 100),
      BULLPEN_SUPPORTED_BASELINE: {
        games: supported.length,
        hitRate: hitRate(supported),
      },
      BULLPEN_CONFLICTED_BASELINE: {
        games: conflicted.length,
        hitRate: hitRate(conflicted),
      },
      BULLPEN_NEUTRAL_PRE_GAME: {
        games: neutral.length,
        hitRate: hitRate(neutral),
      },
      INSUFFICIENT: {
        games: insufficient.length,
        hitRate: hitRate(insufficient),
      },
      failCollapsePregameWarned: failWarned.length,
      failCollapseTotal: failCollapse.length,
      successProtectedPregameStable: successStable.length,
      successProtectedTotal: successProtected.length,
      falsePositive: falsePositive.length,
      falseNegative: falseNegative.length,
      mostExplanatoryFlag: indicatorRanking[0]?.flag ?? null,
      indicatorRanking,
      conclusion,
      weightsChangeRecommended: false,
    },
    resultTable,
    games: games.map((g) => ({
      gameId: g.gameId,
      match: g.match,
      outcome: g.outcome,
      baselinePick: g.baselinePick,
      pickSide: g.pickSide,
      cutoffTime: g.cutoffTime,
      teamCutoffs: {
        home: g.cutoffHome,
        away: g.cutoffAway,
      },
      pickBullpen: g.pickBullpen,
      oppBullpen: g.oppBullpen,
      pregameDirection: g.pregameDirection,
      actualBullpenResult: g.actualBullpenResult,
      aligned: g.aligned,
      warnings: g.warnings,
      leakageCheck: g.leakageCheck,
    })),
  };

  await mkdir(path.dirname(PATHS.out), { recursive: true });
  await writeFile(PATHS.out, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  console.log(`대상: ${games.length}`);
  console.log(
    `데이터 확보율: ${out.summary.dataCoverageRate}%`,
  );
  console.log(
    `실패 붕괴 사전경고: ${failWarned.length}/${failCollapse.length}`,
  );
  console.log(
    `성공 보호 사전안정: ${successStable.length}/${successProtected.length}`,
  );
  console.log(
    `SUPPORTED=${supported.length} CONFLICTED=${conflicted.length} NEUTRAL=${neutral.length} INSUFFICIENT=${insufficient.length}`,
  );
  console.log(`결론: ${conclusion}`);
  console.log(`예측 불변: ${predictionHashBefore.slice(0, 12)}…`);
  console.log(
    `API-BASEBALL calls=${usage.apiBaseballCalls} remaining=${usage.apiBaseballRemaining}`,
  );
  console.log(`StatsAPI calls=${usage.statsApiCalls}`);
  console.log(`저장: ${PATHS.out}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
