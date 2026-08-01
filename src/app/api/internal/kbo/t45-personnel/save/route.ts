import { NextRequest, NextResponse } from "next/server";
import { saveKboT45AdminInput } from "@/lib/kbo/t45-personnel/admin-api";
import { assertInternalKboT45Access } from "@/lib/kbo/t45-personnel/internal-access";

export const dynamic = "force-dynamic";

/** POST /api/internal/kbo/t45-personnel/save — server revalidation + operator input write */
export async function POST(request: NextRequest) {
  const denied = assertInternalKboT45Access(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "MALFORMED_JSON",
        message: "Malformed JSON",
        mutationPerformed: false,
      },
      { status: 400 },
    );
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const payload = "payload" in obj ? obj.payload : body;
  const adminId =
    typeof obj.adminId === "string" && obj.adminId.trim()
      ? obj.adminId.trim().slice(0, 64)
      : "admin-ui";

  // Reject client-supplied file paths entirely
  if (
    obj.inputPath != null ||
    obj.path != null ||
    obj.filePath != null ||
    (payload &&
      typeof payload === "object" &&
      ("inputPath" in (payload as object) || "path" in (payload as object)))
  ) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "ARBITRARY_PATH_BLOCKED",
        message: "Client must not supply file paths",
        mutationPerformed: false,
      },
      { status: 400 },
    );
  }

  const result = await saveKboT45AdminInput({ payload, adminId });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
