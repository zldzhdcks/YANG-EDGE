import type { Metadata } from "next";
import { getKstToday } from "@/lib/datetime/kst";
import {
  loadNpbStarterIntakeView,
  loadNpbStarterResearchOverlay,
} from "@/lib/npb/manual-starter-intake-v0";
import NpbStarterIntakeForm from "@/components/internal/research/NpbStarterIntakeForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NPB Starter Input | YANG EDGE Internal",
  robots: { index: false, follow: false },
};

export default async function NpbStarterIntakePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateParam =
    typeof searchParams.date === "string" ? searchParams.date.trim() : "";
  const dateKst = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : getKstToday();

  const [view, overlay] = await Promise.all([
    loadNpbStarterIntakeView({ dateKst }),
    loadNpbStarterResearchOverlay({ dateKst }),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <header className="border-b border-zinc-800 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-amber-600/20 px-2 py-0.5 text-xs font-semibold tracking-wider text-amber-400">
            INTERNAL
          </span>
          <span className="rounded bg-amber-600/20 px-2 py-0.5 text-xs font-semibold tracking-wider text-amber-300">
            NPB STARTER INPUT
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-white">
          NPB Starter Input
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          예고 선발을 수동 확인하고 operator-input에 저장합니다. Prediction
          Engine / Provider artifact를 덮어쓰지 않습니다.
        </p>
        <p className="mt-2 text-sm text-emerald-300/90">{overlay.line}</p>
        <a
          href={`/internal/research?date=${encodeURIComponent(dateKst)}`}
          className="mt-3 inline-block text-xs text-sky-400 hover:underline"
        >
          ← 연구실
        </a>
      </header>

      <NpbStarterIntakeForm
        initial={{
          ...view,
          overlayLine: overlay.line,
        }}
      />
    </main>
  );
}
