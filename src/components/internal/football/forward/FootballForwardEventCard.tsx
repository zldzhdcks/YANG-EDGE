import type { ForwardGradedEvent } from "@/lib/football/forward-read-model-v1";
import { formatResearchPercent } from "@/lib/football/forward-internal-prototype-v1";

function Badge({
  label,
  tone = "zinc",
}: {
  label: string;
  tone?: "zinc" | "emerald" | "rose" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-700 bg-emerald-950 text-emerald-200"
      : tone === "rose"
        ? "border-rose-700 bg-rose-950 text-rose-200"
        : tone === "amber"
          ? "border-amber-700 bg-amber-950 text-amber-200"
          : "border-zinc-600 bg-zinc-900 text-zinc-100";
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide ${toneClass}`}
    >
      {label}
    </span>
  );
}

function ProbabilityRow({
  label,
  value,
  emphasized,
}: {
  label: "HOME" | "DRAW" | "AWAY";
  value: number;
  emphasized: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          {label}
        </span>
        <span
          className={`font-mono text-sm tabular-nums ${emphasized ? "text-white" : "text-zinc-300"}`}
        >
          {formatResearchPercent(value)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-zinc-800">
        <div
          className={`h-full ${emphasized ? "bg-sky-400" : "bg-zinc-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function FootballForwardEventCard({
  event,
}: {
  event: ForwardGradedEvent;
}) {
  const unresolved = event.identityStatus === "UNRESOLVED";
  const title = unresolved
    ? `Fixture #${event.fixtureId}`
    : `${event.homeTeam} vs ${event.awayTeam}`;

  return (
    <article
      className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
      data-forward-event={event.fixtureId}
      data-forward-identity={event.identityStatus}
      data-forward-correct={event.correct ? "true" : "false"}
      data-forward-predicted={event.predictedClass}
      data-forward-actual={event.actualClass}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-zinc-500">
            fixtureId {event.fixtureId}
          </p>
          <h3 className="mt-1 break-words text-base font-semibold text-white">
            {title}
          </h3>
          {unresolved ? (
            <p className="mt-1 text-sm text-zinc-400">팀 정보 미해결</p>
          ) : (
            <p className="mt-1 break-words text-sm text-zinc-400">
              {event.league}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge label={event.identityStatus} tone={unresolved ? "amber" : "zinc"} />
          <Badge
            label={event.correct ? "정답" : "오답"}
            tone={event.correct ? "emerald" : "rose"}
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Kickoff UTC
          </dt>
          <dd className="mt-0.5 font-mono text-xs text-zinc-200 break-all">
            {event.kickoffUtc}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            모델
          </dt>
          <dd className="mt-0.5 font-mono text-xs text-zinc-200 break-words">
            {event.modelVersion}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            예측 생성
          </dt>
          <dd className="mt-0.5 font-mono text-xs text-zinc-200 break-all">
            {event.predictionCreatedAt}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            사전 봉인
          </dt>
          <dd className="mt-0.5 font-mono text-xs text-zinc-200 break-all">
            {event.sealedAt}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          연구 확률
        </p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ProbabilityRow
            label="HOME"
            value={event.probabilities.home}
            emphasized={event.predictedClass === "HOME"}
          />
          <ProbabilityRow
            label="DRAW"
            value={event.probabilities.draw}
            emphasized={event.predictedClass === "DRAW"}
          />
          <ProbabilityRow
            label="AWAY"
            value={event.probabilities.away}
            emphasized={event.predictedClass === "AWAY"}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge label={`예측 ${event.predictedClass}`} />
        <Badge label={`실제 결과 ${event.actualClass}`} />
        <Badge label={event.probabilityBucket} />
      </div>

      <div className="mt-4 border-t border-zinc-800 pt-3 text-sm text-zinc-300">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Pregame provenance
        </p>
        <ul className="mt-2 space-y-1 font-mono text-xs text-zinc-300">
          <li>validPregame {event.provenance.validPregame ? "Yes" : "No"}</li>
          <li>
            sealedBeforeKickoff{" "}
            {event.provenance.sealedBeforeKickoff ? "Yes" : "No"}
          </li>
          <li>
            predictionCreatedBeforeKickoff{" "}
            {event.provenance.predictionCreatedBeforeKickoff ? "Yes" : "No"}
          </li>
        </ul>
      </div>

      <details className="mt-3 min-w-0">
        <summary className="cursor-pointer text-xs text-zinc-500">
          Provenance hashes
        </summary>
        <dl className="mt-2 space-y-1 font-mono text-[10px] leading-relaxed text-zinc-500 break-all">
          <div>snapshotHash {event.provenance.snapshotHash}</div>
          <div>receiptHash {event.provenance.receiptHash}</div>
          <div>gradeHash {event.provenance.gradeHash}</div>
          <div>modelSourceHash {event.modelSourceHash}</div>
        </dl>
      </details>
    </article>
  );
}
