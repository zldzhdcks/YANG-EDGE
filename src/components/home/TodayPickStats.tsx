import StatBox from "@/components/ui/StatBox";

type TodayPickStatsProps = {
  aiWinRate: number;
  confidence: number;
  edgeValue: number;
};

function formatPercent(value: number): string {
  return Number.isFinite(value) ? `${value}%` : "—";
}

function formatScore(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `+${value}`;
}

function formatConfidence(value: number): string | number {
  return Number.isFinite(value) ? value : "—";
}

export default function TodayPickStats({
  aiWinRate,
  confidence,
  edgeValue,
}: TodayPickStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-4 border-y border-white/[0.06] py-6 sm:gap-8 sm:py-8">
      <StatBox label="승리 확률" value={formatPercent(aiWinRate)} size="lg" />
      <StatBox
        label="EDGE Confidence"
        value={formatConfidence(confidence)}
        size="lg"
      />
      <StatBox
        label="EDGE Score"
        value={formatScore(edgeValue)}
        accent={Number.isFinite(edgeValue)}
        size="lg"
      />
    </div>
  );
}
