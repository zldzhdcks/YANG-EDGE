import type { AnalysisPresentationIdentity } from "@/lib/datetime/games-date";
import { applyListIdentityFallback } from "./apply-list-identity";
import { projectQuickPreview } from "./project-quick-preview";
import { mandatoryPreviewContract, type PreviewPriorityInput } from "./preview-priority";
import type { PublicGameAnalysisViewV1 } from "@/types/public-game-analysis-view";

function identityBasis(
  before: PublicGameAnalysisViewV1["game"],
  after: PublicGameAnalysisViewV1["game"],
): PublicGameAnalysisViewV1["quickPreview"]["basis"] {
  const afterTeams = Boolean(after.homeTeam && after.awayTeam);
  if (!afterTeams) return "NONE";
  const beforeTeams = Boolean(before.homeTeam && before.awayTeam);
  return beforeTeams ? "ANALYSIS_IDENTITY" : "LIST_METADATA";
}

export function finalizePublicAnalysisView(
  view: PublicGameAnalysisViewV1,
  listIdentity?: AnalysisPresentationIdentity | null,
  priorityContext?: Pick<PreviewPriorityInput, "previewPriority" | "matchKind">,
): PublicGameAnalysisViewV1 {
  const filled = applyListIdentityFallback(view, listIdentity);
  return {
    ...filled,
    quickPreview: { ...projectQuickPreview({
      homeTeam: filled.game.homeTeam,
      awayTeam: filled.game.awayTeam,
      league: filled.game.league,
      startTimeKst: filled.game.startTimeKst,
      state: filled.analysis.state,
      officialPredictionAvailable: filled.analysis.officialPredictionAvailable,
      identityBasis: identityBasis(view.game, filled.game),
    }), priority: mandatoryPreviewContract({
      targetId: filled.game.gameId,
      sport: filled.game.sport,
      home: filled.game.homeTeam,
      away: filled.game.awayTeam,
      ...priorityContext,
      predictionAvailable: filled.analysis.officialPredictionAvailable,
      predictionReason: filled.analysis.description,
      updatedAt: filled.meta.updatedAt,
    }) },
  };
}
