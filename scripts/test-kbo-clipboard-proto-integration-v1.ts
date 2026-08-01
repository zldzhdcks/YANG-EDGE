/**
 * Clipboard → Proto OCR integration (temp cwd only).
 * Fixture adapter path + NotConfigured + approve metadata + cancel exclusion.
 */
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
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

  const { extractProtoOcrFromImages, extractProtoOcrFromPasteText } =
    await import("../src/lib/kbo/proto-ocr/extract-service");
  const { FixtureProtoOcrAdapter, NotConfiguredProtoOcrAdapter } = await import(
    "../src/lib/kbo/proto-ocr/adapter"
  );
  const { approveProtoOcrDraft } = await import(
    "../src/lib/kbo/proto-ocr/approve"
  );
  const { validateProtoOcrDraft } = await import(
    "../src/lib/kbo/proto-ocr/validate-draft"
  );
  const { cleanupEphemeralSession, createEphemeralOcrSession } = await import(
    "../src/lib/kbo/proto-ocr/ephemeral"
  );

  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
  ]);

  const cwd = mkdtempSync(path.join(tmpdir(), "kbo-clipboard-proto-"));
  mkdirSync(path.join(cwd, "data/research/kbo"), { recursive: true });
  mkdirSync(path.join(cwd, "data/operator-input/kbo"), { recursive: true });
  mkdirSync(path.join(cwd, "data/audits"), { recursive: true });

  writeFileSync(
    path.join(cwd, "data/research/kbo/2026-08-05-schedule-v1.json"),
    JSON.stringify({
      schemaVersion: "kbo-schedule-v1",
      league: "KBO",
      date: "2026-08-05",
      games: [
        {
          gameId: "kbo-c1",
          home: "두산",
          away: "LG",
          scheduledStartTime: "2099-08-05T18:00:00+09:00",
        },
        {
          gameId: "kbo-c2",
          home: "삼성",
          away: "롯데",
          scheduledStartTime: "2099-08-05T18:30:00+09:00",
        },
      ],
    }) + "\n",
  );

  writeFileSync(
    path.join(cwd, "data/operator-input/kbo/2026-08-05-personnel-input-v1.json"),
    JSON.stringify({
      schemaVersion: "kbo-t45-personnel-input-v1",
      league: "KBO",
      dateKst: "2026-08-05",
      createdAt: "2099-01-01T00:00:00.000Z",
      createdBy: "seed",
      commercialUseStatus: "INTERNAL_ONLY",
      games: [
        {
          gameId: "kbo-c1",
          homeTeam: "두산",
          awayTeam: "LG",
          scheduledStartTime: "2099-08-05T18:00:00+09:00",
          observedAt: "2099-01-01T00:00:00.000Z",
          home: {
            starter: { playerName: "KeepHome", throwingHand: "R" },
            lineup: {
              batters: [
                {
                  slot: 1,
                  playerName: "Batter1",
                  position: "CF",
                },
              ],
            },
          },
          away: {
            starter: { playerName: "KeepAway", throwingHand: "L" },
            lineup: null,
          },
          domesticProto: null,
        },
        {
          gameId: "kbo-c2",
          homeTeam: "삼성",
          awayTeam: "롯데",
          scheduledStartTime: "2099-08-05T18:30:00+09:00",
          observedAt: "2099-01-01T00:00:00.000Z",
          home: { starter: null, lineup: null },
          away: { starter: null, lineup: null },
          domesticProto: null,
        },
      ],
    }) + "\n",
  );

  // NotConfigured path — image accepted, 0 candidates
  const notCfg = await extractProtoOcrFromImages({
    dateKst: "2026-08-05",
    files: [{ bytes: png, mimeType: "image/png", filename: "clip.png" }],
    adapter: new NotConfiguredProtoOcrAdapter(),
    cwd,
  });
  assert.equal(notCfg.engineStatus, "OCR_ENGINE_NOT_CONFIGURED");
  assert.equal(notCfg.mutationPerformed, false);
  assert.equal(notCfg.rows.length, 0);

  // Fixture adapter clipboard-like image → parse → map
  const fixture = await extractProtoOcrFromImages({
    dateKst: "2026-08-05",
    files: [{ bytes: png, mimeType: "image/png", filename: "clip.png" }],
    fixtureTexts: { img0: "LG 1.75 두산 1.77\n롯데 삼성 경기취소" },
    adapter: new FixtureProtoOcrAdapter(),
    cwd,
  });
  assert.equal(fixture.engineStatus, "FIXTURE");
  assert.ok(fixture.rows.some((r) => r.gameId === "kbo-c1"));
  const cancelRow = fixture.rows.find((r) =>
    r.warnings.includes("CANCELLATION_SUSPECTED"),
  );
  assert.ok(cancelRow);
  assert.equal(cancelRow!.saveAllowed, false);
  assert.equal(cancelRow!.awayPrice, null);

  // unsupported market
  const uo = await extractProtoOcrFromPasteText({
    dateKst: "2026-08-05",
    text: "LG 언더/오버 1.90 두산 1.85",
    cwd,
  });
  const uoRow = uo.rows[0];
  if (uoRow) {
    assert.ok(
      uoRow.detectedMarket === "UNDER_OVER" ||
        uoRow.warnings.includes("DETECTED_UNSUPPORTED_MARKET"),
    );
  }

  // Approve moneyline only + intake metadata; cancel excluded
  const money = fixture.rows.find((r) => r.gameId === "kbo-c1")!;
  money.adminDecision = "APPROVED";
  money.errors = [];

  if (cancelRow) {
    cancelRow.adminDecision = "APPROVED";
    cancelRow.adminCancellationDecision = "CONFIRM_CANCEL";
  }

  const validated = await validateProtoOcrDraft({
    dateKst: "2026-08-05",
    rows: [money, ...(cancelRow ? [cancelRow] : [])],
    cwd,
    now: new Date("2099-01-01T00:00:00.000Z"),
  });
  assert.ok(
    validated.rows.some((r) =>
      r.errors.includes("CANCEL_ROW_NOT_PROTO_SAVEABLE"),
    ),
  );

  const ok = await approveProtoOcrDraft({
    dateKst: "2026-08-05",
    ocrRunId: fixture.ocrRunId,
    approvedRows: validated.rows,
    adminId: "clipboard-tester",
    explicitConfirmation: true,
    cwd,
    now: new Date("2099-01-01T00:00:00.000Z"),
    intakeRunId: "intake-run-test",
    intakeItemIds: ["intake-item-1"],
    imageFingerprints: fixture.imageFingerprints,
    inputKind: "CLIPBOARD_IMAGE",
    extractionMethod: "MANUAL_VISUAL_CONFIRMATION",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.t45AutoRun, false);
  assert.equal(ok.t30AutoRun, false);
  assert.deepEqual(ok.approvedGameIds, ["kbo-c1"]);

  const saved = JSON.parse(
    readFileSync(
      path.join(cwd, "data/operator-input/kbo/2026-08-05-personnel-input-v1.json"),
      "utf8",
    ),
  );
  assert.equal(saved.games[0].home.starter.playerName, "KeepHome");
  assert.equal(saved.games[0].away.starter.playerName, "KeepAway");
  assert.equal(saved.games[0].home.lineup.batters[0].playerName, "Batter1");
  assert.equal(saved.games[0].domesticProto.awayPrice, 1.75);
  assert.equal(saved.extractionMethod, "MANUAL_VISUAL_CONFIRMATION");
  // cancel game proto untouched
  assert.equal(saved.games[1].domesticProto, null);

  const audit = JSON.parse(
    readFileSync(
      path.join(cwd, "data/audits/2026-08-05-kbo-proto-ocr-admin-v1.json"),
      "utf8",
    ),
  );
  assert.equal(audit.intakeRunId, "intake-run-test");
  assert.equal(audit.inputKind, "CLIPBOARD_IMAGE");
  assert.equal(audit.extractionMethod, "MANUAL_VISUAL_CONFIRMATION");
  assert.equal(audit.confirmationMethod, "ADMIN_VERIFIED");
  assert.equal(audit.sourceType, "ADMIN_MANUAL_SCREENSHOT");
  assert.equal(audit.t45AutoRun, false);
  assert.equal(audit.commercialUseStatus, "INTERNAL_ONLY");

  // Schedule artifact not mutated
  const schedRaw = readFileSync(
    path.join(cwd, "data/research/kbo/2026-08-05-schedule-v1.json"),
    "utf8",
  );
  assert.ok(!schedRaw.includes("CANCELLED"));

  // ephemeral cleanup
  const session = await createEphemeralOcrSession();
  const warnings = await cleanupEphemeralSession(session);
  assert.ok(Array.isArray(warnings));
  if (existsSync(session.root)) {
    assert.equal(readdirSync(session.root).length, 0);
  }

  // operating repo artifacts: this test only wrote under tmp cwd
  console.log("test:kbo-clipboard-proto-integration OK", { cwd });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
