import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import TotoPageContent from "@/components/toto/TotoPageContent";
import { fetchToto } from "@/lib/api/toto";

export const metadata: Metadata = {
  title: "EDGE Combo | YANG EDGE",
  description: "축구토토 승무패를 EDGE Combo로 분석하고 조합을 생성합니다.",
};

export default async function TotoPage() {
  const { data } = await fetchToto();

  return (
    <>
      <Header />
      <main>
        <TotoPageContent
          round={data.round}
          budgetOptions={data.budgetOptions}
        />
      </main>
      <Footer />
    </>
  );
}
