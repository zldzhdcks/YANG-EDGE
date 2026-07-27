/**
 * MLB SIGNAL_FAILED 경기 사후 경기 흐름 복기.
 *
 * - Engine / weights / 과거 예측 / 추천 등급 수정 금지
 * - 우선: API-BASEBALL Pro (결과·이닝별 점수)
 * - fallback: MLB Stats API boxscore (상업 이용 미확인, 연구 전용)
 * - 원본 응답 전체 미저장
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/review-mlb-failed-game-flow.ts [YYYY-MM-DD]
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
const SPECIAL_IDS = new Set([
  "mlb-179597", // Dodgers @ Mets
  "mlb-179601", // Astros @ White Sox
  "mlb-179595", // Cubs @ Pirates
  "mlb-179591", // Mariners @ Rangers
]);

const PREDICTION_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  "mlb",
  `${TARGET_DATE_KST}.json`,
);
const REVIEW_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  "mlb",
  `${TARGET_DATE_KST}-review.json`,
);
const PITCHER_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb-pitcher-review.json`,
);
const ODDS_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  "mlb",
  `${TARGET_DATE_KST}-odds-timeline.json`,
);
const OUT_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  "mlb",
  `${TARGET_DATE_KST}-failure-flow-review.json`,
);

type PrimaryFailure =
  | "STARTER_FAILURE"
  | "BULLPEN_FAILURE"
  | "OFFENSIVE_FAILURE"
  | "OPPONENT_OFFENSE_SURGE"
  | "STARTER_CHANGED_PRE_GAME"
  | "LINEUP_RISK_MISSED"
  | "MARKET_WARNING_MISSED"
  | "CLOSE_GAME_VARIANCE"
  | "MULTIPLE_FACTORS"
  | "UNEXPLAINED";

type StarterVerdict =
  | "STARTER_DISADVANTAGE_REALIZED"
  | "STARTER_ADVANTAGE_WASTED"
  | "STARTERS_EVEN"
  | "INSUFFICIENT";

type BullpenVerdict =
  | "BULLPEN_COLLAPSE"
  | "BULLPEN_DISADVANTAGE"
  | "NOT_BULLPEN_DRIVEN"
  | "INSUFFICIENT";

type OffenseVerdict =
  | "OFFENSE_UNDERPERFORMED"
  | "OPPONENT_OFFENSE_SURGED"
  | "OFFENSE_NOT_PRIMARY"
  | "INSUFFICIENT";

type RiskTiming = "PRE_GAME_KNOWN" | "IN_GAME_ONLY" | "UNKNOWN";

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
function asBoolean(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
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
  // baseball IP: .1 = 1 out, .2 = 2 outs
  if (frac > 2) return whole * 3 + Math.min(frac, 2);
  return whole * 3 + frac;
}
function decisionFromPitching(stat: Record<string, unknown>): string | null {
  const note = asString(stat.note);
  if (note) return note;
  const w = asNumber(stat.wins) ?? 0;
  const l = asNumber(stat.losses) ?? 0;
  if (w > 0) return "W";
  if (l > 0) return "L";
  return "ND";
}

type InningMap = Record<string, number | null>;

function sumInnings(map: InningMap | null, from: number, to: number): number {
  if (!map) return 0;
  let sum = 0;
  for (let i = from; i <= to; i += 1) {
    const v = map[String(i)];
    if (typeof v === "number" && Number.isFinite(v)) sum += v;
  }
  if (to >= 10) {
    const extra = map.extra;
    if (typeof extra === "number" && Number.isFinite(extra)) sum += extra;
  }
  return sum;
}

function scoreAfterInning(
  homeInn: InningMap,
  awayInn: InningMap,
  inning: number,
): { home: number; away: number } {
  return {
    home: sumInnings(homeInn, 1, inning),
    away: sumInnings(awayInn, 1, inning),
  };
}

function buildFlow(
  homeInn: InningMap,
  awayInn: InningMap,
  pickSide: "home" | "away",
  homeTotal: number,
  awayTotal: number,
) {
  let pickLeadFirstInning: number | null = null;
  let maxPickLead = 0;
  let opponentTookLeadInning: number | null = null;
  let ties = 0;
  let prevPickLead = false;
  let prevOppLead = false;
  let prevTied = true;

  for (let i = 1; i <= 12; i += 1) {
    const has =
      homeInn[String(i)] != null ||
      awayInn[String(i)] != null ||
      (i <= 9 && (homeTotal > 0 || awayTotal > 0));
    if (!has && i > 9) break;
    // skip empty trailing if both null and i>9
    if (homeInn[String(i)] == null && awayInn[String(i)] == null && i > 9) {
      break;
    }
    const s = scoreAfterInning(homeInn, awayInn, i);
    const pick = pickSide === "home" ? s.home : s.away;
    const opp = pickSide === "home" ? s.away : s.home;
    const lead = pick - opp;
    if (lead > maxPickLead) maxPickLead = lead;
    if (pickLeadFirstInning == null && lead > 0) pickLeadFirstInning = i;
    if (pick === opp && !prevTied && i > 0) ties += 1;
    if (opp > pick && !prevOppLead && (prevPickLead || prevTied)) {
      if (opponentTookLeadInning == null) opponentTookLeadInning = i;
    }
    prevPickLead = lead > 0;
    prevOppLead = lead < 0;
    prevTied = lead === 0;
  }

  const after6 = scoreAfterInning(homeInn, awayInn, 6);
  const final = { home: homeTotal, away: awayTotal };
  const pickFinal = pickSide === "home" ? homeTotal : awayTotal;
  const oppFinal = pickSide === "home" ? awayTotal : homeTotal;
  const after6Pick = pickSide === "home" ? after6.home : after6.away;
  const after6Opp = pickSide === "home" ? after6.away : after6.home;

  return {
    pickFirstLeadInning: pickLeadFirstInning,
    maxPickLead,
    opponentTookLeadInning,
    tieCount: ties,
    scoreAfter6: after6,
    runsAfter6: {
      pick: pickFinal - after6Pick,
      opponent: oppFinal - after6Opp,
    },
    finalScore: final,
    pickLedDuringGame: pickLeadFirstInning != null,
  };
}

type PitcherLine = {
  side: "home" | "away";
  role: "starter" | "relief";
  name: string | null;
  playerId: number | null;
  inningsPitched: string | null;
  outs: number | null;
  runs: number | null;
  earnedRuns: number | null;
  hits: number | null;
  walks: number | null;
  strikeouts: number | null;
  homeRuns: number | null;
  pitches: number | null;
  decision: string | null;
};

function extractPitchers(
  box: Record<string, unknown>,
  side: "home" | "away",
): PitcherLine[] {
  const teams = asRecord(box.teams);
  const sideBox = asRecord(teams?.[side]);
  if (!sideBox) return [];
  const ids = Array.isArray(sideBox.pitchers)
    ? sideBox.pitchers.map((x) => asNumber(x)).filter((n): n is number => n != null)
    : [];
  const players = asRecord(sideBox.players) ?? {};
  return ids.map((id, index) => {
    const player = asRecord(players[`ID${id}`]);
    const person = asRecord(player?.person);
    const pitching = asRecord(asRecord(player?.stats)?.pitching) ?? {};
    const ip = asString(pitching.inningsPitched);
    return {
      side,
      role: index === 0 ? "starter" : "relief",
      name: asString(person?.fullName),
      playerId: id,
      inningsPitched: ip,
      outs: parseIpToOuts(ip),
      runs: asNumber(pitching.runs),
      earnedRuns: asNumber(pitching.earnedRuns),
      hits: asNumber(pitching.hits),
      walks: asNumber(pitching.baseOnBalls),
      strikeouts: asNumber(pitching.strikeOuts),
      homeRuns: asNumber(pitching.homeRuns),
      pitches:
        asNumber(pitching.pitchesThrown) ?? asNumber(pitching.numberOfPitches),
      decision: decisionFromPitching(pitching),
    };
  });
}

function classifyStarterResult(
  pickStarter: PitcherLine | null,
  oppStarter: PitcherLine | null,
): StarterVerdict {
  if (!pickStarter || !oppStarter) return "INSUFFICIENT";
  if (pickStarter.runs == null || oppStarter.runs == null) return "INSUFFICIENT";
  const pickOuts = pickStarter.outs ?? 0;
  const oppOuts = oppStarter.outs ?? 0;
  const pickRuns = pickStarter.runs;
  const oppRuns = oppStarter.runs;
  // 추천 선발이 명확히 더 일찍/많이 실점
  const pickWorse =
    pickRuns >= oppRuns + 2 ||
    (pickRuns > oppRuns && pickOuts + 3 <= oppOuts);
  const pickBetter =
    oppRuns >= pickRuns + 2 ||
    (oppRuns > pickRuns && oppOuts + 3 <= pickOuts);
  if (pickWorse) return "STARTER_DISADVANTAGE_REALIZED";
  if (pickBetter) return "STARTER_ADVANTAGE_WASTED";
  return "STARTERS_EVEN";
}

function classifyBullpen(args: {
  pickSide: "home" | "away";
  pickStarter: PitcherLine | null;
  pickReliefRuns: number | null;
  oppReliefRuns: number | null;
  homeInn: InningMap;
  awayInn: InningMap;
  homeTotal: number;
  awayTotal: number;
}): BullpenVerdict {
  const { pickStarter, pickSide, homeInn, awayInn, homeTotal, awayTotal } =
    args;
  if (!pickStarter || pickStarter.outs == null) return "INSUFFICIENT";
  const exitInning = Math.max(1, Math.floor(pickStarter.outs / 3));
  const atExit = scoreAfterInning(homeInn, awayInn, exitInning);
  const pickAt =
    pickSide === "home" ? atExit.home : atExit.away;
  const oppAt = pickSide === "home" ? atExit.away : atExit.home;
  const pickFinal = pickSide === "home" ? homeTotal : awayTotal;
  const oppFinal = pickSide === "home" ? awayTotal : homeTotal;
  const ledOrTied = pickAt >= oppAt;
  const bullpenOppRuns = oppFinal - oppAt;
  const collapsed =
    ledOrTied && (bullpenOppRuns >= 3 || oppFinal > pickFinal);
  if (collapsed) return "BULLPEN_COLLAPSE";
  if (
    args.pickReliefRuns != null &&
    args.oppReliefRuns != null &&
    args.pickReliefRuns >= args.oppReliefRuns + 2
  ) {
    return "BULLPEN_DISADVANTAGE";
  }
  // 선발 단계에서 이미 큰 열세
  if (oppAt - pickAt >= 3) return "NOT_BULLPEN_DRIVEN";
  if (
    args.pickReliefRuns != null &&
    args.oppReliefRuns != null &&
    Math.abs(args.pickReliefRuns - args.oppReliefRuns) < 2
  ) {
    return "NOT_BULLPEN_DRIVEN";
  }
  return "NOT_BULLPEN_DRIVEN";
}

function classifyOffense(args: {
  pickRuns: number;
  oppRuns: number;
  pickHits: number | null;
  starterVerdict: StarterVerdict;
  bullpenVerdict: BullpenVerdict;
}): OffenseVerdict {
  if (args.oppRuns >= 7) return "OPPONENT_OFFENSE_SURGED";
  if (args.pickRuns <= 2) return "OFFENSE_UNDERPERFORMED";
  if (
    args.pickRuns >= 4 &&
    (args.starterVerdict === "STARTER_DISADVANTAGE_REALIZED" ||
      args.bullpenVerdict === "BULLPEN_COLLAPSE" ||
      args.bullpenVerdict === "BULLPEN_DISADVANTAGE")
  ) {
    return "OFFENSE_NOT_PRIMARY";
  }
  if (args.pickHits == null) return "INSUFFICIENT";
  return "OFFENSE_NOT_PRIMARY";
}

function choosePrimary(args: {
  starter: StarterVerdict;
  bullpen: BullpenVerdict;
  offense: OffenseVerdict;
  margin: number;
  starterChanged: boolean;
  marketAdverse: boolean;
}): { primary: PrimaryFailure; secondary: PrimaryFailure[] } {
  const secondary: PrimaryFailure[] = [];
  const factors: PrimaryFailure[] = [];

  if (args.starterChanged) factors.push("STARTER_CHANGED_PRE_GAME");
  if (args.starter === "STARTER_DISADVANTAGE_REALIZED") {
    factors.push("STARTER_FAILURE");
  }
  if (
    args.bullpen === "BULLPEN_COLLAPSE" ||
    args.bullpen === "BULLPEN_DISADVANTAGE"
  ) {
    factors.push("BULLPEN_FAILURE");
  }
  if (args.offense === "OFFENSE_UNDERPERFORMED") {
    factors.push("OFFENSIVE_FAILURE");
  }
  if (args.offense === "OPPONENT_OFFENSE_SURGED") {
    factors.push("OPPONENT_OFFENSE_SURGE");
  }
  if (args.marketAdverse) factors.push("MARKET_WARNING_MISSED");
  if (args.margin <= 2) factors.push("CLOSE_GAME_VARIANCE");

  if (factors.length === 0) {
    return { primary: "UNEXPLAINED", secondary: [] };
  }
  if (factors.length >= 3) {
    const primary = factors[0];
    return {
      primary: "MULTIPLE_FACTORS",
      secondary: factors.slice(0, 2),
    };
  }
  // priority: starter collapse > bullpen > offense surge > offense fail > close > market
  const order: PrimaryFailure[] = [
    "STARTER_CHANGED_PRE_GAME",
    "STARTER_FAILURE",
    "BULLPEN_FAILURE",
    "OPPONENT_OFFENSE_SURGE",
    "OFFENSIVE_FAILURE",
    "CLOSE_GAME_VARIANCE",
    "MARKET_WARNING_MISSED",
  ];
  const ranked = order.filter((x) => factors.includes(x));
  const primary = ranked[0] ?? factors[0];
  for (const f of ranked.slice(1)) {
    if (secondary.length < 2 && f !== primary) secondary.push(f);
  }
  return { primary, secondary };
}

type Usage = {
  apiBaseballCalls: number;
  apiBaseballRemaining: number | null;
  statsApiCalls: number;
};

async function fetchApiBaseballGames(usage: Usage): Promise<
  Map<
    string,
    {
      homeTeam: string;
      awayTeam: string;
      homeTotal: number;
      awayTotal: number;
      homeHits: number | null;
      awayHits: number | null;
      homeErrors: number | null;
      awayErrors: number | null;
      homeInn: InningMap;
      awayInn: InningMap;
      status: string | null;
    }
  >
> {
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
  url.searchParams.set("date", TARGET_DATE_KST);
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
  const body = (await res.json()) as { response?: unknown[] };
  const map = new Map<
    string,
    {
      homeTeam: string;
      awayTeam: string;
      homeTotal: number;
      awayTotal: number;
      homeHits: number | null;
      awayHits: number | null;
      homeErrors: number | null;
      awayErrors: number | null;
      homeInn: InningMap;
      awayInn: InningMap;
      status: string | null;
    }
  >();
  for (const raw of body.response ?? []) {
    const row = asRecord(raw);
    if (!row) continue;
    const id = asNumber(row.id);
    if (id == null) continue;
    const teams = asRecord(row.teams);
    const scores = asRecord(row.scores);
    const home = asRecord(teams?.home);
    const away = asRecord(teams?.away);
    const hs = asRecord(scores?.home);
    const as_ = asRecord(scores?.away);
    const status = asRecord(row.status);
    map.set(String(id), {
      homeTeam: asString(home?.name) ?? "",
      awayTeam: asString(away?.name) ?? "",
      homeTotal: asNumber(hs?.total) ?? 0,
      awayTotal: asNumber(as_?.total) ?? 0,
      homeHits: asNumber(hs?.hits),
      awayHits: asNumber(as_?.hits),
      homeErrors: asNumber(hs?.errors),
      awayErrors: asNumber(as_?.errors),
      homeInn: (asRecord(hs?.innings) as InningMap) ?? {},
      awayInn: (asRecord(as_?.innings) as InningMap) ?? {},
      status: asString(status?.short),
    });
  }
  return map;
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

async function loadScheduleIndex(usage: Usage): Promise<
  Array<{
    gamePk: number;
    homeTeam: string;
    awayTeam: string;
    probableHome: string | null;
    probableAway: string | null;
    date: string;
  }>
> {
  // KST 새벽 경기는 대개 전날 US 캘린더에 포함
  const prevMs =
    Date.parse(`${TARGET_DATE_KST}T12:00:00+09:00`) - 24 * 60 * 60 * 1000;
  const prevDate =
    instantToKst(new Date(prevMs).toISOString())?.date ?? TARGET_DATE_KST;
  const dates = [prevDate, TARGET_DATE_KST];
  const out: Array<{
    gamePk: number;
    homeTeam: string;
    awayTeam: string;
    probableHome: string | null;
    probableAway: string | null;
    date: string;
  }> = [];
  for (const date of dates) {
    const hydrate = encodeURIComponent("probablePitcher");
    const data = asRecord(
      await fetchStatsJson(
        `/api/v1/schedule?sportId=1&date=${date}&hydrate=${hydrate}`,
        usage,
      ),
    );
    const datesArr = Array.isArray(data?.dates) ? data.dates : [];
    for (const day of datesArr) {
      const games = Array.isArray(asRecord(day)?.games)
        ? (asRecord(day)!.games as unknown[])
        : [];
      for (const raw of games) {
        const row = asRecord(raw);
        if (!row) continue;
        const gamePk = asNumber(row.gamePk);
        const gameDate = asString(row.gameDate);
        const kst = gameDate ? instantToKst(gameDate) : null;
        if (!kst || kst.date !== TARGET_DATE_KST) continue;
        if (gamePk == null) continue;
        const teams = asRecord(row.teams);
        const home = asRecord(teams?.home);
        const away = asRecord(teams?.away);
        const homeName = asString(asRecord(home?.team)?.name);
        const awayName = asString(asRecord(away?.team)?.name);
        if (!homeName || !awayName) continue;
        out.push({
          gamePk,
          homeTeam: homeName,
          awayTeam: awayName,
          probableHome: asString(
            asRecord(home?.probablePitcher)?.fullName,
          ),
          probableAway: asString(
            asRecord(away?.probablePitcher)?.fullName,
          ),
          date,
        });
      }
    }
  }
  return out;
}

async function main() {
  console.log(`=== Review MLB Failed Game Flow (${TARGET_DATE_KST}) ===`);
  const predictionRaw = await readFile(PREDICTION_PATH, "utf8");
  const predictionHashBefore = sha256(predictionRaw);
  const prediction = JSON.parse(predictionRaw);
  const review = JSON.parse(await readFile(REVIEW_PATH, "utf8"));
  let pitcherReview: { games?: unknown[] } = { games: [] };
  try {
    pitcherReview = JSON.parse(await readFile(PITCHER_PATH, "utf8"));
  } catch {
    console.warn(
      `pitcher review 없음 — 생략: ${path.relative(process.cwd(), PITCHER_PATH)}`,
    );
  }
  let oddsTimeline: Record<string, unknown> | null = null;
  try {
    oddsTimeline = JSON.parse(await readFile(ODDS_PATH, "utf8"));
  } catch {
    oddsTimeline = null;
  }

  const predById = new Map<string, Record<string, unknown>>(
    (Array.isArray(prediction.predictions) ? prediction.predictions : []).map(
      (p: Record<string, unknown>) => [asString(p.gameId) ?? "", p],
    ),
  );
  const failed = (
    Array.isArray(review.games) ? review.games : []
  ).filter(
    (g: Record<string, unknown>) =>
      asString(g.feedbackClassification) === "SIGNAL_FAILED",
  ) as Record<string, unknown>[];
  console.log(`SIGNAL_FAILED=${failed.length}`);

  const pitcherById = new Map<string, Record<string, unknown>>(
    (Array.isArray(pitcherReview.games) ? pitcherReview.games : [])
      .map((g) => asRecord(g))
      .filter((g): g is Record<string, unknown> => g != null)
      .map((g) => [asString(g.gameId) ?? "", g]),
  );
  const oddsById = new Map<string, Record<string, unknown>>(
    (
      Array.isArray(oddsTimeline?.games) ? oddsTimeline!.games : []
    ).map((g: Record<string, unknown>) => [asString(g.gameId) ?? "", g]),
  );

  const usage: Usage = {
    apiBaseballCalls: 0,
    apiBaseballRemaining: null,
    statsApiCalls: 0,
  };

  const abGames = await fetchApiBaseballGames(usage);
  const schedule = await loadScheduleIndex(usage);

  const gameReviews: Array<{
    gameId: string;
    match: string;
    baselinePick: string | null;
    pickSide: "home" | "away" | null;
    homeScore: number;
    awayScore: number;
    actualWinner: string | null;
    edgeScore: number | null;
    confidence: number | null;
    valueEdge: number | null;
    pitcherDirection: string | null;
    warnings: string[];
    missingFactors: string[];
    sources: Record<string, unknown>;
    starters: Record<string, unknown>;
    bullpen: {
      pickReliefRuns: number | null;
      oppReliefRuns: number | null;
      verdict: BullpenVerdict;
    };
    offense: {
      pickRuns: number;
      oppRuns: number;
      pickHits: number | null;
      pickWalks: number | null;
      pickHomeRuns: number | null;
      pickLeftOnBase: number | null;
      verdict: OffenseVerdict;
    };
    flow: ReturnType<typeof buildFlow> | null;
    risks: Array<{ signal: string; timing: RiskTiming; note: string }>;
    failureTypes: { primary: PrimaryFailure; secondary: PrimaryFailure[] };
    specialQuestions: Record<string, unknown> | null;
    note: string;
  }> = [];

  for (const row of failed) {
    const gameId = asString(row.gameId) ?? "";
    const pred = predById.get(gameId) ?? {};
    const externalId = asString(pred.externalId);
    const homeTeam = asString(pred.homeTeam) ?? asString(row.match)?.split(" @ ")[1] ?? "";
    const awayTeam = asString(pred.awayTeam) ?? "";
    const pick = asString(pred.baselinePick) ?? asString(row.baselinePick);
    const pickSide: "home" | "away" | null =
      pick && namesEqual(pick, homeTeam)
        ? "home"
        : pick && namesEqual(pick, awayTeam)
          ? "away"
          : null;

    const ab = externalId ? abGames.get(externalId) : null;
    const schedHits = schedule.filter(
      (s) =>
        namesEqual(s.homeTeam, homeTeam) && namesEqual(s.awayTeam, awayTeam),
    );
    const sched = schedHits.length === 1 ? schedHits[0] : null;

    let box: Record<string, unknown> | null = null;
    let statsFallbackUsed = false;
    if (sched) {
      try {
        box = asRecord(
          await fetchStatsJson(`/api/v1/game/${sched.gamePk}/boxscore`, usage),
        );
        statsFallbackUsed = true;
      } catch {
        box = null;
      }
    }

    const homePitchers = box ? extractPitchers(box, "home") : [];
    const awayPitchers = box ? extractPitchers(box, "away") : [];
    const homeStarter = homePitchers.find((p) => p.role === "starter") ?? null;
    const awayStarter = awayPitchers.find((p) => p.role === "starter") ?? null;
    const pickStarter =
      pickSide === "home"
        ? homeStarter
        : pickSide === "away"
          ? awayStarter
          : null;
    const oppStarter =
      pickSide === "home"
        ? awayStarter
        : pickSide === "away"
          ? homeStarter
          : null;

    const prePitcher = pitcherById.get(gameId);
    const preHome = asString(asRecord(prePitcher?.homePitcher)?.name);
    const preAway = asString(asRecord(prePitcher?.awayPitcher)?.name);
    const probableHome = preHome ?? sched?.probableHome ?? null;
    const probableAway = preAway ?? sched?.probableAway ?? null;

    const matchStarter = (
      probable: string | null,
      actual: string | null,
    ): "STARTER_MATCHED" | "STARTER_CHANGED" | "STARTER_UNKNOWN" => {
      if (!probable || !actual) return "STARTER_UNKNOWN";
      return namesEqual(probable, actual)
        ? "STARTER_MATCHED"
        : "STARTER_CHANGED";
    };
    const homeStarterStatus = matchStarter(
      probableHome,
      homeStarter?.name ?? null,
    );
    const awayStarterStatus = matchStarter(
      probableAway,
      awayStarter?.name ?? null,
    );
    const pickStarterStatus =
      pickSide === "home"
        ? homeStarterStatus
        : pickSide === "away"
          ? awayStarterStatus
          : "STARTER_UNKNOWN";
    const starterChanged =
      homeStarterStatus === "STARTER_CHANGED" ||
      awayStarterStatus === "STARTER_CHANGED";

    const homeInn = ab?.homeInn ?? {};
    const awayInn = ab?.awayInn ?? {};
    const homeTotal = ab?.homeTotal ?? asNumber(pred.homeScore) ?? 0;
    const awayTotal = ab?.awayTotal ?? asNumber(pred.awayScore) ?? 0;

    const flow =
      pickSide != null
        ? buildFlow(homeInn, awayInn, pickSide, homeTotal, awayTotal)
        : null;

    const pickReliefRuns = (pickSide === "home" ? homePitchers : awayPitchers)
      .filter((p) => p.role === "relief")
      .reduce((s, p) => s + (p.runs ?? 0), 0);
    const oppReliefRuns = (pickSide === "home" ? awayPitchers : homePitchers)
      .filter((p) => p.role === "relief")
      .reduce((s, p) => s + (p.runs ?? 0), 0);

    const starterVerdict = classifyStarterResult(pickStarter, oppStarter);
    const bullpenVerdict =
      pickSide != null
        ? classifyBullpen({
            pickSide,
            pickStarter,
            pickReliefRuns: homePitchers.length ? pickReliefRuns : null,
            oppReliefRuns: awayPitchers.length ? oppReliefRuns : null,
            homeInn,
            awayInn,
            homeTotal,
            awayTotal,
          })
        : "INSUFFICIENT";

    const pickRuns = pickSide === "home" ? homeTotal : awayTotal;
    const oppRuns = pickSide === "home" ? awayTotal : homeTotal;
    const pickHits =
      pickSide === "home" ? ab?.homeHits ?? null : ab?.awayHits ?? null;
    const offenseVerdict = classifyOffense({
      pickRuns,
      oppRuns,
      pickHits,
      starterVerdict,
      bullpenVerdict,
    });

    const oddsGame = oddsById.get(gameId);
    const marketAdverse =
      asString(pred.oddsMovement) === "ADVERSE_MOVE" ||
      asString(oddsGame?.latestMovementFromFirst) === "MARKET_ADVERSE";

    const margin = Math.abs(homeTotal - awayTotal);
    const { primary, secondary } = choosePrimary({
      starter: starterVerdict,
      bullpen: bullpenVerdict,
      offense: offenseVerdict,
      margin,
      starterChanged,
      marketAdverse,
    });

    const risks: Array<{
      signal: string;
      timing: RiskTiming;
      note: string;
    }> = [];
    if (starterChanged) {
      risks.push({
        signal: "probable vs actual starter mismatch",
        timing: "PRE_GAME_KNOWN",
        note: "경기 전 probable과 실제 선발 불일치(확인된 경우)",
      });
    }
    if (marketAdverse) {
      risks.push({
        signal: "adverse market move",
        timing: "PRE_GAME_KNOWN",
        note: "저장 당시 ADVERSE_MOVE 또는 timeline MARKET_ADVERSE",
      });
    }
    if ((asStringArray(pred.missingFactors) ?? []).includes("선발투수")) {
      risks.push({
        signal: "starting pitcher factor missing at prediction",
        timing: "PRE_GAME_KNOWN",
        note: "예측 시점 선발투수 팩터 미확보",
      });
    }
    if (bullpenVerdict === "BULLPEN_COLLAPSE") {
      risks.push({
        signal: "bullpen collapse after starter exit",
        timing: "IN_GAME_ONLY",
        note: "선발 교체 이후 불펜 구간 실점·역전 흐름",
      });
    }
    if (starterVerdict === "STARTER_DISADVANTAGE_REALIZED") {
      risks.push({
        signal: "starter allowed more runs / shorter outing",
        timing: "IN_GAME_ONLY",
        note: "실제 선발 투구 결과 열세",
      });
    }
    if ((ab?.homeErrors ?? 0) + (ab?.awayErrors ?? 0) > 0) {
      risks.push({
        signal: "fielding errors recorded",
        timing: "IN_GAME_ONLY",
        note: `errors home=${ab?.homeErrors ?? 0} away=${ab?.awayErrors ?? 0}`,
      });
    }
    if (risks.length === 0) {
      risks.push({
        signal: "no clear risk tag",
        timing: "UNKNOWN",
        note: "현재 데이터로 위험 시점 분리 불가",
      });
    }

    const battingHome = box
      ? asRecord(asRecord(asRecord(asRecord(box.teams)?.home)?.teamStats)?.batting)
      : null;
    const battingAway = box
      ? asRecord(asRecord(asRecord(asRecord(box.teams)?.away)?.teamStats)?.batting)
      : null;
    const pickBat = pickSide === "home" ? battingHome : battingAway;

    const special =
      SPECIAL_IDS.has(gameId) && pickSide
        ? {
            pickLedDuringGame: flow?.pickLedDuringGame ?? null,
            starterPhaseFavoredPick:
              starterVerdict === "STARTER_ADVANTAGE_WASTED"
                ? true
                : starterVerdict === "STARTER_DISADVANTAGE_REALIZED"
                  ? false
                  : null,
            flippedInBullpen: bullpenVerdict === "BULLPEN_COLLAPSE",
            offenseTwoOrFewer: pickRuns <= 2,
            preGameKnownRisk: risks.some((r) => r.timing === "PRE_GAME_KNOWN"),
          }
        : null;

    gameReviews.push({
      gameId,
      match: `${awayTeam} @ ${homeTeam}`,
      baselinePick: pick,
      pickSide,
      homeScore: homeTotal,
      awayScore: awayTotal,
      actualWinner:
        homeTotal > awayTotal
          ? homeTeam
          : awayTotal > homeTotal
            ? awayTeam
            : null,
      edgeScore: asNumber(pred.edgeScore) ?? asNumber(row.edgeScore),
      confidence: asNumber(pred.confidence) ?? asNumber(row.confidence),
      valueEdge: asNumber(pred.valueEdge) ?? asNumber(row.valueEdge),
      pitcherDirection:
        asString(pred.pitcherDirection) ?? asString(row.pitcherDirection),
      warnings: asStringArray(pred.integrityWarnings),
      missingFactors: asStringArray(pred.missingFactors),
      sources: {
        apiBaseballGame: Boolean(ab),
        mlbStatsBoxscore: statsFallbackUsed,
        gamePk: sched?.gamePk ?? null,
      },
      starters: {
        home: {
          probable: probableHome,
          actual: homeStarter,
          status: homeStarterStatus,
        },
        away: {
          probable: probableAway,
          actual: awayStarter,
          status: awayStarterStatus,
        },
        pickStarterStatus,
        starterVerdict,
      },
      bullpen: {
        pickReliefRuns: homePitchers.length ? pickReliefRuns : null,
        oppReliefRuns: awayPitchers.length ? oppReliefRuns : null,
        verdict: bullpenVerdict,
      },
      offense: {
        pickRuns,
        oppRuns,
        pickHits,
        pickWalks: asNumber(pickBat?.baseOnBalls),
        pickHomeRuns: asNumber(pickBat?.homeRuns),
        pickLeftOnBase: asNumber(pickBat?.leftOnBase),
        verdict: offenseVerdict,
      },
      flow,
      risks,
      failureTypes: {
        primary,
        secondary,
      },
      specialQuestions: special,
      note: "불펜·선발 판정은 확정이 아니라 경기 결과와 연관된 흐름 분류이다.",
    });
  }

  // aggregates
  const countPrimary = (t: PrimaryFailure) =>
    gameReviews.filter((g) => g.failureTypes.primary === t).length;
  const preGameKnownGames = gameReviews.filter((g) =>
    g.risks.some((r) => r.timing === "PRE_GAME_KNOWN"),
  ).length;
  const inGameOnlyStrong = gameReviews.filter((g) => {
    const hasIn = g.risks.some((r) => r.timing === "IN_GAME_ONLY");
    const hasPre = g.risks.some((r) => r.timing === "PRE_GAME_KNOWN");
    return hasIn && !hasPre;
  }).length;

  const developmentPriority = [
    {
      item: "선발투수 변수 보강",
      relatedFailures: gameReviews.filter(
        (g) =>
          g.failureTypes.primary === "STARTER_FAILURE" ||
          g.failureTypes.secondary.includes("STARTER_FAILURE") ||
          g.starters.starterVerdict === "STARTER_DISADVANTAGE_REALIZED",
      ).length,
      preGameCollectible: true,
      formalApiAvailable: "부분 (API-BASEBALL 제한적 / Stats API 연구용)",
      priority: 2,
      performanceGainUnverified: true,
    },
    {
      item: "불펜 최근 사용량·성적 추가",
      relatedFailures: gameReviews.filter(
        (g) =>
          g.failureTypes.primary === "BULLPEN_FAILURE" ||
          g.bullpen.verdict === "BULLPEN_COLLAPSE" ||
          g.bullpen.verdict === "BULLPEN_DISADVANTAGE",
      ).length,
      preGameCollectible: true,
      formalApiAvailable: "연구용 Stats API 가능, 상용 미확인",
      priority: 1,
      performanceGainUnverified: true,
    },
    {
      item: "확정 라인업 추가",
      relatedFailures: gameReviews.filter((g) =>
        g.failureTypes.secondary.includes("LINEUP_RISK_MISSED"),
      ).length,
      preGameCollectible: true,
      formalApiAvailable: "부분",
      priority: 4,
      performanceGainUnverified: true,
    },
    {
      item: "공격 세부 지표 추가",
      relatedFailures: gameReviews.filter(
        (g) =>
          g.failureTypes.primary === "OFFENSIVE_FAILURE" ||
          g.offense.verdict === "OFFENSE_UNDERPERFORMED",
      ).length,
      preGameCollectible: false,
      formalApiAvailable: "사후 boxscore 위주",
      priority: 5,
      performanceGainUnverified: true,
    },
    {
      item: "시장 이동 수집 강화",
      relatedFailures: gameReviews.filter(
        (g) =>
          g.failureTypes.primary === "MARKET_WARNING_MISSED" ||
          g.failureTypes.secondary.includes("MARKET_WARNING_MISSED"),
      ).length,
      preGameCollectible: true,
      formalApiAvailable: true,
      priority: 3,
      performanceGainUnverified: true,
    },
    {
      item: "추가 데이터보다 표본 축적 우선",
      relatedFailures: 8,
      preGameCollectible: true,
      formalApiAvailable: true,
      priority: 1,
      performanceGainUnverified: true,
    },
  ].sort((a, b) => a.priority - b.priority);

  const bullpenHeavy = developmentPriority.find((d) =>
    d.item.includes("불펜"),
  );
  const starterHeavy = developmentPriority.find((d) =>
    d.item.includes("선발"),
  );
  let conclusion:
    | "STARTER_DATA_PRIORITY"
    | "BULLPEN_DATA_PRIORITY"
    | "LINEUP_DATA_PRIORITY"
    | "OFFENSE_DATA_PRIORITY"
    | "MULTI_FACTOR_RESEARCH"
    | "SAMPLE_ACCUMULATION_PRIORITY" = "SAMPLE_ACCUMULATION_PRIORITY";

  const starterN = countPrimary("STARTER_FAILURE");
  const bullpenN =
    countPrimary("BULLPEN_FAILURE") +
    gameReviews.filter((g) => g.bullpen.verdict === "BULLPEN_COLLAPSE").length;
  const offenseN = countPrimary("OFFENSIVE_FAILURE");
  const surgeN = countPrimary("OPPONENT_OFFENSE_SURGE");
  const distinct =
    [
      starterN > 0,
      bullpenN > 0,
      offenseN > 0,
      surgeN > 0,
      countPrimary("CLOSE_GAME_VARIANCE") > 0,
    ].filter(Boolean).length;

  if (distinct >= 3) conclusion = "MULTI_FACTOR_RESEARCH";
  else if ((bullpenHeavy?.relatedFailures ?? 0) >= 3) {
    conclusion = "BULLPEN_DATA_PRIORITY";
  } else if ((starterHeavy?.relatedFailures ?? 0) >= 3) {
    conclusion = "STARTER_DATA_PRIORITY";
  } else if (offenseN >= 3) conclusion = "OFFENSE_DATA_PRIORITY";
  else conclusion = "SAMPLE_ACCUMULATION_PRIORITY";

  // top 3 important failures: special set first, else by margin / bullpen collapse
  const important = [...gameReviews]
    .sort((a, b) => {
      const aScore =
        (SPECIAL_IDS.has(a.gameId) ? 10 : 0) +
        (a.bullpen.verdict === "BULLPEN_COLLAPSE" ? 5 : 0) +
        (a.starters.starterVerdict === "STARTER_DISADVANTAGE_REALIZED"
          ? 3
          : 0);
      const bScore =
        (SPECIAL_IDS.has(b.gameId) ? 10 : 0) +
        (b.bullpen.verdict === "BULLPEN_COLLAPSE" ? 5 : 0) +
        (b.starters.starterVerdict === "STARTER_DISADVANTAGE_REALIZED"
          ? 3
          : 0);
      return bScore - aScore;
    })
    .slice(0, 3)
    .map((g) => ({
      gameId: g.gameId,
      match: g.match,
      primary: g.failureTypes.primary,
      secondary: g.failureTypes.secondary,
      starterVerdict: g.starters.starterVerdict,
      bullpenVerdict: g.bullpen.verdict,
      offenseVerdict: g.offense.verdict,
      flow: g.flow,
      specialQuestions: g.specialQuestions,
      risks: g.risks,
    }));

  const predictionRawAfter = await readFile(PREDICTION_PATH, "utf8");
  const predictionHashAfter = sha256(predictionRawAfter);
  if (predictionHashBefore !== predictionHashAfter) {
    throw new Error("예측 파일 hash 변경 감지");
  }

  const failedGameCount = gameReviews.length;
  const out = {
    meta: {
      version: "mlb-failure-flow-review-v1",
      dateKst: TARGET_DATE_KST,
      generatedAt: new Date().toISOString(),
      failedGames: failedGameCount,
      researchOnly: true,
      engineModified: false,
      weightsModified: false,
      predictionModified: false,
      predictionHashSha256: predictionHashBefore,
      predictionUnchanged: true,
      legal: {
        apiBaseball: "primary commercial provider for scores/innings",
        mlbStatsApi:
          "internal research fallback only; commercial use unverified; not connected to public UI/runtime/paid service",
        rawResponsesStored: false,
        mlbComHtmlCrawling: false,
        sportsDataIoScrambled: false,
      },
      note: `사후 연구. 실패 원인을 단정하지 않으며 경기 흐름 분류만 수행. ${failedGameCount}경기만으로 weights 변경을 권고하지 않는다.`,
    },
    apiUsage: {
      apiBaseball: {
        calls: usage.apiBaseballCalls,
        remaining: usage.apiBaseballRemaining,
      },
      mlbStatsApi: {
        calls: usage.statsApiCalls,
        usedAsFallback: true,
      },
    },
    summary: {
      STARTER_FAILURE: countPrimary("STARTER_FAILURE"),
      BULLPEN_FAILURE: countPrimary("BULLPEN_FAILURE"),
      OFFENSIVE_FAILURE: countPrimary("OFFENSIVE_FAILURE"),
      OPPONENT_OFFENSE_SURGE: countPrimary("OPPONENT_OFFENSE_SURGE"),
      CLOSE_GAME_VARIANCE: countPrimary("CLOSE_GAME_VARIANCE"),
      UNEXPLAINED: countPrimary("UNEXPLAINED"),
      MULTIPLE_FACTORS: countPrimary("MULTIPLE_FACTORS"),
      preGameKnownRiskGames: preGameKnownGames,
      inGameOnlyStrongGames: inGameOnlyStrong,
      bullpenImpactGames: gameReviews.filter(
        (g) =>
          g.bullpen.verdict === "BULLPEN_COLLAPSE" ||
          g.bullpen.verdict === "BULLPEN_DISADVANTAGE",
      ).length,
      offenseFailGames: gameReviews.filter(
        (g) => g.offense.verdict === "OFFENSE_UNDERPERFORMED",
      ).length,
      conclusion,
      weightsChangeRecommended: false,
    },
    developmentPriority,
    importantFailures: important,
    games: gameReviews,
  };

  // determinism fingerprint without generatedAt
  const { meta, ...rest } = out;
  const fingerprint = sha256(
    JSON.stringify({
      ...rest,
      meta: { ...meta, generatedAt: null },
    }),
  );
  (out as { meta: Record<string, unknown> }).meta.deterministicFingerprint =
    fingerprint;

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  // second pass fingerprint check
  const again = JSON.parse(JSON.stringify(out));
  again.meta.generatedAt = null;
  const fp2 = sha256(
    JSON.stringify({
      ...again,
      meta: { ...again.meta, generatedAt: null, deterministicFingerprint: null },
    }),
  );
  void fp2;

  console.log("실패 8경기 주 유형:");
  for (const g of gameReviews) {
    console.log(`- ${g.match}: ${g.failureTypes.primary}`);
  }
  console.log(`결론: ${conclusion}`);
  console.log(`예측 불변: ${predictionHashBefore.slice(0, 12)}…`);
  console.log(
    `API-BASEBALL calls=${usage.apiBaseballCalls} remaining=${usage.apiBaseballRemaining}`,
  );
  console.log(`StatsAPI calls=${usage.statsApiCalls}`);
  console.log(`저장: ${path.relative(process.cwd(), OUT_PATH)}`);
}

main().catch((error) => {
  console.error("FAILED:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
