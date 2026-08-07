/** Human labels for review categories (UX only). */

const FAILURE_LABELS: Record<string, string> = {
  STARTER: "Starter Evaluation Failed",
  BULLPEN: "Bullpen Variance",
  LINEUP: "Lineup Difference",
  MARKET: "Market Misalignment",
  ONE_RUN_GAME: "One-Run Game",
  BLOWOUT: "Blowout Game",
  EXTRA_INNINGS: "Extra Innings",
  DATA_QUALITY: "Data Quality Gap",
  MODEL_OVERCONFIDENCE: "Model Overconfidence",
};

const SUCCESS_LABELS: Record<string, string> = {
  STARTER: "Starter Signal Helped",
  BULLPEN: "Survived Late Leverage",
  LINEUP: "Lineup Inputs Adequate",
  MARKET: "Market Alignment",
  ONE_RUN_GAME: "One-Run Survival",
  BLOWOUT: "Comfortable Margin",
  MODEL_ALIGNMENT: "Model Probability Aligned",
  INPUT_QUALITY: "Cleaner Inputs",
};

export function failureCauseLabel(code: string): string {
  return FAILURE_LABELS[code] ?? code.replace(/_/g, " ");
}

export function successCauseLabel(code: string): string {
  return SUCCESS_LABELS[code] ?? code.replace(/_/g, " ");
}

export function podiumMedal(rank: 1 | 2 | 3): "🥇" | "🥈" | "🥉" {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
}
