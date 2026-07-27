/**
 * MLB SIGNAL_WORKED 경기 사후 경기 흐름 복기.
 *
 * - Engine / weights / 과거 예측 / 추천 등급 수정 금지
 * - 실패 리뷰 파일 미수정
 * - 우선: API-BASEBALL Pro / fallback: MLB Stats API boxscore (연구용)
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/review-mlb-success-game-flow.ts [YYYY-MM-DD]
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
const FAILURE_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  "mlb",
  `${TARGET_DATE_KST}-failure-flow-review.json`,
);
const PITCHER_PATH = path.join(
  process.cwd(),
  "data",
  "watchlists",
  `${TARGET_DATE_KST}-mlb-pitcher-review.json`,
);
const OUT_PATH = path.join(
  process.cwd(),
  "data",
  "predictions",
  "mlb",
  `${TARGET_DATE_KST}-success-flow-review.json`,
);

type PrimarySuccess =
  | "BASELINE_SIGNAL_CONFIRMED"
  | "STARTER_ADVANTAGE_REALIZED"
  | "BULLPEN_PROTECTED_SIGNAL"
  | "OFFENSIVE_EDGE_REALIZED"
  | "MARKET_ALIGNED_WIN"
  | "MARKET_CONTRARIAN_WIN"
  | "CLOSE_GAME_VARIANCE_FAVORED"
  | "MULTIPLE_FACTORS"
  | "LUCKY_RESULT_POSSIBLE"
  | "UNEXPLAINED_SUCCESS";

type StarterVerdict =
  | "STARTER_ADVANTAGE_REALIZED"
  | "STARTER_DISADVANTAGE_OVERCOME"
  | "STARTERS_EVEN"
  | "INSUFFICIENT";

type BullpenVerdict =
  | "BULLPEN_PROTECTED_LEAD"
  | "BULLPEN_CREATED_WIN"
  | "BULLPEN_NEUTRAL"
  | "BULLPEN_WARNING_SURVIVED"
  | "INSUFFICIENT";

type OffenseVerdict =
  | "OFFENSE_DOMINATED"
  | "OFFENSE_TIMELY"
  | "OFFENSE_SUPPORTED_PITCHING"
  | "OFFENSE_NOT_PRIMARY"
  | "INSUFFICIENT";

type SignalTiming = "PRE_GAME_SIGNAL_PRESENT" | "POST_GAME_ONLY" | "UNKNOWN";

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
function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
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
  const m = /^(\d+)(?:\.(\d))?$/.exec(String(ip));
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = m[2] != null ? Number(m[2]) : 0;
  return whole * 3 + Math.min(frac, 2);
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
  let allowedLeadLoss = false;

  for (let i = 1; i <= 12; i += 1) {
    if (homeInn[String(i)] == null && awayInn[String(i)] == null && i > 9) {
      break;
    }
    const s = scoreAfterInning(homeInn, awayInn, i);
    const pick = pickSide === "home" ? s.home : s.away;
    const opp = pickSide === "home" ? s.away : s.home;
    const lead = pick - opp;
    if (lead > maxPickLead) maxPickLead = lead;
    if (pickLeadFirstInning == null && lead > 0) pickLeadFirstInning = i;
    if (pick === opp && !prevTied) ties += 1;
    if (opp > pick && (prevPickLead || prevTied)) {
      if (opponentTookLeadInning == null) opponentTookLeadInning = i;
      if (prevPickLead) allowedLeadLoss = true;
    }
    prevPickLead = lead > 0;
    prevOppLead = lead < 0;
    prevTied = lead === 0;
  }

  const after6 = scoreAfterInning(homeInn, awayInn, 6);
  const pickFinal = pickSide === "home" ? homeTotal : awayTotal;
  const oppFinal = pickSide === "home" ? awayTotal : homeTotal;
  const after6Pick = pickSide === "home" ? after6.home : after6.away;
  const after6Opp = pickSide === "home" ? after6.away : after6.home;

  return {
    pickFirstLeadInning: pickLeadFirstInning,
    maxPickLead,
    opponentTookLeadInning,
    allowedLeadLoss,
    tieCount: ties,
    scoreAfter6: after6,
    runsAfter6: {
      pick: pickFinal - after6Pick,
      opponent: oppFinal - after6Opp,
    },
    finalScore: { home: homeTotal, away: awayTotal },
    pickLedDuringGame: pickLeadFirstInning != null,
    earlyLead: pickLeadFirstInning != null && pickLeadFirstInning <= 3,
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
    ? sideBox.pitchers
        .map((x) => asNumber(x))
        .filter((n): n is number => n != null)
    : [];
  const players = asRecord(sideBox.players) ?? {};
  return ids.map((id, index) => {
    const player = asRecord(players[`ID${id}`]);
    const person = asRecord(player?.person);
    const pitching = asRecord(asRecord(player?.stats)?.pitching) ?? {};
    const ip = asString(pitching.inningsPitched);
    return {
      side,
      role: index === 0 ? ("starter" as const) : ("relief" as const),
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

function classifyStarterSuccess(
  pickStarter: PitcherLine | null,
  oppStarter: PitcherLine | null,
): StarterVerdict {
  if (!pickStarter || !oppStarter) return "INSUFFICIENT";
  if (pickStarter.runs == null || oppStarter.runs == null) return "INSUFFICIENT";
  const pickOuts = pickStarter.outs ?? 0;
  const oppOuts = oppStarter.outs ?? 0;
  const pickRuns = pickStarter.runs;
  const oppRuns = oppStarter.runs;
  const pickBetter =
    oppRuns >= pickRuns + 2 ||
    (oppRuns > pickRuns && oppOuts + 3 <= pickOuts);
  const pickWorse =
    pickRuns >= oppRuns + 2 ||
    (pickRuns > oppRuns && pickOuts + 3 <= oppOuts);
  if (pickBetter) return "STARTER_ADVANTAGE_REALIZED";
  if (pickWorse) return "STARTER_DISADVANTAGE_OVERCOME";
  return "STARTERS_EVEN";
}

function classifyBullpenSuccess(args: {
  pickSide: "home" | "away";
  pickStarter: PitcherLine | null;
  pickReliefRuns: number | null;
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
  const pickAt = pickSide === "home" ? atExit.home : atExit.away;
  const oppAt = pickSide === "home" ? atExit.away : atExit.home;
  const pickFinal = pickSide === "home" ? homeTotal : awayTotal;
  const oppFinal = pickSide === "home" ? awayTotal : homeTotal;
  const bullpenOppRuns = oppFinal - oppAt;
  const led = pickAt > oppAt;
  const tiedOrBehind = pickAt <= oppAt;

  if (led && pickFinal > oppFinal) {
    if (bullpenOppRuns >= 3 || args.pickReliefRuns != null && args.pickReliefRuns >= 3) {
      return "BULLPEN_WARNING_SURVIVED";
    }
    return "BULLPEN_PROTECTED_LEAD";
  }
  if (tiedOrBehind && pickFinal > oppFinal) {
    return "BULLPEN_CREATED_WIN";
  }
  return "BULLPEN_NEUTRAL";
}

function classifyOffenseSuccess(args: {
  pickRuns: number;
  oppRuns: number;
  margin: number;
  starter: StarterVerdict;
  bullpen: BullpenVerdict;
}): OffenseVerdict {
  if (args.pickRuns >= 7 || args.pickRuns - args.oppRuns >= 4) {
    return "OFFENSE_DOMINATED";
  }
  if (args.margin <= 2 && args.pickRuns >= 3 && args.pickRuns <= 6) {
    return "OFFENSE_TIMELY";
  }
  if (
    args.starter === "STARTER_ADVANTAGE_REALIZED" &&
    args.pickRuns >= 3 &&
    args.pickRuns <= 6
  ) {
    return "OFFENSE_SUPPORTED_PITCHING";
  }
  if (
    args.starter === "STARTER_ADVANTAGE_REALIZED" ||
    args.bullpen === "BULLPEN_PROTECTED_LEAD"
  ) {
    return "OFFENSE_NOT_PRIMARY";
  }
  return "OFFENSE_SUPPORTED_PITCHING";
}

function choosePrimarySuccess(args: {
  starter: StarterVerdict;
  bullpen: BullpenVerdict;
  offense: OffenseVerdict;
  margin: number;
  valueEdge: number | null;
  absEdge: number | null;
  confidence: number | null;
  baselineStatus: string | null;
  usedFactors: string[];
}): { primary: PrimarySuccess; secondary: PrimarySuccess[] } {
  const factors: PrimarySuccess[] = [];
  const marketAligned = args.valueEdge != null && args.valueEdge >= 0;
  const marketContrarian = args.valueEdge != null && args.valueEdge < 0;

  const baselineSignalsStrong =
    (args.absEdge != null && args.absEdge >= 10) ||
    args.baselineStatus === "BASELINE_CANDIDATE" ||
    (args.confidence != null && args.confidence >= 50 && args.usedFactors.length >= 6);

  if (baselineSignalsStrong) factors.push("BASELINE_SIGNAL_CONFIRMED");
  if (args.starter === "STARTER_ADVANTAGE_REALIZED") {
    factors.push("STARTER_ADVANTAGE_REALIZED");
  }
  if (
    args.bullpen === "BULLPEN_PROTECTED_LEAD" ||
    args.bullpen === "BULLPEN_CREATED_WIN"
  ) {
    factors.push("BULLPEN_PROTECTED_SIGNAL");
  }
  if (
    args.offense === "OFFENSE_DOMINATED" ||
    args.offense === "OFFENSE_TIMELY"
  ) {
    factors.push("OFFENSIVE_EDGE_REALIZED");
  }
  if (marketAligned) factors.push("MARKET_ALIGNED_WIN");
  if (marketContrarian) factors.push("MARKET_CONTRARIAN_WIN");
  if (args.margin <= 2) factors.push("CLOSE_GAME_VARIANCE_FAVORED");

  const weakPreGame =
    (args.absEdge == null || args.absEdge < 5) &&
    (args.confidence == null || args.confidence < 50) &&
    !baselineSignalsStrong;
  if (weakPreGame && args.margin <= 2) {
    factors.push("LUCKY_RESULT_POSSIBLE");
  }
  if (
    args.starter === "STARTER_DISADVANTAGE_OVERCOME" &&
    args.margin <= 2
  ) {
    factors.push("LUCKY_RESULT_POSSIBLE");
  }

  if (factors.length === 0) {
    return { primary: "UNEXPLAINED_SUCCESS", secondary: [] };
  }

  const order: PrimarySuccess[] = [
    "BASELINE_SIGNAL_CONFIRMED",
    "STARTER_ADVANTAGE_REALIZED",
    "BULLPEN_PROTECTED_SIGNAL",
    "OFFENSIVE_EDGE_REALIZED",
    "MARKET_ALIGNED_WIN",
    "MARKET_CONTRARIAN_WIN",
    "CLOSE_GAME_VARIANCE_FAVORED",
    "LUCKY_RESULT_POSSIBLE",
  ];
  const ranked = order.filter((x) => factors.includes(x));
  // 주 유형은 우선순위 1개. 요인이 많으면 secondary에만 추가 표기.
  const primary = ranked[0] ?? factors[0];
  const secondary: PrimarySuccess[] = [];
  for (const f of ranked.slice(1)) {
    if (secondary.length < 2 && f !== primary) secondary.push(f);
  }
  if (ranked.length >= 4 && !secondary.includes("MULTIPLE_FACTORS")) {
    // 다요인임을 secondary 슬롯에 반영 (최대 2개 유지)
    if (secondary.length < 2) secondary.push("MULTIPLE_FACTORS");
    else secondary[1] = "MULTIPLE_FACTORS";
  }
  return { primary, secondary };
}

type Usage = {
  apiBaseballCalls: number;
  apiBaseballRemaining: number | null;
  statsApiCalls: number;
};

async function fetchApiBaseballGames(usage: Usage) {
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
  if (rem && Number.isFinite(Number(rem))) usage.apiBaseballRemaining = Number(rem);
  const body = (await res.json()) as { response?: unknown[] };
  const map = new Map<
    string,
    {
      homeTotal: number;
      awayTotal: number;
      homeHits: number | null;
      awayHits: number | null;
      homeErrors: number | null;
      awayErrors: number | null;
      homeInn: InningMap;
      awayInn: InningMap;
    }
  >();
  for (const raw of body.response ?? []) {
    const row = asRecord(raw);
    if (!row) continue;
    const id = asNumber(row.id);
    if (id == null) continue;
    const scores = asRecord(row.scores);
    const hs = asRecord(scores?.home);
    const as_ = asRecord(scores?.away);
    map.set(String(id), {
      homeTotal: asNumber(hs?.total) ?? 0,
      awayTotal: asNumber(as_?.total) ?? 0,
      homeHits: asNumber(hs?.hits),
      awayHits: asNumber(as_?.hits),
      homeErrors: asNumber(hs?.errors),
      awayErrors: asNumber(as_?.errors),
      homeInn: (asRecord(hs?.innings) as InningMap) ?? {},
      awayInn: (asRecord(as_?.innings) as InningMap) ?? {},
    });
  }
  return map;
}

async function fetchStatsJson(pathQuery: string, usage: Usage): Promise<unknown> {
  usage.statsApiCalls += 1;
  const res = await fetch(`${STATS_API_BASE}${pathQuery}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`StatsAPI ${res.status}`);
  return res.json();
}

async function loadScheduleIndex(usage: Usage) {
  const out: Array<{
    gamePk: number;
    homeTeam: string;
    awayTeam: string;
    probableHome: string | null;
    probableAway: string | null;
  }> = [];
  // KST 새벽 경기는 대개 전날 US 캘린더에 포함
  const prevMs =
    Date.parse(`${TARGET_DATE_KST}T12:00:00+09:00`) - 24 * 60 * 60 * 1000;
  const prevDate =
    instantToKst(new Date(prevMs).toISOString())?.date ?? TARGET_DATE_KST;
  for (const date of [prevDate, TARGET_DATE_KST]) {
    const hydrate = encodeURIComponent("probablePitcher");
    const data = asRecord(
      await fetchStatsJson(
        `/api/v1/schedule?sportId=1&date=${date}&hydrate=${hydrate}`,
        usage,
      ),
    );
    for (const day of Array.isArray(data?.dates) ? data.dates : []) {
      const games = Array.isArray(asRecord(day)?.games)
        ? (asRecord(day)!.games as unknown[])
        : [];
      for (const raw of games) {
        const row = asRecord(raw);
        if (!row) continue;
        const gamePk = asNumber(row.gamePk);
        const gameDate = asString(row.gameDate);
        const kst = gameDate ? instantToKst(gameDate) : null;
        if (!kst || kst.date !== TARGET_DATE_KST || gamePk == null) continue;
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
          probableHome: asString(asRecord(home?.probablePitcher)?.fullName),
          probableAway: asString(asRecord(away?.probablePitcher)?.fullName),
        });
      }
    }
  }
  return out;
}

async function main() {
  console.log(`=== Review MLB Success Game Flow (${TARGET_DATE_KST}) ===`);
  const predictionRaw = await readFile(PREDICTION_PATH, "utf8");
  const predictionHashBefore = sha256(predictionRaw);
  const failureRawBefore = await readFile(FAILURE_PATH, "utf8");
  const failureHashBefore = sha256(failureRawBefore);

  const prediction = JSON.parse(predictionRaw);
  const review = JSON.parse(await readFile(REVIEW_PATH, "utf8"));
  const failureReview = JSON.parse(failureRawBefore);
  let pitcherReview: { games?: unknown[] } = { games: [] };
  try {
    pitcherReview = JSON.parse(await readFile(PITCHER_PATH, "utf8"));
  } catch {
    console.warn(
      `pitcher review 없음 — 생략: ${path.relative(process.cwd(), PITCHER_PATH)}`,
    );
  }

  const predById = new Map<string, Record<string, unknown>>(
    (Array.isArray(prediction.predictions) ? prediction.predictions : []).map(
      (p: Record<string, unknown>) => [asString(p.gameId) ?? "", p],
    ),
  );
  const succeeded = (
    Array.isArray(review.games) ? review.games : []
  ).filter(
    (g: Record<string, unknown>) =>
      asString(g.feedbackClassification) === "SIGNAL_WORKED",
  ) as Record<string, unknown>[];
  console.log(`SIGNAL_WORKED=${succeeded.length}`);

  const pitcherById = new Map<string, Record<string, unknown>>(
    (Array.isArray(pitcherReview.games) ? pitcherReview.games : [])
      .map((g) => asRecord(g))
      .filter((g): g is Record<string, unknown> => g != null)
      .map((g) => [asString(g.gameId) ?? "", g]),
  );

  const usage: Usage = {
    apiBaseballCalls: 0,
    apiBaseballRemaining: null,
    statsApiCalls: 0,
  };
  const abGames = await fetchApiBaseballGames(usage);
  const schedule = await loadScheduleIndex(usage);

  type GameReview = {
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
    baselineStatus: string | null;
    pitcherDirection: string | null;
    warnings: string[];
    missingFactors: string[];
    usedFactors: string[];
    sources: Record<string, unknown>;
    starters: Record<string, unknown>;
    bullpen: { pickReliefRuns: number | null; verdict: BullpenVerdict };
    offense: Record<string, unknown>;
    flow: ReturnType<typeof buildFlow> | null;
    signals: Array<{ signal: string; timing: SignalTiming; note: string }>;
    successTypes: { primary: PrimarySuccess; secondary: PrimarySuccess[] };
    specialQuestions: Record<string, unknown> | null;
    note: string;
  };

  const gameReviews: GameReview[] = [];

  for (const row of succeeded) {
    const gameId = asString(row.gameId) ?? "";
    const pred = predById.get(gameId) ?? {};
    const externalId = asString(pred.externalId);
    const homeTeam = asString(pred.homeTeam) ?? "";
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

    const pre = pitcherById.get(gameId);
    const probableHome =
      asString(asRecord(pre?.homePitcher)?.name) ?? sched?.probableHome ?? null;
    const probableAway =
      asString(asRecord(pre?.awayPitcher)?.name) ?? sched?.probableAway ?? null;

    const matchStarter = (
      probable: string | null,
      actual: string | null,
    ): "STARTER_MATCHED" | "STARTER_CHANGED" | "STARTER_UNKNOWN" => {
      if (!probable || !actual) return "STARTER_UNKNOWN";
      return namesEqual(probable, actual) ? "STARTER_MATCHED" : "STARTER_CHANGED";
    };

    const homeTotal = ab?.homeTotal ?? asNumber(pred.homeScore) ?? 0;
    const awayTotal = ab?.awayTotal ?? asNumber(pred.awayScore) ?? 0;
    const homeInn = ab?.homeInn ?? {};
    const awayInn = ab?.awayInn ?? {};
    const flow =
      pickSide != null
        ? buildFlow(homeInn, awayInn, pickSide, homeTotal, awayTotal)
        : null;

    const pickReliefRuns = (pickSide === "home" ? homePitchers : awayPitchers)
      .filter((p) => p.role === "relief")
      .reduce((s, p) => s + (p.runs ?? 0), 0);

    const starterVerdict = classifyStarterSuccess(pickStarter, oppStarter);
    const bullpenVerdict =
      pickSide != null
        ? classifyBullpenSuccess({
            pickSide,
            pickStarter,
            pickReliefRuns: homePitchers.length ? pickReliefRuns : null,
            homeInn,
            awayInn,
            homeTotal,
            awayTotal,
          })
        : "INSUFFICIENT";

    const pickRuns = pickSide === "home" ? homeTotal : awayTotal;
    const oppRuns = pickSide === "home" ? awayTotal : homeTotal;
    const margin = Math.abs(homeTotal - awayTotal);
    const offenseVerdict = classifyOffenseSuccess({
      pickRuns,
      oppRuns,
      margin,
      starter: starterVerdict,
      bullpen: bullpenVerdict,
    });

    const edgeScore = asNumber(pred.edgeScore) ?? asNumber(row.edgeScore);
    const valueEdge = asNumber(pred.valueEdge) ?? asNumber(row.valueEdge);
    const confidence = asNumber(pred.confidence) ?? asNumber(row.confidence);
    const baselineStatus =
      asString(pred.baselineStatus) ?? asString(row.baselineStatus);
    const usedFactors = asStringArray(pred.usedFactors);

    const { primary, secondary } = choosePrimarySuccess({
      starter: starterVerdict,
      bullpen: bullpenVerdict,
      offense: offenseVerdict,
      margin,
      valueEdge,
      absEdge: edgeScore != null ? Math.abs(edgeScore) : null,
      confidence,
      baselineStatus,
      usedFactors,
    });

    const signals: Array<{
      signal: string;
      timing: SignalTiming;
      note: string;
    }> = [];
    if (usedFactors.length > 0) {
      signals.push({
        signal: "baseline usedFactors present",
        timing: "PRE_GAME_SIGNAL_PRESENT",
        note: usedFactors.join(", "),
      });
    }
    if (edgeScore != null) {
      signals.push({
        signal: `edgeScore=${edgeScore}`,
        timing: "PRE_GAME_SIGNAL_PRESENT",
        note: "저장된 EDGE",
      });
    }
    if (valueEdge != null) {
      signals.push({
        signal: `valueEdge=${valueEdge}`,
        timing: "PRE_GAME_SIGNAL_PRESENT",
        note: valueEdge >= 0 ? "시장 정렬" : "시장 충돌",
      });
    }
    if (confidence != null) {
      signals.push({
        signal: `confidence=${confidence}`,
        timing: "PRE_GAME_SIGNAL_PRESENT",
        note: "저장 Confidence",
      });
    }
    if (starterVerdict === "STARTER_ADVANTAGE_REALIZED") {
      signals.push({
        signal: "starter outing favored pick",
        timing: "POST_GAME_ONLY",
        note: "경기 후 확인된 선발 투구 결과",
      });
    }
    if (bullpenVerdict === "BULLPEN_PROTECTED_LEAD") {
      signals.push({
        signal: "bullpen protected lead",
        timing: "POST_GAME_ONLY",
        note: "경기 후 확인된 불펜 구간",
      });
    }
    if ((ab?.homeErrors ?? 0) + (ab?.awayErrors ?? 0) > 0) {
      signals.push({
        signal: "fielding errors",
        timing: "POST_GAME_ONLY",
        note: `home=${ab?.homeErrors ?? 0} away=${ab?.awayErrors ?? 0}`,
      });
    }

    const battingPick = box
      ? asRecord(
          asRecord(
            asRecord(
              asRecord(box.teams)?.[pickSide === "home" ? "home" : "away"],
            )?.teamStats,
          )?.batting,
        )
      : null;

    const specialQuestions =
      pickSide != null
        ? {
            earlyAdvantage: flow?.earlyLead ?? null,
            starterAdvantageRealized:
              starterVerdict === "STARTER_ADVANTAGE_REALIZED",
            bullpenProtected:
              bullpenVerdict === "BULLPEN_PROTECTED_LEAD" ||
              bullpenVerdict === "BULLPEN_CREATED_WIN",
            offenseLed:
              offenseVerdict === "OFFENSE_DOMINATED" ||
              offenseVerdict === "OFFENSE_TIMELY",
            marketAligned: valueEdge != null ? valueEdge >= 0 : null,
            marketContrarian: valueEdge != null ? valueEdge < 0 : null,
            preGameSignalsPresent: signals.some(
              (s) => s.timing === "PRE_GAME_SIGNAL_PRESENT",
            ),
            luckyPossible:
              primary === "LUCKY_RESULT_POSSIBLE" ||
              secondary.includes("LUCKY_RESULT_POSSIBLE"),
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
      edgeScore,
      confidence,
      valueEdge,
      baselineStatus,
      pitcherDirection:
        asString(pred.pitcherDirection) ?? asString(row.pitcherDirection),
      warnings: asStringArray(pred.integrityWarnings),
      missingFactors: asStringArray(pred.missingFactors),
      usedFactors,
      sources: {
        apiBaseballGame: Boolean(ab),
        mlbStatsBoxscore: statsFallbackUsed,
        gamePk: sched?.gamePk ?? null,
      },
      starters: {
        home: {
          probable: probableHome,
          actual: homeStarter,
          status: matchStarter(probableHome, homeStarter?.name ?? null),
        },
        away: {
          probable: probableAway,
          actual: awayStarter,
          status: matchStarter(probableAway, awayStarter?.name ?? null),
        },
        starterVerdict,
      },
      bullpen: {
        pickReliefRuns: homePitchers.length ? pickReliefRuns : null,
        verdict: bullpenVerdict,
      },
      offense: {
        pickRuns,
        oppRuns,
        pickHits:
          pickSide === "home" ? ab?.homeHits ?? null : ab?.awayHits ?? null,
        pickWalks: asNumber(battingPick?.baseOnBalls),
        pickHomeRuns: asNumber(battingPick?.homeRuns),
        pickLeftOnBase: asNumber(battingPick?.leftOnBase),
        verdict: offenseVerdict,
      },
      flow,
      signals,
      successTypes: { primary, secondary },
      specialQuestions,
      note: "불펜·선발 판정은 승리 원인 단정이 아니라 경기 흐름 분류이다.",
    });
  }

  const countPrimary = (t: PrimarySuccess) =>
    gameReviews.filter((g) => g.successTypes.primary === t).length;

  // failure comparison
  const failGames = Array.isArray(failureReview.games)
    ? failureReview.games
    : [];
  const failN = failGames.length;
  const successN = gameReviews.length;
  const failBullpenCollapse = failGames.filter(
    (g: Record<string, unknown>) =>
      asString(asRecord(g.bullpen)?.verdict) === "BULLPEN_COLLAPSE" ||
      asString(asRecord(g.bullpen)?.verdict) === "BULLPEN_DISADVANTAGE",
  ).length;
  const failStarterDisadv = failGames.filter(
    (g: Record<string, unknown>) =>
      asString(asRecord(g.starters)?.starterVerdict) ===
      "STARTER_DISADVANTAGE_REALIZED",
  ).length;
  const failOffense = failGames.filter(
    (g: Record<string, unknown>) =>
      asString(asRecord(g.offense)?.verdict) === "OFFENSE_UNDERPERFORMED",
  ).length;

  const successBullpenProtect = gameReviews.filter(
    (g) =>
      g.bullpen.verdict === "BULLPEN_PROTECTED_LEAD" ||
      g.bullpen.verdict === "BULLPEN_CREATED_WIN",
  ).length;
  const successStarterAdv = gameReviews.filter(
    (g) => g.starters.starterVerdict === "STARTER_ADVANTAGE_REALIZED",
  ).length;
  const successOffense = gameReviews.filter(
    (g) =>
      g.offense.verdict === "OFFENSE_DOMINATED" ||
      g.offense.verdict === "OFFENSE_TIMELY",
  ).length;
  const marketAligned = gameReviews.filter(
    (g) => g.valueEdge != null && g.valueEdge >= 0,
  ).length;
  const marketContrarian = gameReviews.filter(
    (g) => g.valueEdge != null && g.valueEdge < 0,
  ).length;

  const comparison = {
    successBullpenProtectRate:
      successN > 0
        ? Math.round((successBullpenProtect / successN) * 1000) / 10
        : null,
    failBullpenCollapseRate:
      failN > 0 ? Math.round((failBullpenCollapse / failN) * 1000) / 10 : null,
    successStarterAdvantageRate:
      successN > 0
        ? Math.round((successStarterAdv / successN) * 1000) / 10
        : null,
    failStarterDisadvantageRate:
      failN > 0 ? Math.round((failStarterDisadv / failN) * 1000) / 10 : null,
    successOffenseEdgeRate:
      successN > 0
        ? Math.round((successOffense / successN) * 1000) / 10
        : null,
    failOffenseFailRate:
      failN > 0 ? Math.round((failOffense / failN) * 1000) / 10 : null,
    marketAlignedWins: marketAligned,
    marketContrarianWins: marketContrarian,
    repeatedBothSides: [
      "선발투수 팩터 예측 시점 누락(missingFactors)",
      "불펜 구간이 결과 흐름과 자주 연관",
    ],
    successOnlyPatterns: [
      successBullpenProtect >= 3 ? "불펜이 리드/승리를 지키는 흐름" : null,
      successStarterAdv >= 2 ? "선발 우세 실현" : null,
      marketAligned >= 1 && marketContrarian >= 1
        ? "시장 정렬·충돌 모두에서 적중 사례 존재"
        : null,
    ].filter(Boolean),
    failureOnlyPatterns: [
      failBullpenCollapse >= 3 ? "불펜 붕괴/불리 흐름" : null,
      failStarterDisadv >= 2 ? "선발 열세 실현" : null,
    ].filter(Boolean),
    note: "표본 6 vs 8 — 인과관계 단정 금지",
  };

  const developmentPriority = [
    {
      item: "불펜 최근 사용량·성적",
      successExplained: successBullpenProtect,
      failureRelated: failBullpenCollapse,
      preGameCollectible: true,
      formalApiAvailable: "연구용 Stats API / 상용 미확인",
      priority: 1,
      performanceGainUnverified: true,
    },
    {
      item: "선발투수 변수",
      successExplained: successStarterAdv,
      failureRelated: failStarterDisadv,
      preGameCollectible: true,
      formalApiAvailable: "부분",
      priority: 2,
      performanceGainUnverified: true,
    },
    {
      item: "표본 축적",
      successExplained: successN,
      failureRelated: failN,
      preGameCollectible: true,
      formalApiAvailable: true,
      priority: 1,
      performanceGainUnverified: true,
    },
    {
      item: "시장 이동 수집",
      successExplained: marketAligned + marketContrarian,
      failureRelated: 0,
      preGameCollectible: true,
      formalApiAvailable: true,
      priority: 3,
      performanceGainUnverified: true,
    },
    {
      item: "공격 세부 지표",
      successExplained: successOffense,
      failureRelated: failOffense,
      preGameCollectible: false,
      formalApiAvailable: "사후 boxscore 위주",
      priority: 4,
      performanceGainUnverified: true,
    },
    {
      item: "라인업",
      successExplained: 0,
      failureRelated: 0,
      preGameCollectible: true,
      formalApiAvailable: "부분",
      priority: 5,
      performanceGainUnverified: true,
    },
  ].sort((a, b) => a.priority - b.priority);

  let conclusion:
    | "BULLPEN_SIGNAL_IMPORTANT"
    | "STARTER_SIGNAL_IMPORTANT"
    | "OFFENSE_SIGNAL_IMPORTANT"
    | "MARKET_SIGNAL_IMPORTANT"
    | "MULTI_FACTOR_RESEARCH"
    | "SAMPLE_ACCUMULATION_PRIORITY" = "SAMPLE_ACCUMULATION_PRIORITY";

  const distinct = [
    successBullpenProtect >= 2,
    successStarterAdv >= 2,
    successOffense >= 2,
    marketAligned >= 1 && marketContrarian >= 1,
  ].filter(Boolean).length;

  if (distinct >= 3) conclusion = "MULTI_FACTOR_RESEARCH";
  else if (successBullpenProtect >= 3) conclusion = "BULLPEN_SIGNAL_IMPORTANT";
  else if (successStarterAdv >= 3) conclusion = "STARTER_SIGNAL_IMPORTANT";
  else if (successOffense >= 3) conclusion = "OFFENSE_SIGNAL_IMPORTANT";
  else if (marketContrarian >= 2) conclusion = "MARKET_SIGNAL_IMPORTANT";
  else conclusion = "MULTI_FACTOR_RESEARCH";

  const predictionRawAfter = await readFile(PREDICTION_PATH, "utf8");
  const failureRawAfter = await readFile(FAILURE_PATH, "utf8");
  if (sha256(predictionRawAfter) !== predictionHashBefore) {
    throw new Error("예측 파일 hash 변경");
  }
  if (sha256(failureRawAfter) !== failureHashBefore) {
    throw new Error("실패 리뷰 파일 hash 변경");
  }

  const successGameCount = gameReviews.length;
  const out = {
    meta: {
      version: "mlb-success-flow-review-v1",
      dateKst: TARGET_DATE_KST,
      generatedAt: new Date().toISOString(),
      successGames: successGameCount,
      researchOnly: true,
      engineModified: false,
      weightsModified: false,
      predictionModified: false,
      failureReviewModified: false,
      predictionHashSha256: predictionHashBefore,
      failureReviewHashSha256: failureHashBefore,
      predictionUnchanged: true,
      failureReviewUnchanged: true,
      legal: {
        apiBaseball: "primary commercial provider for scores/innings",
        mlbStatsApi:
          "internal research fallback only; commercial use unverified; not connected to public UI/runtime/paid service",
        rawResponsesStored: false,
        mlbComHtmlCrawling: false,
        sportsDataIoScrambled: false,
      },
      note: `사후 연구. 승리 원인을 단정하지 않으며 경기 흐름 분류만 수행. ${successGameCount}경기만으로 weights 변경을 권고하지 않는다.`,
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
      BASELINE_SIGNAL_CONFIRMED: countPrimary("BASELINE_SIGNAL_CONFIRMED"),
      STARTER_ADVANTAGE_REALIZED: countPrimary("STARTER_ADVANTAGE_REALIZED"),
      BULLPEN_PROTECTED_SIGNAL: countPrimary("BULLPEN_PROTECTED_SIGNAL"),
      OFFENSIVE_EDGE_REALIZED: countPrimary("OFFENSIVE_EDGE_REALIZED"),
      MARKET_ALIGNED_WIN: countPrimary("MARKET_ALIGNED_WIN"),
      MARKET_CONTRARIAN_WIN: countPrimary("MARKET_CONTRARIAN_WIN"),
      CLOSE_GAME_VARIANCE_FAVORED: countPrimary("CLOSE_GAME_VARIANCE_FAVORED"),
      LUCKY_RESULT_POSSIBLE: countPrimary("LUCKY_RESULT_POSSIBLE"),
      UNEXPLAINED_SUCCESS: countPrimary("UNEXPLAINED_SUCCESS"),
      MULTIPLE_FACTORS: countPrimary("MULTIPLE_FACTORS"),
      starterAdvantageGames: successStarterAdv,
      bullpenProtectedGames: successBullpenProtect,
      offenseLedGames: successOffense,
      marketAlignedWins: marketAligned,
      marketContrarianWins: marketContrarian,
      luckyPossibleGames: gameReviews.filter(
        (g) =>
          g.successTypes.primary === "LUCKY_RESULT_POSSIBLE" ||
          g.successTypes.secondary.includes("LUCKY_RESULT_POSSIBLE"),
      ).length,
      conclusion,
      weightsChangeRecommended: false,
    },
    comparisonWithFailures: comparison,
    developmentPriority,
    games: gameReviews,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  console.log("성공 6경기 주 유형:");
  for (const g of gameReviews) {
    console.log(`- ${g.match}: ${g.successTypes.primary}`);
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
