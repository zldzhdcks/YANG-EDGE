import type { PublicGameAnalysisViewV1 } from "@/types/public-game-analysis-view";
import PublicAnalysisHeader from "./PublicAnalysisHeader";
import PublicQuickPreview from "./PublicQuickPreview";
import PublicAnalysisStatus from "./PublicAnalysisStatus";
import PublicAnalysisDecision from "./PublicAnalysisDecision";
import PublicKeyPoints from "./PublicKeyPoints";
import PublicRecentForm from "./PublicRecentForm";
import PublicLineup from "./PublicLineup";
import PublicAvailability from "./PublicAvailability";
import PublicCoachTactics from "./PublicCoachTactics";
import PublicTeamMetrics from "./PublicTeamMetrics";
import PublicMarketBenchmark from "./PublicMarketBenchmark";
import PublicAnalysisFooter from "./PublicAnalysisFooter";
import {SHOWCASE_TARGET,isAtleticoShowcase} from '@/lib/public-analysis/engine-lab';
import AtleticoRealShowcase from './AtleticoRealShowcase';
import OwnerPreviewNotice from './OwnerPreviewNotice';

type Props = {
  view: PublicGameAnalysisViewV1;
  gamesBackHref: string;
};

export default function PublicAnalysisViewer({ view, gamesBackHref }: Props) {
  if(view.game.gameId===SHOWCASE_TARGET&&!view.quickPreview.rich)return <OwnerPreviewNotice local={process.env.NODE_ENV!=='production'} />;
  if(view.quickPreview.rich&&isAtleticoShowcase(view.quickPreview.rich))return <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6"><a href={gamesBackHref} className="mb-5 inline-block text-sm text-zinc-500">← 경기 목록으로</a><AtleticoRealShowcase preview={view.quickPreview.rich}/><div className="mt-5"><PublicAnalysisFooter view={view}/></div></div>;
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <PublicAnalysisHeader view={view} gamesBackHref={gamesBackHref} />
      <PublicQuickPreview preview={view.quickPreview} />
      {!view.quickPreview.rich && <PublicAnalysisStatus view={view} />}
      {!view.quickPreview.rich && <PublicAnalysisDecision view={view} />}
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
