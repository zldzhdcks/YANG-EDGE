import type { GameData } from "@/types/game";
import type { OddsData } from "@/lib/odds";
import {
  getOddsAvailabilityLabel,
  type GameRecommendationGrade,
  type OddsAvailability,
} from "@/types/game-with-odds";
import Badge from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import AnalysisNavLink from "@/components/analysis/AnalysisNavLink";
import { getMatchDisplayLabel } from "@/lib/teams";

type GameCardProps = {
  game: GameData;
  /** 매칭 확정된 배당만 전달된다. 없으면 표시하지 않음 (빈 값·0 금지). */
  odds?: OddsData | null;
  oddsAvailability?: OddsAvailability;
  oddsUnavailableReason?: string | null;
  /** Engine 결과가 있을 때만. 없으면 배지 미표시. */
  recommendation?: GameRecommendationGrade | null;
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
  oddsAvailability = "not-found",
  oddsUnavailableReason = null,
  recommendation = null,
  hideLeague = false,
}: GameCardProps) {
  const matchLabel = getMatchDisplayLabel(game.homeTeam, game.awayTeam, {
    sport: game.sport,
    league: game.league,
  });
  const analysisReady = game.aiAnalysisAvailable;
  const showGrade = recommendation != null;
  const unavailableLabel = getOddsAvailabilityLabel(oddsAvailability);

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
        {oddsAvailability === "available" && odds ? (
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

      {analysisReady ? (
        <span
          className={buttonClasses({
            size: "sm",
            className: "h-9 shrink-0 px-4 text-sm group-hover:bg-blue-500",
          })}
        >
          분석
        </span>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex h-9 shrink-0 cursor-not-allowed items-center rounded-lg border border-white/[0.06] bg-zinc-900/40 px-4 text-sm font-medium text-zinc-600"
        >
          분석 준비중
        </span>
      )}
    </div>
  );
}

export default function GameCard({
  game,
  odds = null,
  oddsAvailability = "not-found",
  oddsUnavailableReason = null,
  recommendation = null,
  hideLeague = false,
}: GameCardProps) {
  const wrapperClass =
    "group block w-full border-b border-white/[0.06] py-5 first:pt-0 last:border-b-0 last:pb-0";

  if (game.aiAnalysisAvailable) {
    return (
      <AnalysisNavLink gameId={game.id} className={wrapperClass}>
        <GameCardBody
          game={game}
          odds={odds}
          oddsAvailability={oddsAvailability}
          oddsUnavailableReason={oddsUnavailableReason}
          recommendation={recommendation}
          hideLeague={hideLeague}
        />
      </AnalysisNavLink>
    );
  }

  return (
    <div className={wrapperClass}>
      <GameCardBody
        game={game}
        odds={odds}
        oddsAvailability={oddsAvailability}
        oddsUnavailableReason={oddsUnavailableReason}
        recommendation={recommendation}
        hideLeague={hideLeague}
      />
    </div>
  );
}
