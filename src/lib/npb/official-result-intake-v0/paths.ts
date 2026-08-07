import path from "node:path";

export function npbOfficialResultsRel(dateKst: string): string {
  return `data/research/npb/${dateKst}-official-results-v0.json`;
}

export function npbOfficialResultsAbs(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(cwd, npbOfficialResultsRel(dateKst));
}

export function npbPregameEvidenceSnapshotRel(dateKst: string): string {
  return `data/predictions/npb/${dateKst}.json`;
}

export function npbPregameEvidenceSnapshotAbs(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(cwd, npbPregameEvidenceSnapshotRel(dateKst));
}
