import Card from "@/components/ui/Card";

type ScoreCardProps = {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
};

export default function ScoreCard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
}: ScoreCardProps) {
  return (
    <Card as="section" padding="md" className="p-6">
      <h3 className="text-sm font-semibold text-white">예상 점수</h3>

      <div className="mt-6 flex items-center justify-center gap-6 sm:gap-10">
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs text-zinc-500">{homeTeam}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white sm:text-4xl">
            {homeScore}
          </p>
        </div>

        <span className="text-xl font-medium text-zinc-600" aria-hidden>
          :
        </span>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-xs text-zinc-500">{awayTeam}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white sm:text-4xl">
            {awayScore}
          </p>
        </div>
      </div>
    </Card>
  );
}
