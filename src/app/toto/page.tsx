import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Card from "@/components/ui/Card";
import TotoPageContent from "@/components/toto/TotoPageContent";
import { getSportsProvider } from "@/lib/sports";
import type { TotoData } from "@/lib/sports";

export const metadata: Metadata = {
  title: "EDGE Combo | YANG EDGE",
  description: "축구토토 승무패를 EDGE Combo로 분석하고 조합을 생성합니다.",
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
