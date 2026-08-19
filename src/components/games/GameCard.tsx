import type { GameData } from "@/types/game";
import { getResearchAnalysisGameId } from "@/types/game";
import type { OddsData } from "@/lib/odds";
import {
  getOddsAvailabilityLabel,
  type GameRecommendationGrade,
  type GameResearchOutcomeDisplay,
  type OddsAvailability,
} from "@/types/game-with-odds";
import Badge from "@/components/ui/Badge";
import AnalysisNavLink from "@/components/analysis/AnalysisNavLink";
import PredictionResultBadge from "@/components/research/PredictionResultBadge";
import { getMatchDisplayLabel, getTeamDisplayName } from "@/lib/teams";
import { cn } from "@/utils/cn";

type GameCardDensity = "standard" | "compact";

type GameCardProps = {
  game: GameData;
  /** /games 목록 날짜 — 연구 상세 fromDate (홈·픽 등에서는 전달하지 않음) */
  fromDate?: string;
  /** 매칭 확정된 배당만 전달된다. 없으면 표시하지 않음 (빈 값·0 금지). */
  odds?: OddsData | null;
  oddsComparison?: {
    domestic: {
      homeOdds: number | null;
      awayOdds: number | null;
      reviewStatus: "DRAFT" | "VERIFIED" | "REJECTED";
      sourceLabel: string;
    } | null;
    overseas: {
      homeOdds: number | null;
      awayOdds: number | null;
      providerLabel: string;
    } | null;
    comparisonStatus:
      | "COMPARABLE"
      | "MARKET_RULE_UNVERIFIED"
      | "DOMESTIC_MISSING"
      | "OVERSEAS_MISSING";
  } | null;
  oddsAvailability?: OddsAvailability;
  oddsUnavailableReason?: string | null;
  /** Engine 결과가 있을 때만. 없으면 배지 미표시. */
  recommendation?: GameRecommendationGrade | null;
  /** graded research snapshot — /games 목록 전용. 홈 SportCard에는 미사용. */
  researchOutcome?: GameResearchOutcomeDisplay | null;
  /** 리그 그룹 헤더가 있을 때 카드 내 리그 라벨 숨김 */
  hideLeague?: boolean;
  /** compact: /games 목록. standard: 기존 밀도 (다른 consumer 호환) */
  density?: GameCardDensity;
};

function formatOdds(value: number): string {
  return value.toFixed(2);
}

/**
 * 시장 최고 배당 (h2h).
 * 야구: 홈/원정. 축구: 홈/무/원정 (무는 있을 때만).
 * 북메이커 이름은 카드에 노출하지 않는다 (데이터에는 보존).
 */
function OddsRow({ odds }: { odds: OddsData }) {
  if (odds.bestHomeOdds == null || odds.bestAwayOdds == null) return null;

  return (
    <div className="mt-2">
      <p className="text-[11px] font-medium tracking-wide text-zinc-500">
        현재 시장 최고 배당
      </p>
      <p className="mt-0.5 text-sm tabular-nums text-zinc-300">
        <span>홈 {formatOdds(odds.bestHomeOdds)}</span>
        {odds.bestDrawOdds != null && (
          <>
            <span className="mx-1.5 text-zinc-600">·</span>
            <span>무 {formatOdds(odds.bestDrawOdds)}</span>
          </>
        )}
        <span className="mx-1.5 text-zinc-600">·</span>
        <span>원정 {formatOdds(odds.bestAwayOdds)}</span>
      </p>
    </div>
  );
}

function reviewStatusLabel(reviewStatus: "DRAFT" | "VERIFIED" | "REJECTED"): string {
  switch (reviewStatus) {
    case "VERIFIED":
      return "국내 배당 검수 완료";
    case "REJECTED":
      return "국내 배당 사용 제외";
    case "DRAFT":
    default:
      return "국내 배당 검수 전";
  }
}

function KboOddsComparisonRow({
  oddsComparison,
  homeTeam,
  awayTeam,
}: {
  oddsComparison: NonNullable<GameCardProps["oddsComparison"]>;
  homeTeam: string;
  awayTeam: string;
}) {
  const domestic = oddsComparison.domestic;
  const overseas = oddsComparison.overseas;

  return (
    <div className="mt-3 space-y-3">
      <div>
        <p className="text-[11px] font-medium tracking-wide text-zinc-500">
          {domestic?.sourceLabel ?? "연구 Snapshot 배당 · 국내 프로토"}
        </p>
        <p className="mt-0.5 text-sm tabular-nums text-zinc-300">
          <span>
            {homeTeam}{" "}
            {domestic?.homeOdds != null ? formatOdds(domestic.homeOdds) : "—"}
          </span>
          <span className="mx-1.5 text-zinc-600">·</span>
          <span>
            {awayTeam}{" "}
            {domestic?.awayOdds != null ? formatOdds(domestic.awayOdds) : "—"}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-amber-300">
          {domestic ? reviewStatusLabel(domestic.reviewStatus) : "국내 배당 미수집"}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-medium tracking-wide text-zinc-500">
          {overseas?.providerLabel ?? "해외 시장 · API"}
        </p>
        <p className="mt-0.5 text-sm tabular-nums text-zinc-300">
          <span>
            {homeTeam}{" "}
            {overseas?.homeOdds != null ? formatOdds(overseas.homeOdds) : "—"}
          </span>
          <span className="mx-1.5 text-zinc-600">·</span>
          <span>
            {awayTeam}{" "}
            {overseas?.awayOdds != null ? formatOdds(overseas.awayOdds) : "—"}
          </span>
        </p>
      </div>

      {oddsComparison.comparisonStatus === "MARKET_RULE_UNVERIFIED" && (
        <p className="text-xs text-amber-300">
          시장 규칙 확인 전 단순 병렬 표시
        </p>
      )}
    </div>
  );
}

function ResearchOutcomeRow({
  outcome,
  sport,
  league,
}: {
  outcome: GameResearchOutcomeDisplay;
  sport: GameData["sport"];
  league: string;
}) {
  const home = getTeamDisplayName({
    originalName: outcome.homeTeam,
    sport,
    league,
  });
  const away = getTeamDisplayName({
    originalName: outcome.awayTeam,
    sport,
    league,
  });
  const pick = getTeamDisplayName({
    originalName: outcome.predictedTeam,
    sport,
    league,
  });

  return (
    <div className="mt-2 space-y-1">
      <p className="text-sm tabular-nums text-zinc-300">
        {home} {outcome.homeScore}–{outcome.awayScore} {away}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <PredictionResultBadge hit={outcome.predictionHit} />
        <span className="text-xs text-zinc-500">예측 팀: {pick}</span>
      </div>
    </div>
  );
}

function CompactResearchResult({
  outcome,
}: {
  outcome: GameResearchOutcomeDisplay;
}) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums text-zinc-400">
      <span>
        {outcome.awayScore}–{outcome.homeScore}
      </span>
      <span className="inline-flex items-center gap-1 text-zinc-300">
        {outcome.predictionHit ? (
          <>
            <span aria-hidden="true">✓</span>
            적중
          </>
        ) : (
          <>
            <span aria-hidden="true">×</span>
            실패
          </>
        )}
      </span>
    </p>
  );
}

/** recommendation-grade 색 토큰 → 기존 Badge variant (새 색 추가 없음) */
function gradeBadgeVariant(
  color: GameRecommendationGrade["color"],
): "default" | "accent" | "success" | "warning" {
  switch (color) {
    case "blue":
      return "accent";
    case "emerald":
      return "success";
    case "amber":
      return "warning";
    case "zinc":
    default:
      return "default";
  }
}

function CompactGameCardBody({
  game,
  recommendation = null,
  researchOutcome = null,
}: Pick<GameCardProps, "game" | "recommendation" | "researchOutcome">) {
  const awayName = getTeamDisplayName({
    originalName: game.awayTeam,
    sport: game.sport,
    league: game.league,
  });
  const homeName = getTeamDisplayName({
    originalName: game.homeTeam,
    sport: game.sport,
    league: game.league,
  });
  return (
    <div className="flex items-start gap-3 py-0.5">
      <p className="w-12 shrink-0 pt-0.5 text-sm tabular-nums text-zinc-400">
        {game.startTime}
      </p>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium break-words text-white">
          <span className="sr-only">원정 </span>
          {awayName}
        </p>
        <p className="text-sm break-words text-zinc-300">
          <span className="sr-only">홈 </span>
          {homeName}
        </p>
        {researchOutcome && <CompactResearchResult outcome={researchOutcome} />}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
        {recommendation != null && (
          <Badge
            variant={gradeBadgeVariant(recommendation.color)}
            className="px-1.5 py-0.5 tracking-wide"
          >
            {recommendation.grade}
          </Badge>
        )}
        <span className="text-xs font-medium text-zinc-500 group-hover:text-zinc-300">
          분석 보기
          <span aria-hidden="true"> →</span>
        </span>
      </div>
    </div>
  );
}

function GameCardBody({
  game,
  odds,
  oddsComparison = null,
  oddsAvailability = "not-found",
  oddsUnavailableReason = null,
  recommendation = null,
  researchOutcome = null,
  hideLeague = false,
}: GameCardProps) {
  const matchLabel = getMatchDisplayLabel(game.homeTeam, game.awayTeam, {
    sport: game.sport,
    league: game.league,
  });
  const showGrade = recommendation != null;
  const unavailableLabel = getOddsAvailabilityLabel(oddsAvailability);
  const showResearchResult = researchOutcome != null;

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl px-1 py-1 transition-colors group-hover:bg-white/[0.02] sm:px-3 sm:py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {!hideLeague && (
              <p className="text-xs font-medium text-zinc-500">{game.league}</p>
            )}
            <h3
              className={`text-base font-semibold break-words text-white sm:text-lg ${hideLeague ? "" : "mt-1"}`}
            >
              {matchLabel}
            </h3>
          </div>
          {showGrade && (
            <Badge
              variant={gradeBadgeVariant(recommendation.color)}
              className="shrink-0 tracking-wide"
            >
              {recommendation.grade}
            </Badge>
          )}
        </div>
        <p className="mt-2 text-sm tabular-nums text-zinc-400">
          {game.startTime}
        </p>
        {showResearchResult ? (
          <ResearchOutcomeRow
            outcome={researchOutcome}
            sport={game.sport}
            league={game.league}
          />
        ) : game.league === "KBO" && oddsComparison ? (
          <KboOddsComparisonRow
            oddsComparison={oddsComparison}
            homeTeam={game.homeTeam}
            awayTeam={game.awayTeam}
          />
        ) : oddsAvailability === "available" && odds ? (
          <OddsRow odds={odds} />
        ) : (
          unavailableLabel && (
            <p
              className="mt-2 text-xs text-zinc-600"
              title={oddsUnavailableReason ?? undefined}
            >
              {unavailableLabel}
            </p>
          )
        )}
      </div>

      <span className="shrink-0 pt-1 text-sm font-medium text-zinc-500 group-hover:text-zinc-300">
        분석 보기
        <span aria-hidden="true"> →</span>
      </span>
    </div>
  );
}

export default function GameCard({
  game,
  fromDate,
  odds = null,
  oddsComparison = null,
  oddsAvailability = "not-found",
  oddsUnavailableReason = null,
  recommendation = null,
  researchOutcome = null,
  hideLeague = false,
  density = "standard",
}: GameCardProps) {
  const isCompact = density === "compact";
  const wrapperClass = cn(
    "group block w-full border-b border-white/[0.06] text-left last:border-b-0",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b]",
    isCompact ? "py-3" : "py-5 first:pt-0 last:pb-0",
  );

  return (
    <AnalysisNavLink
      gameId={getResearchAnalysisGameId(game)}
      fromDate={fromDate}
      className={wrapperClass}
    >
      {isCompact ? (
        <CompactGameCardBody
          game={game}
          recommendation={recommendation}
          researchOutcome={researchOutcome}
        />
      ) : (
        <GameCardBody
          game={game}
          odds={odds}
          oddsComparison={oddsComparison}
          oddsAvailability={oddsAvailability}
          oddsUnavailableReason={oddsUnavailableReason}
          recommendation={recommendation}
          researchOutcome={researchOutcome}
          hideLeague={hideLeague}
        />
      )}
    </AnalysisNavLink>
  );
}
