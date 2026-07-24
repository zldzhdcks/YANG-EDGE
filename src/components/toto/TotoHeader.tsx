type TotoHeaderProps = {
  round: number;
  deadlineLabel: string;
  matchCount: number;
};

export default function TotoHeader({
  round,
  deadlineLabel,
  matchCount,
}: TotoHeaderProps) {
  return (
    <header className="mb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-widest text-blue-500 uppercase">
            Football Toto
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            EDGE Combo
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {round}회차 · {matchCount}경기
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-right">
          <p className="text-[11px] font-medium tracking-wide text-amber-400/80 uppercase">
            마감까지
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-300">
            {deadlineLabel}
          </p>
        </div>
      </div>
    </header>
  );
}
