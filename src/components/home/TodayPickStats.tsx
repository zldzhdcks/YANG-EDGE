import StatBox from "@/components/ui/StatBox";

type TodayPickStatsProps = {
  aiWinRate: number;
  confidence: number;
  edgeValue: number;
};

export default function TodayPickStats({
  aiWinRate,
  confidence,
  edgeValue,
}: TodayPickStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-4 border-y border-white/[0.06] py-6 sm:gap-8 sm:py-8">
      <StatBox label="승리 확률" value={`${aiWinRate}%`} size="lg" />
      <StatBox label="EDGE Confidence" value={confidence} size="lg" />
      <StatBox label="EDGE Score" value={`+${edgeValue}`} accent size="lg" />
    </div>
  );
}
