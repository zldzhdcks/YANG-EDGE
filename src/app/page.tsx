import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import TodayPick from "@/components/home/TodayPick";
import TodayGames from "@/components/home/TodayGames";
import WhyYangEdge from "@/components/home/WhyYangEdge";
import { getSportsProvider } from "@/lib/sports";

export default async function Home() {
  const sports = getSportsProvider();
  const [pick, featured, todayGames] = await Promise.all([
    sports.getTodayPick(),
    sports.getFeaturedGames(),
    sports.getTodayGames(),
  ]);

  return (
    <>
      <Header />
      <main>
        <HeroSection />
        {pick ? <TodayPick pick={pick} /> : null}
        <TodayGames sports={todayGames} />
        <WhyYangEdge features={featured} />
      </main>
      <Footer />
    </>
  );
}
