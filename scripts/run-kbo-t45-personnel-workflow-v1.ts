/**
 * CLI: KBO T45 Personnel Workflow v1
 *
 *   npm run research:kbo-t45-personnel -- --date YYYY-MM-DD --input <path> [--dry-run]
 */
import path from "node:path";
import { defaultPersonnelInputPath } from "../src/lib/kbo/t45-personnel/paths";
import { runKboT45PersonnelWorkflow } from "../src/lib/kbo/t45-personnel/run-t45-personnel-workflow";

function usage(): string {
  return `Usage:
  npm run research:kbo-t45-personnel -- --date YYYY-MM-DD --input <file.json> [options]

Options:
  --date <YYYY-MM-DD>     Required (or positional)
  --input <path>          Personnel input JSON (default: data/operator-input/kbo/{date}-personnel-input-v1.json)
  --game-id <id>          Process only this gameId (repeatable)
  --dry-run               Validate + plan writes; mutation 0
  --validate-only         Validate only; mutation 0
  --json                  Print JSON result
  --admin-id <id>         Actor id (default: operator)
  --source-reference <s>  Override source reference
  --help                  Show help
`;
}

function parseArgs(argv: string[]) {
  let dateKst: string | null = null;
  let inputPath: string | null = null;
  let dryRun = false;
  let validateOnly = false;
  let json = false;
  let adminId = "operator";
  let sourceReference: string | null = null;
  const gameIds: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") throw new Error("HELP");
    if (a === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (a === "--validate-only") {
      validateOnly = true;
      continue;
    }
    if (a === "--json") {
      json = true;
      continue;
    }
    if (a === "--date") {
      dateKst = argv[++i] ?? null;
      continue;
    }
    if (a === "--input") {
      inputPath = argv[++i] ?? null;
      continue;
    }
    if (a === "--game-id") {
      const id = argv[++i];
      if (id) gameIds.push(id);
      continue;
    }
    if (a === "--admin-id") {
      adminId = argv[++i] ?? adminId;
      continue;
    }
    if (a === "--source-reference") {
      sourceReference = argv[++i] ?? null;
      continue;
    }
    if (!a.startsWith("-") && /^\d{4}-\d{2}-\d{2}$/.test(a) && !dateKst) {
      dateKst = a;
      continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }

  if (!dateKst || !/^\d{4}-\d{2}-\d{2}$/.test(dateKst)) {
    throw new Error("Missing or invalid --date YYYY-MM-DD");
  }

  return {
    dateKst,
    inputPath:
      inputPath ??
      defaultPersonnelInputPath(dateKst, process.cwd()),
    dryRun,
    validateOnly,
    json,
    adminId,
    sourceReference,
    gameIds,
  };
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "HELP") {
      console.log(usage());
      process.exit(0);
    }
    console.error(msg);
    console.error(usage());
    process.exit(2);
  }

  const result = await runKboT45PersonnelWorkflow({
    dateKst: args.dateKst,
    inputPath: path.isAbsolute(args.inputPath)
      ? args.inputPath
      : path.join(process.cwd(), args.inputPath),
    dryRun: args.dryRun,
    validateOnly: args.validateOnly,
    gameIds: args.gameIds.length ? args.gameIds : null,
    adminId: args.adminId,
    sourceReference: args.sourceReference,
  });

  if (args.json || args.dryRun || args.validateOnly) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      JSON.stringify(
        {
          dateKst: result.dateKst,
          runId: result.runId,
          globalBlocker: result.globalBlocker,
          games: result.games.map((g) => ({
            gameId: g.gameId,
            status: g.status,
            completeness: g.completeness,
            predictionUsability: g.predictionUsability,
            errors: g.errors,
            warnings: g.warnings,
          })),
          writtenArtifacts: result.writtenArtifacts,
          personnelHash: result.personnelHash,
          domesticProtoHash: result.domesticProtoHash,
          providerCalls: result.providerCalls,
        },
        null,
        2,
      ),
    );
  }

  if (result.globalBlocker) process.exit(1);
  if (result.games.every((g) => g.status === "FAILED" || g.errors.includes("AFTER_CUTOFF") || g.errors.includes("ALREADY_LOCKED"))) {
    if (result.games.length > 0) process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
