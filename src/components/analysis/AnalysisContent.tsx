import Link from "next/link";
import type { AnalysisViewModel } from "@/lib/edge/to-analysis-view";
import Card from "@/components/ui/Card";
import PrototypeDisclaimer from "@/components/ui/PrototypeDisclaimer";
import { getMatchDisplayLabel, getTeamDisplayName } from "@/lib/teams";
import PredictionHero from "./PredictionHero";
import ReasonList from "./ReasonList";
import RiskList from "./RiskList";
import ScoreCard from "./ScoreCard";
import BottomButtons from "./BottomButtons";
import EdgeDna from "./EdgeDna";

type AnalysisContentProps = {
  analysis: AnalysisViewModel;
};

export default function AnalysisContent({ analysis }: AnalysisContentProps) {
  const matchLabel = getMatchDisplayLabel(
    analysis.homeTeam,
    analysis.awayTeam,
  );
  const homeDisplay = getTeamDisplayName(analysis.homeTeam);
  const awayDisplay = getTeamDisplayName(analysis.awayTeam);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/games"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        <span aria-hidden>←</span>
        뒤로가기
      </Link>

      <header className="mt-6">
        <p className="text-xs font-medium tracking-wide text-zinc-500">
          {analysis.league}
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
          {matchLabel}
        </h1>
        <p className="mt-2 text-sm tabular-nums text-zinc-400">
          {analysis.startTime}
        </p>
      </header>

      <div className="mt-8 space-y-8">
        <PredictionHero analysis={analysis} />

        <Card
          as="section"
          padding="sm"
          className="bg-zinc-900/60 px-5 py-4 sm:px-6"
        >
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            EDGE 한줄 요약
          </p>
          <p className="mt-2 text-base leading-relaxed text-zinc-200 sm:text-lg">
            {analysis.summary}
          </p>
        </Card>

        <EdgeDna factors={analysis.topFactors} />

        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <Card padding="md">
            <ReasonList reasons={analysis.reasons} />
          </Card>
          <Card padding="md">
            <RiskList risks={analysis.risks} />
          </Card>
        </div>

        <ScoreCard
          homeTeam={homeDisplay}
          awayTeam={awayDisplay}
          homeScore={analysis.expectedHomeScore}
          awayScore={analysis.expectedAwayScore}
        />

        <BottomButtons />
      </div>

      <p
        className="mt-8 text-center text-[11px] text-zinc-600"
        title="현재 결과를 구성한 데이터와 규칙의 설명 가능 정도입니다. 적중 확률이 아닙니다."
      >
        설명 가능성 {analysis.explainability}%
        <span className="mt-1 block text-zinc-700">
          현재 결과를 구성한 데이터와 규칙의 설명 가능 정도입니다. 적중 확률이
          아닙니다.
        </span>
      </p>

      <PrototypeDisclaimer />
    </div>
  );
}
