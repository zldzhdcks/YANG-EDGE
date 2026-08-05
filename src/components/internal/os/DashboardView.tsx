import type { YangEdgeOsPresentation } from "@/lib/internal/yang-edge-os-presenter";
import type { OperationMemoryV0 } from "@/lib/internal/operation-memory-v0";
import type { ReleaseChecklistView } from "@/lib/internal/release-checklist-v0";
import ReleaseStatusCard from "./ReleaseStatusCard";
import { StatusPill, levelSurface } from "./StatusPill";

export default function DashboardView({
  os,
  memory,
  release,
}: {
  os: YangEdgeOsPresentation;
  memory: OperationMemoryV0;
  release: ReleaseChecklistView;
}) {
  const ds = memory.dashboardSummary;
  const fb = memory.footballIdentity;
  const odds = memory.footballOdds;
  const result = memory.footballResult;
  const review = memory.footballReviewScorecard;

  return (
    <div className="space-y-6">
      <ReleaseStatusCard release={release} />

      <section className={`rounded-xl border px-5 py-4 ${levelSurface(os.overallLevel)}`}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-white">오늘 운영 상태</h2>
          <StatusPill level={os.overallLevel} label={os.overallLabel} />
        </div>
        <p className="mt-2 text-sm text-zinc-300">{os.canPredictReason}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {os.leagueStatuses.map((l) => (
            <div
              key={l.league}
              className={`rounded-lg border px-3 py-3 ${levelSurface(l.level)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white">{l.league}</span>
                <StatusPill level={l.level} label={l.label} />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{l.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">Football</h2>
          <StatusPill level={review.gateStatus} label={review.reviewStage} />
        </div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Identity</dt>
            <dd className="text-zinc-200">{fb.stage}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">1X2 Odds</dt>
            <dd className="text-zinc-200">{odds.oddsStage}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Result</dt>
            <dd className="text-zinc-200">{result.resultStage}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Review Foundation</dt>
            <dd className="text-zinc-200">{review.reviewStage}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Scorecard Foundation</dt>
            <dd className="text-zinc-200">{review.scorecardStage}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Prediction</dt>
            <dd className="text-zinc-200">{review.prediction}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-zinc-300">{review.plainLanguage}</p>
        <p className="mt-1 text-xs text-zinc-500">진행률 % 없음 · Research≠Official</p>
      </section>

      {/* Operation Memory — today recall */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">오늘 기억</h2>
          <a
            href={`/internal/cto?date=${memory.dateKst}#decision-center`}
            className="text-xs text-sky-400 hover:underline"
          >
            Decision Center 자세히 →
          </a>
        </div>
        <p className="mt-1 text-sm text-zinc-400">{ds.goalOneLiner}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-3 py-1 text-emerald-300">
            완료 {ds.completedCount}건
          </span>
          <span className="rounded-full border border-amber-800 bg-amber-950/40 px-3 py-1 text-amber-300">
            대기 {ds.pendingCount}건
          </span>
          <span className="rounded-full border border-red-800 bg-red-950/40 px-3 py-1 text-red-300">
            차단 {ds.blockedCount}건
          </span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
          <h2 className="mb-2 text-lg font-semibold text-white">대표 승인 필요</h2>
          {ds.approvalTop.length === 0 ? (
            <p className="text-sm text-zinc-500">현재 승인 대기 없음</p>
          ) : (
            <ul className="space-y-2 text-sm text-zinc-300">
              {ds.approvalTop.map((a) => (
                <li key={a.id} className="rounded border border-zinc-800 px-3 py-2">
                  <div className="font-medium text-zinc-100">{a.title}</div>
                  <p className="text-xs text-zinc-500">{a.plainLanguage}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
          <h2 className="mb-2 text-lg font-semibold text-white">최근 결정</h2>
          <ul className="space-y-2 text-sm text-zinc-300">
            {ds.decisionTop.map((d) => (
              <li key={d.id} className="rounded border border-zinc-800 px-3 py-2">
                <div className="flex items-center gap-2">
                  <StatusPill level="READY" label="APPROVED" />
                  <span className="font-medium text-zinc-100">{d.title}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{d.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-3 text-lg font-semibold text-white">오늘 해야 하는 일</h2>
        <ul className="space-y-2">
          {os.checklist.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2"
            >
              <span className="mt-0.5 text-base" aria-hidden>
                {item.done ? "☑" : "☐"}
              </span>
              <div className="min-w-0 flex-1">
                {item.href ? (
                  <a href={item.href} className="font-medium text-zinc-100 hover:underline">
                    {item.title}
                  </a>
                ) : (
                  <span className="font-medium text-zinc-400">{item.title}</span>
                )}
                <div className="mt-1">
                  <StatusPill
                    level={item.level}
                    label={item.done ? "DONE" : item.level}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
          <h2 className="mb-2 text-lg font-semibold text-white">오늘 진행률</h2>
          <p className="text-3xl font-bold text-white">
            {os.progressPercent != null ? `${os.progressPercent}%` : "—"}
          </p>
          <p className="mt-1 text-sm text-zinc-400">{os.progressLabel}</p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
          <h2 className="mb-2 text-lg font-semibold text-white">오늘 위험</h2>
          {memory.currentRisks.length === 0 && os.risks.length === 0 ? (
            <p className="text-sm text-zinc-500">표시할 위험이 없습니다.</p>
          ) : memory.currentRisks.length > 0 ? (
            <ul className="space-y-2">
              {memory.currentRisks.slice(0, 4).map((r) => (
                <li
                  key={r.id}
                  className={`rounded-lg border px-3 py-2 ${levelSurface(r.level)}`}
                >
                  <div className="flex items-center gap-2">
                    <StatusPill level={r.level} label={r.level} />
                    <span className="text-sm font-medium text-zinc-100">{r.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{r.plainLanguage}</p>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-2">
              {os.risks.slice(0, 4).map((r) => (
                <li
                  key={r.id}
                  className={`rounded-lg border px-3 py-2 ${levelSurface(r.level)}`}
                >
                  <div className="flex items-center gap-2">
                    <StatusPill level={r.level} label={r.level} />
                    <span className="text-sm font-medium text-zinc-100">{r.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{r.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-indigo-200">AI CTO 브리핑</h2>
        <p className="text-xs text-indigo-300/70">AI 해석 · 아직 결정이 아닙니다</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{os.aiBrief}</p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">이번 주 요약</h2>
        <ul className="space-y-1 text-sm text-zinc-300">
          {os.weekSummaryLines.map((line, i) => (
            <li key={i}>• {line}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-zinc-600">
          {memory.thisWeek.researchObservationNote}
        </p>
      </section>
    </div>
  );
}
