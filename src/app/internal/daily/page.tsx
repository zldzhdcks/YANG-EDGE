import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import DailyPicksView from "@/components/mlb/daily-picks/DailyPicksView";
import { GoodPickFeedbackTeaser } from "@/components/mlb/good-pick-feedback/GoodPickFeedbackView";
import { GoodPickRecordCard } from "@/components/mlb/good-pick-feedback/GoodPickLearningTrackerView";
import { shiftKstDate } from "@/lib/datetime/games-date";
import { resolveOsDate } from "@/lib/internal/load-yang-edge-os-page";
import { loadDailyPicksV1 } from "@/lib/mlb/daily-picks-v1";
import { loadGoodPickFeedbackV1 } from "@/lib/mlb/good-pick-feedback-v1";
import { loadGoodPickLearningTrackerV1 } from "@/lib/mlb/good-pick-learning-tracker-v1";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily Picks | YANG EDGE OS",
  robots: { index: false, follow: false },
};

/**
 * Daily Picks v1 — morning briefing presentation layer.
 * Read-only over Prediction Snapshot / Research / Review artifacts.
 * Does not change Engine / Prediction / weights / datasets.
 */
export default async function DailyPicksPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  const yesterdayKst = shiftKstDate(dateKst, -1);
  const [view, yesterdayFeedback, tracker] = await Promise.all([
    loadDailyPicksV1({ dateKst }),
    loadGoodPickFeedbackV1({ dateKst: yesterdayKst }),
    loadGoodPickLearningTrackerV1({
      asOfDateKst: dateKst,
      dates: ["2026-08-06", "2026-08-07", "2026-08-08"],
    }),
  ]);

  return (
    <OsShell
      active="research"
      dateKst={dateKst}
      title="Daily Picks"
      subtitle="아침 30초 브리핑 · Prediction 읽기 전용 · Engine 변경 없음"
    >
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <a
          href={`/internal/research?date=${encodeURIComponent(dateKst)}`}
          className="text-sky-400 hover:underline"
        >
          ← Research Lab
        </a>
        <span className="text-zinc-600">·</span>
        <a
          href={`/internal/research/mlb?date=${encodeURIComponent(dateKst)}`}
          className="text-sky-400 hover:underline"
        >
          MLB Research UX
        </a>
        <span className="text-zinc-600">·</span>
        <a
          href={`/internal/feedback/mlb?date=${encodeURIComponent(yesterdayKst)}`}
          className="text-sky-400 hover:underline"
        >
          지난 추천 복기
        </a>
        <span className="text-zinc-600">·</span>
        <a
          href={`/internal/feedback/mlb/tracker?date=${encodeURIComponent(dateKst)}`}
          className="text-sky-400 hover:underline"
        >
          Learning Tracker
        </a>
      </div>
      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <GoodPickRecordCard
          view={tracker}
          href={`/internal/feedback/mlb/tracker?date=${encodeURIComponent(dateKst)}`}
        />
        <GoodPickFeedbackTeaser
          view={yesterdayFeedback}
          href={`/internal/feedback/mlb?date=${encodeURIComponent(yesterdayKst)}`}
        />
      </div>
      <DailyPicksView view={view} />
    </OsShell>
  );
}
