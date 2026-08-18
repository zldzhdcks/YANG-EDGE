import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import HomeBestPicks from "@/components/home/HomeBestPicks";
import HomeRecord from "@/components/home/HomeRecord";
import { loadTodayEdgePicks } from "@/lib/api/today-edge-picks";

export const dynamic = "force-dynamic";

export default async function Home() {
  const edgePickResult = await loadTodayEdgePicks();
  const selection =
    edgePickResult.status === "error" ? null : edgePickResult.result;

  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <HomeBestPicks result={selection} />
        <HomeRecord />
      </main>
      <Footer />
    </>
  );
}
