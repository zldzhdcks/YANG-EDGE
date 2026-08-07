"use client";

import { useState } from "react";
import type {
  FactorRow,
  MlbGameDetailView,
  QualityCheck,
} from "@/lib/mlb/game-detail-ux-v1";

function toneClass(tone: string): string {
  switch (tone) {
    case "ADVANTAGE":
      return "border-emerald-800/50 bg-emerald-950/20 text-emerald-200";
    case "DISADVANTAGE":
      return "border-red-800/50 bg-red-950/20 text-red-200";
    case "HOLD":
      return "border-amber-800/50 bg-amber-950/20 text-amber-200";
    case "RESEARCH_NOT_CONNECTED":
      return "border-violet-800/50 bg-violet-950/20 text-violet-200";
    case "NEUTRAL":
      return "border-zinc-700 bg-zinc-900/40 text-zinc-300";
    default:
      return "border-zinc-800 bg-zinc-950/40 text-zinc-400";
  }
}

function FactorAccordion({ row }: { row: FactorRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass(row.tone)}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-white">{row.label}</span>
        <span className="text-xs font-medium">{row.toneLabel}</span>
      </button>
      <p className="mt-1 text-sm text-zinc-300">{row.summary}</p>
      {open && row.detailLines.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-zinc-800/60 pt-2 text-xs text-zinc-400">
          {row.detailLines.map((l) => (
            <li key={l}>• {l}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-1 text-[11px] text-zinc-600">
        {open ? "접기 ▲" : "세부 펼치기 ▼"}
      </p>
    </div>
  );
}

function QualityIcon({ state }: { state: QualityCheck["state"] }) {
  if (state === "ok") return <span aria-hidden>✅</span>;
  if (state === "warn") return <span aria-hidden>⚠</span>;
  return <span aria-hidden>❌</span>;
}

export default function MlbGameDetailView({
  view,
  backHref,
}: {
  view: MlbGameDetailView;
  backHref: string;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const h = view.headline;

  return (
    <div className="space-y-6">
      <a href={backHref} className="text-sm text-sky-400 hover:underline">
        ← MLB Research UX
      </a>

      {!view.loaded ? (
        <section className="rounded-xl border border-amber-900/40 bg-amber-950/20 px-5 py-4">
          <h1 className="text-lg font-semibold text-amber-100">경기를 표시할 수 없습니다</h1>
          <p className="mt-2 text-sm text-amber-100/80">{view.error}</p>
          <p className="mt-2 text-xs text-zinc-500">gamePk={view.gamePk}</p>
        </section>
      ) : null}

      {/* 1. Headline */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-5">
        <p className="text-xs uppercase tracking-wide text-zinc-500">경기 결론</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">
          {h.awayTeam} @ {h.homeTeam}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {h.matchupLine}
          {h.startTimeKst ? ` · ${h.startTimeKst} KST` : ""}
          {` · ${h.gameStatus}`}
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs text-zinc-500">연구 예측 방향</dt>
            <dd className="mt-0.5 text-base font-semibold text-sky-200">
              {h.researchPredictionTeam ?? "—"}
              {h.researchPredictionSide ? ` (${h.researchPredictionSide})` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">모델 확률</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-white">
              {h.modelProbabilityPercent != null
                ? `${h.modelProbabilityPercent}%`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">시장 확률</dt>
            <dd className="mt-0.5 text-base font-semibold tabular-nums text-white">
              {h.marketProbabilityPercent != null
                ? `${h.marketProbabilityPercent}%`
                : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-xs text-zinc-500">공식 상태</dt>
            <dd className="mt-0.5">
              <span className="inline-flex rounded-full border border-amber-800/60 bg-amber-950/30 px-2.5 py-0.5 text-xs font-semibold text-amber-200">
                {h.officialStatus}
              </span>
              <span className="ml-2 text-sm text-zinc-400">
                {h.officialStatusPlain}
              </span>
            </dd>
          </div>
        </dl>

        <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-3 text-sm leading-relaxed text-zinc-200">
          {h.oneLiner}
        </p>
      </section>

      {/* 2. Model vs Market */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="text-lg font-semibold text-white">모델 대 시장</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-2 pr-3">Side</th>
                <th className="py-2 pr-3">Model</th>
                <th className="py-2 pr-3">Market</th>
                <th className="py-2">Difference</th>
              </tr>
            </thead>
            <tbody>
              {view.modelVsMarket.rows.map((r) => (
                <tr key={r.side} className="border-t border-zinc-800 text-zinc-200">
                  <td className="py-2 pr-3 font-medium">
                    {r.side} · {r.team}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {r.modelProbability != null ? `${r.modelProbability}%` : "—"}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {r.marketProbability != null
                      ? `${r.marketProbability}%`
                      : "—"}
                  </td>
                  <td className="py-2 tabular-nums">
                    {r.difference != null
                      ? `${r.difference > 0 ? "+" : ""}${r.difference}pp`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
          {view.modelVsMarket.narrative}
        </p>
        {view.modelVsMarket.edgeScore != null ? (
          <p className="mt-2 text-xs text-zinc-500">
            edgeScore (unchanged meaning): {view.modelVsMarket.edgeScore}
          </p>
        ) : null}
      </section>

      {/* MARKET — Model / Provider / Korean separated */}
      <section className="rounded-xl border border-rose-900/40 bg-rose-950/15 px-5 py-4">
        <h2 className="text-lg font-semibold text-white">MARKET</h2>
        <p className="mt-1 text-xs text-zinc-500">
          출처 분리 · Market ≠ Model · 없는 값은 NOT AVAILABLE (추측 금지)
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">
              MODEL
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              {view.marketPanels.model.sourceLabel}
            </p>
            {view.marketPanels.model.available ? (
              <ul className="mt-2 space-y-1 text-sm text-zinc-200">
                <li>
                  {view.marketPanels.model.awayTeam}:{" "}
                  {view.marketPanels.model.awayModelProbability != null
                    ? `${view.marketPanels.model.awayModelProbability}%`
                    : "NOT AVAILABLE"}
                </li>
                <li>
                  {view.marketPanels.model.homeTeam}:{" "}
                  {view.marketPanels.model.homeModelProbability != null
                    ? `${view.marketPanels.model.homeModelProbability}%`
                    : "NOT AVAILABLE"}
                </li>
              </ul>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">NOT AVAILABLE</p>
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300">
              PROVIDER MARKET
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              {view.marketPanels.provider.sourceLabel}
            </p>
            {view.marketPanels.provider.available ? (
              <ul className="mt-2 space-y-1 text-sm text-zinc-200">
                <li>
                  {view.marketPanels.provider.awayTeam}:{" "}
                  {view.marketPanels.provider.awayOdds ?? "NOT AVAILABLE"}
                </li>
                <li>
                  {view.marketPanels.provider.homeTeam}:{" "}
                  {view.marketPanels.provider.homeOdds ?? "NOT AVAILABLE"}
                </li>
              </ul>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">NOT AVAILABLE</p>
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-300">
              KOREAN MARKET
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              {view.marketPanels.korean.sourceLabel}
              {view.marketPanels.korean.observationStatus
                ? ` · ${view.marketPanels.korean.observationStatus}`
                : ""}
            </p>
            {view.marketPanels.korean.available ? (
              <ul className="mt-2 space-y-1 text-sm text-zinc-200">
                <li>
                  {view.marketPanels.korean.awayTeam}:{" "}
                  {view.marketPanels.korean.awayOdds ?? "NOT AVAILABLE"}
                </li>
                <li>
                  {view.marketPanels.korean.homeTeam}:{" "}
                  {view.marketPanels.korean.homeOdds ?? "NOT AVAILABLE"}
                </li>
              </ul>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">NOT AVAILABLE</p>
            )}
          </div>
        </div>
      </section>

      {/* 3. Factors */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="text-lg font-semibold text-white">핵심 승부 근거</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Artifact 근거만 표시 · 없으면 NOT_AVAILABLE / RESEARCH_NOT_CONNECTED
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {view.factors.map((f) => (
            <FactorAccordion key={f.id} row={f} />
          ))}
        </div>
      </section>

      {/* LINEUP — Expected Observation */}
      <section className="rounded-xl border border-teal-900/40 bg-teal-950/15 px-5 py-4">
        <h2 className="text-lg font-semibold text-white">LINEUP</h2>
        <p className="mt-1 text-sm font-medium text-amber-200">
          {view.expectedLineup?.disclaimer ?? "예상 라인업 — 확정 아님"}
        </p>
        <div className="mt-2 space-y-1 text-xs text-zinc-400">
          <p>
            {view.expectedLineup?.providerLineupStatus ??
              "Provider Lineup: NOT RELEASED"}
          </p>
          <p>
            {view.expectedLineup?.operatorObservationStatus ??
              "Operator Observation: NOT AVAILABLE"}
          </p>
        </div>
        {view.expectedLineup?.available ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-teal-100">
                Expected Lineup · 원정 ({view.expectedLineup.awayTeam})
              </h3>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                [Observed before game]
                {view.expectedLineup.cutoffLabel
                  ? ` · ${view.expectedLineup.cutoffLabel}`
                  : ""}
              </p>
              <ol className="mt-2 space-y-1 text-sm text-zinc-200">
                {view.expectedLineup.awayLineup.map((b) => (
                  <li key={`a-${b.battingOrder}`}>
                    {b.battingOrder}. {b.displayName}
                    {b.position ? ` · ${b.position}` : ""}
                    {b.bats ? ` · ${b.bats}` : ""}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-teal-100">
                Expected Lineup · 홈 ({view.expectedLineup.homeTeam})
              </h3>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                [Observed before game]
              </p>
              <ol className="mt-2 space-y-1 text-sm text-zinc-200">
                {view.expectedLineup.homeLineup.map((b) => (
                  <li key={`h-${b.battingOrder}`}>
                    {b.battingOrder}. {b.displayName}
                    {b.position ? ` · ${b.position}` : ""}
                    {b.bats ? ` · ${b.bats}` : ""}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            Expected Lineup observation이 아직 없습니다.
          </p>
        )}
      </section>

      {/* 4. Data quality */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-4">
        <h2 className="text-lg font-semibold text-white">데이터 품질</h2>
        <p className="mt-2 text-sm font-medium text-amber-200">
          {view.dataQuality.overall} — {view.dataQuality.overallPlain}
        </p>
        <ul className="mt-3 space-y-2 text-sm text-zinc-300">
          {view.dataQuality.checks.map((c) => (
            <li key={c.id} className="flex gap-2">
              <QualityIcon state={c.state} />
              <span>
                <span className="font-medium text-zinc-100">{c.label}:</span>{" "}
                {c.plain}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 5. Postgame */}
      {view.postgame ? (
        <section className="rounded-xl border border-indigo-900/40 bg-indigo-950/15 px-5 py-4">
          <h2 className="text-lg font-semibold text-indigo-100">
            경기 종료 후 복기
          </h2>
          <p className="mt-1 text-xs text-indigo-300/70">
            Failure/Success Category는 확정 원인이 아니라 복기 후보입니다
            {view.postgame.observationOnly ? " · observationOnly" : ""}
          </p>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">최종 점수</dt>
              <dd className="text-sm font-semibold text-white">
                {view.postgame.scoreLine}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">실제 승자</dt>
              <dd className="text-sm font-semibold text-white">
                {view.postgame.actualWinnerTeam ?? "—"}
                {view.postgame.actualWinnerSide
                  ? ` (${view.postgame.actualWinnerSide})`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Research Grade</dt>
              <dd className="text-sm font-semibold text-white">
                {view.postgame.researchGrade}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Brier / LogLoss</dt>
              <dd className="text-sm tabular-nums text-zinc-200">
                {view.postgame.brierScore != null
                  ? view.postgame.brierScore.toFixed(4)
                  : "—"}{" "}
                /{" "}
                {view.postgame.logLoss != null
                  ? view.postgame.logLoss.toFixed(4)
                  : "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-zinc-200">
              주요 복기 후보
            </h3>
            {view.postgame.primaryCandidates.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-500">없음</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {view.postgame.primaryCandidates.map((c) => (
                  <li
                    key={c.code}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm"
                  >
                    <div className="font-medium text-amber-200">
                      🥇 {c.label}{" "}
                      <span className="text-xs font-normal text-zinc-500">
                        (복기 후보)
                      </span>
                    </div>
                    <p className="mt-1 text-zinc-300">{c.plain}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4">
            <h3 className="text-sm font-semibold text-zinc-200">
              보조 복기 후보
            </h3>
            {view.postgame.secondaryCandidates.length === 0 ? (
              <p className="mt-1 text-sm text-zinc-500">없음</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {view.postgame.secondaryCandidates.map((c) => (
                  <li
                    key={c.code}
                    className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300"
                  >
                    <div className="font-medium text-zinc-100">
                      • {c.label}{" "}
                      <span className="text-xs text-zinc-500">(복기 후보)</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">{c.plain}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-3">
            <p className="text-xs text-zinc-500">한 줄 Review Summary</p>
            <p className="mt-1 text-sm text-zinc-200">
              {view.postgame.reviewSummary}
            </p>
            <p className="mt-2 text-sm text-indigo-200">
              {view.postgame.reviewConclusion}
            </p>
          </div>
        </section>
      ) : view.loaded ? (
        <section className="rounded-xl border border-zinc-800 px-5 py-4 text-sm text-zinc-500">
          경기 종료 후 복기 Artifact가 아직 없습니다 (또는 미채점).
        </section>
      ) : null}

      {/* 6. Advanced */}
      <section className="rounded-xl border border-dashed border-zinc-700 px-5 py-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-semibold text-zinc-300"
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          고급 기술 정보
          <span className="text-xs text-zinc-500">
            {advancedOpen ? "접기" : "펼치기"}
          </span>
        </button>
        {advancedOpen ? (
          <div className="mt-3 space-y-2 font-mono text-[11px] text-zinc-500">
            <p>gamePk: {view.advanced.gamePk}</p>
            <p>gameId: {view.advanced.gameId ?? "—"}</p>
            <p className="break-all">
              predictionHash: {view.advanced.predictionHash ?? "—"}
            </p>
            <p>gradedHash: {view.advanced.gradedHash ?? "—"}</p>
            <p>reviewHash: {view.advanced.reviewHash ?? "—"}</p>
            <p>schemas: {view.advanced.schemaHints.join(" · ")}</p>
            <p>warning codes:</p>
            <ul className="list-inside list-disc">
              {view.advanced.rawWarningCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p>artifacts:</p>
            <ul className="list-inside list-disc">
              {view.advanced.artifactPaths.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
