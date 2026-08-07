import type { YangEdgeOsPresentation } from "@/lib/internal/yang-edge-os-presenter";
import { StatusPill, levelSurface } from "./StatusPill";

export default function DataCenterView({ os }: { os: YangEdgeOsPresentation }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        종목별 데이터 누적 현황 · 엔진/가중치는 여기서 바꾸지 않습니다.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {os.dataCenter.map((s) => (
          <article
            key={s.sport}
            className={`rounded-xl border px-4 py-4 ${levelSurface(s.level)}`}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-white">{s.sport}</h2>
              <StatusPill level={s.level} label={s.coverageLabel} />
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-zinc-500">경기 수</dt>
                <dd className="text-zinc-200">{s.games ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Dataset</dt>
                <dd className="mt-0.5 text-zinc-300">{s.dataset}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Prediction</dt>
                <dd className="mt-0.5 text-zinc-300">{s.prediction}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Review</dt>
                <dd className="mt-0.5 text-zinc-300">{s.review}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">누적 표본</dt>
                <dd className="mt-0.5 text-zinc-300">{s.sampleNote}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
