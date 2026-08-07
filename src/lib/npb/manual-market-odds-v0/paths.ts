import path from "node:path";

export function npbMarketOddsConfirmationRel(dateKst: string): string {
  return `data/operator-input/npb/${dateKst}-market-odds-confirmation-v0.json`;
}

export function npbMarketOddsConfirmationAbs(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(cwd, npbMarketOddsConfirmationRel(dateKst));
}

export function npbProviderOddsRel(dateKst: string): string {
  return `data/research/npb/${dateKst}-odds-history-dataset-v1.json`;
}
