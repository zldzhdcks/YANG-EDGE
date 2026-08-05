import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import DashboardView from "@/components/internal/os/DashboardView";
import {
  loadYangEdgeOsPage,
  resolveOsDate,
} from "@/lib/internal/load-yang-edge-os-page";
import { loadReleaseChecklistV0 } from "@/lib/internal/release-checklist-v0";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard | YANG EDGE OS",
  robots: { index: false, follow: false },
};

export default async function DashboardPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  const [{ data, os, memory }, release] = await Promise.all([
    loadYangEdgeOsPage(dateKst),
    loadReleaseChecklistV0(),
  ]);

  return (
    <OsShell
      active="dashboard"
      dateKst={dateKst}
      title="Dashboard"
      subtitle="Release · 오늘 상태를 5초 안에 파악합니다"
    >
      {data.errors.length > 0 ? (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">
          일부 데이터를 불러오지 못했습니다. Developer Console에서 상세를 확인하세요.
        </div>
      ) : null}
      <DashboardView os={os} memory={memory} release={release} />
    </OsShell>
  );
}
