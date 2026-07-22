import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import TodayPick from "@/components/home/TodayPick";
import TodayGames from "@/components/home/TodayGames";
import WhyYangEdge from "@/components/home/WhyYangEdge";
import { TODAY_PICK } from "@/constants/todayPick";
import { TODAY_GAMES } from "@/constants/todayGames";
import { FEATURES } from "@/constants/features";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <TodayPick pick={TODAY_PICK} />
        <TodayGames sports={TODAY_GAMES} />
        <WhyYangEdge features={FEATURES} />
      </main>
      <Footer />
    </>
  );
}
