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
  initProtoRound,
  LEGACY_PROTO_ROUNDS_ROOT,
  loadIntakeManifest,
  loadRoundConfig,
  OPERATOR_ROOT_NAME,
  protoRoundKey,
  resolveOperatorRoot,
  roundDirectoryRelative,
  scanProtoRoundInbox,
  screenshotDirectoryRelative,
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

function makeWorkspace() {
  const workspace = mkdtempSync(path.join(tmpdir(), "proto-round-ws-"));
  const repoRoot = path.join(workspace, "yang-edge");
  const operatorRootAbs = path.join(workspace, OPERATOR_ROOT_NAME);
  mkdirSync(repoRoot, { recursive: true });
  mkdirSync(operatorRootAbs, { recursive: true });
  return { workspace, repoRoot, operatorRootAbs };
}

function roundAbs(operatorRootAbs: string, year: number, round: number): string {
  return path.join(operatorRootAbs, String(year), `${round}회차`);
}

function writeRoundFile(
  operatorRootAbs: string,
  year: number,
  round: number,
  name: string,
  bytes: Buffer,
) {
  const dir = roundAbs(operatorRootAbs, year, round);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), bytes);
}

async function rejectsInvalid(
  operatorRootAbs: string,
  year: unknown,
  round: unknown,
): Promise<void> {
  await assert.rejects(() =>
    initProtoRound({
      operatorRootAbs,
      year: year as number,
      round: round as number,
    }),
  );
  assert.throws(() => assertSafeProtoRoundCoords(year, round));
}

async function main() {
  const { workspace, repoRoot, operatorRootAbs } = makeWorkspace();
  const year = 2026;
  const round = 105;
  const clock = makeClock();
  const legacyMarker = path.join(
    repoRoot,
    LEGACY_PROTO_ROUNDS_ROOT,
    "2026",
    "105회차",
    "INBOX",
    "do-not-delete.png",
  );
  mkdirSync(path.dirname(legacyMarker), { recursive: true });
  writeFileSync(legacyMarker, PNG_B);

  try {
    // I. operator root resolved as sibling, no hardcoded username
    assert.equal(
      resolveOperatorRoot({ repoRoot }),
      operatorRootAbs,
    );
    assert.equal(path.basename(operatorRootAbs), "YANG-EDGE-INBOX");
    assert.equal(resolveOperatorRoot.toString().includes("TCTCTC"), false);
    assert.equal(resolveOperatorRoot.toString().includes("C:\\Users"), false);

    // A. year=2026, round=105 resolves to YANG-EDGE-INBOX/2026/105회차
    assert.equal(protoRoundKey(2026, 105), "2026-105");
    assert.equal(
      roundDirectoryRelative(2026, 105),
      "YANG-EDGE-INBOX/2026/105회차",
    );
    assert.equal(
      screenshotDirectoryRelative(2026, 105),
      "YANG-EDGE-INBOX/2026/105회차",
    );
    // B. No INBOX child folder required
    assert.equal(screenshotDirectoryRelative(2026, 105).endsWith("/INBOX"), false);
    assert.equal(screenshotDirectoryRelative(2026, 105).includes("/INBOX/"), false);
    // C. No date folder generated
    assert.ok(!roundDirectoryRelative(2026, 105).includes("2026-09-06"));

    // D. 2027 / 1회차 resolves separately
    assert.equal(
      roundDirectoryRelative(2027, 1),
      "YANG-EDGE-INBOX/2027/1회차",
    );

    const init = await initProtoRound({
      operatorRootAbs,
      year,
      round,
      now: clock,
    });
    assert.equal(init.roundLabel, "105회차");
    assert.equal(init.protoRoundKey, "2026-105");
    assert.equal(init.operatorRoot, "YANG-EDGE-INBOX");
    assert.equal(init.roundRelativePath, "YANG-EDGE-INBOX/2026/105회차");
    assert.equal(
      init.roundConfigRelativePath,
      "YANG-EDGE-INBOX/2026/105회차/.yang-edge/round.json",
    );
    assert.equal(existsSync(roundAbs(operatorRootAbs, year, round)), true);
    assert.equal(
      existsSync(path.join(roundAbs(operatorRootAbs, year, round), "INBOX")),
      false,
    );

    const cfg = await loadRoundConfig(operatorRootAbs, year, round);
    assert.ok(cfg);
    assert.equal(cfg.operatorRoot, "YANG-EDGE-INBOX");
    assert.equal(cfg.roundLabel, "105회차");
    assert.equal(cfg.timezone, "Asia/Seoul");
    assert.equal(cfg.groupingPolicy, "PROTO_ROUND_PRIMARY");
    assert.equal(cfg.calendarDateSplit, false);
    const createdAt = cfg.createdAt;

    const initAgain = await initProtoRound({
      operatorRootAbs,
      year,
      round,
      now: clock,
    });
    assert.equal(initAgain.wroteRoundConfig, false);
    const cfgAgain = await loadRoundConfig(operatorRootAbs, year, round);
    assert.equal(cfgAgain?.createdAt, createdAt);

    const yearDir = path.join(operatorRootAbs, "2026");
    assert.deepEqual(readdirSync(yearDir), ["105회차"]);
    assert.ok(!readdirSync(yearDir).some((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)));

    await initProtoRound({
      operatorRootAbs,
      year: 2027,
      round: 1,
      now: clock,
    });
    assert.equal(existsSync(roundAbs(operatorRootAbs, 2027, 1)), true);
    assert.deepEqual(readdirSync(yearDir), ["105회차"]);

    // 2. one supported image → 1 canonical
    writeRoundFile(operatorRootAbs, year, round, "shot-a.PNG", PNG_A);
    const pngAPath = path.join(roundAbs(operatorRootAbs, year, round), "shot-a.PNG");
    const pngAHashBefore = sha256Buf(readFileSync(pngAPath));
    const scanB = await scanProtoRoundInbox({
      operatorRootAbs,
      year,
      round,
      now: clock,
    });
    assert.equal(scanB.summary.canonicalImageCount, 1);
    assert.equal(scanB.summary.physicalFileCount, 1);
    assert.equal(scanB.roundRelativePath, "YANG-EDGE-INBOX/2026/105회차");
    // H. raw files unchanged
    assert.equal(sha256Buf(readFileSync(pngAPath)), pngAHashBefore);

    let manifest = await loadIntakeManifest(operatorRootAbs, year, round);
    assert.ok(manifest);
    assert.equal(manifest.meta.operatorRoot, "YANG-EDGE-INBOX");
    assert.equal(manifest.meta.schemaVersion, "proto-round-screenshot-intake-v1");
    assert.equal(manifest.meta.protoRoundKey, "2026-105");
    assert.equal(manifest.meta.rawImageStorage, "LOCAL_ONLY");
    assert.equal(manifest.meta.ocrStatus, "NOT_IMPLEMENTED");
    assert.equal(manifest.meta.oddsExtractionStatus, "NOT_IMPLEMENTED");
    assert.equal(manifest.meta.calendarDateSplit, false);
    assert.equal(manifest.files[0]!.fileStatus, "CANONICAL_IMAGE");
    assert.equal(manifest.files[0]!.relativePath, "shot-a.PNG");
    assert.equal(
      Object.prototype.hasOwnProperty.call(manifest.files[0], "capturedAt"),
      false,
    );
    const firstSeenA = manifest.files[0]!.firstSeenAt;
    const lastScanB = manifest.meta.lastScanAt;

    // E. exact duplicate behavior unchanged
    writeRoundFile(operatorRootAbs, year, round, "shot-a-copy.png", PNG_A);
    const scanC = await scanProtoRoundInbox({
      operatorRootAbs,
      year,
      round,
      now: clock,
    });
    assert.equal(scanC.summary.canonicalImageCount, 1);
    assert.equal(scanC.summary.physicalFileCount, 2);
    assert.equal(scanC.summary.duplicateExactCount, 1);
    assert.equal(existsSync(pngAPath), true);
    assert.equal(
      existsSync(path.join(roundAbs(operatorRootAbs, year, round), "shot-a-copy.png")),
      true,
    );
    assert.equal(sha256Buf(readFileSync(pngAPath)), pngAHashBefore);

    manifest = await loadIntakeManifest(operatorRootAbs, year, round);
    assert.ok(manifest);
    const canonical = manifest.files.find((f) => f.fileStatus === "CANONICAL_IMAGE");
    const duplicate = manifest.files.find((f) => f.fileStatus === "DUPLICATE_EXACT");
    assert.ok(canonical);
    assert.ok(duplicate);
    assert.equal(canonical.relativePath, "shot-a.PNG");
    assert.equal(duplicate.relativePath, "shot-a-copy.png");
    assert.equal(duplicate.duplicateOfSha256, canonical.sha256);
    assert.equal(duplicate.canonicalRelativePath, canonical.relativePath);
    assert.equal(canonical.firstSeenAt, firstSeenA);

    writeRoundFile(operatorRootAbs, year, round, "shot-b.jpg", PNG_B);
    const scanD = await scanProtoRoundInbox({
      operatorRootAbs,
      year,
      round,
      now: clock,
    });
    assert.equal(scanD.summary.canonicalImageCount, 2);

    writeRoundFile(operatorRootAbs, year, round, "notes.txt", Buffer.from("not an image"));
    const scanF = await scanProtoRoundInbox({
      operatorRootAbs,
      year,
      round,
      now: clock,
    });
    assert.equal(scanF.summary.unsupportedFileCount, 1);

    const scanE = await scanProtoRoundInbox({
      operatorRootAbs,
      year,
      round,
      now: clock,
    });
    assert.equal(scanE.canonicalImageDelta, 0);

    // F. firstSeenAt preserved
    const afterRestart = await loadIntakeManifest(operatorRootAbs, year, round);
    assert.ok(afterRestart);
    assert.equal(
      afterRestart.files.find((f) => f.fileName === "shot-a.PNG")?.firstSeenAt,
      firstSeenA,
    );
    assert.notEqual(afterRestart.meta.lastScanAt, lastScanB);
    assert.equal(sha256Buf(readFileSync(pngAPath)), pngAHashBefore);

    const orderWsA = makeWorkspace();
    const orderWsB = makeWorkspace();
    try {
      await initProtoRound({
        operatorRootAbs: orderWsA.operatorRootAbs,
        year,
        round,
        now: makeClock(),
      });
      await initProtoRound({
        operatorRootAbs: orderWsB.operatorRootAbs,
        year,
        round,
        now: makeClock(),
      });
      writeRoundFile(orderWsA.operatorRootAbs, year, round, "zebra.png", PNG_A);
      writeRoundFile(orderWsA.operatorRootAbs, year, round, "apple.png", PNG_A);
      writeRoundFile(orderWsB.operatorRootAbs, year, round, "apple.png", PNG_A);
      writeRoundFile(orderWsB.operatorRootAbs, year, round, "zebra.png", PNG_A);
      await scanProtoRoundInbox({
        operatorRootAbs: orderWsA.operatorRootAbs,
        year,
        round,
        now: makeClock(),
      });
      await scanProtoRoundInbox({
        operatorRootAbs: orderWsB.operatorRootAbs,
        year,
        round,
        now: makeClock(),
      });
      const manA = await loadIntakeManifest(orderWsA.operatorRootAbs, year, round);
      const manB = await loadIntakeManifest(orderWsB.operatorRootAbs, year, round);
      assert.equal(
        manA?.files.find((f) => f.fileStatus === "CANONICAL_IMAGE")?.relativePath,
        "apple.png",
      );
      assert.equal(
        manB?.files.find((f) => f.fileStatus === "CANONICAL_IMAGE")?.relativePath,
        "apple.png",
      );
    } finally {
      rmSync(orderWsA.workspace, { recursive: true, force: true });
      rmSync(orderWsB.workspace, { recursive: true, force: true });
    }

    // G. path traversal invalid
    await rejectsInvalid(operatorRootAbs, "../x", 105);
    await rejectsInvalid(operatorRootAbs, 2026, "../x");
    await rejectsInvalid(operatorRootAbs, 2026, 0);
    await rejectsInvalid(operatorRootAbs, 2026, -1);
    await rejectsInvalid(operatorRootAbs, 2026, Number.NaN);
    await rejectsInvalid(operatorRootAbs, 2026, 1.5);

    // J. legacy PROTO_ROUNDS is not deleted
    assert.equal(existsSync(legacyMarker), true);
    assert.equal(sha256Buf(readFileSync(legacyMarker)), sha256Buf(PNG_B));

    const schemaWs = makeWorkspace();
    try {
      await initProtoRound({
        operatorRootAbs: schemaWs.operatorRootAbs,
        year,
        round,
        now: makeClock(),
      });
      const manifestAbs = path.join(
        schemaWs.operatorRootAbs,
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
          scanProtoRoundInbox({
            operatorRootAbs: schemaWs.operatorRootAbs,
            year,
            round,
            now: makeClock(),
          }),
        /UNSUPPORTED_INTAKE_MANIFEST_SCHEMA/,
      );
    } finally {
      rmSync(schemaWs.workspace, { recursive: true, force: true });
    }

    console.log("PROTO_ROUND_SCREENSHOT_INTAKE_V1_OK");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
