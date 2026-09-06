/**
 * CLI: Proto-round screenshot intake v1.
 *
 * Drop all screenshots for a Korean domestic Proto round into one INBOX.
 * Round is the primary grouping key. Calendar date is not required.
 * Exact SHA-256 duplicates are classified, never deleted.
 * No OCR. No odds extraction. Local image storage only.
 *
 *   npm run intake:proto-round-screenshots -- --year 2026 --round 105 --init
 *   npm run intake:proto-round-screenshots -- --year 2026 --round 105 --scan
 *   npm run intake:proto-round-screenshots -- --year 2026 --round 105 --init --json
 */
import {
  assertSafeProtoRoundCoords,
  initProtoRound,
  protoRoundIdentity,
  scanProtoRoundInbox,
} from "../src/lib/proto-round-screenshot-intake-v1";

function usage(): string {
  return `Usage:
  npm run intake:proto-round-screenshots -- --year YYYY --round N --init [--json]
  npm run intake:proto-round-screenshots -- --year YYYY --round N --scan [--json]

Round is the primary grouping key. Do not pass a calendar date.
Raw screenshots stay local under PROTO_ROUNDS/ and are not extracted in v1.
`;
}

export function parseIntakeArgs(argv: string[]): {
  year: number;
  round: number;
  init: boolean;
  scan: boolean;
  json: boolean;
} {
  let year: number | null = null;
  let round: number | null = null;
  let init = false;
  let scan = false;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") throw new Error("HELP");
    if (a === "--init") {
      init = true;
      continue;
    }
    if (a === "--scan") {
      scan = true;
      continue;
    }
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--year") {
      const v = argv[++i];
      if (!v) throw new Error("--year requires a number");
      year = Number(v);
      continue;
    }
    if (a === "--round") {
      const v = argv[++i];
      if (!v) throw new Error("--round requires a number");
      round = Number(v);
      continue;
    }
    if (a === "--date") {
      throw new Error(
        "Calendar date is not a proto-round intake argument. Use --year and --round only.",
      );
    }
    throw new Error(`Unknown argument: ${a}`);
  }

  if (year == null || round == null) {
    throw new Error("Specify --year and --round");
  }
  const safe = assertSafeProtoRoundCoords(year, round);
  if (!init && !scan) {
    throw new Error("Specify --init and/or --scan");
  }
  return { year: safe.year, round: safe.round, init, scan, json };
}

async function main() {
  let args: ReturnType<typeof parseIntakeArgs>;
  try {
    args = parseIntakeArgs(process.argv.slice(2));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "HELP") {
      console.log(usage());
      process.exit(0);
    }
    console.error(msg);
    console.log(usage());
    process.exit(1);
    return;
  }

  const identity = protoRoundIdentity(args.year, args.round);
  const results: unknown[] = [];

  if (args.init) {
    results.push(
      await initProtoRound({ year: args.year, round: args.round }),
    );
  }
  if (args.scan) {
    results.push(
      await scanProtoRoundInbox({ year: args.year, round: args.round }),
    );
  }

  if (args.json) {
    const payload = args.init && args.scan ? results : results[0];
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`protoRoundKey=${identity.protoRoundKey}`);
  console.log(`roundLabel=${identity.roundLabel}`);
  console.log(`year=${identity.year}`);
  console.log(`round=${identity.round}`);
  for (const r of results) {
    const row = r as {
      action: string;
      inboxRelativePath: string;
      wroteRoundConfig?: boolean;
      createdInbox?: boolean;
      summary?: { canonicalImageCount: number; duplicateExactCount: number };
      canonicalImageDelta?: number;
      manifestRelativePath?: string;
    };
    console.log(`action=${row.action}`);
    console.log(`inbox=${row.inboxRelativePath}`);
    if (row.action === "init") {
      console.log(`createdInbox=${row.createdInbox}`);
      console.log(`wroteRoundConfig=${row.wroteRoundConfig}`);
    }
    if (row.action === "scan" && row.summary) {
      console.log(`canonicalImageCount=${row.summary.canonicalImageCount}`);
      console.log(`duplicateExactCount=${row.summary.duplicateExactCount}`);
      console.log(`canonicalImageDelta=${row.canonicalImageDelta}`);
      console.log(`manifest=${row.manifestRelativePath}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
