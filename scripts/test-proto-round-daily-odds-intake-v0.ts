/**
 * Daily odds intake audit v0 tests.
 * Synthetic images only. SHA identity. No OCR. No network.
 *
 *   npm run test:proto-round-daily-odds-intake-v0
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { OPERATOR_ROOT_NAME, sha256RawBytes } from "../src/lib/proto-round-screenshot-intake-v1";
import {
  buildDailyOddsIntakeSealV0,
  filenameContainsInventoryDate,
  inventoryDailyScreenshots,
  isDailyNewScreenshotFile,
  newCanonicalImages,
  sha256Bytes,
} from "../src/lib/proto-round-daily-odds-intake-v0";

function gitDiffExitCode(rel: string): number {
  try {
    execFileSync("git", ["diff", "--exit-code", "--", rel], {
      stdio: "pipe",
      encoding: "utf8",
    });
    return 0;
  } catch (err) {
    const e = err as { status?: number };
    return typeof e.status === "number" ? e.status : 1;
  }
}

function sourceFiles(): string[] {
  const lib = path.join(process.cwd(), "src/lib/proto-round-daily-odds-intake-v0");
  return [
    ...readdirSync(lib)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => path.join(lib, f)),
    path.join(process.cwd(), "scripts/audit-proto-round-daily-odds-intake-v0.ts"),
  ];
}

async function main() {
  const pngA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
  const pngB = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x02]);
  const shaA = sha256RawBytes(pngA);
  const shaAAgain = sha256RawBytes(pngA);
  assert.equal(shaA, shaAAgain);
  assert.notEqual(shaA, sha256RawBytes(pngB));

  assert.equal(
    filenameContainsInventoryDate("shot 2026-09-09 212016.png", "2026-09-09"),
    true,
  );
  assert.equal(
    filenameContainsInventoryDate("shot 2026-09-08 212016.png", "2026-09-09"),
    false,
  );
  const inventoryInstant = Date.parse("2026-09-09T12:20:16.000Z");
  assert.equal(
    isDailyNewScreenshotFile({
      fileName: "old-name.png",
      inventoryDate: "2026-09-09",
      mtimeMs: inventoryInstant,
      birthtimeMs: inventoryInstant,
    }),
    true,
  );
  assert.equal(
    isDailyNewScreenshotFile({
      fileName: "shot 2026-09-08 212016.png",
      inventoryDate: "2026-09-09",
      mtimeMs: Date.parse("2026-09-08T12:00:00.000Z"),
      birthtimeMs: Date.parse("2026-09-08T12:00:00.000Z"),
    }),
    false,
  );

  const previous = new Set([shaA]);
  const current = [
    { sourceFileName: "copy-a.png", sourceImageSha256: shaA, relativePath: "copy-a.png" },
    {
      sourceFileName: "new-b.png",
      sourceImageSha256: sha256RawBytes(pngB),
      relativePath: "new-b.png",
    },
  ];
  const fresh = newCanonicalImages({
    currentCanonical: current,
    previousCanonicalSha256: previous,
  });
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0]!.sourceImageSha256, sha256RawBytes(pngB));
  assert.equal(fresh[0]!.sourceFileName, "new-b.png");

  const seal = buildDailyOddsIntakeSealV0({
    capturedInventoryDate: "2026-09-09",
    year: 2026,
    round: 106,
    roundLabel: "106회차",
    protoRoundKey: "2026-106",
    scanSummary: {
      physical: 2,
      canonical: 2,
      duplicates: 0,
      unsupported: 0,
      eligible: 2,
      previousCanonicalImageCount: 1,
      canonicalImageDelta: 1,
    },
    images: fresh,
  });
  assert.equal(seal.purpose, "NEW_DAILY_ODDS_EVIDENCE");
  assert.equal(seal.USED_FOR_OCR_RULE_DESIGN, false);
  assert.equal(seal.USED_FOR_DISCOVERY2_TRUTH, false);
  assert.equal(seal.USED_FOR_VALIDATION2, false);
  assert.equal(seal.USED_FOR_HOLDOUT, false);
  assert.equal(seal.OCR_RUN, false);
  assert.equal(seal.NETWORK_CALLS, 0);
  const workspace = mkdtempSync(path.join(tmpdir(), "daily-odds-"));
  const operatorRootAbs = path.join(workspace, OPERATOR_ROOT_NAME);
  mkdirSync(path.join(operatorRootAbs, "2026", "106회차"), { recursive: true });
  mkdirSync(path.join(operatorRootAbs, "2026", "2026-09-09"), { recursive: true });
  writeFileSync(
    path.join(operatorRootAbs, "2026", "106회차", "shot 2026-09-09 212016.png"),
    pngB,
  );
  writeFileSync(
    path.join(operatorRootAbs, "2026", "2026-09-09", "shot 2026-09-09 999999.png"),
    pngA,
  );
  const hits = inventoryDailyScreenshots({
    operatorRootAbs,
    inventoryDate: "2026-09-09",
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.round, 106);
  assert.equal(hits[0]!.sourceFileName, "shot 2026-09-09 212016.png");
  const sealSha = sha256Bytes(Buffer.from(`${JSON.stringify(seal, null, 2)}\n`, "utf8"));
  const sealShaAgain = sha256Bytes(Buffer.from(`${JSON.stringify(seal, null, 2)}\n`, "utf8"));
  assert.equal(sealSha, sealShaAgain);

  assert.equal(gitDiffExitCode("data/research"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-raw-ocr-v0"), 0);
  assert.equal(gitDiffExitCode("src/lib/proto-round-structured-extraction-v0/parser.ts"), 0);

  for (const abs of sourceFiles()) {
    const src = readFileSync(abs, "utf8");
    assert.equal(src.includes("parseStructuredRowV0"), false, abs);
    assert.equal(src.includes("participantRawOcrEvidences"), false, abs);
    assert.equal(src.includes("extract:proto-round-raw-ocr"), false, abs);
    assert.equal(src.includes("fetch("), false, abs);
    assert.equal(src.includes("https://"), false, abs);
    assert.equal(src.includes("http://"), false, abs);
    assert.equal(src.includes("holdout-seal"), false, abs);
    assert.equal(src.includes("validation2-annotation"), false, abs);
    assert.equal(src.includes("discovery2-human-truth-v1.json"), false, abs);
  }

  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split(/\r?\n/);
  for (const rel of tracked) {
    assert.equal(rel.includes("2026-09-09-new-screenshot-seal-v0.json"), false, rel);
    assert.equal(rel.includes("YANG-EDGE-INBOX"), false, rel);
    assert.equal(rel.includes("discovery2-human-truth-v1.json"), false, rel);
  }

  console.log("test:proto-round-daily-odds-intake-v0 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
