import type { TotoMatchData, TotoOutcome } from "@/types/toto";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import StatBox from "@/components/ui/StatBox";

type TotoMatchCardProps = {
  match: TotoMatchData;
};

function pickVariant(
  pick: TotoOutcome,
): "accent" | "default" | "danger" {
  switch (pick) {
    case "승":
      return "accent";
    case "무":
      return "default";
    case "패":
      return "danger";
  }
}

export default function TotoMatchCard({ match }: TotoMatchCardProps) {
  const isDouble = match.betType === "복식";

  return (
    <Card as="article" padding="md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-zinc-500">
            {match.matchNumber}경기
          </p>
          <h3 className="mt-1 text-base font-semibold text-white sm:text-lg">
            {match.homeTeam}{" "}
            <span className="font-normal text-zinc-500">vs</span>{" "}
            {match.awayTeam}
          </h3>
        </div>

        <Badge
          variant={pickVariant(match.aiPick)}
          className="shrink-0 flex-col rounded-xl px-3 py-2 text-center"
        >
          <span className="text-[10px] font-medium tracking-wide uppercase opacity-70">
            EDGE Pick
          </span>
          <span className="text-xl font-bold leading-none">{match.aiPick}</span>
        </Badge>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-5">
        <StatBox
          label="Confidence"
          value={match.confidence}
          size="sm"
          className="[&_p:last-child]:mt-0.5 [&_p:last-child]:text-[11px]"
        />
        <StatBox
          label="EDGE"
          value={`+${match.edgeValue}`}
          accent
          size="sm"
          className="[&_p:last-child]:mt-0.5 [&_p:last-child]:text-[11px]"
        />
        <div>
          <p
            className={`text-sm font-semibold sm:text-base ${
              isDouble ? "text-amber-300" : "text-zinc-300"
            }`}
          >
            {isDouble && match.doublePicks
              ? match.doublePicks.join(" / ")
              : "단식"}
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {isDouble ? "복식 추천" : "복식 추천 여부"}
          </p>
        </div>
      </div>
    </Card>
  );
}
