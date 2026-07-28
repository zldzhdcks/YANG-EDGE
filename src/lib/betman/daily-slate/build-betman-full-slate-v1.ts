import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  resolveMinimumAnalysisLevel,
  computeImpliedProbability,
  findLowestOddsSelection,
} from "../../research/daily-slate/resolve-minimum-analysis-level";
import {
  BETMAN_FULL_SLATE_SCHEMA_VERSION,
  type BetmanCoverageSummary,
  type BetmanFullSlateDocumentV1,
  type BetmanFullSlateGameRow,
  type BetmanSupportedSport,
} from "./betman-daily-slate-types";
import {
  loadKboOddsComparisonExists,
  loadMlbPredictionForGame,
  matchBetmanGameProviderIdentity,
} from "./match-betman-provider-identity";
import {
  normalizeBetmanSport,
  validateBetmanDailySlateV1,
} from "./validate-betman-daily-slate-v1";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) out[key] = sortKeys(obj[key]);
  return out;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function buildEmptyCoverage(): BetmanCoverageSummary {
  return {
    totalOperatorGames: 0,
    supportedSportGames: 0,
    unsupportedSportGames: 0,
    baseballGames: 0,
    soccerGames: 0,
    basketballGames: 0,
    volleyballGames: 0,
    tennisExcludedGames: 0,
    matchedGames: 0,
    unmatchedGames: 0,
    ambiguousGames: 0,
    providerNotImplementedGames: 0,
    fullAnalysisGames: 0,
    partialAnalysisGames: 0,
    marketBaselineGames: 0,
    identityOnlyGames: 0,
    blockedGames: 0,
    predictionGeneratedGames: 0,
    predictionMissingGames: 0,
    oddsAvailableGames: 0,
    oddsMissingGames: 0,
    coverageRate: null,
    analysisCoverageRate: null,
    predictionCoverageRate: null,
  };
}

export async function buildBetmanFullSlateV1(params: {
  dateKst: string;
  cwd?: string;
  generatedAt?: string;
}): Promise<{
  document: BetmanFullSlateDocumentV1;
  validation: Awaited<ReturnType<typeof validateBetmanDailySlateV1>>;
}> {
  const cwd = params.cwd ?? process.cwd();
  const generatedAt = params.generatedAt ?? new Date().toISOString();
  const validation = await validateBetmanDailySlateV1({
    dateKst: params.dateKst,
    cwd,
  });

  if (!validation.input) {
    const document: BetmanFullSlateDocumentV1 = {
      meta: {
        schemaVersion: BETMAN_FULL_SLATE_SCHEMA_VERSION,
        targetDateKst: params.dateKst,
        generatedAt,
        operatorInputStatus: "NOT_ENTERED",
        researchOnly: true,
        legalStatus: "INTERNAL_RESEARCH_ONLY",
        betmanScope: "MANUAL_SCOPE_ONLY",
        publicDisplay: "LEGAL_CLEARANCE_PENDING",
        commercialUse: "LEGAL_CLEARANCE_PENDING",
        inputHashSha256: null,
        resultHashSha256: sha256(
          stableStringify({
            targetDateKst: params.dateKst,
            games: [],
          }),
        ),
      },
      coverageSummary: buildEmptyCoverage(),
      sportCounts: {},
      games: [],
      warnings: ["OPERATOR_INPUT_NOT_ENTERED"],
      blockingReasons: [],
    };
    return { document, validation };
  }

  const input = validation.input;
  const games: BetmanFullSlateGameRow[] = [];
  const sportCounts: Record<string, number> = { ...validation.sportCounts };
  const coverage = buildEmptyCoverage();
  coverage.totalOperatorGames = input.games.length;
  coverage.supportedSportGames = validation.supportedSportGames;
  coverage.unsupportedSportGames = validation.unsupportedSportGames;
  coverage.tennisExcludedGames = sportCounts.TENNIS ?? 0;
  coverage.baseballGames = sportCounts.BASEBALL ?? 0;
  coverage.soccerGames = sportCounts.SOCCER ?? 0;
  coverage.basketballGames = sportCounts.BASKETBALL ?? 0;
  coverage.volleyballGames = sportCounts.VOLLEYBALL ?? 0;

  for (const game of input.games) {
    const sportNorm = normalizeBetmanSport(game.sport);
    if (sportNorm === "TENNIS" || sportNorm === "OTHER") {
      games.push({
        operatorSlateGameId: game.operatorSlateGameId,
        sport: sportNorm,
        supportedSport: false,
        competition: {
          nameRaw: game.competitionNameRaw,
          nameKo: game.competitionNameKo,
          providerLeagueId: null,
        },
        internalGameId: null,
        providerGameId: null,
        awayTeam: game.awayTeamRaw,
        homeTeam: game.homeTeamRaw,
        startTimeKst: game.scheduledStartTimeKst,
        identityStatus: "PROVIDER_NOT_IMPLEMENTED",
        analysisLevel: "BLOCKED",
        predictionStatus: "UNSUPPORTED_SPORT",
        datasetStatus: {},
        marketStatus: {
          domesticOdds: "NOT_ENTERED",
          overseasOdds: "NOT_COLLECTED",
          marketRuleStatus: game.marketRuleStatus,
        },
        resultStatus: null,
        missingReasons: ["UNSUPPORTED_SPORT"],
        blockingReasons: ["UNSUPPORTED_SPORT"],
        sourceReferences: game.sourceReference ? [game.sourceReference] : [],
        predictedOutcome: null,
        modelProbabilities: null,
        confidence: null,
        risk: null,
        edgeScore: null,
        marketProbabilities: null,
      });
      coverage.blockedGames += 1;
      continue;
    }

    const sport = sportNorm as BetmanSupportedSport;
    const identity = await matchBetmanGameProviderIdentity({
      dateKst: params.dateKst,
      game,
      sport,
      cwd,
    });

    const mlbPrediction = await loadMlbPredictionForGame(
      params.dateKst,
      identity.internalGameId,
      cwd,
    );
    const kboOdds = await loadKboOddsComparisonExists(
      params.dateKst,
      identity.internalGameId,
      cwd,
    );

    const domesticOddsVerified =
      game.reviewStatus === "VERIFIED" &&
      game.marketSelections.some((s) => s.oddsDecimal != null);
    const marketRuleVerified = game.marketRuleStatus === "VERIFIED";

    const analysis = resolveMinimumAnalysisLevel({
      sport,
      identityStatus: identity.identityStatus,
      predictionSnapshotPresent: mlbPrediction != null,
      predictionPartial: (mlbPrediction?.missingFactors?.length ?? 0) > 0,
      requiredDatasetsMissing:
        mlbPrediction?.missingFactors?.filter((f) => f.includes("선발")) ?? [],
      domesticOddsVerified,
      overseasOddsPresent: kboOdds,
      marketRuleVerified,
      operatorInputVerified: input.reviewStatus === "VERIFIED",
      legalBlocked: false,
      identityConflict: identity.identityStatus === "AMBIGUOUS",
    });

    if (identity.identityStatus === "MATCHED") coverage.matchedGames += 1;
    else if (identity.identityStatus === "AMBIGUOUS") coverage.ambiguousGames += 1;
    else if (identity.identityStatus === "PROVIDER_NOT_IMPLEMENTED") {
      coverage.providerNotImplementedGames += 1;
    } else coverage.unmatchedGames += 1;

    switch (analysis.analysisLevel) {
      case "FULL_ANALYSIS":
        coverage.fullAnalysisGames += 1;
        coverage.predictionGeneratedGames += 1;
        break;
      case "PARTIAL_ANALYSIS":
        coverage.partialAnalysisGames += 1;
        coverage.predictionGeneratedGames += 1;
        break;
      case "MARKET_BASELINE_ONLY":
        coverage.marketBaselineGames += 1;
        coverage.predictionMissingGames += 1;
        break;
      case "IDENTITY_ONLY":
        coverage.identityOnlyGames += 1;
        coverage.predictionMissingGames += 1;
        break;
      case "BLOCKED":
        coverage.blockedGames += 1;
        coverage.predictionMissingGames += 1;
        break;
    }

    const oddsAvailable =
      game.marketSelections.some((s) => s.oddsDecimal != null) || kboOdds;
    if (oddsAvailable) coverage.oddsAvailableGames += 1;
    else coverage.oddsMissingGames += 1;

    const marketProbabilities: Record<string, number | null> = {};
    for (const sel of game.marketSelections) {
      if (sel.oddsDecimal != null) {
        marketProbabilities[sel.selectionCode] = computeImpliedProbability(
          sel.oddsDecimal,
        );
      }
    }

    games.push({
      operatorSlateGameId: game.operatorSlateGameId,
      sport,
      supportedSport: true,
      competition: {
        nameRaw: game.competitionNameRaw,
        nameKo: game.competitionNameKo,
        providerLeagueId: identity.providerLeagueId,
      },
      internalGameId: identity.internalGameId,
      providerGameId: identity.providerGameId,
      awayTeam: identity.awayTeam ?? game.awayTeamRaw,
      homeTeam: identity.homeTeam ?? game.homeTeamRaw,
      startTimeKst: identity.startTimeKst ?? game.scheduledStartTimeKst,
      identityStatus: identity.identityStatus,
      analysisLevel: analysis.analysisLevel,
      predictionStatus: analysis.predictionStatus,
      datasetStatus: {
        mlbPrediction: mlbPrediction ? "PRESENT" : "MISSING",
        kboOddsComparison: kboOdds ? "PRESENT" : "MISSING",
      },
      marketStatus: {
        domesticOdds: domesticOddsVerified ? "VERIFIED" : "DRAFT_OR_MISSING",
        overseasOdds: kboOdds ? "PRESENT" : "NOT_COLLECTED",
        marketRuleStatus: game.marketRuleStatus,
      },
      resultStatus: null,
      missingReasons: analysis.missingReasons,
      blockingReasons: analysis.blockingReasons,
      sourceReferences: game.sourceReference ? [game.sourceReference] : [],
      predictedOutcome: mlbPrediction?.baselinePick ?? null,
      modelProbabilities: mlbPrediction
        ? { home: null, away: null, model: mlbPrediction.modelProbability ?? null }
        : null,
      confidence: mlbPrediction?.confidence ?? null,
      risk: mlbPrediction?.recommendationGrade ?? null,
      edgeScore: mlbPrediction?.edgeScore ?? null,
      marketProbabilities:
        Object.keys(marketProbabilities).length > 0 ? marketProbabilities : null,
    });
  }

  coverage.coverageRate = pct(
    coverage.matchedGames,
    coverage.supportedSportGames,
  );
  coverage.analysisCoverageRate = pct(
    coverage.fullAnalysisGames +
      coverage.partialAnalysisGames +
      coverage.marketBaselineGames,
    coverage.supportedSportGames,
  );
  coverage.predictionCoverageRate = pct(
    coverage.fullAnalysisGames + coverage.partialAnalysisGames,
    coverage.supportedSportGames,
  );

  const documentWithoutHash: Omit<BetmanFullSlateDocumentV1, "meta"> & {
    meta: Omit<BetmanFullSlateDocumentV1["meta"], "resultHashSha256"> & {
      resultHashSha256?: string;
    };
  } = {
    meta: {
      schemaVersion: BETMAN_FULL_SLATE_SCHEMA_VERSION,
      targetDateKst: params.dateKst,
      generatedAt,
      operatorInputStatus: validation.operatorInputStatus,
      researchOnly: true,
      legalStatus: "INTERNAL_RESEARCH_ONLY",
      betmanScope: "MANUAL_SCOPE_ONLY",
      publicDisplay: "LEGAL_CLEARANCE_PENDING",
      commercialUse: "LEGAL_CLEARANCE_PENDING",
      inputHashSha256: validation.stableInputHashSha256,
    },
    coverageSummary: coverage,
    sportCounts,
    games,
    warnings: validation.warnings,
    blockingReasons: validation.blockingReasons,
  };

  const resultHashSha256 = sha256(
    stableStringify({
      ...documentWithoutHash,
      meta: { ...documentWithoutHash.meta, resultHashSha256: undefined },
    }),
  );

  return {
    document: {
      ...documentWithoutHash,
      meta: {
        ...documentWithoutHash.meta,
        resultHashSha256,
      },
    },
    validation,
  };
}

export async function betmanFullSlateArtifactPath(
  dateKst: string,
  cwd = process.cwd(),
): Promise<string> {
  return path.join(
    cwd,
    "data/research/daily-slates",
    `${dateKst}-betman-full-slate-v1.json`,
  );
}

export async function loadBetmanFullSlateArtifact(
  dateKst: string,
  cwd = process.cwd(),
): Promise<BetmanFullSlateDocumentV1 | null> {
  try {
    const filePath = await betmanFullSlateArtifactPath(dateKst, cwd);
    return JSON.parse(
      await readFile(filePath, "utf8"),
    ) as BetmanFullSlateDocumentV1;
  } catch {
    return null;
  }
}
