import type { PublicGameAnalysisViewV1 } from "@/types/public-game-analysis-view";
import PublicAnalysisHeader from "./PublicAnalysisHeader";
import PublicAnalysisDecision from "./PublicAnalysisDecision";
import PublicKeyPoints from "./PublicKeyPoints";
import PublicRecentForm from "./PublicRecentForm";
import PublicLineup from "./PublicLineup";
import PublicAvailability from "./PublicAvailability";
import PublicCoachTactics from "./PublicCoachTactics";
import PublicTeamMetrics from "./PublicTeamMetrics";
import PublicMarketBenchmark from "./PublicMarketBenchmark";
import PublicAnalysisFooter from "./PublicAnalysisFooter";

type Props = {
  view: PublicGameAnalysisViewV1;
  gamesBackHref: string;
};

export default function PublicAnalysisViewer({ view, gamesBackHref }: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <PublicAnalysisHeader view={view} gamesBackHref={gamesBackHref} />
      <PublicAnalysisDecision view={view} />
      <PublicKeyPoints points={view.context.keyPoints} />
      <PublicRecentForm recentForm={view.context.recentForm} />
      <PublicLineup lineup={view.context.lineup} />
      <PublicAvailability availability={view.context.injuries} />
      <PublicCoachTactics coachTactics={view.context.coachTactics} />
      <PublicTeamMetrics teamMetrics={view.context.teamMetrics} />
      <PublicMarketBenchmark market={view.market} />
      <PublicAnalysisFooter view={view} />
    </div>
  );
}
