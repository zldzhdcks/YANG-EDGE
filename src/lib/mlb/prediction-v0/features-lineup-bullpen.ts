/**
 * Lineup / bullpen features — performance weights disabled in v0.
 */
import type {
  BullpenFeature,
  FeatureProvenance,
  LineupFeature,
} from "./types";

export function buildLineupFeature(args: {
  confirmed: boolean;
  homeSlots: number;
  awaySlots: number;
  provenance: FeatureProvenance;
}): LineupFeature {
  const completeness =
    args.confirmed && args.homeSlots >= 9 && args.awaySlots >= 9
      ? 1
      : args.confirmed
        ? Math.min(1, (args.homeSlots + args.awaySlots) / 18)
        : 0;
  const warnings = [...args.provenance.warning];
  if (!args.confirmed) warnings.push("LINEUP_NOT_CONFIRMED");
  return {
    confirmed: args.confirmed,
    completeness,
    missingCoreHitters: 0,
    performanceEdgeWeight: 0,
    provenance: { ...args.provenance, warning: warnings },
  };
}

export function buildDisabledBullpenFeature(
  provenance: FeatureProvenance,
): BullpenFeature {
  return {
    score: 50,
    dataQuality: "DISABLED",
    edge: 0,
    provenance: {
      ...provenance,
      warning: [
        ...provenance.warning,
        "BULLPEN_WEIGHT_DISABLED_V0",
      ],
    },
  };
}
