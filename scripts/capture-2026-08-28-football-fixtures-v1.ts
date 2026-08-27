/**
 * Persist the 2026-08-28 API-Football date fixture dump for slate recovery.
 *
 * Uses an existing captured file if present.
 * Makes one getFixtures call only when the dump is missing.
 *
 *   npx tsx --env-file=.env.local scripts/capture-2026-08-28-football-fixtures-v1.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getFootballProvider } from "../src/lib/football";
import { buildFootballScheduleV1 } from "../src/lib/football/core";
import type { FixtureRaw } from "../src/lib/football/types";

export const DATE_KST = "2026-08-28";
export const FIXTURES_CAPTURE_REL =
  "data/research/football/2026-08-28-fixtures-captured-v1.json";

export type FootballFixtureCaptureV1 = {
  schemaVersion: "yang-edge-football-fixtures-captured-v1";
  dateKst: string;
  timezone: "Asia/Seoul";
  researchOnly: true;
  predictionInput: false;
  engineConnected: false;
  capturedAt: string;
  cached: boolean | null;
  networkCallMade: boolean;
  endpoint: "/fixtures?date=2026-08-28&timezone=Asia/Seoul";
  fixtureCount: number;
  usage: {
    requestsRemaining: number | null;
    requestsLimit: number | null;
  };
  fixtures: FixtureRaw[];
};

export function loadFootballFixtureCapture(
  cwd = process.cwd(),
): FootballFixtureCaptureV1 | null {
  const abs = path.join(cwd, FIXTURES_CAPTURE_REL);
  if (!existsSync(abs)) return null;
  return JSON.parse(readFileSync(abs, "utf8")) as FootballFixtureCaptureV1;
}

export async function rebuildFootballScheduleFromCapture(cwd = process.cwd()) {
  const capture = loadFootballFixtureCapture(cwd);
  if (!capture) {
    throw new Error(`FOOTBALL_FIXTURE_CAPTURE_MISSING: ${FIXTURES_CAPTURE_REL}`);
  }
  return buildFootballScheduleV1({
    dateKst: DATE_KST,
    cwd,
    generatedAt: capture.capturedAt,
    fixtures: capture.fixtures,
    source: "api-football",
  });
}

export async function captureFootballFixtures20260828(cwd = process.cwd()) {
  const existing = loadFootballFixtureCapture(cwd);
  if (
    existing &&
    existing.fixtureCount > 0 &&
    Array.isArray(existing.fixtures)
  ) {
    return { document: existing, wrote: false, networkCallMade: false };
  }

  const provider = getFootballProvider();
  const fetched = await provider.getFixtures({
    date: DATE_KST,
    timezone: "Asia/Seoul",
  });
  const document: FootballFixtureCaptureV1 = {
    schemaVersion: "yang-edge-football-fixtures-captured-v1",
    dateKst: DATE_KST,
    timezone: "Asia/Seoul",
    researchOnly: true,
    predictionInput: false,
    engineConnected: false,
    capturedAt: fetched.fetchedAt,
    cached: fetched.cached,
    networkCallMade: fetched.cached !== true,
    endpoint: "/fixtures?date=2026-08-28&timezone=Asia/Seoul",
    fixtureCount: fetched.fixtures.length,
    usage: {
      requestsRemaining: fetched.usage.requestsRemaining,
      requestsLimit: fetched.usage.requestsLimit,
    },
    fixtures: fetched.fixtures,
  };
  const abs = path.join(cwd, FIXTURES_CAPTURE_REL);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  return { document, wrote: true, networkCallMade: document.networkCallMade };
}

async function main() {
  const result = await captureFootballFixtures20260828();
  console.log(
    JSON.stringify(
      {
        rel: FIXTURES_CAPTURE_REL,
        wrote: result.wrote,
        networkCallMade: result.networkCallMade,
        cached: result.document.cached,
        fixtureCount: result.document.fixtureCount,
        capturedAt: result.document.capturedAt,
        remaining: result.document.usage.requestsRemaining,
      },
      null,
      2,
    ),
  );
}

const isDirectRun =
  !!process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
