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
import { buttonClasses } from "@/components/ui/Button";
import AnalysisNavLink from "@/components/analysis/AnalysisNavLink";
import PredictionResultBadge from "@/components/research/PredictionResultBadge";
import { getMatchDisplayLabel, getTeamDisplayName } from "@/lib/teams";

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
        시장 최고 배당
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
}: {
  oddsComparison: NonNullable<GameCardProps["oddsComparison"]>;
}) {
  const domestic = oddsComparison.domestic;
  const overseas = oddsComparison.overseas;

  return (
    <div className="mt-3 space-y-3">
      <div>
        <p className="text-[11px] font-medium tracking-wide text-zinc-500">
          국내 프로토
        </p>
        <p className="mt-0.5 text-sm tabular-nums text-zinc-300">
          <span>
            홈 {domestic?.homeOdds != null ? formatOdds(domestic.homeOdds) : "—"}
          </span>
          <span className="mx-1.5 text-zinc-600">·</span>
          <span>
            원정 {domestic?.awayOdds != null ? formatOdds(domestic.awayOdds) : "—"}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-amber-300">
          {domestic ? reviewStatusLabel(domestic.reviewStatus) : "국내 배당 미수집"}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-medium tracking-wide text-zinc-500">
          해외 시장
        </p>
        <p className="mt-0.5 text-sm tabular-nums text-zinc-300">
          <span>
            홈 {overseas?.homeOdds != null ? formatOdds(overseas.homeOdds) : "—"}
          </span>
          <span className="mx-1.5 text-zinc-600">·</span>
          <span>
            원정 {overseas?.awayOdds != null ? formatOdds(overseas.awayOdds) : "—"}
          </span>
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {overseas?.providerLabel ?? "해외 배당 미수집"}
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
              className={`text-base font-semibold text-white sm:text-lg ${hideLeague ? "" : "mt-1"}`}
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
          <KboOddsComparisonRow oddsComparison={oddsComparison} />
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

      <span
        className={buttonClasses({
          size: "sm",
          className: "h-9 shrink-0 px-4 text-sm group-hover:bg-blue-500",
        })}
      >
        연구 보기
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
}: GameCardProps) {
  const wrapperClass =
    "group block w-full border-b border-white/[0.06] py-5 first:pt-0 last:border-b-0 last:pb-0";

  return (
    <AnalysisNavLink
      gameId={getResearchAnalysisGameId(game)}
      fromDate={fromDate}
      className={wrapperClass}
    >
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
    </AnalysisNavLink>
  );
}
