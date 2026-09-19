/** Presentation policy only. Never a fixture identity bridge or engine input. */
export type PreviewPriorityRegistry = {
  teams: readonly string[];
  matches: readonly (readonly [string, string])[];
  targets: readonly string[];
};

export const PREVIEW_PRIORITY_REGISTRY: PreviewPriorityRegistry = {
  teams: ["Manchester City FC", "Manchester City", "Man City", "맨체스터 시티", "맨체스터시티", "맨시티"],
  // Exact display labels only; this does not bind a provider fixture or date.
  matches: [
    ["Atlético de Madrid", "Real Madrid"],
    ["Atletico Madrid", "Real Madrid"],
    ["Atletico Madrid", "Real Madrid CF"],
    ["AT마드", "레알마드"],
    ["아틀레티코 마드리드", "레알 마드리드"],
  ],
  targets: [],
};

export type PreviewPriorityInput = {
  targetId: string;
  sport: string | null;
  home: string | null;
  away: string | null;
  previewPriority?: "MANDATORY" | "NORMAL";
  matchKind?: "OFFICIAL_FIRST_TEAM" | "FRIENDLY" | "OTHER_SQUAD" | "UNKNOWN";
};

export function resolvePreviewPriority(
  input: PreviewPriorityInput,
  registry: PreviewPriorityRegistry = PREVIEW_PRIORITY_REGISTRY,
) {
  const manual = input.previewPriority === "MANDATORY" || registry.targets.includes(input.targetId);
  const football = ["football", "soccer", "SOCCER", "FOOTBALL"].includes(input.sport ?? "");
  const applicable = football && input.matchKind !== "OTHER_SQUAD" && input.matchKind !== "FRIENDLY";
  const team = applicable && [input.home, input.away].some(n => n != null && registry.teams.includes(n));
  const match = applicable && registry.matches.some(([home, away]) => home === input.home && away === input.away);
  return {
    TEAM_PRIORITY: team ? "MANDATORY_PREVIEW" : "NORMAL",
    MATCH_PRIORITY: match || manual ? "MANDATORY_PREVIEW" : "NORMAL",
    PREVIEW_REQUIRED: manual || team || match,
    // Unknown squad/competition must not be asserted official, or silently dropped.
    IDENTITY_REVIEW_REQUIRED: !manual && (team || match) && input.matchKind !== "OFFICIAL_FIRST_TEAM",
  };
}

/** Minimal body contract. No probability/pick input: it cannot invent a prediction. */
export function mandatoryPreviewContract(input: PreviewPriorityInput & {
  predictionAvailable: boolean;
  predictionReason: string;
  updatedAt: string | null;
}, registry?: PreviewPriorityRegistry) {
  const priority = resolvePreviewPriority(input, registry);
  if (!priority.PREVIEW_REQUIRED) return null;
  return {
    TARGET_ID: input.targetId,
    ...priority,
    PREVIEW_STATUS: priority.IDENTITY_REVIEW_REQUIRED || !input.home || !input.away
      ? "PREVIEW_AWAITING_UPDATE" as const : "LIMITED_PREVIEW" as const,
    OFFICIAL_ENGINE: "V1" as const,
    PREDICTION_STATUS: input.predictionAvailable ? "AVAILABLE" : "UNAVAILABLE",
    PREDICTION_REASON: input.predictionAvailable ? null : input.predictionReason,
    LINEUP_STATUS: "NOT_CONFIRMED",
    INJURY_STATUS: "UNKNOWN",
    DATA_QUALITY: "MATCH_METADATA_ONLY",
    LAST_UPDATED_AT: input.updatedAt,
  };
}
