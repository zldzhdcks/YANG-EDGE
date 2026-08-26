import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import DashboardView from "@/components/internal/os/DashboardView";
import {
  loadYangEdgeOsPage,
  resolveOsDate,
} from "@/lib/internal/load-yang-edge-os-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "대시보드 | YANG EDGE OS",
  robots: { index: false, follow: false },
};

export default async function DashboardPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  const { data, os, memory } = await loadYangEdgeOsPage(dateKst);

  return (
    <OsShell
      active="dashboard"
      dateKst={dateKst}
      title="대시보드"
      subtitle="오늘 운영을 5초 안에 파악합니다"
    >
      {data.errors.length > 0 ? (
        <div className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">
          일부 운영 정보를 불러오지 못했습니다. 관리자 도구의 개발자 진단에서 확인할 수
          있습니다.
        </div>
      ) : null}
      <DashboardView os={os} memory={memory} />
    </OsShell>
  );
}
