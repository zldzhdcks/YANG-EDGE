type TodayPickReasonsProps = {
  reasons: string[];
};

export default function TodayPickReasons({ reasons }: TodayPickReasonsProps) {
  return (
    <div className="min-w-0 w-full flex-1">
      <p className="mb-3 text-xs font-medium tracking-wide text-zinc-500 uppercase">
        분석 이유
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-2">
        {reasons.map((reason) => (
          <li
            key={reason}
            className="flex min-w-0 items-start gap-2 text-sm text-zinc-300"
          >
            <span className="mt-0.5 shrink-0 text-blue-500" aria-hidden>
              ✓
            </span>
            <span className="min-w-0 break-keep whitespace-normal">
              {reason}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
