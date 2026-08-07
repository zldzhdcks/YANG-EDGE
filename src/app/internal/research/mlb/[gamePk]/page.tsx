import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import MlbGameDetailView from "@/components/mlb/game-detail-ux/MlbGameDetailView";
import { resolveOsDate } from "@/lib/internal/load-yang-edge-os-page";
import { loadMlbGameDetailUxV1 } from "@/lib/mlb/game-detail-ux-v1";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MLB Game Detail | YANG EDGE OS",
  robots: { index: false, follow: false },
};

export default async function MlbGameDetailPage(props: {
  params: Promise<{ gamePk: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  const gamePk = Number.parseInt(params.gamePk, 10);
  const view = await loadMlbGameDetailUxV1({
    dateKst,
    gamePk: Number.isFinite(gamePk) ? gamePk : -1,
  });

  const backHref = `/internal/research/mlb?date=${encodeURIComponent(dateKst)}`;

  return (
    <OsShell
      active="research"
      dateKst={dateKst}
      title="MLB Game Detail"
      subtitle="연구 경기 상세 · Prediction hash read-only"
    >
      <MlbGameDetailView view={view} backHref={backHref} />
    </OsShell>
  );
}
