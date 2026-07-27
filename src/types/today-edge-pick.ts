export type TodayEdgePickRisk = "LOW" | "MEDIUM" | "HIGH";
export type TodayEdgePickTier = "EDGE_PICK" | "RESEARCH_CANDIDATE";
export type EdgeSlateStatus =
  | "UPCOMING"
  | "NO_UPCOMING_SNAPSHOT"
  | "NO_ELIGIBLE_PICKS";
export type TodayEdgeSelectionMode =
  | "STRICT_ONLY"
  | "MIXED"
  | "RESEARCH_CANDIDATES_ONLY"
  | "EMPTY";

export type TodayEdgePick = {
  gameId: string;
  league: string;
  home: string;
  away: string;
  startTimeKst: string;
  prediction: string;
  confidence: number;
  modelProbability: number | null;
  valueEdge: number | null;
  risk: TodayEdgePickRisk;
  riskLabel: string;
  pickTier: TodayEdgePickTier;
  rank: 1 | 2 | 3;
  todayEdgeRank: 1 | 2 | 3;
  selectionReasons: string[];
  selectionReasonLabels: string[];
  missingReasons: string[];
  missingReasonLabels: string[];
  generatedAt: string;
};

export type TodayEdgePickExcluded = {
  gameId: string;
  home: string;
  away: string;
  reasons: string[];
};

export type TodayEdgePickSelectionMeta = {
  targetDateKst: string;
  generatedAt: string;
  slateStatus: EdgeSlateStatus;
  nextScheduledDateKst: string | null;
  candidateCount: number;
  selectedCount: number;
  strictSelectedCount: number;
  researchCandidateCount: number;
  selectionMode: TodayEdgeSelectionMode;
  excludedCount: number;
  strictExclusionCounts: Record<string, number>;
  predictionHashSha256: string | null;
};

export type TodayEdgePickSelectionResult = {
  meta: TodayEdgePickSelectionMeta;
  picks: TodayEdgePick[];
  excluded: TodayEdgePickExcluded[];
};

export type TodayEdgePicksLoadResult =
  | {
      status: "success";
      result: TodayEdgePickSelectionResult;
    }
  | {
      status: "empty";
      result: TodayEdgePickSelectionResult;
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

export type ResearchSlateGame = {
  gameId: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTimeKst: string;
};
