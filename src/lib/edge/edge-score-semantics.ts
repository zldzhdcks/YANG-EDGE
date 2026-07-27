/**
 * EDGE Score display semantics (read-only).
 *
 * Artifact / Engine convention:
 *   edgeScore is **home-side advantage** (−30 ~ +30).
 *   Positive → home favored; negative → away favored.
 *   baselinePick follows pickFromEdgeScore(home-side edge).
 *
 * Does NOT recalculate Engine scores — maps stored values for display & audits.
 */

export const EDGE_SCORE_REFERENCE_SIDE = "HOME" as const;

export type EdgeScoreSemanticsCode =
  | "EDGE_POSITIVE"
  | "EDGE_ZERO"
  | "EDGE_NEGATIVE"
  | "PREDICTED_SIDE_BELOW_BASELINE"
  | "NO_POSITIVE_EDGE"
  | "OPPOSITE_SIDE_ADVANTAGE"
  | "MARKET_CONFLICT";

export type EdgeScoreUserDisplay = {
  /** User-facing primary line: "+8.7" or "우위 없음" */
  primaryValue: string;
  statusLabelKo: string;
  /** Signed home-side artifact value (preserved) */
  rawHomeSideEdge: number;
  /** Signed advantage for baselinePick side */
  predictedSideEdge: number | null;
  semanticsCode: EdgeScoreSemanticsCode;
  showRawInAuxiliary: boolean;
};

const SEMANTICS_LABEL_KO: Record<EdgeScoreSemanticsCode, string> = {
  EDGE_POSITIVE: "Baseline 대비 우위",
  EDGE_ZERO: "Baseline 기준 우위 없음",
  EDGE_NEGATIVE: "Baseline 기준 우위 없음",
  PREDICTED_SIDE_BELOW_BASELINE: "Baseline 기준 우위 없음",
  NO_POSITIVE_EDGE: "Baseline 기준 우위 없음",
  OPPOSITE_SIDE_ADVANTAGE: "Baseline 기준 우위 없음",
  MARKET_CONFLICT: "시장 방향과 모델 판단이 충돌",
};

export function pickSideFromBaseline(
  baselinePick: string,
  homeTeam: string,
  awayTeam: string,
): "home" | "away" | null {
  const pick = baselinePick.trim();
  if (pick === homeTeam.trim()) return "home";
  if (pick === awayTeam.trim()) return "away";
  return null;
}

/** Advantage on baselinePick side (sign flip for away pick — not Math.abs). */
export function predictedSideEdgeScore(
  homeSideEdgeScore: number,
  baselinePick: string,
  homeTeam: string,
  awayTeam: string,
): number | null {
  const side = pickSideFromBaseline(baselinePick, homeTeam, awayTeam);
  if (side == null) return null;
  const rounded =
    Math.round(homeSideEdgeScore * 10) / 10;
  return side === "home" ? rounded : Math.round(-rounded * 10) / 10;
}

/** Engine pickFromEdgeScore alignment check. */
export function edgeScoreAlignsWithPick(
  homeSideEdgeScore: number,
  baselinePick: string,
  homeTeam: string,
  awayTeam: string,
): boolean {
  const side = pickSideFromBaseline(baselinePick, homeTeam, awayTeam);
  if (side == null) return false;
  if (side === "home") return homeSideEdgeScore >= 0;
  return homeSideEdgeScore <= 0;
}

export function edgeScoreSemanticsCode(input: {
  homeSideEdgeScore: number;
  baselinePick: string;
  homeTeam: string;
  awayTeam: string;
  baselineStatus?: string | null;
}): EdgeScoreSemanticsCode {
  if (input.baselineStatus === "MARKET_CONFLICT") {
    return "MARKET_CONFLICT";
  }

  const side = pickSideFromBaseline(
    input.baselinePick,
    input.homeTeam,
    input.awayTeam,
  );
  if (side == null) return "NO_POSITIVE_EDGE";

  const predicted = predictedSideEdgeScore(
    input.homeSideEdgeScore,
    input.baselinePick,
    input.homeTeam,
    input.awayTeam,
  );

  if (predicted == null) return "NO_POSITIVE_EDGE";
  if (predicted > 0) return "EDGE_POSITIVE";
  if (predicted === 0) return "EDGE_ZERO";

  if (side === "home" && input.homeSideEdgeScore < 0) {
    return "PREDICTED_SIDE_BELOW_BASELINE";
  }
  if (side === "away" && input.homeSideEdgeScore > 0) {
    return "OPPOSITE_SIDE_ADVANTAGE";
  }
  return "NO_POSITIVE_EDGE";
}

export function semanticsLabelKo(code: EdgeScoreSemanticsCode): string {
  return SEMANTICS_LABEL_KO[code];
}

export function formatEdgeScoreUserDisplay(input: {
  homeSideEdgeScore: number;
  baselinePick: string;
  homeTeam: string;
  awayTeam: string;
  baselineStatus?: string | null;
}): EdgeScoreUserDisplay {
  const rawHomeSideEdge =
    Math.round(input.homeSideEdgeScore * 10) / 10;
  const predictedSideEdge = predictedSideEdgeScore(
    rawHomeSideEdge,
    input.baselinePick,
    input.homeTeam,
    input.awayTeam,
  );
  const semanticsCode = edgeScoreSemanticsCode(input);
  const statusLabelKo = semanticsLabelKo(semanticsCode);

  if (predictedSideEdge != null && predictedSideEdge > 0) {
    const sign = predictedSideEdge > 0 ? "+" : "";
    return {
      primaryValue: `${sign}${predictedSideEdge.toFixed(1)}`,
      statusLabelKo,
      rawHomeSideEdge,
      predictedSideEdge,
      semanticsCode,
      showRawInAuxiliary: rawHomeSideEdge !== predictedSideEdge,
    };
  }

  return {
    primaryValue: "우위 없음",
    statusLabelKo,
    rawHomeSideEdge,
    predictedSideEdge,
    semanticsCode,
    showRawInAuxiliary: true,
  };
}

export function formatRawHomeSideEdgeForTechnical(
  homeSideEdgeScore: number,
): string {
  const rounded = Math.round(homeSideEdgeScore * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

export function hasPositivePredictedSideEdge(input: {
  homeSideEdgeScore: number | null;
  baselinePick: string;
  homeTeam: string;
  awayTeam: string;
}): boolean {
  if (input.homeSideEdgeScore == null) return false;
  const predicted = predictedSideEdgeScore(
    input.homeSideEdgeScore,
    input.baselinePick,
    input.homeTeam,
    input.awayTeam,
  );
  return predicted != null && predicted > 0;
}
