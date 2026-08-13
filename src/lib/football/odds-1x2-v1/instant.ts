const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function isOddsIsoInstant(value: string): boolean {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

export function assertOddsIsoInstant(
  value: string,
  code: "ODDS_OBSERVED_AT_INVALID" | "ODDS_GENERATED_AT_INVALID",
): void {
  if (!isOddsIsoInstant(value)) {
    throw new Error(code);
  }
}
