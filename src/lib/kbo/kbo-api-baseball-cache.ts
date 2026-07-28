import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createKboCacheUsage,
  type KboCacheUsageStats,
} from "./kbo-cache-types";
import { kboResearchCacheRoot } from "./kbo-thesportsdb-cache";

export { createKboCacheUsage };
export type { KboCacheUsageStats };

function rawCachePath(cacheKey: string, cwd?: string): string {
  const safe = cacheKey.replace(/[^a-zA-Z0-9._\-/]/g, "_");
  return path.join(
    kboResearchCacheRoot(cwd),
    "raw",
    "api-baseball",
    `${safe}.json`,
  );
}

export type KboApiBaseballFetchConfig = {
  baseUrl: string;
  apiKey: string;
};

export async function getKboApiBaseballJson(
  endpointAndQuery: string,
  usage: KboCacheUsageStats,
  config: KboApiBaseballFetchConfig,
  cwd?: string,
  options: { forceRefresh?: boolean } = {},
): Promise<unknown> {
  const cacheKey = endpointAndQuery.replace(/^\//, "").replace(/[?&=]/g, "_");
  const file = rawCachePath(cacheKey, cwd);

  if (!options.forceRefresh) {
    try {
      const raw = await readFile(file, "utf8");
      usage.rawHit += 1;
      const parsed = JSON.parse(raw) as { body?: unknown };
      return parsed.body ?? parsed;
    } catch {
      // miss → network
    }
  }

  usage.rawMiss += 1;
  usage.networkCalls += 1;

  const cleaned = endpointAndQuery.replace(/^\//, "");
  const url = `${config.baseUrl.replace(/\/$/, "")}/${cleaned}`;
  const response = await fetch(url, {
    headers: { "x-apisports-key": config.apiKey.trim() },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`API-BASEBALL ${response.status} ${cleaned}`);
  }
  const body = await response.json();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    `${JSON.stringify(
      {
        meta: {
          source: "INTERNAL_RESEARCH_ONLY",
          provider: "API_BASEBALL",
          endpoint: cleaned,
          fetchedAt: new Date().toISOString(),
          publicRuntimeUseAllowed: false,
          commercialRuntimeUseAllowed: false,
        },
        body,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  return body;
}
