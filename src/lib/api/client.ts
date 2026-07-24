/**
 * YANG EDGE API Client
 *
 * 데이터 우선순위:
 * 1. external-api  — NEXT_PUBLIC_API_BASE_URL (공개 베이스 URL만. 비밀키 금지)
 * 2. internal-api  — 같은 앱의 /api/* 라우트
 * 3. dummy         — constants 폴백
 *
 * 보안:
 * - 외부 스포츠 API 키, 시크릿은 절대 NEXT_PUBLIC_* 에 넣지 않는다.
 * - 비밀값은 서버 전용 환경변수(예: SPORTS_API_KEY)로만 두고
 *   Route Handler(/api/*) 또는 서버 코드에서만 사용한다.
 */

export const EXTERNAL_API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
)
  .trim()
  .replace(/\/$/, "");

/** @deprecated hasExternalApiBaseUrl 사용 */
export const API_BASE_URL = EXTERNAL_API_BASE_URL;

export function hasExternalApiBaseUrl(): boolean {
  return EXTERNAL_API_BASE_URL.length > 0;
}

/** @deprecated hasExternalApiBaseUrl 사용 */
export function hasApiBaseUrl(): boolean {
  return hasExternalApiBaseUrl();
}

/**
 * 서버에서 자기 자신 /api 를 호출할 때 쓰는 베이스 URL.
 * SITE_URL(서버 전용) → VERCEL_URL → localhost
 */
export function getInternalAppBaseUrl(): string {
  const siteUrl = (process.env.SITE_URL ?? "").trim().replace(/\/$/, "");
  if (siteUrl) return siteUrl;

  const vercelUrl = (process.env.VERCEL_URL ?? "").trim().replace(/\/$/, "");
  if (vercelUrl) {
    return vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
  }

  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
  }
}

function joinUrl(base: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base.replace(/\/$/, "")}${normalizedPath}`;
}

type ApiGetOptions = {
  /** 요청 베이스. 없으면 EXTERNAL_API_BASE_URL */
  baseUrl?: string;
  /** Next fetch 캐시 옵션 */
  cache?: RequestCache;
  next?: { revalidate?: number | false };
};

/**
 * GET JSON 요청.
 * console에 로그하지 않는다. 호출부에서 fallback 처리.
 */
export async function apiGet<T>(
  path: string,
  options: ApiGetOptions = {},
): Promise<T> {
  const baseUrl = (options.baseUrl ?? EXTERNAL_API_BASE_URL).trim();

  if (!baseUrl) {
    throw new ApiError("API base URL is not configured", 0, path);
  }

  const url = joinUrl(baseUrl, path);

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: options.cache ?? "no-store",
      next: options.next,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Network request failed";
    throw new ApiError(message, 0, path);
  }

  if (!response.ok) {
    let detail = response.statusText || "Unknown error";

    try {
      const body = (await response.json()) as { message?: string };
      if (typeof body.message === "string" && body.message.length > 0) {
        detail = body.message;
      }
    } catch {
      // ignore
    }

    throw new ApiError(
      `API GET ${path} failed (${response.status}): ${detail}`,
      response.status,
      path,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(
      `Invalid JSON response from ${path}`,
      response.status,
      path,
    );
  }
}

/** 외부 API GET */
export async function apiGetExternal<T>(path: string): Promise<T> {
  return apiGet<T>(path, {
    baseUrl: EXTERNAL_API_BASE_URL,
    next: { revalidate: 60 },
  });
}

/** 내부 /api GET */
export async function apiGetInternal<T>(path: string): Promise<T> {
  return apiGet<T>(path, {
    baseUrl: getInternalAppBaseUrl(),
    cache: "no-store",
  });
}
