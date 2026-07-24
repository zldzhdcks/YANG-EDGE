import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PickHeader from "@/components/picks/PickHeader";
import PickList from "@/components/picks/PickList";
import { AI_PICKS } from "@/constants/picks";

export const metadata: Metadata = {
  title: "EDGE Ranking | YANG EDGE",
  description: "오늘 가장 가치 있는 경기를 EDGE Ranking으로 확인하세요.",
};

export default function PicksPage() {
  return (
    <>
      <Header />
      <main>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <PickHeader />
          <PickList picks={AI_PICKS} />
        </div>
      </main>
      <Footer />
    </>
  );
}
