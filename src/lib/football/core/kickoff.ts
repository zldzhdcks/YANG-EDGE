import { getKstDateString } from "@/lib/datetime/kst";

const CANONICAL_UTC_ISO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function isCanonicalUtcIso(value: string): boolean {
  return CANONICAL_UTC_ISO.test(value);
}

/**
 * Parse a provider ISO timestamp (offset allowed) and store UTC `toISOString()`.
 * Does not guess or repair invalid strings.
 */
export function canonicalizeKickoffTimeUtc(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("FIXTURE_KICKOFF_INVALID");
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("FIXTURE_KICKOFF_INVALID");
  }
  return parsed.toISOString();
}

export function assertKickoffMatchesDateKst(
  kickoffTimeUtc: string,
  dateKst: string,
): void {
  const calculatedDateKst = getKstDateString(new Date(kickoffTimeUtc));
  if (calculatedDateKst !== dateKst) {
    throw new Error(
      `FIXTURE_DATE_KST_MISMATCH: calculated=${calculatedDateKst} requested=${dateKst}`,
    );
  }
}

/** Missing kickoff → null. Invalid kickoff → throw. Valid → UTC ISO + KST check. */
export function resolveFixtureKickoffUtc(input: {
  rawDate: string | null | undefined;
  dateKst: string;
  fixtureId?: string;
}): string | null {
  const raw = input.rawDate?.trim() ?? "";
  if (!raw) return null;
  try {
    const utc = canonicalizeKickoffTimeUtc(raw);
    assertKickoffMatchesDateKst(utc, input.dateKst);
    return utc;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const suffix = input.fixtureId ? `: fixture=${input.fixtureId}` : "";
    if (msg.startsWith("FIXTURE_KICKOFF_INVALID")) {
      throw new Error(`FIXTURE_KICKOFF_INVALID${suffix}`);
    }
    if (msg.startsWith("FIXTURE_DATE_KST_MISMATCH")) {
      throw new Error(`${msg}${suffix}`);
    }
    throw err;
  }
}
