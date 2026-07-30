import type {
  MlbDailyDatasetStatus,
  MlbDailyPipelineStatus,
  MlbDailyResearchSummaryDocument,
  MlbDailyResearchSummaryLoad,
} from "@/lib/mlb/mlb-daily-research-summary-types";

type Props = {
  load: MlbDailyResearchSummaryLoad;
  dateKst: string;
};

function datasetBadgeClass(status: MlbDailyDatasetStatus): string {
  switch (status) {
    case "READY":
      return "bg-green-950/40 text-green-400 border-green-800";
    case "PARTIAL":
      return "bg-amber-950/40 text-amber-400 border-amber-800";
    case "FAILED":
      return "bg-red-950/40 text-red-400 border-red-800";
    case "NOT_RELEASED":
      return "bg-blue-950/40 text-blue-400 border-blue-800";
    case "SKIP":
      return "bg-zinc-800/60 text-zinc-400 border-zinc-700";
    default:
      return "bg-zinc-800/60 text-zinc-400 border-zinc-700";
  }
}

function pipelineBadgeClass(status: MlbDailyPipelineStatus): string {
  switch (status) {
    case "SUCCESS":
      return "bg-green-950/40 text-green-400 border-green-800";
    case "PARTIAL":
      return "bg-amber-950/40 text-amber-400 border-amber-800";
    case "FAILED":
      return "bg-red-950/40 text-red-400 border-red-800";
    default:
      return "bg-zinc-800/60 text-zinc-400 border-zinc-700";
  }
}

/** Display-only: strip known suffixes from Builder count strings. */
function completeCell(
  dataset: string,
  doc: MlbDailyResearchSummaryDocument,
): string {
  const { counts } = doc;
  switch (dataset) {
    case "Schedule": {
      const n = counts.scheduleGames;
      return n == null ? "—" : `${n}/${n}`;
    }
    case "Starter":
      return stripCountSuffix(counts.starterComplete) ?? "—";
    case "Odds":
      return stripCountSuffix(counts.oddsCollected) ?? "—";
    case "Lineup":
      return stripCountSuffix(counts.lineupConfirmed) ?? "—";
    default: {
      const row = doc.researchReady.datasets.find((d) => d.dataset === dataset);
      return row?.detail || "—";
    }
  }
}

function stripCountSuffix(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d+\s*\/\s*\d+)/);
  return m ? m[1].replace(/\s+/g, "") : raw;
}

function EmptyState({
  message,
  dateKst,
}: {
  message: string;
  dateKst: string;
}) {
  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-6">
      <h2 className="mb-2 text-lg font-semibold text-white">
        MLB Daily Research Summary
      </h2>
      <p className="mb-1 text-xs text-zinc-600">{dateKst}</p>
      <p className="text-sm text-zinc-500">{message}</p>
    </section>
  );
}

function SummaryBody({
  doc,
  pipelineStatus,
  banner,
  dateKst,
}: {
  doc: MlbDailyResearchSummaryDocument;
  pipelineStatus: MlbDailyPipelineStatus;
  banner?: string;
  dateKst: string;
}) {
  const datasets =
    doc.researchReady.datasets.length > 0
      ? doc.researchReady.datasets
      : doc.steps.map((s) => ({
          dataset: s.step,
          status: s.status,
          detail: s.detail,
          artifact: s.artifact,
        }));

  const sourceNames = datasets
    .filter((d) => d.artifact != null)
    .map((d) => d.dataset);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">
          MLB Daily Research Summary
        </h2>
        <p className="mt-0.5 text-xs text-zinc-600">{dateKst}</p>
      </div>

      {banner && (
        <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {banner}
        </div>
      )}

      {/* Research Ready Card */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Research Ready
        </div>
        <div className="mt-1 text-3xl font-bold text-white">
          {doc.researchReady.percent}%
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          {doc.researchReady.score} / {doc.researchReady.max}
          {doc.researchReady.missing.length > 0
            ? ` · gaps: ${doc.researchReady.missing.join(", ")}`
            : ""}
        </div>
      </div>

      {/* Pipeline Status */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Pipeline Status
        </div>
        <div className="mt-2">
          <span
            className={`rounded-full border px-3 py-0.5 text-sm font-semibold ${pipelineBadgeClass(pipelineStatus)}`}
          >
            {pipelineStatus}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {doc.steps.map((s) => (
            <div
              key={s.step}
              className="rounded border border-zinc-800 bg-zinc-950/40 px-2.5 py-1.5 text-xs"
            >
              <span className="font-medium text-zinc-300">{s.step}</span>
              <span
                className={`ml-2 ${
                  s.run === "SUCCESS"
                    ? "text-green-400"
                    : s.run === "FAIL"
                      ? "text-red-400"
                      : "text-zinc-500"
                }`}
              >
                {s.run}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Dataset Status Table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Dataset Summary
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                <th className="pb-2 pr-3 font-medium">Dataset</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 font-medium">Complete</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((d) => (
                <tr key={d.dataset} className="border-b border-zinc-800/60">
                  <td className="py-2.5 pr-3 font-medium text-zinc-200">
                    {d.dataset}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${datasetBadgeClass(d.status)}`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-zinc-300">
                    {completeCell(d.dataset, doc)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assistant Summary — Builder string as-is */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Assistant Summary
        </div>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-300">
          {doc.assistantSummary}
        </pre>
      </div>

      {/* Artifact Metadata — no file paths */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Artifact Metadata
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500">Artifact version</dt>
            <dd className="text-zinc-300">{doc.schemaVersion}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Generated at</dt>
            <dd className="text-zinc-300">{doc.generatedAt}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Pipeline version</dt>
            <dd className="text-zinc-300">
              {doc.pipelineVersion ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Rounding policy</dt>
            <dd className="text-zinc-300">
              {doc.roundingPolicy ?? "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-zinc-500">Source artifacts</dt>
            <dd className="text-zinc-300">
              {sourceNames.length > 0 ? sourceNames.join(", ") : "—"}
            </dd>
          </div>
          {doc.pipeline.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-zinc-500">Pipeline</dt>
              <dd className="text-zinc-300">{doc.pipeline.join(" → ")}</dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}

export default function MlbDailyResearchSummaryPanel({
  load,
  dateKst,
}: Props) {
  if (load.kind === "missing") {
    return (
      <EmptyState dateKst={dateKst} message="No Daily Research Summary" />
    );
  }
  if (load.kind === "invalid") {
    return <EmptyState dateKst={dateKst} message="Invalid Summary" />;
  }
  if (load.kind === "unsupported") {
    return (
      <EmptyState
        dateKst={dateKst}
        message={`Unsupported Version${
          load.schemaVersion ? ` (${load.schemaVersion})` : ""
        }`}
      />
    );
  }
  if (load.kind === "pipeline_failed") {
    return (
      <SummaryBody
        dateKst={dateKst}
        doc={load.document}
        pipelineStatus="FAILED"
        banner="Pipeline Failed"
      />
    );
  }

  return (
    <SummaryBody
      dateKst={dateKst}
      doc={load.document}
      pipelineStatus={load.pipelineStatus}
    />
  );
}
