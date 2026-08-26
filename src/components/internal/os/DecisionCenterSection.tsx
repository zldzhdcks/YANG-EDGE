import type { OperationMemoryV0 } from "@/lib/internal/operation-memory-v0";
import { StatusPill, levelSurface } from "./StatusPill";
import { AdvancedDisclosure } from "./OwnerMode";

/** Compact Decision Center for CTO Room (no extra top-nav item). */
export default function DecisionCenterSection({
  memory,
}: {
  memory: OperationMemoryV0;
}) {
  const approved = memory.recentDecisions.filter((d) => d.status === "APPROVED");
  const proposed = memory.aiProposals;
  const needs = memory.approvalRequests.filter(
    (a) => a.status === "NEEDS_OWNER_DECISION",
  );

  return (
    <section
      id="decision-center"
      className="space-y-4 rounded-xl border border-sky-900/40 bg-sky-950/10 px-5 py-4"
    >
      <div>
        <h2 className="text-lg font-semibold text-white">결정 기록</h2>
        <p className="mt-1 text-xs text-zinc-500">
          확인된 사실 · AI 제안 · 대표 승인 필요 · 이미 승인된 결정을 분리합니다. AI가 결정을
          내리지 않습니다.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-3">
          <h3 className="text-sm font-semibold text-emerald-300">이미 승인된 결정</h3>
          <ul className="mt-2 space-y-2 text-sm text-zinc-300">
            {approved.slice(0, 5).map((d) => (
              <li key={d.id}>
                <div className="font-medium text-zinc-100">{d.title}</div>
                <p className="text-xs text-zinc-500">{d.reason}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3">
          <h3 className="text-sm font-semibold text-amber-300">대표 승인 필요</h3>
          {needs.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">현재 승인 대기 없음</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm text-zinc-300">
              {needs.map((a) => (
                <li key={a.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-100">{a.title}</span>
                    <StatusPill level="WARNING" label={a.status} />
                  </div>
                  <p className="text-xs text-zinc-500">{a.plainLanguage}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={`rounded-lg border px-4 py-3 ${levelSurface("WARNING")}`}>
        <h3 className="text-sm font-semibold text-amber-200">AI 제안 (아직 결정 아님)</h3>
        <ul className="mt-2 space-y-2 text-sm text-zinc-300">
          {proposed.slice(0, 4).map((p) => (
            <li key={p.id}>
              <span className="font-medium text-zinc-100">{p.title}</span>
              <p className="text-xs text-zinc-500">{p.plainLanguage}</p>
            </li>
          ))}
        </ul>
      </div>

      <AdvancedDisclosure title="고급 정보 · 결정 출처">
        <ul className="space-y-1 font-mono text-[11px] text-zinc-500">
          {memory.recentDecisions.map((d) => (
            <li key={d.id}>
              {d.id} [{d.status}] ← {d.sourceRefs.join(", ")}
            </li>
          ))}
        </ul>
      </AdvancedDisclosure>
    </section>
  );
}
