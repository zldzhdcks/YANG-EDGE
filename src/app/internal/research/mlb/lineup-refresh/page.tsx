import type { Metadata } from "next";
import { getKstToday } from "@/lib/datetime/kst";
import { loadLineupRefreshManifest } from "@/lib/mlb/lineup-refresh-v1";
import MlbLineupRefreshStatusView from "@/components/internal/research/MlbLineupRefreshStatusView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MLB Lineup Refresh | YANG EDGE Internal",
  robots: { index: false, follow: false },
};

export default async function MlbLineupRefreshPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateParam =
    typeof searchParams.date === "string" ? searchParams.date.trim() : "";
  const dateKst = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : getKstToday();
  const manifest = await loadLineupRefreshManifest({ dateKst });

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <header className="border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap gap-2">
          <span className="rounded bg-sky-700/30 px-2 py-0.5 text-xs font-semibold tracking-wider text-sky-300">
            INTERNAL
          </span>
          <span className="rounded bg-sky-700/30 px-2 py-0.5 text-xs font-semibold tracking-wider text-sky-200">
            MLB LINEUP REFRESH · NORMAL PATH
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
          MLB Lineup Auto Refresh
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Provider lineup snapshots · per-game cutoff · PRE_GAME requires
          source or capture timestamp &lt; cutoff · Prediction 불변
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <a
            href={`/internal/research?date=${encodeURIComponent(dateKst)}`}
            className="text-sky-400 hover:underline"
          >
            ← 연구실
          </a>
          <a
            href={`/internal/research/mlb/expected-lineup?date=${encodeURIComponent(dateKst)}`}
            className="text-zinc-400 hover:underline"
          >
            Expected Lineup fallback
          </a>
        </div>
      </header>
      <MlbLineupRefreshStatusView dateKst={dateKst} manifest={manifest} />
    </main>
  );
}
