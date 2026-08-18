/**
 * Read sealed Market Baseline + Official Result. No Provider.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  FOOTBALL_MARKET_BASELINE_CLASS,
  FOOTBALL_MARKET_BASELINE_PREDICTION_V0_SCHEMA,
  type FootballMarketBaselinePredictionV0,
} from "../market-baseline-prediction-v0/types";
import { footballMarketBaselinePredictionV0Rel } from "../market-baseline-prediction-v0/paths";
import {
  FOOTBALL_OFFICIAL_RESULT_V0_SCHEMA,
  type FootballOfficialResultArtifactV0,
} from "../official-result-v0/types";
import { footballOfficialResultV0Rel } from "../official-result-v0/paths";
import type { FootballMarketBaselinePostgameSources } from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

async function readJson(abs: string, rel: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(abs, "utf8");
  } catch (err) {
    const code =
      typeof err === "object" && err != null && "code" in err
        ? (err as NodeJS.ErrnoException).code
        : null;
    if (code === "ENOENT") {
      throw new Error(`FOOTBALL_POSTGAME_SOURCE_MISSING: ${rel}`);
    }
    throw err;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`FOOTBALL_POSTGAME_SOURCE_JSON_INVALID: ${rel}`);
  }
}

function parseBaseline(
  raw: unknown,
  dateKst: string,
): FootballMarketBaselinePredictionV0 {
  if (!isRecord(raw) || !isRecord(raw.meta) || !Array.isArray(raw.matches)) {
    throw new Error("FOOTBALL_POSTGAME_BASELINE_STRUCTURE_INVALID");
  }
  const meta = raw.meta;
  if (meta.schemaVersion !== FOOTBALL_MARKET_BASELINE_PREDICTION_V0_SCHEMA) {
    throw new Error(
      `FOOTBALL_POSTGAME_BASELINE_SCHEMA_INVALID: ${String(meta.schemaVersion)}`,
    );
  }
  if (meta.dateKst !== dateKst) {
    throw new Error(
      `FOOTBALL_POSTGAME_BASELINE_DATE_MISMATCH: ${String(meta.dateKst)}`,
    );
  }
  if (meta.predictionClass !== FOOTBALL_MARKET_BASELINE_CLASS) {
    throw new Error("FOOTBALL_POSTGAME_NOT_MARKET_BASELINE");
  }
  if (
    meta.model !== "NONE" ||
    meta.engine !== "NONE" ||
    meta.recommendation !== "NONE" ||
    meta.officialPickCount !== 0
  ) {
    throw new Error("FOOTBALL_POSTGAME_BASELINE_TREATED_AS_ENGINE_FORBIDDEN");
  }
  if (typeof meta.predictionHash !== "string" || !meta.predictionHash) {
    throw new Error("FOOTBALL_POSTGAME_BASELINE_HASH_MISSING");
  }
  return raw as FootballMarketBaselinePredictionV0;
}

function parseResult(
  raw: unknown,
  dateKst: string,
): FootballOfficialResultArtifactV0 {
  if (!isRecord(raw) || !isRecord(raw.meta) || !Array.isArray(raw.matches)) {
    throw new Error("FOOTBALL_POSTGAME_RESULT_STRUCTURE_INVALID");
  }
  const meta = raw.meta;
  if (meta.schemaVersion !== FOOTBALL_OFFICIAL_RESULT_V0_SCHEMA) {
    throw new Error(
      `FOOTBALL_POSTGAME_RESULT_SCHEMA_INVALID: ${String(meta.schemaVersion)}`,
    );
  }
  if (meta.dateKst !== dateKst) {
    throw new Error(
      `FOOTBALL_POSTGAME_RESULT_DATE_MISMATCH: ${String(meta.dateKst)}`,
    );
  }
  if (typeof meta.resultArtifactHash !== "string" || !meta.resultArtifactHash) {
    throw new Error("FOOTBALL_POSTGAME_RESULT_HASH_MISSING");
  }
  return raw as FootballOfficialResultArtifactV0;
}

export async function loadFootballMarketBaselinePostgameSources(input: {
  dateKst: string;
  cwd?: string;
}): Promise<FootballMarketBaselinePostgameSources> {
  const cwd = input.cwd ?? process.cwd();
  const baselineRel = footballMarketBaselinePredictionV0Rel(input.dateKst);
  const resultRel = footballOfficialResultV0Rel(input.dateKst);
  const baselineRaw = await readJson(path.join(cwd, baselineRel), baselineRel);
  const resultRaw = await readJson(path.join(cwd, resultRel), resultRel);
  return {
    baseline: parseBaseline(baselineRaw, input.dateKst),
    baselineRel,
    result: parseResult(resultRaw, input.dateKst),
    resultRel,
  };
}
