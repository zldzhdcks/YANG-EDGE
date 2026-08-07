import type { Metadata } from "next";
import OsShell from "@/components/internal/os/OsShell";
import { GoodPickFeedbackTeaser } from "@/components/mlb/good-pick-feedback/GoodPickFeedbackView";
import MlbResearchUxView from "@/components/mlb/research-ux/MlbResearchUxView";
import { shiftKstDate } from "@/lib/datetime/games-date";
import { resolveOsDate } from "@/lib/internal/load-yang-edge-os-page";
import { loadGoodPickFeedbackV1 } from "@/lib/mlb/good-pick-feedback-v1";
import { loadMlbResearchUxV1 } from "@/lib/mlb/research-ux-v1";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MLB Research UX | YANG EDGE OS",
  robots: { index: false, follow: false },
};

/**
 * MLB Research UX v1 — card viewer + daily research dashboard.
 * Read-only over review/prediction artifacts. No Engine / Prediction writes.
 */
export default async function MlbResearchUxPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await props.searchParams;
  const dateKst = await resolveOsDate(searchParams);
  const yesterdayKst = shiftKstDate(dateKst, -1);
  const [view, yesterdayFeedback] = await Promise.all([
    loadMlbResearchUxV1({ dateKst }),
    loadGoodPickFeedbackV1({ dateKst: yesterdayKst }),
  ]);

  return (
    <OsShell
      active="research"
      dateKst={dateKst}
      title="MLB Research UX"
      subtitle="Card-based research review · Prediction hash read-only"
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
          href={`/internal/feedback/mlb?date=${encodeURIComponent(dateKst)}`}
          className="text-sky-400 hover:underline"
        >
          Good Pick Feedback ({dateKst})
        </a>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-500">
          SoT: success/failure/daily review JSON (display layer)
        </span>
      </div>
      <div className="mb-6">
        <GoodPickFeedbackTeaser
          view={yesterdayFeedback}
          href={`/internal/feedback/mlb?date=${encodeURIComponent(yesterdayKst)}`}
        />
      </div>
      <MlbResearchUxView view={view} />
    </OsShell>
  );
}
