import path from "node:path";

export function mlbPredictionSnapshotRel(dateKst: string): string {
  return path.join("data", "predictions", "mlb", `${dateKst}.json`);
}

export function mlbOfficialResultsRel(dateKst: string): string {
  return path.join(
    "data",
    "research",
    "mlb",
    `${dateKst}-official-results-v1.json`,
  );
}

export function mlbScorecardV0Rel(dateKst: string): string {
  return path.join(
    "data",
    "research",
    "mlb",
    `${dateKst}-prediction-scorecard-v0.json`,
  );
}
