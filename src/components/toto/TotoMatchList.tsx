import type { TotoMatchData } from "@/types/toto";
import TotoMatchCard from "./TotoMatchCard";

type TotoMatchListProps = {
  matches: TotoMatchData[];
};

export default function TotoMatchList({ matches }: TotoMatchListProps) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {matches.map((match) => (
        <TotoMatchCard key={match.matchNumber} match={match} />
      ))}
    </div>
  );
}
