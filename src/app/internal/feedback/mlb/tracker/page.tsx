import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import GoodPickLearningTrackerView from "@/components/mlb/good-pick-feedback/GoodPickLearningTrackerView";
import { resolveOsDate } from "@/lib/internal/load-yang-edge-os-page";
import { loadGoodPickLearningTrackerV1 } from "@/lib/mlb/good-pick-learning-tracker-v1";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Good Pick Learning Tracker | YANG EDGE OS",
  robots: { index: false, follow: false },
};

/**
 * Cumulative Good Pick learning — presentation only.
 */
export default async function GoodPickLearningTrackerPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  // Acceptance window + discovered dates up to asOf
  const view = await loadGoodPickLearningTrackerV1({
    asOfDateKst: dateKst,
    dates: ["2026-08-06", "2026-08-07", "2026-08-08"],
  });

  return (
    <OsShell
      active="research"
      dateKst={dateKst}
      title="Good Pick Learning Tracker"
      subtitle="누적 성적 · Signal / Market / Margin · EARLY SAMPLE 명시"
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
          href={`/internal/feedback/mlb?date=${encodeURIComponent(dateKst)}`}
          className="text-sky-400 hover:underline"
        >
          날짜별 Feedback
        </a>
      </div>
      <GoodPickLearningTrackerView view={view} />
    </OsShell>
  );
}
