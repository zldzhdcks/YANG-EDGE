import type { ReactNode } from "react";
import type {
  FieldAvailability,
  ResearchAnalysisView,
  ResearchField,
  StarterMetricsAtPrediction,
} from "@/types/research-analysis-view";
import {
  availabilityLabelEn,
  availabilityLabelKo,
  mapStatusCodeKo,
  mapStatusCodesDisplay,
  predictionOutcomeKo,
} from "@/lib/research/research-analysis-display-map";
import {
  formatEdgeScoreUserDisplay,
  formatRawHomeSideEdgeForTechnical,
} from "@/lib/edge/edge-score-semantics";
import Card from "@/components/ui/Card";
import Link from "next/link";
import PredictionResultBadge from "@/components/research/PredictionResultBadge";

function abbreviatePath(path: string | null): string {
  if (!path) return "—";
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

function formatSigned(n: number): string {
  return `${n > 0 ? "+" : ""}${n}`;
}

function MissingHint({
  availability,
  english = false,
}: {
  availability: FieldAvailability;
  english?: boolean;
}) {
  if (availability === "COLLECTED") return null;
  return (
    <span className="text-sm text-zinc-500">
      {english
        ? availabilityLabelEn(availability)
        : availabilityLabelKo(availability)}
    </span>
  );
}

/** Korean primary + original code as secondary (never hides original). */
function CodedText({ raw }: { raw: string | null | undefined }) {
  if (raw == null || raw.trim() === "") {
    return <span className="text-zinc-500">—</span>;
  }

  const parts = mapStatusCodesDisplay(raw);
  const allUnknown = parts.every((p) => p.ko == null);
  if (allUnknown) {
    const single = mapStatusCodeKo(raw.trim());
    if (single) {
      return (
        <span className="text-right">
          <span className="block text-zinc-200">{single}</span>
          <span className="mt-0.5 block font-mono text-[10px] text-zinc-600">
            {raw.trim()}
          </span>
        </span>
      );
    }
    return <span className="text-right text-zinc-200">{raw}</span>;
  }

  return (
    <span className="text-right">
      {parts.map((p) => (
        <span key={p.code} className="mb-1 block last:mb-0">
          <span className="block text-zinc-200">{p.ko ?? p.code}</span>
          {p.ko ? (
            <span className="mt-0.5 block font-mono text-[10px] text-zinc-600">
              {p.code}
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

function SectionHeading({
  title,
  badge,
}: {
  title: string;
  badge?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h2 className="text-sm font-semibold tracking-tight text-white">
        {title}
      </h2>
      {badge ? (
        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-500">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function Block({ children }: { children: ReactNode }) {
  return (
    <Card padding="md" className="rounded-xl">
      {children}
    </Card>
  );
}

function MetricRow({
  label,
  field,
  render,
}: {
  label: string;
  field: ResearchField<number>;
  render: (value: number) => ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] py-2 last:border-b-0">
      <span className="text-xs text-zinc-500">{label}</span>
      {field.availability === "COLLECTED" && field.value != null ? (
        <span className="tabular-nums text-sm font-semibold text-white">
          {render(field.value)}
        </span>
      ) : (
        <MissingHint availability={field.availability} />
      )}
    </div>
  );
}

function EdgeScoreMetricRow({
  view,
}: {
  view: ResearchAnalysisView;
}) {
  const raw = view.edgeScore;
  const baselinePick = view.prediction.value;
  const homeTeam = view.gameInfo.homeTeam;
  const awayTeam = view.gameInfo.awayTeam;

  if (
    raw.availability !== "COLLECTED" ||
    raw.value == null ||
    !baselinePick ||
    !homeTeam ||
    !awayTeam
  ) {
    return (
      <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] py-2 last:border-b-0">
        <span className="text-xs text-zinc-500">EDGE 점수</span>
        <MissingHint availability={raw.availability} />
      </div>
    );
  }

  const display = formatEdgeScoreUserDisplay({
    homeSideEdgeScore: raw.value,
    baselinePick,
    homeTeam,
    awayTeam,
  });

  return (
    <div className="border-b border-white/[0.04] py-2 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-zinc-500">EDGE 점수</span>
        <div className="text-right">
          <span className="tabular-nums text-sm font-semibold text-white">
            {display.primaryValue}
          </span>
          <p className="mt-0.5 text-xs text-zinc-500">{display.statusLabelKo}</p>
        </div>
      </div>
    </div>
  );
}

/** Completeness: Korean status only on main screen (raw codes → 기술 정보). */
function CompletenessRow({ label, ko }: { label: string; ko: string }) {
  return (
    <li className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
      <span className="shrink-0 text-xs text-zinc-500 sm:text-sm">{label}</span>
      <span className="text-sm text-zinc-200 sm:text-right">{ko}</span>
    </li>
  );
}

function completenessKoFromAvailability(a: FieldAvailability): string {
  return availabilityLabelKo(a);
}

function completenessKoFromMetrics(
  metrics: StarterMetricsAtPrediction | undefined,
): string {
  if (metrics === "MISSING_DETAIL") return "일부 부족";
  if (metrics === "INCLUDED") return "수집됨";
  return "미수집";
}

type Props = {
  view: ResearchAnalysisView;
  gamesBackHref: string;
};

const PRE_GAME = "경기 전 스냅샷";

export default function ResearchAnalysisViewer({ view, gamesBackHref }: Props) {
  const learning =
    view.learningSummary?.availability === "COLLECTED"
      ? view.learningSummary.value
      : null;
  const pitchers =
    view.startingPitchers.availability === "COLLECTED"
      ? view.startingPitchers.value
      : null;
  const bullpen =
    view.bullpenStatus.availability === "COLLECTED"
      ? view.bullpenStatus.value
      : null;
  const snap =
    view.pitchingSnapshot.availability === "COLLECTED"
      ? view.pitchingSnapshot.value
      : null;

  const identityAvail =
    snap?.starterIdentityAvailable ?? view.startingPitchers.availability;
  const metricsAtPred =
    snap?.starterMetricsAtPrediction ?? pitchers?.metricsAtPrediction;
  const bullpenAvail =
    snap?.bullpenDataAvailable ?? view.bullpenStatus.availability;

  const outcomeKo = learning
    ? predictionOutcomeKo({
        feedbackClassification: learning.feedbackClassification,
        predictionHit: learning.predictionHit,
      })
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8">
        <p className="text-xs font-medium tracking-widest text-blue-500 uppercase">
          연구
        </p>
        {/* Research Header */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {view.gameInfo.matchLabel}
          </h1>
          {view.gameInfo.startTimeKst && (
            <span className="text-lg tabular-nums text-zinc-400">
              {view.gameInfo.startTimeKst.includes("T")
                ? new Date(view.gameInfo.startTimeKst).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
                : view.gameInfo.startTimeKst}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-white">
            Research Ready
          </span>
          <span className={`text-lg font-bold tabular-nums ${
            view.researchScore.total === 100 ? "text-green-400" :
            view.researchScore.total > 0 ? "text-amber-400" :
            "text-red-400"
          }`}>
            {view.researchScore.total}%
          </span>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            view.researchScore.overallLabel === "READY" ? "border-green-800 bg-green-950/40 text-green-400" :
            view.researchScore.overallLabel === "PARTIAL" ||
            view.researchScore.overallLabel === "PARTIAL_READY" ||
            view.researchScore.overallLabel === "WAITING_FOR_PREDICTION" ||
            view.researchScore.overallLabel === "WAITING_FOR_LINEUP" ? "border-amber-800 bg-amber-950/40 text-amber-400" :
            view.researchScore.overallLabel === "BLOCKED" ? "border-red-800 bg-red-950/40 text-red-400" :
            "border-zinc-700 bg-zinc-800 text-zinc-500"
          }`}>
            {view.researchScore.overallLabel}
          </span>
        </div>
        <p className="mt-2 text-xs text-zinc-600">{view.sampleNotice}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded border border-white/10 px-2 py-1 text-zinc-400">
            {view.isFinishedGame ? "종료 경기" : "시작 전"}
          </span>
          <span className="tabular-nums text-zinc-600">{view.gameId}</span>
        </div>
      </header>

      {process.env.NODE_ENV === "development" && (
        <div className="mb-6 rounded border border-zinc-700 bg-zinc-900/60 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Debug Info
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] sm:grid-cols-3">
            {(view.kboOperational
              ? ([
                  ["Schedule", view.kboOperational.schedule.status],
                  ["Domestic Odds", view.kboOperational.domesticOdds.status],
                  ["Overseas Odds", view.kboOperational.overseasOdds.status],
                  ["Starter", view.kboOperational.starter.status],
                  ["Lineup", view.kboOperational.lineup.status],
                  ["Prediction", view.kboOperational.prediction.status],
                  ["Review", view.kboOperational.review.status],
                ] as const)
              : ([
                  [
                    "Schedule",
                    view.gameInfo.availability === "COLLECTED" ? "PASS" : "FAIL",
                  ],
                  [
                    "Domestic Odds",
                    view.oddsComparison.domesticPass ? "PASS" : "FAIL",
                  ],
                  [
                    "Overseas Odds",
                    view.oddsComparison.overseasPass ? "PASS" : "FAIL",
                  ],
                  [
                    "Starter",
                    view.startingPitchers.availability === "COLLECTED"
                      ? "PASS"
                      : "FAIL",
                  ],
                  [
                    "Lineup",
                    view.sources.lineupPath != null ? "PASS" : "FAIL",
                  ],
                  [
                    "Prediction",
                    view.researchPrediction.debugStatus === "NOT_CREATED" ||
                    view.researchPrediction.debugStatus === "WAITING"
                      ? "NOT_CREATED"
                      : view.researchPrediction.debugStatus,
                  ],
                ] as const)
            ).map(([label, text]) => {
              const ready =
                text === "READY" ||
                text === "READY_ADMIN_VERIFIED" ||
                text === "PASS" ||
                text === "AVAILABLE";
              const waiting =
                text === "NOT_CREATED" ||
                text === "NOT_ENTERED" ||
                text === "NOT_READY" ||
                text === "NOT_AVAILABLE" ||
                text === "NOT_COLLECTED" ||
                text === "WAITING" ||
                text === "BLOCKED";
              return (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`inline-block h-2 w-2 rounded-full ${ready ? "bg-green-500" : waiting ? "bg-amber-500" : "bg-red-500"}`} />
                <span className="text-zinc-400">{label}</span>
                <span className={`ml-auto font-mono ${ready ? "text-green-400" : waiting ? "text-amber-400" : "text-red-400"}`}>
                  {text}
                </span>
              </div>
              );
            })}
          </div>
          {view.kboOperational && (
            <div className="mt-2 space-y-0.5 text-[10px] text-zinc-600">
              {(
                [
                  ["Schedule", view.kboOperational.schedule],
                  ["Domestic Odds", view.kboOperational.domesticOdds],
                  ["Starter", view.kboOperational.starter],
                  ["Lineup", view.kboOperational.lineup],
                  ["Prediction", view.kboOperational.prediction],
                ] as const
              ).map(([label, src]) =>
                src.sourcePath ? (
                  <p key={label}>
                    {label}: {abbreviatePath(src.sourcePath)}
                    {src.sourceType !== "NONE" ? ` · ${src.sourceType}` : ""}
                  </p>
                ) : (
                  <p key={label}>
                    {label}: {src.status}
                  </p>
                ),
              )}
            </div>
          )}
          {!view.kboOperational && (view.sources.oddsPath || view.sources.predictionPath) && (
            <p className="mt-2 text-[10px] text-zinc-600">
              {view.sources.predictionPath
                ? `Prediction Source: ${abbreviatePath(view.sources.predictionPath)}`
                : null}
              {view.sources.predictionPath && view.sources.oddsPath ? " · " : null}
              {view.sources.oddsPath
                ? `Odds Source: ${abbreviatePath(view.sources.oddsPath)}`
                : null}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-5">
        <Block>
          <SectionHeading
            title={
              view.isFinishedGame ? "경기 요약 · 경기 종료" : "경기 정보"
            }
          />
          {view.gameInfo.availability === "COLLECTED" ? (
            <div className="space-y-1 text-sm text-zinc-300">
              <p className="text-base font-medium text-white">
                {view.gameInfo.matchLabel}
              </p>
              <p>{view.gameInfo.league ?? "—"}</p>
              <p className="tabular-nums text-zinc-500">
                {view.gameInfo.dateKst ?? "—"}
                {view.gameInfo.startTimeKst
                  ? ` · ${view.gameInfo.startTimeKst} KST`
                  : ""}
              </p>
              {view.isFinishedGame && learning ? (
                <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-3">
                  {learning.homeScore != null && learning.awayScore != null ? (
                    <p className="tabular-nums text-lg font-semibold text-white">
                      경기 종료 {learning.awayScore} – {learning.homeScore}
                    </p>
                  ) : null}
                  {outcomeKo ? (
                    <div className="mt-1">
                      <PredictionResultBadge
                        hit={outcomeKo === "예측 적중"}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              {view.isFinishedGame &&
              view.learningSummary &&
              view.learningSummary.availability !== "COLLECTED" ? (
                <p className="mt-3 text-sm text-zinc-500">
                  Final:{" "}
                  {availabilityLabelKo(view.learningSummary.availability)}
                </p>
              ) : null}
            </div>
          ) : (
            <MissingHint availability={view.gameInfo.availability} />
          )}
        </Block>

        {/* Research Score */}
        <Block>
          <SectionHeading title="Research Score" badge={`${view.researchScore.total} / ${view.researchScore.max}`} />
          <div className="space-y-1.5">
            {view.researchScore.items.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3">
                <span className="text-xs text-zinc-400">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold tabular-nums ${item.status === "OK" || item.status === "PASS_RECORDED" ? "text-green-400" : item.status === "BLOCKED" || item.status === "NOT_ELIGIBLE" ? "text-amber-400" : "text-zinc-600"}`}>
                    {item.score}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    item.status === "OK"
                      ? "bg-green-950/40 text-green-400"
                      : item.status === "PASS_RECORDED"
                        ? "bg-green-950/40 text-green-400"
                      : item.status === "BLOCKED" || item.status === "NOT_ELIGIBLE"
                        ? "bg-amber-950/40 text-amber-400"
                      : "bg-zinc-800 text-zinc-600"
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Block>

        <Block>
          <SectionHeading title="경기 전 예측" badge={PRE_GAME} />
          <div className="space-y-4">
            {view.researchPrediction.artifactAvailable ? (
              <div className="space-y-2 text-sm text-zinc-300">
                <p className="text-xs text-zinc-500">Prediction Snapshot</p>
                <p>
                  상태:{" "}
                  <span className="font-medium text-white">
                    {view.researchPrediction.officialStatus}
                  </span>
                  <span className="ml-2 text-[10px] text-zinc-500">
                    ({view.researchPrediction.debugLabel})
                  </span>
                </p>
                <p>
                  공식 Pick:{" "}
                  {view.researchPrediction.officialPick ?? "없음"}
                </p>
                {view.researchPrediction.passReasons.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500">사유</p>
                    <ul className="mt-1 list-inside list-disc text-xs text-zinc-400">
                      {view.researchPrediction.passReasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs tabular-nums text-zinc-500">
                  predictedAt: {view.researchPrediction.predictedAt ?? "—"}
                </p>
                <p className="text-xs tabular-nums text-zinc-500">
                  lockedAt: {view.researchPrediction.lockedAt ?? "—"}
                </p>
                <p className="text-xs tabular-nums text-zinc-500">
                  hash:{" "}
                  {view.researchPrediction.predictionHash
                    ? `${view.researchPrediction.predictionHash.slice(0, 12)}…`
                    : "—"}
                </p>
                <div className="border-t border-white/[0.06] pt-2">
                  <p className="text-xs text-zinc-500">
                    Research Baseline (관찰용 · Research Only)
                  </p>
                  {view.researchPrediction.researchBaseline?.available ? (
                    <p className="mt-1 text-xs text-zinc-400">
                      pick: {view.researchPrediction.researchBaseline.pick ?? "—"}
                      {" · "}
                      confidence:{" "}
                      {view.researchPrediction.researchBaseline.confidence ?? "—"}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-600">없음</p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-zinc-500">예측</p>
                {view.prediction.availability === "COLLECTED" &&
                view.prediction.value != null ? (
                  <p className="mt-1 text-base font-medium text-white">
                    {view.prediction.value}
                  </p>
                ) : (
                  <div className="mt-1">
                    <p className="text-sm text-amber-400">
                      Prediction Artifact Missing
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {view.researchPrediction.loadReason}
                    </p>
                  </div>
                )}
              </div>
            )}
            <div>
              <p className="mb-1 text-xs font-medium text-zinc-500">예측 지표</p>
              <div className="rounded-lg bg-white/[0.02] px-3">
                <MetricRow
                  label="승리 확률"
                  field={view.probability}
                  render={(v) => `${v}%`}
                />
                <MetricRow
                  label="신뢰도"
                  field={view.confidence}
                  render={(v) => String(v)}
                />
                <EdgeScoreMetricRow view={view} />
                <MetricRow
                  label="가치 차이"
                  field={view.valueEdge}
                  render={(v) => formatSigned(v)}
                />
              </div>
            </div>
          </div>
        </Block>

        <Block>
          <SectionHeading title="투수진 현황" badge={PRE_GAME} />
          {snap || pitchers || bullpen ? (
            <div className="space-y-4">
              {pitchers ? (
                <div>
                  <p className="mb-2 text-xs text-zinc-500">예상 선발</p>
                  <ul className="space-y-2 text-sm text-zinc-300">
                    <li className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-2">
                      <span>원정: {pitchers.away.name ?? "—"}</span>
                      {pitchers.away.status ? (
                        <CodedText raw={pitchers.away.status} />
                      ) : null}
                    </li>
                    <li className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-2">
                      <span>홈: {pitchers.home.name ?? "—"}</span>
                      {pitchers.home.status ? (
                        <CodedText raw={pitchers.home.status} />
                      ) : null}
                    </li>
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">
                  예상 선발:{" "}
                  {availabilityLabelKo(view.startingPitchers.availability)}
                </p>
              )}

              {snap?.starterStatus || bullpen ? (
                <ul className="space-y-2 border-t border-white/[0.06] pt-3">
                  {snap?.starterStatus ? (
                    <li className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
                      <span className="shrink-0 text-xs text-zinc-500 sm:text-sm">
                        선발 상태
                      </span>
                      <CodedText raw={snap.starterStatus} />
                    </li>
                  ) : null}
                  {bullpen ? (
                    <li className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3">
                      <span className="shrink-0 text-xs text-zinc-500 sm:text-sm">
                        불펜 상태
                      </span>
                      <span>
                        <CodedText raw={bullpen.overallRoleComparison} />
                        <span className="mt-1 block text-xs text-zinc-500">
                          예측 팀: {bullpen.pickTeam ?? "—"} · 상대 팀:{" "}
                          {bullpen.oppTeam ?? "—"}
                        </span>
                      </span>
                    </li>
                  ) : null}
                </ul>
              ) : null}

              <div className="border-t border-white/[0.06] pt-3">
                <p className="mb-2 text-xs font-medium text-zinc-500">
                  데이터 수집 상태
                </p>
                <ul className="space-y-2.5">
                  <CompletenessRow
                    label="선발 신원"
                    ko={completenessKoFromAvailability(identityAvail)}
                  />
                  <CompletenessRow
                    label="선발 세부 지표"
                    ko={completenessKoFromMetrics(metricsAtPred)}
                  />
                  <CompletenessRow
                    label="불펜"
                    ko={completenessKoFromAvailability(bullpenAvail)}
                  />
                </ul>
              </div>
            </div>
          ) : (
            <MissingHint availability={view.pitchingSnapshot.availability} />
          )}
        </Block>

        {view.gameId.startsWith("kbo-") ? (
          <Block>
            <SectionHeading title="라인업 확인" badge={PRE_GAME} />
            {view.confirmedLineup?.availability === "COLLECTED" &&
            view.confirmedLineup.value ? (
              <div className="space-y-4">
                <p className="text-xs text-zinc-500">
                  상태: {view.confirmedLineup.value.reviewStatus}
                </p>
                {([
                  ["원정", view.confirmedLineup.value.away],
                  ["홈", view.confirmedLineup.value.home],
                ] as const).map(([label, side]) => (
                  <div key={label} className="rounded border border-white/[0.06] px-3 py-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {label} {side?.teamName ?? "—"}
                      </span>
                      {side?.lineupStatus ? (
                        <span className="text-xs text-zinc-500">
                          {side.lineupStatus}
                        </span>
                      ) : null}
                    </div>
                    {side?.batters.length ? (
                      <ol className="space-y-1 text-sm text-zinc-300">
                        {side.batters.map((batter) => (
                          <li key={`${label}-${batter.slot}`} className="tabular-nums">
                            {batter.slot}. {batter.playerName}
                            {batter.defensivePosition
                              ? ` · ${batter.defensivePosition}`
                              : ""}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-sm text-zinc-500">미입력</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Lineup Missing</p>
            )}
          </Block>
        ) : null}

        <Block>
          <SectionHeading title="시장 배당" badge={PRE_GAME} />
          {view.marketOdds.availability === "COLLECTED" &&
          view.marketOdds.value ? (
            <div className="space-y-3">
              <p className="text-[10px] text-zinc-600">
                {view.oddsComparison.frozenLabel} (Pregame research freeze)
              </p>
              <ul className="space-y-1 text-sm tabular-nums text-zinc-300">
                <li>
                  연구 Snapshot 국내 (홈):{" "}
                  {view.marketOdds.value.openingOdds ?? "—"}
                </li>
                <li>
                  연구 Snapshot 해외 (홈):{" "}
                  {view.marketOdds.value.latestOdds ?? "—"}
                </li>
                {view.marketOdds.value.oddsMovement != null && (
                  <li className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                    <span>변동:</span>
                    <CodedText raw={view.marketOdds.value.oddsMovement} />
                  </li>
                )}
                {view.marketOdds.value.marketProbability != null && (
                  <li>
                    시장 확률: {view.marketOdds.value.marketProbability}%
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <MissingHint availability={view.marketOdds.availability} />
          )}
        </Block>

        {/* Odds Comparison */}
        {view.oddsComparison.available && (
          <Block>
            <SectionHeading title="배당 비교" badge={PRE_GAME} />
            <p className="mb-2 text-[10px] text-zinc-600">
              {view.oddsComparison.frozenLabel} — live 시장 최고 배당과 별도
            </p>
            <div className="space-y-3 text-sm tabular-nums text-zinc-300">
              <div>
                <p className="text-xs text-zinc-500">
                  {view.oddsComparison.domesticSourceLabel ??
                    "국내 프로토 — 관리자 입력"}
                </p>
                <p className="mt-0.5">
                  {view.oddsComparison.homeTeamName ?? "홈"}{" "}
                  {view.oddsComparison.domesticHome ?? "—"}
                  <span className="mx-1.5 text-zinc-600">·</span>
                  {view.oddsComparison.awayTeamName ?? "원정"}{" "}
                  {view.oddsComparison.domesticAway ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">
                  {view.oddsComparison.overseasSourceLabel ?? "해외 시장 · API"}
                </p>
                <p className="mt-0.5">
                  {view.oddsComparison.homeTeamName ?? "홈"}{" "}
                  {view.oddsComparison.overseasHome ?? "—"}
                  <span className="mx-1.5 text-zinc-600">·</span>
                  {view.oddsComparison.awayTeamName ?? "원정"}{" "}
                  {view.oddsComparison.overseasAway ?? "—"}
                </p>
              </div>
              {(view.oddsComparison.diffHome != null ||
                view.oddsComparison.diffAway != null) && (
                <div>
                  <p className="text-xs text-zinc-500">차이 (국내 − 해외)</p>
                  <p className="mt-0.5 font-semibold">
                    {view.oddsComparison.homeTeamName ?? "홈"}{" "}
                    {view.oddsComparison.diffHome != null
                      ? `${view.oddsComparison.diffHome > 0 ? "+" : ""}${view.oddsComparison.diffHome}`
                      : "—"}
                    <span className="mx-1.5 text-zinc-600">·</span>
                    {view.oddsComparison.awayTeamName ?? "원정"}{" "}
                    {view.oddsComparison.diffAway != null
                      ? `${view.oddsComparison.diffAway > 0 ? "+" : ""}${view.oddsComparison.diffAway}`
                      : "—"}
                  </p>
                </div>
              )}
            </div>
            <p className="mt-2 text-[10px] text-zinc-600">
              차이 = 국내 − 해외. 색상만으로 의미를 표현하지 않습니다.
            </p>
          </Block>
        )}

        {/* Data Freshness */}
        <Block>
          <SectionHeading title="데이터 최신성" />
          <div className="space-y-1">
            {view.dataFreshness.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">{item.label}</span>
                <span className={item.updatedAt ? "tabular-nums text-zinc-400" : "text-zinc-600"}>
                  {item.updatedAt
                    ? (() => { try { return new Date(item.updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }); } catch { return item.updatedAt; } })()
                    : "미생성"}
                </span>
              </div>
            ))}
          </div>
        </Block>

        {/* Timeline */}
        {view.timeline.length > 0 && (
          <Block>
            <SectionHeading title="오늘 변경" />
            <div className="space-y-1">
              {view.timeline.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="w-12 shrink-0 tabular-nums text-zinc-600 text-right">{entry.time}</span>
                  <span className="text-zinc-400">{entry.event}</span>
                </div>
              ))}
            </div>
          </Block>
        )}

        {view.isFinishedGame ? (
          <section className="space-y-3">
            <SectionHeading title="경기 후 복기" />

            {view.successReview ? (
              <Block>
                <h3 className="mb-2 text-xs font-medium text-zinc-400">
                  성공 복기
                </h3>
                {view.successReview.availability === "COLLECTED" &&
                view.successReview.value ? (
                  <ul className="space-y-2 text-sm text-zinc-300">
                    {view.successReview.value.match ? (
                      <li className="text-zinc-500">
                        {view.successReview.value.match}
                      </li>
                    ) : null}
                    <li className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                      <span className="shrink-0 text-zinc-500">주요 요인</span>
                      <CodedText raw={view.successReview.value.primary} />
                    </li>
                    <li>
                      <span className="text-zinc-500">보조 요인</span>
                      {view.successReview.value.secondary.length > 0 ? (
                        <ul className="mt-1 space-y-1">
                          {view.successReview.value.secondary.map((s) => (
                            <li key={s}>
                              <CodedText raw={s} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="ml-2">—</span>
                      )}
                    </li>
                    {view.successReview.value.note ? (
                      <li className="text-xs text-zinc-500">
                        {view.successReview.value.note}
                      </li>
                    ) : null}
                  </ul>
                ) : (
                  <MissingHint
                    availability={view.successReview.availability}
                  />
                )}
              </Block>
            ) : null}

            {view.failureReview ? (
              <Block>
                <h3 className="mb-2 text-xs font-medium text-zinc-400">
                  실패 복기
                </h3>
                {view.failureReview.availability === "COLLECTED" &&
                view.failureReview.value ? (
                  view.failureReview.value.noClassifiedCause ? (
                    <p className="text-sm text-zinc-500">
                      분류된 주요 원인 없음
                    </p>
                  ) : (
                  <ul className="space-y-2 text-sm text-zinc-300">
                    {view.failureReview.value.match ? (
                      <li className="text-zinc-500">
                        {view.failureReview.value.match}
                      </li>
                    ) : null}
                    <li className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                      <span className="shrink-0 text-zinc-500">주요 요인</span>
                      {view.failureReview.value.primary ? (
                        <CodedText raw={view.failureReview.value.primary} />
                      ) : (
                        <span className="text-zinc-500">
                          분류된 주요 원인 없음
                        </span>
                      )}
                    </li>
                    <li>
                      <span className="text-zinc-500">보조 요인</span>
                      {view.failureReview.value.secondary.length > 0 ? (
                        <ul className="mt-1 space-y-1">
                          {view.failureReview.value.secondary.map((s) => (
                            <li key={s}>
                              <CodedText raw={s} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="ml-2 text-zinc-500">—</span>
                      )}
                    </li>
                    <li className="space-y-1 text-xs text-zinc-500">
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                        <span>선발</span>
                        {view.failureReview.value.starterVerdict ? (
                          <CodedText
                            raw={view.failureReview.value.starterVerdict}
                          />
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                        <span>불펜</span>
                        {view.failureReview.value.bullpenVerdict ? (
                          <CodedText
                            raw={view.failureReview.value.bullpenVerdict}
                          />
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </li>
                  </ul>
                  )
                ) : (
                  <MissingHint
                    availability={view.failureReview.availability}
                  />
                )}
              </Block>
            ) : null}

            {view.learningSummary ? (
              <Block>
                <h3 className="mb-2 text-xs font-medium text-zinc-400">
                  학습 요약
                </h3>
                {view.learningSummary.availability === "COLLECTED" &&
                view.learningSummary.value ? (
                  <div className="space-y-2 text-sm text-zinc-300">
                    <p className="text-[10px] font-medium tracking-wide text-zinc-500">
                      {view.learningSummary.value.predictionTimeBasisNote}
                    </p>
                    {/* SIGNAL/hit already shown once in 경기 요약 — notes/hypotheses only */}
                    {view.learningSummary.value.reviewNotes.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-400">
                        {view.learningSummary.value.reviewNotes.map((n) => (
                          <li key={n}>{n}</li>
                        ))}
                      </ul>
                    ) : null}
                    {view.learningSummary.value.hypotheses.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-4 text-xs text-zinc-500">
                        {view.learningSummary.value.hypotheses.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    ) : (
                      !view.learningSummary.value.reviewNotes.length ? (
                        <p className="text-xs text-zinc-500">
                          추가 학습 메모 없음
                        </p>
                      ) : null
                    )}
                  </div>
                ) : (
                  <MissingHint
                    availability={view.learningSummary.availability}
                  />
                )}
              </Block>
            ) : null}

            {!view.successReview &&
            !view.failureReview &&
            !view.learningSummary ? (
              <Block>
                <p className="text-sm text-zinc-500">미수집</p>
              </Block>
            ) : null}

            {view.actualLineup ? (
              <Block>
                <h3 className="mb-2 text-xs font-medium text-zinc-400">
                  실제 선발 라인업
                </h3>
                {view.actualLineup.availability === "COLLECTED" &&
                view.actualLineup.value ? (
                  <div className="space-y-3 text-sm text-zinc-300">
                    <div className="space-y-1 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
                      <p>{view.actualLineup.value.notice}</p>
                      <p className="text-zinc-400">
                        {view.actualLineup.value.preGameStatusLabel}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start">
                      {(
                        [
                          ["원정", view.actualLineup.value.away],
                          ["홈", view.actualLineup.value.home],
                        ] as const
                      ).map(([label, side]) => (
                        <div
                          key={label}
                          className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3"
                        >
                          <div className="mb-2 flex min-h-7 flex-wrap items-center gap-2">
                            <p className="text-xs font-medium text-zinc-300">
                              {label}
                              {side?.teamName ? ` · ${side.teamName}` : ""}
                            </p>
                            {side?.lineupStatus ? (
                              <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-500">
                                {side.lineupStatus}
                              </span>
                            ) : null}
                          </div>
                          {side && side.batters.length > 0 ? (
                            <ol className="divide-y divide-white/[0.04]">
                              {side.batters.map((b) => (
                                <li
                                  key={`${label}-${b.slot}-${b.playerName}`}
                                  className="grid min-h-9 grid-cols-[1.25rem_minmax(0,1fr)_2.5rem] items-center gap-2 py-1.5"
                                >
                                  <span className="tabular-nums text-xs text-zinc-500">
                                    {b.slot}
                                  </span>
                                  <span className="truncate text-sm text-zinc-200">
                                    {b.playerName}
                                  </span>
                                  <span className="text-right text-xs tabular-nums text-zinc-500">
                                    {b.defensivePosition ?? "—"}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="text-xs text-zinc-500">미수집</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p className="text-xs text-zinc-500">
                      경기 후 확인된 실제 선발 라인업 · 예측 당시 Engine
                      입력이 아님
                    </p>
                    <MissingHint
                      availability={view.actualLineup.availability}
                    />
                  </div>
                )}
              </Block>
            ) : null}
          </section>
        ) : null}

        <Block>
          <details className="group">
            <summary className="cursor-pointer list-none text-sm font-semibold text-white marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                연구 기술 정보
                <span className="text-[10px] font-normal text-zinc-500 group-open:hidden">
                  펼치기
                </span>
                <span className="hidden text-[10px] font-normal text-zinc-500 group-open:inline">
                  접기
                </span>
              </span>
            </summary>
            <div className="mt-4 space-y-4 border-t border-white/[0.06] pt-4 text-sm">
              <div>
                <p className="text-xs text-zinc-500">Research Status 상세</p>
                <p className="mt-1 text-zinc-300">{view.researchStatus}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {view.researchStatusNote}
                </p>
              </div>

              {learning ? (
                <div>
                  <p className="text-xs text-zinc-500">
                    Feedback / hit (raw)
                  </p>
                  <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-zinc-400">
                    <li>
                      feedbackClassification:{" "}
                      {learning.feedbackClassification ?? "null"}
                    </li>
                    <li>
                      predictionHit:{" "}
                      {learning.predictionHit == null
                        ? "null"
                        : String(learning.predictionHit)}
                    </li>
                  </ul>
                </div>
              ) : null}

              <div>
                <p className="text-xs text-zinc-500">
                  Completeness (raw availability)
                </p>
                <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-zinc-400">
                  <li>
                    starterIdentity: {availabilityLabelEn(identityAvail)}
                  </li>
                  <li>
                    starterMetrics: {metricsAtPred ?? "UNKNOWN"}
                    {snap?.starterMetricsLabel
                      ? ` · ${snap.starterMetricsLabel}`
                      : ""}
                  </li>
                  <li>bullpen: {availabilityLabelEn(bullpenAvail)}</li>
                </ul>
              </div>

              <div>
                <p className="text-xs text-zinc-500">EDGE 기술 세부</p>
                {view.edgeScore.availability === "COLLECTED" &&
                view.edgeScore.value != null &&
                view.prediction.value != null &&
                view.gameInfo.homeTeam != null &&
                view.gameInfo.awayTeam != null ? (
                  (() => {
                    const edgeDetails = formatEdgeScoreUserDisplay({
                      homeSideEdgeScore: view.edgeScore.value,
                      baselinePick: view.prediction.value,
                      homeTeam: view.gameInfo.homeTeam,
                      awayTeam: view.gameInfo.awayTeam,
                    });

                    return (
                      <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-zinc-400">
                        <li>EDGE 기준 방향: HOME</li>
                        <li>
                          원본 홈 기준 EDGE:{" "}
                          {formatRawHomeSideEdgeForTechnical(view.edgeScore.value)}
                        </li>
                        <li>
                          예측 팀 기준 EDGE:{" "}
                          {edgeDetails.predictedSideEdge != null
                            ? formatRawHomeSideEdgeForTechnical(
                                edgeDetails.predictedSideEdge,
                              )
                            : "null"}
                        </li>
                        <li>화면 표시 기준: PREDICTED_SIDE</li>
                      </ul>
                    );
                  })()
                ) : (
                  <div className="mt-1">
                    <MissingHint
                      availability={view.edgeScore.availability}
                      english
                    />
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-zinc-500">Snapshot 생성 시각</p>
                {view.snapshotGeneratedAt.availability === "COLLECTED" &&
                view.snapshotGeneratedAt.value ? (
                  <p className="mt-1 font-mono text-xs text-zinc-300">
                    {view.snapshotGeneratedAt.value}
                  </p>
                ) : (
                  <div className="mt-1">
                    <MissingHint
                      availability={view.snapshotGeneratedAt.availability}
                      english
                    />
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-zinc-500">Prediction Hash</p>
                {view.predictionHash.availability === "COLLECTED" &&
                view.predictionHash.value ? (
                  <p className="mt-1 break-all font-mono text-[11px] text-zinc-400">
                    {view.predictionHash.value}
                  </p>
                ) : (
                  <div className="mt-1">
                    <MissingHint
                      availability={view.predictionHash.availability}
                      english
                    />
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs text-zinc-500">Artifact paths</p>
                <ul className="space-y-2 text-[11px] text-zinc-600">
                  {(
                    [
                      ["prediction", view.sources.predictionPath],
                      ["starter", view.sources.starterPath],
                      ["bullpen", view.sources.bullpenPath],
                      ["lineup", view.sources.lineupPath],
                      ["review", view.sources.reviewPath],
                      ["success-flow", view.sources.successFlowPath],
                      ["failure-flow", view.sources.failureFlowPath],
                      ["odds", view.sources.oddsPath],
                      ["schedule", view.sources.schedulePath],
                    ] as const
                  ).map(([key, path]) => (
                    <li key={key} className="break-all">
                      <span className="text-zinc-500">{key}:</span>{" "}
                      <span title={path ?? undefined}>
                        {abbreviatePath(path)}
                      </span>
                      {path ? (
                        <details className="mt-0.5">
                          <summary className="cursor-pointer text-zinc-700">
                            full path
                          </summary>
                          <p className="mt-0.5 font-mono text-zinc-600">
                            {path}
                          </p>
                        </details>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        </Block>
      </div>

      <div className="mt-8">
        <Link
          href={gamesBackHref}
          className="inline-flex text-sm text-blue-400 hover:text-blue-300"
        >
          ← 경기 목록으로
        </Link>
      </div>
    </div>
  );
}
