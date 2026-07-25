import type { FootballUsageMeta } from "./types";

export function emptyFootballUsage(): FootballUsageMeta {
  return {
    requestsRemaining: null,
    requestsLimit: null,
  };
}

/** API-Sports / API-Football 응답 헤더에서 사용량 파싱 */
export function parseFootballUsageHeaders(headers: Headers): FootballUsageMeta {
  const num = (...names: string[]): number | null => {
    for (const name of names) {
      const raw = headers.get(name);
      if (raw == null || raw === "") continue;
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };

  return {
    requestsRemaining: num(
      "x-ratelimit-requests-remaining",
      "x-apisports-requests-remaining",
      "x-ratelimit-remaining",
    ),
    requestsLimit: num(
      "x-ratelimit-requests-limit",
      "x-apisports-requests-limit",
      "x-ratelimit-limit",
    ),
  };
}

export class FootballApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "FootballApiError";
    this.status = status;
    this.path = path;
  }
}
