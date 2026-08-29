/**
 * 2026-08-30 B2 pregame input coverage — OWNER-review candidate.
 *
 * Inspects sealed B1 + stored artifacts, then collects remaining lawful
 * pregame datasets through existing builders/providers only.
 * Does not rewrite Stage A / B1. No Result, /predictions, Engine, or market-as-input.
 *
 *   npx tsx --env-file=.env.local scripts/audit-2026-08-30-pregame-input-coverage-v1.ts
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  getFootballProvider,
  resolveFootballProviderKind,
} from "../src/lib/football/get-football-provider";
import {
  footballInjuriesObservationRel,
  footballLineupsObservationRel,
} from "../src/lib/football/pregame-player-xi-foundation-v1/paths";
import { classifyFootballObservationPhase } from "../src/lib/football/pregame-player-xi-foundation-v1/temporal";
import type { FootballRawPointInTimeObservationV1 } from "../src/lib/football/pregame-player-xi-foundation-v1/types";
import { writeJsonAtomic } from "../src/lib/mlb/build-mlb-schedule-artifact";
import { buildLineupDatasetV1 } from "../src/lib/mlb/build-lineup-dataset";
import type { LineupDatasetDocument } from "../src/lib/mlb/lineup-dataset-types";
import { fetchMlbScheduleForDateKst } from "../src/lib/mlb/load-mlb-schedule-targets";
import { createCacheUsage } from "../src/lib/mlb/research-stats-cache";
import type { ScheduleProbableGame } from "../src/lib/mlb/build-starter-dataset";
import {
  DATE_KST,
  FROZEN_FORMAL_OBSERVED_AT,
  LOCK_REL,
  sha256File,
} from "./lock-2026-08-30-daily-scope-v1";
import { SEALED_2026_08_29 } from "./intake-2026-08-30-batch-2118-operator-pregame-observations";
import {
  B1_REL,
  REQUIRED_UNRESOLVED,
  SEALED_B1_SHA256,
  SEALED_REGISTRY,
  SEALED_STAGE_A,
} from "./audit-2026-08-30-schedule-identity-reconciliation-v1";
import { FIXTURES_CAPTURE_REL } from "./capture-2026-08-30-football-fixtures-v1";

export const B2_REL = "data/audits/2026-08-30-pregame-input-coverage-v1.json";
export const LINEUP_DATASET_REL = `data/research/mlb/${DATE_KST}-lineup-dataset-v1.json`;
export const MLB_SCHEDULE_REL = `data/research/mlb/${DATE_KST}-schedule-v1.json`;
export const B2_BASE_COMMIT =
  "ae9be156bbbf9220b87cf79f63d4aa7731c0abfd";
export const CANDIDATE_B2_SHA256 =
  "0d63f9a8ae2d39453f1c7e4819c843283b50416a5087b727165560523df5780b";
export const SEALED_B2_SHA256 =
  "78c8a98d12df9b5284530408cfa2006ca138062d63f6db353c6c4b0869f2b118";
export const B2_OWNER_REVIEW_STATUS = "APPROVED";
export const B2_NEXT_RECOMMENDED_STEP =
  "C Prediction/PASS reconciliation and Pregame Snapshot.";

type FootballB1Row = {
  rawLeagueLabel: string;
  displayedDateKst: string;
  displayedKickoffKst: string;
  rawHome: string;
  rawAway: string;
  identityStatus: string;
  providerFixtureId: string | null;
  providerHomeTeamId: string | null;
  providerAwayTeamId: string | null;
  providerHomeTeamName: string | null;
  providerAwayTeamName: string | null;
};

type MlbB1Row = {
  displayedDateKst: string;
  displayedKickoffKst: string;
  rawHome: string;
  rawAway: string;
  identityStatus: string;
  providerFixtureId: string;
  gamePk: number | null;
};

type ProviderCall = {
  provider: string;
  endpointFamily: string;
  purpose: string;
  calledAt: string;
  cached: boolean;
  network: boolean;
  responseStatus: string;
  resultCount: number | null;
};

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertUnchanged(
  cwd: string,
  items: ReadonlyArray<{ rel: string; sha256: string }>,
  label: string,
) {
  for (const sealed of items) {
    const sha = sha256File(path.join(cwd, sealed.rel));
    if (sha !== sealed.sha256) throw new Error(`${label}_MUTATED: ${sealed.rel}`);
  }
}

function operatorGameId(
  sport: string,
  date: string,
  kickoff: string,
  home: string,
  away: string,
): string {
  return `${sport}|${date}|${kickoff}|${home}|${away}`;
}

function kickoffIso(dateKst: string, hhmm: string): string {
  return `${dateKst}T${hhmm}:00.000+09:00`;
}

function latestObservation(
  cwd: string,
  relDir: string,
): FootballRawPointInTimeObservationV1 | null {
  const absDir = path.join(cwd, relDir);
  if (!existsSync(absDir)) return null;
  const files = readdirSync(absDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (files.length === 0) return null;
  return JSON.parse(
    readFileSync(path.join(absDir, files[files.length - 1]!), "utf8"),
  ) as FootballRawPointInTimeObservationV1;
}

function lineupPublished(raw: unknown): boolean {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { response?: unknown }).response)
      ? ((raw as { response: unknown[] }).response)
      : [];
  const withXi = rows.filter((row) => {
    const startXI = (row as { startXI?: unknown[] }).startXI;
    return Array.isArray(startXI) && startXI.length >= 11;
  });
  return withXi.length >= 2;
}

function injuryRowCount(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  if (raw && typeof raw === "object" && Array.isArray((raw as { response?: unknown }).response)) {
    return ((raw as { response: unknown[] }).response).length;
  }
  return 0;
}

async function persistFootballObservation(input: {
  cwd: string;
  kind: "LINEUPS" | "INJURIES";
  fixtureId: string;
  kickoffIso: string;
  observedAt: string;
  raw: unknown;
}): Promise<{ rel: string; observation: FootballRawPointInTimeObservationV1 }> {
  const temporal = classifyFootballObservationPhase({
    observedAt: input.observedAt,
    fixtureKickoff: input.kickoffIso,
  });
  if (!temporal.isBeforeKickoff) {
    throw new Error(`POST_START_NOT_ADMITTED:${input.kind}:${input.fixtureId}`);
  }
  const observation: FootballRawPointInTimeObservationV1 = {
    schemaVersion: "yang-edge-football-raw-observation-v1",
    observationId: `${input.kind.toLowerCase()}-${input.fixtureId}-${input.observedAt}`,
    kind: input.kind,
    provider: "api-football",
    endpoint: input.kind === "LINEUPS" ? "/fixtures/lineups" : "/injuries",
    providerFixtureId: input.fixtureId,
    observedAt: input.observedAt,
    fixtureKickoff: input.kickoffIso,
    isBeforeKickoff: temporal.isBeforeKickoff,
    pregameEligible: temporal.pregameEligible,
    observationPhase: temporal.observationPhase,
    appendOnly: true,
    overwriteForbidden: true,
    predictionInput: false,
    engineInput: false,
    researchOnly: true,
    syntheticTestData: false,
    raw: input.raw,
  };
  const rel =
    input.kind === "LINEUPS"
      ? footballLineupsObservationRel({
          providerFixtureId: input.fixtureId,
          observedAt: input.observedAt,
        })
      : footballInjuriesObservationRel({
          providerFixtureId: input.fixtureId,
          observedAt: input.observedAt,
        });
  const abs = path.join(input.cwd, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `${JSON.stringify(observation, null, 2)}\n`, "utf8");
  return { rel, observation };
}

function mlbLineupState(
  doc: LineupDatasetDocument | null,
  gamePk: number | null,
): { state: string; reason: string } {
  if (!doc || gamePk == null) {
    return {
      state: "NOT_YET_AVAILABLE",
      reason: "No lineup dataset row for this official gamePk.",
    };
  }
  const sides = doc.rows.filter((r) => r.gamePk === gamePk);
  if (sides.length === 0) {
    return {
      state: "NOT_YET_AVAILABLE",
      reason: "Schedule lineup hydrate did not include this gamePk.",
    };
  }
  const confirmed = sides.filter((r) => r.confirmed === true || r.collectionStatus === "CONFIRMED");
  if (confirmed.length >= 2 && confirmed.every((r) => (r.battingOrder?.length ?? 0) >= 8)) {
    return { state: "CONFIRMED_LINEUP", reason: "Official Stats API lineup posted for both sides." };
  }
  if (sides.every((r) => r.collectionStatus === "NOT_RELEASED" || (r.battingOrder?.length ?? 0) === 0)) {
    return {
      state: "NOT_YET_AVAILABLE",
      reason: "Stats API hydrate=lineups has not published a confirmed batting order.",
    };
  }
  return {
    state: "NOT_YET_AVAILABLE",
    reason: `Lineup collectionStatus=${sides.map((s) => s.collectionStatus ?? "unknown").join(",")}`,
  };
}

export async function runB2(cwd = process.cwd()) {
  const existingAbs = path.join(cwd, B2_REL);
  if (existsSync(existingAbs)) {
    const existing = JSON.parse(readFileSync(existingAbs, "utf8")) as {
      candidateStatus?: string;
    };
    if (existing.candidateStatus === "SEALED") {
      assertUnchanged(cwd, SEALED_STAGE_A, "SEALED_2026_08_30_STAGE_A");
      assertUnchanged(cwd, SEALED_2026_08_29, "SEALED_2026_08_29");
      return {
        document: existing,
        rel: B2_REL,
        sha256: sha256File(existingAbs),
      };
    }
  }
  assertUnchanged(cwd, SEALED_STAGE_A, "SEALED_2026_08_30_STAGE_A");
  assertUnchanged(cwd, SEALED_2026_08_29, "SEALED_2026_08_29");
  assertUnchanged(cwd, SEALED_REGISTRY, "SEALED_FOOTBALL_REGISTRY");
  const b1Abs = path.join(cwd, B1_REL);
  const b1Sha = sha256File(b1Abs);
  if (b1Sha !== SEALED_B1_SHA256) throw new Error("SEALED_B1_MUTATED");

  const b1 = JSON.parse(readFileSync(b1Abs, "utf8")) as {
    rows: FootballB1Row[];
    mlbPreserved: MlbB1Row[];
    summary: { officialScopeTotal: number; footballMatched: number };
    formalObservedAt: string;
  };
  if (b1.formalObservedAt !== FROZEN_FORMAL_OBSERVED_AT) {
    throw new Error("FORMAL_OBSERVED_AT_MUTATED");
  }
  if (b1.mlbPreserved.length !== 15) throw new Error("MLB_B1_COUNT");
  if (b1.rows.length !== 29) throw new Error("FOOTBALL_B1_COUNT");
  const footballMatched = b1.rows.filter((r) =>
    r.identityStatus.startsWith("MATCHED_"),
  );
  const footballBlocked = b1.rows.filter(
    (r) => r.identityStatus === "IDENTITY_REVIEW_REQUIRED",
  );
  if (footballMatched.length !== 16) throw new Error("FOOTBALL_MATCHED_NOT_16");
  if (footballBlocked.length !== 13) throw new Error("FOOTBALL_BLOCKED_NOT_13");
  for (const [league, kickoff, home, away] of REQUIRED_UNRESOLVED) {
    const row = footballBlocked.find(
      (r) =>
        r.rawLeagueLabel === league &&
        r.displayedKickoffKst === kickoff &&
        r.rawHome === home &&
        r.rawAway === away,
    );
    if (!row) throw new Error(`UNRESOLVED_ROW_MISSING:${home}:${away}`);
    if (row.providerFixtureId != null) {
      throw new Error(`UNRESOLVED_HAS_FIXTURE_ID:${home}:${away}`);
    }
  }
  if (resolveFootballProviderKind() === "dummy") {
    throw new Error("DUMMY_FOOTBALL_PROVIDER_FORBIDDEN");
  }

  const capturedAt = new Date().toISOString();
  const providerCalls: ProviderCall[] = [];
  let lastFootballNetworkAt = 0;

  const mlbUsage = createCacheUsage();
  const mlbNetworkBefore = mlbUsage.networkCalls;
  const scheduleProbables: ScheduleProbableGame[] =
    await fetchMlbScheduleForDateKst(DATE_KST, mlbUsage);
  providerCalls.push({
    provider: "mlb-stats-api",
    endpointFamily: "/api/v1/schedule?hydrate=probablePitcher",
    purpose: "Extract probable starters for official MLB games",
    calledAt: capturedAt,
    cached: mlbUsage.networkCalls === mlbNetworkBefore,
    network: mlbUsage.networkCalls > mlbNetworkBefore,
    responseStatus: "ok",
    resultCount: scheduleProbables.length,
  });

  let lineupDoc: LineupDatasetDocument | null = null;
  const lineupAbs = path.join(cwd, LINEUP_DATASET_REL);
  if (existsSync(lineupAbs)) {
    lineupDoc = JSON.parse(readFileSync(lineupAbs, "utf8")) as LineupDatasetDocument;
    providerCalls.push({
      provider: "mlb-stats-api",
      endpointFamily: "/api/v1/schedule?hydrate=probablePitcher,lineups",
      purpose: "Reuse stored MLB lineup dataset",
      calledAt: capturedAt,
      cached: true,
      network: false,
      responseStatus: "cached-artifact",
      resultCount: lineupDoc.rows.length,
    });
  } else {
    const built = await buildLineupDatasetV1({
      dateKst: DATE_KST,
      allowNetwork: true,
    });
    await writeJsonAtomic(lineupAbs, built.document);
    lineupDoc = built.document;
    providerCalls.push({
      provider: "mlb-stats-api",
      endpointFamily: "/api/v1/schedule?hydrate=probablePitcher,lineups",
      purpose: "Collect official MLB lineups via existing lineup-dataset builder",
      calledAt: capturedAt,
      cached: built.usage.networkCalls === 0,
      network: built.usage.networkCalls > 0,
      responseStatus: "ok",
      resultCount: built.document.rows.length,
    });
  }

  const footballProvider = getFootballProvider();
  const footballLineupByFixture = new Map<
    string,
    { state: string; rel: string | null; playerCount: number }
  >();
  const footballInjuryByFixture = new Map<
    string,
    { state: string; rel: string | null; rowCount: number }
  >();

  for (const row of footballMatched) {
    const fixtureId = String(row.providerFixtureId);
    const kickoff = kickoffIso(row.displayedDateKst, row.displayedKickoffKst);
    if (Date.parse(capturedAt) >= Date.parse(kickoff)) {
      footballLineupByFixture.set(fixtureId, {
        state: "POST_START_NOT_ADMITTED",
        rel: null,
        playerCount: 0,
      });
      footballInjuryByFixture.set(fixtureId, {
        state: "POST_START_NOT_ADMITTED",
        rel: null,
        rowCount: 0,
      });
      continue;
    }

    const lineupDir = `data/research/football/raw/player-xi-v1/lineups/${fixtureId}`;
    let lineupObs = latestObservation(cwd, lineupDir);
    if (!lineupObs) {
      try {
        const waitMs = 6500 - (Date.now() - lastFootballNetworkAt);
        if (lastFootballNetworkAt > 0 && waitMs > 0) await sleep(waitMs);
        const fetched = await footballProvider.getLineups({
          fixtureId: Number(fixtureId),
        });
        if (!fetched.cached) lastFootballNetworkAt = Date.now();
        const observedAt = new Date().toISOString();
        if (Date.parse(observedAt) >= Date.parse(kickoff)) {
          footballLineupByFixture.set(fixtureId, {
            state: "POST_START_NOT_ADMITTED",
            rel: null,
            playerCount: 0,
          });
          footballInjuryByFixture.set(fixtureId, {
            state: "POST_START_NOT_ADMITTED",
            rel: null,
            rowCount: 0,
          });
          providerCalls.push({
            provider: "api-football",
            endpointFamily: "/fixtures/lineups",
            purpose: `Pregame lineup probe fixture ${fixtureId}`,
            calledAt: observedAt,
            cached: fetched.cached,
            network: !fetched.cached,
            responseStatus: "POST_START_NOT_ADMITTED",
            resultCount: Array.isArray(fetched.raw) ? fetched.raw.length : null,
          });
          continue;
        }
        const saved = await persistFootballObservation({
          cwd,
          kind: "LINEUPS",
          fixtureId,
          kickoffIso: kickoff,
          observedAt,
          raw: fetched.raw,
        });
        lineupObs = saved.observation;
        providerCalls.push({
          provider: "api-football",
          endpointFamily: "/fixtures/lineups",
          purpose: `Pregame lineup probe fixture ${fixtureId}`,
          calledAt: observedAt,
          cached: fetched.cached,
          network: !fetched.cached,
          responseStatus: "ok",
          resultCount: Array.isArray(fetched.raw) ? fetched.raw.length : null,
        });
      } catch (e) {
        providerCalls.push({
          provider: "api-football",
          endpointFamily: "/fixtures/lineups",
          purpose: `Pregame lineup probe fixture ${fixtureId}`,
          calledAt: capturedAt,
          cached: false,
          network: true,
          responseStatus: e instanceof Error ? e.message : "error",
          resultCount: null,
        });
      }
    }
    if (lineupObs) {
      const published = lineupPublished(lineupObs.raw);
      footballLineupByFixture.set(fixtureId, {
        state: published ? "CONFIRMED_AVAILABLE" : "NOT_YET_AVAILABLE",
        rel: footballLineupsObservationRel({
          providerFixtureId: fixtureId,
          observedAt: lineupObs.observedAt,
        }),
        playerCount: published ? 22 : 0,
      });
    } else if (!footballLineupByFixture.has(fixtureId)) {
      footballLineupByFixture.set(fixtureId, {
        state: "NOT_COLLECTED_PROVIDER_GAP",
        rel: null,
        playerCount: 0,
      });
    }

    const injuryDir = `data/research/football/raw/player-xi-v1/injuries/${fixtureId}`;
    let injuryObs = latestObservation(cwd, injuryDir);
    if (!injuryObs) {
      try {
        const waitMs = 6500 - (Date.now() - lastFootballNetworkAt);
        if (lastFootballNetworkAt > 0 && waitMs > 0) await sleep(waitMs);
        const fetched = await footballProvider.getInjuries({
          fixtureId: Number(fixtureId),
        });
        if (!fetched.cached) lastFootballNetworkAt = Date.now();
        const observedAt = new Date().toISOString();
        if (Date.parse(observedAt) >= Date.parse(kickoff)) {
          footballInjuryByFixture.set(fixtureId, {
            state: "POST_START_NOT_ADMITTED",
            rel: null,
            rowCount: 0,
          });
          providerCalls.push({
            provider: "api-football",
            endpointFamily: "/injuries",
            purpose: `Pregame injury probe fixture ${fixtureId}`,
            calledAt: observedAt,
            cached: fetched.cached,
            network: !fetched.cached,
            responseStatus: "POST_START_NOT_ADMITTED",
            resultCount: injuryRowCount(fetched.raw),
          });
          continue;
        }
        const saved = await persistFootballObservation({
          cwd,
          kind: "INJURIES",
          fixtureId,
          kickoffIso: kickoff,
          observedAt,
          raw: fetched.raw,
        });
        injuryObs = saved.observation;
        providerCalls.push({
          provider: "api-football",
          endpointFamily: "/injuries",
          purpose: `Pregame injury probe fixture ${fixtureId}`,
          calledAt: observedAt,
          cached: fetched.cached,
          network: !fetched.cached,
          responseStatus: "ok",
          resultCount: injuryRowCount(fetched.raw),
        });
      } catch (e) {
        providerCalls.push({
          provider: "api-football",
          endpointFamily: "/injuries",
          purpose: `Pregame injury probe fixture ${fixtureId}`,
          calledAt: capturedAt,
          cached: false,
          network: true,
          responseStatus: e instanceof Error ? e.message : "error",
          resultCount: null,
        });
      }
    }
    if (injuryObs) {
      footballInjuryByFixture.set(fixtureId, {
        state: "COLLECTED",
        rel: footballInjuriesObservationRel({
          providerFixtureId: fixtureId,
          observedAt: injuryObs.observedAt,
        }),
        rowCount: injuryRowCount(injuryObs.raw),
      });
    } else if (!footballInjuryByFixture.has(fixtureId)) {
      footballInjuryByFixture.set(fixtureId, {
        state: "NOT_COLLECTED_PROVIDER_GAP",
        rel: null,
        rowCount: 0,
      });
    }
  }

  const mlbStarters: Array<{
    gamePk: number;
    rawMatchup: string;
    side: "home" | "away";
    providerPlayerId: number | null;
    name: string | null;
    status: "PROBABLE";
    source: string;
    capturedAt: string;
  }> = [];

  const mlbGames = b1.mlbPreserved.map((row) => {
    const gamePk = row.gamePk;
    const probable = scheduleProbables.find((g) => g.gamePk === gamePk);
    const homeStarter = probable?.probableHome;
    const awayStarter = probable?.probableAway;
    const starterState =
      (homeStarter?.id != null || homeStarter?.fullName) &&
      (awayStarter?.id != null || awayStarter?.fullName)
        ? "COLLECTED_PROBABLE"
        : homeStarter?.id || awayStarter?.id
          ? "COLLECTED_PROBABLE"
          : "NOT_YET_AVAILABLE";
    if (homeStarter && (homeStarter.id != null || homeStarter.fullName)) {
      mlbStarters.push({
        gamePk: gamePk ?? -1,
        rawMatchup: `${row.rawHome} : ${row.rawAway}`,
        side: "home",
        providerPlayerId: homeStarter.id,
        name: homeStarter.fullName,
        status: "PROBABLE",
        source: "mlb-stats-api:/schedule hydrate=probablePitcher",
        capturedAt,
      });
    }
    if (awayStarter && (awayStarter.id != null || awayStarter.fullName)) {
      mlbStarters.push({
        gamePk: gamePk ?? -1,
        rawMatchup: `${row.rawHome} : ${row.rawAway}`,
        side: "away",
        providerPlayerId: awayStarter.id,
        name: awayStarter.fullName,
        status: "PROBABLE",
        source: "mlb-stats-api:/schedule hydrate=probablePitcher",
        capturedAt,
      });
    }
    const lineup = mlbLineupState(lineupDoc, gamePk);
    const datasets: Record<string, string> = {
      schedule: "COLLECTED",
      starter: starterState,
      bullpen: "NOT_COLLECTED_PROVIDER_GAP",
      lineup: lineup.state,
      injury: "NOT_COLLECTED_PROVIDER_GAP",
      weather: "NOT_SUPPORTED",
      travelRest: "NOT_COLLECTED_PROVIDER_GAP",
      lineupRefresh: "NOT_YET_AVAILABLE",
    };
    const missing = Object.entries(datasets)
      .filter(([, v]) => v !== "COLLECTED" && v !== "COLLECTED_PROBABLE" && v !== "CONFIRMED_LINEUP")
      .map(([k]) => k);
    const notYet = Object.entries(datasets)
      .filter(([, v]) => v === "NOT_YET_AVAILABLE")
      .map(([k]) => k);
    const coverageState =
      missing.length === 0 ? "COMPLETE" : starterState.startsWith("COLLECTED") ? "PARTIAL" : "MINIMAL";
    return {
      operatorGameId: operatorGameId(
        "MLB",
        row.displayedDateKst,
        row.displayedKickoffKst,
        row.rawHome,
        row.rawAway,
      ),
      sport: "MLB",
      rawMatchup: `${row.rawHome} : ${row.rawAway}`,
      b1IdentityStatus: row.identityStatus,
      providerGameId: String(gamePk ?? row.providerFixtureId),
      scheduledStartAt: kickoffIso(row.displayedDateKst, row.displayedKickoffKst),
      capturedAt,
      availableBeforeKickoff:
        Date.parse(capturedAt) <
        Date.parse(kickoffIso(row.displayedDateKst, row.displayedKickoffKst)),
      coverageState,
      datasets,
      missingDatasets: missing,
      notYetAvailableDatasets: notYet,
      blockReason: null,
      starters: {
        home: homeStarter ?? null,
        away: awayStarter ?? null,
        status: "PROBABLE" as const,
      },
    };
  });

  const footballMatchedGames = footballMatched.map((row) => {
    const fixtureId = String(row.providerFixtureId);
    const lineup = footballLineupByFixture.get(fixtureId);
    const injury = footballInjuryByFixture.get(fixtureId);
    const datasets: Record<string, string> = {
      fixture: "COLLECTED",
      lineup: lineup?.state ?? "NOT_COLLECTED_PROVIDER_GAP",
      injury: injury?.state ?? "NOT_COLLECTED_PROVIDER_GAP",
      player: "NOT_COLLECTED_PROVIDER_GAP",
      squad: "NOT_COLLECTED_PROVIDER_GAP",
      coach: "NOT_COLLECTED_PROVIDER_GAP",
    };
    const missing = Object.entries(datasets)
      .filter(([, v]) => v !== "COLLECTED" && v !== "CONFIRMED_AVAILABLE")
      .map(([k]) => k);
    const notYet = Object.entries(datasets)
      .filter(([, v]) => v === "NOT_YET_AVAILABLE")
      .map(([k]) => k);
    const coverageState =
      missing.length === 0
        ? "COMPLETE"
        : datasets.lineup === "CONFIRMED_AVAILABLE" || datasets.injury === "COLLECTED"
          ? "PARTIAL"
          : "MINIMAL";
    return {
      operatorGameId: operatorGameId(
        "FOOTBALL",
        row.displayedDateKst,
        row.displayedKickoffKst,
        row.rawHome,
        row.rawAway,
      ),
      sport: "FOOTBALL",
      rawMatchup: `${row.rawHome} : ${row.rawAway}`,
      b1IdentityStatus: row.identityStatus,
      providerGameId: fixtureId,
      scheduledStartAt: kickoffIso(row.displayedDateKst, row.displayedKickoffKst),
      capturedAt,
      availableBeforeKickoff:
        Date.parse(capturedAt) <
        Date.parse(kickoffIso(row.displayedDateKst, row.displayedKickoffKst)),
      coverageState,
      datasets,
      missingDatasets: missing,
      notYetAvailableDatasets: notYet,
      blockReason: null,
      lineupRel: lineup?.rel ?? null,
      injuryRel: injury?.rel ?? null,
    };
  });

  const footballBlockedGames = footballBlocked.map((row) => ({
    operatorGameId: operatorGameId(
      "FOOTBALL",
      row.displayedDateKst,
      row.displayedKickoffKst,
      row.rawHome,
      row.rawAway,
    ),
    sport: "FOOTBALL",
    rawMatchup: `${row.rawHome} : ${row.rawAway}`,
    b1IdentityStatus: row.identityStatus,
    providerGameId: null,
    scheduledStartAt: kickoffIso(row.displayedDateKst, row.displayedKickoffKst),
    capturedAt,
    availableBeforeKickoff: true,
    coverageState: "BLOCKED_IDENTITY_REVIEW_REQUIRED",
    datasets: {
      fixture: "BLOCKED_IDENTITY_REVIEW_REQUIRED",
      lineup: "BLOCKED_IDENTITY_REVIEW_REQUIRED",
      injury: "BLOCKED_IDENTITY_REVIEW_REQUIRED",
      player: "BLOCKED_IDENTITY_REVIEW_REQUIRED",
      squad: "BLOCKED_IDENTITY_REVIEW_REQUIRED",
      coach: "BLOCKED_IDENTITY_REVIEW_REQUIRED",
    },
    missingDatasets: ["fixture", "lineup", "injury", "player", "squad", "coach"],
    notYetAvailableDatasets: [],
    blockReason:
      "Multiple provider fixtures exist in the same canonical competition at this kickoff and neither operator label has sufficient sealed identity evidence. No guessed providerFixtureId.",
  }));

  const games = [...mlbGames, ...footballMatchedGames, ...footballBlockedGames];
  if (games.length !== 44) throw new Error("B2_GAME_COUNT");

  const countState = (state: string) =>
    games.filter((g) => g.coverageState === state).length;
  const footballLineupConfirmed = [...footballLineupByFixture.values()].filter(
    (v) => v.state === "CONFIRMED_AVAILABLE",
  ).length;
  const footballLineupNotYet = [...footballLineupByFixture.values()].filter(
    (v) => v.state === "NOT_YET_AVAILABLE",
  ).length;

  const coverageByDataset = {
    mlb: {
      schedule: {
        state: "COLLECTED",
        gamesCovered: 15,
        probable: 0,
        confirmed: 15,
        notYetAvailable: 0,
        providerGap: 0,
        reason: "Sealed 2026-08-30 MLB schedule artifact.",
        rel: MLB_SCHEDULE_REL,
      },
      starter: {
        state: mlbStarters.length > 0 ? "COLLECTED_PROBABLE" : "NOT_YET_AVAILABLE",
        gamesCovered: mlbGames.filter((g) => g.datasets.starter.startsWith("COLLECTED")).length,
        probable: mlbGames.filter((g) => g.datasets.starter === "COLLECTED_PROBABLE").length,
        confirmed: 0,
        notYetAvailable: mlbGames.filter((g) => g.datasets.starter === "NOT_YET_AVAILABLE").length,
        providerGap: 0,
        reason:
          "Probable pitchers extracted from Stats API schedule hydrate=probablePitcher. Not relabeled CONFIRMED. Full starter-dataset-v1 gameLog fan-out was not run.",
      },
      bullpen: {
        state: "NOT_COLLECTED_PROVIDER_GAP",
        gamesCovered: 0,
        probable: 0,
        confirmed: 0,
        notYetAvailable: 0,
        providerGap: 15,
        reason:
          "Existing bullpen-role builder reconstructs roles from prior appearance logs. B2 does not treat that as a current pregame bullpen feed.",
      },
      lineup: {
        state: mlbGames.some((g) => g.datasets.lineup === "CONFIRMED_LINEUP")
          ? "PARTIAL"
          : "NOT_YET_AVAILABLE",
        gamesCovered: mlbGames.filter((g) => g.datasets.lineup === "CONFIRMED_LINEUP").length,
        probable: 0,
        confirmed: mlbGames.filter((g) => g.datasets.lineup === "CONFIRMED_LINEUP").length,
        notYetAvailable: mlbGames.filter((g) => g.datasets.lineup === "NOT_YET_AVAILABLE").length,
        providerGap: 0,
        reason: "Existing lineup-dataset-v1 builder via Stats API hydrate=lineups. EXPECTED lineups were not invented.",
        rel: LINEUP_DATASET_REL,
      },
      injury: {
        state: "NOT_COLLECTED_PROVIDER_GAP",
        gamesCovered: 0,
        probable: 0,
        confirmed: 0,
        notYetAvailable: 0,
        providerGap: 15,
        reason:
          "Existing injury-dataset-v1 builder fans out 40-man roster calls. Not invoked in B2 to avoid per-team over-collection.",
      },
      weather: {
        state: "NOT_SUPPORTED",
        gamesCovered: 0,
        probable: 0,
        confirmed: 0,
        notYetAvailable: 0,
        providerGap: 15,
        reason: "Weather dataset builder has forecast provider NOT_SELECTED. No lawful current weather source is wired.",
      },
      travelRest: {
        state: "NOT_COLLECTED_PROVIDER_GAP",
        gamesCovered: 0,
        probable: 0,
        confirmed: 0,
        notYetAvailable: 0,
        providerGap: 15,
        reason:
          "Existing travel-rest builder requires a Prediction snapshot file which B2 must not create.",
      },
      lineupRefresh: {
        state: "NOT_YET_AVAILABLE",
        gamesCovered: 0,
        probable: 0,
        confirmed: 0,
        notYetAvailable: 15,
        providerGap: 0,
        reason: "No 2026-08-30 lineup-refresh manifest / operator lineup screenshots.",
      },
    },
    football: {
      fixture: {
        state: "COLLECTED",
        gamesCovered: 16,
        reason: "Sealed B1 identity + stored API-Football date-window capture.",
        rel: FIXTURES_CAPTURE_REL,
      },
      lineup: {
        state: footballLineupConfirmed > 0 ? "PARTIAL" : "NOT_YET_AVAILABLE",
        gamesCovered: footballLineupConfirmed,
        confirmed: footballLineupConfirmed,
        notYetAvailable: footballLineupNotYet,
        reason:
          "Existing getLineups contract. Empty/pre-release responses classified NOT_YET_AVAILABLE, not confirmed-empty.",
      },
      injury: {
        state: "COLLECTED",
        gamesCovered: [...footballInjuryByFixture.values()].filter((v) => v.state === "COLLECTED").length,
        reason: "Existing getInjuries({ fixtureId }) contract for matched fixtures only.",
      },
      player: {
        state: "NOT_COLLECTED_PROVIDER_GAP",
        gamesCovered: 0,
        reason: "P1 /players is per-team paginated. Not fan-out collected in B2.",
      },
      squad: {
        state: "NOT_COLLECTED_PROVIDER_GAP",
        gamesCovered: 0,
        reason: "P1 /players/squads is per-team. Not fan-out collected in B2.",
      },
      coach: {
        state: "NOT_COLLECTED_PROVIDER_GAP",
        gamesCovered: 0,
        reason: "P1 /coachs is per-team. Not fan-out collected in B2.",
      },
    },
  };

  const document = {
    schemaVersion: "yang-edge-pregame-input-coverage-v1",
    dateKst: DATE_KST,
    stage: "B2",
    candidateStatus: "OWNER_REVIEW_CANDIDATE",
    generatedAt: capturedAt,
    baseCommit: B2_BASE_COMMIT,
    b1Rel: B1_REL,
    b1Sha256: b1Sha,
    sealedLockRel: LOCK_REL,
    sealedLockSha256: sha256File(path.join(cwd, LOCK_REL)),
    formalObservedAt: FROZEN_FORMAL_OBSERVED_AT,
    formalObservedAtChanged: false,
    researchOnly: true,
    predictionInput: false,
    engineInput: false,
    marketFirewall: {
      marketBenchmarkOnly: true,
      predictionInput: false,
      engineInput: false,
      marketPriorUsed: false,
      marketImpliedProbabilityUsed: false,
      favoriteStatusUsed: false,
      oddsApiLiveCalls: 0,
      note: "Operator odds remain marketBenchmarkOnly. Coverage was not prioritized by favorite status.",
    },
    providerCalls,
    resultCalls: 0,
    predictionProviderCalls: 0,
    engineCalls: 0,
    engineModified: false,
    weightsModified: false,
    fuzzyMatchingUsed: false,
    resultDataUsed: false,
    summary: {
      officialScopeTotal: 44,
      identityMatchedTotal: 31,
      MLBMatched: 15,
      FootballMatched: 16,
      FootballIdentityBlocked: 13,
      coverageComplete: countState("COMPLETE"),
      coveragePartial: countState("PARTIAL"),
      coverageMinimal: countState("MINIMAL"),
      coverageBlocked: countState("BLOCKED_IDENTITY_REVIEW_REQUIRED"),
      pregameEligibleForNextStage: 31,
      footballLineupConfirmed,
      footballLineupNotYetAvailable: footballLineupNotYet,
      note: "pregameEligibleForNextStage means identity + schedule/fixture coverage for Stage C inspection. It is not official-recommendation eligibility.",
    },
    coverageBySport: {
      MLB: { official: 15, matched: 15, blocked: 0 },
      FOOTBALL: { official: 29, matched: 16, blocked: 13 },
    },
    coverageByDataset,
    mlbProbableStarters: mlbStarters,
    games,
    historicalFirewall: {
      stageAUnchanged: true,
      b1Unchanged: true,
      sealed20260829Unchanged: true,
      stageA: SEALED_STAGE_A,
      b1: { rel: B1_REL, sha256: SEALED_B1_SHA256 },
      sealed20260829: SEALED_2026_08_29,
      registriesUnchanged: SEALED_REGISTRY,
    },
    nextRecommendedStep: B2_NEXT_RECOMMENDED_STEP,
  };

  const abs = path.join(cwd, B2_REL);
  await mkdir(path.dirname(abs), { recursive: true });
  const body = `${JSON.stringify(document, null, 2)}\n`;
  await writeFile(abs, body, "utf8");
  assertUnchanged(cwd, SEALED_STAGE_A, "SEALED_2026_08_30_STAGE_A_AFTER_WRITE");
  if (sha256File(b1Abs) !== SEALED_B1_SHA256) throw new Error("B1_MUTATED_AFTER_B2");
  assertUnchanged(cwd, SEALED_2026_08_29, "SEALED_2026_08_29_AFTER_WRITE");

  return { document, rel: B2_REL, sha256: sha256Text(body) };
}

async function main() {
  const result = await runB2();
  console.log(`wrote ${result.rel}`);
  console.log(
    JSON.stringify(
      {
        sha256: result.sha256,
        summary: result.document.summary,
        providerCallCount: result.document.providerCalls.length,
        networkCalls: result.document.providerCalls.filter((c) => c.network).length,
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
