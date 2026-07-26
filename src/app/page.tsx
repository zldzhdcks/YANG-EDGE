import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import TodayPick from "@/components/home/TodayPick";
import TodayGames from "@/components/home/TodayGames";
import WhyYangEdge from "@/components/home/WhyYangEdge";
import { loadTodayPick } from "@/lib/api/today-pick";
import { getSportsProvider } from "@/lib/sports";
import type { FeatureData } from "@/types/feature";
import type { SportData } from "@/types/sport";

export default async function Home() {
  const sports = getSportsProvider();
  const [pickResult, featured, todayGames] = await Promise.all([
    loadTodayPick(),
    sports.getFeaturedGames().catch((): FeatureData[] => []),
    sports.getTodayGames().catch((): SportData[] => []),
  ]);

  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <TodayPick result={pickResult} />
        <TodayGames sports={todayGames} />
        <WhyYangEdge features={featured} />
      </main>
      <Footer />
    </>
  );
}
