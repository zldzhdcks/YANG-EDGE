import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import TodayPick from "@/components/home/TodayPick";
import TodayGames from "@/components/home/TodayGames";
import WhyYangEdge from "@/components/home/WhyYangEdge";
import { loadTodayPick } from "@/lib/api/today-pick";
import { loadHomeGames } from "@/lib/api/home-games";

export default async function Home() {
  const [pickResult, homeGames] = await Promise.all([
    loadTodayPick(),
    loadHomeGames(),
  ]);

  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <TodayPick result={pickResult} />
        <TodayGames result={homeGames} />
        <WhyYangEdge result={homeGames} />
      </main>
      <Footer />
    </>
  );
}
