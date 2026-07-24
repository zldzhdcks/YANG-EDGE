import type { ApiError } from "./client";

/** 요청 결과 상태 (loading은 UI 레이어에서 처리) */
export type ApiFetchStatus = "success" | "error";

/**
 * 클라이언트 UI용 비동기 상태.
 * - loading: 요청 전/중 (EdgeEngineLoader, Suspense 등)
 * - success / error: ApiFetchResult.status 와 대응
 */
export type AsyncUiStatus = "idle" | "loading" | "success" | "error";

/**
 * 데이터 출처
 * - external-api: NEXT_PUBLIC_API_BASE_URL
 * - internal-api: 앱 /api/* 라우트
 * - dummy: constants 폴백
 */
export type ApiDataSource = "external-api" | "internal-api" | "dummy";

export type ApiFetchError = {
  message: string;
  statusCode: number;
  path?: string;
};

/**
 * API fetch 표준 반환 타입.
 * - success + external-api | internal-api | dummy
 * - error + dummy: 상위 소스 실패 후 constants 폴백 (화면 data 유지)
 */
export type ApiFetchResult<T> = {
  data: T;
  status: ApiFetchStatus;
  source: ApiDataSource;
  error?: ApiFetchError;
};

export function toApiFetchError(error: unknown, path?: string): ApiFetchError {
  if (error instanceof Error && "status" in error && "path" in error) {
    const apiError = error as ApiError;
    return {
      message: apiError.message,
      statusCode: apiError.status,
      path: apiError.path || path,
    };
  }

  return {
    message: error instanceof Error ? error.message : "Unknown API error",
    statusCode: 0,
    path,
  };
}

export function successResult<T>(
  data: T,
  source: ApiDataSource,
): ApiFetchResult<T> {
  return { data, status: "success", source };
}

export function fallbackResult<T>(
  data: T,
  error: unknown,
  path?: string,
): ApiFetchResult<T> {
  return {
    data,
    status: "error",
    source: "dummy",
    error: toApiFetchError(error, path),
  };
}

export function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "status" in error &&
    (error as ApiError).status === 404
  );
}
