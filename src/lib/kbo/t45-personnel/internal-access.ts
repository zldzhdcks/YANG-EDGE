/**
 * Soft internal access gate for KBO T45 admin APIs.
 * Real auth is out of scope; production requires INTERNAL_ADMIN_TOKEN.
 */
import { NextResponse } from "next/server";

export function assertInternalKboT45Access(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
): NextResponse | null {
  const token = env.INTERNAL_ADMIN_TOKEN?.trim();
  if (token) {
    const header =
      request.headers.get("x-internal-token") ??
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      "";
    if (header !== token) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "INTERNAL_AUTH_REQUIRED",
          message:
            "Internal admin token required. Auth system is not fully implemented; do not expose publicly.",
        },
        { status: 401 },
      );
    }
    return null;
  }

  if (env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "INTERNAL_AUTH_NOT_CONFIGURED",
        message:
          "INTERNAL_ADMIN_TOKEN is unset in production. Refusing public access to T45 admin APIs.",
      },
      { status: 403 },
    );
  }

  return null;
}

export const DATE_KST_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertSafeDateKst(
  dateKst: unknown,
): { ok: true; dateKst: string } | { ok: false; error: string } {
  if (typeof dateKst !== "string" || !DATE_KST_RE.test(dateKst)) {
    return { ok: false, error: "INVALID_DATE_KST" };
  }
  return { ok: true, dateKst };
}
