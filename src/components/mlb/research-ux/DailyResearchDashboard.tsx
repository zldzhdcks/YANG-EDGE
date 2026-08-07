import type {
  DailyResearchDashboardModel,
  VersionIdentityModel,
} from "@/lib/mlb/research-ux-v1";

export function DailyResearchDashboard({
  dashboard,
}: {
  dashboard: DailyResearchDashboardModel;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
      <h2 className="text-lg font-semibold text-white">Today&apos;s Result</h2>
      <p className="mt-1 text-xs text-zinc-500">{dashboard.dateKst} · research graded</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Games" value={String(dashboard.totalGames)} />
        <Stat label="Correct" value={String(dashboard.correct)} tone="good" />
        <Stat label="Incorrect" value={String(dashboard.incorrect)} tone="bad" />
        <Stat
          label="Accuracy"
          value={
            dashboard.accuracyPercent != null
              ? `${dashboard.accuracyPercent}%`
              : "—"
          }
        />
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-zinc-200">
          Top Failure Reasons
        </h3>
        {dashboard.topFailureReasons.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No failure tags today</p>
        ) : (
          <ol className="mt-2 space-y-2">
            {dashboard.topFailureReasons.map((r) => (
              <li
                key={r.code}
                className="flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-200"
              >
                <span aria-hidden>{r.medal}</span>
                <span className="font-medium">
                  {r.label} ({r.count})
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  const color =
    tone === "good"
      ? "text-emerald-300"
      : tone === "bad"
        ? "text-red-300"
        : "text-white";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

export function AiResearchCommentary({ text }: { text: string }) {
  return (
    <section className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 px-5 py-4">
      <h2 className="text-lg font-semibold text-indigo-100">
        AI Research Commentary
      </h2>
      <p className="mt-1 text-xs text-indigo-300/70">
        Auto-generated from review tags · not an Engine change proposal
      </p>
      <p className="mt-3 text-sm leading-relaxed text-zinc-200">{text}</p>
    </section>
  );
}

export function ResearchTimeline({
  points,
  activeDate,
}: {
  points: Array<{
    dateKst: string;
    accuracyPercent: number | null;
    href: string;
  }>;
  activeDate: string;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
      <h2 className="text-lg font-semibold text-white">Timeline</h2>
      <p className="mt-1 text-xs text-zinc-500">최근 연구 · Accuracy Trend</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {points.map((p) => {
          const active = p.dateKst === activeDate;
          return (
            <a
              key={p.dateKst}
              href={p.href}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                active
                  ? "border-sky-600 bg-sky-950/40 text-sky-100"
                  : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              <div className="font-medium">
                {p.dateKst.slice(5)}
              </div>
              <div className="text-xs text-zinc-500">
                {p.accuracyPercent != null ? `${p.accuracyPercent}%` : "—"}
              </div>
            </a>
          );
        })}
      </div>
      {points.length >= 2 ? (
        <p className="mt-3 text-xs text-zinc-500">
          Trend:{" "}
          {points
            .map((p) =>
              p.accuracyPercent != null ? `${p.accuracyPercent}` : "—",
            )
            .join(" → ")}
        </p>
      ) : null}
    </section>
  );
}

export function VersionIdentityBar({
  versions,
}: {
  versions: VersionIdentityModel;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-5 py-4">
      <h2 className="text-sm font-semibold text-zinc-200">Identity</h2>
      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-zinc-500">Prediction Hash</dt>
          <dd className="mt-1 break-all font-mono text-[11px] text-zinc-300">
            {versions.predictionHash ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Research Version</dt>
          <dd className="mt-1 text-zinc-200">
            {versions.researchVersion ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Review Version</dt>
          <dd className="mt-1 text-zinc-200">
            {versions.reviewVersion ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Engine Version</dt>
          <dd className="mt-1 text-zinc-200">
            {versions.engineVersion ?? "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-zinc-600">
        Hashes are displayed read-only. This viewer never regenerates Prediction.
      </p>
    </section>
  );
}
