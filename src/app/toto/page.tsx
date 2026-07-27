import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Card from "@/components/ui/Card";
import TotoPageContent from "@/components/toto/TotoPageContent";
import { EDGE_COMBO_PUBLIC_VISIBILITY } from "@/constants/toto";
import { getSportsProvider } from "@/lib/sports";
import type { TotoData } from "@/lib/sports";

export const metadata: Metadata = {
  title: "EDGE Combo (내부) | YANG EDGE",
  description:
    "내부·개인 연구용 EDGE Combo. 공개 내비게이션에서는 노출되지 않습니다.",
  robots: { index: false, follow: false },
};

export default async function TotoPage() {
  let toto: TotoData | null = null;
  try {
    toto = await getSportsProvider().getToto();
  } catch {
    toto = null;
  }

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
              내부·개인 연구용 기능 (공개 UI 비노출)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
              EDGE Combo는 현재 공개 내비게이션·홈·Footer에 링크되지 않습니다
              (상태: {EDGE_COMBO_PUBLIC_VISIBILITY}). 직접 URL로만 접근하며,
              추후 축구 연구 재개 시 공개 여부를 다시 검토합니다.
            </p>
          </div>
        </div>
        {toto ? (
          <TotoPageContent
            round={toto.round}
            budgetOptions={toto.budgetOptions}
          />
        ) : (
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <Card padding="lg" className="rounded-xl">
              <p className="text-sm text-zinc-400">
                EDGE Combo 데이터를 불러오지 못했습니다. 잠시 후 다시 확인해
                주세요.
              </p>
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
