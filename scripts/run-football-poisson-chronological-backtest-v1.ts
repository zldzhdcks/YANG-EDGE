/** Explicit one-shot offline execution; importing this module does not run it. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, fsyncSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { ARCHIVE_SHA, PROTOCOL_SHA, FREEZE_COMMIT, sha, verifyProtocol, verifyArchive, execute } from "./football-poisson-backtest-v1-core";

const root = fileURLToPath(new URL("../", import.meta.url));
function writeOnce(path: string, text: string) {
  const fd = openSync(path, "wx");
  try { writeFileSync(fd, text, "utf8"); fsyncSync(fd); } finally { closeSync(fd); }
}
export function denyNetwork() {
  let attempts = 0;
  const denied = () => { attempts++; throw new Error("NETWORK_FORBIDDEN"); };
  globalThis.fetch = denied;
  const require = createRequire(import.meta.url);
  for (const [module, keys] of Object.entries({ "node:http": ["request", "get"], "node:https": ["request", "get"], "node:net": ["connect", "createConnection"], "node:tls": ["connect"], "node:dgram": ["createSocket"], "node:dns": ["lookup", "resolve"] })) {
    const api = require(module); for (const k of keys) Reflect.set(api, k, denied);
    if (module === "node:net") Reflect.set(api.Socket.prototype, "connect", denied);
  }
  syncBuiltinESMExports();
  return () => attempts;
}
function main() {
  assert.deepEqual(process.argv.slice(2), ["--execute-once"], "EXPLICIT_EXECUTE_ONCE_REQUIRED");
  const git = (...args: string[]) => execFileSync("git", ["-c", `safe.directory=${root.replaceAll("\\", "/").replace(/\/$/, "")}`, ...args], { cwd: root, encoding: "utf8" }).trim();
  assert.equal(git("rev-parse", "HEAD"), FREEZE_COMMIT, "UNEXPECTED_HEAD");
  assert.equal(git("branch", "--show-current"), "agent/astra/football-historical-source-gate-v1");
  assert.equal(git("rev-parse", "origin/agent/astra/football-historical-source-gate-v1"), FREEZE_COMMIT);
  const protocolPath = resolve(root, "docs/FOOTBALL_POISSON_CHRONOLOGICAL_BACKTEST_V1.json");
  const protocol = verifyProtocol(readFileSync(protocolPath, "utf8"));
  const codeFiles = ["scripts/football-poisson-backtest-v1-core.ts", "scripts/run-football-poisson-chronological-backtest-v1.ts", "scripts/test-football-poisson-backtest-v1.ts"];
  const codeHashes = Object.fromEntries(codeFiles.map(p => [p, sha(readFileSync(resolve(root, p), "utf8").replace(/\r\n/g, "\n"))]));
  for (const [path, expected] of Object.entries(protocol.model.sourceSha256)) assert.equal(sha(readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n")), expected, "MODEL_SOURCE_MISMATCH");
  const audit = JSON.parse(readFileSync(resolve(root, "data/audits/football-epl-historical-archive-v1.json"), "utf8"));
  const archivePath = resolve(root, audit.localArchiveRelativePath, "archive.json");
  const allowed = resolve(root, "data/cache/research/football/historical-archive-v1");
  const rel = relative(allowed, archivePath); assert.ok(!rel.startsWith("..") && !isAbsolute(rel), "ARCHIVE_PATH_ESCAPE");
  const archiveBytes = readFileSync(archivePath);
  const matches = verifyArchive(archiveBytes, protocol);
  const out = resolve(root, "data/cache/research/football/poisson-chronological-backtest-v1");
  // Exclusive directory is the persistent run guard. Never delete/retry after any outcome.
  mkdirSync(out);
  const startedAt = new Date().toISOString();
  const receipt = { startedAt, executionBaseSha: FREEZE_COMMIT, archiveSha256: ARCHIVE_SHA, protocolSha256: PROTOCOL_SHA, codeHashes };
  writeOnce(resolve(out, "execution-start.json"), JSON.stringify(receipt, null, 2) + "\n");
  const networkAttempts = denyNetwork();
  try {
    const result = execute(matches, protocol, text => {
      const path = resolve(out, "predictions-before-labels.json");
      writeOnce(path, text); return readFileSync(path, "utf8");
    });
    assert.equal(networkAttempts(), 0);
    assert.equal(sha(readFileSync(archivePath)), ARCHIVE_SHA, "ARCHIVE_MUTATED");
    for (const [path, hash] of Object.entries(codeHashes)) assert.equal(sha(readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n")), hash, "EXECUTION_CODE_MUTATED");
    const governance = { BACKTEST_EXECUTED: true, NETWORK_CALLS: 0, NETWORK_ATTEMPTS: networkAttempts(), ODDS_USED: false,
      PROVIDER_PREDICTION_USED: false, ENGINE_CHANGED: false, WEIGHTS_CHANGED: false, MIN_SAMPLE_CHANGED: false,
      RESULT_LAG_CHANGED: false, POST_RESULT_TUNING: false, STRICT_REPLAY: false, STRICT_AS_OF_FABRICATED: false,
      OWNER_PRIVATE_DATA_USED: false, pick: false, stake: false, ROI: false, profit: false };
    const local = { schemaVersion: "football-poisson-chronological-backtest-v1", ...receipt, completedAt: new Date().toISOString(),
      modelVersion: protocol.model.version, ...result, audit: { governance, sourceHashes: protocol.model.sourceSha256,
        predictionBeforeLabelPersistence: true, actualObservationProvenance: false,
        resultAvailability: "kickoff + 48h < target kickoff - 1ms; 365-day lookback", runCount: 1 } };
    const text = JSON.stringify(local, null, 2) + "\n";
    const resultSha256 = sha(text), filename = "football-poisson-chronological-backtest-v1.json";
    writeOnce(resolve(out, filename), text);
    assert.equal(sha(readFileSync(resolve(out, filename))), resultSha256);
    const summary = { schemaVersion: "football-poisson-chronological-backtest-review-seal-v1", ...receipt,
      modelVersion: protocol.model.version, resultSha256, resultHashPolicy: "SHA256 exact UTF8 local result file bytes, including trailing newline",
      predictionSha256: result.predictionSha256, localResultRelativePath: relative(root, resolve(out, filename)).replaceAll("\\", "/"),
      summary: result.summary, poisson: result.poisson, comparator: result.comparator, governance,
      rawAndPerMatchData: "LOCAL_ONLY_GITIGNORED", validation: "Pre-run synthetic runner tests, frozen protocol tests, existing model regression, scoped strict TypeScript and ESLint; actual run assertions passed",
      finalStatus: "FOOTBALL_POISSON_CHRONOLOGICAL_BACKTEST_V1_READY_FOR_CTO_REVIEW" };
    writeOnce(resolve(root, "data/audits/football-poisson-chronological-backtest-v1.json"), JSON.stringify(summary, null, 2) + "\n");
    process.stdout.write(JSON.stringify({ summary: result.summary, resultSha256, localResultRelativePath: summary.localResultRelativePath }) + "\n");
  } catch (error) {
    writeOnce(resolve(out, "INVALID.json"), JSON.stringify({ ...receipt, BACKTEST_CLASSIFICATION: "INVALID", error: String(error), networkAttempts: networkAttempts(), retryAllowed: false }, null, 2) + "\n");
    throw error;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
