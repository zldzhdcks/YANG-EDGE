type TodayPickReasonsProps = {
  reasons: string[];
};

export default function TodayPickReasons({ reasons }: TodayPickReasonsProps) {
  return (
    <div>
      <p className="mb-3 text-xs font-medium tracking-wide text-zinc-500 uppercase">
        분석 이유
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {reasons.map((reason) => (
          <li key={reason} className="flex items-center gap-2 text-sm text-zinc-300">
            <span className="text-blue-500" aria-hidden>
              ✔
            </span>
            {reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
