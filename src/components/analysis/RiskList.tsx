import type { AnalysisRiskView } from "@/lib/edge/to-analysis-view";

type RiskListProps = {
  risks: AnalysisRiskView[];
};

export default function RiskList({ risks }: RiskListProps) {
  if (risks.length === 0) return null;

  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold text-white">주의 요소</h3>
      <ul className="space-y-3">
        {risks.map((risk) => (
          <li key={risk.id} className="flex items-start gap-3 text-sm text-zinc-300">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs text-amber-400"
              aria-hidden
            >
              ⚠
            </span>
            <div className="min-w-0">
              <p className="font-medium text-zinc-200">{risk.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{risk.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
