import { loadNpbOfficialResultIntakeView } from "@/lib/npb/official-result-intake-v0";

type Props = { dateKst: string };

function scoreLine(
  awayTeam: string,
  homeTeam: string,
  awayScore: number | null,
  homeScore: number | null,
  status: string,
): string {
  if (status === "FINAL" && awayScore != null && homeScore != null) {
    return `${awayTeam} ${awayScore} – ${homeScore} ${homeTeam}`;
  }
  return `${awayTeam} @ ${homeTeam} · ${status}`;
}

/** AFTER GAME intake — Market Observation only; not model performance. */
export default async function NpbOfficialResultPanel({ dateKst }: Props) {
  const view = await loadNpbOfficialResultIntakeView({ dateKst });

  return (
    <section className="rounded-xl border border-cyan-900/40 bg-cyan-950/15 px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400/90">
        NPB · OFFICIAL RESULT INTAKE
      </p>
      <h2 className="mt-1 text-lg font-bold text-white">
        BEFORE GAME / AFTER GAME
      </h2>
      <p className="mt-1 text-sm text-zinc-400">
        Pregame Evidence 동결 유지 · Official Result join · Market Observation
        ≠ Engine
      </p>

      <ul className="mt-3 space-y-1 font-mono text-sm text-zinc-200">
        {view.summaryLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
        <li className="text-zinc-400">{view.predictionNote}</li>
      </ul>

      <div className="mt-4 space-y-4">
        {view.games.map((g) => (
          <article
            key={g.gameId}
            className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-4 py-3"
          >
            <p className="text-sm font-semibold text-white">{g.matchup}</p>
            <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
              {g.gameId}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-400/90">
                  Before Game
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-300">
                  <li>
                    Starter: {g.beforeGame.starterAway ?? "—"} /{" "}
                    {g.beforeGame.starterHome ?? "—"}
                  </li>
                  <li>
                    Moneyline: {g.beforeGame.moneylineAway ?? "—"} /{" "}
                    {g.beforeGame.moneylineHome ?? "—"}
                  </li>
                  <li>Lineup: {g.beforeGame.lineupStatus}</li>
                </ul>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-400/90">
                  After Game
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-zinc-300">
                  <li>
                    Final Score:{" "}
                    {scoreLine(
                      g.awayTeam,
                      g.homeTeam,
                      g.afterGame.awayScore,
                      g.afterGame.homeScore,
                      g.afterGame.status,
                    )}
                  </li>
                  <li>Winner: {g.afterGame.winner ?? "—"}</li>
                  <li>
                    Market Favorite Result:{" "}
                    {g.afterGame.marketFavorite ?? "—"} · Favorite Won{" "}
                    {g.afterGame.favoriteWon ?? "—"}
                  </li>
                  <li className="text-zinc-500">
                    Join: {g.afterGame.joinStatus ?? "—"} ·{" "}
                    MARKET_OBSERVATION_RESULT
                  </li>
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!view.hasResults ? (
        <p className="mt-3 text-xs text-zinc-500">
          Official results artifact not present for {dateKst}.
        </p>
      ) : null}
    </section>
  );
}
