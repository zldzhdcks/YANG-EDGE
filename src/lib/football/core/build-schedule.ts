/**
 * Football Schedule Dataset v1 builder.
 * Provider → Adapter → Schedule artifact.
 * Future Prediction must consume this artifact, never the Provider.
 */
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import type { FixtureRaw } from "../types";
import { computeFootballScheduleArtifactHash } from "./hash";
import { rejoinFootballScheduleRow } from "./identity";
import { normalizeFixtureToScheduleRow } from "./normalize";
import { footballScheduleV1Rel } from "./paths";
import {
  FOOTBALL_CORE_IDENTITY_VERSION,
  FOOTBALL_SCHEDULE_V1_BUILDER,
  FOOTBALL_SCHEDULE_V1_SCHEMA,
  type FootballScheduleArtifactV1,
  type FootballScheduleRowV1,
} from "./types";

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

export function assembleFootballScheduleArtifact(input: {
  dateKst: string;
  generatedAt: string;
  fixtures: FixtureRaw[];
  provider?: "api-football";
}): {
  document: FootballScheduleArtifactV1;
  droppedUnregisteredCompetition: number;
} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKst)) {
    throw new Error("SCHEDULE_DATE_KST_INVALID");
  }
  const provider = input.provider ?? "api-football";
  const seenFixture = new Set<string>();
  const seenMatchId = new Set<string>();
  const rows: FootballScheduleRowV1[] = [];
  let droppedUnregisteredCompetition = 0;

  for (const fixture of input.fixtures) {
    const normalized = normalizeFixtureToScheduleRow({
      fixture,
      dateKst: input.dateKst,
      provider,
    });
    if ("drop" in normalized) {
      droppedUnregisteredCompetition += 1;
      continue;
    }
    if (seenFixture.has(normalized.providerMatchId)) {
      throw new Error(
        `DUPLICATE_PROVIDER_MATCH_ID: ${normalized.providerMatchId}`,
      );
    }
    if (seenMatchId.has(normalized.matchId)) {
      throw new Error(`DUPLICATE_MATCH_ID: ${normalized.matchId}`);
    }
    seenFixture.add(normalized.providerMatchId);
    seenMatchId.add(normalized.matchId);
    rows.push(normalized);
  }

  rows.sort((a, b) => a.matchId.localeCompare(b.matchId));

  return {
    document: finalizeFootballScheduleDocument({
      dateKst: input.dateKst,
      generatedAt: input.generatedAt,
      provider,
      rows,
      droppedUnregisteredCompetition,
    }),
    droppedUnregisteredCompetition,
  };
}

export function finalizeFootballScheduleDocument(input: {
  dateKst: string;
  generatedAt: string;
  provider: "api-football";
  rows: FootballScheduleRowV1[];
  droppedUnregisteredCompetition: number;
}): FootballScheduleArtifactV1 {
  const identityMatched = input.rows.filter(
    (r) => r.identityStatus === "MATCHED",
  ).length;
  const identityBlocked = input.rows.length - identityMatched;
  const formatEligible = input.rows.filter(
    (r) => r.predictionEligibility === "ELIGIBLE_FORMAT",
  ).length;
  const formatNotSupported = input.rows.filter(
    (r) => r.predictionEligibility === "NOT_SUPPORTED_FORMAT",
  ).length;

  const withoutHash: Omit<FootballScheduleArtifactV1, "meta"> & {
    meta: Omit<FootballScheduleArtifactV1["meta"], "artifactHash">;
  } = {
    meta: {
      schemaVersion: FOOTBALL_SCHEDULE_V1_SCHEMA,
      builderVersion: FOOTBALL_SCHEDULE_V1_BUILDER,
      identityVersion: FOOTBALL_CORE_IDENTITY_VERSION,
      dateKst: input.dateKst,
      generatedAt: input.generatedAt,
      provider: input.provider,
      researchOnly: true,
      legalStatus: "NEEDS_LEGAL_REVIEW",
      scheduleGames: input.rows.length,
      identityMatched,
      identityBlocked,
      formatEligible,
      formatNotSupported,
      droppedUnregisteredCompetition: input.droppedUnregisteredCompetition,
    },
    rows: input.rows,
  };

  return {
    ...withoutHash,
    meta: {
      ...withoutHash.meta,
      artifactHash: computeFootballScheduleArtifactHash(withoutHash),
    },
  };
}

/**
 * Re-resolve team identity and competition-profile eligibility on an
 * existing Schedule v1 artifact. Does not refetch fixtures.
 * Preserves matchId and kickoff instant. Canonicalizes kickoffTimeUtc to UTC.
 */
export function rejoinFootballScheduleArtifact(input: {
  existing: FootballScheduleArtifactV1;
  generatedAt: string;
}): FootballScheduleArtifactV1 {
  if (input.existing.meta.schemaVersion !== FOOTBALL_SCHEDULE_V1_SCHEMA) {
    throw new Error(
      `SCHEDULE_SCHEMA_MISMATCH: ${input.existing.meta.schemaVersion}`,
    );
  }
  const dateKst = input.existing.meta.dateKst;
  const expectedCount = input.existing.rows.length;
  const expectedMatchIds = [...input.existing.rows]
    .map((r) => r.matchId)
    .sort((a, b) => a.localeCompare(b));
  const rows = input.existing.rows.map((row) =>
    rejoinFootballScheduleRow(row, dateKst),
  );
  rows.sort((a, b) => a.matchId.localeCompare(b.matchId));
  if (rows.length !== expectedCount) {
    throw new Error(
      `SCHEDULE_REJOIN_ROW_COUNT_CHANGED: ${expectedCount} → ${rows.length}`,
    );
  }
  for (let i = 0; i < expectedMatchIds.length; i++) {
    if (rows[i]!.matchId !== expectedMatchIds[i]) {
      throw new Error(
        `SCHEDULE_REJOIN_MATCH_ID_CHANGED: ${expectedMatchIds[i]} → ${rows[i]!.matchId}`,
      );
    }
  }
  return finalizeFootballScheduleDocument({
    dateKst: input.existing.meta.dateKst,
    generatedAt: input.generatedAt,
    provider: input.existing.meta.provider,
    rows,
    droppedUnregisteredCompetition:
      input.existing.meta.droppedUnregisteredCompetition,
  });
}

export async function buildFootballScheduleV1(input: {
  dateKst: string;
  cwd?: string;
  dryRun?: boolean;
  generatedAt?: string;
  fixtures: FixtureRaw[];
  source?: "api-football" | "dummy";
}): Promise<{
  document: FootballScheduleArtifactV1;
  wrote: boolean;
  outRel: string;
}> {
  if (input.source === "dummy") {
    throw new Error(
      "DUMMY_PROVIDER_NOT_RESEARCH: DummyFootballProvider cannot produce research schedule artifacts",
    );
  }
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const { document } = assembleFootballScheduleArtifact({
    dateKst: input.dateKst,
    generatedAt,
    fixtures: input.fixtures,
    provider: "api-football",
  });
  const outRel = footballScheduleV1Rel(input.dateKst);
  if (input.dryRun) {
    return { document, wrote: false, outRel };
  }
  const cwd = input.cwd ?? process.cwd();
  await writeJsonAtomic(path.join(cwd, outRel), document);
  return { document, wrote: true, outRel };
}

export async function rejoinFootballScheduleV1(input: {
  dateKst: string;
  cwd?: string;
  dryRun?: boolean;
  generatedAt?: string;
}): Promise<{
  document: FootballScheduleArtifactV1;
  wrote: boolean;
  outRel: string;
  before: {
    identityMatched: number;
    identityBlocked: number;
    formatEligible: number;
    formatNotSupported: number;
    scheduleGames: number;
  };
}> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateKst)) {
    throw new Error("SCHEDULE_DATE_KST_INVALID");
  }
  const cwd = input.cwd ?? process.cwd();
  const outRel = footballScheduleV1Rel(input.dateKst);
  const raw = await readFile(path.join(cwd, outRel), "utf8");
  const existing = JSON.parse(raw) as FootballScheduleArtifactV1;
  if (existing.meta.dateKst !== input.dateKst) {
    throw new Error(
      `SCHEDULE_DATE_MISMATCH: file=${existing.meta.dateKst} arg=${input.dateKst}`,
    );
  }
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const document = rejoinFootballScheduleArtifact({ existing, generatedAt });
  const before = {
    identityMatched: existing.meta.identityMatched,
    identityBlocked: existing.meta.identityBlocked,
    formatEligible: existing.meta.formatEligible,
    formatNotSupported: existing.meta.formatNotSupported,
    scheduleGames: existing.meta.scheduleGames,
  };
  if (input.dryRun) {
    return { document, wrote: false, outRel, before };
  }
  await writeJsonAtomic(path.join(cwd, outRel), document);
  return { document, wrote: true, outRel, before };
}
