import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import TodayPick from "@/components/home/TodayPick";
import TodayGames from "@/components/home/TodayGames";
import WhyYangEdge from "@/components/home/WhyYangEdge";
import { getSportsProvider } from "@/lib/sports";

export default async function Home() {
  const sports = getSportsProvider();
  const [pick, todayGames, featured] = await Promise.all([
    sports.getTodayPick(),
    sports.getTodayGames(),
    sports.getFeatured(),
  ]);

  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <TodayPick pick={pick} />
        <TodayGames sports={todayGames} />
        <WhyYangEdge features={featured} />
      </main>
      <Footer />
    </>
  );
}
