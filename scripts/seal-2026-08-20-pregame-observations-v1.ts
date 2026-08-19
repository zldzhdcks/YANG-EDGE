/**
 * Seal 2026-08-20 operator Expected / Confirmed lineup + Korean market odds
 * from already-sealed screenshot evidence. Does not mutate Stage A artifacts.
 * Does not run Prediction / Snapshot / Engine.
 *
 *   npx tsx scripts/seal-2026-08-20-pregame-observations-v1.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  computeExpectedLineupHash,
  type MlbExpectedLineupGameV0,
  type MlbExpectedLineupObservationV0,
} from "../src/lib/mlb/expected-lineup-observation-v0";
import {
  computeKoreanMarketOddsHash,
  normalizeImpliedPair,
  type MlbKoreanMarketOddsGameV0,
  type MlbKoreanMarketOddsObservationV0,
} from "../src/lib/mlb/korean-market-odds-observation-v0";

export const DATE_KST = "2026-08-20";
export const OBS_REL =
  "data/operator-observations/structured/2026-08-20/batch-0008-next-pregame-v0.json";
export const JOIN_REL = "data/audits/2026-08-20-operator-scope-join-v1.json";
export const LOCK_REL = "data/audits/2026-08-20-daily-scope-lock-v1.json";
export const MLB_SCHEDULE_REL = `data/research/mlb/${DATE_KST}-schedule-v1.json`;
export const EXPECTED_REL =
  `data/operator-input/mlb/${DATE_KST}-expected-lineup-observation-v0.json`;
export const CONFIRMED_REL =
  `data/operator-input/mlb/${DATE_KST}-confirmed-lineup-observation-v0.json`;
export const KOREAN_REL =
  `data/operator-input/mlb/${DATE_KST}-korean-market-odds-observation-v0.json`;

type Player = {
  battingOrder: number;
  rawPlayerName: string;
  position: string | null;
  bats: string | null;
};

type LineupCard = {
  homeTeam: string;
  awayTeam: string;
  lineupType: string;
  completeness: string;
  confirmedSides?: string[];
  expectedSides?: string[];
  officialLineup?: boolean;
  operatorObservedAt: string;
  observedAt?: string;
  screenshotSha256: string;
  screenshotRel: string;
  awayLineup: Player[];
  homeLineup: Player[];
};

type OddsRow = {
  sport: string;
  rawHomeLabel: string;
  rawAwayLabel: string;
  rawMatchup: string;
  identityStatus: string;
  mappingStatus: string;
  canonicalHome: string | null;
  canonicalAway: string | null;
  operatorObservedAt: string;
  screenshotSha256: string;
  markets: Array<{
    marketType: string;
    homePrice: number | null;
    awayPrice: number | null;
  }>;
};

type JoinMlb = {
  rawHome: string;
  rawAway: string;
  canonicalHome?: string;
  canonicalAway?: string;
  status: string;
  gamePk: number | null;
  commenceTimeUtc?: string | null;
};

type ScheduleGame = {
  gamePk: number;
  internalGameId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTimeUtc?: string | null;
  scheduledStartTime?: string | null;
};

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function toUtcIso(raw: string): string {
  if (/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) {
    return new Date(raw).toISOString();
  }
  return new Date(`${raw}+09:00`).toISOString();
}

function cutoff(observedAt: string, firstPitchAt: string | null) {
  const o = Date.parse(observedAt);
  const f = firstPitchAt ? Date.parse(firstPitchAt) : Number.NaN;
  if (!Number.isFinite(o) || !Number.isFinite(f)) {
    return {
      isBeforeFirstPitch: null as boolean | null,
      cutoffLabel: "UNKNOWN" as const,
      observationStatus: "UNKNOWN" as const,
    };
  }
  if (o < f) {
    return {
      isBeforeFirstPitch: true,
      cutoffLabel: "PRE_GAME_OBSERVATION" as const,
      observationStatus: "PRE_GAME_OBSERVATION" as const,
    };
  }
  return {
    isBeforeFirstPitch: false,
    cutoffLabel: "LATE_OBSERVATION" as const,
    observationStatus: "LATE_OBSERVATION" as const,
  };
}

function toBatters(players: Player[]) {
  return players
    .slice()
    .sort((a, b) => a.battingOrder - b.battingOrder)
    .map((p) => ({
      battingOrder: p.battingOrder,
      displayName: p.rawPlayerName.trim(),
      position: p.position?.trim() ? p.position.trim().toUpperCase() : null,
      bats: p.bats?.trim() ? p.bats.trim().toUpperCase() : null,
      providerPlayerId: null as null,
    }));
}

function pairKey(home: string, away: string) {
  return `${home}\u0000${away}`;
}

export async function sealPregameObservations(cwd = process.cwd()) {
  const obsAbs = path.join(cwd, OBS_REL);
  const joinAbs = path.join(cwd, JOIN_REL);
  const lockAbs = path.join(cwd, LOCK_REL);
  const schedAbs = path.join(cwd, MLB_SCHEDULE_REL);
  for (const p of [obsAbs, joinAbs, lockAbs, schedAbs]) {
    if (!existsSync(p)) throw new Error(`MISSING:${p}`);
  }

  const lock = JSON.parse(readFileSync(lockAbs, "utf8")) as {
    sourceOperatorObservationHash: string;
    observedScope: { MLB: number; FOOTBALL: number; total: number };
    scopeLockedAt: string;
  };
  const obsHash = sha256File(obsAbs);
  if (obsHash !== lock.sourceOperatorObservationHash) {
    throw new Error("OPERATOR_OBSERVATION_MUTATED");
  }
  if (lock.observedScope.total !== 38) {
    throw new Error("SCOPE_SHRINK_FORBIDDEN");
  }

  const obs = JSON.parse(readFileSync(obsAbs, "utf8")) as {
    observedAt: string;
    expectedLineups: LineupCard[];
    confirmedLineups: LineupCard[];
    domesticOdds: OddsRow[];
  };
  const join = JSON.parse(readFileSync(joinAbs, "utf8")) as {
    mlb: { joins: JoinMlb[] };
  };
  const schedule = JSON.parse(readFileSync(schedAbs, "utf8")) as {
    games: ScheduleGame[];
  };
  if (schedule.games.length !== 15) {
    throw new Error(`SCHEDULE_COUNT:${schedule.games.length}`);
  }

  const pkByCanon = new Map<string, number>();
  const pkByRaw = new Map<string, number>();
  for (const sched of schedule.games) {
    pkByCanon.set(pairKey(sched.homeTeam, sched.awayTeam), sched.gamePk);
  }
  for (const row of join.mlb.joins) {
    if (row.status === "MATCHED_REGISTERED" && row.gamePk != null) {
      pkByRaw.set(pairKey(row.rawHome, row.rawAway), row.gamePk);
    }
  }

  const schedByPk = new Map(schedule.games.map((g) => [g.gamePk, g] as const));
  const expectedByPk = new Map<number, LineupCard>();
  for (const card of obs.expectedLineups) {
    if (card.lineupType !== "EXPECTED") {
      throw new Error(`EXPECTED_TYPE:${card.lineupType}`);
    }
    const gamePk = pkByCanon.get(pairKey(card.homeTeam, card.awayTeam));
    if (gamePk == null) {
      throw new Error(`EXPECTED_JOIN_FAILED:${card.awayTeam}@${card.homeTeam}`);
    }
    if (expectedByPk.has(gamePk)) {
      throw new Error(`EXPECTED_DUP:${gamePk}`);
    }
    expectedByPk.set(gamePk, card);
  }
  if (expectedByPk.size !== 13) {
    throw new Error(`EXPECTED_COUNT:${expectedByPk.size}`);
  }

  const confirmedByPk = new Map<number, LineupCard>();
  for (const card of obs.confirmedLineups) {
    if (card.lineupType !== "CONFIRMED") {
      throw new Error(`CONFIRMED_TYPE:${card.lineupType}`);
    }
    if (card.officialLineup) {
      throw new Error("CONFIRMED_MARKED_OFFICIAL");
    }
    const gamePk = pkByCanon.get(pairKey(card.homeTeam, card.awayTeam));
    if (gamePk == null) {
      throw new Error(`CONFIRMED_JOIN_FAILED:${card.awayTeam}@${card.homeTeam}`);
    }
    if (confirmedByPk.has(gamePk)) {
      throw new Error(`CONFIRMED_DUP:${gamePk}`);
    }
    confirmedByPk.set(gamePk, card);
  }
  if (confirmedByPk.size !== 3) {
    throw new Error(`CONFIRMED_COUNT:${confirmedByPk.size}`);
  }

  const expectedGames: MlbExpectedLineupGameV0[] = [];
  for (const sched of schedule.games) {
    const firstPitchAt =
      sched.commenceTimeUtc ?? sched.scheduledStartTime ?? null;
    const card = expectedByPk.get(sched.gamePk);
    if (!card) {
      expectedGames.push({
        gamePk: sched.gamePk,
        internalGameId: sched.internalGameId,
        awayTeam: sched.awayTeam,
        homeTeam: sched.homeTeam,
        firstPitchAt,
        joinStatus: "MATCHED",
        lineupStatus: "EXPECTED",
        observationStatus: "NOT_OBSERVED",
        awayLineup: [],
        homeLineup: [],
        observedAt: null,
        isBeforeFirstPitch: null,
        cutoffLabel: null,
      });
      continue;
    }
    const observedAt = toUtcIso(card.operatorObservedAt);
    const cut = cutoff(observedAt, firstPitchAt);
    if (cut.cutoffLabel === "LATE_OBSERVATION") {
      throw new Error(`EXPECTED_LATE:${sched.gamePk}`);
    }
    const awayLineup = toBatters(card.awayLineup);
    const homeLineup = toBatters(card.homeLineup);
    if (card.completeness === "FULL") {
      if (awayLineup.length !== 9 || homeLineup.length !== 9) {
        throw new Error(`EXPECTED_FULL_SLOT_MISMATCH:${sched.gamePk}`);
      }
    }
    expectedGames.push({
      gamePk: sched.gamePk,
      internalGameId: sched.internalGameId,
      awayTeam: sched.awayTeam,
      homeTeam: sched.homeTeam,
      firstPitchAt,
      joinStatus: "MATCHED",
      lineupStatus: "EXPECTED",
      observationStatus: "OBSERVED",
      awayLineup,
      homeLineup,
      observedAt,
      isBeforeFirstPitch: cut.isBeforeFirstPitch,
      cutoffLabel: cut.cutoffLabel,
    });
  }
  expectedGames.sort((a, b) => a.gamePk - b.gamePk);
  if (expectedGames.some((g) => g.lineupStatus !== "EXPECTED")) {
    throw new Error("EXPECTED_PROMOTED");
  }

  const expectedDoc: MlbExpectedLineupObservationV0 = {
    schemaVersion: "mlb-expected-lineup-observation-v0",
    dateKst: DATE_KST,
    league: "MLB",
    observationType: "EXPECTED_LINEUP",
    sourceType: "MANUAL_OBSERVATION",
    sourceLabel: "수동 관찰 · EXPECTED LINEUP · MANUAL_OBSERVATION",
    lineupStatus: "EXPECTED",
    observedAt: obs.observedAt,
    enteredBy: "OPERATOR",
    note: "Derived from sealed 2026-08-20/batch-0008 screenshots. EXPECTED only — not CONFIRMED/OFFICIAL. CWS@CHC keeps CHC expected slots only; CWS confirmed slots were not copied here. DET@PIT and SD@NYM have no expected card. Does not mutate Prediction / lineup-dataset-v1.",
    expectedLineupHash: computeExpectedLineupHash(expectedGames),
    games: expectedGames,
    summary: (() => {
      let matchedGames = 0;
      let teamLineups = 0;
      let expectedBattingSlots = 0;
      let expectedGamesCount = 0;
      let missingGames = 0;
      let preGameObservations = 0;
      let lateObservations = 0;
      for (const g of expectedGames) {
        if (g.joinStatus === "MATCHED") matchedGames++;
        if (g.observationStatus === "OBSERVED") {
          expectedGamesCount++;
          if (g.cutoffLabel === "PRE_GAME_OBSERVATION") preGameObservations++;
          if (g.cutoffLabel === "LATE_OBSERVATION") lateObservations++;
          if (g.awayLineup.length === 9) {
            teamLineups++;
            expectedBattingSlots += 9;
          }
          if (g.homeLineup.length === 9) {
            teamLineups++;
            expectedBattingSlots += 9;
          }
        } else {
          missingGames++;
        }
      }
      return {
        scheduleGames: 15,
        matchedGames,
        teamLineups,
        expectedBattingSlots,
        expectedGames: expectedGamesCount,
        confirmedGames: 0,
        missingGames,
        preGameObservations,
        lateObservations,
        joinErrors: 0,
      };
    })(),
  };

  const confirmedGames = [...confirmedByPk.entries()]
    .map(([gamePk, card]) => {
      const sched = schedByPk.get(gamePk);
      if (!sched) throw new Error(`CONFIRMED_NOT_IN_SCHEDULE:${gamePk}`);
      const firstPitchAt =
        sched.commenceTimeUtc ?? sched.scheduledStartTime ?? null;
      const observedAt = toUtcIso(card.operatorObservedAt);
      const cut = cutoff(observedAt, firstPitchAt);
      if (cut.cutoffLabel !== "PRE_GAME_OBSERVATION") {
        throw new Error(`CONFIRMED_NOT_PREGAME:${gamePk}:${cut.cutoffLabel}`);
      }
      return {
        gamePk,
        internalGameId: sched.internalGameId,
        awayTeam: sched.awayTeam,
        homeTeam: sched.homeTeam,
        firstPitchAt,
        joinStatus: "MATCHED" as const,
        lineupStatus: "CONFIRMED" as const,
        completeness: card.completeness,
        confirmedSides: card.confirmedSides ?? [],
        expectedSides: card.expectedSides ?? [],
        officialLineup: false,
        sourceType: "MANUAL_OBSERVATION" as const,
        observationStatus: "OBSERVED" as const,
        awayLineup: toBatters(card.awayLineup),
        homeLineup: toBatters(card.homeLineup),
        observedAt,
        isBeforeFirstPitch: cut.isBeforeFirstPitch,
        cutoffLabel: cut.cutoffLabel,
        screenshotSha256: card.screenshotSha256,
        screenshotRel: card.screenshotRel,
      };
    })
    .sort((a, b) => a.gamePk - b.gamePk);

  const cubs = confirmedGames.find((g) => g.gamePk === 824640);
  if (!cubs || cubs.completeness !== "PARTIAL" || cubs.homeLineup.length !== 0) {
    throw new Error("CWS_CHC_PARTIAL_CONTRACT");
  }
  if (cubs.awayLineup.length !== 9) {
    throw new Error("CWS_CONFIRMED_SLOT_COUNT");
  }
  const fullConfirmed = confirmedGames.filter((g) => g.completeness === "FULL");
  if (fullConfirmed.length !== 2) {
    throw new Error(`CONFIRMED_FULL:${fullConfirmed.length}`);
  }
  for (const g of fullConfirmed) {
    if (g.awayLineup.length !== 9 || g.homeLineup.length !== 9) {
      throw new Error(`CONFIRMED_FULL_SLOTS:${g.gamePk}`);
    }
  }

  const confirmedDoc = {
    schemaVersion: "mlb-confirmed-lineup-observation-v0",
    dateKst: DATE_KST,
    league: "MLB",
    observationType: "CONFIRMED_LINEUP",
    sourceType: "MANUAL_OBSERVATION",
    sourceLabel: "수동 관찰 · CONFIRMED LINEUP · MANUAL_OBSERVATION",
    lineupStatus: "CONFIRMED",
    officialLineup: false,
    predictionInput: false,
    observedAt: "2026-08-19T15:08:25.000Z",
    enteredBy: "OPERATOR",
    note: "Derived from sealed 2026-08-20/batch-0008 screenshot 000825. MANUAL_OBSERVATION only — not Official Provider Confirmed. CWS@CHC remains PARTIAL (CWS confirmed / CHC expected not copied). Does not mutate lineup-dataset-v1 / Prediction.",
    confirmedLineupHash: sha256Text(
      JSON.stringify(
        confirmedGames.map((g) => ({
          gamePk: g.gamePk,
          completeness: g.completeness,
          away: g.awayLineup,
          home: g.homeLineup,
        })),
      ),
    ),
    games: confirmedGames,
    summary: {
      scheduleGames: 15,
      observedGames: 3,
      fullGames: 2,
      partialGames: 1,
      officialPromotion: 0,
      preGameObservations: 3,
      lateObservations: 0,
      confirmedPlayerSlots:
        confirmedGames.reduce(
          (n, g) => n + g.awayLineup.length + g.homeLineup.length,
          0,
        ),
    },
  };

  const mlbOdds = obs.domesticOdds.filter((r) => r.sport === "MLB");
  if (mlbOdds.length !== 15) {
    throw new Error(`KOREAN_OBS_COUNT:${mlbOdds.length}`);
  }

  const koreanMatched: MlbKoreanMarketOddsGameV0[] = [];
  const identityBlocked: Array<{
    rawHomeLabel: string;
    rawAwayLabel: string;
    rawMatchup: string;
    identityStatus: string;
    mappingStatus: string;
    gamePk: null;
    canonicalHome: string | null;
    canonicalAway: string | null;
    homeOdds: number;
    awayOdds: number;
    observedAt: string;
    observationStatus: string;
    screenshotSha256: string;
  }> = [];

  for (const row of mlbOdds) {
    const ml = row.markets.find((m) => m.marketType === "MONEYLINE_2WAY");
    if (!ml || ml.homePrice == null || ml.awayPrice == null) {
      throw new Error(`MONEYLINE_MISSING:${row.rawMatchup}`);
    }
    const observedAt = toUtcIso(row.operatorObservedAt);
    const gamePk = pkByRaw.get(pairKey(row.rawHomeLabel, row.rawAwayLabel));
    if (gamePk == null) {
      if (row.identityStatus !== "JOIN_FAILED") {
        throw new Error(`BLOCKED_STATUS:${row.rawMatchup}:${row.identityStatus}`);
      }
      identityBlocked.push({
        rawHomeLabel: row.rawHomeLabel,
        rawAwayLabel: row.rawAwayLabel,
        rawMatchup: row.rawMatchup,
        identityStatus: "IDENTITY_BLOCKED",
        mappingStatus: row.mappingStatus,
        gamePk: null,
        canonicalHome: row.canonicalHome,
        canonicalAway: row.canonicalAway,
        homeOdds: ml.homePrice,
        awayOdds: ml.awayPrice,
        observedAt,
        observationStatus: "PRE_GAME_OBSERVATION",
        screenshotSha256: row.screenshotSha256,
      });
      continue;
    }
    const sched = schedByPk.get(gamePk);
    if (!sched) throw new Error(`KOREAN_NOT_IN_SCHEDULE:${gamePk}`);
    const firstPitchAt =
      sched.commenceTimeUtc ?? sched.scheduledStartTime ?? null;
    const cut = cutoff(observedAt, firstPitchAt);
    if (cut.observationStatus !== "PRE_GAME_OBSERVATION") {
      throw new Error(`KOREAN_NOT_PREGAME:${gamePk}`);
    }
    const implied = normalizeImpliedPair(ml.awayPrice, ml.homePrice);
    koreanMatched.push({
      gamePk,
      internalGameId: sched.internalGameId,
      awayTeam: sched.awayTeam,
      homeTeam: sched.homeTeam,
      awayOdds: ml.awayPrice,
      homeOdds: ml.homePrice,
      awayImpliedProbability: implied.away,
      homeImpliedProbability: implied.home,
      firstPitchAt,
      observedAt,
      isBeforeFirstPitch: cut.isBeforeFirstPitch,
      joinStatus: "MATCHED",
      observationStatus: cut.observationStatus,
    });
  }
  if (koreanMatched.length !== 13 || identityBlocked.length !== 2) {
    throw new Error(
      `KOREAN_SPLIT:${koreanMatched.length}/${identityBlocked.length}`,
    );
  }
  const blockedLabels = identityBlocked.map((r) => r.rawHomeLabel).sort();
  if (blockedLabels.join(",") !== "캔자로알,템파레이") {
    throw new Error(`BLOCKED_LABELS:${blockedLabels.join(",")}`);
  }

  const koreanGames: MlbKoreanMarketOddsGameV0[] = [];
  const matchedByPk = new Map(koreanMatched.map((g) => [g.gamePk, g] as const));
  for (const sched of schedule.games) {
    const hit = matchedByPk.get(sched.gamePk);
    const firstPitchAt =
      sched.commenceTimeUtc ?? sched.scheduledStartTime ?? null;
    if (hit) {
      koreanGames.push(hit);
      continue;
    }
    koreanGames.push({
      gamePk: sched.gamePk,
      internalGameId: sched.internalGameId,
      awayTeam: sched.awayTeam,
      homeTeam: sched.homeTeam,
      awayOdds: null,
      homeOdds: null,
      awayImpliedProbability: null,
      homeImpliedProbability: null,
      firstPitchAt,
      observedAt: null,
      isBeforeFirstPitch: null,
      joinStatus: "NOT_MATCHED",
      observationStatus: null,
    });
  }
  koreanGames.sort((a, b) => a.gamePk - b.gamePk);

  const koreanDoc: MlbKoreanMarketOddsObservationV0 & {
    identityBlockedObservations: typeof identityBlocked;
    accountedObservations: number;
  } = {
    schemaVersion: "mlb-korean-market-odds-observation-v0",
    dateKst: DATE_KST,
    league: "MLB",
    sourceType: "MANUAL_OBSERVATION",
    marketContext: "KOREAN_MARKET",
    marketType: "MONEYLINE",
    sourceLabel:
      "수동 관찰 · KOREAN_MARKET · MONEYLINE · MANUAL_OBSERVATION",
    observedAt: obs.observedAt,
    enteredBy: "OPERATOR",
    note: "Derived from sealed 2026-08-20/batch-0008 screenshots. 13 MATCHED + 2 IDENTITY_BLOCKED (템파레이, 캔자로알). English lineup gamePk was not used to auto-join blocked Korean labels. Independent from Provider odds. Does not mutate Prediction / odds-history-dataset-v1.",
    koreanMarketOddsHash: computeKoreanMarketOddsHash(koreanGames),
    games: koreanGames,
    identityBlockedObservations: identityBlocked,
    accountedObservations: 15,
    summary: {
      scheduleGames: 15,
      matchedGames: 13,
      observedGames: 13,
      missingGames: 0,
      lateGames: 0,
      joinReviewRequired: 0,
      preGameObservations: 13,
    },
  };

  if (sha256File(obsAbs) !== obsHash) {
    throw new Error("OPERATOR_OBSERVATION_WRITTEN");
  }

  for (const [rel, doc] of [
    [EXPECTED_REL, expectedDoc],
    [CONFIRMED_REL, confirmedDoc],
    [KOREAN_REL, koreanDoc],
  ] as const) {
    const abs = path.join(cwd, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  }

  if (sha256File(obsAbs) !== obsHash) {
    throw new Error("OPERATOR_OBSERVATION_WRITTEN");
  }

  return {
    expectedRel: EXPECTED_REL,
    confirmedRel: CONFIRMED_REL,
    koreanRel: KOREAN_REL,
    expected: expectedDoc.summary,
    confirmed: confirmedDoc.summary,
    korean: {
      matched: koreanDoc.summary.matchedGames,
      identityBlocked: identityBlocked.length,
      accounted: 15,
    },
  };
}

async function main() {
  const result = await sealPregameObservations();
  console.log(
    [
      `expected=${result.expectedRel} observed=${result.expected.expectedGames} slots=${result.expected.expectedBattingSlots} confirmed=${result.expected.confirmedGames}`,
      `confirmed=${result.confirmedRel} games=${result.confirmed.observedGames} full=${result.confirmed.fullGames} partial=${result.confirmed.partialGames}`,
      `korean=${result.koreanRel} matched=${result.korean.matched} blocked=${result.korean.identityBlocked} accounted=${result.korean.accounted}`,
    ].join("\n"),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
