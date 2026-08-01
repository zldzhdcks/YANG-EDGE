/**
 * Runtime fixture QA for Proto OCR (temp cwd) — extract/validate/approve/cleanup.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Module from "node:module";

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

  const { extractProtoOcrFromPasteText } = await import(
    "../src/lib/kbo/proto-ocr/extract-service"
  );
  const { validateProtoOcrDraft } = await import(
    "../src/lib/kbo/proto-ocr/validate-draft"
  );
  const { approveProtoOcrDraft } = await import(
    "../src/lib/kbo/proto-ocr/approve"
  );

  const cwd = mkdtempSync(path.join(tmpdir(), "kbo-proto-ocr-rt-"));
  mkdirSync(path.join(cwd, "data/research/kbo"), { recursive: true });
  mkdirSync(path.join(cwd, "data/operator-input/kbo"), { recursive: true });
  mkdirSync(path.join(cwd, "data/audits"), { recursive: true });
  mkdirSync(path.join(cwd, "data/predictions/kbo"), { recursive: true });

  writeFileSync(
    path.join(cwd, "data/research/kbo/2026-08-03-schedule-v1.json"),
    JSON.stringify({
      schemaVersion: "kbo-schedule-v1",
      league: "KBO",
      date: "2026-08-03",
      games: [
        {
          gameId: "kbo-101",
          home: "두산",
          away: "LG",
          scheduledStartTime: "2099-08-03T18:00:00+09:00",
        },
        {
          gameId: "kbo-102",
          home: "SSG",
          away: "키움",
          scheduledStartTime: "2099-08-03T18:00:00+09:00",
        },
      ],
    }) + "\n",
  );

  const extracted = await extractProtoOcrFromPasteText({
    dateKst: "2026-08-03",
    text: "LG 1.75 두산 1.77\n키움 1.88 SSG 1.70",
    cwd,
  });
  assert.equal(extracted.mutationPerformed, false);
  assert.ok(extracted.rows.length >= 2);

  const rows = extracted.rows.map((r) => ({
    ...r,
    adminDecision: "APPROVED" as const,
  }));
  const validated = await validateProtoOcrDraft({
    dateKst: "2026-08-03",
    rows,
    cwd,
  });
  assert.equal(validated.mutationPerformed, false);

  const approved = await approveProtoOcrDraft({
    dateKst: "2026-08-03",
    ocrRunId: extracted.ocrRunId,
    approvedRows: validated.rows,
    adminId: "runtime-qa",
    explicitConfirmation: true,
    cwd,
  });
  assert.equal(approved.ok, true);
  assert.equal(approved.t45AutoRun, false);
  assert.ok(approved.pathRel);

  const input = JSON.parse(
    readFileSync(
      path.join(cwd, "data/operator-input/kbo/2026-08-03-personnel-input-v1.json"),
      "utf8",
    ),
  );
  assert.equal(input.games.length, 2);
  assert.ok(input.games.every((g: { domesticProto: unknown }) => g.domesticProto));
  assert.ok(
    existsSync(path.join(cwd, "data/audits/2026-08-03-kbo-proto-ocr-admin-v1.json")),
  );
  assert.equal(
    existsSync(path.join(cwd, "data/predictions/kbo/2026-08-03.json")),
    false,
  );

  console.log("verify:kbo-proto-ocr-runtime OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
