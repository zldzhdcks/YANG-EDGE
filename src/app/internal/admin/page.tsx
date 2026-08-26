import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import AdminToolsView from "@/components/internal/os/AdminToolsView";
import { resolveOsDate } from "@/lib/internal/load-yang-edge-os-page";
import { loadReleaseChecklistV0 } from "@/lib/internal/release-checklist-v0";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "관리자 도구 | YANG EDGE OS",
  robots: { index: false, follow: false },
};

export default async function AdminToolsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  const release = await loadReleaseChecklistV0();

  return (
    <OsShell
      active="admin"
      dateKst={dateKst}
      title="관리자 도구"
      subtitle="작업·데이터·개발 도구 · 기능은 그대로 두고 입구만 정리했습니다"
    >
      <AdminToolsView dateKst={dateKst} release={release} />
    </OsShell>
  );
}
