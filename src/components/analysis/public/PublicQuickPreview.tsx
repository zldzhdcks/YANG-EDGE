import Card from "@/components/ui/Card";
import type { PublicQuickPreview } from "@/types/public-game-analysis-view";
import RichMatchPreview from './RichMatchPreview';

export default function PublicQuickPreview({
  preview,
}: {
  preview: PublicQuickPreview;
}) {
  if (preview.rich) return <RichMatchPreview preview={preview.rich} />;
  if (!preview.available || preview.sentences.length === 0) return null;
  return (
    <Card as="section" padding="md" className="rounded-xl">
      <h2 className="text-xs font-medium tracking-wide text-zinc-500">
        빠른 경기 프리뷰
      </h2>
      <div className="mt-2 space-y-2">
        {preview.sentences.map((sentence, index) => (
          <p
            key={`${index}:${sentence.slice(0, 24)}`}
            className="text-sm leading-relaxed break-words text-zinc-300"
          >
            {sentence}
          </p>
        ))}
      </div>
    </Card>
  );
}
