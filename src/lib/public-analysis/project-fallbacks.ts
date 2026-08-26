import {
  PUBLIC_ANALYSIS_DISCLAIMER,
  PUBLIC_LEGACY_MIGRATION_DESCRIPTION,
  PUBLIC_LEGACY_MIGRATION_HEADLINE,
  PUBLIC_UNRESOLVED_DESCRIPTION,
  PUBLIC_UNRESOLVED_HEADLINE,
  type PublicGameAnalysisViewV1,
} from "@/types/public-game-analysis-view";
import type { ResearchAnalysisView } from "@/types/research-analysis-view";
import { getTeamDisplayName } from "@/lib/teams/get-team-display-name";

export type PublicAnalysisResolution = {
  matched: boolean;
  source: "daily-c" | "legacy-research" | "unresolved";
  dateKst: string | null;
  operatorGameId: string | null;
  reason: string;
};

export function unresolvedPublicView(
  publicGameId: string,
  dateKst: string | null,
): PublicGameAnalysisViewV1 {
  return {
    game: {
      gameId: publicGameId,
      dateKst,
      sport: null,
      league: null,
      startTimeKst: null,
      homeTeam: null,
      awayTeam: null,
    },
    analysis: {
      state: "UNRESOLVED",
      headline: PUBLIC_UNRESOLVED_HEADLINE,
      description: PUBLIC_UNRESOLVED_DESCRIPTION,
      officialPredictionAvailable: false,
      predictedSide: null,
      probability: null,
      confidence: null,
    },
    context: {
      keyPoints: [],
      recentForm: null,
      lineup: null,
      injuries: null,
      coachTactics: null,
      teamMetrics: null,
    },
    market: null,
    meta: {
      updatedAt: null,
      disclaimer: PUBLIC_ANALYSIS_DISCLAIMER,
      preparingFallback: true,
    },
  };
}

export function legacyMigrationPublicView(
  publicGameId: string,
  dateKst: string | null,
): PublicGameAnalysisViewV1 {
  return {
    ...unresolvedPublicView(publicGameId, dateKst),
    analysis: {
      state: "LEGACY_MIGRATING",
      headline: PUBLIC_LEGACY_MIGRATION_HEADLINE,
      description: PUBLIC_LEGACY_MIGRATION_DESCRIPTION,
      officialPredictionAvailable: false,
      predictedSide: null,
      probability: null,
      confidence: null,
    },
    meta: {
      updatedAt: null,
      disclaimer: PUBLIC_ANALYSIS_DISCLAIMER,
      preparingFallback: true,
    },
  };
}

function displayTeam(name: string | null, league: string | null): string | null {
  if (!name) return null;
  return getTeamDisplayName({
    originalName: name,
    league,
  });
}

/**
 * Public-safe slice of a legacy research view.
 * Strips debug / hash / completeness / raw status.
 */
export function projectLegacyResearchToPublicView(input: {
  publicGameId: string;
  dateKst: string | null;
  research: ResearchAnalysisView;
}): PublicGameAnalysisViewV1 {
  const info = input.research.gameInfo;
  if (info.availability !== "COLLECTED" || !info.homeTeam || !info.awayTeam) {
    return legacyMigrationPublicView(input.publicGameId, input.dateKst);
  }

  const homeTeam = displayTeam(info.homeTeam, info.league);
  const awayTeam = displayTeam(info.awayTeam, info.league);
  const pred = input.research.researchPrediction;
  const official =
    pred.artifactAvailable &&
    pred.officialPick != null &&
    (pred.officialStatus === "ELIGIBLE" || pred.debugStatus === "AVAILABLE");

  return {
    game: {
      gameId: input.publicGameId,
      dateKst: info.dateKst ?? input.dateKst,
      sport: null,
      league: info.league,
      startTimeKst: info.startTimeKst,
      homeTeam,
      awayTeam,
    },
    analysis: official
      ? {
          state: "YANG_EDGE_ANALYSIS",
          headline: "YANG EDGE 분석",
          description: "이 경기의 공식 승패 분석입니다.",
          officialPredictionAvailable: true,
          predictedSide: pred.officialPick,
          probability: null,
          confidence: null,
        }
      : {
          state: "OFFICIAL_PREDICTION_DEFERRED",
          headline: "공식 승패 분석 보류",
          description:
            "현재 검증을 마친 확률 모델이 없어 승패 확률은 제공하지 않습니다.",
          officialPredictionAvailable: false,
          predictedSide: null,
          probability: null,
          confidence: null,
        },
    context: {
      keyPoints: [],
      recentForm: null,
      lineup: null,
      injuries: null,
      coachTactics: null,
      teamMetrics: null,
    },
    market: null,
    meta: {
      updatedAt: pred.predictedAt,
      disclaimer: PUBLIC_ANALYSIS_DISCLAIMER,
      preparingFallback: false,
    },
  };
}
