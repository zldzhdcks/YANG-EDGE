/**
 * Build / load MLB Schedule Artifact v1 from MLB Stats API (research cache).
 */
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildGameId } from "../game-id";
import { instantToKst } from "../datetime/kst";
import {
  createCacheUsage,
  type CacheUsageStats,
} from "./research-stats-cache";
import { fetchMlbScheduleForDateKst } from "./load-mlb-schedule-targets";
import {
  MLB_SCHEDULE_BUILDER_VERSION,
  MLB_SCHEDULE_DATASET_ID,
  MLB_SCHEDULE_SCHEMA_VERSION,
  type MlbScheduleArtifactDocument,
  type MlbScheduleArtifactGame,
} from "./mlb-schedule-artifact-types";

export function mlbScheduleArtifactRel(dateKst: string): string {
  return `data/research/mlb/${dateKst}-schedule-v1.json`;
}

export function mlbScheduleArtifactPath(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return path.join(cwd, mlbScheduleArtifactRel(dateKst));
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export async function writeJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  const tmp = `${filePath}.tmp`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

export async function loadMlbScheduleArtifact(
  dateKst: string,
  cwd = process.cwd(),
): Promise<MlbScheduleArtifactDocument> {
  const filePath = mlbScheduleArtifactPath(dateKst, cwd);
  if (!(await fileExists(filePath))) {
    throw new Error(
      `SCHEDULE_ARTIFACT_MISSING: ${mlbScheduleArtifactRel(dateKst)}. Run schedule collector first (npm run research:mlb-schedule -- ${dateKst}).`,
    );
  }
  const raw = await readFile(filePath, "utf8");
  const doc = JSON.parse(raw) as MlbScheduleArtifactDocument;
  if (!doc?.meta || !Array.isArray(doc.games)) {
    throw new Error(
      `SCHEDULE_ARTIFACT_INVALID: ${mlbScheduleArtifactRel(dateKst)}`,
    );
  }
  if (doc.meta.dateKst !== dateKst) {
    throw new Error(
      `SCHEDULE_ARTIFACT_DATE_MISMATCH: file=${doc.meta.dateKst} expected=${dateKst}`,
    );
  }
  if (doc.games.length === 0) {
    throw new Error(
      `SCHEDULE_ARTIFACT_EMPTY: ${mlbScheduleArtifactRel(dateKst)} has 0 games.`,
    );
  }
  return doc;
}

export async function buildMlbScheduleArtifactV1(input: {
  dateKst: string;
  usage?: CacheUsageStats;
}): Promise<{
  document: MlbScheduleArtifactDocument;
  usage: CacheUsageStats;
  pathRel: string;
}> {
  const usage = input.usage ?? createCacheUsage();
  const scheduleAll = await fetchMlbScheduleForDateKst(input.dateKst, usage);
  const games: MlbScheduleArtifactGame[] = scheduleAll
    .map((g) => {
      const kst = instantToKst(g.commenceTimeUtc);
      const collectedAt = new Date().toISOString();
      return {
        internalGameId: buildGameId("MLB", g.homeTeam, g.awayTeam),
        gamePk: g.gamePk,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        startTimeKst: kst?.time?.slice(0, 5) ?? null,
        commenceTimeUtc: g.commenceTimeUtc,
        scheduledStartTime: g.commenceTimeUtc,
        officialDate: g.officialDate,
        statusAbstract: g.statusAbstract,
        statusDetailed: g.statusDetailed ?? null,
        codedGameState: g.codedGameState ?? null,
        collectedAt,
        source: "mlb-stats-api" as const,
        league: "MLB" as const,
      };
    })
    .sort((a, b) => a.internalGameId.localeCompare(b.internalGameId));

  if (games.length === 0) {
    throw new Error(
      `SCHEDULE_EMPTY: no MLB games for ${input.dateKst} from Stats API.`,
    );
  }

  const document: MlbScheduleArtifactDocument = {
    meta: {
      datasetId: MLB_SCHEDULE_DATASET_ID,
      schemaVersion: MLB_SCHEDULE_SCHEMA_VERSION,
      builderVersion: MLB_SCHEDULE_BUILDER_VERSION,
      dateKst: input.dateKst,
      generatedAt: new Date().toISOString(),
      source: "mlb-stats-api",
      researchOnly: true,
      engineAdmission: "PROHIBITED",
      engineConnected: false,
    },
    summary: { totalGames: games.length },
    games,
  };

  return {
    document,
    usage,
    pathRel: mlbScheduleArtifactRel(input.dateKst),
  };
}

export async function saveMlbScheduleArtifactV1(
  dateKst: string,
): Promise<{
  document: MlbScheduleArtifactDocument;
  pathRel: string;
  usage: CacheUsageStats;
}> {
  const built = await buildMlbScheduleArtifactV1({ dateKst });
  const outPath = mlbScheduleArtifactPath(dateKst);
  await writeJsonAtomic(outPath, built.document);
  return {
    document: built.document,
    pathRel: built.pathRel,
    usage: built.usage,
  };
}
