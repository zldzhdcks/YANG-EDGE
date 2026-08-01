import { NextRequest, NextResponse } from "next/server";
import {
  assertInternalKboT45Access,
  assertSafeDateKst,
} from "@/lib/kbo/t45-personnel/internal-access";
import {
  extractProtoOcrFromImages,
  extractProtoOcrFromPasteText,
} from "@/lib/kbo/proto-ocr/extract-service";

export const dynamic = "force-dynamic";

/** POST /api/internal/kbo/proto-ocr/extract — multipart images OR JSON pasteText */
export async function POST(request: NextRequest) {
  const denied = assertInternalKboT45Access(request);
  if (denied) return denied;

  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        dateKst?: string;
        pasteText?: string;
        allowCommaAsDecimal?: boolean;
      };
      const dateCheck = assertSafeDateKst(body.dateKst ?? "");
      if (!dateCheck.ok) {
        return NextResponse.json(
          { ok: false, errorCode: dateCheck.error },
          { status: 400 },
        );
      }
      if (typeof body.pasteText !== "string") {
        return NextResponse.json(
          { ok: false, errorCode: "PASTE_TEXT_REQUIRED" },
          { status: 400 },
        );
      }
      const result = await extractProtoOcrFromPasteText({
        dateKst: dateCheck.dateKst,
        text: body.pasteText,
        allowCommaAsDecimal: body.allowCommaAsDecimal ?? true,
      });
      return NextResponse.json(result);
    }

    const form = await request.formData();
    const dateRaw = String(form.get("dateKst") ?? "");
    const dateCheck = assertSafeDateKst(dateRaw);
    if (!dateCheck.ok) {
      return NextResponse.json(
        { ok: false, errorCode: dateCheck.error },
        { status: 400 },
      );
    }

    const files: Array<{ bytes: Uint8Array; mimeType?: string; filename?: string }> =
      [];
    for (const [key, value] of form.entries()) {
      if (key !== "images" && key !== "image") continue;
      if (typeof value === "string") continue;
      const file = value as File;
      const ab = await file.arrayBuffer();
      files.push({
        bytes: new Uint8Array(ab),
        mimeType: file.type || undefined,
        filename: file.name,
      });
    }

    if (files.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          errorCode: "NO_IMAGES",
          message: "No images — use pasteText JSON or attach images",
        },
        { status: 400 },
      );
    }

    const result = await extractProtoOcrFromImages({
      dateKst: dateCheck.dateKst,
      files,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        errorCode: "OCR_PROVIDER_ERROR",
        message: e instanceof Error ? e.message : String(e),
        mutationPerformed: false,
      },
      { status: 500 },
    );
  }
}
