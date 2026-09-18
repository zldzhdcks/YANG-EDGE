/**
 * YANG EDGE Mac operations node v1.
 *
 * Future launchd invokes this wrapper only — never Scheduler internals.
 *
 *   npm run ops:mac-node -- --preflight
 *   npm run ops:mac-node -- --run
 *
 * Default (no flag) does not spawn Scheduler or Providers.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  absoluteNodeExecPath,
  localTsxCliPath,
  MAC_OPS_EXIT,
  resolveRepoRootFromModuleUrl,
  runMacOperationsNode,
  schedulerUnattendedArgs,
  type MacOpsMode,
} from "../src/lib/mac-operations-node-v1";

export function parseMacOpsCliArgs(argv: string[]): {
  mode: MacOpsMode | null;
  json: boolean;
} {
  let preflight = false;
  let run = false;
  let json = false;
  for (const a of argv) {
    if (a === "--preflight") preflight = true;
    else if (a === "--run") run = true;
    else if (a === "--json") json = true;
    else if (a === "--help" || a === "-h") {
      return { mode: null, json: false };
    } else if (a === "--rehearsal" || a === "--rehearsal-as-of" || a === "--force-stage") {
      throw new Error("MAC_OPS_REHEARSAL_FORBIDDEN");
    }
  }
  if (preflight && run) throw new Error("MAC_OPS_MODE_CONFLICT");
  if (preflight) return { mode: "PREFLIGHT", json };
  if (run) return { mode: "RUN", json };
  return { mode: null, json };
}

function spawnScheduler(repoRoot: string, dateKst: string): Promise<{
  exitCode: number;
  schedulerRunId: string | null;
}> {
  const tsx = localTsxCliPath(repoRoot);
  const script = path.join(repoRoot, "scripts", "run-pregame-scheduler-v1.ts");
  const envFile = path.join(repoRoot, ".env.local");
  const nodeArgs = existsSync(envFile)
    ? [tsx, "--env-file=.env.local", script, ...schedulerUnattendedArgs(dateKst)]
    : [tsx, script, ...schedulerUnattendedArgs(dateKst)];
  return new Promise((resolve, reject) => {
    const child = spawn(absoluteNodeExecPath(), nodeArgs, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout?.on("data", (b: Buffer) => {
      const s = b.toString("utf8");
      out += s;
      process.stdout.write(s);
    });
    child.stderr?.on("data", (b: Buffer) => {
      process.stderr.write(b.toString("utf8"));
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const m = out.match(/schedulerRunId["']?\s*[:=]\s*["']?([A-Za-z0-9._-]+)/);
      resolve({ exitCode: code ?? 1, schedulerRunId: m?.[1] ?? null });
    });
  });
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  let parsed: ReturnType<typeof parseMacOpsCliArgs>;
  try {
    parsed = parseMacOpsCliArgs(argv);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    return MAC_OPS_EXIT.CONFIG_FAILURE;
  }
  if (parsed.mode == null) {
    console.error(`Usage:
  npm run ops:mac-node -- --preflight
  npm run ops:mac-node -- --run
`);
    return MAC_OPS_EXIT.CONFIG_FAILURE;
  }

  const repoRoot = resolveRepoRootFromModuleUrl(import.meta.url);
  const report = await runMacOperationsNode({
    mode: parsed.mode,
    cwd: repoRoot,
    repoRoot,
    executeScheduler:
      parsed.mode === "RUN"
        ? ({ dateKst }) => spawnScheduler(repoRoot, dateKst)
        : undefined,
  });
  if (parsed.json) {
    console.log(JSON.stringify(report, null, 2));
  }
  return report.exitCode;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().then((code) => process.exit(code));
}
