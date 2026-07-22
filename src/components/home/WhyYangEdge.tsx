import type { FeatureData } from "@/types/feature";
import FeatureCard from "./FeatureCard";

type WhyYangEdgeProps = {
  features: FeatureData[];
};

export default function WhyYangEdge({ features }: WhyYangEdgeProps) {
  return (
    <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
      <h2 className="mb-6 text-lg font-semibold text-white">Why YANG EDGE</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <FeatureCard key={feature.id} feature={feature} />
        ))}
      </div>
    </section>
  );
}
