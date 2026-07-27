import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import PickHeader from "@/components/picks/PickHeader";
import PickList from "@/components/picks/PickList";
import {
  AI_PICKS,
  EDGE_RANKING_PUBLIC_VISIBILITY,
} from "@/constants/picks";

export const metadata: Metadata = {
  title: "EDGE Ranking (샘플) | YANG EDGE",
  description:
    "고정 샘플 EDGE Ranking. 공개 내비게이션에서는 노출되지 않습니다. 실제 추천이 아닙니다.",
  robots: { index: false, follow: false },
};

export default function PicksPage() {
  return (
    <>
      <Header />
      <main>
        <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
          <div
            role="status"
            className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90"
          >
            <p className="font-medium text-amber-200">
              고정 샘플 · 개발용 (실제 Pick 아님)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
              EDGE Ranking은 현재 공개 내비게이션·홈·Footer에 링크되지 않습니다
              (상태: {EDGE_RANKING_PUBLIC_VISIBILITY}). 아래 목록은{" "}
              <code className="text-amber-100/90">AI_PICKS</code> 하드코딩
              샘플이며 MLB 연구·실일정 추천과 연결되어 있지 않습니다. 직접
              URL로만 접근합니다.
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <PickHeader />
          <PickList picks={AI_PICKS} />
        </div>
      </main>
      <Footer />
    </>
  );
}
