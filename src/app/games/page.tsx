import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import GamesPageContent from "@/components/games/GamesPageContent";

export const metadata: Metadata = {
  title: "오늘 경기 | YANG EDGE",
  description: "오늘의 축구, 야구, 농구 경기를 확인하고 EDGE Detail로 이동하세요.",
};

/**
 * 경기 목록은 선택 날짜(Asia/Seoul 기준)에 따라 클라이언트에서
 * /api/games?date=YYYY-MM-DD 로 요청한다. (날짜 변경 → 재요청)
 */
export default function GamesPage() {
  return (
    <>
      <Header />
      <main>
        <GamesPageContent />
      </main>
      <Footer />
    </>
  );
}
