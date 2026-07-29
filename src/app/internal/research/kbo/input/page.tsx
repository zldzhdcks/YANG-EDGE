import type { Metadata } from "next";
import { getKstToday } from "@/lib/datetime/kst";
import { loadKboOperatorInputBridgeData } from "@/lib/kbo/operator-input-bridge";
import KboOperatorInputBridgeEntry from "@/components/internal/research/KboOperatorInputBridgeEntry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "KBO Operator Input | YANG EDGE Internal",
  robots: { index: false, follow: false },
};

export default async function KboOperatorInputPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateParam =
    typeof searchParams.date === "string" ? searchParams.date.trim() : "";
  const dateKst =
    /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getKstToday();
  const data = await loadKboOperatorInputBridgeData(dateKst);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header className="border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="rounded bg-amber-600/20 px-2 py-0.5 text-xs font-semibold tracking-wider text-amber-400">
            INTERNAL
          </div>
          <div className="rounded bg-red-600/20 px-2 py-0.5 text-xs font-semibold tracking-wider text-red-400">
            LOCAL / INTERNAL USE ONLY
          </div>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
          KBO OPERATOR INPUT BRIDGE
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Schedule 기준으로 오늘 KBO 배당과 라인업을 공식 operator-input 파일로 저장합니다.
        </p>
      </header>

      <KboOperatorInputBridgeEntry initialData={data} />
    </main>
  );
}
