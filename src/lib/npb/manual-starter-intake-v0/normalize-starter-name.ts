/**
 * Preserve Japanese original names; build stable normalized keys.
 * Never invent providerPlayerId.
 */
import type { NpbStarterHandedness, NpbStarterSideV1 } from "./types";

export function normalizeNpbStarterName(originalName: string): string {
  return originalName
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** team + originalName stable key — for homonym disambiguation, not a provider ID. */
export function buildNpbStarterNormalizedKey(input: {
  teamCanonicalId: string | null;
  teamName: string;
  originalName: string;
}): string {
  const team =
    (input.teamCanonicalId ?? input.teamName)
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}-]+/gu, "") || "team";
  const name = normalizeNpbStarterName(input.originalName)
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}.\-]+/gu, "");
  return `${team}::${name}`;
}

export function buildNpbStarterSide(input: {
  originalName: string;
  displayName?: string | null;
  handedness?: NpbStarterHandedness | null;
  teamCanonicalId: string | null;
  teamName: string;
}): NpbStarterSideV1 | null {
  const originalName = input.originalName.normalize("NFKC").trim();
  if (!originalName) return null;
  const displayName =
    (input.displayName ?? "").trim() || originalName;
  return {
    displayName,
    originalName,
    normalizedName: buildNpbStarterNormalizedKey({
      teamCanonicalId: input.teamCanonicalId,
      teamName: input.teamName,
      originalName,
    }),
    handedness: input.handedness ?? "UNKNOWN",
    providerPlayerId: null,
    verificationStatus: "CONFIRMED",
    sourceType: "MANUAL_VERIFIED",
  };
}
