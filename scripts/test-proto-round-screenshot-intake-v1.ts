/**
 * Proto-round screenshot intake v1 tests.
 * Deterministic temp-file fixtures. No real user screenshots. Network: 0.
 *
 *   npm run test:proto-round-screenshot-intake-v1
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertSafeProtoRoundCoords,
  inboxDirectoryRelative,
  initProtoRound,
  loadIntakeManifest,
  loadRoundConfig,
  protoRoundKey,
  roundDirectoryRelative,
  scanProtoRoundInbox,
} from "../src/lib/proto-round-screenshot-intake-v1";

const PNG_A = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
const PNG_B = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x02]);

function sha256Buf(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function makeClock() {
  let n = 0;
  return () =>
    new Date(Date.parse("2026-09-06T02:00:00.000Z") + n++ * 1000).toISOString();
}

function inboxAbs(cwd: string, year: number, round: number): string {
  return path.join(cwd, ...inboxDirectoryRelative(year, round).split("/"));
}

function writeInboxFile(
  cwd: string,
  year: number,
  round: number,
  name: string,
  bytes: Buffer,
) {
  const dir = inboxAbs(cwd, year, round);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), bytes);
}

async function rejectsInvalid(
  cwd: string,
  year: unknown,
  round: unknown,
): Promise<void> {
  await assert.rejects(() =>
    initProtoRound({
      cwd,
      year: year as number,
      round: round as number,
    }),
  );
  assert.throws(() => assertSafeProtoRoundCoords(year, round));
}

async function main() {
  const cwd = mkdtempSync(path.join(tmpdir(), "proto-round-intake-"));
  const year = 2026;
  const round = 105;
  const clock = makeClock();

  try {
    // 1. empty round init creates expected directory/config
    const init = await initProtoRound({ cwd, year, round, now: clock });
    assert.equal(init.roundLabel, "105회차");
    assert.equal(init.protoRoundKey, "2026-105");
    assert.equal(init.inboxRelativePath, "PROTO_ROUNDS/2026/105회차/INBOX");
    assert.equal(
      init.roundConfigRelativePath,
      "PROTO_ROUNDS/2026/105회차/.yang-edge/round.json",
    );
    assert.equal(existsSync(inboxAbs(cwd, year, round)), true);

    const cfg = await loadRoundConfig(cwd, year, round);
    assert.ok(cfg);
    assert.equal(cfg.schemaVersion, "proto-round-config-v1");
    assert.equal(cfg.year, 2026);
    assert.equal(cfg.round, 105);
    assert.equal(cfg.roundLabel, "105회차");
    assert.equal(cfg.protoRoundKey, "2026-105");
    assert.equal(cfg.timezone, "Asia/Seoul");
    assert.equal(cfg.groupingPolicy, "PROTO_ROUND_PRIMARY");
    assert.equal(cfg.calendarDateSplit, false);
    const createdAt = cfg.createdAt;

    const initAgain = await initProtoRound({ cwd, year, round, now: clock });
    assert.equal(initAgain.wroteRoundConfig, false);
    const cfgAgain = await loadRoundConfig(cwd, year, round);
    assert.equal(cfgAgain?.createdAt, createdAt);

    assert.equal(protoRoundKey(2026, 105), "2026-105");
    assert.equal(roundDirectoryRelative(2026, 105), "PROTO_ROUNDS/2026/105회차");
    assert.ok(inboxDirectoryRelative(2026, 105).includes("105회차"));
    assert.ok(!inboxDirectoryRelative(2026, 105).includes("2026-09-06"));

    // 8. no calendar-date folder generated
    const yearDir = path.join(cwd, "PROTO_ROUNDS", "2026");
    const yearChildren = readdirSync(yearDir);
    assert.deepEqual(yearChildren, ["105회차"]);
    assert.ok(!yearChildren.some((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)));

    // 2. one supported image → 1 canonical
    writeInboxFile(cwd, year, round, "shot-a.PNG", PNG_A);
    const pngAPath = path.join(inboxAbs(cwd, year, round), "shot-a.PNG");
    const pngAHashBefore = sha256Buf(readFileSync(pngAPath));
    const scanB = await scanProtoRoundInbox({ cwd, year, round, now: clock });
    assert.equal(scanB.summary.canonicalImageCount, 1);
    assert.equal(scanB.summary.physicalFileCount, 1);
    assert.equal(scanB.summary.duplicateExactCount, 0);
    // 12. raw test files unchanged after scan
    assert.equal(sha256Buf(readFileSync(pngAPath)), pngAHashBefore);

    let manifest = await loadIntakeManifest(cwd, year, round);
    assert.ok(manifest);
    assert.equal(manifest.meta.schemaVersion, "proto-round-screenshot-intake-v1");
    assert.equal(manifest.meta.protoRoundKey, "2026-105");
    assert.equal(manifest.meta.rawImageStorage, "LOCAL_ONLY");
    assert.equal(manifest.meta.ocrStatus, "NOT_IMPLEMENTED");
    assert.equal(manifest.meta.oddsExtractionStatus, "NOT_IMPLEMENTED");
    assert.equal(manifest.meta.exactImageDedupe, "IMPLEMENTED");
    assert.equal(manifest.meta.nearImageDedupe, "NOT_IMPLEMENTED");
    assert.equal(manifest.meta.rowObservationDedupe, "NOT_IMPLEMENTED");
    assert.equal(manifest.meta.filesystemTimeTreatedAsVerifiedCaptureTime, false);
    assert.equal(manifest.meta.calendarDateSplit, false);
    assert.equal(manifest.files[0]!.fileStatus, "CANONICAL_IMAGE");
    assert.equal(manifest.files[0]!.extractionEligible, true);
    assert.equal(manifest.files[0]!.extractionStatus, "NOT_EXTRACTED");
    assert.equal(manifest.files[0]!.timingClassification, "UNCLASSIFIED");
    assert.equal(
      Object.prototype.hasOwnProperty.call(manifest.files[0], "imageCapturedAt"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(manifest.files[0], "capturedAt"),
      false,
    );
    const firstSeenA = manifest.files[0]!.firstSeenAt;
    const lastScanB = manifest.meta.lastScanAt;

    // 3. exact same bytes, different filename
    writeInboxFile(cwd, year, round, "shot-a-copy.png", PNG_A);
    const scanC = await scanProtoRoundInbox({ cwd, year, round, now: clock });
    assert.equal(scanC.summary.canonicalImageCount, 1);
    assert.equal(scanC.summary.physicalFileCount, 2);
    assert.equal(scanC.summary.duplicateExactCount, 1);
    assert.equal(
      existsSync(path.join(inboxAbs(cwd, year, round), "shot-a.PNG")),
      true,
    );
    assert.equal(
      existsSync(path.join(inboxAbs(cwd, year, round), "shot-a-copy.png")),
      true,
    );
    assert.equal(sha256Buf(readFileSync(pngAPath)), pngAHashBefore);

    manifest = await loadIntakeManifest(cwd, year, round);
    assert.ok(manifest);
    const canonical = manifest.files.find((f) => f.fileStatus === "CANONICAL_IMAGE");
    const duplicate = manifest.files.find((f) => f.fileStatus === "DUPLICATE_EXACT");
    assert.ok(canonical);
    assert.ok(duplicate);
    assert.equal(canonical.fileName, "shot-a.PNG");
    assert.equal(duplicate.fileName, "shot-a-copy.png");
    assert.equal(duplicate.duplicateOfSha256, canonical.sha256);
    assert.equal(duplicate.canonicalRelativePath, canonical.relativePath);
    assert.equal(duplicate.extractionEligible, false);
    assert.equal(canonical.firstSeenAt, firstSeenA);

    // 4. different bytes → canonical count becomes 2
    writeInboxFile(cwd, year, round, "shot-b.jpg", PNG_B);
    const scanD = await scanProtoRoundInbox({ cwd, year, round, now: clock });
    assert.equal(scanD.summary.canonicalImageCount, 2);
    assert.equal(scanD.summary.physicalFileCount, 3);

    // 7. unsupported .txt
    writeInboxFile(cwd, year, round, "notes.txt", Buffer.from("not an image"));
    const scanF = await scanProtoRoundInbox({ cwd, year, round, now: clock });
    assert.equal(scanF.summary.canonicalImageCount, 2);
    assert.equal(scanF.summary.unsupportedFileCount, 1);
    manifest = await loadIntakeManifest(cwd, year, round);
    assert.ok(manifest);
    const txt = manifest.files.find((f) => f.fileName === "notes.txt");
    assert.ok(txt);
    assert.equal(txt.fileStatus, "UNSUPPORTED_FILE");
    assert.equal(txt.extractionEligible, false);
    assert.equal(txt.timingClassification, "UNCLASSIFIED");

    // 5. repeated scan unchanged → canonical count unchanged
    const scanE = await scanProtoRoundInbox({ cwd, year, round, now: clock });
    assert.equal(scanE.summary.canonicalImageCount, 2);
    assert.equal(scanE.canonicalImageDelta, 0);
    assert.equal(scanE.previousCanonicalImageCount, 2);

    // 6 + 9. firstSeenAt preserved; manifest survives restart/rescan
    const beforeRestart = await loadIntakeManifest(cwd, year, round);
    assert.ok(beforeRestart);
    const restartScan = await scanProtoRoundInbox({ cwd, year, round, now: clock });
    const afterRestart = await loadIntakeManifest(cwd, year, round);
    assert.ok(afterRestart);
    assert.equal(restartScan.canonicalImageDelta, 0);
    assert.equal(
      afterRestart.meta.firstInitializedAt,
      beforeRestart.meta.firstInitializedAt,
    );
    assert.equal(
      afterRestart.files.find((f) => f.fileName === "shot-a.PNG")?.firstSeenAt,
      firstSeenA,
    );
    assert.notEqual(afterRestart.meta.lastScanAt, lastScanB);
    assert.equal(afterRestart.summary.canonicalImageCount, 2);
    assert.equal(afterRestart.meta.ocrStatus, "NOT_IMPLEMENTED");
    assert.deepEqual(readdirSync(yearDir), ["105회차"]);
    assert.equal(sha256Buf(readFileSync(pngAPath)), pngAHashBefore);

    JSON.parse(
      readFileSync(
        path.join(cwd, ...init.roundConfigRelativePath.split("/")),
        "utf8",
      ),
    );

    // 10. deterministic canonical path despite different creation/enumeration ordering
    const orderA = mkdtempSync(path.join(tmpdir(), "proto-round-order-a-"));
    const orderB = mkdtempSync(path.join(tmpdir(), "proto-round-order-b-"));
    try {
      await initProtoRound({ cwd: orderA, year, round, now: makeClock() });
      await initProtoRound({ cwd: orderB, year, round, now: makeClock() });
      writeInboxFile(orderA, year, round, "zebra.png", PNG_A);
      writeInboxFile(orderA, year, round, "apple.png", PNG_A);
      writeInboxFile(orderB, year, round, "apple.png", PNG_A);
      writeInboxFile(orderB, year, round, "zebra.png", PNG_A);
      await scanProtoRoundInbox({ cwd: orderA, year, round, now: makeClock() });
      await scanProtoRoundInbox({ cwd: orderB, year, round, now: makeClock() });
      const manA = await loadIntakeManifest(orderA, year, round);
      const manB = await loadIntakeManifest(orderB, year, round);
      const canonA = manA?.files.find((f) => f.fileStatus === "CANONICAL_IMAGE");
      const canonB = manB?.files.find((f) => f.fileStatus === "CANONICAL_IMAGE");
      assert.equal(canonA?.relativePath, "INBOX/apple.png");
      assert.equal(canonB?.relativePath, "INBOX/apple.png");
      assert.equal(canonA?.canonicalRelativePath, canonB?.canonicalRelativePath);
      assert.equal(manA?.summary.canonicalImageCount, 1);
      assert.equal(manB?.summary.canonicalImageCount, 1);
    } finally {
      rmSync(orderA, { recursive: true, force: true });
      rmSync(orderB, { recursive: true, force: true });
    }

    // 11. invalid year/round/path traversal rejected
    await rejectsInvalid(cwd, "../x", 105);
    await rejectsInvalid(cwd, 2026, "../x");
    await rejectsInvalid(cwd, 2026, 0);
    await rejectsInvalid(cwd, 2026, -1);
    await rejectsInvalid(cwd, 2026, Number.NaN);
    await rejectsInvalid(cwd, 2026, 1.5);
    await rejectsInvalid(cwd, 2026.4, 105);

    // unsupported schemaVersion fails closed
    const schemaCwd = mkdtempSync(path.join(tmpdir(), "proto-round-schema-"));
    try {
      await initProtoRound({ cwd: schemaCwd, year, round, now: makeClock() });
      const manifestAbs = path.join(
        schemaCwd,
        "PROTO_ROUNDS",
        "2026",
        "105회차",
        ".yang-edge",
        "intake-manifest-v1.json",
      );
      writeFileSync(
        manifestAbs,
        `${JSON.stringify({ meta: { schemaVersion: "not-this-schema" } }, null, 2)}\n`,
        "utf8",
      );
      await assert.rejects(
        () =>
          scanProtoRoundInbox({ cwd: schemaCwd, year, round, now: makeClock() }),
        /UNSUPPORTED_INTAKE_MANIFEST_SCHEMA/,
      );
    } finally {
      rmSync(schemaCwd, { recursive: true, force: true });
    }

    console.log("PROTO_ROUND_SCREENSHOT_INTAKE_V1_OK");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
