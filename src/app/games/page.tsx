import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import GamesPageContent from "@/components/games/GamesPageContent";
import { getSportsProvider } from "@/lib/sports";

export const metadata: Metadata = {
  title: "오늘 경기 | YANG EDGE",
  description: "오늘의 축구, 야구, 농구 경기를 확인하고 EDGE Detail로 이동하세요.",
};

export default async function GamesPage() {
  const games = await getSportsProvider().getGames();

  return (
    <>
      <Header />
      <main>
        <GamesPageContent games={games} />
      </main>
      <Footer />
    </>
  );
}
