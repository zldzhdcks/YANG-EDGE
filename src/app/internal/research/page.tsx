import type { Metadata } from "next";
import { getKstToday } from "@/lib/datetime/kst";
import { loadResearchLabData } from "@/lib/internal/research-lab-reader";
import { buildOperatorPresentation } from "@/lib/internal/research-lab-presenter";
import OperatorHome from "@/components/internal/research/OperatorHome";
import SystemDetail from "@/components/internal/research/SystemDetail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research Lab | YANG EDGE Internal",
  robots: { index: false, follow: false },
};

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
}

type ViewMode = "operator" | "system";

function parseView(v: unknown): ViewMode {
  if (v === "system") return "system";
  return "operator";
}

export default async function ResearchLabPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateParam =
    typeof searchParams.date === "string" ? searchParams.date.trim() : "";
  const dateKst = isValidDate(dateParam) ? dateParam : getKstToday();
  const view = parseView(searchParams.view);
  const data = await loadResearchLabData(dateKst);
  const op = buildOperatorPresentation(data);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
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
          YANG EDGE RESEARCH LAB
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Internal Research Console · Not for Public Use
        </p>
        {/* TODO: Implement real authentication before public deployment */}
        <div className="mt-3 flex items-baseline gap-4">
          <span className="text-lg font-semibold text-zinc-200">{dateKst}</span>
          <span className="text-xs text-zinc-500">KST 기준</span>
          {dateParam && dateParam !== dateKst && (
            <span className="text-xs text-amber-400">
              (입력 날짜 무효 → KST 오늘로 fallback)
            </span>
          )}
        </div>

        {/* View tabs */}
        <div className="mt-4 flex gap-1">
          <a
            href={`/internal/research?date=${dateKst}&view=operator`}
            className={`rounded-t px-4 py-1.5 text-sm font-medium transition-colors ${
              view === "operator"
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            운영 홈
          </a>
          <a
            href={`/internal/research?date=${dateKst}&view=system`}
            className={`rounded-t px-4 py-1.5 text-sm font-medium transition-colors ${
              view === "system"
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            시스템 상세
          </a>
        </div>
      </header>

      {/* Errors */}
      {data.errors.length > 0 && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-4">
          <h2 className="text-sm font-semibold text-red-400">Load Errors</h2>
          <ul className="mt-2 space-y-1 text-xs text-red-300">
            {data.errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* View content */}
      {view === "operator" ? (
        <OperatorHome data={data} op={op} dateKst={dateKst} />
      ) : (
        <SystemDetail data={data} dateKst={dateKst} />
      )}

      <footer className="border-t border-zinc-800 pt-4 text-xs text-zinc-600">
        Generated at {data.generatedAt} · Research Lab v1 · Read-only
      </footer>
    </main>
  );
}
