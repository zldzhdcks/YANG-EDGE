import type { HomeGamesLoadResult } from "@/types/home";
import Card from "@/components/ui/Card";
import SampleAnalysisNotice from "./SampleAnalysisNotice";
import FeatureCard from "./FeatureCard";

type WhyYangEdgeProps = {
  result: HomeGamesLoadResult;
};

export default function WhyYangEdge({ result }: WhyYangEdgeProps) {
  const showFeatured =
    result.status === "success" && result.featured.length > 0;

  return (
    <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <h2 className="mb-2 text-lg font-semibold text-white">Featured</h2>
      <p className="mb-4 text-sm text-zinc-500">
        Dummy Engine 샘플 기준 관심 경기 (실추천 아님)
      </p>

      {showFeatured ? <SampleAnalysisNotice className="mb-4" /> : null}

      {result.status === "error" ? (
        <Card padding="lg" className="rounded-xl">
          <p className="text-sm text-zinc-400">
            경기 일정을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.
          </p>
        </Card>
      ) : result.status === "empty" ? (
        <Card padding="lg" className="rounded-xl">
          <p className="text-sm text-zinc-400">
            오늘 등록된 경기 일정이 없습니다.
          </p>
        </Card>
      ) : result.featured.length === 0 ? (
        <Card padding="lg" className="rounded-xl">
          <p className="text-sm text-zinc-400">
            현재 샘플 Engine 기준을 충족한 경기가 없습니다.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {result.featured.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
      )}
    </section>
  );
}
