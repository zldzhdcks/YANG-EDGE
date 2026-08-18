/**
 * Seal 2026-08-19 MLB Expected Lineup + Korean Market Moneyline
 * from already-sealed operator screenshot evidence.
 *
 * Does not mutate screenshots, schedules, or the daily scope lock.
 * Does not run Prediction / Snapshot / Engine.
 *
 *   npx tsx scripts/seal-2026-08-19-pregame-observations-v1.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  saveMlbExpectedLineupObservation,
  type MlbExpectedLineupDraftGame,
} from "../src/lib/mlb/expected-lineup-observation-v0";
import {
  saveMlbKoreanMarketOddsObservation,
  type MlbKoreanMarketOddsDraftGame,
} from "../src/lib/mlb/korean-market-odds-observation-v0";

export const DATE_KST = "2026-08-19";
export const OBS_REL =
  "data/operator-observations/structured/2026-08-18/batch-2253-next-pregame-v0.json";
export const JOIN_REL = "data/audits/2026-08-19-operator-scope-join-v1.json";
export const LOCK_REL = "data/audits/2026-08-19-daily-scope-lock-v1.json";
export const OBSERVED_AT_UTC = "2026-08-18T13:53:44.000Z";

type JoinRow = {
  rawHome: string;
  rawAway: string;
  canonicalHome?: string;
  canonicalAway?: string;
  status: string;
  gamePk: number | null;
};

type LineupPlayer = {
  battingOrder: number;
  rawPlayerName: string;
  position: string | null;
  bats: string | null;
};

function sha256File(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

export async function sealPregameObservations(cwd = process.cwd()) {
  const obsAbs = path.join(cwd, OBS_REL);
  const joinAbs = path.join(cwd, JOIN_REL);
  const lockAbs = path.join(cwd, LOCK_REL);
  for (const p of [obsAbs, joinAbs, lockAbs]) {
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
  if (lock.observedScope.total !== 21) {
    throw new Error("SCOPE_SHRINK_FORBIDDEN");
  }

  const obs = JSON.parse(readFileSync(obsAbs, "utf8")) as {
    observedAt: string;
    domesticOdds: Array<{
      rawHomeLabel: string;
      rawAwayLabel: string;
      canonicalHome: string;
      canonicalAway: string;
      markets: Array<{
        marketType: string;
        homePrice: number | null;
        awayPrice: number | null;
        screenshotSha256?: string;
        sourceScreenshotSha?: string;
      }>;
    }>;
    expectedLineups: Array<{
      homeTeam: string;
      awayTeam: string;
      lineupType: string;
      awayLineup: LineupPlayer[];
      homeLineup: LineupPlayer[];
    }>;
  };
  if (obs.observedAt !== OBSERVED_AT_UTC) {
    throw new Error(`OBSERVED_AT_MISMATCH:${obs.observedAt}`);
  }

  const join = JSON.parse(readFileSync(joinAbs, "utf8")) as {
    mlb: { joins: JoinRow[] };
  };
  const mlbJoins = join.mlb.joins.filter((r) => r.status === "MATCHED_REGISTERED");
  if (mlbJoins.length !== 15) {
    throw new Error(`JOIN_COUNT:${mlbJoins.length}`);
  }
  const pks = mlbJoins.map((r) => r.gamePk);
  if (pks.some((pk) => pk == null) || new Set(pks).size !== 15) {
    throw new Error("GAMEPK_NOT_UNIQUE");
  }

  const pkByCanon = new Map<string, number>();
  const pkByRaw = new Map<string, number>();
  for (const row of mlbJoins) {
    if (row.gamePk == null || !row.canonicalHome || !row.canonicalAway) {
      throw new Error("JOIN_ROW_INCOMPLETE");
    }
    pkByCanon.set(`${row.canonicalHome}\u0000${row.canonicalAway}`, row.gamePk);
    pkByRaw.set(`${row.rawHome}\u0000${row.rawAway}`, row.gamePk);
  }

  const lineupDrafts: MlbExpectedLineupDraftGame[] = obs.expectedLineups.map(
    (g) => {
      if (g.lineupType !== "EXPECTED") {
        throw new Error(`LINEUP_TYPE:${g.lineupType}`);
      }
      const gamePk = pkByCanon.get(`${g.homeTeam}\u0000${g.awayTeam}`);
      if (gamePk == null) {
        throw new Error(`LINEUP_JOIN_FAILED:${g.awayTeam}@${g.homeTeam}`);
      }
      return {
        gamePk,
        awayLineup: g.awayLineup.map((p) => ({
          battingOrder: p.battingOrder,
          displayName: p.rawPlayerName,
          position: p.position,
          bats: p.bats,
        })),
        homeLineup: g.homeLineup.map((p) => ({
          battingOrder: p.battingOrder,
          displayName: p.rawPlayerName,
          position: p.position,
          bats: p.bats,
        })),
      };
    },
  );
  if (lineupDrafts.length !== 15) {
    throw new Error(`LINEUP_DRAFTS:${lineupDrafts.length}`);
  }

  const koreanDrafts: MlbKoreanMarketOddsDraftGame[] = obs.domesticOdds.map(
    (g) => {
      const gamePk = pkByRaw.get(`${g.rawHomeLabel}\u0000${g.rawAwayLabel}`);
      if (gamePk == null) {
        throw new Error(`ODDS_JOIN_FAILED:${g.rawHomeLabel}:${g.rawAwayLabel}`);
      }
      const ml = g.markets.find((m) => m.marketType === "MONEYLINE_2WAY");
      if (!ml || ml.homePrice == null || ml.awayPrice == null) {
        throw new Error(`MONEYLINE_MISSING:${g.rawHomeLabel}:${g.rawAwayLabel}`);
      }
      return {
        gamePk,
        homeOdds: ml.homePrice,
        awayOdds: ml.awayPrice,
      };
    },
  );
  if (koreanDrafts.length !== 15) {
    throw new Error(`KOREAN_DRAFTS:${koreanDrafts.length}`);
  }

  const lineup = await saveMlbExpectedLineupObservation({
    dateKst: DATE_KST,
    cwd,
    observedAt: OBSERVED_AT_UTC,
    sourceLabel: "수동 관찰 · EXPECTED LINEUP · MANUAL_OBSERVATION",
    note:
      "Derived from sealed 2026-08-18/batch-2253 screenshots. observedAt is screenshot received time 2026-08-18T22:53:44+09:00, not artifact generation time. EXPECTED only — not CONFIRMED/OFFICIAL. Does not mutate Prediction / lineup-dataset-v1.",
    drafts: lineupDrafts,
    allowLate: false,
  });
  if (!lineup.ok || !lineup.document) {
    throw new Error(`EXPECTED_LINEUP_SAVE_FAILED:${lineup.errors.join(";")}`);
  }

  const korean = await saveMlbKoreanMarketOddsObservation({
    dateKst: DATE_KST,
    cwd,
    observedAt: OBSERVED_AT_UTC,
    note:
      "Derived from sealed 2026-08-18/batch-2253 screenshots. observedAt is screenshot received time 2026-08-18T22:53:44+09:00, not artifact generation time. MONEYLINE only. Independent from Provider odds. Does not mutate Prediction / odds-history-dataset-v1.",
    drafts: koreanDrafts,
    allowLate: false,
  });
  if (!korean.ok || !korean.document) {
    throw new Error(`KOREAN_SAVE_FAILED:${korean.errors.join(";")}`);
  }

  if (sha256File(obsAbs) !== obsHash) {
    throw new Error("OPERATOR_OBSERVATION_WRITTEN");
  }

  return {
    observedAt: OBSERVED_AT_UTC,
    scopeLockedAt: lock.scopeLockedAt,
    lineup,
    korean,
  };
}

async function main() {
  const result = await sealPregameObservations();
  console.log(
    [
      `observedAt=${result.observedAt}`,
      `expectedLineup=${result.lineup.pathRel}`,
      `lineupMatched=${result.lineup.document?.summary.matchedGames}`,
      `slots=${result.lineup.document?.summary.expectedBattingSlots}`,
      `confirmed=${result.lineup.document?.summary.confirmedGames}`,
      `korean=${result.korean.pathRel}`,
      `koreanObserved=${result.korean.document?.summary.observedGames}`,
      `koreanPregame=${result.korean.document?.summary.preGameObservations}`,
      `late=${result.korean.document?.summary.lateGames}`,
    ].join(" "),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
