import type { Metadata } from "next";
import { redirect } from "next/navigation";
import OsShell from "@/components/internal/os/OsShell";
import ResearchLabView from "@/components/internal/os/ResearchLabView";
import {
  loadYangEdgeOsPage,
  resolveOsDate,
} from "@/lib/internal/load-yang-edge-os-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "연구실 | YANG EDGE OS",
  robots: { index: false, follow: false },
};

/**
 * Research Lab — research surface only.
 * Legacy ?view=system|operator deep-links redirect to new OS sections.
 */
export default async function ResearchLabPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  const view =
    typeof searchParams.view === "string" ? searchParams.view : "research";

  if (view === "system") {
    redirect(`/internal/developer?date=${encodeURIComponent(dateKst)}`);
  }
  if (view === "operator") {
    redirect(`/internal/dashboard?date=${encodeURIComponent(dateKst)}`);
  }

  const { data, os } = await loadYangEdgeOsPage(dateKst);

  return (
    <OsShell
      active="research"
      dateKst={dateKst}
      title="연구실"
      subtitle="연구 전용 · 파이프라인 · 커버리지 · 데이터셋 · 복기 · 예측 · 분석"
    >
      {data.waitingStates.length > 0 && data.errors.length === 0 ? (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-4">
          <h2 className="text-sm font-semibold text-amber-400">운영 대기</h2>
          <ul className="mt-2 space-y-1 text-xs text-amber-200/80">
            {data.waitingStates.slice(0, 6).map((w) => (
              <li key={`${w.league}-${w.code}`}>
                • [{w.league}] {w.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ResearchLabView data={data} os={os} dateKst={dateKst} />
    </OsShell>
  );
}
