import type { GoodPickLearningTrackerView } from "@/lib/mlb/good-pick-learning-tracker-v1";

function Tip({ text }: { text: string }) {
  return (
    <span
      className="ml-1 cursor-help rounded border border-zinc-700 px-1 text-[10px] text-zinc-500"
      title={text}
    >
      ?
    </span>
  );
}

export default function GoodPickLearningTrackerView({
  view,
}: {
  view: GoodPickLearningTrackerView;
}) {
  if (!view.loaded) {
    return (
      <section className="rounded-xl border border-zinc-800 px-5 py-4 text-sm text-zinc-400">
        {view.error ?? "Tracker를 불러오지 못했습니다."}
      </section>
    );
  }

  const r = view.record;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-amber-900/40 bg-gradient-to-b from-amber-950/30 to-zinc-950 px-5 py-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400/90">
          Good Pick Learning Tracker
        </p>
        <h2 className="mt-1 text-2xl font-bold text-white">누적 Good Pick 성적</h2>
        <p className="mt-1 text-xs text-zinc-500">
          NO_PREGAME_SNAPSHOT은 분모에서 제외 · Engine 변경 없음
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-3">
            <dt className="text-[10px] uppercase text-zinc-500">Total Good Picks</dt>
            <dd className="text-2xl font-bold text-white">{r.totalGoodPicks}</dd>
          </div>
          <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-3">
            <dt className="text-[10px] uppercase text-emerald-500/80">Correct</dt>
            <dd className="text-2xl font-bold text-emerald-300">{r.correct}</dd>
          </div>
          <div className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-3">
            <dt className="text-[10px] uppercase text-red-400/80">Incorrect</dt>
            <dd className="text-2xl font-bold text-red-300">{r.incorrect}</dd>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-black/30 px-3 py-3">
            <dt className="text-[10px] uppercase text-zinc-500">Accuracy</dt>
            <dd className="text-2xl font-bold text-amber-200">
              {r.accuracyPercent != null ? `${r.accuracyPercent}%` : "—"}
            </dd>
          </div>
        </dl>
        {r.earlySample ? (
          <p className="mt-3 rounded-md border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
            EARLY SAMPLE — 표본 {r.totalGoodPicks} &lt; 30. 우세 패턴으로 승격하지 않습니다.
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white">날짜별</h3>
        <ul className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {view.days.map((d) => (
            <li key={d.dateKst}>
              <a
                href={d.feedbackHref}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-zinc-900/80"
              >
                <span className="font-mono text-sm text-zinc-200">{d.dateKst}</span>
                <span
                  className={`text-sm font-medium ${
                    d.status === "NO_PREGAME_SNAPSHOT"
                      ? "text-red-300"
                      : d.status === "AWAITING_RESULT"
                        ? "text-amber-300"
                        : d.status === "GRADED"
                          ? "text-emerald-300"
                          : "text-zinc-400"
                  }`}
                >
                  {d.line}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">
          Signal Combination Tracker
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          사전 신호만 사용 · 표본이 작으면 SMALL_SAMPLE · 유효 패턴 결론 금지
        </p>
        <ul className="mt-3 space-y-2">
          {view.signalCombos.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-zinc-800 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-zinc-100">{c.label}</span>
                <span className="font-mono text-xs text-zinc-400">
                  sample {c.stats.correct + c.stats.incorrect}
                  {" · "}
                  correct {c.stats.correct}
                  {" · "}
                  {c.stats.accuracyPercent != null
                    ? `${c.stats.accuracyPercent}%`
                    : "—"}
                  {c.stats.smallSample ? " · SMALL_SAMPLE" : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">Market Alignment</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {view.marketAlignment.map((m) => (
            <li
              key={m.bucket}
              className="rounded-lg border border-zinc-800 px-3 py-3"
            >
              <p className="text-sm font-semibold text-white">{m.label}</p>
              <p className="mt-1 font-mono text-xs text-zinc-400">
                n={m.stats.correct + m.stats.incorrect} · correct {m.stats.correct} ·{" "}
                {m.stats.accuracyPercent != null
                  ? `${m.stats.accuracyPercent}%`
                  : "—"}
              </p>
              {m.stats.smallSample ? (
                <p className="mt-1 text-[10px] text-amber-400">SMALL_SAMPLE</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">Game Margin</h3>
        <p className="mt-1 text-xs text-zinc-500">
          접전 생존 vs 안정 우세 — 대표 판단용 · 인과 확정 아님
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {view.margins.map((m) => (
            <li
              key={m.bucket}
              className="rounded-lg border border-zinc-800 px-3 py-3"
            >
              <p className="text-sm font-semibold text-white">{m.label}</p>
              <p className="mt-1 text-xs text-zinc-400">{m.plain}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-sky-900/40 bg-sky-950/20 px-5 py-4">
        <h3 className="text-lg font-semibold text-sky-100">
          Probability vs Confidence
        </h3>
        <dl className="mt-3 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-zinc-200">
              Model Win Probability
              <Tip text={view.probabilityVsConfidence.probabilityPlain} />
            </dt>
            <dd className="mt-1 text-zinc-400">
              {view.probabilityVsConfidence.probabilityPlain}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-200">
              Confidence
              <Tip text={view.probabilityVsConfidence.confidencePlain} />
            </dt>
            <dd className="mt-1 text-zinc-400">
              {view.probabilityVsConfidence.confidencePlain}
            </dd>
          </div>
        </dl>
      </section>

      <p className="text-xs text-zinc-600">{view.sourceNote}</p>
    </div>
  );
}

/** Compact historical record for Daily Picks header */
export function GoodPickRecordCard({
  view,
  href,
}: {
  view: GoodPickLearningTrackerView;
  href: string;
}) {
  const r = view.record;
  return (
    <a
      href={href}
      className="block rounded-xl border border-zinc-700 bg-zinc-900/70 px-4 py-3 hover:border-amber-700/60"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        Good Pick Record
      </p>
      <p className="mt-1 text-sm font-semibold text-white">Historical Good Picks</p>
      <p className="mt-1 text-lg font-bold text-amber-200">
        {r.correct}-{r.incorrect}
        {r.accuracyPercent != null ? (
          <span className="ml-2 text-base text-zinc-300">
            {r.accuracyPercent}%
          </span>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Sample {r.totalGoodPicks}
        {r.earlySample ? " · EARLY SAMPLE" : ""}
      </p>
      <p className="mt-2 text-xs text-sky-400">Learning Tracker →</p>
    </a>
  );
}
