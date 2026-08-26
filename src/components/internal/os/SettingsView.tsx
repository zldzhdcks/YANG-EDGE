import { OwnerModeControls } from "./OwnerMode";
import type { YangEdgeOsPresentation } from "@/lib/internal/yang-edge-os-presenter";

export default function SettingsView({
  os,
  dateKst,
}: {
  os: YangEdgeOsPresentation;
  dateKst: string;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">대표 모드</h2>
        <p className="mb-3 text-sm text-zinc-400">
          켜 두면 Hash, Artifact, Runtime, Provider, Quota, Raw Data를 기본 화면에서
          숨깁니다. 필요할 때만 &quot;고급 정보&quot;로 봅니다.
        </p>
        <OwnerModeControls />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">날짜</h2>
        <p className="text-sm text-zinc-300">현재 보고 있는 날짜: {dateKst} (한국시간)</p>
        <p className="mt-1 text-xs text-zinc-500">
          URL의 <code className="text-zinc-400">?date=YYYY-MM-DD</code> 로 변경합니다.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">Deprecated 안내</h2>
        <ul className="space-y-2 text-sm text-zinc-400">
          {os.deprecated.map((d) => (
            <li key={d.id}>
              <span className="text-zinc-200">{d.label}</span> — {d.reason}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">보호 영역</h2>
        <p className="text-sm text-zinc-400">
          Prediction Engine, Dataset, Research/Review/Scorecard Logic, Artifact Schema,
          Hash, Pipeline, Provider, Weight는 이 OS 화면에서 변경하지 않습니다.
        </p>
      </section>
    </div>
  );
}
