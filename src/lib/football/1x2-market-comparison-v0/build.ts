/**
 * Assemble Football 1X2 pregame market comparison v0.
 * Reads Observed Slate + sealed observation. Does not write odds-1x2-v1.
 * Does not read Prediction / Result / Postgame.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { OddsData, OddsSportInfo, OddsUsageMeta } from "@/lib/odds/types";
import {
  extractEventBookmakerQuotes,
} from "../odds-1x2-v1/quotes";
import type { FootballObservedSlateGameV0 } from "../observed-slate-v0/types";
import { FOOTBALL_OBSERVED_SLATE_V0_SCHEMA } from "../observed-slate-v0/types";
import type { FootballObservedSlateV0 } from "../observed-slate-v0/types";
import {
  joinFixtureToOddsEvent,
  resolveResearchSportKey,
  screenshotSideVsProviderHome,
} from "./identity";
import {
  medianQuoteMetric,
  probabilityGap,
  threeWayMetricsFromDecimals,
} from "./metrics";
import {
  FOOTBALL_1X2_MARKET_COMPARISON_V0_BUILDER,
  FOOTBALL_1X2_MARKET_COMPARISON_V0_SCHEMA,
  type Football1x2ComparisonIdentityStatus,
  type Football1x2ExternalCutoffStatus,
  type Football1x2ExternalObservationV0,
  type Football1x2MarketComparisonRowV0,
  type Football1x2MarketComparisonV0,
} from "./types";

const SLATE_REL = "data/research/football/2026-08-16-observed-slate-v0.json";
const OBS_REL =
  "data/operator-observations/structured/2026-08-16/batch-2207-football-manual-market-observation-v0.json";
const MAP_REL =
  "data/research/football/2026-08-16-manual-observation-fixture-mapping-v1.json";

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function emptyExternal(input: {
  sportKey: string | null;
  collectedAt: string | null;
  cached: boolean;
  cutoffStatus: Football1x2ExternalCutoffStatus;
  identityStatus: Football1x2ComparisonIdentityStatus;
  evidence: string[];
}): Football1x2ExternalObservationV0 {
  return {
    provider: "THE_ODDS_API",
    providerEventId: null,
    sportKey: input.sportKey,
    oddsHomeTeamName: null,
    oddsAwayTeamName: null,
    commenceTimeUtc: null,
    collectedAt: input.collectedAt,
    cached: input.cached,
    sideAlignment: "UNRESOLVED",
    joinEvidence: input.evidence,
    cutoffStatus: input.cutoffStatus,
    bookmakers: [],
    medianRawImpliedHome: null,
    medianRawImpliedDraw: null,
    medianRawImpliedAway: null,
    medianOverround: null,
  };
}

function domesticFromGame(input: {
  game: FootballObservedSlateGameV0;
  receivedAtKst: string;
  captureTime: unknown;
}): Football1x2MarketComparisonRowV0["domestic"] {
  const oneX2 = input.game.markets.find((m) => m.marketKind === "ONE_X_TWO");
  if (!oneX2) {
    throw new Error(`DOMESTIC_1X2_MISSING: fixtureId=${input.game.fixtureId}`);
  }
  const prices = oneX2.prices.slice();
  return {
    rowId: input.game.rowId,
    rawLeftTeam: input.game.rawLeftTeam,
    rawRightTeam: input.game.rawRightTeam,
    candidateLeftTeam: input.game.candidateLeftTeam,
    candidateRightTeam: input.game.candidateRightTeam,
    rawMarketLabel: oneX2.rawMarketLabel,
    prices,
    screenshotFile: input.game.sourceScreenshotFile,
    screenshotSha256: input.game.sourceScreenshotSha256,
    receivedAtKst: input.receivedAtKst,
    captureTime: input.captureTime,
    screenshotSideVsProviderHome: screenshotSideVsProviderHome(input.game),
    metrics: threeWayMetricsFromDecimals({
      leftOrHome: prices[0] ?? null,
      draw: prices[1] ?? null,
      rightOrAway: prices[2] ?? null,
    }),
  };
}

export function assertMarketComparisonIntegrity(
  doc: Football1x2MarketComparisonV0,
): string[] {
  const errors: string[] = [];
  if (doc.schemaVersion !== FOOTBALL_1X2_MARKET_COMPARISON_V0_SCHEMA) {
    errors.push("SCHEMA");
  }
  if (doc.researchOnly !== true) errors.push("RESEARCH_ONLY");
  if (doc.engineAdmission !== "PROHIBITED") errors.push("ENGINE_ADMISSION");
  if (doc.predictionInput !== true && doc.predictionInput !== false) {
    errors.push("PREDICTION_INPUT");
  }
  if (doc.predictionInput !== false) errors.push("PREDICTION_INPUT_NOT_FALSE");
  if (doc.resultDataUsed !== false) errors.push("RESULT_DATA");
  if (doc.existingOdds1x2V1Written !== false) errors.push("ODDS_V1_WRITTEN");
  if (doc.summary.targetFixtures !== 6) errors.push("TARGET_NOT_6");
  if (doc.summary.fixtureIdsUnique !== 6) errors.push("FIXTURE_UNIQUE");
  if (doc.rows.length !== 6) errors.push("ROW_COUNT");
  const ids = doc.rows.map((r) => r.fixtureId);
  if (new Set(ids).size !== ids.length) errors.push("DUPLICATE_FIXTURE");
  if (doc.summary.observedGames !== 15) errors.push("OBSERVED_GAMES");
  if (doc.summary.manual1x2Observations !== 15) errors.push("MANUAL_1X2");
  if (doc.summary.registeredResearchEligible !== 6) errors.push("REGISTERED_ELIGIBLE");
  if (doc.summary.unregisteredNotInJoin !== 9) errors.push("UNREGISTERED");
  if (doc.summary.usedByPrediction !== false) errors.push("USED_BY_PREDICTION");
  for (const row of doc.rows) {
    if (row.usedByPrediction !== false) errors.push(`PRED_ROW:${row.fixtureId}`);
    if (row.domestic.receivedAtKst !== "2026-08-16T22:07:00+09:00") {
      errors.push(`RECEIVED_AT:${row.fixtureId}`);
    }
  }
  return errors;
}

export async function loadObservedSlateV0(rootDir = process.cwd()): Promise<{
  slate: FootballObservedSlateV0;
  slateText: string;
  observationText: string;
  mappingText: string;
  receivedAtKst: string;
  captureTime: unknown;
}> {
  const slateText = await readFile(path.join(rootDir, SLATE_REL), "utf8");
  const observationText = await readFile(path.join(rootDir, OBS_REL), "utf8");
  const mappingText = await readFile(path.join(rootDir, MAP_REL), "utf8");
  const parsed = JSON.parse(slateText) as FootballObservedSlateV0;
  if (parsed.schemaVersion !== FOOTBALL_OBSERVED_SLATE_V0_SCHEMA) {
    throw new Error("OBSERVED_SLATE_SCHEMA_MISMATCH");
  }
  const obs = JSON.parse(observationText) as {
    receivedAtKst?: unknown;
    captureTime?: unknown;
    summary?: { games?: unknown; marketRows?: unknown };
  };
  if (obs.receivedAtKst !== "2026-08-16T22:07:00+09:00") {
    throw new Error("OBSERVATION_RECEIVED_AT_CHANGED");
  }
  return {
    slate: parsed,
    slateText,
    observationText,
    mappingText,
    receivedAtKst: obs.receivedAtKst,
    captureTime: obs.captureTime,
  };
}

export function assembleFootball1x2MarketComparisonV0(input: {
  slate: FootballObservedSlateV0;
  slateText: string;
  observationText: string;
  mappingText: string;
  receivedAtKst: string;
  captureTime: unknown;
  generatedAt: string;
  sports: OddsSportInfo[];
  eventsBySportKey: Record<string, OddsData[]>;
  collectedAtBySportKey: Record<string, string | null>;
  cachedBySportKey: Record<string, boolean>;
  providerCalled: boolean;
  usage?: OddsUsageMeta | null;
}): Football1x2MarketComparisonV0 {
  void input.usage;
  void input.providerCalled;
  const targets = input.slate.games.filter(
    (g) => g.researchUsageEligibility === "FUTURE_RESEARCH_ELIGIBLE",
  );
  if (targets.length !== 6) {
    throw new Error(`TARGET_COUNT_UNEXPECTED: ${targets.length}`);
  }

  const rows: Football1x2MarketComparisonRowV0[] = targets.map((game) => {
    const domestic = domesticFromGame({
      game,
      receivedAtKst: input.receivedAtKst,
      captureTime: input.captureTime,
    });
    const sport = resolveResearchSportKey({
      providerCompetitionId: game.providerCompetitionId,
      sports: input.sports,
    });
    const kickoffMs = game.providerKickoffUtc
      ? Date.parse(game.providerKickoffUtc)
      : NaN;

    const sportKey = sport.status === "MAPPED" ? sport.sportKey : null;
    const collectedAt = sportKey
      ? (input.collectedAtBySportKey[sportKey] ?? null)
      : null;
    const cached = sportKey ? Boolean(input.cachedBySportKey[sportKey]) : false;
    const collectedMs = collectedAt ? Date.parse(collectedAt) : NaN;
    const late =
      Number.isFinite(kickoffMs) &&
      Number.isFinite(collectedMs) &&
      collectedMs >= kickoffMs;

    let identityStatus: Football1x2ComparisonIdentityStatus;
    let cutoffStatus: Football1x2ExternalCutoffStatus;
    let external: Football1x2ExternalObservationV0;

    if (sport.status !== "MAPPED" || !sportKey) {
      identityStatus = "ODDS_SPORT_KEY_NOT_MAPPED";
      cutoffStatus = "NOT_COLLECTED";
      external = emptyExternal({
        sportKey: null,
        collectedAt: null,
        cached: false,
        cutoffStatus,
        identityStatus,
        evidence: [sport.source],
      });
    } else if (!collectedAt) {
      identityStatus = "NOT_COLLECTED";
      cutoffStatus = "NOT_COLLECTED";
      external = emptyExternal({
        sportKey,
        collectedAt: null,
        cached,
        cutoffStatus,
        identityStatus,
        evidence: ["PROVIDER_NOT_CALLED_FOR_SPORT_KEY", sport.source],
      });
    } else if (late) {
      identityStatus = "POST_KICKOFF_NOT_ELIGIBLE";
      cutoffStatus = "POST_KICKOFF_NOT_ELIGIBLE";
      external = emptyExternal({
        sportKey,
        collectedAt,
        cached,
        cutoffStatus,
        identityStatus,
        evidence: [
          "POST_KICKOFF_NOT_ELIGIBLE",
          `collectedAt=${collectedAt}`,
          `kickoffUtc=${game.providerKickoffUtc ?? ""}`,
        ],
      });
    } else {
      const joined = joinFixtureToOddsEvent({
        game,
        events: input.eventsBySportKey[sportKey] ?? [],
        sportKey,
      });
      cutoffStatus = "PRE_GAME_COLLECTED";
      if (joined.status === "JOINED") {
        identityStatus = "JOINED";
        const quotes = extractEventBookmakerQuotes(joined.event);
        const medianHome = medianQuoteMetric(quotes, "rawImpliedHome");
        const medianDraw = medianQuoteMetric(quotes, "rawImpliedDraw");
        const medianAway = medianQuoteMetric(quotes, "rawImpliedAway");
        external = {
          provider: "THE_ODDS_API",
          providerEventId: joined.event.externalEventId,
          sportKey,
          oddsHomeTeamName: joined.event.homeTeam,
          oddsAwayTeamName: joined.event.awayTeam,
          commenceTimeUtc: joined.event.commenceTime,
          collectedAt,
          cached,
          sideAlignment: joined.sideAlignment,
          joinEvidence: [...joined.evidence, sport.source],
          cutoffStatus,
          bookmakers: quotes,
          medianRawImpliedHome: medianHome,
          medianRawImpliedDraw: medianDraw,
          medianRawImpliedAway: medianAway,
          medianOverround: medianQuoteMetric(quotes, "overround"),
        };
      } else if (joined.status === "ODDS_IDENTITY_UNRESOLVED") {
        identityStatus = "ODDS_IDENTITY_UNRESOLVED";
        external = emptyExternal({
          sportKey,
          collectedAt,
          cached,
          cutoffStatus,
          identityStatus,
          evidence: [...joined.evidence, sport.source],
        });
      } else {
        identityStatus = "NOT_JOINED";
        external = emptyExternal({
          sportKey,
          collectedAt,
          cached,
          cutoffStatus,
          identityStatus,
          evidence: [...joined.evidence, sport.source],
        });
      }
    }

    const gap = probabilityGap({
      sideAlignment: external.sideAlignment,
      domestic: domestic.metrics,
      medianHome: external.medianRawImpliedHome,
      medianDraw: external.medianRawImpliedDraw,
      medianAway: external.medianRawImpliedAway,
    });

    const matchup = `${game.candidateLeftTeam} vs ${game.candidateRightTeam}`;
    const scheduleDateKst = game.displayedDateKst;

    return {
      fixtureId: game.fixtureId,
      matchup,
      competitionId: game.providerCompetitionId,
      competitionName: game.providerCompetitionName,
      kickoffUtc: game.providerKickoffUtc,
      kickoffKst: game.providerKickoffKst,
      scheduleDateKst,
      identityStatus,
      domestic,
      external,
      probabilityGap: gap,
      usedByPrediction: false,
    };
  });

  const externalMatched = rows.filter((r) => r.identityStatus === "JOINED").length;
  const unresolved = rows.filter(
    (r) => r.identityStatus === "ODDS_IDENTITY_UNRESOLVED",
  ).length;
  const postKickoff = rows.filter(
    (r) => r.external.cutoffStatus === "POST_KICKOFF_NOT_ELIGIBLE",
  ).length;
  const pregameSafe = rows.filter(
    (r) => r.external.cutoffStatus === "PRE_GAME_COLLECTED",
  ).length;
  const domesticPlusExternal = rows.filter(
    (r) => r.identityStatus === "JOINED",
  ).length;
  const eventIds = new Set(
    Object.values(input.eventsBySportKey).flatMap((events) =>
      events.map((e) => e.externalEventId),
    ),
  );

  const document: Football1x2MarketComparisonV0 = {
    schemaVersion: FOOTBALL_1X2_MARKET_COMPARISON_V0_SCHEMA,
    builderVersion: FOOTBALL_1X2_MARKET_COMPARISON_V0_BUILDER,
    batchId: input.slate.batchId,
    dateKst: input.slate.dateKst,
    sourceObservedSlatePath: SLATE_REL,
    sourceObservedSlateHash: sha256Text(input.slateText),
    sourceObservationPath: OBS_REL,
    sourceObservationHash: sha256Text(input.observationText),
    sourceMappingPath: MAP_REL,
    sourceMappingHash: sha256Text(input.mappingText),
    generatedAt: input.generatedAt,
    researchOnly: true,
    engineAdmission: "PROHIBITED",
    engineConnected: false,
    predictionInput: false,
    resultDataUsed: false,
    autoApply: false,
    doesNotReplaceOdds1x2V1: true,
    existingOdds1x2V1Written: false,
    note: "Research overlay. Manual domestic 1X2 copied unchanged from Observed Slate. External odds joined on api-football fixtureId. Existing football-1x2-odds-v1 CLI cannot collect these six games (MLS sport key unmapped; La Liga IDENTITY_BLOCKED / team-bridge J1-only). This artifact is not a Prediction input.",
    oddsPipelineAudit: {
      oddsBuilderImportsPrediction: false,
      oddsIntakeIndependentOfPrediction: true,
      existingCliWouldCallProvider20260816: false,
      existingCliWouldCallProvider20260817: false,
      existingCliSkipNotes: [
        "2026-08-16 dry-run: wouldCallProvider=false; 11 ELIGIBLE_FORMAT MLS rows sportKeyNotMapped; 5 IDENTITY_BLOCKED",
        "2026-08-17 dry-run: wouldCallProvider=false; 4 MLS sportKeyNotMapped; 2 La Liga IDENTITY_BLOCKED (Racing Santander, Espanyol)",
        "football-odds-team-bridge-v1 contains only J1 Tokyo Verdy / Kashiwa Reysol",
        "Did not write data/research/football/2026-08-16-1x2-odds-v1.json or 2026-08-17-1x2-odds-v1.json",
      ],
      didNotWriteFootball1x2OddsV1: true,
    },
    summary: {
      observedGames: input.slate.summary.observedGames,
      manual1x2Observations: input.slate.summary.oneX2Observations,
      registeredResearchEligible: targets.length,
      unregisteredNotInJoin: input.slate.summary.unregisteredCompetition,
      targetFixtures: rows.length,
      fixtureIdsUnique: new Set(rows.map((r) => r.fixtureId)).size,
      domesticJoined: rows.filter((r) => r.domestic.prices.length === 3).length,
      domesticMissing: rows.filter((r) => r.domestic.prices.length !== 3).length,
      externalEventsCollected: eventIds.size,
      externalMatched,
      externalMissing: rows.length - externalMatched - unresolved,
      unresolved,
      domesticPlusExternal,
      domesticOnly: rows.length - domesticPlusExternal,
      externalOnly: 0,
      pregameSafe,
      postKickoffExcluded: postKickoff,
      impliedProbabilityComputed: rows.filter(
        (r) => r.domestic.metrics.rawImpliedLeftOrHome != null,
      ).length,
      overroundComputed: rows.filter((r) => r.domestic.metrics.overround != null)
        .length,
      gapComputed: rows.filter((r) => r.probabilityGap.computed).length,
      usedByPrediction: false,
    },
    rows,
  };

  const integrity = assertMarketComparisonIntegrity(document);
  if (integrity.length > 0) {
    throw new Error(`COMPARISON_INTEGRITY: ${integrity.join(",")}`);
  }
  return document;
}

export async function buildFootball1x2MarketComparisonV0(input: {
  generatedAt?: string;
  sports?: OddsSportInfo[];
  eventsBySportKey?: Record<string, OddsData[]>;
  collectedAtBySportKey?: Record<string, string | null>;
  cachedBySportKey?: Record<string, boolean>;
  providerCalled?: boolean;
  usage?: OddsUsageMeta | null;
  rootDir?: string;
}): Promise<Football1x2MarketComparisonV0> {
  const loaded = await loadObservedSlateV0(input.rootDir);
  return assembleFootball1x2MarketComparisonV0({
    ...loaded,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sports: input.sports ?? [],
    eventsBySportKey: input.eventsBySportKey ?? {},
    collectedAtBySportKey: input.collectedAtBySportKey ?? {},
    cachedBySportKey: input.cachedBySportKey ?? {},
    providerCalled: input.providerCalled ?? false,
    usage: input.usage ?? null,
  });
}
