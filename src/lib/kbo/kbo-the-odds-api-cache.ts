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
    "the-odds-api",
    `${safe}.json`,
  );
}

export async function getKboTheOddsApiJson(
  cacheKey: string,
  url: string,
  usage: KboCacheUsageStats,
  cwd?: string,
): Promise<unknown> {
  const file = rawCachePath(cacheKey, cwd);
  try {
    const raw = await readFile(file, "utf8");
    usage.rawHit += 1;
    const parsed = JSON.parse(raw) as { body?: unknown };
    return parsed.body ?? parsed;
  } catch {
    usage.rawMiss += 1;
    usage.networkCalls += 1;
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`The Odds API ${response.status} ${url}`);
    }
    const body = await response.json();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `${JSON.stringify(
        {
          meta: {
            source: "INTERNAL_RESEARCH_ONLY",
            provider: "THE_ODDS_API",
            url,
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
