/**
 * MLB Bullpen Role Dataset v1.1 빌드 (연구 전용).
 *
 * - Engine / weights / prediction / 성공·실패 리뷰 미수정
 * - raw/derived disk cache · INTERNAL_RESEARCH_ONLY
 * - 동일 입력 재실행 시 네트워크 0 + result hash 동일
 *
 * 실행:
 *   npx tsx --env-file=.env.local scripts/build-mlb-bullpen-role-dataset-v1_1.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { instantToKst } from "../src/lib/datetime/kst";
import {
  BULLPEN_CLASSIFIER_VERSION,
  BULLPEN_SCHEMA_VERSION,
  MLB_STATS_SOURCE_LABEL,
} from "../src/lib/mlb/bullpen-role-constants";
import {
  buildTeamBullpenRoleSnapshot,
  compareGameBullpenRoles,
  computeUsageThresholds,
} from "../src/lib/mlb/build-bullpen-role-snapshot";
import { classifyBullpenPitcher } from "../src/lib/mlb/classify-bullpen-role";
import type {
  BullpenAppearanceDerived,
  BullpenRole,
  ClassifiedBullpenPitcher,
  GameBullpenRoleCompare,
  RoleRiskFlag,
} from "../src/lib/mlb/bullpen-role-types";
import {
  createCacheUsage,
  extractScheduleGames,
  getRawStatsJson,
  hashInput,
  hashResult,
  readDerivedJson,
  writeDerivedJson,
} from "../src/lib/mlb/research-stats-cache";

const TARGET_DATE_KST =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-27";
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
  outDataset: path.join(
    process.cwd(),
    "data",
    "research",
    "mlb",
    `${TARGET_DATE_KST}-bullpen-role-dataset-v1_1.json`,
  ),
  outAudit: path.join(
    process.cwd(),
    "data",
    "audits",
    `${TARGET_DATE_KST}-bullpen-role-v1_1-audit.json`,
  ),
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
  return Number(m[1]) * 3 + Math.min(m[2] != null ? Number(m[2]) : 0, 2);
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

type EntryCtx = { entryInning: number | null; entryScoreDiff: number | null };

function extractEntries(
  pbp: Record<string, unknown>,
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
    const half = asString(about?.halfInning);
    if (typeof result?.homeScore === "number") homeScore = result.homeScore;
    if (typeof result?.awayScore === "number") awayScore = result.awayScore;
    if (pitcherId == null || inning == null || !half) continue;
    const isHomePitching = half === "bottom";
    const prev: number | null = isHomePitching ? homePitcher : awayPitcher;
    if (prev !== pitcherId) {
      if (!map.has(pitcherId)) {
        map.set(pitcherId, {
          entryInning: inning,
          entryScoreDiff: isHomePitching
            ? homeScore - awayScore
            : awayScore - homeScore,
        });
      }
      if (isHomePitching) homePitcher = pitcherId;
      else awayPitcher = pitcherId;
    }
  }
  return map;
}

function extractAppearances(args: {
  box: Record<string, unknown>;
  gamePk: number;
  gameDate: string;
  officialDate: string;
  homeTeamId: number;
  awayTeamId: number;
  entries: Map<number, EntryCtx>;
}): BullpenAppearanceDerived[] {
  const teams = asRecord(args.box.teams);
  const out: BullpenAppearanceDerived[] = [];
  for (const side of ["home", "away"] as const) {
    const sideBox = asRecord(teams?.[side]);
    if (!sideBox) continue;
    const teamId = side === "home" ? args.homeTeamId : args.awayTeamId;
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
      const entry = args.entries.get(id);
      out.push({
        playerId: id,
        playerName: asString(person?.fullName),
        teamId,
        gamePk: args.gamePk,
        officialDate: args.officialDate,
        gameDate: args.gameDate,
        pitcherSlotIndex: i,
        outs: parseIpToOuts(ip) ?? 0,
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

function keyFatigueFlags(): RoleRiskFlag[] {
  return [
    "CLOSER_USED_PREVIOUS_DAY",
    "CLOSER_BACK_TO_BACK",
    "CLOSER_THIRD_DAY_RISK",
    "SETUP_CORE_HEAVY_USAGE",
    "SETUP_CORE_BACK_TO_BACK",
    "HIGH_LEVERAGE_GROUP_FATIGUED",
    "MULTIPLE_KEY_RELIEVERS_USED_PREVIOUS_DAY",
  ];
}

function countKeyFatigue(flags: RoleRiskFlag[]): number {
  const keys = keyFatigueFlags();
  return flags.filter((f) => keys.includes(f)).length;
}

async function main() {
  console.log(`=== Build Bullpen Role Dataset ${BULLPEN_CLASSIFIER_VERSION} ===`);
  const predRaw = await readFile(PATHS.prediction, "utf8");
  const successRaw = await readFile(PATHS.success, "utf8");
  const failureRaw = await readFile(PATHS.failure, "utf8");
  const predHash = sha256(predRaw);
  const successHash = sha256(successRaw);
  const failureHash = sha256(failureRaw);

  const prediction = JSON.parse(predRaw) as {
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

  if (targets.length === 0) {
    throw new Error("success/failure review에 대상 경기가 없음");
  }
  console.log(`bullpen targets=${targets.length}`);

  const usage = createCacheUsage();
  const scheduleStart = addDays(TARGET_DATE_KST, -(ROLE_LOOKBACK_DAYS + 2));
  const scheduleQuery = `/api/v1/schedule?sportId=1&startDate=${scheduleStart}&endDate=${TARGET_DATE_KST}`;
  const scheduleData = await getRawStatsJson(scheduleQuery, usage);
  const allSched = extractScheduleGames(scheduleData);

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
    if (!sched) throw new Error(`schedule miss ${t.gameId}`);
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
  const priorSched = allSched
    .filter(
      (s) =>
        s.status === "Final" &&
        s.officialDate >= minOfficial &&
        s.officialDate <= maxOfficial &&
        (neededTeams.has(s.homeTeamId) || neededTeams.has(s.awayTeamId)),
    )
    .sort((a, b) => a.gamePk - b.gamePk);

  const derivedName = `${TARGET_DATE_KST}-appearances-index.json`;
  const inputHash = hashInput([
    BULLPEN_CLASSIFIER_VERSION,
    TARGET_DATE_KST,
    priorSched.map((s) => s.gamePk),
  ]);

  let allDerived: BullpenAppearanceDerived[] = [];
  const cached = await readDerivedJson<BullpenAppearanceDerived[]>(
    derivedName,
    usage,
  );
  if (cached && cached.meta.inputHash === inputHash) {
    allDerived = cached.data;
    console.log(`derived cache hit records=${allDerived.length}`);
  } else {
    console.log(`사전 경기 fetch: ${priorSched.length}`);
    const collected: BullpenAppearanceDerived[] = [];
    await mapPool(priorSched, 6, async (s) => {
      try {
        const box = asRecord(
          await getRawStatsJson(`/api/v1/game/${s.gamePk}/boxscore`, usage),
        );
        let entries = new Map<number, EntryCtx>();
        try {
          const pbp = asRecord(
            await getRawStatsJson(
              `/api/v1/game/${s.gamePk}/playByPlay`,
              usage,
            ),
          );
          if (pbp) entries = extractEntries(pbp);
        } catch {
          /* optional */
        }
        if (box) {
          collected.push(
            ...extractAppearances({
              box,
              gamePk: s.gamePk,
              gameDate: s.gameDate,
              officialDate: s.officialDate,
              homeTeamId: s.homeTeamId,
              awayTeamId: s.awayTeamId,
              entries,
            }),
          );
        }
      } catch {
        /* skip */
      }
      return null;
    });
    // deterministic order
    allDerived = collected.sort(
      (a, b) =>
        a.gamePk - b.gamePk ||
        a.teamId - b.teamId ||
        a.pitcherSlotIndex - b.pitcherSlotIndex ||
        a.playerId - b.playerId,
    );
    await writeDerivedJson(
      derivedName,
      allDerived,
      {
        dataThroughDate: TARGET_DATE_KST,
        inputHash,
        recordCount: allDerived.length,
      },
    );
  }

  const targetPks = new Set(resolved.map((r) => r.sched.gamePk));
  // exclude target games if present
  allDerived = allDerived.filter((a) => !targetPks.has(a.gamePk));

  const allClassified: ClassifiedBullpenPitcher[] = [];
  const classifiedKeys = new Set<string>();
  const gameCompares: GameBullpenRoleCompare[] = [];
  let starterExcludedTotal = 0;

  type Pending = {
    r: (typeof resolved)[0];
    home: ClassifiedBullpenPitcher[];
    away: ClassifiedBullpenPitcher[];
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
        const classified = classifyBullpenPitcher({
          playerId,
          playerName: list[0]?.playerName ?? null,
          teamId,
          teamName,
          cutoffTime: r.sched.gameDate,
          officialDate: r.sched.officialDate,
          appearances: list,
        });
        starterExcludedTotal += classified.starterAppearancesExcluded;
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
      home: forTeam(r.sched.homeTeamId, r.homeName),
      away: forTeam(r.sched.awayTeamId, r.awayName),
    });
  }

  const thresholds = computeUsageThresholds(allClassified);
  for (const p of pending) {
    const homeSnap = buildTeamBullpenRoleSnapshot({
      teamId: p.r.sched.homeTeamId,
      teamName: p.r.homeName,
      cutoffTime: p.r.sched.gameDate,
      pitchers: p.home,
      thresholds,
    });
    const awaySnap = buildTeamBullpenRoleSnapshot({
      teamId: p.r.sched.awayTeamId,
      teamName: p.r.awayName,
      cutoffTime: p.r.sched.gameDate,
      pitchers: p.away,
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
    gameCompares.push({
      ...compare,
      postGame: {
        outcome: p.r.outcome,
        bullpenVerdict: p.r.bullpenVerdict,
        actualProtected:
          p.r.outcome === "HIT" &&
          (p.r.bullpenVerdict === "BULLPEN_PROTECTED_LEAD" ||
            p.r.bullpenVerdict === "BULLPEN_CREATED_WIN"),
        actualCollapse:
          p.r.outcome === "MISS" &&
          (p.r.bullpenVerdict === "BULLPEN_COLLAPSE" ||
            p.r.bullpenVerdict === "BULLPEN_DISADVANTAGE"),
      },
    });
  }

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
  const statusCounts = {
    INSUFFICIENT_SAMPLE: 0,
    PROVISIONAL: 0,
    CLASSIFIED: 0,
  };
  let confirmedUnder3 = 0;
  let longUnder3 = 0;
  let withSecondary = 0;
  for (const p of allClassified) {
    roleCounts[p.primaryRole] += 1;
    statusCounts[p.classificationStatus] += 1;
    if (
      p.sampleSize < 3 &&
      p.classificationStatus === "CLASSIFIED" &&
      p.primaryRole !== "UNKNOWN"
    ) {
      confirmedUnder3 += 1;
    }
    if (p.sampleSize < 3 && p.primaryRole === "LONG_RELIEF") longUnder3 += 1;
    if (p.secondaryRoles.length > 0) withSecondary += 1;
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

  const failCollapse = gameCompares.filter((g) => g.postGame?.actualCollapse);
  const successProtected = gameCompares.filter(
    (g) => g.postGame?.actualProtected,
  );
  const failWarned = failCollapse.filter((g) =>
    g.pick.roleFlags.some((f) => keyFatigueFlags().includes(f)),
  );
  const successStable = successProtected.filter(
    (g) =>
      g.overallRoleComparison === "ROLE_STRUCTURE_SUPPORTS_BASELINE" ||
      (countKeyFatigue(g.pick.roleFlags) < countKeyFatigue(g.opp.roleFlags) &&
        countKeyFatigue(g.pick.roleFlags) === 0),
  );

  // deterministic result payload for hash (exclude volatile timestamps)
  const hashPayload = {
    classifierVersion: BULLPEN_CLASSIFIER_VERSION,
    pitchers: allClassified.map((p) => ({
      playerId: p.playerId,
      teamId: p.teamId,
      cutoffTime: p.cutoffTime,
      primaryRole: p.primaryRole,
      secondaryRoles: p.secondaryRoles,
      roleScores: p.roleScores,
      classificationStatus: p.classificationStatus,
      sampleSize: p.sampleSize,
      confidence: p.confidence,
      starterAppearancesExcluded: p.starterAppearancesExcluded,
    })),
    games: gameCompares.map((g) => ({
      gameId: g.gameId,
      overallRoleComparison: g.overallRoleComparison,
      pickFlags: g.pick.roleFlags,
      oppFlags: g.opp.roleFlags,
    })),
  };
  const resultHash = hashResult(hashPayload);

  if (longUnder3 !== 0) {
    throw new Error(`LONG under sample 3 must be 0, got ${longUnder3}`);
  }
  if (confirmedUnder3 !== 0) {
    throw new Error(
      `confirmed roles under sample 3 must be 0, got ${confirmedUnder3}`,
    );
  }

  const generatedAt = new Date().toISOString();
  const dataset = {
    meta: {
      version: BULLPEN_SCHEMA_VERSION,
      classifierVersion: BULLPEN_CLASSIFIER_VERSION,
      dateKst: TARGET_DATE_KST,
      generatedAt,
      researchOnly: true,
      engineConnected: false,
      engineUseAllowed: false,
      predictionHashSha256: predHash,
      successReviewHashSha256: successHash,
      failureReviewHashSha256: failureHash,
      predictionUnchanged: true,
      resultHashSha256: resultHash,
      legal: {
        mlbStatsSource: MLB_STATS_SOURCE_LABEL,
        publicRuntimeUseAllowed: false,
        commercialRuntimeUseAllowed: false,
        rawResponseInResearchCacheOnly: true,
      },
    },
    cacheUsage: usage,
    summary: {
      classifiedPitcherRows: allClassified.length,
      uniquePlayerIds: new Set(allClassified.map((p) => p.playerId)).size,
      starterAppearancesExcluded: starterExcludedTotal,
      roleCounts,
      classificationStatusCounts: statusCounts,
      confirmedRolesUnderSample3: confirmedUnder3,
      longUnderSample3: longUnder3,
      withSecondaryRoles: withSecondary,
      overallRoleComparison: overallCounts,
      failCollapsePregameKeyWarning: failWarned.length,
      failCollapseTotal: failCollapse.length,
      successProtectedPregameStable: successStable.length,
      successProtectedTotal: successProtected.length,
      engineUseAllowed: false,
    },
    games: gameCompares,
    pitchers: allClassified,
  };

  const audit = {
    meta: {
      version: "mlb-bullpen-role-v1.1-audit-v1",
      classifierVersion: BULLPEN_CLASSIFIER_VERSION,
      generatedAt,
      resultHashSha256: resultHash,
      networkCalls: usage.networkCalls,
    },
    totals: {
      totalRows: allClassified.length,
      uniquePlayers: new Set(allClassified.map((p) => p.playerId)).size,
      starterAppearancesExcluded: starterExcludedTotal,
      rolePrimaryCounts: roleCounts,
      classificationStatusCounts: statusCounts,
      confirmedRolesUnderSample3: confirmedUnder3,
      longUnderSample3: longUnder3,
      withSecondaryRoles: withSecondary,
      rawCacheHit: usage.rawHit,
      rawCacheMiss: usage.rawMiss,
      derivedCacheHit: usage.derivedHit,
      derivedCacheMiss: usage.derivedMiss,
      networkCalls: usage.networkCalls,
      resultHash: resultHash,
    },
  };

  await mkdir(path.dirname(PATHS.outDataset), { recursive: true });
  await writeFile(PATHS.outDataset, `${JSON.stringify(dataset, null, 2)}\n`);
  await mkdir(path.dirname(PATHS.outAudit), { recursive: true });
  await writeFile(PATHS.outAudit, `${JSON.stringify(audit, null, 2)}\n`);

  // verify prediction untouched
  if (sha256(await readFile(PATHS.prediction, "utf8")) !== predHash) {
    throw new Error("prediction mutated");
  }

  console.log(`rows=${allClassified.length} starterExcluded=${starterExcludedTotal}`);
  console.log(`roles=${JSON.stringify(roleCounts)}`);
  console.log(`status=${JSON.stringify(statusCounts)}`);
  console.log(`longUnder3=${longUnder3} confirmedUnder3=${confirmedUnder3}`);
  console.log(`cache raw ${usage.rawHit}/${usage.rawMiss} derived ${usage.derivedHit}/${usage.derivedMiss}`);
  console.log(`network=${usage.networkCalls} hash=${resultHash.slice(0, 16)}…`);
  console.log(`저장: ${PATHS.outDataset}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
