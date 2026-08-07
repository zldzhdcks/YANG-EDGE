import type { YangEdgeOsPresentation } from "@/lib/internal/yang-edge-os-presenter";
import { StatusPill, levelSurface } from "./StatusPill";

export default function EngineCenterView({ os }: { os: YangEdgeOsPresentation }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        엔진 변수 상태만 표시합니다. Weight 수정은 제공하지 않습니다.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {os.engines.map((e) => (
          <article
            key={e.id}
            className={`rounded-xl border px-4 py-4 ${levelSurface(e.level)}`}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-white">{e.name}</h2>
              <StatusPill level={e.level} label={e.status} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              {e.plainLanguage}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
