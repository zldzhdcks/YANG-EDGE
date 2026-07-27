/**
 * Game-level dataset presence — same rules as Correlation Audit v2 (read-only labels).
 */
export type DatasetKey =
  | "starter"
  | "bullpen"
  | "lineup"
  | "weather"
  | "travel"
  | "odds"
  | "injury";

export type CollectionStatus = "NOT_COLLECTED" | "PARTIAL" | "COMPLETE";

export const DATASET_KEYS: DatasetKey[] = [
  "starter",
  "bullpen",
  "lineup",
  "weather",
  "travel",
  "odds",
  "injury",
];

export const REQUIRED_DATASET_KEYS: DatasetKey[] = [
  "starter",
  "bullpen",
  "travel",
];

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function assessStarterRows(rows: unknown[]): CollectionStatus {
  if (rows.length === 0) return "NOT_COLLECTED";
  let complete = rows.length >= 2;
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) {
      complete = false;
      continue;
    }
    const jq = asString(r.joinQuality);
    const pid = asNumber(r.probablePitcherId);
    const missing = Array.isArray(r.missing) ? r.missing.length : 0;
    if (jq !== "MATCHED" || pid == null || missing > 0) complete = false;
  }
  if (rows.length < 2) return "PARTIAL";
  return complete ? "COMPLETE" : "PARTIAL";
}

export function assessBullpenGame(
  game: Record<string, unknown> | null,
): CollectionStatus {
  if (!game) return "NOT_COLLECTED";
  const role = asString(game.overallRoleComparison);
  if (!role) return "PARTIAL";
  return "COMPLETE";
}

export function assessLineupRows(rows: unknown[]): CollectionStatus {
  if (rows.length === 0) return "NOT_COLLECTED";
  let allComplete = rows.length >= 2;
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) {
      allComplete = false;
      continue;
    }
    if (asString(r.lineupStatus) !== "COMPLETE") allComplete = false;
    if (asString(r.preGameStatus) === "NOT_COLLECTED") allComplete = false;
  }
  if (rows.length < 2) return "PARTIAL";
  const anyComplete = rows.some(
    (raw) => asString(asRecord(raw)?.lineupStatus) === "COMPLETE",
  );
  if (!anyComplete) return "PARTIAL";
  return allComplete ? "COMPLETE" : "PARTIAL";
}

export function assessWeatherRow(
  row: Record<string, unknown> | null,
): CollectionStatus {
  if (!row) return "NOT_COLLECTED";
  const venue = asRecord(row.venue);
  const venueId = asNumber(venue?.id);
  const missing = Array.isArray(row.missing) ? row.missing.length : 0;
  const forecast = asRecord(row.forecast);
  const forecastCollected =
    forecast &&
    Object.values(forecast).some((v) => v !== "NOT_COLLECTED" && v != null);
  if (venueId == null || venueId <= 0) return "PARTIAL";
  if (missing > 0 || !forecastCollected) return "PARTIAL";
  return "COMPLETE";
}

export function assessTravelRows(rows: unknown[]): CollectionStatus {
  if (rows.length === 0) return "NOT_COLLECTED";
  let complete = rows.length >= 2;
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) {
      complete = false;
      continue;
    }
    if (asString(r.joinQuality) !== "MATCHED") complete = false;
    const missing = Array.isArray(r.missing) ? r.missing.length : 0;
    if (missing > 0) complete = false;
  }
  if (rows.length < 2) return "PARTIAL";
  return complete ? "COMPLETE" : "PARTIAL";
}

export function assessOddsRow(row: Record<string, unknown> | null): CollectionStatus {
  if (!row) return "NOT_COLLECTED";
  const opening = asNumber(row.openingOdds);
  const latest = asNumber(row.latestOdds);
  const market = asNumber(row.marketProbability);
  if (opening != null && latest != null && market != null) return "COMPLETE";
  if (market != null || opening != null || latest != null) return "PARTIAL";
  return "PARTIAL";
}

export function assessInjuryRows(
  rows: unknown[],
  starterStatus: CollectionStatus,
): CollectionStatus {
  if (starterStatus === "NOT_COLLECTED") return "NOT_COLLECTED";
  if (rows.length === 0) return "COMPLETE";
  let partial = false;
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) continue;
    const warnings = Array.isArray(r.warnings) ? r.warnings.length : 0;
    const missing = Array.isArray(r.missing) ? r.missing.length : 0;
    if (warnings > 0 || missing > 0) partial = true;
  }
  return partial ? "PARTIAL" : "COMPLETE";
}

export function hasStarterIdentity(rows: unknown[]): boolean {
  if (rows.length === 0) return false;
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) continue;
    const pid = asNumber(r.probablePitcherId);
    const jq = asString(r.joinQuality);
    if (pid != null && jq === "MATCHED") return true;
  }
  return false;
}

export function missingReasonForDataset(
  key: DatasetKey,
  status: CollectionStatus,
): string | null {
  if (status === "COMPLETE") return null;
  const prefix = key.toUpperCase();
  if (status === "NOT_COLLECTED") {
    if (key === "weather") return "WEATHER_NOT_COLLECTED";
    if (key === "lineup") return "LINEUP_NOT_COLLECTED";
    return `${prefix}_NOT_COLLECTED`;
  }
  if (key === "lineup") return "LINEUP_PARTIAL";
  if (key === "weather") return "WEATHER_PARTIAL";
  if (key === "injury") return "INJURY_PARTIAL";
  if (key === "odds") return "ODDS_PARTIAL";
  return `${prefix}_PARTIAL`;
}

export function selectionReasonForDataset(
  key: DatasetKey,
  status: CollectionStatus,
): string | null {
  if (status !== "COMPLETE") return null;
  const map: Record<DatasetKey, string> = {
    starter: "STARTER_COMPLETE",
    bullpen: "BULLPEN_COMPLETE",
    lineup: "LINEUP_COMPLETE",
    weather: "WEATHER_COMPLETE",
    travel: "TRAVEL_COMPLETE",
    odds: "ODDS_COMPLETE",
    injury: "INJURY_COMPLETE",
  };
  return map[key];
}
