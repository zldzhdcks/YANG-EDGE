/**
 * SportsDataIO HTTP 공통 계층.
 * Base: https://api.sportsdata.io/v3/mlb
 * Header: Ocp-Apim-Subscription-Key
 *
 * 로그에 API 키를 절대 출력하지 않는다.
 */

import type { SportsDataRateLimitMeta, SportsDataRequestMeta } from "./types";

export const SPORTSDATAIO_DEFAULT_BASE_URL =
  "https://api.sportsdata.io/v3/mlb";

export class SportsDataApiError extends Error {
  readonly status: number;
  readonly path: string;
  /** Trial/플랜에서 막힌 경우 true */
  readonly unsupported: boolean;
  readonly elapsedMs: number;
  readonly rateLimit: SportsDataRateLimitMeta;

  constructor(input: {
    message: string;
    status: number;
    path: string;
    unsupported: boolean;
    elapsedMs: number;
    rateLimit: SportsDataRateLimitMeta;
  }) {
    super(input.message);
    this.name = "SportsDataApiError";
    this.status = input.status;
    this.path = input.path;
    this.unsupported = input.unsupported;
    this.elapsedMs = input.elapsedMs;
    this.rateLimit = input.rateLimit;
  }
}

export type SportsDataHttpResult<T> = {
  data: T;
  meta: SportsDataRequestMeta;
};

function maskSecrets(text: string): string {
  return text
    .replace(/Ocp-Apim-Subscription-Key:\s*\S+/gi, "Ocp-Apim-Subscription-Key: ***")
    .replace(/subscription-key=[^&\s]+/gi, "subscription-key=***")
    .replace(/api[_-]?key=[^&\s]+/gi, "api_key=***");
}

export function parseRateLimitHeaders(headers: Headers): SportsDataRateLimitMeta {
  const raw: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower.includes("rate") ||
      lower.includes("limit") ||
      lower.includes("quota") ||
      lower.startsWith("x-ms-")
    ) {
      raw[key] = value;
    }
  });

  const pick = (...names: string[]): string | null => {
    for (const name of names) {
      const value = headers.get(name);
      if (value != null && value !== "") return value;
    }
    return null;
  };

  return {
    remaining: pick(
      "x-ms-ratelimit-remaining",
      "x-ratelimit-remaining",
      "ratelimit-remaining",
    ),
    limit: pick(
      "x-ms-ratelimit-limit",
      "x-ratelimit-limit",
      "ratelimit-limit",
    ),
    reset: pick(
      "x-ms-ratelimit-reset",
      "x-ratelimit-reset",
      "ratelimit-reset",
    ),
    raw,
  };
}

function isUnsupportedStatus(status: number, bodyText: string): boolean {
  if (status === 401 || status === 403 || status === 402) return true;
  if (status === 404) return true;
  const lower = bodyText.toLowerCase();
  return (
    lower.includes("not entitled") ||
    lower.includes("not subscribed") ||
    lower.includes("access denied") ||
    lower.includes("trial") ||
    lower.includes("subscription") ||
    lower.includes("upgrade") ||
    lower.includes("does not have access")
  );
}

export class SportsDataHttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey.trim();
  }

  async getJson<T>(
    path: string,
    options?: { cached?: boolean },
  ): Promise<SportsDataHttpResult<T>> {
    const cleaned = path.startsWith("/") ? path : `/${path}`;
    const url = `${this.baseUrl}${cleaned}`;
    const started = Date.now();

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Ocp-Apim-Subscription-Key": this.apiKey,
        },
        cache: "no-store",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Network request failed";
      throw new SportsDataApiError({
        message: maskSecrets(message),
        status: 0,
        path: cleaned,
        unsupported: false,
        elapsedMs: Date.now() - started,
        rateLimit: { remaining: null, limit: null, reset: null, raw: {} },
      });
    }

    const elapsedMs = Date.now() - started;
    const rateLimit = parseRateLimitHeaders(response.headers);
    const meta: SportsDataRequestMeta = {
      path: cleaned,
      httpStatus: response.status,
      elapsedMs,
      rateLimit,
      cached: options?.cached ?? false,
    };

    if (!response.ok) {
      let bodyText = "";
      try {
        bodyText = await response.text();
      } catch {
        bodyText = "";
      }
      const unsupported = isUnsupportedStatus(response.status, bodyText);
      const detail = maskSecrets(
        bodyText.slice(0, 240) || response.statusText || "Unknown error",
      );
      throw new SportsDataApiError({
        message: unsupported
          ? "지원 안됨"
          : `SportsDataIO GET ${cleaned} failed (${response.status}): ${detail}`,
        status: response.status,
        path: cleaned,
        unsupported,
        elapsedMs,
        rateLimit,
      });
    }

    const data = (await response.json()) as T;
    return { data, meta };
  }
}
