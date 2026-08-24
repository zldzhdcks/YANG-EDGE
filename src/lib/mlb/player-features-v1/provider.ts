import {
  createCacheUsage,
  getRawStatsJson,
  type CacheUsageStats,
} from "../research-stats-cache";
import type { PlayerFeatureStatLookup } from "./types";

export type PlayerFeatureQueryFamily =
  | "person"
  | "hittingGameLog"
  | "pitchingGameLog"
  | "hittingSplits";

export type ProviderFetchResult = {
  body: unknown | null;
  suppliedBy: "NETWORK" | "CACHE" | "INJECTED" | "NONE";
  query: string;
  family: PlayerFeatureQueryFamily;
};

export type PlayerFeatureProvider = {
  usage: CacheUsageStats;
  featureFetchAttempts: number;
  injectedLookups: number;
  get(
    family: PlayerFeatureQueryFamily,
    playerId: number,
    season: number,
  ): Promise<ProviderFetchResult>;
};

function queryFor(
  family: PlayerFeatureQueryFamily,
  playerId: number,
  season: number,
): string {
  if (family === "person") return `/api/v1/people/${playerId}`;
  if (family === "hittingGameLog") {
    return `/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}&sportId=1`;
  }
  if (family === "pitchingGameLog") {
    return `/api/v1/people/${playerId}/stats?stats=gameLog&group=pitching&season=${season}&sportId=1`;
  }
  return `/api/v1/people/${playerId}/stats?stats=statSplits&group=hitting&sitCodes=vl,vr&season=${season}&sportId=1`;
}

export function createPlayerFeatureProvider(input: {
  cwd: string;
  cacheOnly: boolean;
  allowFetch: boolean;
  lookup?: PlayerFeatureStatLookup;
}): PlayerFeatureProvider {
  const usage = createCacheUsage();
  const state = { featureFetchAttempts: 0, injectedLookups: 0 };
  return {
    usage,
    get featureFetchAttempts() {
      return state.featureFetchAttempts;
    },
    get injectedLookups() {
      return state.injectedLookups;
    },
    async get(family, playerId, season) {
      if (!input.allowFetch) {
        return {
          body: null,
          suppliedBy: "NONE",
          query: queryFor(family, playerId, season),
          family,
        };
      }
      state.featureFetchAttempts += 1;
      const lookupBody =
        family === "person"
          ? input.lookup?.person?.(playerId)
          : family === "hittingGameLog"
            ? input.lookup?.hittingGameLog?.(playerId)
            : family === "pitchingGameLog"
              ? input.lookup?.pitchingGameLog?.(playerId)
              : input.lookup?.hittingSplits?.(playerId);
      if (lookupBody !== undefined && lookupBody !== null) {
        state.injectedLookups += 1;
        return {
          body: lookupBody,
          suppliedBy: "INJECTED",
          query: queryFor(family, playerId, season),
          family,
        };
      }
      if (input.lookup && lookupBody === null) {
        state.injectedLookups += 1;
        return {
          body: null,
          suppliedBy: "INJECTED",
          query: queryFor(family, playerId, season),
          family,
        };
      }
      const query = queryFor(family, playerId, season);
      const networkBefore = usage.networkCalls;
      try {
        const body = await getRawStatsJson(query, usage, {
          cwd: input.cwd,
          cacheOnly: input.cacheOnly,
        });
        return {
          body,
          suppliedBy: usage.networkCalls > networkBefore ? "NETWORK" : "CACHE",
          query,
          family,
        };
      } catch {
        usage.rawMiss += 1;
        return { body: null, suppliedBy: "NONE", query, family };
      }
    },
  };
}
