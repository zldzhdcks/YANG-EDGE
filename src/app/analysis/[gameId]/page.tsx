import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PublicAnalysisViewer from "@/components/analysis/public/PublicAnalysisViewer";
import {
  buildGamesBackPath,
  parseAnalysisPresentationIdentityFromSearch,
} from "@/lib/datetime/games-date";
import { loadPublicGameAnalysis } from "@/lib/public-analysis/load-public-game-analysis";

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
