import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import EngineCenterView from "@/components/internal/os/EngineCenterView";
import {
  loadYangEdgeOsPage,
  resolveOsDate,
} from "@/lib/internal/load-yang-edge-os-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "엔진 상태 | YANG EDGE OS",
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
      title="엔진 상태"
      subtitle="엔진 변수 상태 · 가중치 수정 없음"
    >
      <EngineCenterView os={os} />
    </OsShell>
  );
}
