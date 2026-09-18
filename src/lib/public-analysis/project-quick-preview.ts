import type {
  PublicAnalysisState,
  PublicQuickPreview,
} from "@/types/public-game-analysis-view";

export type ProjectQuickPreviewInput = {
  homeTeam: string | null;
  awayTeam: string | null;
  league: string | null;
  startTimeKst: string | null;
  state: PublicAnalysisState;
  officialPredictionAvailable: boolean;
  identityBasis: PublicQuickPreview["basis"];
};

function statusSentences(
  state: PublicAnalysisState,
  officialPredictionAvailable: boolean,
): string[] {
  if (officialPredictionAvailable) {
    return [
      "YANG EDGE의 공식 사전 분석이 준비된 경기입니다.",
      "승패 방향은 공식 핵심 판단에서만 확인합니다.",
    ];
  }
  switch (state) {
    case "YANG_EDGE_ANALYSIS":
      return [
        "현재 검증을 마친 확률 모델이 없어 공식 승패 방향은 제시하지 않습니다.",
      ];
    case "OFFICIAL_PREDICTION_DEFERRED":
      return [
        "현재 검증을 마친 확률 모델이 없어 공식 승패 방향은 제시하지 않습니다.",
      ];
    case "ANALYSIS_EXPANDING":
      return [
        "현재 이 경기/종목은 공식 분석 제공 범위를 준비하고 있으며 승패 방향은 제시하지 않습니다.",
      ];
    case "PREGAME_ANALYSIS_UNAVAILABLE":
      return [
        "경기 시작 전 검증된 분석이 확정되지 않아 사전 승패 방향은 제공하지 않습니다.",
      ];
    case "LEGACY_MIGRATING":
      return [
        "현재 이 경기의 공식 상세 분석은 제공되지 않습니다.",
        "확인 가능한 경기 정보만 안내하며 근거 없는 승패 방향은 제시하지 않습니다.",
      ];
    case "UNRESOLVED":
      return [
        "현재 이 경기의 공식 분석 정보를 확인하고 있으며 검증되지 않은 승패 방향은 제시하지 않습니다.",
      ];
    case "ANALYSIS_PREPARING":
    default:
      return [
        "현재 확보된 사전 정보만으로는 YANG EDGE의 공식 경기 방향을 제시하지 않습니다.",
      ];
  }
}

function identitySentences(input: ProjectQuickPreviewInput): string[] {
  const home = input.homeTeam?.trim() || null;
  const away = input.awayTeam?.trim() || null;
  if (!home || !away) return [];
  const out = [`${home}와 ${away}의 경기입니다.`];
  const league = input.league?.trim() || null;
  const time = input.startTimeKst?.trim() || null;
  if (league && time) {
    out.push(`${league} 경기로, 시작 시각은 ${time}입니다.`);
  } else if (league) {
    out.push(`${league} 경기입니다.`);
  } else if (time) {
    out.push(`시작 시각은 ${time}입니다.`);
  }
  return out;
}

/**
 * Presentation-only Quick Preview. No pick, odds, edge, confidence, or artifacts.
 */
export function projectQuickPreview(
  input: ProjectQuickPreviewInput,
): PublicQuickPreview {
  const identity = identitySentences(input);
  const status = statusSentences(input.state, input.officialPredictionAvailable);
  const sentences = [...identity, ...status].slice(0, 4);
  if (sentences.length < 2) {
    sentences.push(
      "검증되지 않은 승패 방향은 제시하지 않습니다.",
    );
  }
  const hasTeams = Boolean(input.homeTeam?.trim() && input.awayTeam?.trim());
  return {
    available: sentences.length >= 2,
    sentences: sentences.slice(0, 4),
    basis: hasTeams ? input.identityBasis : "NONE",
  };
}

export const EMPTY_QUICK_PREVIEW: PublicQuickPreview = {
  available: false,
  sentences: [],
  basis: "NONE",
};
