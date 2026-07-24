import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AnalysisContent from "@/components/analysis/AnalysisContent";
import { DummyAnalysisData } from "@/constants/dummyAnalysisData";
import { buildAnalysisView } from "@/lib/edge/to-analysis-view";
import { getSportsProvider } from "@/lib/sports";

type AnalysisPageProps = {
  params: Promise<{ gameId: string }>;
};

function resolveEngineInput(gameId: string) {
  if (gameId === DummyAnalysisData.gameId) {
    return DummyAnalysisData;
  }
  return null;
}

export async function generateMetadata({
  params,
}: AnalysisPageProps): Promise<Metadata> {
  const { gameId } = await params;
  const engineInput = resolveEngineInput(gameId);

  if (!engineInput) {
    return { title: "EDGE Detail | YANG EDGE" };
  }

  const view = buildAnalysisView(engineInput);
  return {
    title: `${view.homeTeam} vs ${view.awayTeam} | YANG EDGE`,
    description: view.summary,
  };
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { gameId } = await params;
  const engineInput = resolveEngineInput(gameId);
  const games = await getSportsProvider().getGames();
  const gameExists = games.some((game) => game.id === gameId);

  if (!engineInput) {
    return (
      <>
        <Header />
        <main>
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <p className="text-sm text-zinc-400">
              {gameExists
                ? "이 경기의 EDGE Engine 데이터가 아직 준비되지 않았습니다."
                : "경기를 찾을 수 없습니다."}
            </p>
            <Link
              href="/games"
              className="mt-8 inline-flex text-sm text-blue-400 hover:text-blue-300"
            >
              ← 오늘 경기로 돌아가기
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const analysis = buildAnalysisView(engineInput);

  return (
    <>
      <Header />
      <main>
        <AnalysisContent analysis={analysis} />
      </main>
      <Footer />
    </>
  );
}
