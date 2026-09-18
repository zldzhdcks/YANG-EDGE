import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function isYangEdgeRepoRoot(dir: string): boolean {
  return (
    existsSync(path.join(dir, "package.json")) &&
    existsSync(path.join(dir, "scripts")) &&
    existsSync(path.join(dir, "src")) &&
    existsSync(path.join(dir, ".git"))
  );
}

export function resolveYangEdgeRepoRoot(startDir?: string): string {
  const start = startDir ?? process.cwd();
  let cur = path.resolve(start);
  for (let i = 0; i < 12; i++) {
    if (isYangEdgeRepoRoot(cur)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  throw new Error("REPO_ROOT_NOT_FOUND");
}

export function resolveRepoRootFromModuleUrl(moduleUrl: string): string {
  const fromFile = path.dirname(fileURLToPath(moduleUrl));
  return resolveYangEdgeRepoRoot(fromFile);
}

export const LOCAL_TSX_CLI_REL = "node_modules/tsx/dist/cli.mjs";

export function localTsxCliPath(repoRoot: string): string {
  return path.join(repoRoot, LOCAL_TSX_CLI_REL);
}

export function absoluteNodeExecPath(): string {
  return process.execPath;
}
