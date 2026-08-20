import path from "node:path";

export function mlbBatterDatasetRel(dateKst: string): string {
  return path.posix.join("data/research/mlb", `${dateKst}-batter-dataset-v0.json`);
}

export function mlbBatterDatasetAbs(dateKst: string, cwd = process.cwd()): string {
  return path.join(cwd, "data", "research", "mlb", `${dateKst}-batter-dataset-v0.json`);
}
