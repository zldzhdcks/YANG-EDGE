import type { YangEdgeOsPresentation } from "@/lib/internal/yang-edge-os-presenter";
import type { OperationMemoryV0 } from "@/lib/internal/operation-memory-v0";
import { StatusPill, levelSurface } from "./StatusPill";

export default function MissionControlView({
  os,
  memory,
}: {
  os: YangEdgeOsPresentation;
  memory: OperationMemoryV0;
}) {
  const sorted = [...os.missions].sort((a, b) => {
    const rank = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    return rank[a.priority] - rank[b.priority];
  });
  const blocked = [
    ...memory.today.blocked,
    ...sorted.filter((m) => m.risk === "BLOCKED"),
  ];
  const next = sorted.find((m) => m.risk !== "BLOCKED") ?? sorted[0];
  const approvals = memory.approvalRequests.filter(
    (a) => a.status === "NEEDS_OWNER_DECISION",
  );

  return (
    <div className="space-y-6">
      {blocked.length > 0 ? (
        <section className={`rounded-xl border px-5 py-4 ${levelSurface("BLOCKED")}`}>
          <h2 className="mb-2 text-lg font-semibold text-white">현재 운영 차단</h2>
          <ul className="space-y-2">
            {memory.today.blocked.map((m) => (
              <li key={m.id} className="text-sm text-zinc-300">
                <span className="font-medium text-white">{m.title}</span>
                <p className="text-xs text-zinc-400">{m.plainLanguage}</p>
              </li>
            ))}
            {sorted
              .filter((m) => m.risk === "BLOCKED")
              .map((m) => (
                <li key={`mission-${m.id}`} className="text-sm text-zinc-300">
                  <span className="font-medium text-white">{m.title}</span>
                  {m.blockedReason ? ` — ${m.blockedReason}` : ""}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">오늘 반드시 해야 하는 일</h2>
        {memory.today.pending.length === 0 && sorted.length === 0 ? (
          <p className="text-sm text-zinc-500">표시할 필수 작업이 없습니다.</p>
        ) : (
          <ul className="space-y-2 text-sm text-zinc-300">
            {memory.today.pending.slice(0, 6).map((p) => (
              <li key={p.id} className="rounded border border-zinc-800 px-3 py-2">
                <span className="font-medium text-zinc-100">{p.title}</span>
                <p className="text-xs text-zinc-500">{p.plainLanguage}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-amber-900/40 bg-amber-950/15 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-amber-200">대표 승인 필요</h2>
        <p className="mb-2 text-xs text-amber-300/70">AI 제안 ≠ 승인된 결정</p>
        {approvals.length === 0 ? (
          <p className="text-sm text-zinc-500">현재 승인 대기 없음</p>
        ) : (
          <ul className="space-y-2 text-sm text-zinc-300">
            {approvals.map((a) => (
              <li key={a.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-white">{a.title}</span>
                  <StatusPill level="WARNING" label={a.status} />
                </div>
                <p className="text-xs text-zinc-500">{a.plainLanguage}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">AI 추천</h2>
        <p className="text-xs text-zinc-500">해석·제안 · 자동 결정 아님</p>
        <p className="mt-2 text-sm text-zinc-300">{os.aiBrief}</p>
        {next ? (
          <p className="mt-3 text-sm text-zinc-400">
            다음 작업:{" "}
            <span className="font-medium text-zinc-100">{next.title}</span>
            {" · "}약 {next.estimatedMinutes}분
          </p>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">오늘 남은 미션이 없습니다.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">미션 목록</h2>
        <div className="space-y-3">
          {sorted.length === 0 ? (
            <p className="text-sm text-zinc-500">표시할 미션이 없습니다.</p>
          ) : (
            sorted.map((m) => (
              <article
                key={m.id}
                className={`rounded-xl border px-4 py-3 ${levelSurface(m.risk)}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-white">{m.title}</h3>
                  <StatusPill level={m.risk} label={m.priority} />
                  <span className="text-xs text-zinc-500">약 {m.estimatedMinutes}분</span>
                </div>
                <p className="mt-2 text-sm text-zinc-300">
                  <span className="text-zinc-500">다음:</span> {m.nextStep}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{m.aiTip}</p>
                {m.href ? (
                  <a
                    href={m.href}
                    className="mt-2 inline-block text-xs text-sky-400 hover:underline"
                  >
                    작업 화면으로 이동
                  </a>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
