import type { Metadata } from "next";
import { getKstToday } from "@/lib/datetime/kst";
import { loadMlbExpectedLineupIntakeView } from "@/lib/mlb/expected-lineup-observation-v0";
import MlbExpectedLineupIntakeForm from "@/components/internal/research/MlbExpectedLineupIntakeForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MLB Expected Lineup Observation | YANG EDGE Internal",
  robots: { index: false, follow: false },
};

export default async function MlbExpectedLineupIntakePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateParam =
    typeof searchParams.date === "string" ? searchParams.date.trim() : "";
  const dateKst = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : getKstToday();

  const view = await loadMlbExpectedLineupIntakeView({ dateKst });
  const s = view.summary;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <header className="border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap gap-2">
          <span className="rounded bg-zinc-700/40 px-2 py-0.5 text-xs font-semibold tracking-wider text-zinc-300">
            FALLBACK / OPERATOR EXCEPTION
          </span>
          <span className="rounded bg-teal-700/30 px-2 py-0.5 text-xs font-semibold tracking-wider text-teal-200">
            MLB EXPECTED LINEUP
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
          MLB Expected Lineup Observation
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          수동 관찰 예외 도구 · CONFIRMED 승격 금지 · 정상 경로는 Lineup Auto Refresh
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <a
            href={`/internal/research?date=${encodeURIComponent(dateKst)}`}
            className="text-sky-400 hover:underline"
          >
            ← Research Lab
          </a>
          <a
            href={`/internal/research/mlb/lineup-refresh?date=${encodeURIComponent(dateKst)}`}
            className="text-sky-400 hover:underline"
          >
            Lineup Refresh (normal)
          </a>
        </div>
      </header>

      <MlbExpectedLineupIntakeForm
        initial={{
          dateKst: view.dateKst,
          scheduleExists: view.scheduleExists,
          observationPath: view.observationPath,
          sourceBanner: view.sourceBanner,
          games: view.games,
          summaryLine: s
            ? `Teams ${s.teamLineups} · Slots ${s.expectedBattingSlots} · Pre-game ${s.preGameObservations}/${s.matchedGames}`
            : null,
        }}
      />
    </main>
  );
}
