/**
 * Clipboard runtime fixture QA — temp cwd only.
 * Covers paste simulation → fixture OCR → approve → audit → no T45/T30/prediction.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Module from "node:module";
import { extractClipboardIntakeFromDataTransfer } from "../src/lib/clipboard-intake";

async function main() {
  const stub = path.resolve("scripts/stub-server-only.cjs");
  const original = (
    Module as unknown as { _resolveFilename: (...a: unknown[]) => string }
  )._resolveFilename;
  (Module as unknown as { _resolveFilename: (...a: unknown[]) => string })._resolveFilename =
    function (request: unknown, ...args: unknown[]) {
      if (request === "server-only") return stub;
      return original.call(this, request, ...args);
    };

  const { extractProtoOcrFromImages } = await import(
    "../src/lib/kbo/proto-ocr/extract-service"
  );
  const { FixtureProtoOcrAdapter } = await import(
    "../src/lib/kbo/proto-ocr/adapter"
  );
  const { validateProtoOcrDraft } = await import(
    "../src/lib/kbo/proto-ocr/validate-draft"
  );
  const { approveProtoOcrDraft } = await import(
    "../src/lib/kbo/proto-ocr/approve"
  );

  // Simulate browser paste event payload
  const pngFile = new File(
    [
      Uint8Array.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
      ]),
    ],
    "clipboard.png",
    { type: "image/png" },
  );
  const pasteSim = extractClipboardIntakeFromDataTransfer({
    items: {
      length: 1,
      [Symbol.iterator]: function* () {
        yield {
          kind: "file",
          type: "image/png",
          getAsFile: () => pngFile,
        };
      },
    },
    files: { length: 0, item: () => null, *[Symbol.iterator]() {} },
    getData: () => "",
  } as unknown as DataTransfer);
  assert.equal(pasteSim.images.length, 1);

  const cwd = mkdtempSync(path.join(tmpdir(), "kbo-clipboard-rt-"));
  mkdirSync(path.join(cwd, "data/research/kbo"), { recursive: true });
  mkdirSync(path.join(cwd, "data/operator-input/kbo"), { recursive: true });
  mkdirSync(path.join(cwd, "data/audits"), { recursive: true });
  mkdirSync(path.join(cwd, "data/predictions/kbo"), { recursive: true });

  writeFileSync(
    path.join(cwd, "data/research/kbo/2026-08-06-schedule-v1.json"),
    JSON.stringify({
      schemaVersion: "kbo-schedule-v1",
      league: "KBO",
      date: "2026-08-06",
      games: [
        {
          gameId: "kbo-r1",
          home: "두산",
          away: "LG",
          scheduledStartTime: "2099-08-06T18:00:00+09:00",
        },
      ],
    }) + "\n",
  );

  const bytes = new Uint8Array(await pasteSim.images[0]!.blob.arrayBuffer());
  const extracted = await extractProtoOcrFromImages({
    dateKst: "2026-08-06",
    files: [{ bytes, mimeType: "image/png", filename: "clipboard.png" }],
    fixtureTexts: { img0: "LG 1.80 두산 1.70" },
    adapter: new FixtureProtoOcrAdapter(),
    cwd,
  });
  assert.equal(extracted.mutationPerformed, false);
  assert.ok(extracted.rows.length >= 1);
  assert.ok(extracted.imageFingerprints.length >= 1);

  const rows = extracted.rows.map((r) => ({
    ...r,
    adminDecision: "APPROVED" as const,
  }));
  const validated = await validateProtoOcrDraft({
    dateKst: "2026-08-06",
    rows,
    cwd,
    now: new Date("2099-01-01T00:00:00.000Z"),
  });

  const approved = await approveProtoOcrDraft({
    dateKst: "2026-08-06",
    ocrRunId: extracted.ocrRunId,
    approvedRows: validated.rows,
    adminId: "clipboard-runtime",
    explicitConfirmation: true,
    cwd,
    now: new Date("2099-01-01T00:00:00.000Z"),
    intakeRunId: "intake-rt",
    intakeItemIds: ["item-rt-1"],
    imageFingerprints: extracted.imageFingerprints,
    inputKind: "CLIPBOARD_IMAGE",
    extractionMethod: "OCR_ASSISTED",
  });
  assert.equal(approved.ok, true);
  assert.equal(approved.t45AutoRun, false);
  assert.equal(approved.t30AutoRun, false);
  assert.equal(
    existsSync(path.join(cwd, "data/predictions/kbo/2026-08-06.json")),
    false,
  );

  const audit = JSON.parse(
    readFileSync(
      path.join(cwd, "data/audits/2026-08-06-kbo-proto-ocr-admin-v1.json"),
      "utf8",
    ),
  );
  assert.equal(audit.intakeRunId, "intake-rt");
  assert.equal(audit.inputKind, "CLIPBOARD_IMAGE");

  console.log("verify:kbo-clipboard-runtime OK");
  console.log(
    JSON.stringify({
      note: "Manual browser QA still required: Win+Shift+S → Ctrl+V → preview → remove",
      tempCwd: cwd,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
