import type { LearningBucket } from "@/lib/learning/load-learning-dashboard";
import Card from "@/components/ui/Card";

function formatRate(bucket: LearningBucket): string {
  if (bucket.status === "INSUFFICIENT_SAMPLE" || bucket.hitRate == null) {
    return "INSUFFICIENT_SAMPLE";
  }
  return `${bucket.hitRate}%`;
}

type LearningBucketTableProps = {
  title: string;
  buckets: LearningBucket[];
};

export default function LearningBucketTable({
  title,
  buckets,
}: LearningBucketTableProps) {
  if (buckets.length === 0) {
    return (
      <section aria-label={title}>
        <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-500 uppercase">
          {title}
        </h2>
        <p className="text-sm text-zinc-500">집계 데이터가 없습니다.</p>
      </section>
    );
  }

  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-500 uppercase">
        {title}
      </h2>
      <Card padding="md" className="rounded-xl overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-xs text-zinc-500">
              <th className="pb-2 pr-3 font-medium">구간</th>
              <th className="pb-2 pr-3 font-medium">표본</th>
              <th className="pb-2 pr-3 font-medium">적중</th>
              <th className="pb-2 pr-3 font-medium">실패</th>
              <th className="pb-2 font-medium">적중률</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr
                key={b.label}
                className="border-b border-white/[0.04] last:border-0"
              >
                <td className="py-2.5 pr-3 text-zinc-200">{b.label}</td>
                <td className="py-2.5 pr-3 tabular-nums text-zinc-400">{b.n}</td>
                <td className="py-2.5 pr-3 tabular-nums text-emerald-400">
                  {b.hits}
                </td>
                <td className="py-2.5 pr-3 tabular-nums text-rose-400">
                  {b.fails}
                </td>
                <td className="py-2.5 tabular-nums text-zinc-300">
                  {formatRate(b)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
