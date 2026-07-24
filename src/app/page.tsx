import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import TodayPick from "@/components/home/TodayPick";
import TodayGames from "@/components/home/TodayGames";
import WhyYangEdge from "@/components/home/WhyYangEdge";
import {
  fetchFeatured,
  fetchTodayGames,
  fetchTodayPick,
} from "@/lib/api";

export default async function Home() {
  const [pickResult, gamesResult, featuredResult] = await Promise.all([
    fetchTodayPick(),
    fetchTodayGames(),
    fetchFeatured(),
  ]);

  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <TodayPick pick={pickResult.data} />
        <TodayGames sports={gamesResult.data} />
        <WhyYangEdge features={featuredResult.data} />
      </main>
      <Footer />
    </>
  );
}
