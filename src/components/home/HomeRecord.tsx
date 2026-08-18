import Card from "@/components/ui/Card";

/**
 * Official BEST PICK aggregate is not a trusted canonical home source yet.
 * Do not display Research Baseline / Learning dashboard hit rates here.
 */
export default function HomeRecord() {
  return (
    <section
      aria-labelledby="home-record-heading"
      className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 sm:pb-24"
    >
      <h2
        id="home-record-heading"
        className="text-xs font-medium tracking-widest text-zinc-400 uppercase"
      >
        YANG EDGE RECORD
      </h2>

      <Card padding="lg" className="mt-6">
        <p className="text-lg font-semibold text-white">
          공식 기록 집계 준비 중
        </p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          검증 데이터 누적 중
        </p>
      </Card>
    </section>
  );
}
