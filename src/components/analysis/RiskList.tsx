type RiskListProps = {
  risks: string[];
};

export default function RiskList({ risks }: RiskListProps) {
  if (risks.length === 0) return null;

  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold text-white">주의 요소</h3>
      <ul className="space-y-3">
        {risks.map((risk) => (
          <li
            key={risk}
            className="flex items-center gap-3 text-sm text-zinc-300"
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs text-amber-400"
              aria-hidden
            >
              ⚠
            </span>
            {risk}
          </li>
        ))}
      </ul>
    </section>
  );
}
