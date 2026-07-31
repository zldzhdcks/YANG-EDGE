/**
 * NPB + KBO Immediate Pregame Accumulation v1
 * Usage: npx tsx --env-file=.env.local scripts/run-npb-kbo-immediate-pregame-accumulation-v1.ts [npb|kbo|both] [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getKstToday, instantToKst } from "../src/lib/datetime/kst";
import { buildGameId } from "../src/lib/game-id";
import { getOddsProvider } from "../src/lib/odds/get-odds-provider";
import { computeBestH2hOddsWithFormat } from "../src/lib/odds/compute-best-h2h-odds";
import type { OddsData } from "../src/lib/odds/types";
import { collectKboScheduleResultIdentityV1 } from "../src/lib/kbo/services/kbo-identity-collection-service";
import { getKboIdentityArtifactPath } from "../src/lib/kbo/kbo-identity-artifact-path";
import { getKboIdentityProvider } from "../src/lib/kbo/kbo-identity-feature-flag";
import { createTheOddsApiKboProvider } from "../src/lib/kbo/providers/the-odds-api-kbo-provider";

const ARG2 = process.argv[2]?.trim() || "both";
const ARG3 = process.argv[3]?.trim();
const MODE = /^\d{4}-\d{2}-\d{2}$/.test(ARG2) ? "both" : ARG2.toLowerCase();
const DATE = /^\d{4}-\d{2}-\d{2}$/.test(ARG2) ? ARG2 : ARG3 || getKstToday();

type Timing = Record<string, number>;
type OfficialStatus = "ELIGIBLE" | "PASS" | "BLOCKED";
type PregameClockState =
  | "PREGAME_OPEN"
  | "WARMUP_OPEN"
  | "ALREADY_STARTED"
  | "FINAL"
  | "POSTPONED"
  | "CANCELLED"
  | "UNKNOWN";

type StarterSide = {
  pitcherId: string | null;
  name: string | null;
  throwingHand: string | null;
  status: "CONFIRMED" | "PROBABLE_ONLY" | "MISSING" | "CHANGED" | "SOURCE_UNAVAILABLE";
  source: string | null;
  fetchedAt: string | null;
  statsAsOf: string | null;
  artifactGeneratedAt: string;
  missingFeatures: string[];
};

type OddsGameRow = {
  gameId: string;
  status:
    | "COLLECTED"
    | "PARTIAL"
    | "MARKET_NOT_AVAILABLE"
    | "FORMAT_MISMATCH"
    | "TEAM_MAPPING_FAILED"
    | "PROVIDER_ERROR"
    | "ODDS_AFTER_CUTOFF"
    | "NOT_COLLECTED";
  reasons: string[];
  providerEventId: string | null;
  sportKey: string | null;
  oddsFormat: "DECIMAL";
  declaredFormat: string | null;
  formatValidationStatus: string | null;
  homeOdds: number | null;
  awayOdds: number | null;
  bookmaker: string | null;
  marketTimestamp: string | null;
  fetchedAt: string | null;
  commenceTime: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
};

type LineupSide = {
  status: "CONFIRMED" | "PARTIAL" | "NOT_RELEASED" | "SOURCE_NOT_SUPPORTED" | "PROVIDER_ERROR" | "AFTER_CUTOFF";
  confirmed: boolean;
  battingOrder: unknown[];
  source: string | null;
  fetchedAt: string | null;
  confirmedAt: string | null;
  reasons: string[];
};

type ScheduleGame = {
  gameId: string;
  providerGameId: string | null;
  provider: string;
  home: string;
  away: string;
  venue: string | null;
  scheduledStartTime: string | null;
  statusAbstract: string | null;
  statusDetailed: string | null;
  collectedAt: string;
  source: string;
  clockState: PregameClockState;
  minutesToStart: number | null;
};

type PredictionRow = {
  sport: "baseball";
  league: "NPB" | "KBO";
  date: string;
  runId: string;
  gameId: string;
  matchup: string;
  home: string;
  away: string;
  scheduledStartTime: string | null;
  officialStatus: OfficialStatus;
  officialPick: null;
  confidence: null;
  modelProbability: null;
  marketProbability: number | null;
  valueEdge: null;
  passReasons: string[];
  blockReasons: string[];
  missingInputs: string[];
  inputWarnings: string[];
  predictedAt: string;
  engineVersion: null;
  researchBaseline: null;
  starter: { home: StarterSide; away: StarterSide };
  odds: OddsGameRow;
  lineup: { home: LineupSide; away: LineupSide; retrySuggested: boolean };
  cutoff: {
    hardCutoffPassed: boolean;
    scheduleBeforeStart: boolean | null;
    starterBeforeStart: boolean | null;
    oddsBeforeStart: boolean | null;
    lineupBeforeStart: boolean | null;
    predictedBeforeStart: boolean;
  };
  audit: {
    cutoff: "PASS" | "WARN" | "FAIL";
    leakage: "PASS" | "WARN" | "FAIL";
    mapping: "PASS" | "WARN" | "FAIL";
    detail: string[];
  };
};

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
function nowIso(): string {
  return new Date().toISOString();
}
function runIdFrom(iso: string): string {
  return iso.replace(/[:.]/g, "-");
}
async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}
async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}
async function reviseIfExists(filePath: string, runId: string): Promise<void> {
  if (!(await exists(filePath))) return;
  const rev = filePath.replace(/\.json$/i, `.rev-${runId}.json`);
  if (await exists(rev)) return;
  await writeFile(rev, await readFile(filePath, "utf8"), "utf8");
}

function classifyClock(
  scheduledStartTime: string | null,
  statusAbstract: string | null,
  statusDetailed: string | null,
  nowMs: number,
): { clockState: PregameClockState; minutesToStart: number | null; hardCutoff: boolean } {
  const blob = `${statusAbstract ?? ""} ${statusDetailed ?? ""}`.toUpperCase();
  if (/FINAL|FT|AOT|ENDED/.test(blob)) return { clockState: "FINAL", minutesToStart: null, hardCutoff: true };
  if (/POSTP|POSTPONED/.test(blob)) return { clockState: "POSTPONED", minutesToStart: null, hardCutoff: true };
  if (/CANC|CANCEL/.test(blob)) return { clockState: "CANCELLED", minutesToStart: null, hardCutoff: true };
  let startMs: number | null = null;
  if (scheduledStartTime) {
    const ms = Date.parse(scheduledStartTime);
    if (Number.isFinite(ms)) startMs = ms;
  }
  const minutesToStart = startMs == null ? null : Math.round((startMs - nowMs) / 60000);
  const hardCutoff = startMs != null && nowMs >= startMs;
  // Avoid matching "Not Started" via substring STARTED.
  const liveLike =
    /\bLIVE\b|IN[_\s-]?PROGRESS|\bIN_PLAY\b/.test(blob) &&
    !/\bNOT\s+STARTED\b|\bNS\b/.test(blob);
  if (hardCutoff || liveLike) {
    return { clockState: "ALREADY_STARTED", minutesToStart, hardCutoff: true };
  }
  if (/WARMUP|WARM-UP|PRE-GAME|PREGAME/.test(blob) && !hardCutoff) {
    return { clockState: "WARMUP_OPEN", minutesToStart, hardCutoff: false };
  }
  if (startMs != null && !hardCutoff) return { clockState: "PREGAME_OPEN", minutesToStart, hardCutoff: false };
  return { clockState: "UNKNOWN", minutesToStart, hardCutoff: false };
}

function marketProbFromOdds(home: number | null, away: number | null): number | null {
  if (home == null || away == null || home <= 1 || away <= 1) return null;
  const ih = 1 / home;
  const ia = 1 / away;
  const s = ih + ia;
  if (!(s > 0)) return null;
  return Number((ih / s).toFixed(6));
}

function emptyStarter(artifactGeneratedAt: string, reason: string): StarterSide {
  return {
    pitcherId: null,
    name: null,
    throwingHand: null,
    status: "SOURCE_UNAVAILABLE",
    source: null,
    fetchedAt: null,
    statsAsOf: null,
    artifactGeneratedAt,
    missingFeatures: [reason],
  };
}

function unsupportedLineup(reason: string): LineupSide {
  return {
    status: "SOURCE_NOT_SUPPORTED",
    confirmed: false,
    battingOrder: [],
    source: null,
    fetchedAt: null,
    confirmedAt: null,
    reasons: [reason],
  };
}

async function fetchTheSportsDbEvents(leagueId: string, dateKst: string) {
  const t0 = Date.now();
  const base = (process.env.SPORTS_API_BASE_URL ?? "https://www.thesportsdb.com/api/v1/json").replace(/\/$/, "");
  const key = (process.env.SPORTS_API_KEY ?? "").trim();
  if (!key) return { events: [] as any[], fetchedAt: nowIso(), error: "SPORTS_API_KEY missing", durationMs: Date.now() - t0 };
  const url = `${base}/${key}/eventsday.php?d=${encodeURIComponent(dateKst)}&l=${encodeURIComponent(leagueId)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as { events?: any[] | null };
    return { events: Array.isArray(json.events) ? json.events : [], fetchedAt: nowIso(), error: res.ok ? null : `HTTP ${res.status}`, durationMs: Date.now() - t0 };
  } catch (e) {
    return { events: [] as any[], fetchedAt: nowIso(), error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - t0 };
  }
}

async function fetchApiBaseballGames(leagueId: string, season: number, dateKst: string) {
  const t0 = Date.now();
  const base = (process.env.BASEBALL_API_BASE_URL ?? "https://v1.baseball.api-sports.io").replace(/\/$/, "");
  const key = (process.env.BASEBALL_API_KEY ?? process.env.FOOTBALL_API_KEY ?? "").trim();
  if (!key) {
    return { games: [] as any[], fetchedAt: nowIso(), error: "API key missing", durationMs: Date.now() - t0, usage: { remaining: null as string | null, limit: null as string | null } };
  }
  const url = `${base}/games?league=${leagueId}&season=${season}&date=${dateKst}`;
  try {
    const res = await fetch(url, { headers: { "x-apisports-key": key }, cache: "no-store" });
    const json = (await res.json()) as { response?: any[] };
    return {
      games: Array.isArray(json.response) ? json.response : [],
      fetchedAt: nowIso(),
      error: res.ok ? null : `HTTP ${res.status}`,
      durationMs: Date.now() - t0,
      usage: { remaining: res.headers.get("x-ratelimit-requests-remaining"), limit: res.headers.get("x-ratelimit-requests-limit") },
    };
  } catch (e) {
    return { games: [] as any[], fetchedAt: nowIso(), error: e instanceof Error ? e.message : String(e), durationMs: Date.now() - t0, usage: { remaining: null, limit: null } };
  }
}

async function resolveApiBaseballNpbLeagueId() {
  const base = (process.env.BASEBALL_API_BASE_URL ?? "https://v1.baseball.api-sports.io").replace(/\/$/, "");
  const key = (process.env.BASEBALL_API_KEY ?? process.env.FOOTBALL_API_KEY ?? "").trim();
  if (!key) return { leagueId: null as string | null, error: "API key missing" };
  try {
    const res = await fetch(`${base}/leagues?search=NPB`, { headers: { "x-apisports-key": key }, cache: "no-store" });
    const json = (await res.json()) as { response?: Array<{ id?: number; name?: string; country?: { name?: string } }> };
    const hit =
      (json.response ?? []).find((l) => `${l.name ?? ""}`.toLowerCase().includes("npb")) ??
      (json.response ?? []).find((l) => `${l.country?.name ?? ""}`.toLowerCase().includes("japan")) ??
      null;
    return { leagueId: hit?.id != null ? String(hit.id) : null, error: null as string | null };
  } catch (e) {
    return { leagueId: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function mapOddsEventsToRows(league: "NPB" | "KBO", dateKst: string, events: OddsData[], sportKey: string, fetchedAt: string, nowMs: number) {
  const scheduleExtras: ScheduleGame[] = [];
  const oddsByKey = new Map<string, OddsGameRow>();
  for (const ev of events) {
    const kst = instantToKst(ev.commenceTime);
    if (!kst || kst.date !== dateKst) continue;
    const gameId = buildGameId(league, ev.homeTeam, ev.awayTeam);
    const scheduledStartTime = ev.commenceTime;
    const clock = classifyClock(scheduledStartTime, "SCHEDULED", null, nowMs);
    scheduleExtras.push({
      gameId,
      providerGameId: ev.externalEventId ?? null,
      provider: "the-odds-api",
      home: ev.homeTeam,
      away: ev.awayTeam,
      venue: null,
      scheduledStartTime,
      statusAbstract: "SCHEDULED",
      statusDetailed: null,
      collectedAt: fetchedAt,
      source: "THE_ODDS_API",
      clockState: clock.clockState,
      minutesToStart: clock.minutesToStart,
    });
    const best = computeBestH2hOddsWithFormat(ev.bookmakers ?? [], ev.homeTeam, ev.awayTeam, { sourceFormat: "decimal" });
    let status: OddsGameRow["status"] = "COLLECTED";
    const reasons: string[] = [];
    if (best.formatValidationStatus === "FORMAT_MISMATCH") {
      status = "FORMAT_MISMATCH";
      reasons.push("FORMAT_MISMATCH");
    } else if (best.warnings.some((w) => w.startsWith("TEAM_MAPPING_FAILED"))) {
      status = "TEAM_MAPPING_FAILED";
      reasons.push(...best.warnings.filter((w) => w.startsWith("TEAM_MAPPING_FAILED")));
    } else if (best.bestHomeOdds == null || best.bestAwayOdds == null) {
      status = best.homeOutcomePresent || best.awayOutcomePresent ? "PARTIAL" : "MARKET_NOT_AVAILABLE";
      reasons.push(...best.partialReasons, "H2H_INCOMPLETE");
    }
    if (clock.hardCutoff) {
      status = "ODDS_AFTER_CUTOFF";
      reasons.push("HARD_CUTOFF_PASSED");
    }
    const bookmaker =
      (ev.bookmakers ?? []).find((b) => (b.markets ?? []).some((m) => m.key === "h2h"))?.title ??
      (ev.bookmakers ?? [])[0]?.title ??
      null;
    oddsByKey.set(gameId, {
      gameId,
      status,
      reasons: [...new Set(reasons)],
      providerEventId: ev.externalEventId ?? null,
      sportKey,
      oddsFormat: "DECIMAL",
      declaredFormat: "decimal",
      formatValidationStatus: best.formatValidationStatus,
      homeOdds: best.bestHomeOdds,
      awayOdds: best.bestAwayOdds,
      bookmaker,
      marketTimestamp: fetchedAt,
      fetchedAt,
      commenceTime: ev.commenceTime,
      homeTeam: ev.homeTeam,
      awayTeam: ev.awayTeam,
    });
  }
  return { scheduleExtras, oddsByKey };
}

function mergeSchedule(primary: ScheduleGame[], extras: ScheduleGame[]): ScheduleGame[] {
  const out = [...primary];
  for (const extra of extras) {
    const hit = out.find((g) => g.home.toLowerCase() === extra.home.toLowerCase() && g.away.toLowerCase() === extra.away.toLowerCase());
    if (!hit) {
      out.push(extra);
      continue;
    }
    if (!hit.scheduledStartTime && extra.scheduledStartTime) {
      hit.scheduledStartTime = extra.scheduledStartTime;
      hit.minutesToStart = extra.minutesToStart;
      hit.clockState = extra.clockState;
    }
    if (!hit.providerGameId && extra.providerGameId) hit.providerGameId = extra.providerGameId;
  }
  return out;
}

function matchOdds(game: ScheduleGame, oddsByKey: Map<string, OddsGameRow>, oddsList: OddsGameRow[]): OddsGameRow {
  const direct = oddsByKey.get(game.gameId);
  if (direct) return direct;
  const fuzzy = oddsList.find(
    (o) =>
      o.homeTeam &&
      o.awayTeam &&
      (o.homeTeam.toLowerCase().includes(game.home.toLowerCase().slice(0, 4)) || game.home.toLowerCase().includes(o.homeTeam.toLowerCase().slice(0, 4))) &&
      (o.awayTeam.toLowerCase().includes(game.away.toLowerCase().slice(0, 4)) || game.away.toLowerCase().includes(o.awayTeam.toLowerCase().slice(0, 4))),
  );
  if (fuzzy) return { ...fuzzy, gameId: game.gameId };
  return {
    gameId: game.gameId,
    status: "NOT_COLLECTED",
    reasons: ["NO_MATCHING_ODDS_EVENT"],
    providerEventId: null,
    sportKey: null,
    oddsFormat: "DECIMAL",
    declaredFormat: null,
    formatValidationStatus: null,
    homeOdds: null,
    awayOdds: null,
    bookmaker: null,
    marketTimestamp: null,
    fetchedAt: null,
    commenceTime: null,
    homeTeam: null,
    awayTeam: null,
  };
}

function buildPredictionRow(input: {
  league: "NPB" | "KBO";
  date: string;
  runId: string;
  game: ScheduleGame;
  starterHome: StarterSide;
  starterAway: StarterSide;
  odds: OddsGameRow;
  lineupHome: LineupSide;
  lineupAway: LineupSide;
  predictedAt: string;
  extraPassReasons: string[];
}): PredictionRow {
  const { game, odds } = input;
  const passReasons: string[] = [...input.extraPassReasons];
  const blockReasons: string[] = [];
  const missingInputs: string[] = [];
  const inputWarnings: string[] = [];
  const hardCutoff = game.clockState === "ALREADY_STARTED" || game.clockState === "FINAL";
  if (game.clockState === "ALREADY_STARTED" || game.clockState === "FINAL") blockReasons.push("ALREADY_STARTED");
  if (game.clockState === "POSTPONED") blockReasons.push("POSTPONED");
  if (game.clockState === "CANCELLED") blockReasons.push("CANCELLED");
  if (odds.status === "ODDS_AFTER_CUTOFF") blockReasons.push("ODDS_AFTER_CUTOFF");
  if (input.starterHome.status === "MISSING" || input.starterHome.status === "SOURCE_UNAVAILABLE") {
    passReasons.push("STARTER_MISSING");
    missingInputs.push("HOME_STARTER");
  }
  if (input.starterAway.status === "MISSING" || input.starterAway.status === "SOURCE_UNAVAILABLE") {
    passReasons.push("STARTER_MISSING");
    missingInputs.push("AWAY_STARTER");
  }
  if (odds.status === "NOT_COLLECTED" || odds.status === "MARKET_NOT_AVAILABLE") {
    passReasons.push(odds.status === "NOT_COLLECTED" ? "ODDS_NOT_COLLECTED" : "MARKET_NOT_AVAILABLE");
    missingInputs.push("ODDS_H2H");
  }
  if (odds.status === "FORMAT_MISMATCH") {
    passReasons.push("FORMAT_MISMATCH");
    missingInputs.push("ODDS_FORMAT");
  }
  if (odds.status === "TEAM_MAPPING_FAILED") passReasons.push("TEAM_MAPPING_FAILED");
  if (odds.status === "PARTIAL") {
    passReasons.push("ODDS_PARTIAL");
    inputWarnings.push("ODDS_PARTIAL");
  }
  if (input.lineupHome.status !== "CONFIRMED" || input.lineupAway.status !== "CONFIRMED") {
    passReasons.push("LINEUP_NOT_CONFIRMED");
    missingInputs.push("LINEUP");
  }
  passReasons.push("ENGINE_PIPELINE_NOT_AVAILABLE");
  missingInputs.push("ENGINE_MIN_INPUT");
  let officialStatus: OfficialStatus = "PASS";
  if (blockReasons.length > 0) officialStatus = "BLOCKED";
  const startMs = game.scheduledStartTime ? Date.parse(game.scheduledStartTime) : NaN;
  const predMs = Date.parse(input.predictedAt);
  const beforeStart = Number.isFinite(startMs) ? predMs < startMs : null;
  const oddsBefore = odds.fetchedAt && Number.isFinite(startMs) ? Date.parse(odds.fetchedAt) < startMs : null;
  const auditDetail: string[] = [];
  let cutoff: "PASS" | "WARN" | "FAIL" = "PASS";
  let leakage: "PASS" | "WARN" | "FAIL" = "PASS";
  let mapping: "PASS" | "WARN" | "FAIL" = "PASS";
  if (officialStatus === "BLOCKED" && blockReasons.includes("ALREADY_STARTED")) {
    cutoff = "FAIL";
    auditDetail.push("HARD_CUTOFF_OR_STARTED");
  } else if (beforeStart === false) {
    cutoff = "FAIL";
    leakage = "FAIL";
    auditDetail.push("PREDICTED_AFTER_START");
  } else if (oddsBefore === false && officialStatus !== "BLOCKED") {
    cutoff = "WARN";
    auditDetail.push("ODDS_FETCH_AFTER_START_WINDOW");
  }
  if (odds.status === "TEAM_MAPPING_FAILED") {
    mapping = "FAIL";
    auditDetail.push("ODDS_TEAM_MAPPING_FAILED");
  }
  if (missingInputs.length > 0) auditDetail.push(`MISSING:${missingInputs.join(",")}`);
  return {
    sport: "baseball",
    league: input.league,
    date: input.date,
    runId: input.runId,
    gameId: game.gameId,
    matchup: `${game.away} @ ${game.home}`,
    home: game.home,
    away: game.away,
    scheduledStartTime: game.scheduledStartTime,
    officialStatus,
    officialPick: null,
    confidence: null,
    modelProbability: null,
    marketProbability: marketProbFromOdds(odds.homeOdds, odds.awayOdds),
    valueEdge: null,
    passReasons: [...new Set(passReasons)],
    blockReasons: [...new Set(blockReasons)],
    missingInputs: [...new Set(missingInputs)],
    inputWarnings,
    predictedAt: input.predictedAt,
    engineVersion: null,
    researchBaseline: null,
    starter: { home: input.starterHome, away: input.starterAway },
    odds,
    lineup: {
      home: input.lineupHome,
      away: input.lineupAway,
      retrySuggested:
        input.lineupHome.status === "NOT_RELEASED" ||
        input.lineupAway.status === "NOT_RELEASED" ||
        input.lineupHome.status === "SOURCE_NOT_SUPPORTED",
    },
    cutoff: {
      hardCutoffPassed: hardCutoff || blockReasons.includes("ALREADY_STARTED"),
      scheduleBeforeStart: beforeStart,
      starterBeforeStart: null,
      oddsBeforeStart: oddsBefore,
      lineupBeforeStart: null,
      predictedBeforeStart: beforeStart !== false,
    },
    audit: { cutoff, leakage, mapping, detail: auditDetail },
  };
}

async function runNpb(dateKst: string) {
  const timing: Timing = {};
  const providerProblems: string[] = [];
  const files: string[] = [];
  const collectedAt = nowIso();
  const runId = runIdFrom(collectedAt);
  const nowMs = Date.now();
  const root = path.join(process.cwd(), "data", "research", "npb");
  const predRoot = path.join(process.cwd(), "data", "predictions", "npb");
  console.log(`\n=== NPB Immediate Pregame ${dateKst} runId=${runId} ===`);

  let t = Date.now();
  const tsdb = await fetchTheSportsDbEvents("4591", dateKst);
  timing.scheduleTheSportsDbMs = tsdb.durationMs;
  if (tsdb.error) providerProblems.push(`NPB TheSportsDB: ${tsdb.error}`);
  const npbLeague = await resolveApiBaseballNpbLeagueId();
  if (!npbLeague.leagueId) providerProblems.push(`NPB API-BASEBALL league resolve: ${npbLeague.error ?? "not found"}`);
  const apiBb = npbLeague.leagueId
    ? await fetchApiBaseballGames(npbLeague.leagueId, Number(dateKst.slice(0, 4)), dateKst)
    : { games: [] as any[], fetchedAt: collectedAt, error: "leagueId unresolved", durationMs: 0, usage: { remaining: null as string | null, limit: null as string | null } };
  timing.scheduleApiBaseballMs = apiBb.durationMs;
  if (apiBb.error) providerProblems.push(`NPB API-BASEBALL games: ${apiBb.error}`);
  if (apiBb.usage.remaining) providerProblems.push(`NPB API-BASEBALL quota remaining=${apiBb.usage.remaining}/${apiBb.usage.limit ?? "?"}`);

  const scheduleGames: ScheduleGame[] = [];
  for (const ev of tsdb.events) {
    const home = String(ev.strHomeTeam ?? "").trim();
    const away = String(ev.strAwayTeam ?? "").trim();
    if (!home || !away) continue;
    let scheduledStartTime: string | null = null;
    if (ev.dateEvent && ev.strTime) {
      const tstr = String(ev.strTime);
      const utc = `${ev.dateEvent}T${tstr.length === 8 ? tstr : `${tstr.slice(0, 5)}:00`}Z`;
      const ms = Date.parse(utc);
      if (Number.isFinite(ms)) scheduledStartTime = new Date(ms).toISOString();
    }
    const kst = scheduledStartTime ? instantToKst(scheduledStartTime) : null;
    if (kst && kst.date !== dateKst) continue;
    if (!kst && String(ev.dateEvent) !== dateKst) continue;
    const clock = classifyClock(scheduledStartTime, ev.strStatus ?? "NS", ev.strProgress ?? null, nowMs);
    scheduleGames.push({
      gameId: buildGameId("NPB", home, away),
      providerGameId: ev.idEvent ? String(ev.idEvent) : null,
      provider: "thesportsdb",
      home,
      away,
      venue: ev.strVenue ? String(ev.strVenue) : null,
      scheduledStartTime,
      statusAbstract: ev.strStatus ? String(ev.strStatus) : "NS",
      statusDetailed: ev.strProgress ? String(ev.strProgress) : null,
      collectedAt: tsdb.fetchedAt,
      source: "THESPORTSDB",
      clockState: clock.clockState,
      minutesToStart: clock.minutesToStart,
    });
  }
  for (const g of apiBb.games) {
    const home = String(g.teams?.home?.name ?? "").trim();
    const away = String(g.teams?.away?.name ?? "").trim();
    if (!home || !away) continue;
    const scheduledStartTime = g.date ? String(g.date) : null;
    const kst = scheduledStartTime ? instantToKst(scheduledStartTime) : null;
    if (kst && kst.date !== dateKst) continue;
    const clock = classifyClock(scheduledStartTime, g.status?.short ?? null, g.status?.long ?? null, nowMs);
    const gameId = buildGameId("NPB", home, away);
    const existing = scheduleGames.find((s) => s.gameId === gameId);
    if (existing) {
      existing.providerGameId = existing.providerGameId ?? (g.id != null ? String(g.id) : null);
      existing.statusAbstract = g.status?.short ?? existing.statusAbstract;
      existing.statusDetailed = g.status?.long ?? existing.statusDetailed;
      existing.venue = g.venue?.name ?? existing.venue;
      existing.clockState = clock.clockState;
      existing.minutesToStart = clock.minutesToStart;
      if (!existing.scheduledStartTime) existing.scheduledStartTime = scheduledStartTime;
      continue;
    }
    scheduleGames.push({
      gameId,
      providerGameId: g.id != null ? String(g.id) : null,
      provider: "api-baseball",
      home,
      away,
      venue: g.venue?.name ?? null,
      scheduledStartTime,
      statusAbstract: g.status?.short ?? null,
      statusDetailed: g.status?.long ?? null,
      collectedAt: apiBb.fetchedAt,
      source: "API_BASEBALL",
      clockState: clock.clockState,
      minutesToStart: clock.minutesToStart,
    });
  }
  timing.scheduleMs = Date.now() - t;

  t = Date.now();
  let oddsEvents: OddsData[] = [];
  let sportKey: string | null = null;
  let oddsFetchedAt = collectedAt;
  let oddsUsage: unknown = null;
  try {
    const provider = getOddsProvider() as any;
    if (typeof provider.resolveBaseballLeagueKeys === "function") {
      const keys = await provider.resolveBaseballLeagueKeys();
      sportKey = keys.npb?.key ?? null;
      oddsUsage = keys.usage;
      if (!sportKey) providerProblems.push("NPB Odds sport key inactive/not found");
    }
    if (sportKey) {
      const result = await provider.getOdds({ sportKey, regions: "eu", markets: "h2h", oddsFormat: "decimal" });
      oddsEvents = result.events ?? [];
      oddsFetchedAt = result.fetchedAt ?? nowIso();
      oddsUsage = result.usage ?? oddsUsage;
    }
  } catch (e) {
    providerProblems.push(`NPB Odds: ${e instanceof Error ? e.message : String(e)}`);
  }
  timing.oddsMs = Date.now() - t;
  const { scheduleExtras, oddsByKey } = mapOddsEventsToRows("NPB", dateKst, oddsEvents, sportKey ?? "baseball_npb", oddsFetchedAt, nowMs);
  const mergedSchedule = mergeSchedule(scheduleGames, scheduleExtras);
  const oddsList = [...oddsByKey.values()];

  t = Date.now();
  const artifactGeneratedAt = nowIso();
  const startersByGame = new Map<string, { home: StarterSide; away: StarterSide }>();
  for (const g of mergedSchedule) {
    startersByGame.set(g.gameId, {
      home: emptyStarter(artifactGeneratedAt, "API_BASEBALL_STARTER_NOT_IN_PAYLOAD"),
      away: emptyStarter(artifactGeneratedAt, "API_BASEBALL_STARTER_NOT_IN_PAYLOAD"),
    });
  }
  timing.starterMs = Date.now() - t;

  t = Date.now();
  const lineupHome = unsupportedLineup("NPB_CONFIRMED_LINEUP_PROVIDER_NOT_WIRED");
  const lineupAway = unsupportedLineup("NPB_CONFIRMED_LINEUP_PROVIDER_NOT_WIRED");
  timing.lineupMs = Date.now() - t;

  t = Date.now();
  const predictedAt = nowIso();
  const predictions: PredictionRow[] = mergedSchedule.map((game) => {
    const st = startersByGame.get(game.gameId)!;
    return buildPredictionRow({
      league: "NPB",
      date: dateKst,
      runId,
      game,
      starterHome: st.home,
      starterAway: st.away,
      odds: matchOdds(game, oddsByKey, oddsList),
      lineupHome: { ...lineupHome, fetchedAt: predictedAt },
      lineupAway: { ...lineupAway, fetchedAt: predictedAt },
      predictedAt,
      extraPassReasons: [],
    });
  });
  timing.predictionMs = Date.now() - t;

  const summary = {
    total: predictions.length,
    ELIGIBLE: predictions.filter((p) => p.officialStatus === "ELIGIBLE").length,
    PASS: predictions.filter((p) => p.officialStatus === "PASS").length,
    BLOCKED: predictions.filter((p) => p.officialStatus === "BLOCKED").length,
    alreadyStarted: predictions.filter((p) => p.blockReasons.includes("ALREADY_STARTED")).length,
    postponedOrCancelled: predictions.filter((p) => p.blockReasons.includes("POSTPONED") || p.blockReasons.includes("CANCELLED")).length,
  };

  const predictionDoc: any = {
    schemaVersion: "npb-prediction-snapshot-v1",
    sport: "baseball",
    league: "NPB",
    date: dateKst,
    runId,
    predictedAt,
    enginePolicy: "NO_OFFICIAL_ENGINE_PICKS_IN_THIS_MISSION",
    summary,
    games: predictions,
    predictionHashSha256: "",
  };
  predictionDoc.predictionHashSha256 = sha256(JSON.stringify({ date: dateKst, runId, games: predictions.map((p) => ({ gameId: p.gameId, officialStatus: p.officialStatus, officialPick: p.officialPick, passReasons: p.passReasons, blockReasons: p.blockReasons, predictedAt: p.predictedAt })) }));

  const summaryDoc = {
    schemaVersion: "npb-pregame-collection-summary-v1",
    sport: "baseball",
    league: "NPB",
    date: dateKst,
    runId,
    generatedAt: nowIso(),
    summary,
    timing: { ...timing, totalMs: Object.values(timing).reduce((a, b) => a + b, 0) },
    providerProblems,
    conclusion: summary.PASS > 0 ? "NPB_PASS_RECORDED" : summary.BLOCKED > 0 ? "NPB_BLOCKED_AFTER_START" : "PARTIAL_COLLECTION",
  };

  const outs: Array<[string, unknown]> = [
    [path.join(root, `${dateKst}-schedule-v1.json`), { schemaVersion: "npb-schedule-v1", sport: "baseball", league: "NPB", date: dateKst, runId, collectedAt, source: "THESPORTSDB+API_BASEBALL+THE_ODDS_API", games: mergedSchedule, providerMeta: { theSportsDb: { fetchedAt: tsdb.fetchedAt, count: tsdb.events.length, error: tsdb.error }, apiBaseball: { leagueId: npbLeague.leagueId, fetchedAt: apiBb.fetchedAt, count: apiBb.games.length, error: apiBb.error, usage: apiBb.usage } } }],
    [path.join(root, `${dateKst}-starter-dataset-v1.json`), { schemaVersion: "npb-starter-v1", sport: "baseball", league: "NPB", date: dateKst, runId, collectedAt: artifactGeneratedAt, games: [...startersByGame.entries()].map(([gameId, v]) => ({ gameId, ...v })) }],
    [path.join(root, `${dateKst}-odds-history-dataset-v1.json`), { schemaVersion: "npb-odds-history-v1", sport: "baseball", league: "NPB", date: dateKst, runId, collectedAt: oddsFetchedAt, sportKey, oddsFormat: "DECIMAL", usage: oddsUsage, games: oddsList }],
    [path.join(root, `${dateKst}-lineup-dataset-v1.json`), { schemaVersion: "npb-lineup-v1", sport: "baseball", league: "NPB", date: dateKst, runId, collectedAt: predictedAt, policy: "NO_ESTIMATED_OR_PRIOR_DAY_LINEUP", games: mergedSchedule.map((g) => ({ gameId: g.gameId, home: lineupHome, away: lineupAway })) }],
    [path.join(root, `${dateKst}-pregame-cutoff-audit-v1.json`), { schemaVersion: "npb-pregame-cutoff-audit-v1", sport: "baseball", league: "NPB", date: dateKst, runId, generatedAt: nowIso(), games: predictions.map((p) => ({ gameId: p.gameId, matchup: p.matchup, scheduledStartTime: p.scheduledStartTime, cutoff: p.cutoff, auditCutoff: p.audit.cutoff })) }],
    [path.join(root, `${dateKst}-pregame-leakage-audit-v1.json`), { schemaVersion: "npb-pregame-leakage-audit-v1", sport: "baseball", league: "NPB", date: dateKst, runId, generatedAt: nowIso(), overall: predictions.some((p) => p.audit.leakage === "FAIL") ? "FAIL" : predictions.some((p) => p.audit.leakage === "WARN") ? "WARN" : "PASS", games: predictions.map((p) => ({ gameId: p.gameId, leakage: p.audit.leakage, mapping: p.audit.mapping, detail: p.audit.detail, usedTargetResult: false, usedLiveStats: false, usedClosingOddsBackfill: false, usedFinalLineupBackfill: false })) }],
    [path.join(root, `${dateKst}-pregame-collection-summary-v1.json`), summaryDoc],
    [path.join(root, `${dateKst}-daily-research-summary-v1.json`), summaryDoc],
    [path.join(predRoot, `${dateKst}.json`), predictionDoc],
  ];
  for (const [fp, doc] of outs) {
    await reviseIfExists(fp, runId);
    await writeJsonAtomic(fp, doc);
    files.push(path.relative(process.cwd(), fp).replace(/\\/g, "/"));
  }
  console.log(JSON.stringify({ summary, timing, providerProblems, files }, null, 2));
  return { runId, timing, summary, files, providerProblems, predictions };
}

async function runKbo(dateKst: string) {
  const timing: Timing = {};
  const providerProblems: string[] = [];
  const files: string[] = [];
  const collectedAt = nowIso();
  const runId = runIdFrom(collectedAt);
  const nowMs = Date.now();
  const root = path.join(process.cwd(), "data", "research", "kbo");
  const predRoot = path.join(process.cwd(), "data", "predictions", "kbo");
  console.log(`\n=== KBO Immediate Pregame ${dateKst} runId=${runId} ===`);

  let t = Date.now();
  let identityDoc: any = null;
  try {
    const result = await collectKboScheduleResultIdentityV1({ dateKst, observedAt: collectedAt });
    identityDoc = result.document;
    const identityPath = getKboIdentityArtifactPath(dateKst, getKboIdentityProvider());
    await reviseIfExists(identityPath, runId);
    await writeJsonAtomic(identityPath, identityDoc);
    files.push(path.relative(process.cwd(), identityPath).replace(/\\/g, "/"));
  } catch (e) {
    providerProblems.push(`KBO identity: ${e instanceof Error ? e.message : String(e)}`);
  }
  timing.scheduleMs = Date.now() - t;

  const rows: any[] = Array.isArray(identityDoc?.rows) ? identityDoc.rows : [];
  const scheduleGames: ScheduleGame[] = rows.map((row) => {
    const home = row.homeTeam?.canonicalNameKo || row.homeTeam?.providerName || row.homeTeam?.canonicalNameEn || "UNKNOWN_HOME";
    const away = row.awayTeam?.canonicalNameKo || row.awayTeam?.providerName || row.awayTeam?.canonicalNameEn || "UNKNOWN_AWAY";
    const scheduledStartTime = row.time?.startTimeKst ?? row.providerStartTime ?? null;
    const statusAbstract = row.gameStatus ?? row.providerStatusRaw ?? null;
    const clock = classifyClock(scheduledStartTime, statusAbstract, row.providerStatusRaw ?? null, nowMs);
    return {
      gameId: row.internalGameId || buildGameId("KBO", home, away),
      providerGameId: row.providerGameId ?? null,
      provider: identityDoc?.meta?.providerId ?? "API_BASEBALL",
      home,
      away,
      venue: row.venueName ?? null,
      scheduledStartTime,
      statusAbstract,
      statusDetailed: row.providerStatusRaw ?? null,
      collectedAt,
      source: "KBO_SCHEDULE_RESULT_IDENTITY",
      clockState: clock.clockState,
      minutesToStart: clock.minutesToStart,
    };
  });

  {
    const fp = path.join(root, `${dateKst}-schedule-v1.json`);
    await reviseIfExists(fp, runId);
    await writeJsonAtomic(fp, { schemaVersion: "kbo-schedule-v1", sport: "baseball", league: "KBO", date: dateKst, runId, collectedAt, source: "API_BASEBALL_IDENTITY", games: scheduleGames });
    files.push(path.relative(process.cwd(), fp).replace(/\\/g, "/"));
  }

  t = Date.now();
  const artifactGeneratedAt = nowIso();
  const starterPath = path.join(process.cwd(), "data/operator-input/kbo", `${dateKst}-starter-confirmation-v1.json`);
  let starterOperator: any = null;
  if (await exists(starterPath)) {
    try {
      starterOperator = JSON.parse(await readFile(starterPath, "utf8"));
    } catch (e) {
      providerProblems.push(`KBO starter operator parse: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    providerProblems.push("KBO starter operator input NOT_ENTERED");
  }
  const startersByGame = new Map<string, { home: StarterSide; away: StarterSide }>();
  for (const g of scheduleGames) {
    const opGame = Array.isArray(starterOperator?.games)
      ? starterOperator.games.find((x: any) => x.internalGameId === g.gameId || x.gameId === g.gameId)
      : null;
    const side = (raw: any): StarterSide => {
      if (!raw?.name && !raw?.pitcherName) {
        return emptyStarter(artifactGeneratedAt, starterOperator ? "STARTER_ROW_MISSING" : "OPERATOR_STARTER_NOT_ENTERED");
      }
      return {
        pitcherId: raw.pitcherId ?? raw.id ?? null,
        name: raw.name ?? raw.pitcherName ?? null,
        throwingHand: raw.hand ?? raw.throwingHand ?? null,
        status: raw.confirmed ? "CONFIRMED" : "PROBABLE_ONLY",
        source: "OPERATOR_INPUT",
        fetchedAt: starterOperator?.generatedAt ?? artifactGeneratedAt,
        statsAsOf: raw.statsAsOf ?? null,
        artifactGeneratedAt,
        missingFeatures: raw.confirmed ? [] : ["CONFIRMED_FLAG"],
      };
    };
    startersByGame.set(g.gameId, { home: side(opGame?.homeStarter ?? opGame?.home), away: side(opGame?.awayStarter ?? opGame?.away) });
  }
  timing.starterMs = Date.now() - t;
  {
    const fp = path.join(root, `${dateKst}-starter-dataset-v1.json`);
    await reviseIfExists(fp, runId);
    await writeJsonAtomic(fp, { schemaVersion: "kbo-starter-v1", sport: "baseball", league: "KBO", date: dateKst, runId, collectedAt: artifactGeneratedAt, operatorInputPresent: Boolean(starterOperator), games: [...startersByGame.entries()].map(([gameId, v]) => ({ gameId, ...v })) });
    files.push(path.relative(process.cwd(), fp).replace(/\\/g, "/"));
  }

  t = Date.now();
  let oddsList: OddsGameRow[] = [];
  let oddsFetchedAt = collectedAt;
  let sportKey: string | null = null;
  try {
    const ovs = createTheOddsApiKboProvider({ cwd: process.cwd() });
    const fetched = await ovs.fetchMoneylineByDate(dateKst);
    oddsFetchedAt = fetched.fetchedAt;
    sportKey = fetched.sportKey ?? null;
    for (const g of fetched.games ?? []) {
      const home = g.homeTeamProviderName;
      const away = g.awayTeamProviderName;
      const gameId = buildGameId("KBO", home, away);
      const homeSel = g.selections.find((s) => s.selectionCode === "HOME");
      const awaySel = g.selections.find((s) => s.selectionCode === "AWAY");
      let status: OddsGameRow["status"] = "COLLECTED";
      const reasons: string[] = [];
      if (!homeSel || !awaySel) {
        status = "PARTIAL";
        reasons.push("H2H_INCOMPLETE");
      }
      if (g.mappingStatus === "UNMATCHED") {
        status = "TEAM_MAPPING_FAILED";
        reasons.push("TEAM_MAPPING_FAILED");
      }
      oddsList.push({
        gameId,
        status,
        reasons,
        providerEventId: g.providerEventId ?? null,
        sportKey,
        oddsFormat: "DECIMAL",
        declaredFormat: "decimal",
        formatValidationStatus: "FORMAT_CONFIRMED_DECIMAL",
        homeOdds: homeSel?.odds ?? null,
        awayOdds: awaySel?.odds ?? null,
        bookmaker: homeSel?.bookmaker ?? awaySel?.bookmaker ?? null,
        marketTimestamp: g.capturedAt ?? oddsFetchedAt,
        fetchedAt: g.capturedAt ?? oddsFetchedAt,
        commenceTime: g.providerStartTime ?? null,
        homeTeam: home,
        awayTeam: away,
      });
    }
    if (!oddsList.length) providerProblems.push("KBO overseas odds: 0 events for date");
  } catch (e) {
    providerProblems.push(`KBO overseas odds: ${e instanceof Error ? e.message : String(e)}`);
  }
  const protoPath = path.join(process.cwd(), "data/operator-input/kbo", `${dateKst}-operator-markets-v2.json`);
  const domesticEntered = await exists(protoPath);
  if (!domesticEntered) providerProblems.push("KBO domestic proto odds NOT_ENTERED → NOT_COLLECTED");
  timing.oddsMs = Date.now() - t;
  const oddsByKey = new Map(oddsList.map((o) => [o.gameId, o]));
  {
    const fp = path.join(root, `${dateKst}-odds-history-dataset-v1.json`);
    await reviseIfExists(fp, runId);
    await writeJsonAtomic(fp, { schemaVersion: "kbo-odds-history-v1", sport: "baseball", league: "KBO", date: dateKst, runId, collectedAt: oddsFetchedAt, sportKey, oddsFormat: "DECIMAL", domesticProtoStatus: domesticEntered ? "ENTERED_FILE_PRESENT" : "NOT_COLLECTED", games: oddsList });
    files.push(path.relative(process.cwd(), fp).replace(/\\/g, "/"));
  }

  t = Date.now();
  const lineupPath = path.join(process.cwd(), "data/operator-input/kbo", `${dateKst}-lineup-confirmation-v1.json`);
  let lineupOperator: any = null;
  if (await exists(lineupPath)) {
    try {
      lineupOperator = JSON.parse(await readFile(lineupPath, "utf8"));
    } catch (e) {
      providerProblems.push(`KBO lineup parse: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    providerProblems.push("KBO lineup operator input NOT_ENTERED");
  }
  const lineupFetchedAt = nowIso();
  const lineupFor = (gameId: string) => {
    const op = Array.isArray(lineupOperator?.games) ? lineupOperator.games.find((x: any) => x.internalGameId === gameId || x.gameId === gameId) : null;
    const side = (raw: any): LineupSide => {
      if (!lineupOperator) {
        return { status: "NOT_RELEASED", confirmed: false, battingOrder: [], source: null, fetchedAt: lineupFetchedAt, confirmedAt: null, reasons: ["OPERATOR_LINEUP_NOT_ENTERED", "RETRY_T45_OR_T30"] };
      }
      if (!raw) {
        return { status: "NOT_RELEASED", confirmed: false, battingOrder: [], source: "OPERATOR_INPUT", fetchedAt: lineupFetchedAt, confirmedAt: null, reasons: ["LINEUP_ROW_MISSING", "RETRY_T45_OR_T30"] };
      }
      const confirmed = Boolean(raw.confirmed);
      const order = Array.isArray(raw.battingOrder) ? raw.battingOrder : [];
      return { status: confirmed ? (order.length >= 9 ? "CONFIRMED" : "PARTIAL") : "NOT_RELEASED", confirmed, battingOrder: order, source: "OPERATOR_INPUT", fetchedAt: lineupFetchedAt, confirmedAt: raw.confirmedAt ?? null, reasons: confirmed ? [] : ["NOT_CONFIRMED"] };
    };
    return { home: side(op?.home ?? op?.homeLineup), away: side(op?.away ?? op?.awayLineup) };
  };
  timing.lineupMs = Date.now() - t;
  {
    const fp = path.join(root, `${dateKst}-lineup-dataset-v1.json`);
    await reviseIfExists(fp, runId);
    await writeJsonAtomic(fp, { schemaVersion: "kbo-lineup-v1", sport: "baseball", league: "KBO", date: dateKst, runId, collectedAt: lineupFetchedAt, retryPolicy: "MAX_1_RECHECK_IF_TIME_REMAINS", games: scheduleGames.map((g) => ({ gameId: g.gameId, ...lineupFor(g.gameId) })) });
    files.push(path.relative(process.cwd(), fp).replace(/\\/g, "/"));
  }

  t = Date.now();
  const predictedAt = nowIso();
  const predictions: PredictionRow[] = scheduleGames.map((game) => {
    const st = startersByGame.get(game.gameId)!;
    const lu = lineupFor(game.gameId);
    let odds = matchOdds(game, oddsByKey, oddsList);
    if (odds.status === "NOT_COLLECTED" && !domesticEntered) {
      odds = { ...odds, reasons: [...odds.reasons, "DOMESTIC_PROTO_NOT_COLLECTED", "OVERSEAS_UNMATCHED_OR_EMPTY"] };
    }
    return buildPredictionRow({
      league: "KBO",
      date: dateKst,
      runId,
      game,
      starterHome: st.home,
      starterAway: st.away,
      odds,
      lineupHome: lu.home,
      lineupAway: lu.away,
      predictedAt,
      extraPassReasons: ["KBO_PREDICTION_PIPELINE_NOT_IMPLEMENTED"],
    });
  });
  timing.predictionMs = Date.now() - t;

  const summary = {
    total: predictions.length,
    ELIGIBLE: predictions.filter((p) => p.officialStatus === "ELIGIBLE").length,
    PASS: predictions.filter((p) => p.officialStatus === "PASS").length,
    BLOCKED: predictions.filter((p) => p.officialStatus === "BLOCKED").length,
    alreadyStarted: predictions.filter((p) => p.blockReasons.includes("ALREADY_STARTED")).length,
    postponedOrCancelled: predictions.filter((p) => p.blockReasons.includes("POSTPONED") || p.blockReasons.includes("CANCELLED")).length,
  };

  const predictionDoc: any = {
    schemaVersion: "kbo-prediction-snapshot-v1",
    sport: "baseball",
    league: "KBO",
    date: dateKst,
    runId,
    predictedAt,
    enginePolicy: "NO_OFFICIAL_ENGINE_PICKS_IN_THIS_MISSION",
    summary,
    games: predictions,
    predictionHashSha256: "",
  };
  predictionDoc.predictionHashSha256 = sha256(JSON.stringify({ date: dateKst, runId, games: predictions.map((p) => ({ gameId: p.gameId, officialStatus: p.officialStatus, officialPick: p.officialPick, passReasons: p.passReasons, blockReasons: p.blockReasons, predictedAt: p.predictedAt })) }));

  const summaryDoc = {
    schemaVersion: "kbo-pregame-collection-summary-v1",
    sport: "baseball",
    league: "KBO",
    date: dateKst,
    runId,
    generatedAt: nowIso(),
    summary,
    timing: { ...timing, totalMs: Object.values(timing).reduce((a, b) => a + b, 0) },
    providerProblems,
    conclusion: summary.PASS > 0 ? "KBO_PASS_RECORDED" : "PARTIAL_COLLECTION",
  };

  for (const [fp, doc] of [
    [path.join(root, `${dateKst}-pregame-cutoff-audit-v1.json`), { schemaVersion: "kbo-pregame-cutoff-audit-v1", sport: "baseball", league: "KBO", date: dateKst, runId, generatedAt: nowIso(), games: predictions.map((p) => ({ gameId: p.gameId, matchup: p.matchup, scheduledStartTime: p.scheduledStartTime, cutoff: p.cutoff, auditCutoff: p.audit.cutoff })) }],
    [path.join(root, `${dateKst}-pregame-leakage-audit-v1.json`), { schemaVersion: "kbo-pregame-leakage-audit-v1", sport: "baseball", league: "KBO", date: dateKst, runId, generatedAt: nowIso(), overall: predictions.some((p) => p.audit.leakage === "FAIL") ? "FAIL" : "PASS", games: predictions.map((p) => ({ gameId: p.gameId, leakage: p.audit.leakage, mapping: p.audit.mapping, detail: p.audit.detail, usedTargetResult: false, usedLiveStats: false, usedClosingOddsBackfill: false, usedFinalLineupBackfill: false })) }],
    [path.join(root, `${dateKst}-pregame-collection-summary-v1.json`), summaryDoc],
    [path.join(root, `${dateKst}-daily-research-summary-v1.json`), summaryDoc],
    [path.join(predRoot, `${dateKst}.json`), predictionDoc],
  ] as Array<[string, unknown]>) {
    await reviseIfExists(fp, runId);
    await writeJsonAtomic(fp, doc);
    files.push(path.relative(process.cwd(), fp).replace(/\\/g, "/"));
  }
  console.log(JSON.stringify({ summary, timing, providerProblems, files }, null, 2));
  return { runId, timing, summary, files, providerProblems, predictions };
}

async function main() {
  console.log(`Immediate Pregame Accumulation mode=${MODE} date=${DATE} utc=${nowIso()}`);
  const results: Record<string, unknown> = {};
  if (MODE === "npb" || MODE === "both") results.npb = await runNpb(DATE);
  if (MODE === "kbo" || MODE === "both") results.kbo = await runKbo(DATE);
  const out = path.join(process.cwd(), "data", "audits", `${DATE}-npb-kbo-immediate-pregame-accumulation-v1.json`);
  await writeJsonAtomic(out, { schemaVersion: "npb-kbo-immediate-pregame-accumulation-v1", dateKst: DATE, generatedAt: nowIso(), results: { npb: results.npb ? { runId: (results.npb as any).runId, summary: (results.npb as any).summary, timing: (results.npb as any).timing, providerProblems: (results.npb as any).providerProblems, files: (results.npb as any).files } : null, kbo: results.kbo ? { runId: (results.kbo as any).runId, summary: (results.kbo as any).summary, timing: (results.kbo as any).timing, providerProblems: (results.kbo as any).providerProblems, files: (results.kbo as any).files } : null } });
  console.log(`\nWrote ${path.relative(process.cwd(), out)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
