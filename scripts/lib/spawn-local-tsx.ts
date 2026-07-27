/**
 * Spawn project-local tsx (devDependency) for research orchestrators.
 * Avoids npx network fetch; uses node_modules/tsx/dist/cli.mjs via Node.
 */
import { spawn } from "node:child_process";
import path from "node:path";

const TSX_CLI = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");

export function spawnLocalTsxScript(
  scriptRel: string,
  args: string[] = [],
): Promise<number> {
  const script = path.join(process.cwd(), scriptRel);
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [TSX_CLI, "--env-file=.env.local", script, ...args],
      {
        cwd: process.cwd(),
        stdio: "inherit",
      },
    );
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}
