/**
 * Spawn project-local tsx (devDependency) for research orchestrators.
 * Avoids npx network fetch; uses node_modules/tsx/dist/cli.mjs via Node.
 * --env-file=.env.local is included only when the file exists so
 * no-provider rehearsal can execute without secrets.
 */
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const TSX_CLI = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");

export function spawnLocalTsxScript(
  scriptRel: string,
  args: string[] = [],
): Promise<number> {
  const script = path.join(process.cwd(), scriptRel);
  const nodeArgs = existsSync(path.join(process.cwd(), ".env.local"))
    ? [TSX_CLI, "--env-file=.env.local", script, ...args]
    : [TSX_CLI, script, ...args];
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, nodeArgs, {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}
