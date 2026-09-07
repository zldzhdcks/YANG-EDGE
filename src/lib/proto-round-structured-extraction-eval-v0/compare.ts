export function identityKey(sha: string, visualRowIndex: number): string {
  return `${sha}|${visualRowIndex}`;
}

export function stringsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  return a === b;
}

export function numericExact(candidate: string[], truth: string[] | null | undefined): boolean {
  const t = Array.isArray(truth) ? truth : [];
  if (candidate.length !== t.length) return false;
  return candidate.every((v, i) => v === t[i]);
}

export function marketTruthPresent(raw: string | null | undefined): boolean {
  return typeof raw === "string" && raw.length > 0;
}
