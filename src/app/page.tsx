import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import TodayEdgePicks from "@/components/home/TodayEdgePicks";
import TodayGames from "@/components/home/TodayGames";
import ResearchSlateGames from "@/components/home/ResearchSlateGames";
import { loadTodayEdgePicks } from "@/lib/api/today-edge-picks";
import { loadHomeGames } from "@/lib/api/home-games";
import { loadResearchSlateGames } from "@/lib/edge/load-research-slate-games";

export const dynamic = "force-dynamic";

export default async function Home() {
  const edgePickResult = await loadTodayEdgePicks();
  const targetDateKst =
    edgePickResult.status !== "error"
      ? edgePickResult.result.meta.targetDateKst
      : "";

  const [homeGames, researchGames] = await Promise.all([
    loadHomeGames(),
    targetDateKst
      ? loadResearchSlateGames(targetDateKst)
      : Promise.resolve([]),
  ]);

  const showResearchGames = researchGames.length > 0;

  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <TodayEdgePicks
          result={
            edgePickResult.status !== "error"
              ? edgePickResult.result
              : null
          }
          emptyMessage={
            edgePickResult.status === "empty"
              ? edgePickResult.message
              : edgePickResult.status === "error"
                ? edgePickResult.message
                : undefined
          }
        />
        {showResearchGames ? (
          <ResearchSlateGames
            dateKst={targetDateKst}
            games={researchGames}
          />
        ) : (
          <TodayGames result={homeGames} compactEmpty />
        )}
      </main>
      <Footer />
    </>
  );
}
