import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PublicAnalysisViewer from "@/components/analysis/public/PublicAnalysisViewer";
import {
  buildGamesBackPath,
  parseAnalysisPresentationIdentityFromSearch,
} from "@/lib/datetime/games-date";
import { loadPublicGameAnalysis } from "@/lib/public-analysis/load-public-game-analysis";

import {ownerRichPreviewEnabled} from '@/lib/public-analysis/load-owner-rich-preview';
import {loadResearchExplorer} from '@/lib/public-analysis/load-research-explorer';
import {TODAY_RESEARCH_BATCH,TODAY_RESEARCH_DATE} from '@/lib/public-analysis/research-explorer-contract';
import UniversalResearch from '@/components/research/UniversalResearch';
function researchDetail(gameId:string,date?:string){
 if(!ownerRichPreviewEnabled()||date!==TODAY_RESEARCH_DATE)return null;
 // Explicit active batch configuration, never a date-based batch discovery.
 return loadResearchExplorer(TODAY_RESEARCH_BATCH,TODAY_RESEARCH_DATE).details.find(d=>d.line.targetId===gameId)??null;
}
type AnalysisSearch = {
  fromDate?: string;
  sport?: string;
  league?: string;
  homeTeam?: string;
  awayTeam?: string;
  startTime?: string;
};

type AnalysisPageProps = {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<AnalysisSearch>;
};

export const dynamic = "force-dynamic";

async function loadAnalysisPage(input: {
  gameId: string;
  search: AnalysisSearch;
}) {
  const listIdentity = parseAnalysisPresentationIdentityFromSearch(input.search);
  return loadPublicGameAnalysis({
    publicGameId: input.gameId,
    fromDate: input.search.fromDate,
    listIdentity,
  });
}

export async function generateMetadata({
  params,
  searchParams,
}: AnalysisPageProps): Promise<Metadata> {
  const { gameId } = await params;
  const search = await searchParams;
  const research = researchDetail(gameId, search.fromDate);
  if (research) return { title: `${research.line.home} vs ${research.line.away} · Research | YANG EDGE`, robots: { index: false, follow: false } };
  const { view } = await loadAnalysisPage({ gameId, search });
  const titleBase =
    view.game.homeTeam && view.game.awayTeam
      ? `${view.game.homeTeam} vs ${view.game.awayTeam}`
      : "경기 분석";

  return {
    title: `${titleBase} · 경기 분석 | YANG EDGE`,
    description: "이 경기를 어떻게 봐야 하는가 — YANG EDGE 경기 분석",
    robots: { index: false, follow: false },
  };
}

export default async function AnalysisPage({
  params,
  searchParams,
}: AnalysisPageProps) {
  const { gameId } = await params;
  const search = await searchParams;
  const research = researchDetail(gameId, search.fromDate);
  if (research) return <><Header /><main><UniversalResearch detail={research} /></main><Footer /></>;
  const { view } = await loadAnalysisPage({ gameId, search });
  const gamesBackHref = buildGamesBackPath(search.fromDate, view.game.dateKst);

  return (
    <>
      <Header />
      <main>
        <PublicAnalysisViewer view={view} gamesBackHref={gamesBackHref} />
      </main>
      <Footer />
    </>
  );
}
