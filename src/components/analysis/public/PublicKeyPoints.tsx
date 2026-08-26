import Card from "@/components/ui/Card";

export default function PublicKeyPoints({ points }: { points: string[] }) {
  if (points.length === 0) return null;
  return (
    <Card as="section" padding="md" className="rounded-xl">
      <h2 className="text-sm font-semibold text-white">경기 핵심 포인트</h2>
      <ul className="mt-3 space-y-2">
        {points.map((point) => (
          <li key={point} className="text-sm leading-relaxed text-zinc-300">
            {point}
          </li>
        ))}
      </ul>
    </Card>
  );
}
