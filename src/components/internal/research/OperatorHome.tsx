import type { ResearchLabData } from "@/lib/internal/research-lab-reader";
import type { OperatorPresentation } from "@/lib/internal/research-lab-presenter";
import OperatorTaskList from "./OperatorTaskList";
import EdgeAssistantCard from "./EdgeAssistantCard";
import MlbDailyResearchSummaryPanel from "./MlbDailyResearchSummaryPanel";

type Props = {
  data: ResearchLabData;
  op: OperatorPresentation;
  dateKst: string;
};

function statusBadge(s: OperatorPresentation["overallStatus"]) {
  const map: Record<string, string> = {
    "정상 진행": "bg-green-950/40 text-green-400 border-green-800",
    "확인 필요": "bg-amber-950/40 text-amber-400 border-amber-800",
    "작업 필요": "bg-blue-950/40 text-blue-400 border-blue-800",
    "중요 문제 있음": "bg-red-950/40 text-red-400 border-red-800",
  };
  return (
    <span className={`rounded-full border px-3 py-0.5 text-sm font-semibold ${map[s] ?? ""}`}>
      {s}
    </span>
  );
}

function groupStatusColor(s: string): string {
  switch (s) {
    case "완료": return "text-green-400 border-green-800 bg-green-950/30";
    case "일부 확인 필요": return "text-amber-400 border-amber-800 bg-amber-950/30";
    case "대기": return "text-blue-400 border-blue-800 bg-blue-950/30";
    case "문제 있음": return "text-red-400 border-red-800 bg-red-950/30";
    default: return "text-zinc-500 border-zinc-700 bg-zinc-900/30";
  }
}

function priorityColor(s: string): string {
  switch (s) {
    case "CRITICAL": return "text-red-400";
    case "HIGH": return "text-amber-400";
    case "NORMAL": return "text-blue-400";
    default: return "text-zinc-500";
  }
}

function readinessDot(val: string): string {
  if (
    val.includes("MISSING") ||
    val.includes("BLOCKED") ||
    val === "NOT_AVAILABLE"
  ) {
    return "bg-red-500";
  }
  if (
    val.includes("NOT_ENTERED") ||
    val.includes("NOT_CREATED") ||
    val.includes("NOT_READY") ||
    val.includes("WAITING") ||
    val.includes("PARTIAL") ||
    val === "UNKNOWN"
  ) {
    return "bg-amber-500";
  }
  if (val.includes("NOT_APPLICABLE")) return "bg-zinc-500";
  return "bg-green-500";
}

export default function OperatorHome({ data, op, dateKst }: Props) {
  const rs = op.resultSummary;
  const kboOps = op.kboDailyOps;
  const showMlbSummary =
    data.mlbDailyResearchSummary.kind === "ok" ||
    data.mlbDailyResearchSummary.kind === "pipeline_failed";

  return (
    <div className="space-y-8">
      {/* C-1: 오늘의 한 줄 요약 */}
      <section className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-4">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">오늘의 연구 현황</h2>
          {statusBadge(op.overallStatus)}
        </div>
        {op.summaryLines.length > 0 ? (
          <div className="space-y-1 text-sm text-zinc-300">
            {op.summaryLines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">요약을 생성할 수 있는 데이터가 없습니다.</p>
        )}
      </section>

      {/* KBO 운영 현황 — Prediction 없어도 표시 */}
      {kboOps && (
        <section className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-5 py-4">
          <h2 className="mb-3 text-lg font-semibold text-emerald-300">KBO 운영 현황</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 text-sm">
            {([
              ["Schedule Games", String(kboOps.scheduleGames)],
              ["Active Games", String(kboOps.activeGames)],
              ["Cancelled", String(kboOps.cancelledGames)],
              ["Proto Ready", kboOps.protoReady],
              ["Starter Ready", kboOps.starterReady],
              ["Lineup Ready", kboOps.lineupReady],
              ["T45 Status", kboOps.t45Status],
              ["Prediction", kboOps.prediction],
              ["Review", kboOps.review],
              ["Overall", kboOps.overall],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} className="rounded border border-emerald-900/40 px-3 py-2">
                <div className="text-xs text-emerald-500/80">{label}</div>
                <div className="mt-0.5 font-semibold text-emerald-100">{val}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MLB Daily Research Summary — only when MLB artifact exists */}
      {showMlbSummary ? (
        <MlbDailyResearchSummaryPanel
          load={data.mlbDailyResearchSummary}
          dateKst={dateKst}
        />
      ) : (
        <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-400">MLB Daily Research Summary</h2>
          <p className="mt-1 text-xs text-zinc-500">
            이 날짜의 MLB summary는 아직 생성되지 않았습니다. KBO 운영 현황과 별도로 표시합니다.
          </p>
        </section>
      )}

      {/* EDGE Assistant */}
      <EdgeAssistantCard data={data} op={op} dateKst={dateKst} />

      {/* Completed KBO milestones */}
      {op.completedKboItems.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">완료된 KBO 작업</h2>
          <ul className="space-y-1 text-sm text-zinc-400">
            {op.completedKboItems.map((item) => (
              <li key={item.id} className="flex gap-2">
                <span className="text-green-500">✓</span>
                <span>
                  <span className="text-zinc-200">{item.title}</span>
                  <span className="text-zinc-600"> — {item.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* C-2: 오늘 반드시 확인할 일 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">오늘 반드시 확인할 일</h2>
        <OperatorTaskList cards={op.actionCards} dateKst={dateKst} />
      </section>

      {/* C-3: 현재 진행 상황 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">현재 진행 상황</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {op.pipelineGroups.map((g) => (
            <div key={g.label} className={`rounded-lg border px-3 py-2 ${groupStatusColor(g.status)}`}>
              <div className="text-sm font-semibold">{g.label}</div>
              <div className="mt-0.5 text-xs font-semibold">{g.status}</div>
              <div className="mt-1 text-xs opacity-60">{g.detail}</div>
            </div>
          ))}
        </div>
      </section>

      {/* C-4: 놓치면 안 되는 문제 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">놓치면 안 되는 문제</h2>
        {op.missedExplanations.length === 0 ? (
          <p className="text-sm text-zinc-500">현재 감지된 문제가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {op.missedExplanations.map((m) => (
              <div key={m.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold ${priorityColor(m.severity)}`}>
                    {m.severity}
                  </span>
                  <span className="text-sm font-semibold text-zinc-200">{m.title}</span>
                </div>
                <div className="space-y-1 text-xs">
                  <p><span className="text-zinc-500">영향:</span>{" "}<span className="text-zinc-400">{m.impact}</span></p>
                  <p><span className="text-zinc-500">현재 확인된 사실:</span>{" "}<span className="text-zinc-400">{m.knownFacts}</span></p>
                  {m.unknowns && (
                    <p><span className="text-zinc-500">아직 모르는 것:</span>{" "}<span className="text-zinc-400">{m.unknowns}</span></p>
                  )}
                  {m.nextAction && (
                    <div className="mt-1.5 rounded bg-zinc-800/60 px-3 py-1.5">
                      <span className="text-zinc-500">다음 행동: </span>
                      <span className="text-zinc-300">{m.nextAction}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* KBO Research Ready */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">KBO 분석 준비 상태</h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3">
          <div className="mb-3 flex items-center gap-2">
            <span className={`rounded-full border px-3 py-0.5 text-sm font-semibold ${
              op.kboReadiness.overallStatus === "READY" ? "bg-green-950/40 text-green-400 border-green-800" :
              op.kboReadiness.overallStatus === "PARTIAL_READY" || op.kboReadiness.overallStatus === "WAITING_FOR_LINEUP" || op.kboReadiness.overallStatus === "PARTIAL"
                ? "bg-amber-950/40 text-amber-400 border-amber-800" :
              op.kboReadiness.overallStatus === "BLOCKED" ? "bg-red-950/40 text-red-400 border-red-800" :
              "bg-zinc-800 text-zinc-500 border-zinc-700"
            }`}>
              {op.kboReadiness.overallStatus}
            </span>
            {op.kboReadiness.predictionLocked && (
              <span className="rounded-full border border-amber-800 bg-amber-950/40 px-2 py-0.5 text-xs text-amber-400">
                예측 입력 대기
              </span>
            )}
          </div>

          <div className="mb-3 text-xs text-zinc-400">
            Schedule: {op.kboReadiness.schedule}
          </div>

          {/* Betting Line Status */}
          <div className="mb-3">
            <p className="text-xs text-zinc-500 mb-1">Betting Line Status</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border border-zinc-700 px-3 py-2">
                <div className="text-xs text-zinc-500">국내 (Domestic)</div>
                <div className={`text-sm font-semibold ${
                  op.kboReadiness.domesticOdds.includes("MISSING") ? "text-red-400" : "text-zinc-200"
                }`}>
                  {op.kboReadiness.domesticOdds}
                </div>
              </div>
              <div className="rounded border border-zinc-700 px-3 py-2">
                <div className="text-xs text-zinc-500">해외 (Overseas)</div>
                <div className={`text-sm font-semibold ${
                  op.kboReadiness.overseasOdds.includes("MISSING") ? "text-zinc-400" : "text-zinc-200"
                }`}>
                  {op.kboReadiness.overseasOdds}
                </div>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 text-xs">
            {([
              ["Schedule", op.kboReadiness.schedule],
              ["국내 배당", op.kboReadiness.domesticOdds],
              ["해외 배당", op.kboReadiness.overseasOdds],
              ["선발", op.kboReadiness.starter],
              ["라인업", op.kboReadiness.lineup],
              ["불펜", op.kboReadiness.bullpen],
              ["T45", op.kboReadiness.t45],
              ["Prediction", op.kboReadiness.prediction],
              ["Review", op.kboReadiness.review],
            ] as [string, string][]).map(([label, val]) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${readinessDot(val)}`} />
                <span className="text-zinc-400">{label}</span>
                <span className="text-zinc-600 truncate">{val}</span>
              </div>
            ))}
          </div>

          {/* Prediction waiting reasons — amber, not red Reader Error */}
          {op.kboReadiness.predictionLocked && (
            <div className="mt-3 rounded border border-amber-800 bg-amber-950/30 px-3 py-2">
              <p className="text-xs text-amber-400 font-semibold mb-1">예측 입력 대기</p>
              {op.kboReadiness.lockReasons.map((r, i) => (
                <p key={i} className="text-xs text-amber-200/80">Reason: {r}</p>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bug Board */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">현재 이슈</h2>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {op.kboReadiness.bugBoard.map((bug) => (
            <div key={bug.id} className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <span className={`text-sm ${
                bug.severity === "RED" ? "text-red-400" :
                bug.severity === "YELLOW" ? "text-amber-400" :
                "text-green-400"
              }`}>
                {bug.severity === "RED" ? "●" : bug.severity === "YELLOW" ? "●" : "●"}
              </span>
              <span className={`text-xs ${bug.resolved ? "text-zinc-600" : "text-zinc-300"}`}>
                {bug.label}
              </span>
              {bug.resolved && <span className="text-xs text-green-600">완료</span>}
            </div>
          ))}
        </div>
      </section>

      {/* C-5: 오늘의 MLB 연구 결과 요약 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">오늘의 MLB 연구 결과 요약</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {([
            ["분석 경기", rs.totalGames],
            ["채점 완료", rs.gradedGames],
            ["HIT", rs.hits],
            ["MISS", rs.misses],
            ["연기", rs.postponedGames],
            ["PASS", rs.passGames],
            ["후보군", rs.candidateGames],
            ["리뷰 대기", rs.reviewPending],
          ] as [string, number | null][]).map(([label, val]) => (
            <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <div className="text-xs text-zinc-500">{label}</div>
              <div className="mt-0.5 text-lg font-semibold text-zinc-100">
                {val != null ? val : <span className="text-zinc-600">—</span>}
              </div>
            </div>
          ))}
        </div>
        {rs.accuracy != null && (
          <div className="mt-3 rounded border border-zinc-800 bg-zinc-900/40 px-4 py-2">
            <span className="text-sm text-zinc-300">적중률: {rs.accuracy}%</span>
            <p className="mt-0.5 text-xs text-zinc-600">
              단일 날짜 적중률만으로 Engine을 평가하지 않습니다.
            </p>
          </div>
        )}
      </section>

      {/* C-6: legacy system detail → Developer Console */}
      <section className="rounded-lg border border-zinc-700 bg-zinc-900/40 px-4 py-3 text-center">
        <p className="mb-2 text-[10px] uppercase tracking-wide text-zinc-600">
          deprecated · 운영 홈은 Dashboard로 이동
        </p>
        <a
          href={`/internal/developer?date=${dateKst}`}
          className="text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          Developer Console 보기 →
        </a>
        <span className="mx-2 text-zinc-600">·</span>
        <a
          href={`/internal/dashboard?date=${dateKst}`}
          className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
        >
          Dashboard →
        </a>
        <p className="mt-1 text-xs text-zinc-600">
          Pipeline별 기술 상태, Review Queue, 명령어, Artifact 정보
        </p>
      </section>
    </div>
  );
}
