/**
 * Football Market Baseline Prediction v0.
 * Consumes Prediction Snapshot v0 only. Never calls a Provider or Odds/Schedule builder.
 */
import { mkdir, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { isOddsIsoInstant } from "../odds-1x2-v1/instant";
import { loadFootballPredictionSnapshotV0 } from "../prediction-snapshot-v0/load";
import { footballPredictionSnapshotV0Rel } from "../prediction-snapshot-v0/paths";
import type {
  FootballPredictionSnapshotV0,
  FootballSnapshotMatchV0,
} from "../prediction-snapshot-v0/types";
import { computeFootballMarketBaselinePredictionHash } from "./hash";
import { footballMarketBaselinePredictionV0Rel } from "./paths";
import {
  argmaxNormalizedMarketProbability,
  isValidFrozenMarketProbability,
  renormalizeFrozenMedianDevig,
} from "./select";
import {
  FOOTBALL_MARKET_BASELINE_CLASS,
  FOOTBALL_MARKET_BASELINE_MARKET,
  FOOTBALL_MARKET_BASELINE_NORMALIZATION_POLICY,
  FOOTBALL_MARKET_BASELINE_PREDICTION_V0_BUILDER,
  FOOTBALL_MARKET_BASELINE_PREDICTION_V0_SCHEMA,
  FOOTBALL_MARKET_BASELINE_RULE,
  type FootballMarketBaselineMatchV0,
  type FootballMarketBaselinePredictionV0,
  type FootballMarketBaselineStatus,
} from "./types";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

export function sourceStatusToBaseline(
  status: string,
): FootballMarketBaselineStatus | null {
  switch (status) {
    case "FROZEN":
      return null;
    case "NO_USABLE_ODDS_BEFORE_FREEZE":
      return "SOURCE_NO_USABLE_ODDS";
    case "NOT_ELIGIBLE_FORMAT":
      return "SOURCE_NOT_ELIGIBLE_FORMAT";
    case "COMPETITION_BLOCKED":
      return "SOURCE_COMPETITION_BLOCKED";
    case "IDENTITY_BLOCKED":
      return "SOURCE_IDENTITY_BLOCKED";
    case "UNKNOWN_ELIGIBILITY":
      return "SOURCE_UNKNOWN_ELIGIBILITY";
    case "MISSED_SNAPSHOT_FREEZE_WINDOW":
      return "SOURCE_MISSED_SNAPSHOT_FREEZE_WINDOW";
    default:
      throw new Error(
        `FOOTBALL_MARKET_BASELINE_SOURCE_STATUS_INVALID: ${status}`,
      );
  }
}

function emptyMarketFields(over: {
  match: FootballSnapshotMatchV0;
  sourceFreezeAt: string;
  baselineStatus: FootballMarketBaselineStatus;
}): FootballMarketBaselineMatchV0 {
  const row = over.match.frozenScheduleRow;
  return {
    matchId: over.match.matchId,
    baselineStatus: over.baselineStatus,
    sourceSnapshotStatus: over.match.snapshotStatus,
    competitionId: row.competitionId,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    homeTeamName: row.homeTeamName,
    awayTeamName: row.awayTeamName,
    kickoffTimeUtc: row.kickoffTimeUtc,
    sourceFreezeAt: over.sourceFreezeAt,
    sourceSelectedOddsObservationId: over.match.selectedOddsObservationId,
    sourceSelectedOddsObservationHash: over.match.selectedOddsObservationHash,
    rawMedianDevigHome: null,
    rawMedianDevigDraw: null,
    rawMedianDevigAway: null,
    rawMedianSum: null,
    normalizedHome: null,
    normalizedDraw: null,
    normalizedAway: null,
    baselineOutcome: null,
    baselineProbability: null,
    baselineRule: FOOTBALL_MARKET_BASELINE_RULE,
    researchOnly: true,
  };
}

function predictFrozenMatch(input: {
  match: FootballSnapshotMatchV0;
  sourceFreezeAt: string;
  predictionAt: string;
}): FootballMarketBaselineMatchV0 {
  const obs = input.match.frozenOddsObservation;
  if (obs == null) {
    throw new Error(
      `FOOTBALL_MARKET_BASELINE_INVALID_FROZEN_PROBABILITIES: matchId=${input.match.matchId}`,
    );
  }
  const home = obs.medianDevigHome;
  const draw = obs.medianDevigDraw;
  const away = obs.medianDevigAway;
  if (
    !isValidFrozenMarketProbability(home) ||
    !isValidFrozenMarketProbability(draw) ||
    !isValidFrozenMarketProbability(away)
  ) {
    throw new Error(
      `FOOTBALL_MARKET_BASELINE_INVALID_FROZEN_PROBABILITIES: matchId=${input.match.matchId}`,
    );
  }
  const norm = renormalizeFrozenMedianDevig({ home, draw, away });
  const row = input.match.frozenScheduleRow;
  const base = {
    matchId: input.match.matchId,
    sourceSnapshotStatus: input.match.snapshotStatus,
    competitionId: row.competitionId,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    homeTeamName: row.homeTeamName,
    awayTeamName: row.awayTeamName,
    kickoffTimeUtc: row.kickoffTimeUtc,
    sourceFreezeAt: input.sourceFreezeAt,
    sourceSelectedOddsObservationId: input.match.selectedOddsObservationId,
    sourceSelectedOddsObservationHash: input.match.selectedOddsObservationHash,
    rawMedianDevigHome: home,
    rawMedianDevigDraw: draw,
    rawMedianDevigAway: away,
    rawMedianSum: norm.rawMedianSum,
    normalizedHome: norm.normalizedHome,
    normalizedDraw: norm.normalizedDraw,
    normalizedAway: norm.normalizedAway,
    baselineRule: FOOTBALL_MARKET_BASELINE_RULE,
    researchOnly: true as const,
  };

  const predictionMs = Date.parse(input.predictionAt);
  const kickoff = row.kickoffTimeUtc;
  if (typeof kickoff !== "string" || !isOddsIsoInstant(kickoff)) {
    throw new Error(
      `FOOTBALL_PREDICTION_SNAPSHOT_FROZEN_KICKOFF_INVALID: matchId=${input.match.matchId}`,
    );
  }
  const kickoffMs = Date.parse(kickoff);
  if (predictionMs >= kickoffMs) {
    return {
      ...base,
      baselineStatus: "MISSED_MARKET_BASELINE_WINDOW",
      baselineOutcome: null,
      baselineProbability: null,
    };
  }

  const picked = argmaxNormalizedMarketProbability(norm);
  if (picked.ambiguous) {
    return {
      ...base,
      baselineStatus: "AMBIGUOUS_MARKET_MAX",
      baselineOutcome: null,
      baselineProbability: null,
    };
  }
  return {
    ...base,
    baselineStatus: "MARKET_BASELINE_PREDICTED",
    baselineOutcome: picked.outcome,
    baselineProbability: picked.probability,
  };
}

export function assembleFootballMarketBaselinePredictionV0(input: {
  snapshot: FootballPredictionSnapshotV0;
  predictionAt: string;
  generatedAt: string;
}): FootballMarketBaselinePredictionV0 {
  if (!isOddsIsoInstant(input.predictionAt)) {
    throw new Error("FOOTBALL_MARKET_BASELINE_PREDICTION_AT_INVALID");
  }
  if (!isOddsIsoInstant(input.generatedAt)) {
    throw new Error("FOOTBALL_MARKET_BASELINE_GENERATED_AT_INVALID");
  }

  const freezeAt = input.snapshot.meta.freezeAt;
  const matches = input.snapshot.matches
    .slice()
    .sort((a, b) => a.matchId.localeCompare(b.matchId))
    .map((match) => {
      const mapped = sourceStatusToBaseline(match.snapshotStatus);
      if (mapped) {
        return emptyMarketFields({
          match,
          sourceFreezeAt: freezeAt,
          baselineStatus: mapped,
        });
      }
      return predictFrozenMatch({
        match,
        sourceFreezeAt: freezeAt,
        predictionAt: input.predictionAt,
      });
    });

  const withoutHash: Omit<FootballMarketBaselinePredictionV0, "meta"> & {
    meta: Omit<FootballMarketBaselinePredictionV0["meta"], "predictionHash">;
  } = {
    meta: {
      schemaVersion: FOOTBALL_MARKET_BASELINE_PREDICTION_V0_SCHEMA,
      builderVersion: FOOTBALL_MARKET_BASELINE_PREDICTION_V0_BUILDER,
      dateKst: input.snapshot.meta.dateKst,
      generatedAt: input.generatedAt,
      predictionAt: input.predictionAt,
      researchOnly: true,
      legalStatus: "NEEDS_LEGAL_REVIEW",
      predictionClass: FOOTBALL_MARKET_BASELINE_CLASS,
      market: FOOTBALL_MARKET_BASELINE_MARKET,
      baselineRule: FOOTBALL_MARKET_BASELINE_RULE,
      normalizationPolicy: FOOTBALL_MARKET_BASELINE_NORMALIZATION_POLICY,
      model: "NONE",
      engine: "NONE",
      recommendation: "NONE",
      officialPickCount: 0,
      sourceSnapshotRel: footballPredictionSnapshotV0Rel(
        input.snapshot.meta.dateKst,
      ),
      sourceSnapshotHash: input.snapshot.meta.snapshotHash,
      snapshotMatches: matches.length,
      frozenInputGames: matches.filter(
        (m) => m.sourceSnapshotStatus === "FROZEN",
      ).length,
      baselinePredictedGames: matches.filter(
        (m) => m.baselineStatus === "MARKET_BASELINE_PREDICTED",
      ).length,
      ambiguousMarketGames: matches.filter(
        (m) => m.baselineStatus === "AMBIGUOUS_MARKET_MAX",
      ).length,
      missedPredictionWindowGames: matches.filter(
        (m) => m.baselineStatus === "MISSED_MARKET_BASELINE_WINDOW",
      ).length,
      nonFrozenInputGames: matches.filter(
        (m) => m.sourceSnapshotStatus !== "FROZEN",
      ).length,
    },
    matches,
  };

  return {
    ...withoutHash,
    meta: {
      ...withoutHash.meta,
      predictionHash: computeFootballMarketBaselinePredictionHash(withoutHash),
    },
  };
}

export async function buildFootballMarketBaselinePredictionV0(input: {
  dateKst: string;
  predictionAt: string;
  generatedAt: string;
  dryRun: boolean;
  rootDir?: string;
}): Promise<{
  document: FootballMarketBaselinePredictionV0;
  rel: string;
  wrote: boolean;
}> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKst)) {
    throw new Error("FOOTBALL_MARKET_BASELINE_DATE_KST_INVALID");
  }
  if (!isOddsIsoInstant(input.predictionAt)) {
    throw new Error("FOOTBALL_MARKET_BASELINE_PREDICTION_AT_INVALID");
  }
  if (!isOddsIsoInstant(input.generatedAt)) {
    throw new Error("FOOTBALL_MARKET_BASELINE_GENERATED_AT_INVALID");
  }

  const root = input.rootDir ?? process.cwd();
  const rel = footballMarketBaselinePredictionV0Rel(input.dateKst);
  const abs = path.join(root, rel);

  if (existsSync(abs)) {
    throw new Error(`FOOTBALL_MARKET_BASELINE_ALREADY_EXISTS: ${rel}`);
  }

  const snapshot = await loadFootballPredictionSnapshotV0({
    dateKst: input.dateKst,
    rootDir: root,
  });
  const document = assembleFootballMarketBaselinePredictionV0({
    snapshot,
    predictionAt: input.predictionAt,
    generatedAt: input.generatedAt,
  });

  const frozenKickoffs = snapshot.matches
    .filter((m) => m.snapshotStatus === "FROZEN")
    .map((m) => m.frozenScheduleRow.kickoffTimeUtc)
    .filter((k): k is string => k != null);
  const predictionMs = Date.parse(input.predictionAt);
  const allFrozenPastKickoff =
    frozenKickoffs.length > 0 &&
    frozenKickoffs.every((k) => predictionMs >= Date.parse(k));
  if (allFrozenPastKickoff && document.meta.baselinePredictedGames === 0) {
    throw new Error("MISSED_MARKET_BASELINE_PREDICTION_WINDOW");
  }

  let wrote = false;
  if (!input.dryRun) {
    await writeJsonAtomic(abs, document);
    wrote = true;
  }
  return { document, rel, wrote };
}
