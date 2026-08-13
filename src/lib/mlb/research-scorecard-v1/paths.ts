export function mlbResearchScorecardV1Rel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-research-scorecard-v1.json`;
}

export function mlbResearchScorecardV1CumulativeRel(): string {
  return "data/research/mlb/research-scorecard-v1-cumulative.json";
}

export function mlbScheduleRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-schedule-v1.json`;
}

export function mlbPredictionRel(dateKst: string): string {
  return `data/predictions/mlb/${dateKst}.json`;
}

export function mlbRecommendationRel(dateKst: string): string {
  return `data/recommendations/mlb/${dateKst}-engine-recommendations-v1.json`;
}

export function mlbStarterRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-starter-dataset-v1.json`;
}

export function mlbOddsRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-odds-history-dataset-v1.json`;
}

export function mlbProviderLineupRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-lineup-dataset-v1.json`;
}

export function mlbKoreanRel(dateKst: string): string {
  return `data/operator-input/mlb/${dateKst}-korean-market-odds-observation-v0.json`;
}

export function mlbExpectedLineupRel(dateKst: string): string {
  return `data/operator-input/mlb/${dateKst}-expected-lineup-observation-v0.json`;
}

export function mlbOfficialResultsRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-official-results-v1.json`;
}

export function mlbGradedRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-graded-predictions-v1.json`;
}

export function mlbSuccessReviewRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-success-review-v1.json`;
}

export function mlbFailureReviewRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-failure-review-v1.json`;
}
