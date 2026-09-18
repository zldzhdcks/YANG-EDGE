/**
 * Write an operator bootstrap Odds quota receipt.
 *
 * Remaining credits are CLI input — never hardcoded.
 *
 *   npx tsx scripts/write-odds-quota-bootstrap-receipt-v1.ts --plan-name <name> --remaining <n> --evidence-date YYYY-MM-DD [--used n] [--last n]
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildOddsQuotaBootstrapReceipt,
  writeOddsQuotaReceipt,
} from "../src/lib/odds/quota-receipt-v1";

function usage(): never {
  console.error(`Usage:
  npx tsx scripts/write-odds-quota-bootstrap-receipt-v1.ts --plan-name <name> --remaining <n> --evidence-date YYYY-MM-DD [--used n] [--last n] [--observed-at ISO]
`);
  process.exit(2);
}

export function parseOddsQuotaBootstrapCli(argv: string[]) {
  let planName = "";
  let remaining: number | null = null;
  let used: number | null = null;
  let last: number | null = null;
  let evidenceDate = "";
  let observedAt: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--plan-name") planName = argv[++i] ?? "";
    else if (a === "--remaining") remaining = Number(argv[++i]);
    else if (a === "--used") used = Number(argv[++i]);
    else if (a === "--last") last = Number(argv[++i]);
    else if (a === "--evidence-date") evidenceDate = argv[++i] ?? "";
    else if (a === "--observed-at") observedAt = argv[++i];
    else if (a === "--help" || a === "-h") usage();
    else usage();
  }
  if (!planName.trim() || remaining == null || !evidenceDate) usage();
  return { planName, remaining, used, last, evidenceDate, observedAt };
}

async function main() {
  const parsed = parseOddsQuotaBootstrapCli(process.argv.slice(2));
  const receipt = buildOddsQuotaBootstrapReceipt({
    planName: parsed.planName,
    requestsRemaining: parsed.remaining,
    requestsUsed: parsed.used,
    requestsLast: parsed.last,
    evidenceDate: parsed.evidenceDate,
    observedAt: parsed.observedAt,
  });
  const filePath = await writeOddsQuotaReceipt(receipt);
  const usedOut = receipt.requestsUsed == null ? "null" : String(receipt.requestsUsed);
  const lastOut = receipt.requestsLast == null ? "null" : String(receipt.requestsLast);
  console.log(`WROTE ${path.relative(process.cwd(), filePath)}`);
  console.log(
    `remaining=${receipt.requestsRemaining} used=${usedOut} last=${lastOut} source=${receipt.source}`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
