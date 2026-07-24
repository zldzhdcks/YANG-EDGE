import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AnalysisContent from "@/components/analysis/AnalysisContent";
import { fetchAnalysis } from "@/lib/api/analysis";
import { fetchGames } from "@/lib/api/games";

type AnalysisPageProps = {
  params: Promise<{ gameId: string }>;
};

export async function generateMetadata({
  params,
}: AnalysisPageProps): Promise<Metadata> {
  const { gameId } = await params;
  const { data: analysis } = await fetchAnalysis(gameId);

  if (!analysis) {
    return { title: "EDGE Detail | YANG EDGE" };
  }

  return {
    title: `${analysis.homeTeam} vs ${analysis.awayTeam} | YANG EDGE`,
    description: analysis.summary,
  };
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { gameId } = await params;
  const [analysisResult, gamesResult] = await Promise.all([
    fetchAnalysis(gameId),
    fetchGames(),
  ]);

  const analysis = analysisResult.data;
  const gameExists = gamesResult.data.some((game) => game.id === gameId);

  return (
    <>
      <Header />
      <main>
        {analysis ? (
          <AnalysisContent analysis={analysis} />
        ) : (
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <p className="text-sm text-zinc-400">
              {gameExists
                ? "이 경기의 EDGE 데이터가 아직 준비되지 않았습니다."
                : "경기를 찾을 수 없습니다."}
            </p>
            <Link
              href="/games"
              className="mt-8 inline-flex text-sm text-blue-400 hover:text-blue-300"
            >
              ← 오늘 경기로 돌아가기
            </Link>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
