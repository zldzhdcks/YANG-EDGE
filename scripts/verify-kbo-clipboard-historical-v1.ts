/**
 * Clipboard mission historical guard — 2026-07-31 hashes immutable + image approve blocked.
 */
import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import { verifyProtoOcrHistorical0731 } from "../src/lib/kbo/proto-ocr/historical-verify";

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

  const hist = await verifyProtoOcrHistorical0731();
  assert.equal(hist.ok, true, JSON.stringify(hist.checks));

  const { approveProtoOcrDraft } = await import(
    "../src/lib/kbo/proto-ocr/approve"
  );

  const blocked = await approveProtoOcrDraft({
    dateKst: "2026-07-31",
    ocrRunId: "clipboard-hist",
    approvedRows: [
      {
        draftRowId: "x",
        ocrRunId: "clipboard-hist",
        sourceImageIds: ["clip"],
        rawTeamTexts: ["LG", "두산"],
        rawPriceTexts: ["1.7", "1.8"],
        screenshotFirstTeam: "LG",
        screenshotSecondTeam: "두산",
        resolvedAwayTeam: "LG",
        resolvedHomeTeam: "두산",
        gameId: "kbo-x",
        awayTeamId: null,
        homeTeamId: null,
        awayPrice: 1.7,
        homePrice: 1.8,
        mappingStatus: "MATCHED_EXACT",
        parserStatus: "PARSED",
        confidence: {
          textRecognitionConfidence: null,
          teamResolutionConfidence: null,
          oddsRecognitionConfidence: null,
          layoutAssociationConfidence: null,
          scheduleIdentityConfidence: null,
          overallConfidence: null,
          grade: "UNKNOWN",
          reviewRequired: true,
          reviewReasons: [],
        },
        warnings: [],
        errors: [],
        adminDecision: "APPROVED",
        adminCorrections: [],
        displayOrder: "CANONICAL",
        cancellationSuspect: "NONE",
        detectedMarket: "MONEYLINE_2WAY",
        saveAllowed: true,
        adminCancellationDecision: "PENDING",
      },
    ],
    adminId: "hist",
    explicitConfirmation: true,
    intakeRunId: "intake-hist",
    inputKind: "CLIPBOARD_IMAGE",
    extractionMethod: "MANUAL_VISUAL_CONFIRMATION",
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.errorCode, "HISTORICAL_READ_ONLY");
  assert.equal(blocked.mutationPerformed, false);

  console.log("verify:kbo-clipboard-historical OK");
  console.log(JSON.stringify({ historical: hist, approveBlocked: blocked.errorCode }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
