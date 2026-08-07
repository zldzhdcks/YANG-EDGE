import type { MlbResearchUxView } from "@/lib/mlb/research-ux-v1";
import ResearchReviewCard from "./ResearchReviewCard";
import {
  AiResearchCommentary,
  DailyResearchDashboard,
  ResearchTimeline,
  VersionIdentityBar,
} from "./DailyResearchDashboard";

export default function MlbResearchUxView({
  view,
}: {
  view: MlbResearchUxView;
}) {
  const failures = view.cards.filter((c) => c.kind === "failure");
  const successes = view.cards.filter((c) => c.kind === "success");

  return (
    <div className="space-y-6">
      <VersionIdentityBar versions={view.versions} />

      {view.dashboard ? (
        <DailyResearchDashboard dashboard={view.dashboard} />
      ) : (
        <section className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-5 py-4 text-sm text-amber-100">
          {view.error ?? "Review dashboard unavailable"}
        </section>
      )}

      <AiResearchCommentary text={view.aiCommentary} />

      <ResearchTimeline points={view.timeline} activeDate={view.dateKst} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">
            Research Review Cards
          </h2>
          <p className="text-xs text-zinc-500">
            Failures {failures.length} · Successes {successes.length}
          </p>
        </div>

        {failures.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-red-300/90">Incorrect</h3>
            {failures.map((c) => (
              <ResearchReviewCard
                key={`f-${c.gameId}`}
                card={c}
                dateKst={view.dateKst}
              />
            ))}
          </div>
        ) : null}

        {successes.length > 0 ? (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-emerald-300/90">Correct</h3>
            {successes.map((c) => (
              <ResearchReviewCard
                key={`s-${c.gameId}`}
                card={c}
                dateKst={view.dateKst}
              />
            ))}
          </div>
        ) : null}

        {view.cards.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No success/failure review cards for this date.
          </p>
        ) : null}
      </section>
    </div>
  );
}
