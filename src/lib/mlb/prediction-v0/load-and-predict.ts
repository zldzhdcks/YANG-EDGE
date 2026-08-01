/**
 * Load MLB pregame inputs for prediction v0 (no result artifacts).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  loadMlbPredictionConsumerInput,
  type MlbPredictionConsumerLoad,
} from "@/lib/mlb/load-mlb-prediction-consumer-input";
import {
  buildDisabledBullpenFeature,
  buildLineupFeature,
} from "./features-lineup-bullpen";
import { buildMarketFeature } from "./features-market";
import { buildStarterFeature } from "./features-starter";
import { evaluateLeakage } from "./leakage-guard";
import { sha256 } from "./math";
import type {
  FeatureProvenance,
  GamePredictionV0,
} from "./types";
import { computeMoneylinePrediction } from "./compute-moneyline";

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function readJson(rel: string, cwd: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path.join(cwd, rel), "utf8")) as unknown;
  } catch {
    return null;
  }
}

function emptyProv(artifact: string | null): FeatureProvenance {
  return {
    sourceArtifact: artifact,
    sourceTimestamp: null,
    statsAsOf: null,
    cutoffTime: null,
    leakageEligible: false,
    warning: [],
  };
}

export type PredictV0Options = {
  dateKst: string;
  cwd?: string;
  gameIds?: string[];
  observationOnly?: boolean;
  useMarketPrior?: boolean;
  /** Override predictedAt for determinism tests. */
  predictedAtOverride?: string | null;
};

export type PredictV0LoadResult =
  | { kind: "blocked"; reason: string; message: string; warnings: string[] }
  | {
      kind: "ready";
      dateKst: string;
      predictedAt: string;
      inputManifestHash: string;
      games: GamePredictionV0[];
      sourceSnapshotVersions: Record<string, string | null>;
      consumer: Extract<MlbPredictionConsumerLoad, { kind: "ready" }>;
    };

export async function loadAndPredictMlbV0(
  options: PredictV0Options,
): Promise<PredictV0LoadResult> {
  const cwd = options.cwd ?? process.cwd();
  const useMarketPrior = options.useMarketPrior !== false;
  const observationOnly = Boolean(options.observationOnly);

  if (cwd !== process.cwd()) {
    // Consumer loader resolves artifacts from process.cwd(); callers must chdir
    // or run from repo root. We keep an explicit check for tests.
  }
  const consumer = await loadMlbPredictionConsumerInput(options.dateKst);

  if (consumer.kind === "blocked") {
    return {
      kind: "blocked",
      reason: consumer.reason,
      message: consumer.message,
      warnings: consumer.warnings,
    };
  }

  const predictedAt =
    options.predictedAtOverride?.trim() || consumer.predictedAt;

  // Enrich from raw starter/lineup docs for provenance (re-read via manifest paths)
  const summaryRel = `data/research/mlb/${options.dateKst}-daily-research-summary-v1.json`;
  const summary = asRecord(await readJson(summaryRel, cwd));
  const datasets = Array.isArray(asRecord(summary?.researchReady)?.datasets)
    ? (asRecord(summary?.researchReady)!.datasets as unknown[])
    : [];
  const findArt = (name: string) => {
    for (const raw of datasets) {
      const row = asRecord(raw);
      if (asString(row?.dataset) === name) return asString(row?.artifact);
    }
    return null;
  };
  const starterArt = findArt("Starter");
  const oddsArt = findArt("Odds");
  const lineupArt = findArt("Lineup");
  const starterDoc = starterArt
    ? asRecord(await readJson(starterArt, cwd))
    : null;
  const lineupDoc = lineupArt ? asRecord(await readJson(lineupArt, cwd)) : null;
  const oddsDoc = oddsArt ? asRecord(await readJson(oddsArt, cwd)) : null;
  const starterMetaGeneratedAt =
    asString(asRecord(starterDoc?.meta)?.generatedAt) ??
    asString(starterDoc?.generatedAt);
  const starterSummary = asRecord(starterDoc?.summary);
  const starterTargetIncluded =
    (asNumber(starterSummary?.targetGameIncludedInStats) ?? 0) > 0;
  const starterCutoffViolations =
    asNumber(starterSummary?.cutoffViolations) ?? 0;

  const starterRows = Array.isArray(starterDoc?.rows) ? starterDoc!.rows : [];
  const lineupRows = Array.isArray(lineupDoc?.rows) ? lineupDoc!.rows : [];
  const oddsRows = Array.isArray(oddsDoc?.rows) ? oddsDoc!.rows : [];
  const oddsByGame = new Map<string, Record<string, unknown>>();
  for (const raw of oddsRows) {
    const row = asRecord(raw);
    const id = asString(row?.gameId);
    if (row && id) oddsByGame.set(id, row);
  }
  const starterByGame = new Map<string, Record<string, unknown>[]>();
  for (const raw of starterRows) {
    const row = asRecord(raw);
    const id = asString(row?.gameId);
    if (!row || !id) continue;
    const list = starterByGame.get(id) ?? [];
    list.push(row);
    starterByGame.set(id, list);
  }
  const lineupByGame = new Map<string, Record<string, unknown>[]>();
  for (const raw of lineupRows) {
    const row = asRecord(raw);
    const id = asString(row?.gameId);
    if (!row || !id) continue;
    const list = lineupByGame.get(id) ?? [];
    list.push(row);
    lineupByGame.set(id, list);
  }

  const filterIds = options.gameIds?.length
    ? new Set(options.gameIds)
    : null;

  const games: GamePredictionV0[] = [];
  for (const g of consumer.games) {
    if (filterIds && !filterIds.has(g.gameId)) continue;

    const sRows = starterByGame.get(g.gameId) ?? [];
    const homeRow =
      sRows.find((r) => asString(r.side) === "home") ?? null;
    const awayRow =
      sRows.find((r) => asString(r.side) === "away") ?? null;
    const homeStats = asRecord(homeRow?.seasonStats);
    const awayStats = asRecord(awayRow?.seasonStats);

    const homeStarter = buildStarterFeature({
      playerName:
        asString(homeRow?.probablePitcherName) ??
        g.analysisData.home.startingPitcher?.name ??
        null,
      era:
        asNumber(homeStats?.era) ??
        g.analysisData.home.startingPitcher?.era ??
        null,
      whip:
        asNumber(homeStats?.whip) ??
        g.analysisData.home.startingPitcher?.whip ??
        null,
      inningsPitched:
        asNumber(homeStats?.inningsPitched) ??
        g.analysisData.home.startingPitcher?.inningsPitched ??
        null,
      strikeouts:
        asNumber(homeStats?.strikeOuts) ??
        g.analysisData.home.startingPitcher?.strikeouts ??
        null,
      walks: asNumber(homeStats?.baseOnBalls),
      throws:
        asString(homeRow?.throws) === "L"
          ? "L"
          : asString(homeRow?.throws) === "R"
            ? "R"
            : null,
      provenance: {
        sourceArtifact: starterArt,
        // Row sourceTimestamp is often equal to cutoffTime — do not treat as collectedAt.
        sourceTimestamp: starterMetaGeneratedAt,
        statsAsOf: asString(homeRow?.statsAsOf) ?? asString(homeRow?.asOf),
        cutoffTime: asString(homeRow?.cutoffTime),
        leakageEligible: false,
        warning: [],
      },
    });

    const awayStarter = buildStarterFeature({
      playerName:
        asString(awayRow?.probablePitcherName) ??
        g.analysisData.away.startingPitcher?.name ??
        null,
      era:
        asNumber(awayStats?.era) ??
        g.analysisData.away.startingPitcher?.era ??
        null,
      whip:
        asNumber(awayStats?.whip) ??
        g.analysisData.away.startingPitcher?.whip ??
        null,
      inningsPitched:
        asNumber(awayStats?.inningsPitched) ??
        g.analysisData.away.startingPitcher?.inningsPitched ??
        null,
      strikeouts:
        asNumber(awayStats?.strikeOuts) ??
        g.analysisData.away.startingPitcher?.strikeouts ??
        null,
      walks: asNumber(awayStats?.baseOnBalls),
      throws:
        asString(awayRow?.throws) === "L"
          ? "L"
          : asString(awayRow?.throws) === "R"
            ? "R"
            : null,
      provenance: {
        sourceArtifact: starterArt,
        sourceTimestamp: starterMetaGeneratedAt,
        statsAsOf: asString(awayRow?.statsAsOf) ?? asString(awayRow?.asOf),
        cutoffTime: asString(awayRow?.cutoffTime),
        leakageEligible: false,
        warning: [],
      },
    });

    const lRows = lineupByGame.get(g.gameId) ?? [];
    const confirmed =
      lRows.length >= 2 &&
      lRows.every(
        (row) =>
          asString(row.collectionStatus) === "CONFIRMED" &&
          asString(row.lineupStatus) === "COMPLETE",
      );
    const slotCount = (side: string) => {
      const row = lRows.find((r) => asString(r.side) === side);
      const batters = Array.isArray(row?.batters) ? row!.batters : [];
      return batters.length;
    };
    const lineupCapturedAt = lRows
      .map((r) => asString(r.sourceTimestamp))
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    const lineup = buildLineupFeature({
      confirmed,
      homeSlots: slotCount("home"),
      awaySlots: slotCount("away"),
      provenance: {
        sourceArtifact: lineupArt,
        sourceTimestamp: lineupCapturedAt,
        statsAsOf: null,
        cutoffTime: asString(lRows[0]?.cutoffTime),
        leakageEligible: false,
        warning: [],
      },
    });

    const oddsRow = oddsByGame.get(g.gameId) ?? null;
    const oddsCapturedAt = asString(oddsRow?.capturedAt);

    const market = buildMarketFeature({
      homeOdds: g.homeOdds,
      awayOdds: g.awayOdds,
      provenance: {
        sourceArtifact: oddsArt,
        sourceTimestamp: oddsCapturedAt,
        statsAsOf: null,
        cutoffTime: asString(oddsRow?.cutoffTime),
        leakageEligible: false,
        warning: [],
      },
    });

    const homeBullpen = buildDisabledBullpenFeature(emptyProv(null));
    const awayBullpen = buildDisabledBullpenFeature(emptyProv(null));

    // Per-game feature as-of for leakage (ignore post-hoc daily summary rebuild times)
    const featureTimes = [
      starterMetaGeneratedAt,
      oddsCapturedAt,
      lineupCapturedAt,
    ]
      .map((t) => (t ? Date.parse(t) : Number.NaN))
      .filter((n) => Number.isFinite(n));
    const featureAsOfMs =
      featureTimes.length > 0 ? Math.max(...featureTimes) : Number.NaN;
    const featureAsOfIso = Number.isFinite(featureAsOfMs)
      ? new Date(featureAsOfMs).toISOString()
      : predictedAt;

    const commenceMs = Date.parse(g.commenceTimeUtc);
    const asOfMs = Date.parse(featureAsOfIso);
    const afterCutoff =
      Number.isFinite(commenceMs) &&
      Number.isFinite(asOfMs) &&
      asOfMs >= commenceMs;
    const cutoffMarginMinutes =
      Number.isFinite(commenceMs) && Number.isFinite(asOfMs)
        ? (commenceMs - asOfMs) / 60000
        : null;

    const leakage = evaluateLeakage({
      commenceTimeUtc: g.commenceTimeUtc,
      predictedAt: featureAsOfIso,
      oddsCapturedAt,
      lineupCapturedAt,
      starterStatsAsOf: homeStarter.provenance.statsAsOf,
      starterTargetGameIncluded: starterTargetIncluded,
      starterCutoffViolations,
      closingOddsPostStart: Boolean(
        oddsCapturedAt &&
          Number.isFinite(commenceMs) &&
          Date.parse(oddsCapturedAt) >= commenceMs,
      ),
      liveLineupAfterStart: Boolean(
        lineupCapturedAt &&
          Number.isFinite(commenceMs) &&
          Date.parse(lineupCapturedAt) >= commenceMs,
      ),
    });

    // Consumer already blocked some games — fold in
    const identityMismatch = g.inputWarnings.includes(
      "STARTER_IDENTITY_MISSING_BOTH_SIDES",
    );

    const mp = computeMoneylinePrediction({
      homeStarter,
      awayStarter,
      market,
      lineup,
      homeBullpen,
      awayBullpen,
      useMarketPrior,
      observationOnly,
      leakageBlocked: leakage.blocked,
      leakageReasons: leakage.reasons,
      afterCutoff:
        afterCutoff ||
        g.inputWarnings.includes("ODDS_AFTER_CUTOFF") ||
        g.inputWarnings.includes("LINEUP_AFTER_CUTOFF") ||
        g.inputStatus === "BLOCKED",
      identityMismatch,
      cutoffMarginMinutes,
    });

    // If consumer LIMITED and we aren't blocked, keep PASS
    if (
      g.inputStatus === "LIMITED_INPUT" &&
      mp.officialStatus === "ELIGIBLE"
    ) {
      mp.officialStatus = "PASS";
      mp.warnings = [...new Set([...mp.warnings, "CONSUMER_LIMITED_INPUT"])].sort();
      mp.officialPick = null;
    }

    const homeTeamName = g.homeTeam;
    const awayTeamName = g.awayTeam;
    const baselinePick =
      mp.officialStatus === "BLOCKED"
        ? null
        : mp.researchBaseline.selection === "HOME"
          ? homeTeamName
          : awayTeamName;

    const edgeScore =
      mp.modelEdgeHome != null
        ? Math.round(mp.modelEdgeHome * 1000) / 10
        : Math.round((mp.homeProbability - 0.5) * 60 * 10) / 10;

    games.push({
      gameId: g.gameId,
      externalId: g.externalId,
      dateKst: g.dateKst,
      startTimeKst: g.startTimeKst,
      commenceTimeUtc: g.commenceTimeUtc,
      league: "MLB",
      homeTeam: homeTeamName,
      awayTeam: awayTeamName,
      marketPredictions: [mp],
      baselinePick,
      modelProbability: Math.round(mp.homeProbability * 1000) / 10,
      edgeScore,
      confidence: mp.confidence,
      baselineStatus:
        mp.officialStatus === "BLOCKED"
          ? "INSUFFICIENT"
          : mp.officialStatus === "ELIGIBLE"
            ? "BASELINE_CANDIDATE"
            : "PASS",
      marketProbability:
        mp.marketHomeProbability != null
          ? Math.round(mp.marketHomeProbability * 1000) / 10
          : null,
      valueEdge:
        mp.modelEdgeHome != null
          ? Math.round(mp.modelEdgeHome * 1000) / 10
          : null,
      openingOdds: g.openingOdds,
      latestOdds: g.latestOdds,
      oddsMovement: g.oddsMovement,
      officialStatus: mp.officialStatus,
      officialPick: mp.officialPick,
      passReasons: mp.warnings.filter((w) =>
        w.includes("PASS") ||
        w.includes("THRESHOLD") ||
        w.includes("LIMITED") ||
        w.includes("OFFICIAL_PICK_DISABLED") ||
        w.includes("OBSERVATION") ||
        w.includes("INPUT_QUALITY") ||
        w.includes("MARKET_ONLY") ||
        w.includes("CONFIDENCE"),
      ),
      missingInputs: mp.missingInputs,
      researchBaseline: {
        pick: baselinePick,
        confidence: mp.confidence,
        modelProbability: Math.round(mp.homeProbability * 1000) / 10,
        researchOnly: true,
      },
      inputStatus:
        mp.officialStatus === "BLOCKED"
          ? "BLOCKED"
          : g.inputStatus === "ELIGIBLE" && mp.inputQuality === "FULL_INPUT"
            ? "ELIGIBLE"
            : "LIMITED_INPUT",
      inputWarnings: [...new Set([...g.inputWarnings, ...mp.warnings])].sort(),
      features: {
        homeStarter,
        awayStarter,
        market,
        lineup,
        homeBullpen,
        awayBullpen,
      },
      leakage,
    });
  }

  games.sort((a, b) => a.gameId.localeCompare(b.gameId));

  return {
    kind: "ready",
    dateKst: options.dateKst,
    predictedAt,
    inputManifestHash: consumer.inputManifest.inputHash,
    games,
    sourceSnapshotVersions: consumer.sourceSnapshotVersions,
    consumer,
  };
}

export function predictionContentFingerprint(game: GamePredictionV0): unknown {
  return {
    gameId: game.gameId,
    marketPredictions: game.marketPredictions.map((m) => ({
      marketType: m.marketType,
      homeProbability: m.homeProbability,
      awayProbability: m.awayProbability,
      marketHomeProbability: m.marketHomeProbability,
      marketAwayProbability: m.marketAwayProbability,
      modelEdgeHome: m.modelEdgeHome,
      modelEdgeAway: m.modelEdgeAway,
      confidence: m.confidence,
      officialStatus: m.officialStatus,
      officialPick: m.officialPick,
      researchBaseline: m.researchBaseline,
      components: m.components,
      inputQuality: m.inputQuality,
      calibration: m.calibration,
      explanations: m.explanations,
    })),
    baselinePick: game.baselinePick,
    modelProbability: game.modelProbability,
    confidence: game.confidence,
    officialStatus: game.officialStatus,
  };
}

export function hashPredictions(games: GamePredictionV0[]): string {
  return sha256(games.map(predictionContentFingerprint));
}
