import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  readOddsApiKeyPresent,
  readOddsPlanConfirmed,
} from "../provider-automation-policy";

export type MacOpsEnvInspection = {
  envFile: "PRESENT" | "MISSING";
  oddsPlanConfirmed: boolean;
  oddsApiKeyPresent: boolean;
  envError: "ENV_FILE_MISSING" | "ODDS_API_KEY_MISSING" | "ODDS_PLAN_NOT_CONFIRMED" | null;
};

export type MacOpsEnvMap = Record<string, string | undefined>;

function parseEnvFile(text: string): MacOpsEnvMap {
  const env: MacOpsEnvMap = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/** Presence facts only — never returns secret values. */
export async function inspectMacOpsEnv(input: {
  cwd: string;
  envOverride?: MacOpsEnvMap;
}): Promise<MacOpsEnvInspection> {
  const envPath = path.join(input.cwd, ".env.local");
  const fileExists = existsSync(envPath);
  let fileEnv: MacOpsEnvMap = {};
  if (fileExists) {
    const text = await readFile(envPath, "utf8");
    fileEnv = parseEnvFile(text);
  }
  const merged: MacOpsEnvMap = input.envOverride
    ? { ...fileEnv, ...input.envOverride }
    : { ...fileEnv, ...process.env };
  const envForPolicy = merged as NodeJS.ProcessEnv;
  const oddsPlanConfirmed = readOddsPlanConfirmed(envForPolicy);
  const oddsApiKeyPresent = readOddsApiKeyPresent(envForPolicy);
  let envError: MacOpsEnvInspection["envError"] = null;
  if (!fileExists && !input.envOverride) envError = "ENV_FILE_MISSING";
  else if (!oddsApiKeyPresent) envError = "ODDS_API_KEY_MISSING";
  else if (!oddsPlanConfirmed) envError = "ODDS_PLAN_NOT_CONFIRMED";
  return {
    envFile: fileExists ? "PRESENT" : "MISSING",
    oddsPlanConfirmed,
    oddsApiKeyPresent,
    envError,
  };
}
