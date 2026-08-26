import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PublicAnalysisViewer from "@/components/analysis/public/PublicAnalysisViewer";
import { buildGamesBackPath } from "@/lib/datetime/games-date";
import { loadPublicGameAnalysis } from "@/lib/public-analysis/load-public-game-analysis";

type AnalysisPageProps = {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ fromDate?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: AnalysisPageProps): Promise<Metadata> {
  const { gameId } = await params;
  const { fromDate } = await searchParams;
  const { view } = await loadPublicGameAnalysis({
    publicGameId: gameId,
    fromDate,
  });
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
  const { fromDate } = await searchParams;
  const { view } = await loadPublicGameAnalysis({
    publicGameId: gameId,
    fromDate,
  });
  const gamesBackHref = buildGamesBackPath(fromDate, view.game.dateKst);

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
