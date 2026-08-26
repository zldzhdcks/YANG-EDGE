import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import DeveloperConsoleView from "@/components/internal/os/DeveloperConsoleView";
import {
  loadYangEdgeOsPage,
  resolveOsDate,
} from "@/lib/internal/load-yang-edge-os-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "개발자 진단 | YANG EDGE OS",
  robots: { index: false, follow: false },
};

export default async function DeveloperConsolePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  const { data } = await loadYangEdgeOsPage(dateKst);

  return (
    <OsShell
      active="developer"
      dateKst={dateKst}
      title="개발자 진단"
      subtitle="Hash / Artifact / Runtime / Logs · 개발 전용 상세"
    >
      <DeveloperConsoleView data={data} dateKst={dateKst} />
    </OsShell>
  );
}
