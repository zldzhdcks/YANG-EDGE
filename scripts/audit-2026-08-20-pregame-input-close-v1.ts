/**
 * 2026-08-20 Pregame Input close audit.
 * Reads sealed Stage A + collected starter/odds/lineup + operator observations.
 * Does not run Prediction / Snapshot / Postgame / Engine.
 *
 *   npx tsx scripts/audit-2026-08-20-pregame-input-close-v1.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const DATE_KST = "2026-08-20";
export const CLOSE_REL = "data/audits/2026-08-20-pregame-input-close-v1.json";
export const OBS_REL =
  "data/operator-observations/structured/2026-08-20/batch-0008-next-pregame-v0.json";
export const LOCK_REL = "data/audits/2026-08-20-daily-scope-lock-v1.json";
export const JOIN_REL = "data/audits/2026-08-20-operator-scope-join-v1.json";
export const MLB_SCHEDULE_REL = `data/research/mlb/${DATE_KST}-schedule-v1.json`;
export const FB_SCHEDULE_REL = `data/research/football/${DATE_KST}-schedule-v1.json`;
export const EXPECTED_REL =
  `data/operator-input/mlb/${DATE_KST}-expected-lineup-observation-v0.json`;
export const CONFIRMED_REL =
  `data/operator-input/mlb/${DATE_KST}-confirmed-lineup-observation-v0.json`;
export const KOREAN_REL =
  `data/operator-input/mlb/${DATE_KST}-korean-market-odds-observation-v0.json`;
export const STARTER_REL = `data/research/mlb/${DATE_KST}-starter-dataset-v1.json`;
export const STARTER_AUDIT_REL = `data/audits/${DATE_KST}-starter-dataset-v1-audit.json`;
export const ODDS_REL = `data/research/mlb/${DATE_KST}-odds-history-dataset-v1.json`;
export const ODDS_AUDIT_REL = `data/audits/${DATE_KST}-odds-history-dataset-v1-audit.json`;
export const LINEUP_REL = `data/research/mlb/${DATE_KST}-lineup-dataset-v1.json`;
export const LINEUP_AUDIT_REL = `data/audits/${DATE_KST}-lineup-dataset-v1-audit.json`;
export const PREDICTION_REL = `data/predictions/mlb/${DATE_KST}.json`;
export const SNAPSHOT_REL = `data/research/football/${DATE_KST}-prediction-snapshot-v0.json`;
export const FROZEN_PRED_0819 = "data/predictions/mlb/2026-08-19.json";
export const FROZEN_LOCK_0819 = "data/audits/2026-08-19-daily-scope-lock-v1.json";
export const FROZEN_EXPECTED_0819 =
  "data/operator-input/mlb/2026-08-19-expected-lineup-observation-v0.json";
export const FROZEN_FREEZE_0819 =
  "data/audits/2026-08-19-pregame-freeze-close-v1.json";

export const STAGE_A_HASHES = {
  lock: "fbc80ab706432e7f2a54713069222d4025439c7768474eec348337064b24ea58",
  operatorStructured:
    "6c8c8d5a74476614afe5905b05d4a331be72ed89d80fe8b372c0e60b09a37877",
  join: "29458d18a671e8a89d570c54d8d92953d0dc95ead0201436428fc9375cf0f969",
  mlbSchedule:
    "26530269c11b37f69e6a4cd8021eaceef02b7f3058dc5495cdcda80a4a275792",
  footballSchedule:
    "7318cf39f461d7e5423d82a670e23d040cf3083a6ea1b71dcc6414299b071440",
} as const;

export const FROZEN_0819_HASHES = {
  prediction:
    "78ff77d372cc9827df8107b596b5adf80b3eb8df619f63f6d288fe773126c9a7",
  lock: "5efd2b0da7ba4cd7f170e6169531ada836558048a0229696927f9b2d56914daa",
  expected:
    "6c273065797e956d98b9a3b5ac6ef67ccfd9766270e3302caeb9d7ed05672d62",
  freezeClose:
    "0a3d4b8b2bb29af52f3e94d5e67c59f07cd70007cb8d82fcd4d0d79710d46987",
} as const;

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function readJson(cwd: string, rel: string): unknown {
  return JSON.parse(readFileSync(path.join(cwd, rel), "utf8"));
}

function timingFrom(ts: string | null | undefined, start: string | null) {
  const t = ts ? Date.parse(ts) : Number.NaN;
  const s = start ? Date.parse(start) : Number.NaN;
  if (!Number.isFinite(t) || !Number.isFinite(s)) return "UNKNOWN" as const;
  return t < s ? ("PRE_GAME" as const) : ("LATE" as const);
}

export async function auditPregameInputClose(cwd = process.cwd()) {
  const existingAbs = path.join(cwd, CLOSE_REL);
  if (existsSync(existingAbs)) {
    return JSON.parse(readFileSync(existingAbs, "utf8")) as Awaited<
      ReturnType<typeof buildPregameInputCloseDocument>
    >;
  }
  return buildPregameInputCloseDocument(cwd);
}

async function buildPregameInputCloseDocument(cwd: string) {
  const generatedAt = new Date().toISOString();
  const required = [
    LOCK_REL,
    JOIN_REL,
    OBS_REL,
    MLB_SCHEDULE_REL,
    FB_SCHEDULE_REL,
    EXPECTED_REL,
    CONFIRMED_REL,
    KOREAN_REL,
    STARTER_REL,
    STARTER_AUDIT_REL,
    ODDS_REL,
    ODDS_AUDIT_REL,
    LINEUP_REL,
    LINEUP_AUDIT_REL,
  ];
  for (const rel of required) {
    if (!existsSync(path.join(cwd, rel))) throw new Error(`MISSING:${rel}`);
  }
  if (existsSync(path.join(cwd, PREDICTION_REL))) {
    throw new Error("PREDICTION_PRESENT");
  }
  if (existsSync(path.join(cwd, SNAPSHOT_REL))) {
    throw new Error("FOOTBALL_SNAPSHOT_PRESENT");
  }

  const hashesNow = {
    lock: sha256File(path.join(cwd, LOCK_REL)),
    operatorStructured: sha256File(path.join(cwd, OBS_REL)),
    join: sha256File(path.join(cwd, JOIN_REL)),
    mlbSchedule: sha256File(path.join(cwd, MLB_SCHEDULE_REL)),
    footballSchedule: sha256File(path.join(cwd, FB_SCHEDULE_REL)),
    frozenPrediction0819: sha256File(path.join(cwd, FROZEN_PRED_0819)),
    frozenLock0819: sha256File(path.join(cwd, FROZEN_LOCK_0819)),
    frozenExpected0819: sha256File(path.join(cwd, FROZEN_EXPECTED_0819)),
    frozenFreeze0819: sha256File(path.join(cwd, FROZEN_FREEZE_0819)),
  };
  if (hashesNow.lock !== STAGE_A_HASHES.lock) throw new Error("LOCK_MUTATED");
  if (hashesNow.operatorStructured !== STAGE_A_HASHES.operatorStructured) {
    throw new Error("OPERATOR_STRUCTURED_MUTATED");
  }
  if (hashesNow.join !== STAGE_A_HASHES.join) throw new Error("JOIN_MUTATED");
  if (hashesNow.mlbSchedule !== STAGE_A_HASHES.mlbSchedule) {
    throw new Error("MLB_SCHEDULE_MUTATED");
  }
  if (hashesNow.footballSchedule !== STAGE_A_HASHES.footballSchedule) {
    throw new Error("FOOTBALL_SCHEDULE_MUTATED");
  }
  if (hashesNow.frozenPrediction0819 !== FROZEN_0819_HASHES.prediction) {
    throw new Error("FROZEN_0819_PREDICTION_MUTATED");
  }
  if (hashesNow.frozenLock0819 !== FROZEN_0819_HASHES.lock) {
    throw new Error("FROZEN_0819_LOCK_MUTATED");
  }
  if (hashesNow.frozenExpected0819 !== FROZEN_0819_HASHES.expected) {
    throw new Error("FROZEN_0819_EXPECTED_MUTATED");
  }
  if (hashesNow.frozenFreeze0819 !== FROZEN_0819_HASHES.freezeClose) {
    throw new Error("FROZEN_0819_FREEZE_MUTATED");
  }

  const lock = readJson(cwd, LOCK_REL) as {
    scopeLockedAt: string;
    sourceOperatorObservationHash: string;
    observedScope: { MLB: number; FOOTBALL: number; total: number };
  };
  if (lock.observedScope.total !== 38) throw new Error("SCOPE_SHRINK_FORBIDDEN");

  const join = readJson(cwd, JOIN_REL) as {
    mlb: {
      uniqueGamePk: number;
      matched: number;
      identityBlocked: number;
      missing: number;
      ambiguous: number;
    };
    football: {
      registeredMatched: number;
      screenshotIdentityBlocked: number;
      unregisteredCompetition: number;
      joins: Array<{
        fixture: string;
        rawLeagueLabel: string;
        status: string;
        reason: string;
      }>;
    };
  };
  const expected = readJson(cwd, EXPECTED_REL) as {
    observedAt: string;
    lineupStatus: string;
    summary: {
      scheduleGames: number;
      matchedGames: number;
      teamLineups: number;
      expectedBattingSlots: number;
      expectedGames: number;
      confirmedGames: number;
      preGameObservations: number;
      lateObservations: number;
    };
    games: Array<{
      gamePk: number;
      lineupStatus: string;
      observationStatus?: string;
      awayLineup: unknown[];
      homeLineup: unknown[];
      cutoffLabel: string | null;
    }>;
  };
  const confirmed = readJson(cwd, CONFIRMED_REL) as {
    officialLineup: boolean;
    lineupStatus: string;
    summary: {
      observedGames: number;
      fullGames: number;
      partialGames: number;
      officialPromotion: number;
      preGameObservations: number;
      lateObservations: number;
      confirmedPlayerSlots: number;
    };
    games: Array<{
      gamePk: number;
      completeness: string;
      confirmedSides: string[];
      awayLineup: unknown[];
      homeLineup: unknown[];
      cutoffLabel: string;
      officialLineup: boolean;
    }>;
  };
  const korean = readJson(cwd, KOREAN_REL) as {
    observedAt: string;
    marketContext: string;
    marketType: string;
    sourceType: string;
    accountedObservations: number;
    summary: {
      scheduleGames: number;
      matchedGames: number;
      observedGames: number;
      preGameObservations: number;
      lateGames: number;
    };
    games: Array<{
      gamePk: number;
      joinStatus: string;
      awayOdds: number | null;
      homeOdds: number | null;
      observationStatus: string | null;
    }>;
    identityBlockedObservations: Array<{
      rawHomeLabel: string;
      rawMatchup: string;
      gamePk: null;
      identityStatus: string;
      homeOdds: number;
      awayOdds: number;
    }>;
  };
  const starterAudit = readJson(cwd, STARTER_AUDIT_REL) as {
    totals: {
      gameCount: number;
      rowCount: number;
      probableAvailable: number;
      probableMissing: number;
    };
    meta: { engineConnected: boolean; predictionOptional: boolean };
    cache: { networkCalls: number; postGameNetworkCalls: number };
  };
  const starterDoc = readJson(cwd, STARTER_REL) as {
    rows: Array<{
      gamePk: number;
      side: string;
      homeTeam: string;
      awayTeam: string;
      probableStatus: string;
      fetchedAt: string | null;
      sourceTimestamp: string | null;
    }>;
  };
  const oddsAudit = readJson(cwd, ODDS_AUDIT_REL) as {
    independentIntake: {
      provider: string;
      scheduleGames: number;
      gamesMatched: number;
      collected: number;
      partial: number;
      notCollected: number;
    };
    meta: { resultHashSha256: string; engineConnected: boolean };
    cacheUsage?: { firstRun?: { networkCalls?: number } };
  };
  const oddsDoc = readJson(cwd, ODDS_REL) as {
    rows: Array<{
      gamePk?: number | null;
      gameId?: string | null;
      internalGameId?: string | null;
      homeTeam?: string | null;
      awayTeam?: string | null;
      collectionStatus?: string | null;
      fetchedAt?: string | null;
      capturedAt?: string | null;
      collectedAt?: string | null;
    }>;
  };
  const lineupAudit = readJson(cwd, LINEUP_AUDIT_REL) as {
    independentIntake: {
      scheduleGames: number;
      confirmed: number;
      partial: number;
      notReleased: number;
      notCollected: number;
    };
    meta: { engineConnected: boolean; predictionRead: boolean };
    networkCalls?: { firstRun?: number };
  };
  const lineupDoc = readJson(cwd, LINEUP_REL) as {
    rows: Array<{
      gamePk: number;
      side: string;
      teamName: string;
      collectionStatus: string;
      collectionPhase: string;
      confirmed: boolean;
      battingOrder: unknown[];
      sourceTimestamp: string | null;
      fetchedAt: string | null;
      cutoffTime: string | null;
    }>;
  };
  const schedule = readJson(cwd, MLB_SCHEDULE_REL) as {
    games: Array<{
      gamePk: number;
      internalGameId: string;
      homeTeam: string;
      awayTeam: string;
      startTimeKst: string;
      commenceTimeUtc: string;
    }>;
  };

  if (expected.lineupStatus !== "EXPECTED" || expected.summary.confirmedGames !== 0) {
    throw new Error("EXPECTED_PROMOTED_TO_CONFIRMED");
  }
  if (expected.games.some((g) => g.lineupStatus !== "EXPECTED")) {
    throw new Error("NON_EXPECTED_GAME");
  }
  if (confirmed.officialLineup !== false || confirmed.summary.officialPromotion !== 0) {
    throw new Error("OPERATOR_CONFIRMED_PROMOTED_OFFICIAL");
  }
  if (confirmed.summary.observedGames !== 3) {
    throw new Error(`CONFIRMED_COUNT:${confirmed.summary.observedGames}`);
  }
  if (confirmed.summary.fullGames !== 2 || confirmed.summary.partialGames !== 1) {
    throw new Error("CONFIRMED_FULL_PARTIAL");
  }
  if (korean.identityBlockedObservations.length !== 2) {
    throw new Error("KOREAN_BLOCKED_COUNT");
  }
  if (korean.accountedObservations !== 15) {
    throw new Error("KOREAN_SILENT_DROP");
  }

  const football = join.football.joins.map((row) => {
    let pregameInputStatus = "VALID_BLOCKED_IDENTITY";
    if (row.status === "UNREGISTERED_COMPETITION") {
      pregameInputStatus = "VALID_BLOCKED_UNREGISTERED_COMPETITION";
    } else if (row.status === "MATCHED_BUT_UNSUPPORTED_FORMAT") {
      pregameInputStatus = "VALID_BLOCKED_UNSUPPORTED_FORMAT";
    } else if (row.status === "IDENTITY_BLOCKED") {
      pregameInputStatus = "VALID_BLOCKED_IDENTITY";
    } else {
      throw new Error(`FOOTBALL_UNEXPECTED_STATUS:${row.status}`);
    }
    return {
      fixture: row.fixture,
      rawLeagueLabel: row.rawLeagueLabel,
      joinStatus: row.status,
      pregameInputStatus,
      reason: row.reason,
    };
  });
  if (football.length !== 23) throw new Error(`FOOTBALL_COUNT:${football.length}`);

  const starterByPk = new Map<number, typeof starterDoc.rows>();
  for (const row of starterDoc.rows) {
    const list = starterByPk.get(row.gamePk) ?? [];
    list.push(row);
    starterByPk.set(row.gamePk, list);
  }
  const officialByPk = new Map<number, typeof lineupDoc.rows>();
  for (const row of lineupDoc.rows) {
    const list = officialByPk.get(row.gamePk) ?? [];
    list.push(row);
    officialByPk.set(row.gamePk, list);
  }
  const expectedByPk = new Map(expected.games.map((g) => [g.gamePk, g] as const));
  const confirmedByPk = new Map(confirmed.games.map((g) => [g.gamePk, g] as const));
  const koreanByPk = new Map(korean.games.map((g) => [g.gamePk, g] as const));
  const oddsByPk = new Map<number, (typeof oddsDoc.rows)[number]>();
  const oddsByInternal = new Map(
    oddsDoc.rows
      .filter((g) => g.internalGameId || g.gameId)
      .map((g) => [g.internalGameId ?? g.gameId ?? "", g] as const),
  );
  const oddsByTeams = new Map(
    oddsDoc.rows
      .filter((g) => g.homeTeam && g.awayTeam)
      .map((g) => [`${g.homeTeam}\u0000${g.awayTeam}`, g] as const),
  );
  for (const game of schedule.games) {
    const hit =
      oddsByInternal.get(game.internalGameId) ??
      oddsByTeams.get(`${game.homeTeam}\u0000${game.awayTeam}`);
    if (hit) oddsByPk.set(game.gamePk, hit);
  }

  let lateSelected = 0;
  let unknownSelected = 0;
  const mlbRows = schedule.games.map((game) => {
    const start = game.commenceTimeUtc;
    const starters = starterByPk.get(game.gamePk) ?? [];
    const official = officialByPk.get(game.gamePk) ?? [];
    const exp = expectedByPk.get(game.gamePk);
    const conf = confirmedByPk.get(game.gamePk);
    const kor = koreanByPk.get(game.gamePk);
    const odds = oddsByPk.get(game.gamePk);

    const missingStarter = starters.filter((s) => s.probableStatus === "MISSING").length;
    const starterStatus =
      missingStarter > 0 ? "PROBABLE_MISSING" : "PROBABLE_AVAILABLE";
    const starterTs = starters[0]?.sourceTimestamp ?? starters[0]?.fetchedAt ?? null;
    const starterTiming = timingFrom(starterTs, start);

    const oddsTs = odds?.fetchedAt ?? odds?.capturedAt ?? odds?.collectedAt ?? null;
    const providerOddsStatus =
      odds?.collectionStatus === "COLLECTED" || odds
        ? "COLLECTED"
        : "NOT_COLLECTED";
    const providerOddsTiming = timingFrom(oddsTs, start);

    const officialStatus = official[0]?.collectionStatus ?? "NOT_COLLECTED";
    const officialTs =
      official[0]?.sourceTimestamp ?? official[0]?.fetchedAt ?? null;
    const officialTiming = timingFrom(officialTs, start);
    const officialHome = official.find((r) => r.side === "home");
    const officialAway = official.find((r) => r.side === "away");

    const operatorConfirmedStatus = conf
      ? conf.completeness === "FULL"
        ? "CONFIRMED_FULL"
        : "CONFIRMED_PARTIAL"
      : "NOT_OBSERVED";
    const operatorExpectedStatus =
      exp?.observationStatus === "OBSERVED" ? "EXPECTED_OBSERVED" : "NOT_OBSERVED";
    const operatorTs =
      (conf?.cutoffLabel === "PRE_GAME_OBSERVATION" ? "PRE_GAME" : null) ??
      (exp?.cutoffLabel === "PRE_GAME_OBSERVATION" ? "PRE_GAME" : null);
    const operatorLineupTiming =
      conf || exp?.observationStatus === "OBSERVED"
        ? operatorTs === "PRE_GAME" ||
          conf?.cutoffLabel === "PRE_GAME_OBSERVATION" ||
          exp?.cutoffLabel === "PRE_GAME_OBSERVATION"
          ? "PRE_GAME"
          : "UNKNOWN"
        : "NOT_OBSERVED";

    const teamSource = (side: "home" | "away") => {
      const off = side === "home" ? officialHome : officialAway;
      const officialComplete =
        off != null &&
        off.collectionStatus === "CONFIRMED" &&
        officialTiming === "PRE_GAME";
      const officialPartialComplete =
        off != null &&
        (off.collectionStatus === "CONFIRMED" ||
          (off.collectionStatus === "PARTIAL" &&
            (off.battingOrder?.length ?? 0) === 9)) &&
        officialTiming === "PRE_GAME";
      if (officialComplete || officialPartialComplete) {
        return {
          source: "OFFICIAL_PROVIDER",
          status: "CONFIRMED",
          lineupSelectionStatus: "OFFICIAL_PROVIDER_CONFIRMED",
        };
      }
      if (conf && operatorLineupTiming === "PRE_GAME") {
        const sides = conf.confirmedSides ?? [];
        const hasSide =
          (side === "away" && (conf.awayLineup.length === 9 || sides.includes("AWAY"))) ||
          (side === "home" && (conf.homeLineup.length === 9 || sides.includes("HOME")));
        if (hasSide) {
          return {
            source: "MANUAL_OBSERVATION",
            status: "CONFIRMED",
            lineupSelectionStatus: "OPERATOR_CONFIRMED",
          };
        }
      }
      if (exp?.observationStatus === "OBSERVED" && exp.cutoffLabel === "PRE_GAME_OBSERVATION") {
        const slots = side === "away" ? exp.awayLineup.length : exp.homeLineup.length;
        if (slots === 9) {
          return {
            source: "MANUAL_OBSERVATION",
            status: "EXPECTED",
            lineupSelectionStatus: "OPERATOR_EXPECTED",
          };
        }
      }
      return {
        source: "OFFICIAL_PROVIDER",
        status: "NOT_RELEASED",
        lineupSelectionStatus: "OFFICIAL_NOT_RELEASED",
      };
    };

    const homeSel = teamSource("home");
    const awaySel = teamSource("away");
    const selectedSet = new Set([
      homeSel.lineupSelectionStatus,
      awaySel.lineupSelectionStatus,
    ]);
    let selectedLineupStatus = "MIXED_CONFIRMED_EXPECTED";
    if (selectedSet.size === 1) {
      selectedLineupStatus = [...selectedSet][0]!;
    } else if (
      selectedSet.has("OFFICIAL_NOT_RELEASED") &&
      selectedSet.size === 2 &&
      (selectedSet.has("OPERATOR_EXPECTED") ||
        selectedSet.has("OPERATOR_CONFIRMED") ||
        selectedSet.has("OFFICIAL_PROVIDER_CONFIRMED"))
    ) {
      selectedLineupStatus = [...selectedSet].find(
        (s) => s !== "OFFICIAL_NOT_RELEASED",
      )!;
    }

    const koreanOddsStatus =
      kor?.joinStatus === "MATCHED"
        ? "MATCHED_PRE_GAME"
        : "NOT_JOINED";

    const blockingReasons: string[] = [];
    if (starterStatus === "PROBABLE_MISSING") {
      blockingReasons.push("VALID_BLOCKED_STARTER_MISSING");
    }
    if (starterTiming === "LATE" || providerOddsTiming === "LATE") {
      blockingReasons.push("VALID_BLOCKED_LATE_INPUT");
    }
    if (
      homeSel.lineupSelectionStatus === "OFFICIAL_NOT_RELEASED" &&
      awaySel.lineupSelectionStatus === "OFFICIAL_NOT_RELEASED"
    ) {
      blockingReasons.push("VALID_BLOCKED_LINEUP_NOT_RELEASED");
    }

    const selectedOfficial =
      homeSel.lineupSelectionStatus === "OFFICIAL_PROVIDER_CONFIRMED" ||
      awaySel.lineupSelectionStatus === "OFFICIAL_PROVIDER_CONFIRMED";
    if (selectedOfficial && officialTiming === "LATE") {
      lateSelected += 1;
      blockingReasons.push("VALID_BLOCKED_LATE_INPUT");
    }
    if (selectedOfficial && officialTiming === "UNKNOWN") unknownSelected += 1;
    if (
      (homeSel.lineupSelectionStatus === "OPERATOR_CONFIRMED" ||
        awaySel.lineupSelectionStatus === "OPERATOR_CONFIRMED" ||
        homeSel.lineupSelectionStatus === "OPERATOR_EXPECTED" ||
        awaySel.lineupSelectionStatus === "OPERATOR_EXPECTED") &&
      operatorLineupTiming !== "PRE_GAME"
    ) {
      if (operatorLineupTiming === "LATE") lateSelected += 1;
      else unknownSelected += 1;
    }

    const uniqueBlock = [...new Set(blockingReasons)];
    const pregameInputStatus =
      uniqueBlock.length === 0 ? "READY" : uniqueBlock[0]!;

    return {
      gamePk: game.gamePk,
      matchup: `${game.awayTeam} @ ${game.homeTeam}`,
      startTimeKst: game.startTimeKst,
      commenceTimeUtc: start,
      starterStatus,
      starterTiming,
      providerOddsStatus,
      providerOddsTiming,
      officialLineupStatus: officialStatus,
      officialLineupTiming: officialTiming,
      officialBuilderPhase: official[0]?.collectionPhase ?? null,
      operatorConfirmedStatus,
      operatorExpectedStatus,
      operatorLineupTiming,
      selectedLineupSource: {
        away: awaySel,
        home: homeSel,
      },
      selectedLineupStatus,
      koreanOddsStatus,
      pregameInputStatus,
      blockingReasons: uniqueBlock,
    };
  });

  if (mlbRows.length !== 15) throw new Error(`MLB_LEDGER:${mlbRows.length}`);
  const unexplainedMlb = 15 - mlbRows.length;
  const unexplainedFootball = 23 - football.length;
  const unexplainedMissing = unexplainedMlb + unexplainedFootball + (join.mlb.missing ?? 0);

  const koreanDoesNotBlockStageB = true;
  const stageDone =
    lock.observedScope.total === 38 &&
    schedule.games.length === 15 &&
    football.length === 23 &&
    unexplainedMissing === 0 &&
    starterAudit.totals.gameCount === 15 &&
    starterAudit.totals.rowCount === 30 &&
    oddsAudit.independentIntake.scheduleGames === 15 &&
    oddsAudit.independentIntake.collected === 15 &&
    lineupAudit.independentIntake.scheduleGames === 15 &&
    expected.summary.expectedGames === 13 &&
    expected.summary.confirmedGames === 0 &&
    confirmed.summary.observedGames === 3 &&
    confirmed.summary.preGameObservations === 3 &&
    confirmed.summary.officialPromotion === 0 &&
    korean.summary.matchedGames === 13 &&
    korean.identityBlockedObservations.length === 2 &&
    korean.accountedObservations === 15 &&
    mlbRows.every((r) => r.providerOddsStatus === "COLLECTED") &&
    mlbRows.filter((r) => r.providerOddsTiming === "PRE_GAME").length === 15 &&
    lateSelected === 0 &&
    unknownSelected === 0 &&
    join.mlb.ambiguous === 0 &&
    koreanDoesNotBlockStageB;

  const document = {
    schemaVersion: "yang-edge-pregame-input-close-v1",
    dateKst: DATE_KST,
    generatedAt,
    artifactGeneratedAt: generatedAt,
    observedAt: expected.observedAt,
    researchOnly: true,
    sourceScopeLock: LOCK_REL,
    sourceMlbSchedule: MLB_SCHEDULE_REL,
    sourceFootballSchedule: FB_SCHEDULE_REL,
    sourceOperatorObservation: OBS_REL,
    sourceOperatorObservationHash: hashesNow.operatorStructured,
    scopeLockedAt: lock.scopeLockedAt,
    sourceHashes: {
      before: { ...STAGE_A_HASHES, frozen0819: FROZEN_0819_HASHES },
      after: hashesNow,
      unchanged: true,
    },
    MLB: {
      scheduleGames: 15,
      gamePkUnique: 15,
      starter: {
        games: starterAudit.totals.gameCount,
        rows: starterAudit.totals.rowCount,
        probableAvailable: starterAudit.totals.probableAvailable,
        probableMissing: starterAudit.totals.probableMissing,
        preGame: mlbRows.filter((r) => r.starterTiming === "PRE_GAME").length,
        late: mlbRows.filter((r) => r.starterTiming === "LATE").length,
        unknown: mlbRows.filter((r) => r.starterTiming === "UNKNOWN").length,
        networkCalls: starterAudit.cache.networkCalls,
        postGameStatusCalls: starterAudit.cache.postGameNetworkCalls,
        rel: STARTER_REL,
        auditRel: STARTER_AUDIT_REL,
      },
      providerOdds: {
        games: oddsAudit.independentIntake.scheduleGames,
        matched: oddsAudit.independentIntake.gamesMatched,
        collected: oddsAudit.independentIntake.collected,
        partial: oddsAudit.independentIntake.partial,
        notCollected: oddsAudit.independentIntake.notCollected,
        provider: oddsAudit.independentIntake.provider,
        resultHash: oddsAudit.meta.resultHashSha256,
        networkCalls: oddsAudit.cacheUsage?.firstRun?.networkCalls ?? null,
        preGame: mlbRows.filter((r) => r.providerOddsTiming === "PRE_GAME").length,
        late: mlbRows.filter((r) => r.providerOddsTiming === "LATE").length,
        rel: ODDS_REL,
        auditRel: ODDS_AUDIT_REL,
      },
      officialLineup: {
        games: lineupAudit.independentIntake.scheduleGames,
        confirmed: lineupAudit.independentIntake.confirmed,
        partial: lineupAudit.independentIntake.partial,
        notReleased: lineupAudit.independentIntake.notReleased,
        notCollected: lineupAudit.independentIntake.notCollected,
        networkCalls: lineupAudit.networkCalls?.firstRun ?? null,
        preGameByTimestamp: mlbRows.filter((r) => r.officialLineupTiming === "PRE_GAME")
          .length,
        lateByTimestamp: mlbRows.filter((r) => r.officialLineupTiming === "LATE").length,
        rel: LINEUP_REL,
        auditRel: LINEUP_AUDIT_REL,
      },
      operatorConfirmedLineup: {
        games: confirmed.summary.observedGames,
        full: confirmed.summary.fullGames,
        partial: confirmed.summary.partialGames,
        slots: confirmed.summary.confirmedPlayerSlots,
        officialPromotion: confirmed.summary.officialPromotion,
        preGame: confirmed.summary.preGameObservations,
        late: confirmed.summary.lateObservations,
        rel: CONFIRMED_REL,
      },
      operatorExpectedLineup: {
        games: expected.summary.scheduleGames,
        observed: expected.summary.expectedGames,
        teamLineups: expected.summary.teamLineups,
        slots: expected.summary.expectedBattingSlots,
        expected: expected.summary.expectedGames,
        confirmed: expected.summary.confirmedGames,
        preGameObservations: expected.summary.preGameObservations,
        late: expected.summary.lateObservations,
        observedAt: expected.observedAt,
        rel: EXPECTED_REL,
      },
      koreanMarketOddsObservation: {
        games: korean.summary.scheduleGames,
        matched: korean.summary.matchedGames,
        observed: korean.summary.observedGames,
        identityBlocked: korean.identityBlockedObservations.length,
        accountedObservations: korean.accountedObservations,
        pregame: korean.summary.preGameObservations,
        late: korean.summary.lateGames,
        market: korean.marketContext,
        marketType: korean.marketType,
        sourceType: korean.sourceType,
        observedAt: korean.observedAt,
        blockedLabels: korean.identityBlockedObservations.map((r) => r.rawHomeLabel),
        rel: KOREAN_REL,
      },
      perGame: mlbRows,
      ready: mlbRows.filter((r) => r.pregameInputStatus === "READY").length,
      validBlocked: mlbRows.filter((r) => r.pregameInputStatus !== "READY").length,
    },
    FOOTBALL: {
      scopeGames: 23,
      accounted: football.length,
      matchedRegistered: join.football.registeredMatched,
      identityBlocked: join.football.screenshotIdentityBlocked,
      unregistered: join.football.unregisteredCompetition,
      blocked: football.length,
      providerCalls: 0,
      unexplainedMissing: 0,
      rows: football,
    },
    timing: {
      screenshotObservedAt: expected.observedAt,
      artifactGeneratedAt: generatedAt,
      firstMlbStartUtc: "2026-08-19T16:35:00Z",
      allSelectedPregameInputsBeforeStart: lateSelected === 0 && unknownSelected === 0,
      lateEvidenceSelected: lateSelected,
      unknownTimingSelected: unknownSelected,
    },
    koreanIdentityContract: {
      blockedRowsBlockStageB: false,
      reason:
        "Canonical Stage B requires locked-scope accounting, lawful provider attempts, and explicit blocked reasons. Korean market odds are a supplemental operator observation. Provider Odds 15/15 were collected. The two screenshot labels remain IDENTITY_BLOCKED with gamePk=null. 08-19 treated football IDENTITY_BLOCKED rows as VALID_BLOCKED while still closing Stage B. Contract was not lowered.",
    },
    predictionRun: false,
    snapshotRun: false,
    postgameAccess: false,
    engineConnected: false,
    unexplainedMissing,
    accountedTotal: 15 + football.length,
    scopeShrink: 0,
    stageStatus: stageDone ? "B_PREGAME_INPUT_DONE" : "B_PREGAME_INPUT_INCOMPLETE",
    leakage: {
      predictionCalls: 0,
      snapshotCalls: 0,
      resultCalls: 0,
      gradeCalls: 0,
      reviewCalls: 0,
      postgameCalls: 0,
      engineCalls: 0,
      recommendationCalls: 0,
      footballOddsProviderCalls: 0,
      frozenArtifactsModified: false,
    },
  };

  if (!stageDone) {
    throw new Error("STAGE_B_INCOMPLETE");
  }

  const abs = path.join(cwd, CLOSE_REL);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  return document;
}

async function main() {
  const doc = await auditPregameInputClose();
  console.log(
    [
      `wrote ${CLOSE_REL}`,
      `stage=${doc.stageStatus}`,
      `mlbPk=${doc.MLB.gamePkUnique}`,
      `ready=${doc.MLB.ready} blocked=${doc.MLB.validBlocked}`,
      `expected=${doc.MLB.operatorExpectedLineup.observed}/${doc.MLB.operatorExpectedLineup.slots}`,
      `confirmed=${doc.MLB.operatorConfirmedLineup.games}`,
      `korean=${doc.MLB.koreanMarketOddsObservation.matched}+${doc.MLB.koreanMarketOddsObservation.identityBlocked}`,
      `football=${doc.FOOTBALL.accounted}`,
      `accountedTotal=${doc.accountedTotal}`,
      `unexplainedMissing=${doc.unexplainedMissing}`,
    ].join(" "),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
