import { getKstDateString } from "@/lib/datetime/kst";

/**
 * True when the timestamp's Asia/Seoul calendar date equals dateKst.
 * Example: 2026-09-18T16:00:00Z → 2026-09-19 KST → valid for 2026-09-19.
 */
export function scheduledStartRepresentsDateKst(
  scheduledStart: string,
  dateKst: string,
): boolean {
  if (typeof scheduledStart !== "string" || scheduledStart.trim() === "") {
    return false;
  }
  const instant = new Date(scheduledStart);
  if (Number.isNaN(instant.getTime())) return false;
  return getKstDateString(instant) === dateKst;
}

export function isValidIsoTimestamp(value: string): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;
  return Number.isFinite(Date.parse(value));
}
