/**
 * KBO Proto OCR unit tests — parser, image validation, mapping, merge, confidence.
 * Temp cwd only for approve path; historical mutation 0.
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

  const {
    validateProtoOcrImage,
    validateProtoOcrImageBatch,
    PROTO_OCR_MAX_IMAGES,
  } = await import("../src/lib/kbo/proto-ocr/image-validation");
  const {
    normalizePriceCandidate,
    parseProtoCandidatesFromText,
  } = await import("../src/lib/kbo/proto-ocr/parse-candidates");
  const { mapCandidateToSchedule } = await import(
    "../src/lib/kbo/proto-ocr/schedule-map"
  );
  const { mergeProtoOcrDraftRows } = await import(
    "../src/lib/kbo/proto-ocr/merge-rows"
  );
  const { computeProtoOcrConfidence } = await import(
    "../src/lib/kbo/proto-ocr/confidence"
  );
  const { extractProtoOcrFromPasteText } = await import(
    "../src/lib/kbo/proto-ocr/extract-service"
  );
  const { approveProtoOcrDraft } = await import(
    "../src/lib/kbo/proto-ocr/approve"
  );
  const { NotConfiguredProtoOcrAdapter } = await import(
    "../src/lib/kbo/proto-ocr/adapter"
  );

  // --- Image validation ---
  const png = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde,
  ]);
  const pngOk = validateProtoOcrImage({ bytes: png, filename: "a.png" });
  assert.equal(pngOk.ok, true);

  const jpegHead = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
  const badJpeg = validateProtoOcrImage({ bytes: jpegHead, filename: "a.jpg" });
  assert.equal(badJpeg.ok, false);

  const spoof = validateProtoOcrImage({
    bytes: png,
    filename: "a.jpg",
    declaredMime: "image/jpeg",
  });
  assert.equal(spoof.ok, false);
  if (!spoof.ok) assert.equal(spoof.errorCode, "MIME_SPOOF");

  const tooMany = validateProtoOcrImageBatch(
    Array.from({ length: PROTO_OCR_MAX_IMAGES + 1 }, () => png),
  );
  assert.ok(tooMany && tooMany.errorCode === "IMAGE_TOO_MANY");

  const svg = validateProtoOcrImage({
    bytes: Uint8Array.from([0x3c, 0x73, 0x76, 0x67]),
    filename: "x.svg",
  });
  assert.equal(svg.ok, false);

  // --- Price normalization ---
  assert.equal(normalizePriceCandidate("1.77").value, 1.77);
  assert.equal(normalizePriceCandidate("1,77").value, null);
  assert.equal(normalizePriceCandidate("1,77", { allowCommaAsDecimal: true }).value, 1.77);
  assert.equal(normalizePriceCandidate("177").value, null);
  assert.equal(normalizePriceCandidate("I.77").value, null);
  assert.equal(normalizePriceCandidate("-175").value, null);
  assert.equal(normalizePriceCandidate("1.00").value, null);
  assert.equal(normalizePriceCandidate("1.7?").value, null);

  // --- Parser ---
  const cands = parseProtoCandidatesFromText({
    rawText: "LG 1.75 두산 1.77\n키움 1.90 SSG 1.65",
    sourceImageId: "img1",
    allowCommaAsDecimal: true,
  });
  assert.ok(cands.length >= 2);
  assert.equal(cands[0]!.parserStatus, "PARSED");

  const schedule = [
    {
      gameId: "kbo-1",
      home: "두산",
      away: "LG",
      scheduledStartTime: "2026-08-01T18:00:00+09:00",
    },
    {
      gameId: "kbo-2",
      home: "SSG",
      away: "키움",
      scheduledStartTime: "2026-08-01T18:00:00+09:00",
    },
  ];

  const row = mapCandidateToSchedule(cands[0]!, schedule, "ocr-test");
  assert.equal(row.gameId, "kbo-1");
  assert.equal(row.resolvedAwayTeam, "LG");
  assert.equal(row.resolvedHomeTeam, "두산");
  assert.equal(row.awayPrice, 1.75);
  assert.equal(row.homePrice, 1.77);
  assert.equal(row.confidence.reviewRequired, true);

  // reverse screenshot order
  const revCand = parseProtoCandidatesFromText({
    rawText: "두산 1.77 LG 1.75",
    sourceImageId: "img2",
  })[0]!;
  const revRow = mapCandidateToSchedule(revCand, schedule, "ocr-test");
  assert.equal(revRow.gameId, "kbo-1");
  assert.equal(revRow.awayPrice, 1.75);
  assert.equal(revRow.homePrice, 1.77);

  // unknown team
  const unk = parseProtoCandidatesFromText({
    rawText: "FOO 1.50 BAR 2.50",
    sourceImageId: "img3",
  });
  if (unk[0]) {
    const urow = mapCandidateToSchedule(unk[0], schedule, "ocr-test");
    assert.equal(urow.mappingStatus, "UNKNOWN_TEAM");
  }

  // merge identical / conflict
  const a = { ...row, draftRowId: "a", sourceImageIds: ["i1"] };
  const b = { ...row, draftRowId: "b", sourceImageIds: ["i2"] };
  const mergedSame = mergeProtoOcrDraftRows([a, b]);
  assert.equal(mergedSame.length, 1);
  assert.ok(mergedSame[0]!.sourceImageIds.length === 2);

  const conflict = mergeProtoOcrDraftRows([
    a,
    { ...b, awayPrice: 1.99, homePrice: 1.55 },
  ]);
  assert.equal(conflict[0]!.mappingStatus, "CONFLICTING_CANDIDATES");
  assert.equal(conflict[0]!.awayPrice, null);

  const conf = computeProtoOcrConfidence({
    textRecognitionConfidence: 0.99,
    teamResolved: false,
    pricesResolved: true,
    scheduleMatched: false,
    ambiguous: false,
    directionMismatch: false,
    invalidPrice: false,
    parserWarnings: [],
    mappingStatus: "UNKNOWN_TEAM",
  });
  assert.equal(conf.reviewRequired, true);
  assert.ok(conf.reviewReasons.includes("UNKNOWN_TEAM"));

  // Not configured adapter
  const adapter = new NotConfiguredProtoOcrAdapter();
  const raw = await adapter.extract({
    images: [
      {
        imageId: "x",
        bytes: png,
        mimeType: "image/png",
        originalFilename: "x.png",
      },
    ],
  });
  assert.equal(raw.errorCode, "OCR_ENGINE_NOT_CONFIGURED");

  // Paste extract against real 2026-08-01 schedule if present
  const paste = await extractProtoOcrFromPasteText({
    dateKst: "2026-08-01",
    text: "LG 1.75 두산 1.77",
  });
  assert.equal(paste.mutationPerformed, false);
  assert.ok(paste.warnings.includes("PASTE_TEXT_FALLBACK"));

  // Approve in temp cwd
  const cwd = mkdtempSync(path.join(tmpdir(), "kbo-proto-ocr-"));
  mkdirSync(path.join(cwd, "data/research/kbo"), { recursive: true });
  mkdirSync(path.join(cwd, "data/operator-input/kbo"), { recursive: true });
  mkdirSync(path.join(cwd, "data/audits"), { recursive: true });
  writeFileSync(
    path.join(cwd, "data/research/kbo/2026-08-02-schedule-v1.json"),
    JSON.stringify({
      schemaVersion: "kbo-schedule-v1",
      league: "KBO",
      date: "2026-08-02",
      games: [
        {
          gameId: "kbo-9",
          home: "두산",
          away: "LG",
          scheduledStartTime: "2099-08-02T18:00:00+09:00",
        },
      ],
    }) + "\n",
  );
  // seed existing starter
  writeFileSync(
    path.join(cwd, "data/operator-input/kbo/2026-08-02-personnel-input-v1.json"),
    JSON.stringify({
      schemaVersion: "kbo-t45-personnel-input-v1",
      league: "KBO",
      dateKst: "2026-08-02",
      createdAt: "2099-01-01T00:00:00.000Z",
      createdBy: "seed",
      commercialUseStatus: "INTERNAL_ONLY",
      games: [
        {
          gameId: "kbo-9",
          homeTeam: "두산",
          awayTeam: "LG",
          scheduledStartTime: "2099-08-02T18:00:00+09:00",
          observedAt: "2099-01-01T00:00:00.000Z",
          home: {
            starter: { playerName: "HomeSP", throwingHand: "R" },
            lineup: null,
          },
          away: {
            starter: { playerName: "AwaySP", throwingHand: "L" },
            lineup: null,
          },
          domesticProto: null,
        },
      ],
    }) + "\n",
  );

  const approveRows = [
    {
      ...row,
      draftRowId: "ap1",
      ocrRunId: "ocr-ap",
      gameId: "kbo-9",
      resolvedAwayTeam: "LG",
      resolvedHomeTeam: "두산",
      awayPrice: 1.8,
      homePrice: 1.7,
      adminDecision: "APPROVED" as const,
      errors: [],
      mappingStatus: "MATCHED_EXACT" as const,
    },
  ];

  const denied = await approveProtoOcrDraft({
    dateKst: "2026-08-02",
    ocrRunId: "ocr-ap",
    approvedRows: approveRows,
    adminId: "tester",
    explicitConfirmation: false,
    cwd,
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.errorCode, "CONFIRMATION_REQUIRED");

  const hist = await approveProtoOcrDraft({
    dateKst: "2026-07-31",
    ocrRunId: "ocr-ap",
    approvedRows: approveRows,
    adminId: "tester",
    explicitConfirmation: true,
    cwd,
  });
  assert.equal(hist.errorCode, "HISTORICAL_READ_ONLY");

  const ok = await approveProtoOcrDraft({
    dateKst: "2026-08-02",
    ocrRunId: "ocr-ap",
    approvedRows: approveRows,
    adminId: "tester",
    explicitConfirmation: true,
    cwd,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.t45AutoRun, false);
  assert.equal(ok.t30AutoRun, false);
  assert.equal(ok.mutationPerformed, true);
  const saved = JSON.parse(
    readFileSync(
      path.join(cwd, "data/operator-input/kbo/2026-08-02-personnel-input-v1.json"),
      "utf8",
    ),
  );
  assert.equal(saved.games[0].home.starter.playerName, "HomeSP");
  assert.equal(saved.games[0].away.starter.playerName, "AwaySP");
  assert.equal(saved.games[0].domesticProto.homePrice, 1.7);
  assert.equal(saved.games[0].domesticProto.awayPrice, 1.8);
  assert.equal(saved.games[0].domesticProto.extractionMethod, "OCR_ASSISTED");
  assert.ok(
    existsSync(path.join(cwd, "data/audits/2026-08-02-kbo-proto-ocr-admin-v1.json")),
  );

  console.log("test:kbo-proto-ocr OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
