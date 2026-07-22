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
  const stats = [
    { label: "AI 승률", value: `${aiWinRate}%`, highlight: true },
    { label: "Confidence", value: String(confidence), highlight: false },
    {
      label: "EDGE VALUE",
      value: `+${edgeValue}`,
      highlight: false,
      accent: true,
    },
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-4 border-y border-white/[0.06] py-6 sm:gap-8 sm:py-8">
      {stats.map((stat) => (
        <div key={stat.label}>
          <p
            className={`text-2xl font-bold sm:text-3xl md:text-4xl ${
              stat.highlight
                ? "text-white"
                : "accent" in stat && stat.accent
                  ? "text-blue-400"
                  : "text-white"
            }`}
          >
            {stat.value}
          </p>
          <p className="mt-1 text-xs text-zinc-500 sm:text-sm">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
