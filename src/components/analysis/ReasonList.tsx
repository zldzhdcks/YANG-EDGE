import type { AnalysisReason } from "@/types/analysis";
import ReasonIconView from "./ReasonIconView";

type ReasonListProps = {
  reasons: AnalysisReason[];
};

export default function ReasonList({ reasons }: ReasonListProps) {
  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold text-white">추천 이유</h3>
      <ul className="space-y-4">
        {reasons.map((reason) => (
          <li key={reason.id} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400"
              aria-hidden
            >
              <ReasonIconView icon={reason.icon} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200">{reason.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                {reason.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
