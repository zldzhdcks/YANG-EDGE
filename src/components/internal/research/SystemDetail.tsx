import type {
  PipelineStatus,
  Severity,
  ResearchLabData,
} from "@/lib/internal/research-lab-reader";

type Props = {
  data: ResearchLabData;
  dateKst: string;
};

function NA() {
  return <span className="text-zinc-600">NOT_AVAILABLE</span>;
}

function Val({ v }: { v: number | null | undefined }) {
  if (v == null) return <NA />;
  return <span>{v}</span>;
}

function statusColor(s: PipelineStatus): string {
  switch (s) {
    case "COMPLETE": return "text-green-400 bg-green-950/40 border-green-800";
    case "PARTIAL": return "text-amber-400 bg-amber-950/40 border-amber-800";
    case "WARNING": return "text-red-400 bg-red-950/40 border-red-800";
    case "PENDING":
    case "NOT_CREATED":
    case "NOT_READY":
    case "NOT_ENTERED":
      return "text-blue-400 bg-blue-950/40 border-blue-800";
    case "FILE_NOT_FOUND": return "text-zinc-500 bg-zinc-900/40 border-zinc-700";
    default: return "text-zinc-500 bg-zinc-900/40 border-zinc-700";
  }
}

function severityColor(s: Severity): string {
  switch (s) {
    case "CRITICAL": return "text-red-400";
    case "HIGH": return "text-amber-400";
    case "NORMAL": return "text-blue-400";
    case "LOW": return "text-zinc-500";
  }
}

export default function SystemDetail({ data, dateKst }: Props) {
  const s = data.summary;

  return (
    <div className="space-y-8">
      <div className="rounded border border-zinc-700 bg-zinc-900/40 px-4 py-2 text-xs text-zinc-500">
        개발자 전용 기술 화면 · 일상 운영은{" "}
        <a href={`/internal/dashboard?date=${dateKst}`} className="text-blue-400 hover:underline">
          대시보드
        </a>
        를 먼저 확인하세요. (이전 시스템 상세 탭은 개발자 진단으로 이동 · deprecated)
      </div>

      {/* Summary Cards */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Today&apos;s Research</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {([
            ["Total Games", s.totalGames],
            ["Graded", s.gradedGames],
            ["Hits", s.hitGames],
            ["Misses", s.missGames],
            ["Accuracy", s.accuracy],
            ["Pending Results", s.pendingResultGames],
            ["Postponed", s.postponedGames],
            ["PASS", s.passGames],
            ["BASELINE_CANDIDATE", s.baselineCandidateGames],
            ["MARKET_CONFLICT", s.marketConflictGames],
            ["Strict EDGE PICK", s.strictEdgePickGames],
            ["Review Pending", s.reviewPendingGames],
          ] as [string, number | null][]).map(([label, val]) => (
            <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <div className="text-xs text-zinc-500">{label}</div>
              <div className="mt-0.5 text-lg font-semibold text-zinc-100">
                {val != null ? (label === "Accuracy" ? `${val}%` : val) : <NA />}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline Status */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Pipeline Status</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.pipelines.map((p) => (
            <div key={p.pipelineName} className={`rounded-lg border px-3 py-2 ${statusColor(p.status)}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{p.pipelineName}</span>
                <span className="rounded bg-black/30 px-1.5 py-0.5 text-xs font-mono">{p.status}</span>
              </div>
              {p.completedCount != null && p.totalCount != null && (
                <div className="mt-1 text-xs opacity-80">{p.completedCount} / {p.totalCount}</div>
              )}
              <div className="mt-1 truncate text-xs opacity-60">{p.message}</div>
              {p.sourceArtifact && <div className="mt-0.5 truncate text-xs opacity-40 font-mono">{p.sourceArtifact}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Tasks */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Today&apos;s Tasks</h2>
        <p className="mb-2 text-xs text-zinc-600">시스템 자동 생성 Task. 사용자 상태는 운영 홈에서 관리합니다.</p>
        {data.tasks.length === 0 ? (
          <p className="text-sm text-zinc-500">자동 생성된 Task가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {data.tasks.map((t) => (
              <div key={t.taskId} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${severityColor(t.priority)}`}>{t.priority}</span>
                  <span className="text-sm font-medium text-zinc-200">{t.title}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{t.description}</p>
                {t.recommendedCommand && (
                  <code className="mt-2 block rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 font-mono select-all">
                    {t.recommendedCommand}
                  </code>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Missed Items */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">놓치고 있는 문제</h2>
        {data.missedItems.length === 0 ? (
          <p className="text-sm text-zinc-500">현재 감지된 문제가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-zinc-500">
                  <th className="py-1 pr-3">Severity</th>
                  <th className="py-1 pr-3">Issue</th>
                  <th className="py-1 pr-3">Count</th>
                  <th className="py-1 pr-3">Reason</th>
                  <th className="py-1">Source</th>
                </tr>
              </thead>
              <tbody>
                {data.missedItems.map((m) => (
                  <tr key={m.id} className="border-b border-zinc-800/50 text-zinc-300">
                    <td className={`py-1.5 pr-3 font-semibold ${severityColor(m.severity)}`}>{m.severity}</td>
                    <td className="py-1.5 pr-3">{m.label}</td>
                    <td className="py-1.5 pr-3"><Val v={m.count} /></td>
                    <td className="py-1.5 pr-3 text-zinc-500">{m.reason}</td>
                    <td className="py-1.5 font-mono text-zinc-600 truncate max-w-48">{m.sourceArtifact ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Starter Health */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Starter Dataset Health</h2>
        <div className={`rounded-lg border px-4 py-3 ${statusColor(data.starterHealth.status)}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Starter Dataset</span>
            <span className="rounded bg-black/30 px-1.5 py-0.5 text-xs font-mono">{data.starterHealth.status}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            <div>Expected Rows: <Val v={data.starterHealth.expectedRows} /></div>
            <div>Collected: <Val v={data.starterHealth.collectedRows} /></div>
            <div>Missing: <Val v={data.starterHealth.missingRows} /></div>
            <div>Probable: <Val v={data.starterHealth.probableCount} /></div>
            <div>Missing Probable: <Val v={data.starterHealth.missingProbableCount} /></div>
          </div>
          {data.starterHealth.warningCodes.length > 0 && (
            <div className="mt-2 text-xs text-amber-400">Warnings: {data.starterHealth.warningCodes.join(", ")}</div>
          )}
          {data.starterHealth.sourceArtifact && (
            <div className="mt-1 truncate text-xs opacity-40 font-mono">{data.starterHealth.sourceArtifact}</div>
          )}
        </div>
      </section>

      {/* Review Queue */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Review Queue Summary</h2>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {([
            ["Total", data.reviewQueue.totalReviewRows],
            ["Pending", data.reviewQueue.pendingReviewRows],
            ["Completed", data.reviewQueue.completedReviewRows],
            ["HIT", data.reviewQueue.hitReviewRows],
            ["MISS", data.reviewQueue.missReviewRows],
          ] as [string, number | null][]).map(([label, val]) => (
            <div key={label} className="rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-center">
              <div className="text-xs text-zinc-500">{label}</div>
              <div className="text-sm font-semibold text-zinc-200"><Val v={val} /></div>
            </div>
          ))}
        </div>
        {data.reviewQueue.topCandidates.length > 0 && (
          <>
            <p className="mb-2 text-xs text-zinc-600">Temporary Sort · Not Research Priority Score</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-zinc-500">
                    <th className="py-1 pr-2">Game</th>
                    <th className="py-1 pr-2">Match</th>
                    <th className="py-1 pr-2">Predicted</th>
                    <th className="py-1 pr-2">Conf</th>
                    <th className="py-1 pr-2">Grade</th>
                    <th className="py-1 pr-2">Tier</th>
                    <th className="py-1">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reviewQueue.topCandidates.map((r) => (
                    <tr key={r.gameId} className="border-b border-zinc-800/50 text-zinc-300">
                      <td className="py-1.5 pr-2 font-mono">{r.gameId}</td>
                      <td className="py-1.5 pr-2">{r.match}</td>
                      <td className="py-1.5 pr-2">{r.predictedTeam ?? "—"}</td>
                      <td className="py-1.5 pr-2"><Val v={r.confidence} /></td>
                      <td className={`py-1.5 pr-2 font-semibold ${r.gradeStatus === "HIT" ? "text-green-400" : r.gradeStatus === "MISS" ? "text-red-400" : "text-zinc-500"}`}>
                        {r.gradeStatus}
                      </td>
                      <td className="py-1.5 pr-2">{r.pickTier}</td>
                      <td className="py-1.5 text-zinc-500">{r.reviewStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Commands */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Recommended Commands</h2>
        <p className="mb-2 text-xs text-zinc-600">읽기 전용 — 실행 버튼 없음. 복사하여 터미널에서 실행하세요.</p>
        <div className="space-y-1.5">
          {data.commands.map((c) => (
            <div key={c.label} className="flex flex-col gap-1 rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-zinc-400">{c.label}</span>
              {c.command ? (
                <code className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 font-mono select-all">{c.command}</code>
              ) : (
                <span className="text-xs text-zinc-600">NO_OPERATIONAL_COMMAND</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* KBO Betting Line Pipeline */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">KBO Betting Line Pipeline</h2>
        <div className="grid gap-1.5 sm:grid-cols-3 md:grid-cols-6">
          {data.kboReadiness.bettingLinePipeline.map((stage) => (
            <div key={stage.stage} className={`rounded border px-3 py-2 text-center ${
              stage.status === "PASS" ? "border-green-800 bg-green-950/30 text-green-400" :
              stage.status === "WARN" ? "border-amber-800 bg-amber-950/30 text-amber-400" :
              "border-red-800 bg-red-950/30 text-red-400"
            }`}>
              <div className="text-xs font-semibold">{stage.stage}</div>
              <div className="mt-0.5 text-xs font-bold">{stage.status}</div>
              <div className="mt-0.5 text-xs opacity-60">{stage.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Source Artifacts */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Source Artifact Information</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="py-1 pr-3">Name</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1">Path</th>
              </tr>
            </thead>
            <tbody>
              {data.sourceArtifacts.map((a) => (
                <tr key={a.name} className="border-b border-zinc-800/50 text-zinc-300">
                  <td className="py-1.5 pr-3">{a.name}</td>
                  <td className={`py-1.5 pr-3 font-semibold ${a.status === "OK" ? "text-green-400" : "text-amber-400"}`}>{a.status}</td>
                  <td className="py-1.5 font-mono text-zinc-500">{a.path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
