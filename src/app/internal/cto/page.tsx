import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import CtoRoomView from "@/components/internal/os/CtoRoomView";
import {
  loadYangEdgeOsPage,
  resolveOsDate,
} from "@/lib/internal/load-yang-edge-os-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "운영 보고 | YANG EDGE OS",
  robots: { index: false, follow: false },
};

export default async function CtoPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  const { os, memory } = await loadYangEdgeOsPage(dateKst);

  return (
    <OsShell
      active="cto"
      dateKst={dateKst}
      title="운영 보고"
      subtitle="주간 운영 보고 · 결정 기록"
    >
      <CtoRoomView os={os} memory={memory} />
    </OsShell>
  );
}
