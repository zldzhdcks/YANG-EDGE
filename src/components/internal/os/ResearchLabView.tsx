import type { ResearchLabData } from "@/lib/internal/research-lab-reader";
import type { YangEdgeOsPresentation } from "@/lib/internal/yang-edge-os-presenter";
import MlbDailyResearchSummaryPanel from "@/components/internal/research/MlbDailyResearchSummaryPanel";
import NpbDailyOpsPanel from "@/components/internal/research/NpbDailyOpsPanel";
import NpbPregameEvidencePanel from "@/components/internal/research/NpbPregameEvidencePanel";
import NpbOfficialResultPanel from "@/components/internal/research/NpbOfficialResultPanel";
import { StatusPill, levelSurface } from "./StatusPill";
import { AdvancedDisclosure } from "./OwnerMode";

type Props = {
  data: ResearchLabData;
  os: YangEdgeOsPresentation;
  dateKst: string;
};

/** Research-only surface: Pipeline, Coverage, Dataset, Review, Prediction, Analysis */
export default function ResearchLabView({ data, os, dateKst }: Props) {
  const showMlbSummary =
    data.mlbDailyResearchSummary.kind === "ok" ||
    data.mlbDailyResearchSummary.kind === "pipeline_failed";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-900/40 bg-gradient-to-r from-amber-950/40 to-zinc-900/80 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400/90">
              YANG EDGE
            </p>
            <h2 className="text-xl font-bold text-white">Daily Picks</h2>
            <p className="mt-1 text-sm text-zinc-400">
              오늘 아침 추천 · Strong / Good / PASS · 30초 브리핑
            </p>
          </div>
          <a
            href={`/internal/daily?date=${encodeURIComponent(dateKst)}`}
            className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
          >
            Daily Picks 열기 →
          </a>
        </div>
      </section>

      <section className="rounded-xl border border-sky-900/40 bg-sky-950/20 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-400/90">
              NPB · MANUAL VERIFIED
            </p>
            <h2 className="text-lg font-bold text-white">NPB Starter Input</h2>
            <p className="mt-1 text-sm text-zinc-400">
              예고 선발 수동 확인 · Provider처럼 보이지 않음 · 원문 보존
            </p>
          </div>
          <a
            href={`/internal/research/npb/starter?date=${encodeURIComponent(dateKst)}`}
            className="rounded-lg border border-sky-700 bg-sky-900/40 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-800/50"
          >
            Starter 입력 →
          </a>
        </div>
      </section>

      <section className="rounded-xl border border-violet-900/40 bg-violet-950/20 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/90">
              NPB · MONEYLINE · MANUAL VERIFIED
            </p>
            <h2 className="text-lg font-bold text-white">NPB Market Odds Input</h2>
            <p className="mt-1 text-sm text-zinc-400">
              승패(Moneyline)만 · Provider Odds와 별도 보존 · Market ≠ Model
            </p>
          </div>
          <a
            href={`/internal/research/npb/odds?date=${encodeURIComponent(dateKst)}`}
            className="rounded-lg border border-violet-700 bg-violet-900/40 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-800/50"
          >
            Odds 입력 →
          </a>
        </div>
      </section>

      <section className="rounded-xl border border-sky-900/40 bg-sky-950/20 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/90">
              MLB · LINEUP REFRESH · NORMAL PATH
            </p>
            <h2 className="text-lg font-bold text-white">
              MLB Lineup Auto Refresh
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Provider snapshots · per-game cutoff · 수동 붙여넣기 불필요
            </p>
          </div>
          <a
            href={`/internal/research/mlb/lineup-refresh?date=${encodeURIComponent(dateKst)}`}
            className="rounded-lg border border-sky-700 bg-sky-900/40 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-800/50"
          >
            Lineup Refresh →
          </a>
        </div>
      </section>

      <section className="rounded-xl border border-teal-900/40 bg-teal-950/20 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300/90">
              MLB · EXPECTED LINEUP · FALLBACK / EXCEPTION
            </p>
            <h2 className="text-lg font-bold text-white">
              MLB Expected Lineup Observation
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              예외 도구 · 확정 아님 · 정상 운영은 Lineup Auto Refresh
            </p>
          </div>
          <a
            href={`/internal/research/mlb/expected-lineup?date=${encodeURIComponent(dateKst)}`}
            className="rounded-lg border border-teal-700 bg-teal-900/40 px-4 py-2 text-sm font-semibold text-teal-100 hover:bg-teal-800/50"
          >
            Expected Lineup →
          </a>
        </div>
      </section>

      <section className="rounded-xl border border-rose-900/40 bg-rose-950/20 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300/90">
              MLB · KOREAN MARKET · MONEYLINE
            </p>
            <h2 className="text-lg font-bold text-white">
              MLB Korean Market Odds
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              한국 시장 기본 승패 · Provider Odds와 별도 · Prediction 불변
            </p>
          </div>
          <a
            href={`/internal/research/mlb/korean-odds?date=${encodeURIComponent(dateKst)}`}
            className="rounded-lg border border-rose-700 bg-rose-900/40 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-800/50"
          >
            Korean Odds →
          </a>
        </div>
      </section>

      <NpbDailyOpsPanel dateKst={dateKst} />

      <NpbPregameEvidencePanel dateKst={dateKst} />

      <NpbOfficialResultPanel dateKst={dateKst} />

      <p className="text-sm text-zinc-500">
        Research Lab은 연구만 담당합니다. Hash·Artifact·Runtime은{" "}
        <a href={`/internal/developer?date=${dateKst}`} className="text-sky-400 hover:underline">
          Developer Console
        </a>
        로 이동했습니다.
      </p>

      <section className={`rounded-xl border px-5 py-4 ${levelSurface(os.overallLevel)}`}>
        <h2 className="mb-2 text-lg font-semibold text-white">Prediction</h2>
        <p className="text-sm text-zinc-300">{os.researchFocus.predictionNote}</p>
        <p className="mt-2 text-xs text-zinc-500">
          YES/NO는 운영 판단용 요약이며, 공식 성적에 자동 반영하지 않습니다.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Pipeline</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {os.researchFocus.pipelines.map((p) => (
            <div
              key={p.name}
              className={`rounded-lg border px-3 py-3 ${levelSurface(p.level)}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">{p.name}</span>
                <StatusPill level={p.level} label={p.status} />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-300">{p.plain}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">Coverage</h2>
        <p className="text-sm text-zinc-300">{os.researchFocus.coverageNote}</p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">Dataset</h2>
        <ul className="space-y-2 text-sm text-zinc-300">
          {os.dataCenter
            .filter((s) => s.sport === "MLB" || s.sport === "KBO")
            .map((s) => (
              <li key={s.sport}>
                <span className="font-medium text-white">{s.sport}</span> — {s.dataset}
              </li>
            ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">Review</h2>
        <p className="text-sm text-zinc-300">
          대기 중 리뷰:{" "}
          {os.researchFocus.reviewPending != null
            ? `${os.researchFocus.reviewPending}건`
            : "정보 없음"}
        </p>
        <p className="mt-3 text-sm">
          <a
            href={`/internal/research/mlb?date=${encodeURIComponent(dateKst)}`}
            className="font-medium text-sky-400 hover:underline"
          >
            MLB Research UX →
          </a>
          <span className="ml-2 text-xs text-zinc-500">
            Card viewer · Daily dashboard · AI commentary
          </span>
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="mb-2 text-lg font-semibold text-white">Analysis</h2>
        <p className="text-sm text-zinc-400">
          경기별 분석은 공개 Analysis 뷰어와 Review Detail artifact를 사용합니다.
        </p>
        {showMlbSummary ? (
          <div className="mt-3">
            <MlbDailyResearchSummaryPanel
              load={data.mlbDailyResearchSummary}
              dateKst={dateKst}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-600">
            이 날짜의 MLB Daily Research Summary는 아직 없습니다.
          </p>
        )}
      </section>

      <AdvancedDisclosure title="고급 정보 (경로·기술 상태)">
        <ul className="space-y-1 font-mono text-[11px] text-zinc-500">
          {data.pipelines.map((p) => (
            <li key={p.pipelineName}>
              {p.pipelineName}: {p.status}
              {p.sourceArtifact ? ` · ${p.sourceArtifact}` : ""}
            </li>
          ))}
        </ul>
      </AdvancedDisclosure>

      <section className="rounded-lg border border-dashed border-zinc-700 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Deprecated
        </h3>
        <ul className="mt-2 space-y-1 text-xs text-zinc-500">
          {os.deprecated.map((d) => (
            <li key={d.id}>
              {d.label} — {d.reason}
              {d.movedTo ? (
                <>
                  {" "}
                  →{" "}
                  <a href={`${d.movedTo}?date=${dateKst}`} className="text-sky-500 hover:underline">
                    {d.movedTo}
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
