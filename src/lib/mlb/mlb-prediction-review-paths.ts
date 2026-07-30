import path from "node:path";

export function mlbOfficialResultsRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-official-results-v1.json`;
}

export function mlbGradedPredictionsRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-graded-predictions-v1.json`;
}

export function mlbSuccessReviewRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-success-review-v1.json`;
}

export function mlbFailureReviewRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-failure-review-v1.json`;
}

export function mlbDailyReviewSummaryRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-daily-review-summary-v1.json`;
}

export function mlbPredictionSnapshotRel(dateKst: string): string {
  return `data/predictions/mlb/${dateKst}.json`;
}

export function absFromRel(rel: string, cwd = process.cwd()): string {
  return path.join(cwd, rel);
}
