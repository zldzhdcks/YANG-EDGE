import Card from "@/components/ui/Card";
import StatBox from "@/components/ui/StatBox";
import AnalysisNavLink from "@/components/analysis/AnalysisNavLink";
import { instantToKst } from "@/lib/datetime/kst";
import {
  pickTierBadgeLabel,
  pickTierDescription,
} from "@/lib/edge/edge-pick-labels";
import { getMatchDisplayLabel } from "@/lib/teams";
import type { TodayEdgePickSelectionResult } from "@/types/today-edge-pick";

type TodayEdgePicksProps = {
  result: TodayEdgePickSelectionResult | null;
  emptyMessage?: string;
};

function formatGeneratedAtKst(iso: string): string {
  const kst = instantToKst(iso);
  return kst ? `${kst.time} KST` : iso;
}

function formatValueEdge(value: number | null): string | null {
  if (value == null) return null;
  const pct = Math.abs(value) > 1 ? value : value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%p`;
}

function formatModelProbability(value: number | null): string | null {
  if (value == null) return null;
  const pct = value > 1 ? value : value * 100;
  return `${pct.toFixed(1)}%`;
}

function PickReasonTags({
  labels,
  codes,
  variant,
  max,
}: {
  labels: string[];
  codes: string[];
  variant: "selection" | "missing";
  max: number;
}) {
  if (labels.length === 0) return null;
  const tone =
    variant === "selection"
      ? "bg-emerald-500/10 text-emerald-400"
      : "bg-amber-500/10 text-amber-400";
  const title = variant === "selection" ? "선정 이유" : "데이터 부족";

  return (
    <div>
      <p className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
        {title}
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {labels.slice(0, max).map((label, index) => (
          <li
            key={`${codes[index] ?? label}-${index}`}
            title={codes[index]}
            className={`rounded-md px-2 py-0.5 text-[11px] ${tone}`}
          >
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PickCard({
  pick,
  variant,
}: {
  pick: TodayEdgePickSelectionResult["picks"][number];
  variant: "primary" | "compact";
}) {
  const matchLabel = getMatchDisplayLabel(pick.home, pick.away, {
    league: pick.league,
  });
  const valueEdge = formatValueEdge(pick.valueEdge);
  const modelProb = formatModelProbability(pick.modelProbability);
  const badge = pickTierBadgeLabel(pick.pickTier, pick.rank);
  const tierTone =
    pick.pickTier === "EDGE_PICK"
      ? "bg-blue-500/15 text-blue-400"
      : "bg-violet-500/15 text-violet-300";

  return (
    <Card padding="lg" className="rounded-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span
          className={`inline-flex min-h-8 items-center justify-center rounded-full px-2 text-sm font-bold ${tierTone}`}
        >
          {badge}
        </span>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          {variant === "primary" ? <span>{pick.league}</span> : null}
          {pick.startTimeKst ? (
            <span>
              {variant === "primary" ? "· " : ""}
              {pick.startTimeKst} KST
            </span>
          ) : null}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-zinc-500">
        {pickTierDescription(pick.pickTier)}
      </p>

      <h2
        className={
          variant === "primary"
            ? "mt-3 text-xl font-bold text-white sm:text-2xl"
            : "mt-3 text-lg font-bold text-white"
        }
      >
        {matchLabel}
      </h2>
      <p className="mt-1 text-sm text-zinc-400">예측: {pick.prediction}</p>

      <div
        className={
          variant === "primary"
            ? "mt-4 grid grid-cols-2 gap-3 border-b border-white/[0.06] pb-4 sm:grid-cols-4"
            : "mt-4 grid grid-cols-2 gap-3 border-b border-white/[0.06] pb-4"
        }
      >
        <StatBox label="Confidence" value={`${pick.confidence}`} size="md" />
        <StatBox label="Risk" value={pick.riskLabel} size="md" />
        {variant === "primary" && modelProb ? (
          <StatBox label="승리 확률" value={modelProb} size="md" />
        ) : null}
        {variant === "primary" && valueEdge ? (
          <StatBox label="Value Edge" value={valueEdge} size="md" />
        ) : null}
      </div>

      {variant === "compact" && valueEdge ? (
        <p className="mt-3 text-xs text-zinc-500">
          Value Edge: <span className="text-zinc-300">{valueEdge}</span>
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {pick.pickTier === "EDGE_PICK" ? (
          <PickReasonTags
            labels={pick.selectionReasonLabels}
            codes={pick.selectionReasons}
            variant="selection"
            max={variant === "primary" ? 4 : 3}
          />
        ) : null}
        <PickReasonTags
          labels={pick.missingReasonLabels}
          codes={pick.missingReasons}
          variant="missing"
          max={variant === "primary" ? 3 : 4}
        />
      </div>

      <AnalysisNavLink
        gameId={pick.gameId}
        className="mt-4 inline-flex text-sm font-medium text-blue-400 hover:text-blue-300"
      >
        연구 분석 보기
        <span aria-hidden>→</span>
      </AnalysisNavLink>
    </Card>
  );
}

function sectionGuidance(meta: TodayEdgePickSelectionResult["meta"]): string | null {
  if (meta.strictSelectedCount > 0) {
    return "현재 연구 기준을 충족한 EDGE PICK과 추가 연구 후보를 함께 표시합니다.";
  }
  if (meta.researchCandidateCount > 0) {
    return "엄격한 EDGE PICK 기준을 충족한 경기는 없습니다. 대신 현재 예정 경기 중 분석 우선순위가 높은 연구 후보를 표시합니다.";
  }
  return null;
}

export default function TodayEdgePicks({
  result,
  emptyMessage,
}: TodayEdgePicksProps) {
  const picks = result?.picks ?? [];
  const meta = result?.meta;
  const slateStatus = meta?.slateStatus;
  const isNoSnapshot = slateStatus === "NO_UPCOMING_SNAPSHOT";
  const guidance = meta ? sectionGuidance(meta) : null;

  return (
    <section
      id="today-edge-picks"
      className="mx-auto max-w-5xl px-4 pb-16 sm:px-6"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="text-xs font-medium tracking-widest text-blue-500 uppercase">
          TODAY EDGE PICK
        </p>
        {meta?.targetDateKst ? (
          <div className="text-right text-[11px] leading-relaxed text-zinc-500">
            <p>대상 경기일 {meta.targetDateKst} KST</p>
            <p>업데이트 {formatGeneratedAtKst(meta.generatedAt)}</p>
          </div>
        ) : meta?.generatedAt ? (
          <p className="text-[11px] text-zinc-500">
            업데이트 {formatGeneratedAtKst(meta.generatedAt)}
          </p>
        ) : null}
      </div>

      {guidance ? (
        <p className="mb-4 text-sm leading-relaxed text-zinc-400">{guidance}</p>
      ) : null}

      {picks.length === 0 ? (
        <Card padding="lg" className="rounded-xl">
          <h2 className="text-lg font-bold text-white sm:text-xl">
            {isNoSnapshot ? "TODAY EDGE PICK" : "선정된 EDGE PICK이 없습니다"}
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            {isNoSnapshot
              ? "다음 경기 분석을 준비 중입니다."
              : (emptyMessage ??
                "연구 데이터 기준으로 설명 가능한 경기가 아직 없습니다.")}
          </p>
          {isNoSnapshot ? (
            <>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                현재 시각 이후 사용할 수 있는 연구 스냅샷이 없습니다. 과거
                종료 경기는 EDGE PICK으로 다시 표시하지 않습니다.
              </p>
              {meta?.nextScheduledDateKst ? (
                <p className="mt-2 text-sm text-zinc-500">
                  다음 분석 예정: {meta.nextScheduledDateKst}
                </p>
              ) : null}
            </>
          ) : null}
        </Card>
      ) : (
        <div className="space-y-4">
          {picks[0] ? <PickCard pick={picks[0]} variant="primary" /> : null}
          {picks.length > 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {picks.slice(1).map((pick) => (
                <PickCard key={pick.gameId} pick={pick} variant="compact" />
              ))}
            </div>
          ) : null}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
        TODAY EDGE PICK은 현재 시각 이후 예정 경기 중 연구 스냅샷·Dataset
        completeness 기준으로 최대 3경기만 선정합니다. 연구 후보는 정식 EDGE
        PICK이 아닙니다. 실추천·베팅 조언이 아닙니다.
      </p>
    </section>
  );
}
