/**
 * MLB Bullpen Role Dataset v1 빌드 (연구 전용).
 *
 * - Engine / weights / 예측 / 성공·실패 리뷰 / UI 미수정
 * - cutoff 이전 등판만 사용 · 역할 판정에 대상 경기 결과 미사용
 * - MLB Stats API = 내부 연구 fallback · 원본 응답 미저장
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/build-mlb-bullpen-role-dataset.ts
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../src/lib/datetime/kst";
import {
  buildTeamBullpenRoleSnapshot,
  compareGameBullpenRoles,
  computeUsageThresholds,
} from "../src/lib/mlb/build-bullpen-role-snapshot";
import { classifyBullpenPitcher } from "../src/lib/mlb/classify-bullpen-role";
import type {
  BullpenAppearanceDerived,
  BullpenHypothesis,
  BullpenRole,
  ClassifiedBullpenPitcher,
  GameBullpenRoleCompare,
  RoleRiskFlag,
} from "../src/lib/mlb/bullpen-role-types";

const TARGET_DATE_KST = "2026-07-27";
const STATS_API_BASE = "https://statsapi.mlb.com";
const ROLE_LOOKBACK_DAYS = 30;

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
  pregameAudit: path.join(
    process.cwd(),
    "data",
    "audits",
    `${TARGET_DATE_KST}-mlb-pregame-bullpen-risk.json`,
  ),
  resultsCache: path.join(
    process.cwd(),
    "data",
    "cache",
    "mlb-game-results",
    `${TARGET_DATE_KST}.json`,
  ),
  outDataset: path.join(
    process.cwd(),
    "data",
    "research",
    "mlb",
    `${TARGET_DATE_KST}-bullpen-role-dataset.json`,
  ),
  outHypotheses: path.join(
    process.cwd(),
    "data",
    "research",
    "mlb",
    "bullpen-hypotheses.json",
  ),
};

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
  const m = /^(\d+)(?:\.(\d))?$/.exec(String(ip));
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = m[2] != null ? Number(m[2]) : 0;
  return whole * 3 + Math.min(frac, 2);
}
function addDays(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
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
  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(1, items.length)) },
      () => worker(),
    ),
  );
  return out;
}

async function fetchApiBaseballDate(date: string, usage: Usage): Promise<number> {
  const baseUrl = (
    process.env.BASEBALL_API_BASE_URL ?? "https://v1.baseball.api-sports.io"
  ).replace(/\/$/, "");
  const apiKey = (
    process.env.BASEBALL_API_KEY ?? process.env.FOOTBALL_API_KEY ?? ""
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
  if (rem && Number.isFinite(Number(rem))) usage.apiBaseballRemaining = Number(rem);
  if (!res.ok) throw new Error(`API-BASEBALL ${res.status}`);
  const body = (await res.json()) as { response?: unknown[] };
  return Array.isArray(body.response) ? body.response.length : 0;
}

async function fetchStatsJson(pathQuery: string, usage: Usage): Promise<unknown> {
  usage.statsApiCalls += 1;
  const res = await fetch(`${STATS_API_BASE}${pathQuery}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`StatsAPI ${res.status} ${pathQuery}`);
  return res.json();
}

function parseSchedule(data: unknown): SchedGame[] {
  const root = asRecord(data);
  const dates = Array.isArray(root?.dates) ? root!.dates : [];
  const out: SchedGame[] = [];
  for (const day of dates) {
    const games = Array.isArray(asRecord(day)?.games)
      ? (asRecord(day)!.games as unknown[])
      : [];
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

type EntryCtx = {
  entryInning: number | null;
  entryScoreDiff: number | null;
};

/** playByPlay에서 투수별 첫 등판 이닝·점수차 추출 (파생값만 반환) */
function extractEntriesFromPlayByPlay(
  pbp: Record<string, unknown>,
  homeTeamId: number,
  awayTeamId: number,
): Map<number, EntryCtx> {
  const map = new Map<number, EntryCtx>();
  const allPlays = Array.isArray(pbp.allPlays) ? pbp.allPlays : [];
  let homePitcher: number | null = null;
  let awayPitcher: number | null = null;
  let homeScore = 0;
  let awayScore = 0;

  for (const raw of allPlays) {
    const play = asRecord(raw);
    if (!play) continue;
    const about = asRecord(play.about);
    const result = asRecord(play.result);
    const matchup = asRecord(play.matchup);
    const pitcherId = asNumber(asRecord(matchup?.pitcher)?.id);
    const inning = asNumber(about?.inning);
    const half = asString(about?.halfInning); // top = away pitches, bottom = home pitches
    if (typeof result?.homeScore === "number") homeScore = result.homeScore;
    if (typeof result?.awayScore === "number") awayScore = result.awayScore;
    if (pitcherId == null || inning == null || !half) continue;

    const isHomePitching = half === "bottom";
    const prev: number | null = isHomePitching ? homePitcher : awayPitcher;
    if (prev !== pitcherId) {
      if (!map.has(pitcherId)) {
        const teamIsHome = isHomePitching;
        const diff = teamIsHome
          ? homeScore - awayScore
          : awayScore - homeScore;
        map.set(pitcherId, {
          entryInning: inning,
          entryScoreDiff: diff,
        });
      }
      if (isHomePitching) homePitcher = pitcherId;
      else awayPitcher = pitcherId;
    }
  }
  void homeTeamId;
  void awayTeamId;
  return map;
}

function extractAppearancesFromBox(args: {
  box: Record<string, unknown>;
  sched: SchedGame;
  entries: Map<number, EntryCtx>;
}): BullpenAppearanceDerived[] {
  const { box, sched, entries } = args;
  const teams = asRecord(box.teams);
  const out: BullpenAppearanceDerived[] = [];

  for (const side of ["home", "away"] as const) {
    const sideBox = asRecord(teams?.[side]);
    if (!sideBox) continue;
    const teamId = side === "home" ? sched.homeTeamId : sched.awayTeamId;
    const ids = Array.isArray(sideBox.pitchers)
      ? sideBox.pitchers
          .map((x) => asNumber(x))
          .filter((n): n is number => n != null)
      : [];
    const players = asRecord(sideBox.players) ?? {};
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]!;
      const player = asRecord(players[`ID${id}`]);
      const person = asRecord(player?.person);
      const pitching = asRecord(asRecord(player?.stats)?.pitching) ?? {};
      const ip = asString(pitching.inningsPitched);
      const outs = parseIpToOuts(ip) ?? 0;
      const entry = entries.get(id);
      out.push({
        playerId: id,
        playerName: asString(person?.fullName),
        teamId,
        gamePk: sched.gamePk,
        officialDate: sched.officialDate,
        gameDate: sched.gameDate,
        pitcherSlotIndex: i,
        outs,
        earnedRuns: asNumber(pitching.earnedRuns) ?? 0,
        hits: asNumber(pitching.hits) ?? 0,
        walks: asNumber(pitching.baseOnBalls) ?? 0,
        strikeouts: asNumber(pitching.strikeOuts) ?? 0,
        homeRuns: asNumber(pitching.homeRuns) ?? 0,
        pitches:
          asNumber(pitching.pitchesThrown) ??
          asNumber(pitching.numberOfPitches),
        battersFaced: asNumber(pitching.battersFaced),
        saves: asNumber(pitching.saves) ?? 0,
        holds: asNumber(pitching.holds) ?? 0,
        blownSaves: asNumber(pitching.blownSaves) ?? 0,
        wasLastPitcher: i === ids.length - 1,
        entryInning: entry?.entryInning ?? null,
        entryScoreDiff: entry?.entryScoreDiff ?? null,
        fromTargetGame: false,
      });
    }
  }
  return out;
}

const INITIAL_HYPOTHESES: Omit<
  BullpenHypothesis,
  | "sampleCount"
  | "supportingCount"
  | "contradictingCount"
  | "inconclusiveCount"
  | "currentStatus"
  | "lastEvaluatedAt"
>[] = [
  {
    hypothesisId: "H-BP-001",
    description:
      "CLOSER_BACK_TO_BACK은 late-game collapse 위험과 관련 있다",
    requiredFields: ["CLOSER_BACK_TO_BACK", "actualCollapse"],
    minimumSampleTarget: 100,
    autoApply: false,
  },
  {
    hypothesisId: "H-BP-002",
    description:
      "SETUP_CORE_HEAVY_USAGE는 7~8회 실점 증가와 관련 있다",
    requiredFields: ["SETUP_CORE_HEAVY_USAGE", "bullpenVerdict"],
    minimumSampleTarget: 100,
    autoApply: false,
  },
  {
    hypothesisId: "H-BP-003",
    description:
      "MULTIPLE_KEY_RELIEVERS_USED_PREVIOUS_DAY는 추천 팀 승률을 낮춘다",
    requiredFields: [
      "MULTIPLE_KEY_RELIEVERS_USED_PREVIOUS_DAY",
      "outcome",
    ],
    minimumSampleTarget: 100,
    autoApply: false,
  },
  {
    hypothesisId: "H-BP-004",
    description:
      "HIGH_LEVERAGE_GROUP_FATIGUED는 접전 패배와 관련 있다",
    requiredFields: ["HIGH_LEVERAGE_GROUP_FATIGUED", "outcome"],
    minimumSampleTarget: 100,
    autoApply: false,
  },
  {
    hypothesisId: "H-BP-005",
    description:
      "핵심 불펜 2일 이상 휴식은 리드 보호 성공과 관련 있다",
    requiredFields: ["keyBullpenRestDays", "actualProtected"],
    minimumSampleTarget: 100,
    autoApply: false,
  },
  {
    hypothesisId: "H-BP-006",
    description:
      "MIDDLE_RELIEF_THIN은 선발 조기 강판 경기에서 위험하다",
    requiredFields: ["MIDDLE_RELIEF_THIN", "starterEarlyExit"],
    minimumSampleTarget: 200,
    autoApply: false,
    notes: ["역할 표본 부족 시 minimumSampleTarget=200 권장"],
  },
];

function evaluateHypotheses(
  games: GameBullpenRoleCompare[],
  evaluatedAt: string,
): BullpenHypothesis[] {
  return INITIAL_HYPOTHESES.map((h) => {
    let supporting = 0;
    let contradicting = 0;
    let inconclusive = 0;

    for (const g of games) {
      const post = g.postGame;
      if (!post) {
        inconclusive += 1;
        continue;
      }
      const flags = g.pick.roleFlags;

      if (h.hypothesisId === "H-BP-001") {
        const signal = flags.includes("CLOSER_BACK_TO_BACK");
        if (!signal) {
          inconclusive += 1;
          continue;
        }
        if (post.actualCollapse) supporting += 1;
        else if (post.actualProtected) contradicting += 1;
        else inconclusive += 1;
      } else if (h.hypothesisId === "H-BP-002") {
        const signal = flags.includes("SETUP_CORE_HEAVY_USAGE");
        if (!signal) {
          inconclusive += 1;
          continue;
        }
        if (post.actualCollapse) supporting += 1;
        else if (post.outcome === "HIT") contradicting += 1;
        else inconclusive += 1;
      } else if (h.hypothesisId === "H-BP-003") {
        const signal = flags.includes(
          "MULTIPLE_KEY_RELIEVERS_USED_PREVIOUS_DAY",
        );
        if (!signal) {
          inconclusive += 1;
          continue;
        }
        if (post.outcome === "MISS") supporting += 1;
        else contradicting += 1;
      } else if (h.hypothesisId === "H-BP-004") {
        const signal = flags.includes("HIGH_LEVERAGE_GROUP_FATIGUED");
        if (!signal) {
          inconclusive += 1;
          continue;
        }
        if (post.outcome === "MISS") supporting += 1;
        else contradicting += 1;
      } else if (h.hypothesisId === "H-BP-005") {
        const closerRest =
          g.pick.closerCandidate?.fatigue.restDaysBeforeGame ?? null;
        const setupRests = g.pick.setupCandidates
          .map((p) => p.fatigue.restDaysBeforeGame)
          .filter((n): n is number => n != null);
        const avgSetup =
          setupRests.length > 0
            ? setupRests.reduce((s, n) => s + n, 0) / setupRests.length
            : null;
        const rested =
          (closerRest != null && closerRest >= 2) ||
          (avgSetup != null && avgSetup >= 2);
        if (!rested) {
          inconclusive += 1;
          continue;
        }
        if (post.actualProtected) supporting += 1;
        else if (post.actualCollapse) contradicting += 1;
        else inconclusive += 1;
      } else if (h.hypothesisId === "H-BP-006") {
        // 선발 조기 강판 여부는 본 데이터셋에 없음 → inconclusive
        inconclusive += 1;
      } else {
        inconclusive += 1;
      }
    }

    const sampleCount = supporting + contradicting + inconclusive;
    // 14경기로 PROMISING 확정 금지
    const currentStatus: BullpenHypothesis["currentStatus"] =
      sampleCount === 0 ? "UNTESTED" : "COLLECTING";

    return {
      ...h,
      sampleCount,
      supportingCount: supporting,
      contradictingCount: contradicting,
      inconclusiveCount: inconclusive,
      currentStatus,
      lastEvaluatedAt: evaluatedAt,
    };
  });
}

async function main() {
  console.log(`=== Build MLB Bullpen Role Dataset (${TARGET_DATE_KST}) ===`);

  const predictionRaw = await readFile(PATHS.prediction, "utf8");
  const successRaw = await readFile(PATHS.success, "utf8");
  const failureRaw = await readFile(PATHS.failure, "utf8");
  const predHash = sha256(predictionRaw);
  const successHash = sha256(successRaw);
  const failureHash = sha256(failureRaw);

  let pregameAudit: Record<string, unknown> | null = null;
  try {
    pregameAudit = JSON.parse(await readFile(PATHS.pregameAudit, "utf8"));
  } catch {
    pregameAudit = null;
  }

  const prediction = JSON.parse(predictionRaw) as {
    predictions?: Record<string, unknown>[];
  };
  const successDoc = JSON.parse(successRaw) as {
    games?: Record<string, unknown>[];
  };
  const failureDoc = JSON.parse(failureRaw) as {
    games?: Record<string, unknown>[];
  };

  const predById = new Map(
    (prediction.predictions ?? []).map((p) => [
      asString(p.gameId) ?? "",
      p,
    ]),
  );

  const targets = [
    ...(successDoc.games ?? []).map((g) => ({
      gameId: asString(g.gameId)!,
      match: asString(g.match)!,
      outcome: "HIT" as const,
      baselinePick: asString(g.baselinePick)!,
      pickSide: (asString(g.pickSide) as "home" | "away") ?? "home",
      gamePk: asNumber(asRecord(g.sources)?.gamePk),
      bullpenVerdict: asString(asRecord(g.bullpen)?.verdict),
    })),
    ...(failureDoc.games ?? []).map((g) => ({
      gameId: asString(g.gameId)!,
      match: asString(g.match)!,
      outcome: "MISS" as const,
      baselinePick: asString(g.baselinePick)!,
      pickSide: (asString(g.pickSide) as "home" | "away") ?? "home",
      gamePk: asNumber(asRecord(g.sources)?.gamePk),
      bullpenVerdict: asString(asRecord(g.bullpen)?.verdict),
    })),
  ].sort((a, b) => a.gameId.localeCompare(b.gameId));

  if (targets.length !== 14) {
    throw new Error(`대상 ${targets.length} (기대 14)`);
  }

  const usage: Usage = {
    apiBaseballCalls: 0,
    apiBaseballRemaining: null,
    statsApiCalls: 0,
  };

  let apiBaseballCached = false;
  try {
    const cache = JSON.parse(await readFile(PATHS.resultsCache, "utf8"));
    apiBaseballCached = Array.isArray(asRecord(cache)?.results);
  } catch {
    apiBaseballCached = false;
  }
  if (!apiBaseballCached) {
    await fetchApiBaseballDate(TARGET_DATE_KST, usage);
  } else {
    // 캐시 사용 — commercial source used
    usage.apiBaseballCalls = 0;
  }

  const scheduleStart = addDays(TARGET_DATE_KST, -(ROLE_LOOKBACK_DAYS + 2));
  const scheduleData = await fetchStatsJson(
    `/api/v1/schedule?sportId=1&startDate=${scheduleStart}&endDate=${TARGET_DATE_KST}`,
    usage,
  );
  const allSched = parseSchedule(scheduleData);

  const resolved = targets.map((t) => {
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
    if (!sched) throw new Error(`스케줄 실패 ${t.gameId}`);
    return {
      ...t,
      sched,
      homeName: homeTeam ?? sched.homeTeam,
      awayName: awayTeam ?? sched.awayTeam,
    };
  });

  const neededTeams = new Set<number>();
  for (const r of resolved) {
    neededTeams.add(r.sched.homeTeamId);
    neededTeams.add(r.sched.awayTeamId);
  }

  const minOfficial = addDays(
    [...resolved].map((r) => r.sched.officialDate).sort()[0]!,
    -ROLE_LOOKBACK_DAYS,
  );
  const maxOfficial = addDays(
    [...resolved].map((r) => r.sched.officialDate).sort().at(-1)!,
    -1,
  );

  const priorSched = allSched.filter(
    (s) =>
      s.status === "Final" &&
      s.officialDate >= minOfficial &&
      s.officialDate <= maxOfficial &&
      (neededTeams.has(s.homeTeamId) || neededTeams.has(s.awayTeamId)),
  );

  console.log(`사전 경기(box+pbp): ${priorSched.length}`);

  const boxByPk = new Map<number, Record<string, unknown>>();
  const entryByPk = new Map<number, Map<number, EntryCtx>>();
  let pbpOk = 0;
  let pbpFail = 0;

  await mapPool(priorSched, 5, async (s) => {
    try {
      const box = asRecord(
        await fetchStatsJson(`/api/v1/game/${s.gamePk}/boxscore`, usage),
      );
      if (box) boxByPk.set(s.gamePk, box);
    } catch {
      /* skip */
    }
    try {
      const pbp = asRecord(
        await fetchStatsJson(`/api/v1/game/${s.gamePk}/playByPlay`, usage),
      );
      if (pbp) {
        entryByPk.set(
          s.gamePk,
          extractEntriesFromPlayByPlay(pbp, s.homeTeamId, s.awayTeamId),
        );
        pbpOk += 1;
      }
    } catch {
      pbpFail += 1;
    }
    return null;
  });

  // 모든 파생 등판 (대상 경기 제외 — priorSched에 대상일 Final도 있을 수 있어 cutoff로 재필터)
  const targetPks = new Set(resolved.map((r) => r.sched.gamePk));
  const allDerived: BullpenAppearanceDerived[] = [];
  for (const s of priorSched) {
    if (targetPks.has(s.gamePk)) continue;
    const box = boxByPk.get(s.gamePk);
    if (!box) continue;
    const entries = entryByPk.get(s.gamePk) ?? new Map();
    allDerived.push(
      ...extractAppearancesFromBox({ box, sched: s, entries }),
    );
  }

  // 누수 검사
  let leakageTargetGame = 0;
  let leakageAfterCutoff = 0;
  for (const r of resolved) {
    const cutoffMs = Date.parse(r.sched.gameDate);
    for (const a of allDerived) {
      if (a.gamePk === r.sched.gamePk) leakageTargetGame += 1;
      if (
        (a.teamId === r.sched.homeTeamId || a.teamId === r.sched.awayTeamId) &&
        Date.parse(a.gameDate) >= cutoffMs
      ) {
        leakageAfterCutoff += 1;
      }
    }
  }
  if (leakageTargetGame > 0 || leakageAfterCutoff > 0) {
    throw new Error(
      `누수 감지 target=${leakageTargetGame} afterCutoff=${leakageAfterCutoff}`,
    );
  }

  const gameCompares: GameBullpenRoleCompare[] = [];
  const allClassified: ClassifiedBullpenPitcher[] = [];
  const classifiedKeys = new Set<string>();

  // 1차: 경기별 분류 (thresholds는 전 표본 후 재적용을 위해 2-pass)
  type Pending = {
    r: (typeof resolved)[0];
    homePitchers: ClassifiedBullpenPitcher[];
    awayPitchers: ClassifiedBullpenPitcher[];
  };
  const pending: Pending[] = [];

  for (const r of resolved) {
    const cutoffMs = Date.parse(r.sched.gameDate);
    const earliest = addDays(r.sched.officialDate, -ROLE_LOOKBACK_DAYS);

    const forTeam = (teamId: number, teamName: string) => {
      const apps = allDerived.filter(
        (a) =>
          a.teamId === teamId &&
          a.officialDate >= earliest &&
          a.officialDate <= addDays(r.sched.officialDate, -1) &&
          Date.parse(a.gameDate) < cutoffMs,
      );
      // 구원 + opener(slot0 short) — 순수 선발 장이는 역할 표본에서
      // opener 탐지를 위해 slot0도 포함하되, 긴 선발은 LONG/UNKNOWN 쪽으로 흘러감
      const byPlayer = new Map<number, BullpenAppearanceDerived[]>();
      for (const a of apps) {
        const list = byPlayer.get(a.playerId) ?? [];
        list.push(a);
        byPlayer.set(a.playerId, list);
      }
      const pitchers: ClassifiedBullpenPitcher[] = [];
      for (const [playerId, list] of [...byPlayer.entries()].sort(
        (a, b) => a[0] - b[0],
      )) {
        // 전원 선발 장시간만이면 불펜 데이터셋에서 제외 (평균 outs>=15 & slot0 only)
        const onlyLongStarts =
          list.every((a) => a.pitcherSlotIndex === 0) &&
          list.reduce((s, a) => s + a.outs, 0) / list.length >= 15;
        if (onlyLongStarts) continue;

        const classified = classifyBullpenPitcher({
          playerId,
          playerName: list[0]?.playerName ?? null,
          teamId,
          teamName,
          cutoffTime: r.sched.gameDate,
          officialDate: r.sched.officialDate,
          appearances: list,
        });
        pitchers.push(classified);
        const key = `${r.gameId}:${playerId}`;
        if (!classifiedKeys.has(key)) {
          classifiedKeys.add(key);
          allClassified.push(classified);
        }
      }
      return pitchers.sort((a, b) => a.playerId - b.playerId);
    };

    pending.push({
      r,
      homePitchers: forTeam(r.sched.homeTeamId, r.homeName),
      awayPitchers: forTeam(r.sched.awayTeamId, r.awayName),
    });
  }

  const thresholds = computeUsageThresholds(allClassified);

  for (const p of pending) {
    const homeSnap = buildTeamBullpenRoleSnapshot({
      teamId: p.r.sched.homeTeamId,
      teamName: p.r.homeName,
      cutoffTime: p.r.sched.gameDate,
      pitchers: p.homePitchers,
      thresholds,
    });
    const awaySnap = buildTeamBullpenRoleSnapshot({
      teamId: p.r.sched.awayTeamId,
      teamName: p.r.awayName,
      cutoffTime: p.r.sched.gameDate,
      pitchers: p.awayPitchers,
      thresholds,
    });
    const pick = p.r.pickSide === "home" ? homeSnap : awaySnap;
    const opp = p.r.pickSide === "home" ? awaySnap : homeSnap;
    const compare = compareGameBullpenRoles({
      gameId: p.r.gameId,
      match: p.r.match,
      baselinePick: p.r.baselinePick,
      pickSide: p.r.pickSide,
      cutoffTime: p.r.sched.gameDate,
      pick,
      opp,
    });
    const actualProtected =
      p.r.outcome === "HIT" &&
      (p.r.bullpenVerdict === "BULLPEN_PROTECTED_LEAD" ||
        p.r.bullpenVerdict === "BULLPEN_CREATED_WIN");
    const actualCollapse =
      p.r.outcome === "MISS" &&
      (p.r.bullpenVerdict === "BULLPEN_COLLAPSE" ||
        p.r.bullpenVerdict === "BULLPEN_DISADVANTAGE");

    gameCompares.push({
      ...compare,
      postGame: {
        outcome: p.r.outcome,
        bullpenVerdict: p.r.bullpenVerdict,
        actualProtected,
        actualCollapse,
      },
    });
  }

  const evaluatedAt = new Date().toISOString();
  const hypotheses = evaluateHypotheses(gameCompares, evaluatedAt);

  // 집계
  const roleCounts: Record<BullpenRole, number> = {
    CLOSER: 0,
    SETUP: 0,
    HIGH_LEVERAGE_RELIEF: 0,
    MIDDLE_RELIEF: 0,
    LONG_RELIEF: 0,
    OPENER: 0,
    MOP_UP: 0,
    UNKNOWN: 0,
  };
  const confCounts = { high: 0, medium: 0, low: 0 };
  for (const p of allClassified) {
    roleCounts[p.inferredRole] += 1;
    confCounts[p.confidence] += 1;
  }

  const overallCounts = {
    ROLE_STRUCTURE_SUPPORTS_BASELINE: 0,
    ROLE_STRUCTURE_CONFLICTS_BASELINE: 0,
    ROLE_STRUCTURE_NEUTRAL: 0,
    ROLE_STRUCTURE_INSUFFICIENT: 0,
  };
  for (const g of gameCompares) {
    overallCounts[g.overallRoleComparison] += 1;
  }

  const keyFatigueFlags: RoleRiskFlag[] = [
    "CLOSER_USED_PREVIOUS_DAY",
    "CLOSER_BACK_TO_BACK",
    "CLOSER_THIRD_DAY_RISK",
    "SETUP_CORE_HEAVY_USAGE",
    "SETUP_CORE_BACK_TO_BACK",
    "HIGH_LEVERAGE_GROUP_FATIGUED",
    "MULTIPLE_KEY_RELIEVERS_USED_PREVIOUS_DAY",
  ];
  function keyFatigueCount(team: { roleFlags: RoleRiskFlag[] }): number {
    return team.roleFlags.filter((f) => keyFatigueFlags.includes(f)).length;
  }

  const failCollapse = gameCompares.filter((g) => g.postGame?.actualCollapse);
  const successProtected = gameCompares.filter(
    (g) => g.postGame?.actualProtected,
  );
  const failWarned = failCollapse.filter((g) =>
    g.pick.roleFlags.some((f) => keyFatigueFlags.includes(f)),
  );
  const successStable = successProtected.filter(
    (g) =>
      g.overallRoleComparison === "ROLE_STRUCTURE_SUPPORTS_BASELINE" ||
      (keyFatigueCount(g.pick) < keyFatigueCount(g.opp) &&
        keyFatigueCount(g.pick) === 0),
  );

  const pregameSimpleWarned =
    asNumber(
      asRecord(asRecord(pregameAudit)?.summary)?.failCollapsePregameWarned,
    ) ?? null;
  const pregameSimpleStable =
    asNumber(
      asRecord(asRecord(pregameAudit)?.summary)?.successProtectedPregameStable,
    ) ?? null;

  const roleWarned = failWarned.length;
  const roleStable = successStable.length;
  const improvedVsSimple =
    pregameSimpleWarned != null && pregameSimpleStable != null
      ? roleWarned + roleStable > pregameSimpleWarned + pregameSimpleStable
        ? "IMPROVED_ON_THIS_SAMPLE"
        : roleWarned + roleStable < pregameSimpleWarned + pregameSimpleStable
          ? "WORSE_ON_THIS_SAMPLE"
          : "NO_CLEAR_IMPROVEMENT"
      : "NO_BASELINE_AUDIT";

  // 핵심 질문
  const closerSetupHlOnFail = failCollapse.filter((g) =>
    g.pick.roleFlags.some((f) =>
      [
        "CLOSER_USED_PREVIOUS_DAY",
        "CLOSER_BACK_TO_BACK",
        "CLOSER_THIRD_DAY_RISK",
        "SETUP_CORE_HEAVY_USAGE",
        "SETUP_CORE_BACK_TO_BACK",
        "HIGH_LEVERAGE_GROUP_FATIGUED",
      ].includes(f),
    ),
  ).length;

  const middleFlagsOnFail = failCollapse.filter((g) =>
    g.pick.roleFlags.includes("MIDDLE_RELIEF_THIN"),
  ).length;
  const closerFlagsOnFail = failCollapse.filter((g) =>
    g.pick.roleFlags.some((f) => f.startsWith("CLOSER_")),
  ).length;

  const rest0UsedOnFail = failCollapse.filter((g) => {
    const keys = [
      ...(g.pick.closerCandidate ? [g.pick.closerCandidate] : []),
      ...g.pick.setupCandidates,
      ...g.pick.highLeverageCandidates,
    ];
    return keys.some((p) => p.fatigue.usedPreviousDay);
  }).length;

  const questions = {
    failBullpenKeyFatiguePregame: {
      question:
        "실패 불펜 영향 6경기 중 closer/setup/high leverage 피로가 경기 전에 보였는가?",
      value: closerSetupHlOnFail,
      total: failCollapse.length,
    },
    successProtectedKeyMoreStable: {
      question:
        "성공 불펜 보호 5경기 중 핵심 불펜이 상대보다 안정적이었는가?",
      value: successStable.length,
      total: successProtected.length,
    },
    middleVsCloserLinkage: {
      question:
        "중간계투 피로와 마무리 피로 중 어느 쪽이 더 자주 연결됐는가?",
      middleOnFail: middleFlagsOnFail,
      closerOnFail: closerFlagsOnFail,
      answer:
        closerFlagsOnFail > middleFlagsOnFail
          ? "CLOSER_MORE_FREQUENT"
          : middleFlagsOnFail > closerFlagsOnFail
            ? "MIDDLE_MORE_FREQUENT"
            : "SIMILAR_OR_SPARSE",
    },
    rest0or1VsCollapse: {
      question: "휴식 0일/1일 등판이 실제 붕괴와 연관됐는가?",
      failCollapseWithKeyUsedPrevDay: rest0UsedOnFail,
      total: failCollapse.length,
      answer: "ASSOCIATION_ONLY_NOT_CAUSAL",
    },
    rest3plusStability: {
      question: "3일 이상 휴식 후 등판 성과가 더 안정적이었는가?",
      note: "투수별 restBuckets에 저장. 14경기 표본만으로는 미검증",
      answer: "INSUFFICIENT_SAMPLE",
    },
    roleVsSimpleModel: {
      question:
        "역할 구분이 기존 단순 팀 불펜 지표보다 설명력을 높였는가?",
      simpleWarned: pregameSimpleWarned,
      simpleStable: pregameSimpleStable,
      roleWarned,
      roleStable,
      answer: improvedVsSimple,
    },
  };

  const scoredH = hypotheses.map((h) => ({
    ...h,
    net: h.supportingCount - h.contradictingCount,
  }));
  const promising = [...scoredH]
    .filter((h) => h.supportingCount + h.contradictingCount > 0)
    .sort(
      (a, b) =>
        b.net - a.net ||
        b.supportingCount - a.supportingCount ||
        a.hypothesisId.localeCompare(b.hypothesisId),
    )[0];
  const weakest = [...scoredH]
    .filter((h) => h.supportingCount + h.contradictingCount > 0)
    .sort(
      (a, b) =>
        a.net - b.net ||
        b.contradictingCount - a.contradictingCount ||
        a.hypothesisId.localeCompare(b.hypothesisId),
    )[0];
  const promisingFallback = promising ?? scoredH[0];
  const weakestFallback =
    weakest && weakest.hypothesisId !== promisingFallback?.hypothesisId
      ? weakest
      : [...scoredH]
          .filter((h) => h.hypothesisId !== promisingFallback?.hypothesisId)
          .sort(
            (a, b) =>
              b.inconclusiveCount - a.inconclusiveCount ||
              a.hypothesisId.localeCompare(b.hypothesisId),
          )[0] ?? weakest;

  const dataGaps = [
    pbpFail > 0
      ? `playByPlay 실패 ${pbpFail}경기 — 일부 ENTRY_INNING_SCORE 공백`
      : null,
    "공식 closer/setup roster 필드 없음 → inferredRole만 사용",
    "부상·말소 미확인 → availabilityUnknown=true 고정",
    "선발 조기 강판 메타 없음 → H-BP-006 전원 inconclusive",
    allClassified.filter((p) => p.confidence === "low").length >
    allClassified.length / 2
      ? "low confidence 과다"
      : null,
  ].filter(Boolean);

  // hash 재확인
  const predAfter = sha256(await readFile(PATHS.prediction, "utf8"));
  const successAfter = sha256(await readFile(PATHS.success, "utf8"));
  const failureAfter = sha256(await readFile(PATHS.failure, "utf8"));
  if (
    predAfter !== predHash ||
    successAfter !== successHash ||
    failureAfter !== failureHash
  ) {
    throw new Error("입력 파일 변경 감지");
  }

  const dataset = {
    meta: {
      version: "mlb-bullpen-role-dataset-v1",
      dateKst: TARGET_DATE_KST,
      generatedAt: evaluatedAt,
      researchOnly: true,
      engineConnected: false,
      engineUseAllowed: false,
      weightsModified: false,
      uiExposureAllowed: false,
      predictionHashSha256: predHash,
      successReviewHashSha256: successHash,
      failureReviewHashSha256: failureHash,
      predictionUnchanged: true,
      successReviewUnchanged: true,
      failureReviewUnchanged: true,
      leakage: {
        targetGameAppearancesInRoleInput: 0,
        postCutoffAppearancesInRoleInput: 0,
        outcomeUsedInRoleClassification: false,
      },
      legal: {
        apiBaseballCommercialSourceUsed: true,
        mlbStatsInternalResearchFallbackUsed: true,
        mlbStatsCommercialUseUnverified: true,
        publicRuntimeUseAllowed: false,
        rawResponseStored: false,
        mlbComHtmlCrawling: false,
        sportsDataIoScrambled: false,
      },
      note: "연구용 snapshot. 역할은 추정(inferred). low confidence는 Engine 사용 금지. 14경기로 가설 PROMISING 확정 금지.",
    },
    apiUsage: {
      apiBaseball: {
        calls: usage.apiBaseballCalls,
        remaining: usage.apiBaseballRemaining,
        resultsCacheUsed: apiBaseballCached,
      },
      mlbStatsApi: {
        calls: usage.statsApiCalls,
        boxscores: boxByPk.size,
        playByPlayOk: pbpOk,
        playByPlayFail: pbpFail,
      },
    },
    thresholds,
    summary: {
      classifiedPitcherRows: allClassified.length,
      uniquePlayerIds: new Set(allClassified.map((p) => p.playerId)).size,
      roleCounts,
      confidenceCounts: confCounts,
      overallRoleComparison: overallCounts,
      failCollapsePregameKeyWarning: roleWarned,
      failCollapseTotal: failCollapse.length,
      successProtectedPregameStable: roleStable,
      successProtectedTotal: successProtected.length,
      vsSimpleBullpenAudit: improvedVsSimple,
      mostPromisingHypothesis: promisingFallback?.hypothesisId ?? null,
      weakestHypothesis: weakestFallback?.hypothesisId ?? null,
      dataGaps,
      engineUseAllowed: false,
    },
    questions,
    games: gameCompares,
    pitchers: allClassified,
  };

  const hypothesesDoc = {
    meta: {
      version: "mlb-bullpen-hypotheses-v1",
      updatedAt: evaluatedAt,
      autoApply: false,
      engineConnected: false,
      note: "14경기 초기 평가만. PROMISING 확정 금지. autoApply=false 고정.",
    },
    hypotheses,
  };

  await mkdir(path.dirname(PATHS.outDataset), { recursive: true });
  await writeFile(
    PATHS.outDataset,
    `${JSON.stringify(dataset, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    PATHS.outHypotheses,
    `${JSON.stringify(hypothesesDoc, null, 2)}\n`,
    "utf8",
  );

  console.log(`분류 투수 rows: ${allClassified.length}`);
  console.log(`역할: ${JSON.stringify(roleCounts)}`);
  console.log(`confidence: ${JSON.stringify(confCounts)}`);
  console.log(`overall: ${JSON.stringify(overallCounts)}`);
  console.log(`실패 경고 ${roleWarned}/${failCollapse.length}`);
  console.log(`성공 안정 ${roleStable}/${successProtected.length}`);
  console.log(`vs simple: ${improvedVsSimple}`);
  console.log(`유망 가설: ${promisingFallback?.hypothesisId}`);
  console.log(`약한 가설: ${weakestFallback?.hypothesisId}`);
  console.log(`Engine 연결: false`);
  console.log(`예측 불변: ${predHash.slice(0, 12)}…`);
  console.log(
    `API-BASEBALL calls=${usage.apiBaseballCalls} StatsAPI=${usage.statsApiCalls}`,
  );
  console.log(`저장: ${PATHS.outDataset}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
