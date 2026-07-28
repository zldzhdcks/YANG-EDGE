/**
 * KBO TheSportsDB 연구용 raw disk cache.
 *
 * source = INTERNAL_RESEARCH_ONLY
 * 공개·상업 런타임 연결 금지.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createKboCacheUsage,
  type KboCacheUsageStats,
} from "./kbo-cache-types";

export type { KboCacheUsageStats };
export { createKboCacheUsage };

export function kboResearchCacheRoot(cwd = process.cwd()): string {
  return path.join(cwd, "data", "cache", "research", "kbo");
}

function rawCachePath(cacheKey: string, cwd?: string): string {
  const safe = cacheKey.replace(/[^a-zA-Z0-9._\-/]/g, "_");
  return path.join(kboResearchCacheRoot(cwd), "raw", "thesportsdb", `${safe}.json`);
}

export type KboTheSportsDbFetchConfig = {
  baseUrl: string;
  apiKey: string;
};

export async function getKboTheSportsDbJson(
  endpointAndQuery: string,
  usage: KboCacheUsageStats,
  config: KboTheSportsDbFetchConfig,
  cwd?: string,
): Promise<unknown> {
  const cacheKey = endpointAndQuery.replace(/^\//, "").replace(/[?&=]/g, "_");
  const file = rawCachePath(cacheKey, cwd);

  try {
    const raw = await readFile(file, "utf8");
    usage.rawHit += 1;
    const parsed = JSON.parse(raw) as { body?: unknown };
    return parsed.body ?? parsed;
  } catch {
    usage.rawMiss += 1;
    usage.networkCalls += 1;

    const cleaned = endpointAndQuery.replace(/^\//, "");
    const url = `${config.baseUrl.replace(/\/$/, "")}/${config.apiKey.trim()}/${cleaned}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Network request failed";
      throw new Error(`TheSportsDB fetch failed: ${message}`);
    }

    if (!response.ok) {
      throw new Error(`TheSportsDB ${response.status} ${cleaned}`);
    }

    const body = await response.json();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `${JSON.stringify(
        {
          meta: {
            source: "INTERNAL_RESEARCH_ONLY",
            provider: "THESPORTSDB",
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
}
