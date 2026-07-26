/**
 * 가계부 v2 티켓 자동 정산 (파일 JSON 입출력).
 *
 * localStorage 에 직접 접근할 수 없으므로 export 된 LedgerStoreV2 JSON 을 사용한다.
 *
 * 입력:
 *   --input  path/to/ledger-store-v2.json   (기본: data/ledger/store-v2.json)
 *   --results path/to/game-results.json    (기본: data/ledger/game-results.json)
 *
 * game-results.json 형식:
 *   { "results": [ { "gameId", "status", "homeScore?", "awayScore?", "winner?" } ] }
 *
 * 출력:
 *   같은 입력 파일을 갱신 (변경 시에만)
 *   정산 전 원본 → data/ledger/backups/store-v2-before-settle-{ISO}.json
 *
 * 브라우저에서는 applyLedgerTicketSettlement(gameResults) 사용.
 *
 * 실행:
 *   npx tsx scripts/settle-ledger-tickets.ts
 *   npx tsx scripts/settle-ledger-tickets.ts --input data/ledger/store-v2.json --results data/ledger/game-results.json
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LedgerStoreV2 } from "../src/types/ledger";
import {
  settleLedgerTickets,
  type LedgerGameResult,
} from "../src/lib/ledger/settle-tickets-from-results";

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

function defaultInput(): string {
  return path.join(process.cwd(), "data", "ledger", "store-v2.json");
}

function defaultResults(): string {
  return path.join(process.cwd(), "data", "ledger", "game-results.json");
}

async function loadStore(file: string): Promise<LedgerStoreV2> {
  const raw = await readFile(file, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("invalid store JSON");
  }
  const o = parsed as Record<string, unknown>;
  // export 래퍼 { store: LedgerStoreV2 } 허용
  if (o.store && typeof o.store === "object") {
    return o.store as LedgerStoreV2;
  }
  if (o.version === 2 && Array.isArray(o.tickets)) {
    return o as unknown as LedgerStoreV2;
  }
  throw new Error("expected LedgerStoreV2 (version:2, tickets[])");
}

async function loadResults(file: string): Promise<LedgerGameResult[]> {
  const raw = await readFile(file, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) return parsed as LedgerGameResult[];
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.results)) return o.results as LedgerGameResult[];
  }
  throw new Error("expected { results: LedgerGameResult[] } or array");
}

async function main() {
  const inputPath = path.resolve(argValue("--input") ?? defaultInput());
  const resultsPath = path.resolve(argValue("--results") ?? defaultResults());

  console.log("=== 가계부 티켓 자동 정산 ===");
  console.log(`store  : ${inputPath}`);
  console.log(`results: ${resultsPath}`);

  const store = await loadStore(inputPath);
  const results = await loadResults(resultsPath);

  const beforeRaw = `${JSON.stringify(store, null, 2)}\n`;
  const settled = settleLedgerTickets(store, results);

  console.log(`\n픽 변경   : ${settled.pickChanges.length}`);
  for (const c of settled.pickChanges) {
    console.log(
      `  ${c.ticketId}/${c.pickId} (${c.gameId}): ${c.from} → ${c.to} [${c.reason}]`,
    );
  }
  console.log(`티켓 변경 : ${settled.ticketChanges.length}`);
  for (const c of settled.ticketChanges) {
    console.log(
      `  ${c.ticketId}: ${c.fromStatus} → ${c.toStatus} actual ${c.fromActualReturn} → ${c.toActualReturn}`,
    );
  }
  console.log(`스킵      : ${settled.skipped.length}`);
  const skipCounts = new Map<string, number>();
  for (const s of settled.skipped) {
    skipCounts.set(s.reason, (skipCounts.get(s.reason) ?? 0) + 1);
  }
  for (const [reason, n] of [...skipCounts.entries()].sort()) {
    console.log(`  ${reason}: ${n}`);
  }

  if (!settled.changed) {
    console.log("\n변경 없음 — 파일을 갱신하지 않습니다.");
    return;
  }

  const backupDir = path.join(process.cwd(), "data", "ledger", "backups");
  await mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(
    backupDir,
    `store-v2-before-settle-${stamp}.json`,
  );
  await writeFile(backupPath, beforeRaw, "utf8");
  await writeFile(
    inputPath,
    `${JSON.stringify(settled.store, null, 2)}\n`,
    "utf8",
  );

  console.log(`\n백업: ${backupPath}`);
  console.log(`저장: ${inputPath}`);
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
