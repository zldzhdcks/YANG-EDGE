"use client";

import dynamic from "next/dynamic";
import type { KboT45AdminLoadResult } from "@/lib/kbo/t45-personnel/admin-view-types";

const KboT45PersonnelAdmin = dynamic(
  () => import("./KboT45PersonnelAdmin"),
  { ssr: false, loading: () => <p className="text-sm text-zinc-500">Loading admin form…</p> },
);

export default function KboT45PersonnelAdminEntry({
  initialData,
}: {
  initialData: KboT45AdminLoadResult;
}) {
  return <KboT45PersonnelAdmin initialData={initialData} />;
}
