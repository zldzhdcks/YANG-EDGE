import type { AnalysisViewModel } from "@/lib/edge/to-analysis-view";
import { getConfidenceLabel } from "@/types/analysis";
import Card from "@/components/ui/Card";
import StatBox from "@/components/ui/StatBox";
import Badge from "@/components/ui/Badge";
import { getTeamDisplayName } from "@/lib/teams";

type PredictionHeroProps = {
  analysis: AnalysisViewModel;
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating}점`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < rating;
        return (
          <span
            key={index}
            className={filled ? "text-blue-400" : "text-zinc-700"}
            aria-hidden
          >
            ★
          </span>
        );
      })}
    </div>
  );
}

export default function PredictionHero({ analysis }: PredictionHeroProps) {
  return (
    <Card as="section" padding="lg">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
          aria-hidden
        />
        <Badge
          variant="success"
          className="border-0 bg-transparent px-0 py-0 tracking-widest uppercase"
        >
          EDGE Pick
        </Badge>
      </div>

      <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        {getTeamDisplayName(analysis.pickTeam)} 승
      </h2>

      <div className="mt-3">
        <StarRating rating={analysis.starRating} />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-5 border-t border-white/[0.06] pt-6 sm:grid-cols-4 sm:gap-4">
        <StatBox
          label="승리 확률"
          value={`${analysis.winProbability}%`}
          size="md"
        />
        <StatBox
          label="EDGE Confidence"
          value={analysis.confidence}
          hint={getConfidenceLabel(analysis.confidence)}
          size="md"
        />
        <StatBox
          label="EDGE Score"
          value={`+${analysis.edgeScore}`}
          hint={analysis.gradeLabel}
          accent
          size="md"
        />
        <StatBox label="EDGE Grade" value={analysis.grade} size="md" />
      </div>
    </Card>
  );
}
