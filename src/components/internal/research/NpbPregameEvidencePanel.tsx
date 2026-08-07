import { loadNpbPregameEvidenceView } from "@/lib/npb/pregame-evidence-snapshot-v0";

type Props = { dateKst: string };

/** PRE-GAME EVIDENCE — presentation only; not model prediction. */
export default async function NpbPregameEvidencePanel({ dateKst }: Props) {
  const view = await loadNpbPregameEvidenceView({ dateKst });

  return (
    <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-400/90">
        NPB · PRE-GAME EVIDENCE
      </p>
      <h2 className="mt-1 text-lg font-bold text-white">PRE-GAME EVIDENCE</h2>
      <p className="mt-1 text-sm text-zinc-400">
        경기 전 확보 데이터 동결 · Model Prediction 아님 · Engine 없음
      </p>
      <ul className="mt-3 space-y-1 font-mono text-sm text-zinc-200">
        {view.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {view.frozen ? (
        <div className="mt-3 space-y-1 text-xs text-zinc-500">
          <p>
            Status:{" "}
            <span className="text-emerald-300/90">{view.snapshotStatus}</span>
          </p>
          <p>
            Created: {view.snapshotCreatedAt ?? "—"} · Before first pitch:{" "}
            {view.beforeFirstPitch}
          </p>
          {view.hashShort ? <p>Hash: {view.hashShort}</p> : null}
          <p className="text-amber-300/80">Next: {view.nextAction}</p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">
          Snapshot not frozen yet · date={dateKst}
        </p>
      )}
    </section>
  );
}
