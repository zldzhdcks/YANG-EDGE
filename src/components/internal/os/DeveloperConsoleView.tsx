import type { ResearchLabData } from "@/lib/internal/research-lab-reader";
import { getFootballIdentityDeveloperSnapshot } from "@/lib/football/foundation";
import { getFootballOddsDeveloperSnapshot } from "@/lib/football/odds-foundation-v0";
import { getFootballResultDeveloperSnapshot } from "@/lib/football/result-foundation-v0";
import { getFootballReviewScorecardDeveloperSnapshot } from "@/lib/football/review-scorecard-foundation-v0";
import SystemDetail from "@/components/internal/research/SystemDetail";

type Props = {
  data: ResearchLabData;
  dateKst: string;
};

export default function DeveloperConsoleView({ data, dateKst }: Props) {
  const fb = getFootballIdentityDeveloperSnapshot();
  const odds = getFootballOddsDeveloperSnapshot(dateKst);
  const result = getFootballResultDeveloperSnapshot(dateKst);
  const review = getFootballReviewScorecardDeveloperSnapshot(dateKst);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-violet-900/50 bg-violet-950/20 px-4 py-3 text-sm text-violet-200">
        개발자 전용 · Football Foundation layers · Prediction 표면 없음
      </div>

      <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 px-4 py-4">
        <h2 className="text-sm font-semibold text-emerald-200">Identity</h2>
        <p className="mt-1 font-mono text-[11px] text-zinc-400">
          stage={fb.stage} · predictionSurface={fb.predictionSurface}
        </p>
      </section>

      <section className="rounded-xl border border-sky-900/40 bg-sky-950/15 px-4 py-4">
        <h2 className="text-sm font-semibold text-sky-200">Odds Gate</h2>
        <p className="mt-1 font-mono text-[11px] text-zinc-400">
          usability={odds.usability} · predictionAllowed=
          {String(odds.predictionAllowed)}
        </p>
      </section>

      <section className="rounded-xl border border-amber-900/40 bg-amber-950/15 px-4 py-4">
        <h2 className="text-sm font-semibold text-amber-200">Result Gate</h2>
        <p className="mt-1 font-mono text-[11px] text-zinc-400">
          stage={result.stage} · gradingAllowed={String(result.gradingAllowed)}
        </p>
      </section>

      <section className="rounded-xl border border-fuchsia-900/40 bg-fuchsia-950/15 px-4 py-4">
        <h2 className="text-sm font-semibold text-fuchsia-200">
          Review · Scorecard · Lane Separation
        </h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 font-mono text-[11px] text-zinc-400">
          <div>
            <dt className="text-zinc-600">reviewStage</dt>
            <dd className="text-zinc-200">{review.reviewStage}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">scorecardStage</dt>
            <dd className="text-zinc-200">{review.scorecardStage}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">prediction</dt>
            <dd className="text-zinc-200">{review.prediction}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">researchLane</dt>
            <dd className="text-zinc-200">{review.researchReviewLane}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">officialLane</dt>
            <dd className="text-zinc-200">{review.officialReviewLane}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">mixForbidden</dt>
            <dd className="text-zinc-200">{String(review.mixForbidden)}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">predictionFormulaConnected</dt>
            <dd className="text-zinc-200">
              {String(review.predictionFormulaConnected)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-600">engineImpact</dt>
            <dd className="text-zinc-200">{review.engineImpact}</dd>
          </div>
          <div>
            <dt className="text-zinc-600">gradeMarket</dt>
            <dd className="text-zinc-200">{review.gradeMarket}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-zinc-500">{review.plainLanguage}</p>
      </section>

      <SystemDetail data={data} dateKst={dateKst} />
    </div>
  );
}
