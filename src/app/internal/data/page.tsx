import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import DataCenterView from "@/components/internal/os/DataCenterView";
import {
  loadYangEdgeOsPage,
  resolveOsDate,
} from "@/lib/internal/load-yang-edge-os-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "데이터 현황 | YANG EDGE OS",
  robots: { index: false, follow: false },
};

export default async function DataCenterPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  const { os } = await loadYangEdgeOsPage(dateKst);

  return (
    <OsShell
      active="data"
      dateKst={dateKst}
      title="데이터 현황"
      subtitle="종목별 데이터 누적 현황"
    >
      <DataCenterView os={os} />
    </OsShell>
  );
}
