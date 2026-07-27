import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ResearchAnalysisViewer from "@/components/analysis/ResearchAnalysisViewer";
import SampleAnalysisNotice from "@/components/home/SampleAnalysisNotice";
import { buildGamesBackPath } from "@/lib/datetime/games-date";
import { loadResearchAnalysisView } from "@/lib/research/load-research-analysis-view";

type AnalysisPageProps = {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ fromDate?: string }>;
};

export async function generateMetadata({
  params,
}: AnalysisPageProps): Promise<Metadata> {
  const { gameId } = await params;
  const view = await loadResearchAnalysisView(gameId);
  const titleBase =
    view.gameInfo.availability === "COLLECTED"
      ? view.gameInfo.matchLabel
      : gameId;

  return {
    title: `${titleBase} · 경기 연구 보기 | YANG EDGE`,
    description:
      "경기 연구 보기 — 읽기 전용 연구 artifact. 실추천이 아닙니다.",
    robots: { index: false, follow: false },
  };
}

export default async function AnalysisPage({
  params,
  searchParams,
}: AnalysisPageProps) {
  const { gameId } = await params;
  const { fromDate } = await searchParams;
  const view = await loadResearchAnalysisView(gameId);
  const gamesBackHref = buildGamesBackPath(
    fromDate,
    view.gameInfo.dateKst,
  );

  return (
    <>
      <Header />
      <main>
        <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
          <SampleAnalysisNotice />
        </div>
        <ResearchAnalysisViewer view={view} gamesBackHref={gamesBackHref} />
      </main>
      <Footer />
    </>
  );
}
