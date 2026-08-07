import path from "node:path";

export function npbStarterConfirmationRel(dateKst: string): string {
  return `data/operator-input/npb/${dateKst}-starter-confirmation-v1.json`;
}

export function npbStarterConfirmationAbs(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(cwd, npbStarterConfirmationRel(dateKst));
}

export function npbScheduleRel(dateKst: string): string {
  return `data/research/npb/${dateKst}-schedule-v1.json`;
}

export function npbScheduleAbs(dateKst: string, cwd = process.cwd()): string {
  return path.join(cwd, npbScheduleRel(dateKst));
}

export function npbStarterDatasetRel(dateKst: string): string {
  return `data/research/npb/${dateKst}-starter-dataset-v1.json`;
}
