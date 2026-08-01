import type { Metadata } from "next";
import { getKstToday } from "@/lib/datetime/kst";
import { loadKboT45AdminView } from "@/lib/kbo/t45-personnel/admin-api";
import KboT45PersonnelAdminEntry from "@/components/internal/kbo/KboT45PersonnelAdminEntry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "KBO T45 Personnel | YANG EDGE Internal",
  robots: { index: false, follow: false },
};

export default async function KboT45PersonnelPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateParam =
    typeof searchParams.date === "string" ? searchParams.date.trim() : "";
  const dateKst = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : getKstToday();
  const data = await loadKboT45AdminView({ dateKst });

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header className="border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded bg-amber-600/20 px-2 py-0.5 text-xs font-semibold tracking-wider text-amber-400">
            INTERNAL
          </div>
          <div className="rounded bg-red-600/20 px-2 py-0.5 text-xs font-semibold tracking-wider text-red-400">
            LOCAL / INTERNAL USE ONLY
          </div>
          <div className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-semibold tracking-wider text-zinc-400">
            AUTH NOT FULLY IMPLEMENTED
          </div>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
          KBO T45 PERSONNEL ADMIN
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          관리자 확인 선발·타순·국내 프로토 입력. 공식 Provider 데이터와 동일하지 않습니다.
          T30 Lock은 이 화면에서 실행하지 않습니다.
        </p>
      </header>

      <KboT45PersonnelAdminEntry initialData={data} />
    </main>
  );
}
