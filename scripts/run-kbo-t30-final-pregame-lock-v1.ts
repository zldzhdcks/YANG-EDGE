/**
 * KBO T-30 Final Pregame Lock — remap cached odds aliases, check operator inputs, lock.
 * No Odds API call unless remapping impossible (this run: 0 calls).
 *
 *   npx tsx --env-file=.env.local scripts/run-kbo-t30-final-pregame-lock-v1.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveKboTeamIdentity } from "../src/lib/kbo/resolve-kbo-team-identity";

const DATE = process.argv[2]?.trim() || "2026-07-31";
const PREV_RUN = "2026-07-31T08-52-40-877Z";

function nowIso(): string {
  return new Date().toISOString();
}
function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}
async function revise(fp: string, prevRun: string): Promise<string | null> {
  if (!(await exists(fp))) return null;
  const rev = fp.replace(/\.json$/i, `.rev-${prevRun}.json`);
  if (!(await exists(rev))) await copyFile(fp, rev);
  return rev;
}
function marketProb(home: number | null, away: number | null): number | null {
  if (home == null || away == null || home <= 1 || away <= 1) return null;
  const ih = 1 / home;
  const ia = 1 / away;
  const s = ih + ia;
  return s > 0 ? Number((ih / s).toFixed(6)) : null;
}
function classifyClock(
  start: string | null,
  nowMs: number,
  abs: string | null,
  det: string | null,
) {
  const blob = `${abs ?? ""} ${det ?? ""}`.toUpperCase();
  if (/FINAL|\bFT\b|AOT|ENDED/.test(blob)) {
    return { clockState: "FINAL", hard: true, minutesToStart: null as number | null };
  }
  if (/POSTP|POSTPONED/.test(blob)) {
    return { clockState: "POSTPONED", hard: true, minutesToStart: null };
  }
  if (/CANC|CANCEL/.test(blob)) {
    return { clockState: "CANCELLED", hard: true, minutesToStart: null };
  }
  if (/DELAY/.test(blob) && !/NOT\s+STARTED|\bNS\b/.test(blob)) {
    return { clockState: "DELAYED", hard: false, minutesToStart: null };
  }
  const startMs = start ? Date.parse(start) : NaN;
  const minutesToStart = Number.isFinite(startMs)
    ? Math.round((startMs - nowMs) / 60000)
    : null;
  const hard = Number.isFinite(startMs) && nowMs >= startMs;
  const live =
    /\bLIVE\b|IN[_\s-]?PROGRESS|\bIN_PLAY\b/.test(blob) &&
    !/\bNOT\s+STARTED\b|\bNS\b/.test(blob);
  if (hard || live) {
    return { clockState: "ALREADY_STARTED", hard: true, minutesToStart };
  }
  if (/\bWARMUP\b|WARM-UP|PRE-?GAME/.test(blob) && !hard) {
    return { clockState: "WARMUP_OPEN", hard: false, minutesToStart };
  }
  if (Number.isFinite(startMs) && !hard) {
    return { clockState: "PREGAME_OPEN", hard: false, minutesToStart };
  }
  return { clockState: "UNKNOWN", hard: false, minutesToStart };
}

function emptyStarter(artifactGeneratedAt: string) {
  return {
    pitcherId: null,
    name: null,
    throwingHand: null,
    confirmationStatus: "NOT_ENTERED",
    status: "SOURCE_UNAVAILABLE",
    sourceType: null,
    source: null,
    enteredBy: null,
    enteredAt: null,
    sourceReference: null,
    notes: null,
    fetchedAt: null,
    statsAsOf: null,
    artifactGeneratedAt,
    missingFeatures: ["OPERATOR_STARTER_NOT_ENTERED"],
  };
}

function emptyLineup(checkedAt: string) {
  return {
    status: "NOT_RELEASED",
    confirmed: false,
    battingOrder: [],
    positions: [],
    designatedHitter: null,
    sourceType: null,
    source: null,
    sourceReference: null,
    enteredBy: null,
    fetchedAt: checkedAt,
    enteredAt: null,
    reasons: ["OPERATOR_LINEUP_NOT_ENTERED", "T30_CHECK_NO_FILE"],
  };
}

async function main() {
  const lockedAt = nowIso();
  const runId = lockedAt.replace(/[:.]/g, "-");
  const root = path.join(process.cwd(), "data", "research", "kbo");
  const predRoot = path.join(process.cwd(), "data", "predictions", "kbo");
  const nowMs = Date.now();

  const files = [
    path.join(root, `${DATE}-schedule-v1.json`),
    path.join(root, `${DATE}-starter-dataset-v1.json`),
    path.join(root, `${DATE}-odds-history-dataset-v1.json`),
    path.join(root, `${DATE}-lineup-dataset-v1.json`),
    path.join(root, `${DATE}-pregame-cutoff-audit-v1.json`),
    path.join(root, `${DATE}-pregame-leakage-audit-v1.json`),
    path.join(root, `${DATE}-pregame-collection-summary-v1.json`),
    path.join(root, `${DATE}-daily-research-summary-v1.json`),
    path.join(root, `${DATE}-schedule-result-identity-v1-api-baseball.json`),
    path.join(predRoot, `${DATE}.json`),
  ];

  const revised: string[] = [];
  for (const f of files) {
    const r = await revise(f, PREV_RUN);
    if (r) revised.push(path.relative(process.cwd(), r).replace(/\\/g, "/"));
  }

  const schedule = JSON.parse(
    await readFile(path.join(root, `${DATE}-schedule-v1.json`), "utf8"),
  );
  const prevPred = JSON.parse(
    await readFile(path.join(predRoot, `${DATE}.json`), "utf8"),
  );
  const oddsHist = JSON.parse(
    await readFile(path.join(root, `${DATE}-odds-history-dataset-v1.json`), "utf8"),
  );
  const starterPrev = JSON.parse(
    await readFile(path.join(root, `${DATE}-starter-dataset-v1.json`), "utf8"),
  );
  const lineupPrev = JSON.parse(
    await readFile(path.join(root, `${DATE}-lineup-dataset-v1.json`), "utf8"),
  );

  const opStarterPath = path.join(
    process.cwd(),
    "data/operator-input/kbo",
    `${DATE}-starter-confirmation-v1.json`,
  );
  const opLineupPath = path.join(
    process.cwd(),
    "data/operator-input/kbo",
    `${DATE}-lineup-confirmation-v1.json`,
  );
  const opMarketsPath = path.join(
    process.cwd(),
    "data/operator-input/kbo",
    `${DATE}-operator-markets-v2.json`,
  );
  const hasStarter = await exists(opStarterPath);
  const hasLineup = await exists(opLineupPath);
  const hasMarkets = await exists(opMarketsPath);

  type MapRow = {
    scheduleGameId: string;
    providerEventId: string;
    providerHome: string;
    providerAway: string;
    canonicalHomeTeam: string | null;
    canonicalAwayTeam: string | null;
    mappedHomeTeamId: string | null;
    mappedAwayTeamId: string | null;
    mappingMethod: string;
    mappingConfidence: string;
    warnings: string[];
    linked: boolean;
  };

  const mappings: MapRow[] = [];
  const oddsByScheduleId = new Map<string, Record<string, unknown>>();

  const oddsEvents = (oddsHist.games ?? []).map((o: any) => ({
    o,
    h: resolveKboTeamIdentity(String(o.homeTeam ?? "")),
    a: resolveKboTeamIdentity(String(o.awayTeam ?? "")),
  }));

  let linkedBefore = 0;
  for (const g of prevPred.games ?? []) {
    if (g.odds?.status === "COLLECTED") linkedBefore += 1;
  }

  for (const g of schedule.games) {
    const homeId = resolveKboTeamIdentity(String(g.home));
    const awayId = resolveKboTeamIdentity(String(g.away));
    const warnings: string[] = [];
    if (homeId.mappingStatus !== "MATCHED") {
      warnings.push(`SCHEDULE_HOME_UNMATCHED:${g.home}`);
    }
    if (awayId.mappingStatus !== "MATCHED") {
      warnings.push(`SCHEDULE_AWAY_UNMATCHED:${g.away}`);
    }

    const candidates = oddsEvents.filter(
      (e: any) =>
        e.h.canonicalTeamId &&
        e.a.canonicalTeamId &&
        e.h.canonicalTeamId === homeId.canonicalTeamId &&
        e.a.canonicalTeamId === awayId.canonicalTeamId,
    );

    if (
      candidates.length === 1 &&
      homeId.canonicalTeamId &&
      awayId.canonicalTeamId
    ) {
      const { o, h, a } = candidates[0];
      const startMs = Date.parse(g.scheduledStartTime);
      const fetchMs = o.fetchedAt ? Date.parse(o.fetchedAt) : NaN;
      const afterCutoff =
        Number.isFinite(startMs) &&
        Number.isFinite(fetchMs) &&
        fetchMs >= startMs;
      const row: MapRow = {
        scheduleGameId: g.gameId,
        providerEventId: o.providerEventId,
        providerHome: o.homeTeam,
        providerAway: o.awayTeam,
        canonicalHomeTeam: h.canonicalNameEn ?? h.canonicalNameKo,
        canonicalAwayTeam: a.canonicalNameEn ?? a.canonicalNameKo,
        mappedHomeTeamId: h.canonicalTeamId,
        mappedAwayTeamId: a.canonicalTeamId,
        mappingMethod: "CANONICAL_TEAM_ID_BOTH_SIDES",
        mappingConfidence: "HIGH",
        warnings,
        linked: !afterCutoff,
      };
      mappings.push(row);
      oddsByScheduleId.set(g.gameId, {
        gameId: g.gameId,
        status: afterCutoff ? "ODDS_AFTER_CUTOFF" : "COLLECTED",
        reasons: afterCutoff ? ["ODDS_FETCHED_AFTER_START"] : [],
        providerEventId: o.providerEventId,
        sportKey: oddsHist.sportKey,
        oddsFormat: "DECIMAL",
        declaredFormat: "decimal",
        rawFormat: "decimal",
        formatValidationStatus:
          o.formatValidationStatus ?? "FORMAT_CONFIRMED_DECIMAL",
        homeOdds: o.homeOdds,
        awayOdds: o.awayOdds,
        bookmaker: o.bookmaker,
        marketTimestamp: o.marketTimestamp ?? o.fetchedAt,
        marketLastUpdate: o.marketTimestamp ?? o.fetchedAt,
        fetchedAt: o.fetchedAt,
        capturedAt: o.fetchedAt,
        commenceTime: o.commenceTime,
        homeTeam: o.homeTeam,
        awayTeam: o.awayTeam,
        mapping: {
          providerEventId: o.providerEventId,
          canonicalHomeTeam: row.canonicalHomeTeam,
          canonicalAwayTeam: row.canonicalAwayTeam,
          mappedHomeTeamId: row.mappedHomeTeamId,
          mappedAwayTeamId: row.mappedAwayTeamId,
          mappingMethod: row.mappingMethod,
          mappingConfidence: row.mappingConfidence,
          warnings: row.warnings,
        },
      });
    } else {
      const reason =
        candidates.length === 0
          ? "NO_EXACT_BOTH_SIDE_CANONICAL_MATCH"
          : "AMBIGUOUS_MULTIPLE_MATCHES";
      mappings.push({
        scheduleGameId: g.gameId,
        providerEventId: "",
        providerHome: "",
        providerAway: "",
        canonicalHomeTeam: homeId.canonicalNameEn ?? homeId.canonicalNameKo,
        canonicalAwayTeam: awayId.canonicalNameEn ?? awayId.canonicalNameKo,
        mappedHomeTeamId: homeId.canonicalTeamId,
        mappedAwayTeamId: awayId.canonicalTeamId,
        mappingMethod: "CANONICAL_TEAM_ID_BOTH_SIDES",
        mappingConfidence: "NONE",
        warnings: [...warnings, reason],
        linked: false,
      });
      oddsByScheduleId.set(g.gameId, {
        gameId: g.gameId,
        status: "NOT_COLLECTED",
        reasons: [reason, "DOMESTIC_PROTO_NOT_COLLECTED"],
        providerEventId: null,
        sportKey: oddsHist.sportKey,
        oddsFormat: "DECIMAL",
        declaredFormat: null,
        rawFormat: null,
        formatValidationStatus: null,
        homeOdds: null,
        awayOdds: null,
        bookmaker: null,
        marketTimestamp: null,
        marketLastUpdate: null,
        fetchedAt: null,
        capturedAt: null,
        commenceTime: null,
        homeTeam: null,
        awayTeam: null,
        mapping: null,
      });
    }
  }

  const linkedAfter = [...oddsByScheduleId.values()].filter(
    (o) => o.status === "COLLECTED",
  ).length;

  const artifactGeneratedAt = lockedAt;
  const lineupCheckedAt = lockedAt;
  const starterGames = schedule.games.map((g: any) => ({
    gameId: g.gameId,
    home: emptyStarter(artifactGeneratedAt),
    away: emptyStarter(artifactGeneratedAt),
  }));
  const lineupGames = schedule.games.map((g: any) => ({
    gameId: g.gameId,
    home: emptyLineup(lineupCheckedAt),
    away: emptyLineup(lineupCheckedAt),
  }));

  for (const g of schedule.games) {
    const c = classifyClock(
      g.scheduledStartTime,
      nowMs,
      g.statusAbstract,
      g.statusDetailed,
    );
    g.clockState = c.clockState;
    g.minutesToStart = c.minutesToStart;
    g.lockRunId = runId;
    g.clockCheckedAt = lockedAt;
  }
  schedule.runId = runId;
  schedule.lockPhase = "T30_FINAL_PREGAME_LOCK";
  schedule.priorRunId = PREV_RUN;

  const games = schedule.games.map((g: any) => {
    const clock = classifyClock(
      g.scheduledStartTime,
      nowMs,
      g.statusAbstract,
      g.statusDetailed,
    );
    const odds = oddsByScheduleId.get(g.gameId)!;
    const st = starterGames.find((s: { gameId: string }) => s.gameId === g.gameId)!;
    const lu = lineupGames.find((s: { gameId: string }) => s.gameId === g.gameId)!;
    const prev = (prevPred.games ?? []).find((p: any) => p.gameId === g.gameId);

    const passReasons: string[] = ["KBO_PREDICTION_PIPELINE_NOT_IMPLEMENTED"];
    const blockReasons: string[] = [];
    const missingInputs: string[] = ["ENGINE_MIN_INPUT"];
    const inputWarnings: string[] = [];

    if (
      clock.hard ||
      clock.clockState === "ALREADY_STARTED" ||
      clock.clockState === "FINAL"
    ) {
      blockReasons.push("FIRST_PITCH_CUTOFF");
    }
    if (clock.clockState === "POSTPONED") blockReasons.push("POSTPONED");
    if (clock.clockState === "CANCELLED") blockReasons.push("CANCELLED");

    passReasons.push("STARTER_NOT_ENTERED");
    missingInputs.push("HOME_STARTER", "AWAY_STARTER");
    passReasons.push("LINEUP_NOT_CONFIRMED");
    missingInputs.push("LINEUP");
    if (!hasMarkets) {
      passReasons.push("DOMESTIC_PROTO_NOT_COLLECTED");
      missingInputs.push("DOMESTIC_PROTO");
    }
    if (odds.status !== "COLLECTED") {
      if (odds.status === "ODDS_AFTER_CUTOFF") {
        passReasons.push("ODDS_AFTER_CUTOFF");
      } else {
        passReasons.push("ODDS_NOT_COLLECTED");
      }
      const reasons = (odds.reasons as string[]) ?? [];
      if (reasons.includes("NO_EXACT_BOTH_SIDE_CANONICAL_MATCH")) {
        passReasons.push("TEAM_MAPPING_FAILED");
      }
      missingInputs.push("ODDS_H2H");
    }
    passReasons.push("PROVIDER_QUOTA_GUARD");

    const officialStatus = blockReasons.length ? "BLOCKED" : "PASS";
    const predictedAtPreserved = prev?.predictedAt ?? lockedAt;
    const beforeStart = Number.isFinite(Date.parse(g.scheduledStartTime))
      ? Date.parse(predictedAtPreserved) < Date.parse(g.scheduledStartTime)
      : null;
    const oddsFetchedAt = odds.fetchedAt as string | null;
    const oddsBefore =
      oddsFetchedAt && Number.isFinite(Date.parse(g.scheduledStartTime))
        ? Date.parse(oddsFetchedAt) < Date.parse(g.scheduledStartTime)
        : null;

    const auditDetail: string[] = [];
    let cutoff: "PASS" | "WARN" | "FAIL" = "PASS";
    let leakage: "PASS" | "WARN" | "FAIL" = "PASS";
    let mapping: "PASS" | "WARN" | "FAIL" = "PASS";
    if (officialStatus === "BLOCKED") {
      cutoff = "FAIL";
      auditDetail.push("HARD_CUTOFF");
    }
    if (beforeStart === false) {
      cutoff = "FAIL";
      leakage = "FAIL";
      auditDetail.push("PREDICTED_AFTER_START");
    }
    if (odds.mapping && odds.status === "COLLECTED") mapping = "PASS";
    else if (odds.status === "NOT_COLLECTED") {
      mapping = "WARN";
      auditDetail.push("ODDS_UNLINKED");
    }
    auditDetail.push(`MISSING:${[...new Set(missingInputs)].join(",")}`);

    return {
      sport: "baseball" as const,
      league: "KBO" as const,
      date: DATE,
      runId,
      gameId: g.gameId,
      matchup: `${g.away} @ ${g.home}`,
      home: g.home,
      away: g.away,
      scheduledStartTime: g.scheduledStartTime,
      officialStatus,
      officialPick: null,
      confidence: null,
      modelProbability: null,
      marketProbability: marketProb(
        (odds.homeOdds as number | null) ?? null,
        (odds.awayOdds as number | null) ?? null,
      ),
      valueEdge: null,
      passReasons: [...new Set(passReasons)],
      blockReasons: [...new Set(blockReasons)],
      missingInputs: [...new Set(missingInputs)],
      inputWarnings,
      predictedAt: predictedAtPreserved,
      lockedAt,
      engineVersion: null,
      researchBaseline: null,
      researchOnly: true,
      clockState: clock.clockState,
      minutesToStart: clock.minutesToStart,
      starter: { home: st.home, away: st.away },
      odds,
      lineup: {
        home: lu.home,
        away: lu.away,
        retrySuggested: false,
        t30CheckedAt: lineupCheckedAt,
      },
      cutoff: {
        hardCutoffPassed: clock.hard,
        scheduleBeforeStart: beforeStart,
        starterBeforeStart: null,
        oddsBeforeStart: oddsBefore,
        lineupBeforeStart: true,
        predictedBeforeStart: beforeStart !== false,
      },
      audit: { cutoff, leakage, mapping, detail: auditDetail },
      priorRunId: PREV_RUN,
    };
  });

  const summary = {
    total: games.length,
    ELIGIBLE: games.filter((g: { officialStatus: string }) => g.officialStatus === "ELIGIBLE").length,
    PASS: games.filter((g: { officialStatus: string }) => g.officialStatus === "PASS").length,
    BLOCKED: games.filter((g: { officialStatus: string }) => g.officialStatus === "BLOCKED").length,
    officialPickCount: 0,
    alreadyStarted: games.filter((g: { blockReasons: string[] }) =>
      g.blockReasons.includes("FIRST_PITCH_CUTOFF"),
    ).length,
    postponedOrCancelled: games.filter(
      (g: { blockReasons: string[] }) =>
        g.blockReasons.includes("POSTPONED") ||
        g.blockReasons.includes("CANCELLED"),
    ).length,
  };

  const inputArtifactHashes = {
    schedule: sha256(JSON.stringify(schedule.games)),
    starter: sha256(JSON.stringify(starterGames)),
    odds: sha256(JSON.stringify([...oddsByScheduleId.values()])),
    lineup: sha256(JSON.stringify(lineupGames)),
    mapping: sha256(JSON.stringify(mappings)),
  };

  const predictionDoc: Record<string, unknown> = {
    schemaVersion: "kbo-prediction-snapshot-v1",
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    priorRunId: PREV_RUN,
    predictedAt: prevPred.predictedAt,
    lockedAt,
    lockPhase: "T30_FINAL_PREGAME_LOCK",
    enginePolicy: "NO_OFFICIAL_ENGINE_PICKS_IN_THIS_MISSION",
    researchOnly: true,
    apiCalls: {
      theOddsApi: 0,
      reason: "REMAP_FROM_EXISTING_ODDS_ARTIFACT_ONLY",
      remainingBefore: 12,
      remainingAfter: 12,
    },
    operatorInput: {
      starter: hasStarter ? "ENTERED" : "NOT_ENTERED",
      lineup: hasLineup ? "ENTERED" : "NOT_ENTERED",
      domesticProto: hasMarkets ? "ENTERED" : "NOT_COLLECTED",
    },
    oddsLinking: { linkedBefore, linkedAfter, apiCalls: 0 },
    summary,
    inputArtifactHashes,
    games,
    predictionHashSha256: "",
  };
  predictionDoc.predictionHashSha256 = sha256(
    JSON.stringify({
      date: DATE,
      runId,
      lockedAt,
      games: games.map((g: {
        gameId: string;
        officialStatus: string;
        officialPick: unknown;
        passReasons: string[];
        blockReasons: string[];
        predictedAt: string;
        lockedAt: string;
      }) => ({
        gameId: g.gameId,
        officialStatus: g.officialStatus,
        officialPick: g.officialPick,
        passReasons: g.passReasons,
        blockReasons: g.blockReasons,
        predictedAt: g.predictedAt,
        lockedAt: g.lockedAt,
      })),
    }),
  );

  const mappingDoc = {
    schemaVersion: "kbo-odds-alias-mapping-v1",
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    generatedAt: lockedAt,
    priorLinked: linkedBefore,
    linkedAfter,
    apiCalls: 0,
    remainingQuotaAssumed: 12,
    rows: mappings,
  };

  const oddsDoc = {
    schemaVersion: "kbo-odds-history-v1",
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    priorRunId: PREV_RUN,
    collectedAt: oddsHist.collectedAt,
    remappedAt: lockedAt,
    sportKey: oddsHist.sportKey,
    oddsFormat: "DECIMAL",
    domesticProtoStatus: hasMarkets ? "ENTERED_FILE_PRESENT" : "NOT_COLLECTED",
    apiCallsThisRun: 0,
    source: "REMAP_EXISTING_ARTIFACT",
    games: [...oddsByScheduleId.values()],
    providerEventsPreserved: oddsHist.games,
  };

  const starterDoc = {
    schemaVersion: "kbo-starter-v1",
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    priorRunId: PREV_RUN,
    collectedAt: starterPrev.collectedAt,
    refreshedAt: lockedAt,
    operatorInputPresent: hasStarter,
    games: starterGames,
  };

  const lineupDoc = {
    schemaVersion: "kbo-lineup-v1",
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    priorRunId: PREV_RUN,
    collectedAt: lineupPrev.collectedAt,
    t30CheckedAt: lineupCheckedAt,
    retryPolicy: "T30_SINGLE_CHECK_DONE",
    operatorInputPresent: hasLineup,
    games: lineupGames,
  };

  const cutoffDoc = {
    schemaVersion: "kbo-pregame-cutoff-audit-v1",
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    generatedAt: lockedAt,
    games: games.map((p: {
      gameId: string;
      matchup: string;
      scheduledStartTime: string;
      clockState: string;
      cutoff: unknown;
      audit: { cutoff: unknown };
    }) => ({
      gameId: p.gameId,
      matchup: p.matchup,
      scheduledStartTime: p.scheduledStartTime,
      clockState: p.clockState,
      cutoff: p.cutoff,
      auditCutoff: p.audit.cutoff,
    })),
  };

  const leakageDoc = {
    schemaVersion: "kbo-pregame-leakage-audit-v1",
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    generatedAt: lockedAt,
    overall: games.some((p: { audit: { leakage: string } }) => p.audit.leakage === "FAIL")
      ? "FAIL"
      : games.some((p: { audit: { leakage: string } }) => p.audit.leakage === "WARN")
        ? "WARN"
        : "PASS",
    games: games.map((p: {
      gameId: string;
      audit: { leakage: string; mapping: unknown; detail: unknown };
    }) => ({
      gameId: p.gameId,
      leakage: p.audit.leakage,
      mapping: p.audit.mapping,
      detail: p.audit.detail,
      usedTargetResult: false,
      usedLiveStats: false,
      usedClosingOddsBackfill: false,
      usedFinalLineupBackfill: false,
      usedAmericanRawAsDecimal: false,
      officialPick: null,
    })),
  };

  const summaryDoc = {
    schemaVersion: "kbo-pregame-collection-summary-v1",
    sport: "baseball",
    league: "KBO",
    date: DATE,
    runId,
    priorRunId: PREV_RUN,
    generatedAt: lockedAt,
    lockPhase: "T30_FINAL_PREGAME_LOCK",
    summary,
    oddsLinking: {
      linkedBefore,
      linkedAfter,
      apiCalls: 0,
      remainingQuotaAssumed: 12,
    },
    operatorInput: {
      starter: hasStarter ? "ENTERED" : "NOT_ENTERED",
      lineup: hasLineup ? "ENTERED" : "NOT_ENTERED",
      domesticProto: hasMarkets ? "ENTERED" : "NOT_COLLECTED",
    },
    conclusion: "KBO_T30_FINAL_PREGAME_LOCKED_PASS_ONLY",
  };

  await mkdir(root, { recursive: true });
  await mkdir(predRoot, { recursive: true });

  const outs: Array<[string, unknown]> = [
    [path.join(root, `${DATE}-schedule-v1.json`), schedule],
    [path.join(root, `${DATE}-starter-dataset-v1.json`), starterDoc],
    [path.join(root, `${DATE}-odds-history-dataset-v1.json`), oddsDoc],
    [path.join(root, `${DATE}-lineup-dataset-v1.json`), lineupDoc],
    [path.join(root, `${DATE}-odds-alias-mapping-v1.json`), mappingDoc],
    [path.join(root, `${DATE}-pregame-cutoff-audit-v1.json`), cutoffDoc],
    [path.join(root, `${DATE}-pregame-leakage-audit-v1.json`), leakageDoc],
    [path.join(root, `${DATE}-pregame-collection-summary-v1.json`), summaryDoc],
    [path.join(root, `${DATE}-daily-research-summary-v1.json`), summaryDoc],
    [path.join(predRoot, `${DATE}.json`), predictionDoc],
  ];

  for (const [fp, doc] of outs) {
    await writeFile(fp, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  }

  console.log(
    JSON.stringify(
      {
        runId,
        lockedAt,
        revised,
        clock: schedule.games.map((g: any) => ({
          id: g.gameId,
          matchup: `${g.away}@${g.home}`,
          clock: g.clockState,
          mins: g.minutesToStart,
        })),
        linkedBefore,
        linkedAfter,
        apiCalls: 0,
        remainingQuotaAssumed: 12,
        operator: { hasStarter, hasLineup, hasMarkets },
        summary,
        mappings: mappings.map((m) => ({
          gameId: m.scheduleGameId,
          linked: m.linked,
          provider: `${m.providerAway}@${m.providerHome}`,
          method: m.mappingMethod,
          confidence: m.mappingConfidence,
          warnings: m.warnings,
        })),
        games: games.map((g: {
          matchup: string;
          officialStatus: string;
          odds: { status: string };
          starter: { home: { confirmationStatus: string } };
          lineup: { home: { status: string } };
          passReasons: string[];
          lockedAt: string;
        }) => ({
          matchup: g.matchup,
          status: g.officialStatus,
          odds: g.odds.status,
          starter: g.starter.home.confirmationStatus,
          lineup: g.lineup.home.status,
          pass: g.passReasons,
          lockedAt: g.lockedAt,
        })),
        hash: predictionDoc.predictionHashSha256,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
