export function mlbKoreanMarketOddsObservationRel(dateKst: string): string {
  return `data/operator-input/mlb/${dateKst}-korean-market-odds-observation-v0.json`;
}

export function mlbOddsHistoryDatasetRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-odds-history-dataset-v1.json`;
}

export function mlbExpectedLineupObservationRel(dateKst: string): string {
  return `data/operator-input/mlb/${dateKst}-expected-lineup-observation-v0.json`;
}

export function mlbPredictionSnapshotRel(dateKst: string): string {
  return `data/predictions/mlb/${dateKst}.json`;
}

export function mlbEngineRecommendationRel(dateKst: string): string {
  return `data/recommendations/mlb/${dateKst}-engine-recommendations-v1.json`;
}
