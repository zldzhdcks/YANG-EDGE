/**
 * Spawn project-local tsx for daily orchestrator collection stages.
 */
import { spawn } from "node:child_process";
import path from "node:path";

export function spawnLocalTsxScript(
  scriptRel: string,
  args: string[] = [],
  cwd = process.cwd(),
): Promise<number> {
  const tsxCli = path.join(cwd, "node_modules", "tsx", "dist", "cli.mjs");
  const script = path.join(cwd, scriptRel);
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [tsxCli, "--env-file=.env.local", script, ...args],
      {
        cwd,
        stdio: "inherit",
      },
    );
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}
