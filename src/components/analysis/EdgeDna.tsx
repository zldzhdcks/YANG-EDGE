import type { EdgeDnaFactorView } from "@/lib/edge/to-analysis-view";
import Card from "@/components/ui/Card";

type EdgeDnaProps = {
  factors: EdgeDnaFactorView[];
};

function formatSigned(value: number): string {
  if (value > 0) return `+${value.toFixed(1)}`;
  if (value < 0) return value.toFixed(1);
  return "0.0";
}

export default function EdgeDna({ factors }: EdgeDnaProps) {
  if (factors.length === 0) return null;

  return (
    <Card as="section" padding="md">
      <h3 className="mb-4 text-sm font-semibold tracking-wide text-white">
        EDGE DNA
      </h3>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {factors.map((factor) => {
          const negative = factor.signedImpact < 0;
          const neutral = factor.signedImpact === 0;
          return (
            <li
              key={factor.key}
              className="rounded-xl border border-white/[0.06] bg-zinc-950/40 px-3 py-3"
            >
              <p className="text-xs text-zinc-500">{factor.label}</p>
              <p
                className={`mt-1 text-lg font-semibold tabular-nums ${
                  negative
                    ? "text-amber-400"
                    : neutral
                      ? "text-zinc-400"
                      : "text-blue-400"
                }`}
              >
                {formatSigned(factor.signedImpact)}
              </p>
              <p
                className={`mt-1 text-[10px] font-medium tracking-wider uppercase ${
                  negative ? "text-amber-500/80" : "text-zinc-500"
                }`}
              >
                {factor.impact}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
