import type { Metadata } from "next";
import { Suspense } from "react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import GamesPageContent from "@/components/games/GamesPageContent";
import Card from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "오늘 경기 | YANG EDGE",
  description: "오늘의 축구, 야구, 농구 경기를 확인하고 EDGE Detail로 이동하세요.",
};

/**
 * 경기 목록은 선택 날짜(Asia/Seoul 기준)에 따라 클라이언트에서
 * /api/games?date=YYYY-MM-DD 로 요청한다. (날짜 변경 → 재요청)
 * URL: /games?date=YYYY-MM-DD
 */
export default function GamesPage() {
  return (
    <>
      <Header />
      <main>
        <Suspense
          fallback={
            <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
              <Card padding="none" className="rounded-xl px-6 py-16 text-center">
                <p className="text-sm font-medium text-zinc-400">
                  경기 일정을 불러오는 중...
                </p>
              </Card>
            </div>
          }
        >
          <GamesPageContent />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
