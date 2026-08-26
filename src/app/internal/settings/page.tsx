import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import SettingsView from "@/components/internal/os/SettingsView";
import {
  loadYangEdgeOsPage,
  resolveOsDate,
} from "@/lib/internal/load-yang-edge-os-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "설정 | YANG EDGE OS",
  robots: { index: false, follow: false },
};

export default async function SettingsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  const { os } = await loadYangEdgeOsPage(dateKst);

  return (
    <OsShell
      active="settings"
      dateKst={dateKst}
      title="설정"
      subtitle="대표 모드와 표시 설정"
    >
      <SettingsView os={os} dateKst={dateKst} />
    </OsShell>
  );
}
