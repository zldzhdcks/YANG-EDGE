import type {
  GoodPickFeedbackView,
  GoodPickGameFeedback,
  SignalPolarity,
} from "@/lib/mlb/good-pick-feedback-v1";
import { signalArrow } from "@/lib/mlb/good-pick-feedback-v1";

function polarityClass(p: SignalPolarity): string {
  switch (p) {
    case "POSITIVE":
      return "text-emerald-300";
    case "NEGATIVE":
      return "text-red-300";
    case "LIMITED":
      return "text-amber-300";
    case "NOT_CONNECTED":
      return "text-zinc-500";
    default:
      return "text-zinc-400";
  }
}

function GameFeedbackCard({ game }: { game: GoodPickGameFeedback }) {
  const correct = game.grade === "CORRECT";
  const incorrect = game.grade === "INCORRECT";

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <header className="border-b border-zinc-800 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs text-zinc-500">Good Pick · ★★★★☆</p>
            <h3 className="text-lg font-semibold text-white">{game.matchupLine}</h3>
            <p className="mt-1 text-sm text-zinc-300">
              Pick{" "}
              <span className="font-semibold text-white">
                {game.pickTeam ?? "—"}
              </span>
              {" · "}
              <span
                title="Model Win Probability — RESEARCH_BASELINE_V0 승률(%). 클램프 35–65%. 적중 여부와 별개."
                className="cursor-help border-b border-dotted border-zinc-600"
              >
                Prob{" "}
                {game.modelProbabilityPercent != null
                  ? `${game.modelProbabilityPercent}%`
                  : "—"}
              </span>
              {" · "}
              <span
                title="Confidence — 입력 품질·선발·배당·라인업·경고 수 기반 0–100 연구용 신뢰도. 승률이 아님. 재계산하지 않음."
                className="cursor-help border-b border-dotted border-zinc-600"
              >
                Conf{" "}
                {game.confidence != null ? `${game.confidence}%` : "—"}
              </span>
            </p>
          </div>
          <span
            className={`rounded-md border px-2 py-1 text-sm font-semibold ${
              correct
                ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                : incorrect
                  ? "border-red-900 bg-red-950/40 text-red-300"
                  : "border-zinc-700 text-zinc-400"
            }`}
          >
            {correct ? "✓ Correct" : incorrect ? "✗ Incorrect" : game.grade}
          </span>
        </div>
      </header>

      {/* BEFORE */}
      <section className="border-b border-sky-900/30 bg-sky-950/10 px-4 py-4 sm:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-400/90">
          Before the Game
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Prediction 시점에 알고 있던 정보만 · 사후 역주입 없음
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {game.beforeSignals.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-zinc-800/80 bg-black/20 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-200">
                  {s.label}
                </span>
                <span className={`text-sm font-bold ${polarityClass(s.polarity)}`}>
                  {signalArrow(s.polarity)} {s.polarity}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{s.plain}</p>
            </li>
          ))}
        </ul>
        {game.preGameRisks.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-medium text-amber-200/90">Pre-game Risk</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {game.preGameRisks.map((r) => (
                <li
                  key={r.code}
                  className="rounded-md border border-amber-900/50 bg-amber-950/30 px-2 py-0.5 text-[11px] text-amber-100"
                >
                  {r.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* AFTER */}
      <section className="border-b border-violet-900/30 bg-violet-950/10 px-4 py-4 sm:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/90">
          After the Game
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          결과·복기 후보 · 확정 원인이 아님
        </p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-zinc-500">Final Score</dt>
            <dd className="font-medium text-white">{game.finalScore ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Winner</dt>
            <dd className="font-medium text-white">{game.winnerTeam ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Brier</dt>
            <dd className="font-mono text-xs text-zinc-300">
              {game.brier != null ? game.brier.toFixed(4) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">LogLoss</dt>
            <dd className="font-mono text-xs text-zinc-300">
              {game.logLoss != null ? game.logLoss.toFixed(4) : "—"}
            </dd>
          </div>
        </dl>

        {correct && game.whyCorrect.length > 0 ? (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-emerald-300">
              Why Correct?
            </h4>
            <ul className="mt-2 space-y-2">
              {game.whyCorrect.map((c) => (
                <li
                  key={c.code}
                  className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-sm text-zinc-300"
                >
                  <span className="font-medium text-emerald-200">
                    {c.role === "primary" ? "주요 복기 후보 · " : "보조 · "}
                    {c.label}
                  </span>
                  <p className="mt-1 text-xs text-zinc-500">{c.plain}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {incorrect && game.whyIncorrect.length > 0 ? (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-red-300">
              Why Incorrect?
            </h4>
            <ul className="mt-2 space-y-2">
              {game.whyIncorrect.map((c) => (
                <li
                  key={c.code}
                  className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-sm text-zinc-300"
                >
                  <span className="font-medium text-red-200">
                    {c.role === "primary" ? "주요 복기 후보 · " : "보조 · "}
                    {c.label}
                  </span>
                  <p className="mt-1 text-xs text-zinc-500">{c.plain}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <footer className="px-4 py-4 sm:px-5">
        <h4 className="text-sm font-semibold text-white">What We Learned</h4>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          {game.whatWeLearned}
        </p>
        {game.detailHref ? (
          <a
            href={game.detailHref.replace(/[?&]feedback=1/, "")}
            className="mt-3 inline-block text-sm text-sky-400 hover:underline"
          >
            상세 복기 →
          </a>
        ) : null}
      </footer>
    </article>
  );
}

export default function GoodPickFeedbackView({
  view,
}: {
  view: GoodPickFeedbackView;
}) {
  if (view.statusCode === "NO_PREGAME_SNAPSHOT") {
    return (
      <section className="rounded-xl border border-red-900/50 bg-red-950/20 px-5 py-6">
        <h2 className="text-lg font-semibold text-red-200">
          NO_PREGAME_SNAPSHOT
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          {view.dateKst}에는 사전 Prediction Snapshot이 없습니다. 사후 결과로
          Good Pick을 만들지 않으며, Good Pick Accuracy에도 포함하지 않습니다.
        </p>
        <p className="mt-2 font-mono text-xs text-zinc-500">{view.error}</p>
      </section>
    );
  }

  if (!view.loaded) {
    return (
      <section className="rounded-xl border border-zinc-800 px-5 py-4 text-sm text-zinc-400">
        {view.error ?? "Feedback를 불러오지 못했습니다."}
      </section>
    );
  }

  const sb = view.goodPickScoreboard;
  const all = view.allResearch;

  return (
    <div className="space-y-8">
      {/* Separated scoreboards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-700 bg-zinc-900/50 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            All Research Predictions
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            전체 연구 성적 · Good Pick과 혼합하지 않음
          </p>
          {all ? (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-zinc-500">Games</dt>
                <dd className="text-xl font-bold text-white">{all.totalGames}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Correct</dt>
                <dd className="text-xl font-bold text-emerald-300">
                  {all.correct}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Incorrect</dt>
                <dd className="text-xl font-bold text-red-300">
                  {all.incorrect}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Accuracy</dt>
                <dd className="text-xl font-bold text-white">
                  {all.accuracyPercent != null ? `${all.accuracyPercent}%` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Brier</dt>
                <dd className="font-mono text-xs text-zinc-300">
                  {all.brier != null ? all.brier.toFixed(4) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Leakage</dt>
                <dd className="text-sm text-zinc-200">
                  {all.leakageStatus ?? "—"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">전체 성적 Artifact 없음</p>
          )}
        </section>

        <section className="rounded-xl border border-amber-900/50 bg-amber-950/20 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-300/90">
            Good Picks Scoreboard
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Daily Picks에 표시된 Good Pick만 · 최대 3경기
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-zinc-500">Good Picks</dt>
              <dd className="text-xl font-bold text-white">{sb.goodPickCount}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Correct</dt>
              <dd className="text-xl font-bold text-emerald-300">{sb.correct}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Incorrect</dt>
              <dd className="text-xl font-bold text-red-300">{sb.incorrect}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Accuracy</dt>
              <dd className="text-xl font-bold text-amber-200">
                {sb.accuracyPercent != null ? `${sb.accuracyPercent}%` : "—"}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">
          Yesterday&apos;s Good Picks · {view.dateKst}
        </h2>
        {view.games.length === 0 ? (
          <p className="text-sm text-zinc-500">
            이 날짜에 Daily Picks Good Pick이 없습니다.
          </p>
        ) : (
          view.games.map((g) => <GameFeedbackCard key={g.gameId} game={g} />)
        )}
      </section>

      {view.dailyLearning ? (
        <section className="rounded-xl border border-violet-900/40 bg-violet-950/20 px-5 py-4">
          <h2 className="text-lg font-semibold text-violet-100">
            {view.dailyLearning.title}
          </h2>
          <p className="mt-1 text-sm text-zinc-300">
            {view.dailyLearning.goodPickLine}
          </p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Top Success Candidate</dt>
              <dd className="text-zinc-100">
                {view.dailyLearning.topSuccessCandidate ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Top Failure Candidate</dt>
              <dd className="text-zinc-100">
                {view.dailyLearning.topFailureCandidate ?? "—"}
              </dd>
            </div>
          </dl>
          {view.dailyLearning.commonPreGameRisks.length > 0 ? (
            <p className="mt-3 text-sm text-zinc-300">
              사전 위험 신호:{" "}
              {view.dailyLearning.commonPreGameRisks.join(" · ")}
            </p>
          ) : null}
          <div className="mt-3">
            <p className="text-xs font-medium text-violet-200">
              Research Questions (Engine 변경 아님)
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-300">
              {view.dailyLearning.researchQuestions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            {view.dailyLearning.plain}
          </p>
        </section>
      ) : null}

      {view.predictionHash ? (
        <p className="font-mono text-[10px] text-zinc-600">
          predictionHash · {view.predictionHash}
        </p>
      ) : null}
    </div>
  );
}

/** Compact card for Daily Picks / Research UX entry */
export function GoodPickFeedbackTeaser({
  view,
  href,
}: {
  view: GoodPickFeedbackView;
  href: string;
}) {
  if (view.statusCode === "NO_PREGAME_SNAPSHOT") {
    return (
      <a
        href={href}
        className="block rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 hover:border-red-700"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
          지난 추천 복기
        </p>
        <p className="mt-1 text-sm text-zinc-300">
          {view.dateKst} · NO_PREGAME_SNAPSHOT
        </p>
      </a>
    );
  }

  const sb = view.goodPickScoreboard;
  return (
    <a
      href={href}
      className="block rounded-xl border border-amber-900/40 bg-gradient-to-r from-amber-950/30 to-zinc-900/80 px-4 py-4 hover:border-amber-700"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
        Yesterday&apos;s Good Picks
      </p>
      <p className="mt-1 text-lg font-bold text-white">
        {sb.correct} / {sb.goodPickCount} Correct
        {sb.accuracyPercent != null ? (
          <span className="ml-2 text-base font-semibold text-amber-200">
            {sb.accuracyPercent}%
          </span>
        ) : null}
      </p>
      <ul className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-300">
        {view.games.slice(0, 3).map((g) => (
          <li
            key={g.gameId}
            className={`rounded border px-2 py-0.5 ${
              g.grade === "CORRECT"
                ? "border-emerald-800 text-emerald-300"
                : g.grade === "INCORRECT"
                  ? "border-red-900 text-red-300"
                  : "border-zinc-700"
            }`}
          >
            {g.matchupLine.split("@")[0]?.trim() ?? g.matchupLine}{" "}
            {g.grade === "CORRECT"
              ? "✓"
              : g.grade === "INCORRECT"
                ? "✗"
                : "·"}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-sky-400">지난 추천 복기 열기 →</p>
    </a>
  );
}
