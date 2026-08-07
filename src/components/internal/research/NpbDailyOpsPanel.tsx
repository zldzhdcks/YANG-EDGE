import { loadNpbDailyOpsView } from "@/lib/npb/daily-evidence-continuity-v0";

type Props = { dateKst: string };

function lifecycleTone(lifecycle: string): string {
  if (
    lifecycle === "NO_PREGAME_EVIDENCE" ||
    lifecycle === "OPS_FAILURE"
  ) {
    return "border-red-900/50 bg-red-950/20";
  }
  if (lifecycle === "COMPLETED" || lifecycle === "PREGAME_EVIDENCE_READY") {
    return "border-emerald-900/40 bg-emerald-950/15";
  }
  if (lifecycle === "AWAITING_RESULT" || lifecycle === "COLLECTING") {
    return "border-amber-900/40 bg-amber-950/15";
  }
  return "border-zinc-800 bg-zinc-900/40";
}

/** NPB DAILY OPS — evidence accumulation continuity (no Prediction Engine). */
export default async function NpbDailyOpsPanel({ dateKst }: Props) {
  const view = await loadNpbDailyOpsView({ dateKst });
  const d = view.day;

  return (
    <section className={`rounded-xl border px-5 py-4 ${lifecycleTone(d.lifecycle)}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-lime-400/90">
            NPB · DAILY OPS · EVIDENCE CONTINUITY
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">NPB DAILY OPS</h2>
          <p className="mt-1 text-sm text-zinc-400">
            PRE-GAME EVIDENCE ACCUMULATION · Prediction Engine 없음
          </p>
        </div>
        <p className="rounded-md border border-zinc-700 bg-zinc-950/50 px-3 py-1 font-mono text-xs text-zinc-200">
          {d.lifecycle}
        </p>
      </div>

      <p className="mt-3 font-mono text-sm text-zinc-300">{d.dateKst}</p>

      <dl className="mt-3 grid gap-2 font-mono text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3 sm:block">
          <dt className="text-zinc-500">Schedule</dt>
          <dd className="text-zinc-100">{d.schedule.display}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:block">
          <dt className="text-zinc-500">Starter</dt>
          <dd className="text-zinc-100">{d.starter.display}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:block">
          <dt className="text-zinc-500">Odds</dt>
          <dd className="text-zinc-100">{d.odds.display}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:block">
          <dt className="text-zinc-500">Lineup</dt>
          <dd className="text-zinc-100">{d.lineup.display}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:block">
          <dt className="text-zinc-500">Evidence</dt>
          <dd className="text-zinc-100">{d.evidence.display}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:block">
          <dt className="text-zinc-500">Results</dt>
          <dd className="text-zinc-100">{d.results.display}</dd>
        </div>
      </dl>

      {d.marketBaseline ? (
        <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Market Baseline
          </p>
          <p className="mt-1 font-mono text-sm text-zinc-200">
            {d.marketBaseline.display}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            MARKET_BASELINE · not YANG EDGE Prediction Accuracy
          </p>
        </div>
      ) : null}

      <div className="mt-3 grid gap-1 text-sm text-zinc-400">
        <p>
          Prediction Engine{" "}
          <span className="text-zinc-200">{d.prediction.engine}</span>
        </p>
        <p>
          Prediction Accuracy{" "}
          <span className="text-zinc-200">{d.prediction.accuracy}</span>
        </p>
        <p>
          Good Picks{" "}
          <span className="text-zinc-200">{d.prediction.goodPicks}</span>
        </p>
        {d.evidence.hashShort ? (
          <p className="font-mono text-xs text-zinc-500">
            Hash {d.evidence.hashShort}
          </p>
        ) : null}
      </div>

      {d.continuity.alert ? (
        <p className="mt-3 rounded-md border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          ALERT: {d.continuity.alert}
          <span className="mt-1 block text-xs text-red-300/80">
            {d.continuity.plainLanguage}
          </span>
        </p>
      ) : null}

      <p className="mt-2 text-xs text-zinc-500">Next: {d.nextAction}</p>

      <div className="mt-4 border-t border-zinc-800 pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Recent NPB dates
        </p>
        <ul className="mt-2 space-y-1 font-mono text-xs text-zinc-400">
          {view.recentDays.map((r) => (
            <li key={r.dateKst} className="flex flex-wrap gap-3">
              <span className="text-zinc-300">{r.shortDate}</span>
              <span
                className={
                  r.lifecycle === "NO_PREGAME_EVIDENCE" ||
                  r.lifecycle === "OPS_FAILURE"
                    ? "text-red-300"
                    : r.lifecycle === "COMPLETED"
                      ? "text-emerald-300/90"
                      : "text-zinc-400"
                }
              >
                {r.lifecycle}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
