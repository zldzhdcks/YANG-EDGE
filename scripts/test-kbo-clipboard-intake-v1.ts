/**
 * Clipboard intake unit tests — paste extract, preflight, object URL lifecycle mock.
 * No operational artifact writes.
 */
import assert from "node:assert/strict";
import {
  extractClipboardIntakeFromDataTransfer,
  preflightClipboardQueueLimits,
  preflightClipboardImageMime,
  CLIPBOARD_INTAKE_LIMITS,
} from "../src/lib/clipboard-intake";
import {
  analyzeCancellationAndMarket,
  detectCancellationSignals,
  detectMarketKind,
} from "../src/lib/kbo/proto-ocr/cancellation-market";
import { parseProtoCandidatesFromText } from "../src/lib/kbo/proto-ocr/parse-candidates";

/** Minimal DataTransfer stand-in for unit tests. */
function mockDataTransfer(opts: {
  files?: Array<{ type: string; name?: string; blob?: Blob }>;
  items?: Array<{ kind: string; type: string; file?: File | null }>;
  text?: string;
}): DataTransfer {
  const fileArr: File[] = (opts.files ?? []).map(
    (f) =>
      new File([f.blob ?? new Uint8Array([0x89, 0x50])], f.name ?? "x.png", {
        type: f.type,
      }),
  );

  const items = (opts.items ?? []).map((it) => ({
    kind: it.kind,
    type: it.type,
    getAsFile: () => it.file ?? null,
  }));

  return {
    items: {
      length: items.length,
      [Symbol.iterator]: function* () {
        for (const it of items) yield it;
      },
    },
    files: {
      length: fileArr.length,
      item: (i: number) => fileArr[i] ?? null,
      *[Symbol.iterator]() {
        for (const f of fileArr) yield f;
      },
    },
    getData: (type: string) =>
      type === "text/plain" ? opts.text ?? "" : "",
  } as unknown as DataTransfer;
}

async function main() {
  // --- paste image/png ---
  const pngFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "clip.png", {
    type: "image/png",
  });
  const pngPaste = extractClipboardIntakeFromDataTransfer(
    mockDataTransfer({
      items: [{ kind: "file", type: "image/png", file: pngFile }],
    }),
  );
  assert.equal(pngPaste.images.length, 1);
  assert.equal(pngPaste.images[0]!.mimeType, "image/png");
  assert.equal(pngPaste.empty, false);

  // --- jpeg ---
  const jpegFile = new File([new Uint8Array([0xff, 0xd8, 0xff])], "a.jpg", {
    type: "image/jpeg",
  });
  const jpegPaste = extractClipboardIntakeFromDataTransfer(
    mockDataTransfer({
      items: [{ kind: "file", type: "image/jpeg", file: jpegFile }],
    }),
  );
  assert.equal(jpegPaste.images.length, 1);

  // --- pasted text ---
  const textPaste = extractClipboardIntakeFromDataTransfer(
    mockDataTransfer({ text: "LG 1.75 두산 1.77" }),
  );
  assert.equal(textPaste.images.length, 0);
  assert.equal(textPaste.pastedText, "LG 1.75 두산 1.77");

  // --- mixed ---
  const mixed = extractClipboardIntakeFromDataTransfer(
    mockDataTransfer({
      items: [{ kind: "file", type: "image/png", file: pngFile }],
      text: "키움 1.90 SSG 1.65",
    }),
  );
  assert.equal(mixed.images.length, 1);
  assert.ok(mixed.pastedText?.includes("키움"));

  // --- unsupported ---
  const bad = extractClipboardIntakeFromDataTransfer(
    mockDataTransfer({
      items: [{ kind: "file", type: "image/svg+xml", file: null }],
    }),
  );
  assert.ok(bad.unsupportedKinds.some((k) => k.includes("UNSUPPORTED")));

  // --- no data ---
  const empty = extractClipboardIntakeFromDataTransfer(null);
  assert.equal(empty.empty, true);
  assert.ok(empty.unsupportedKinds.includes("NO_CLIPBOARD_DATA"));

  // --- multiple images via files fallback ---
  const multi = extractClipboardIntakeFromDataTransfer(
    mockDataTransfer({
      files: [
        { type: "image/png", name: "a.png" },
        { type: "image/jpeg", name: "b.jpg" },
      ],
    }),
  );
  assert.equal(multi.images.length, 2);

  // --- MIME preflight ---
  assert.equal(preflightClipboardImageMime("image/png").ok, true);
  assert.equal(preflightClipboardImageMime("image/svg+xml").ok, false);

  // --- queue limits ---
  const tooMany = preflightClipboardQueueLimits({
    existingCount: CLIPBOARD_INTAKE_LIMITS.maxImages,
    existingTotalBytes: 0,
    incoming: [{ sizeBytes: 100 }],
  });
  assert.equal(tooMany.ok, false);
  if (!tooMany.ok) assert.equal(tooMany.errorCode, "IMAGE_TOO_MANY");

  const tooLarge = preflightClipboardQueueLimits({
    existingCount: 0,
    existingTotalBytes: 0,
    incoming: [{ sizeBytes: CLIPBOARD_INTAKE_LIMITS.maxBytesPerImage + 1 }],
  });
  assert.equal(tooLarge.ok, false);

  const totalExceed = preflightClipboardQueueLimits({
    existingCount: 0,
    existingTotalBytes: CLIPBOARD_INTAKE_LIMITS.maxBytesTotal - 10,
    incoming: [{ sizeBytes: 20 }],
  });
  assert.equal(totalExceed.ok, false);

  // --- object URL lifecycle mock ---
  const created: string[] = [];
  const revoked: string[] = [];
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;
  let seq = 0;
  URL.createObjectURL = (() => {
    const u = `blob:mock-${++seq}`;
    created.push(u);
    return u;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = ((u: string) => {
    revoked.push(u);
  }) as typeof URL.revokeObjectURL;
  try {
    const u1 = URL.createObjectURL(new Blob());
    const u2 = URL.createObjectURL(new Blob());
    URL.revokeObjectURL(u1);
    URL.revokeObjectURL(u2);
    assert.equal(created.length, 2);
    assert.deepEqual(revoked, created);
  } finally {
    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
  }

  // --- cancellation / market ---
  assert.equal(
    detectCancellationSignals("롯데 vs 삼성 폭염 취소"),
    "CANCELLATION_SUSPECTED",
  );
  assert.equal(detectCancellationSignals("경기 연기"), "POSTPONEMENT_SUSPECTED");
  assert.equal(
    detectCancellationSignals("1.00 / 1.00"),
    "VOID_DISPLAY_VALUE_SUSPECTED",
  );
  assert.equal(detectMarketKind("핸디캡 -1.5"), "HANDICAP");
  assert.equal(detectMarketKind("언더/오버 8.5"), "UNDER_OVER");
  assert.equal(detectMarketKind("승1패"), "WIN_DRAW_WIN");

  const voidSig = analyzeCancellationAndMarket("롯데 1.00 삼성 1.00");
  assert.equal(voidSig.cancellationStatus, "VOID_DISPLAY_VALUE_SUSPECTED");
  assert.equal(voidSig.saveAllowed, false);
  assert.ok(voidSig.warnings.includes("VOID_1_00_NOT_AUTO_CANCEL"));

  const handi = analyzeCancellationAndMarket("LG 핸디캡 1.85 두산 1.95");
  assert.equal(handi.marketKind, "HANDICAP");
  assert.ok(handi.warnings.includes("DETECTED_UNSUPPORTED_MARKET"));
  assert.equal(handi.saveAllowed, false);

  const cancelCand = parseProtoCandidatesFromText({
    rawText: "롯데 삼성 경기취소",
    sourceImageId: "c1",
  });
  assert.ok(cancelCand.length >= 1);
  assert.equal(cancelCand[0]!.cancellationSuspect, "CANCELLATION_SUSPECTED");
  assert.equal(cancelCand[0]!.awayPriceCandidate, null);

  console.log("test:kbo-clipboard-intake OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
