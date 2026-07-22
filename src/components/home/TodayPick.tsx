import Link from "next/link";
import type { TodayPickData } from "@/types/todayPick";
import TodayPickStats from "./TodayPickStats";
import TodayPickReasons from "./TodayPickReasons";

type TodayPickProps = {
  pick: TodayPickData;
};

export default function TodayPick({ pick }: TodayPickProps) {
  return (
    <section id="today-pick" className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
      <p className="mb-4 text-xs font-medium tracking-widest text-blue-500 uppercase">
        Today AI Pick
      </p>

      <div className="rounded-xl border border-white/[0.08] bg-zinc-900 p-6 sm:p-8">
        <p className="text-xs font-medium text-zinc-500">{pick.league}</p>
        <h2 className="mt-1 text-xl font-bold text-white sm:text-2xl">
          {pick.homeTeam} vs {pick.awayTeam}
        </h2>

        <TodayPickStats
          aiWinRate={pick.aiWinRate}
          confidence={pick.confidence}
          edgeValue={pick.edgeValue}
        />

        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <TodayPickReasons reasons={pick.reasons} />
          <Link
            href="#analysis"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            상세 분석
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
