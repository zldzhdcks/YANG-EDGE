import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import GoodPickFeedbackView from "@/components/mlb/good-pick-feedback/GoodPickFeedbackView";
import { resolveOsDate } from "@/lib/internal/load-yang-edge-os-page";
import { loadGoodPickFeedbackV1 } from "@/lib/mlb/good-pick-feedback-v1";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Good Pick Feedback | YANG EDGE OS",
  robots: { index: false, follow: false },
};

/**
 * MLB Good Pick Human Feedback Review v1
 * Read-only presentation over Prediction / Grade / Review artifacts.
 */
export default async function GoodPickFeedbackPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  const view = await loadGoodPickFeedbackV1({ dateKst });

  return (
    <OsShell
      active="research"
      dateKst={dateKst}
      title="Good Pick Feedback"
      subtitle="지난 추천 복기 · Before / After 분리 · Engine 변경 없음"
    >
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <a
          href={`/internal/daily?date=${encodeURIComponent(dateKst)}`}
          className="text-sky-400 hover:underline"
        >
          ← Daily Picks
        </a>
        <span className="text-zinc-600">·</span>
        <a
          href={`/internal/research/mlb?date=${encodeURIComponent(dateKst)}`}
          className="text-sky-400 hover:underline"
        >
          MLB Research UX
        </a>
      </div>
      <GoodPickFeedbackView view={view} />
    </OsShell>
  );
}
