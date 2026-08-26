import { getTeamDisplayName } from "@/lib/teams/get-team-display-name";
import { publicCopyForCState } from "./c-state-display";
import { formatObservedAtKst } from "./format-display";
import type { DailyCGameRow } from "./daily-c-types";
import {
  PUBLIC_ANALYSIS_DISCLAIMER,
  PUBLIC_MARKET_REFERENCE_NOTE,
  type PublicGameAnalysisViewV1,
  type PublicMarketBenchmark,
} from "@/types/public-game-analysis-view";

function sportForDisplay(sport: string): "baseball" | "football" | undefined {
  if (sport === "KBO" || sport === "NPB") return "baseball";
  if (sport === "FOOTBALL") return "football";
  return undefined;
}

function leagueForDisplay(row: DailyCGameRow): string {
  if (row.sport === "KBO" || row.sport === "NPB") return row.sport;
  return row.rawLeagueLabel ?? row.sport;
}

function displayTeam(
  name: string,
  row: DailyCGameRow,
): string {
  return getTeamDisplayName({
    originalName: name,
    sport: sportForDisplay(row.sport),
    league: leagueForDisplay(row),
  });
}

function projectMarket(
  row: DailyCGameRow,
  homeTeam: string,
  awayTeam: string,
): PublicMarketBenchmark | null {
  const m = row.marketBenchmark;
  if (!m.attached) return null;
  if (m.oddsBestHome == null || m.oddsBestAway == null) {
    return null;
  }
  const observedAtLabel = formatObservedAtKst(m.observedAt);
  if (!observedAtLabel) return null;
  return {
    available: true,
    sourceType: "해외 시장",
    observedAtLabel,
    homeOdds: m.oddsBestHome,
    drawOdds: m.oddsBestDraw,
    awayOdds: m.oddsBestAway,
    homeTeam,
    awayTeam,
    marketBenchmarkOnly: true,
    referenceNote: PUBLIC_MARKET_REFERENCE_NOTE,
  };
}

export function projectDailyCRowToPublicView(input: {
  publicGameId: string;
  dateKst: string;
  row: DailyCGameRow;
  recentForm: PublicGameAnalysisViewV1["context"]["recentForm"];
  updatedAt: string | null;
}): PublicGameAnalysisViewV1 {
  const { row } = input;
  const copy = publicCopyForCState(row.cState);
  const homeSource = row.canonicalHome ?? row.rawHome;
  const awaySource = row.canonicalAway ?? row.rawAway;
  const homeTeam = displayTeam(homeSource, row);
  const awayTeam = displayTeam(awaySource, row);
  const pred = row.independentPrediction;
  const officialPredictionAvailable = pred.created === true;
  const market = projectMarket(row, homeTeam, awayTeam);

  return {
    game: {
      gameId: input.publicGameId,
      dateKst: input.dateKst,
      sport: sportForDisplay(row.sport) ?? row.sport.toLowerCase(),
      league: leagueForDisplay(row),
      startTimeKst: row.displayedStartKst,
      homeTeam,
      awayTeam,
    },
    analysis: {
      state: copy.state,
      headline: copy.headline,
      description: copy.description,
      officialPredictionAvailable,
      predictedSide: officialPredictionAvailable ? pred.predictedSide : null,
      probability: officialPredictionAvailable ? pred.independentProbability : null,
      confidence: officialPredictionAvailable ? pred.confidence : null,
    },
    context: {
      keyPoints: [],
      recentForm: input.recentForm
        ? {
            home: { ...input.recentForm.home, team: homeTeam },
            away: { ...input.recentForm.away, team: awayTeam },
          }
        : null,
      lineup: null,
      injuries: null,
      coachTactics: null,
      teamMetrics: null,
    },
    market,
    meta: {
      updatedAt: input.updatedAt,
      disclaimer: PUBLIC_ANALYSIS_DISCLAIMER,
      preparingFallback: false,
    },
  };
}
