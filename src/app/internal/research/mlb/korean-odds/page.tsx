import type { Metadata } from "next";
import { getKstToday } from "@/lib/datetime/kst";
import { loadMlbKoreanMarketOddsIntakeView } from "@/lib/mlb/korean-market-odds-observation-v0";
import MlbKoreanMarketOddsIntakeForm from "@/components/internal/research/MlbKoreanMarketOddsIntakeForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MLB Korean Market Odds | YANG EDGE Internal",
  robots: { index: false, follow: false },
};

export default async function MlbKoreanMarketOddsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateParam =
    typeof searchParams.date === "string" ? searchParams.date.trim() : "";
  const dateKst = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : getKstToday();

  const view = await loadMlbKoreanMarketOddsIntakeView({ dateKst });
  const s = view.summary;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <header className="border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap gap-2">
          <span className="rounded bg-rose-700/30 px-2 py-0.5 text-xs font-semibold tracking-wider text-rose-300">
            INTERNAL
          </span>
          <span className="rounded bg-rose-700/30 px-2 py-0.5 text-xs font-semibold tracking-wider text-rose-200">
            MLB KOREAN MARKET
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
          MLB Korean Market Odds Observation
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          한국 시장 기본 승패 배당 · Provider Odds와 독립 · Prediction 불변
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <a
            href={`/internal/research?date=${encodeURIComponent(dateKst)}`}
            className="text-sky-400 hover:underline"
          >
            ← 연구실
          </a>
          <a
            href={`/internal/research/mlb?date=${encodeURIComponent(dateKst)}`}
            className="text-sky-400 hover:underline"
          >
            MLB Research UX
          </a>
          <a
            href={`/internal/research/mlb/expected-lineup?date=${encodeURIComponent(dateKst)}`}
            className="text-sky-400 hover:underline"
          >
            Expected Lineup
          </a>
        </div>
      </header>

      <MlbKoreanMarketOddsIntakeForm
        initial={{
          dateKst: view.dateKst,
          scheduleExists: view.scheduleExists,
          observationPath: view.observationPath,
          sourceBanner: view.sourceBanner,
          games: view.games,
          summaryLine: s
            ? `Observed ${s.observedGames}/${s.scheduleGames} · Pre-game ${s.preGameObservations} · Late ${s.lateGames}`
            : null,
        }}
      />
    </main>
  );
}
