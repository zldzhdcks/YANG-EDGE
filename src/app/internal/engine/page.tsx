import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import EngineCenterView from "@/components/internal/os/EngineCenterView";
import {
  loadYangEdgeOsPage,
  resolveOsDate,
} from "@/lib/internal/load-yang-edge-os-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Engine Center | YANG EDGE OS",
  robots: { index: false, follow: false },
};

export default async function EngineCenterPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  const { os } = await loadYangEdgeOsPage(dateKst);

  return (
    <OsShell
      active="engine"
      dateKst={dateKst}
      title="Engine Center"
      subtitle="엔진 변수 상태 · Weight 수정 없음"
    >
      <EngineCenterView os={os} />
    </OsShell>
  );
}
