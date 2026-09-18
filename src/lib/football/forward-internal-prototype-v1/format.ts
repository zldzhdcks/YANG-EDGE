export function formatResearchPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatYesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

export function formatIsoUtc(value: string): string {
  return value;
}
