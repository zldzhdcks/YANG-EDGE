/**
 * KBO research raw cache usage stats (provider-neutral).
 */
export type KboCacheUsageStats = {
  rawHit: number;
  rawMiss: number;
  networkCalls: number;
};

export function createKboCacheUsage(): KboCacheUsageStats {
  return { rawHit: 0, rawMiss: 0, networkCalls: 0 };
}
