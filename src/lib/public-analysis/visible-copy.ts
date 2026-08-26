import { formatKoreanDateTime, formatOdds, matchHeaderMeta } from "./format-display";
import type { PublicGameAnalysisViewV1 } from "@/types/public-game-analysis-view";

const STATIC_PUBLIC_LABELS = [
  "YANG EDGE 핵심 판단",
  "경기 핵심 포인트",
  "최근 흐름",
  "시장 참고",
  "해외 시장",
  "수집 기준",
  "VS",
  "경기 목록으로",
];

export function visiblePublicAnalysisCopy(view: PublicGameAnalysisViewV1): string {
  const dateTime = formatKoreanDateTime(view.game.dateKst, view.game.startTimeKst);
  const parts: Array<string | null | undefined> = [
    ...STATIC_PUBLIC_LABELS,
    matchHeaderMeta(view.game.league, dateTime),
    view.game.league,
    view.game.homeTeam,
    view.game.awayTeam,
    view.analysis.headline,
    view.analysis.description,
    view.analysis.predictedSide,
    view.analysis.probability != null ? String(view.analysis.probability) : null,
    ...view.context.keyPoints,
    view.context.recentForm?.home.team,
    view.context.recentForm?.home.summary,
    view.context.recentForm?.away.team,
    view.context.recentForm?.away.summary,
    view.market?.sourceType,
    view.market?.observedAtLabel,
    view.market?.homeTeam,
    view.market?.awayTeam,
    view.market ? formatOdds(view.market.homeOdds) : null,
    view.market ? formatOdds(view.market.drawOdds) : null,
    view.market ? formatOdds(view.market.awayOdds) : null,
    view.market?.referenceNote,
    view.meta.disclaimer,
  ];
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join("\n");
}

export const PUBLIC_FORBIDDEN_COPY = [
  "Research Ready",
  "DEBUG INFO",
  "BLOCKED",
  "NOT_AVAILABLE",
  "NOT_COLLECTED",
  "Prediction Artifact Missing",
  "PREDICTION_NOT_CREATED",
  "Artifact Missing",
  "sourcePath",
  "Prediction Hash",
  "DummyEngineAnalysisProvider",
  "PASS_ENGINE_NOT_APPROVED",
  "PASS_IDENTITY_REVIEW_REQUIRED",
  "PASS_PROVIDER_NOT_SUPPORTED",
  "PASS_MISSED_PRE_GAME_WINDOW",
  "IDENTITY_REVIEW_REQUIRED",
  "THE_ODDS_API",
] as const;
