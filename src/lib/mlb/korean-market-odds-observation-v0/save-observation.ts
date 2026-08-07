/**
 * Save / load MLB Korean Market Odds Observation v0.
 * Never touches Provider odds / Prediction / Recommendation / Engine.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadMlbScheduleArtifact } from "@/lib/mlb/build-mlb-schedule-artifact";
import { asNumber, asRecord, asString } from "@/lib/mlb/mlb-review-utils";
import { mlbKoreanMarketOddsObservationRel } from "./paths";
import {
  normalizeImpliedPair,
  parseDecimalOdds,
} from "./validate-odds";
import type {
  MlbKoreanMarketOddsDraftGame,
  MlbKoreanMarketOddsGameV0,
  MlbKoreanMarketOddsObservationV0,
  MlbKoreanMarketPanelV0,
  MlbKoreanObservationStatus,
  MlbProviderMarketPanelV0,
} from "./types";
import { MLB_KOREAN_MARKET_ODDS_OBSERVATION_SCHEMA } from "./types";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function asFiniteMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function cutoffFor(input: {
  observedAt: string;
  firstPitchAt: string | null;
}): {
  isBeforeFirstPitch: boolean | null;
  observationStatus: MlbKoreanObservationStatus;
} {
  const o = asFiniteMs(input.observedAt);
  const f = asFiniteMs(input.firstPitchAt);
  if (o == null || f == null) {
    return { isBeforeFirstPitch: null, observationStatus: "UNKNOWN" };
  }
  if (o < f) {
    return {
      isBeforeFirstPitch: true,
      observationStatus: "PRE_GAME_OBSERVATION",
    };
  }
  return {
    isBeforeFirstPitch: false,
    observationStatus: "LATE_OBSERVATION",
  };
}

function summarize(
  games: MlbKoreanMarketOddsGameV0[],
  scheduleGames: number,
): MlbKoreanMarketOddsObservationV0["summary"] {
  let matchedGames = 0;
  let observedGames = 0;
  let missingGames = 0;
  let lateGames = 0;
  let joinReviewRequired = 0;
  let preGameObservations = 0;

  for (const g of games) {
    if (g.joinStatus === "MATCHED") matchedGames++;
    if (g.joinStatus === "JOIN_REVIEW_REQUIRED") joinReviewRequired++;
    if (g.observationStatus === "LATE_OBSERVATION") lateGames++;
    if (
      g.joinStatus === "MATCHED" &&
      g.awayOdds != null &&
      g.homeOdds != null
    ) {
      observedGames++;
      if (g.observationStatus === "PRE_GAME_OBSERVATION") {
        preGameObservations++;
      }
    } else if (g.joinStatus === "MATCHED") {
      missingGames++;
    }
  }

  return {
    scheduleGames,
    matchedGames,
    observedGames,
    missingGames,
    lateGames,
    joinReviewRequired,
    preGameObservations,
  };
}

export function computeKoreanMarketOddsHash(
  games: MlbKoreanMarketOddsGameV0[],
): string {
  return sha256(
    JSON.stringify(
      games.map((g) => ({
        gamePk: g.gamePk,
        awayOdds: g.awayOdds,
        homeOdds: g.homeOdds,
        joinStatus: g.joinStatus,
        observationStatus: g.observationStatus,
      })),
    ),
  );
}

export async function loadMlbKoreanMarketOddsObservation(input: {
  dateKst: string;
  cwd?: string;
}): Promise<MlbKoreanMarketOddsObservationV0 | null> {
  const cwd = input.cwd ?? process.cwd();
  const abs = path.join(cwd, mlbKoreanMarketOddsObservationRel(input.dateKst));
  try {
    const raw = JSON.parse(await readFile(abs, "utf8")) as unknown;
    const rec = asRecord(raw);
    if (
      !rec ||
      asString(rec.schemaVersion) !== MLB_KOREAN_MARKET_ODDS_OBSERVATION_SCHEMA
    ) {
      return null;
    }
    return raw as MlbKoreanMarketOddsObservationV0;
  } catch {
    return null;
  }
}

export async function loadMlbKoreanMarketPanelForGame(input: {
  dateKst: string;
  gamePk: number;
  cwd?: string;
}): Promise<MlbKoreanMarketPanelV0> {
  const doc = await loadMlbKoreanMarketOddsObservation(input);
  const game = doc?.games.find((g) => g.gamePk === input.gamePk) ?? null;
  if (
    !game ||
    game.awayOdds == null ||
    game.homeOdds == null ||
    game.joinStatus !== "MATCHED"
  ) {
    return {
      available: false,
      sourceLabel: "Operator Observation · KOREAN_MARKET",
      marketContext: "KOREAN_MARKET",
      observationStatus: null,
      awayTeam: game?.awayTeam ?? "",
      homeTeam: game?.homeTeam ?? "",
      awayOdds: null,
      homeOdds: null,
      awayImpliedProbability: null,
      homeImpliedProbability: null,
    };
  }
  return {
    available: true,
    sourceLabel: "Operator Observation · KOREAN_MARKET · MANUAL_OBSERVATION",
    marketContext: "KOREAN_MARKET",
    observationStatus: game.observationStatus,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    awayOdds: game.awayOdds,
    homeOdds: game.homeOdds,
    awayImpliedProbability: game.awayImpliedProbability,
    homeImpliedProbability: game.homeImpliedProbability,
  };
}

/** Read Provider moneyline decimals from odds-history dataset (presentation). */
export function readProviderMarketPanelFromOddsHistory(
  oddsHistoryRaw: unknown,
  gamePk: number,
  awayTeam: string,
  homeTeam: string,
  internalGameId?: string | null,
): MlbProviderMarketPanelV0 {
  const empty: MlbProviderMarketPanelV0 = {
    available: false,
    sourceLabel: "Provider Market · odds-history-dataset-v1",
    awayTeam,
    homeTeam,
    awayOdds: null,
    homeOdds: null,
    awayImpliedProbability: null,
    homeImpliedProbability: null,
  };
  const doc = asRecord(oddsHistoryRaw);
  const rows = Array.isArray(doc?.rows) ? doc!.rows : [];

  let matched: Record<string, unknown> | null = null;
  for (const raw of rows) {
    const row = asRecord(raw);
    if (!row) continue;
    if (asNumber(row.gamePk) === gamePk) {
      matched = row;
      break;
    }
    if (
      internalGameId &&
      (asString(row.internalGameId) === internalGameId ||
        asString(row.gameId) === internalGameId)
    ) {
      matched = row;
      break;
    }
    if (
      asString(row.awayTeam) === awayTeam &&
      asString(row.homeTeam) === homeTeam
    ) {
      matched = row;
      break;
    }
  }
  if (!matched) return empty;

  let awayOdds: number | null = null;
  let homeOdds: number | null = null;
  const markets = Array.isArray(matched.markets) ? matched.markets : [];
  for (const mRaw of markets) {
    const m = asRecord(mRaw);
    if (!m || asString(m.marketType) !== "moneyline") continue;
    const sel = asString(m.selection)?.toLowerCase();
    const price = asNumber(m.priceDecimal);
    if (sel === "away" && price != null) awayOdds = price;
    if (sel === "home" && price != null) homeOdds = price;
  }

  if (awayOdds == null || homeOdds == null || !(awayOdds > 1) || !(homeOdds > 1)) {
    return empty;
  }
  const implied = normalizeImpliedPair(awayOdds, homeOdds);
  return {
    available: true,
    sourceLabel: "Provider Market · odds-history-dataset-v1",
    awayTeam,
    homeTeam,
    awayOdds,
    homeOdds,
    awayImpliedProbability: implied.away,
    homeImpliedProbability: implied.home,
  };
}

/**
 * Save Korean market moneyline observation.
 * Rejects JOIN_REVIEW_REQUIRED drafts, invalid odds, and (by default) late rows.
 */
export async function saveMlbKoreanMarketOddsObservation(input: {
  dateKst: string;
  cwd?: string;
  sourceLabel?: string;
  observedAt?: string;
  drafts: MlbKoreanMarketOddsDraftGame[];
  allowLate?: boolean;
  note?: string;
}): Promise<{
  ok: boolean;
  pathRel: string;
  document: MlbKoreanMarketOddsObservationV0 | null;
  errors: string[];
}> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const observedAt = input.observedAt ?? new Date().toISOString();
  const pathRel = mlbKoreanMarketOddsObservationRel(dateKst);
  const errors: string[] = [];

  let schedule;
  try {
    schedule = await loadMlbScheduleArtifact(dateKst, cwd);
  } catch (e) {
    return {
      ok: false,
      pathRel,
      document: null,
      errors: [`SCHEDULE_MISSING:${String(e)}`],
    };
  }

  const byPk = new Map(schedule.games.map((g) => [g.gamePk, g] as const));
  const draftByPk = new Map(input.drafts.map((d) => [d.gamePk, d] as const));
  const games: MlbKoreanMarketOddsGameV0[] = [];

  for (const sched of schedule.games) {
    const draft = draftByPk.get(sched.gamePk);
    const firstPitchAt =
      sched.commenceTimeUtc ?? sched.scheduledStartTime ?? null;

    if (!draft) {
      errors.push(`MISSING_DRAFT:${sched.gamePk}`);
      continue;
    }

    if (draft.joinReviewRequired) {
      errors.push(`JOIN_REVIEW_REQUIRED:${sched.gamePk}`);
      continue;
    }

    const awayParsed = parseDecimalOdds(draft.awayOdds);
    const homeParsed = parseDecimalOdds(draft.homeOdds);
    if (!awayParsed.ok) {
      errors.push(`AWAY_ODDS:${sched.gamePk}:${awayParsed.error}`);
    }
    if (!homeParsed.ok) {
      errors.push(`HOME_ODDS:${sched.gamePk}:${homeParsed.error}`);
    }
    if (!awayParsed.ok || !homeParsed.ok) continue;

    const cutoff = cutoffFor({ observedAt, firstPitchAt });
    if (cutoff.observationStatus === "LATE_OBSERVATION" && !input.allowLate) {
      errors.push(`LATE_OBSERVATION_BLOCKED:${sched.gamePk}`);
      continue;
    }

    const implied = normalizeImpliedPair(awayParsed.value!, homeParsed.value!);
    games.push({
      gamePk: sched.gamePk,
      internalGameId: sched.internalGameId,
      awayTeam: sched.awayTeam,
      homeTeam: sched.homeTeam,
      awayOdds: awayParsed.value,
      homeOdds: homeParsed.value,
      awayImpliedProbability: implied.away,
      homeImpliedProbability: implied.home,
      firstPitchAt,
      observedAt,
      isBeforeFirstPitch: cutoff.isBeforeFirstPitch,
      joinStatus: "MATCHED",
      observationStatus: cutoff.observationStatus,
    });
  }

  for (const draft of input.drafts) {
    if (!byPk.has(draft.gamePk)) {
      errors.push(`NOT_MATCHED:${draft.gamePk}`);
    }
  }

  if (errors.length) {
    return { ok: false, pathRel, document: null, errors };
  }

  // Do not force 15/15 — require every schedule game observed as MATCHED
  if (games.length !== schedule.games.length) {
    return {
      ok: false,
      pathRel,
      document: null,
      errors: [
        `INCOMPLETE_SLATE:got_${games.length}_expected_${schedule.games.length}`,
      ],
    };
  }

  games.sort((a, b) => a.gamePk - b.gamePk);
  const koreanMarketOddsHash = computeKoreanMarketOddsHash(games);
  const document: MlbKoreanMarketOddsObservationV0 = {
    schemaVersion: MLB_KOREAN_MARKET_ODDS_OBSERVATION_SCHEMA,
    dateKst,
    league: "MLB",
    sourceType: "MANUAL_OBSERVATION",
    marketContext: "KOREAN_MARKET",
    marketType: "MONEYLINE",
    sourceLabel:
      input.sourceLabel ??
      "수동 관찰 · KOREAN_MARKET · MONEYLINE · MANUAL_OBSERVATION",
    observedAt,
    enteredBy: "OPERATOR",
    note:
      input.note ??
      "PREGAME KOREAN MARKET MONEYLINE OBSERVATION — independent from Provider odds. Not Model Probability. Does not mutate Prediction / Recommendation / odds-history-dataset-v1.",
    koreanMarketOddsHash,
    games,
    summary: summarize(games, schedule.games.length),
  };

  const abs = path.join(cwd, pathRel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  return { ok: true, pathRel, document, errors: [] };
}

export async function loadMlbKoreanMarketOddsIntakeView(input: {
  dateKst: string;
  cwd?: string;
}): Promise<{
  dateKst: string;
  scheduleExists: boolean;
  observationPath: string;
  sourceBanner: string;
  games: Array<{
    gamePk: number;
    awayTeam: string;
    homeTeam: string;
    firstPitchAt: string | null;
    awayOdds: number | null;
    homeOdds: number | null;
    joinStatus: string;
    observationStatus: string | null;
    isBeforeFirstPitch: boolean | null;
  }>;
  summary: MlbKoreanMarketOddsObservationV0["summary"] | null;
}> {
  const cwd = input.cwd ?? process.cwd();
  const observationPath = mlbKoreanMarketOddsObservationRel(input.dateKst);
  let scheduleExists = true;
  let scheduleGames: Array<{
    gamePk: number;
    awayTeam: string;
    homeTeam: string;
    firstPitchAt: string | null;
  }> = [];
  try {
    const schedule = await loadMlbScheduleArtifact(input.dateKst, cwd);
    scheduleGames = schedule.games.map((g) => ({
      gamePk: g.gamePk,
      awayTeam: g.awayTeam,
      homeTeam: g.homeTeam,
      firstPitchAt: g.commenceTimeUtc ?? g.scheduledStartTime ?? null,
    }));
  } catch {
    scheduleExists = false;
  }

  const existing = await loadMlbKoreanMarketOddsObservation(input);
  const byPk = new Map((existing?.games ?? []).map((g) => [g.gamePk, g]));

  return {
    dateKst: input.dateKst,
    scheduleExists,
    observationPath,
    sourceBanner:
      "MANUAL_OBSERVATION · KOREAN_MARKET · MONEYLINE (Provider Odds와 별도)",
    games: scheduleGames.map((g) => {
      const row = byPk.get(g.gamePk);
      return {
        gamePk: g.gamePk,
        awayTeam: g.awayTeam,
        homeTeam: g.homeTeam,
        firstPitchAt: g.firstPitchAt,
        awayOdds: row?.awayOdds ?? null,
        homeOdds: row?.homeOdds ?? null,
        joinStatus: row?.joinStatus ?? "MATCHED",
        observationStatus: row?.observationStatus ?? null,
        isBeforeFirstPitch: row?.isBeforeFirstPitch ?? null,
      };
    }),
    summary: existing?.summary ?? null,
  };
}
