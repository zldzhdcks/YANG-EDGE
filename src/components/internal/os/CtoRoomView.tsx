import type { YangEdgeOsPresentation } from "@/lib/internal/yang-edge-os-presenter";
import type { OperationMemoryV0 } from "@/lib/internal/operation-memory-v0";
import DecisionCenterSection from "./DecisionCenterSection";
import { StatusPill, levelSurface } from "./StatusPill";

export default function CtoRoomView({
  os,
  memory,
}: {
  os: YangEdgeOsPresentation;
  memory: OperationMemoryV0;
}) {
  const c = os.cto;

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        주간 운영 보고 · 숫자는 연구 관찰이며 공식 성과로 쓰지 않습니다.
      </p>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-1 text-lg font-semibold text-white">현재 목표</h2>
        <p className="text-sm font-medium text-zinc-100">{memory.currentGoal.title}</p>
        <p className="mt-1 text-xs text-zinc-400">{memory.currentGoal.description}</p>
        <div className="mt-2">
          <StatusPill
            level={
              memory.currentGoal.status === "BLOCKED"
                ? "BLOCKED"
                : memory.currentGoal.status === "ACTIVE"
                  ? "READY"
                  : "OFF"
            }
            label={memory.currentGoal.status}
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">이번 주 핵심 성과</h2>
        {memory.thisWeek.keyAchievements.length === 0 ? (
          <p className="text-sm text-zinc-500">DATA_NOT_AVAILABLE</p>
        ) : (
          <ul className="space-y-2 text-sm text-zinc-300">
            {memory.thisWeek.keyAchievements.map((a) => (
              <li key={a.id}>
                <span className="font-medium text-zinc-100">{a.title}</span>
                <p className="text-xs text-zinc-500">{a.plainLanguage}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
          <h2 className="mb-2 text-lg font-semibold text-white">이번 주 실패와 배운 점</h2>
          <ul className="space-y-2 text-sm text-zinc-300">
            {memory.thisWeek.keyFailures.map((f) => (
              <li key={f.id}>
                <span className="font-medium text-red-300">{f.title}</span>
                <p className="text-xs text-zinc-500">{f.plainLanguage}</p>
              </li>
            ))}
            {memory.thisWeek.lessons.map((l) => (
              <li key={l.id}>
                <span className="font-medium text-amber-200">{l.title}</span>
                <p className="text-xs text-zinc-500">{l.plainLanguage}</p>
              </li>
            ))}
            {memory.thisWeek.keyFailures.length === 0 &&
            memory.thisWeek.lessons.length === 0 ? (
              <li className="text-zinc-500">DATA_NOT_AVAILABLE</li>
            ) : null}
          </ul>
        </section>

        <section className={`rounded-xl border px-5 py-4 ${levelSurface("BLOCKED")}`}>
          <h2 className="mb-2 text-lg font-semibold text-white">현재 가장 큰 리스크</h2>
          {memory.currentRisks.length === 0 ? (
            <p className="text-sm text-zinc-500">표시할 리스크 없음</p>
          ) : (
            <ul className="space-y-2 text-sm text-zinc-300">
              {memory.currentRisks.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <div className="flex items-center gap-2">
                    <StatusPill level={r.level} label={r.level} />
                    <span className="font-medium text-white">{r.title}</span>
                  </div>
                  <p className="text-xs text-zinc-400">{r.plainLanguage}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 px-5 py-4">
        <h2 className="mb-1 text-lg font-semibold text-indigo-200">AI CTO 제안</h2>
        <p className="text-xs text-indigo-300/70">제안 ≠ 승인</p>
        <p className="mt-2 text-sm text-zinc-300">{os.aiBrief}</p>
        <ul className="mt-3 space-y-1 text-sm text-zinc-400">
          {memory.aiProposals.slice(0, 3).map((p) => (
            <li key={p.id}>• {p.title}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">Engine 변경 여부</h2>
        <p className="text-sm text-zinc-300">{memory.engineChangeNote}</p>
      </section>

      <DecisionCenterSection memory={memory} />

      <section className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["연구 관찰 · 표본", c.sampleGrowth],
            ["연구 관찰 · Accuracy", c.accuracy],
            ["연구 관찰 · Brier", c.brier],
            ["연구 관찰 · LogLoss", c.logLoss],
            ["Football 진행률", c.footballProgress],
          ] as [string, string][]
        ).map(([label, val]) => (
          <div
            key={label}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
          >
            <div className="text-xs text-zinc-500">{label}</div>
            <p className="mt-1 text-sm text-zinc-200">{val}</p>
          </div>
        ))}
      </section>

      <p className="text-xs text-zinc-600">{memory.thisWeek.researchObservationNote}</p>
    </div>
  );
}
