import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Card from "@/components/ui/Card";
import KboOddsComparisonCard from "@/components/kbo/KboOddsComparisonCard";
import { loadKboOddsComparisonDocument } from "@/lib/kbo/odds-comparison/load-kbo-odds-comparison";

export const metadata: Metadata = {
  title: "KBO 국내·해외 배당 | YANG EDGE",
  description:
    "운영자 입력 국내 배당과 해외 Provider 배당의 단순 비교입니다. 추천·구매 지시가 아닙니다.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const DEFAULT_TARGET_DATE = "2026-07-28";

export default async function KboOddsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const targetDate =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : DEFAULT_TARGET_DATE;
  const document = await loadKboOddsComparisonDocument(targetDate);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium text-zinc-400">KBO 국내·해외 배당</p>
          <h1 className="text-2xl font-semibold text-white">
            KBO 시장 배당 비교
          </h1>
          <p className="max-w-3xl text-sm text-zinc-400">
            운영자 입력 국내 배당과 해외 Provider 배당의 단순 비교입니다.
            추천·구매 지시가 아닙니다.
          </p>
        </div>

        {!document ? (
          <Card padding="md">
            <p className="text-sm text-zinc-400">
              배당 비교 artifact가 없습니다. 먼저{" "}
              <code>{`npm run research:kbo-odds-comparison -- ${targetDate}`}</code>
              {" "}를 실행하세요.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {document.rows.map((row) => (
              <KboOddsComparisonCard key={row.gameId} row={row} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
