import type { Metadata } from "next";
import { getKstToday } from "@/lib/datetime/kst";
import {
  loadNpbMarketOddsIntakeView,
  loadNpbPregameResearchReadiness,
} from "@/lib/npb/manual-market-odds-v0";
import NpbMarketOddsIntakeForm from "@/components/internal/research/NpbMarketOddsIntakeForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NPB Market Odds Input | YANG EDGE Internal",
  robots: { index: false, follow: false },
};

export default async function NpbMarketOddsIntakePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateParam =
    typeof searchParams.date === "string" ? searchParams.date.trim() : "";
  const dateKst = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : getKstToday();

  const [view, readiness] = await Promise.all([
    loadNpbMarketOddsIntakeView({ dateKst }),
    loadNpbPregameResearchReadiness({ dateKst }),
  ]);

  const verified = view.summary?.preGameVerifiedGames ?? 0;
  const total = view.games.length || 6;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <header className="border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap gap-2">
          <span className="rounded bg-amber-600/20 px-2 py-0.5 text-xs font-semibold tracking-wider text-amber-400">
            INTERNAL
          </span>
          <span className="rounded bg-amber-600/20 px-2 py-0.5 text-xs font-semibold tracking-wider text-amber-300">
            NPB MARKET ODDS
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
          NPB Market Odds Input
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Moneyline(승패)만 수동 확인 저장. Provider Odds를 덮어쓰지 않습니다.
        </p>
        <p className="mt-2 text-sm text-emerald-300/90">
          {verified}/{total} VERIFIED
          {verified === total && total > 0 ? " · PRE_GAME" : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <a
            href={`/internal/research?date=${encodeURIComponent(dateKst)}`}
            className="text-sky-400 hover:underline"
          >
            ← 연구실
          </a>
          <a
            href={`/internal/research/npb/starter?date=${encodeURIComponent(dateKst)}`}
            className="text-sky-400 hover:underline"
          >
            NPB Starter Input
          </a>
        </div>
      </header>

      <NpbMarketOddsIntakeForm
        initial={{
          dateKst: view.dateKst,
          scheduleExists: view.scheduleExists,
          confirmationPath: view.confirmationPath,
          sourceBanner: view.sourceBanner,
          games: view.games,
          readinessLines: [
            readiness.schedule.line,
            readiness.starter.line,
            readiness.marketOdds.line,
            readiness.lineup.line,
            readiness.prediction.line,
            readiness.evidenceSnapshot?.line ?? "Snapshot: NOT FROZEN",
          ],
        }}
      />
    </main>
  );
}
