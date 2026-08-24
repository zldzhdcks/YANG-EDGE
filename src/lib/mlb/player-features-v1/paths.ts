import path from "node:path";

export function mlbPlayerFeaturesDayDir(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(cwd, "data", "research", "mlb", "player-features", dateKst);
}

export function mlbPlayerFeaturesDatasetRel(dateKst: string): string {
  return path.posix.join(
    "data/research/mlb/player-features",
    dateKst,
    "dataset-v1.json",
  );
}

export function mlbPlayerFeaturesDatasetAbs(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(mlbPlayerFeaturesDayDir(dateKst, cwd), "dataset-v1.json");
}

export function mlbPlayerFeaturesManifestRel(dateKst: string): string {
  return path.posix.join(
    "data/research/mlb/player-features",
    dateKst,
    "manifest-v1.json",
  );
}

export function mlbPlayerFeaturesManifestAbs(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(mlbPlayerFeaturesDayDir(dateKst, cwd), "manifest-v1.json");
}
