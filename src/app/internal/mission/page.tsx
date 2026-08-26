import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import MissionControlView from "@/components/internal/os/MissionControlView";
import {
  loadYangEdgeOsPage,
  resolveOsDate,
} from "@/lib/internal/load-yang-edge-os-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "작업 관리 | YANG EDGE OS",
  robots: { index: false, follow: false },
};

export default async function MissionPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  const { os, memory } = await loadYangEdgeOsPage(dateKst);

  return (
    <OsShell
      active="mission"
      dateKst={dateKst}
      title="작업 관리"
      subtitle="오늘 해야 하는 작업만 보여줍니다"
    >
      <MissionControlView os={os} memory={memory} />
    </OsShell>
  );
}
