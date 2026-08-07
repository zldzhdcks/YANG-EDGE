import type { ResearchReviewCardModel } from "@/lib/mlb/research-ux-v1";

function sideWinLabel(side: string, team: string | null): string {
  if (team) return `${team} WIN`;
  return `${side} WIN`;
}

export default function ResearchReviewCard({
  card,
  dateKst,
}: {
  card: ResearchReviewCardModel;
  dateKst: string;
}) {
  const incorrect = card.accuracy === "INCORRECT";
  const border = incorrect
    ? "border-red-900/50 bg-red-950/15 hover:border-red-700/60"
    : "border-emerald-900/40 bg-emerald-950/15 hover:border-emerald-700/50";

  const href =
    card.gamePk != null
      ? `/internal/research/mlb/${card.gamePk}?date=${encodeURIComponent(dateKst)}`
      : null;

  const inner = (
    <>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-semibold tracking-tight text-white">
          {card.matchupLine}
        </h3>
        <span className="text-xs text-zinc-500">
          {card.matchupLabel}
          {href ? " · 상세 →" : ""}
        </span>
      </header>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">
            Prediction
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-zinc-100">
            {sideWinLabel(card.predictionSide, card.predictionTeam)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">
            Actual
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-zinc-100">
            {sideWinLabel(card.actualSide, card.actualTeam)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">
            Accuracy
          </dt>
          <dd className="mt-0.5 text-sm font-semibold">
            {incorrect ? (
              <span className="text-red-300">❌ Incorrect</span>
            ) : (
              <span className="text-emerald-300">✅ Correct</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-zinc-500">
            Confidence
          </dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-zinc-100">
            {card.confidencePercent != null ? `${card.confidencePercent}%` : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-zinc-800/80 pt-3">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          {incorrect ? "Primary Cause" : "Primary Success"}
        </p>
        {card.primary ? (
          <p className="mt-1 text-sm font-semibold text-amber-200">
            🥇 {card.primary.label}
          </p>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">—</p>
        )}
      </div>

      <div className="mt-3">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          {incorrect ? "Secondary Causes" : "Secondary Success"}
        </p>
        {card.secondary.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-500">None</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm text-zinc-300">
            {card.secondary.map((s) => (
              <li key={s.code}>• {s.label}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-3">
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          AI Summary
        </p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-300">
          {card.aiSummary}
        </p>
        <p className="mt-2 text-[11px] text-zinc-600">
          Research commentary · not an Engine decision
        </p>
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={`block rounded-xl border px-5 py-4 transition ${border}`}
        data-game-id={card.gameId}
        data-kind={card.kind}
        data-game-pk={card.gamePk ?? undefined}
      >
        {inner}
      </a>
    );
  }

  return (
    <article
      className={`rounded-xl border px-5 py-4 ${border}`}
      data-game-id={card.gameId}
      data-kind={card.kind}
    >
      {inner}
    </article>
  );
}
