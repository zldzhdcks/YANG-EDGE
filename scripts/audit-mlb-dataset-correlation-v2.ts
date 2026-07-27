/**
 * MLB Dataset Correlation Audit v2 — read-only co-presence across 7 research datasets.
 *
 * - Presence only (NOT_COLLECTED | PARTIAL | COMPLETE) — no scores/weights
 * - Engine / Viewer / Prediction mutation PROHIBITED
 *
 *   npx tsx scripts/audit-mlb-dataset-correlation-v2.ts [YYYY-MM-DD]
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATE =
  process.argv[2]?.trim() ||
  process.env.MLB_TARGET_DATE_KST?.trim() ||
  "2026-07-27";

const DATASET_KEYS = [
  "starter",
  "bullpen",
  "lineup",
  "weather",
  "travel",
  "odds",
  "injury",
] as const;

type DatasetKey = (typeof DATASET_KEYS)[number];
type CollectionStatus = "NOT_COLLECTED" | "PARTIAL" | "COMPLETE";

type DatasetPresence = {
  status: CollectionStatus;
  present: boolean;
  rowCount: number;
};

type PredictionResult = {
  resultStatus: string | null;
  predictionHit: boolean | null;
  worked: boolean;
  failed: boolean;
  pending: boolean;
};

type GameCorrelation = {
  gameId: string;
  match: string;
  starter: DatasetPresence;
  bullpen: DatasetPresence;
  lineup: DatasetPresence;
  weather: DatasetPresence;
  travel: DatasetPresence;
  odds: DatasetPresence;
  injury: DatasetPresence;
  predictionResult: PredictionResult;
};

type PairCell = {
  pair: string;
  bothPresent: number;
  bothComplete: number;
  bothPartial: number;
  onePartial: number;
  oneNotCollected: number;
};

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function presence(
  status: CollectionStatus,
  rowCount: number,
): DatasetPresence {
  return {
    status,
    present: status !== "NOT_COLLECTED",
    rowCount,
  };
}

async function readJson(pathname: string): Promise<unknown> {
  return JSON.parse(await readFile(pathname, "utf8"));
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function assessStarter(rows: unknown[]): DatasetPresence {
  if (rows.length === 0) return presence("NOT_COLLECTED", 0);
  let complete = rows.length >= 2;
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) {
      complete = false;
      continue;
    }
    const jq = asString(r.joinQuality);
    const pid = asNumber(r.probablePitcherId);
    const missing = Array.isArray(r.missing) ? r.missing.length : 0;
    if (jq !== "MATCHED" || pid == null || missing > 0) complete = false;
  }
  if (rows.length < 2) return presence("PARTIAL", rows.length);
  return presence(complete ? "COMPLETE" : "PARTIAL", rows.length);
}

function assessBullpen(game: Record<string, unknown> | null): DatasetPresence {
  if (!game) return presence("NOT_COLLECTED", 0);
  const role = asString(game.overallRoleComparison);
  if (!role) return presence("PARTIAL", 1);
  return presence("COMPLETE", 1);
}

function assessLineup(rows: unknown[]): DatasetPresence {
  if (rows.length === 0) return presence("NOT_COLLECTED", 0);
  let allComplete = rows.length >= 2;
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) {
      allComplete = false;
      continue;
    }
    if (asString(r.lineupStatus) !== "COMPLETE") allComplete = false;
    if (asString(r.preGameStatus) === "NOT_COLLECTED") {
      // post-game only — still PARTIAL for pre-game gap
      allComplete = false;
    }
  }
  if (rows.length < 2) return presence("PARTIAL", rows.length);
  const anyComplete = rows.some(
    (raw) => asString(asRecord(raw)?.lineupStatus) === "COMPLETE",
  );
  if (!anyComplete) return presence("PARTIAL", rows.length);
  return presence(allComplete ? "COMPLETE" : "PARTIAL", rows.length);
}

function assessWeather(row: Record<string, unknown> | null): DatasetPresence {
  if (!row) return presence("NOT_COLLECTED", 0);
  const venue = asRecord(row.venue);
  const venueId = asNumber(venue?.id);
  const missing = Array.isArray(row.missing) ? row.missing.length : 0;
  const forecast = asRecord(row.forecast);
  const forecastCollected =
    forecast &&
    Object.values(forecast).some((v) => v !== "NOT_COLLECTED" && v != null);

  if (venueId == null || venueId <= 0) return presence("PARTIAL", 1);
  if (missing > 0 || !forecastCollected) return presence("PARTIAL", 1);
  return presence("COMPLETE", 1);
}

function assessTravel(rows: unknown[]): DatasetPresence {
  if (rows.length === 0) return presence("NOT_COLLECTED", 0);
  let complete = rows.length >= 2;
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) {
      complete = false;
      continue;
    }
    if (asString(r.joinQuality) !== "MATCHED") complete = false;
    const missing = Array.isArray(r.missing) ? r.missing.length : 0;
    if (missing > 0) complete = false;
  }
  if (rows.length < 2) return presence("PARTIAL", rows.length);
  return presence(complete ? "COMPLETE" : "PARTIAL", rows.length);
}

function assessOdds(row: Record<string, unknown> | null): DatasetPresence {
  if (!row) return presence("NOT_COLLECTED", 0);
  const opening = asNumber(row.openingOdds);
  const latest = asNumber(row.latestOdds);
  const market = asNumber(row.marketProbability);
  if (opening != null && latest != null && market != null) {
    return presence("COMPLETE", 1);
  }
  if (market != null || opening != null || latest != null) {
    return presence("PARTIAL", 1);
  }
  return presence("PARTIAL", 1);
}

function assessInjury(
  rows: unknown[],
  starterStatus: CollectionStatus,
): DatasetPresence {
  if (starterStatus === "NOT_COLLECTED") return presence("NOT_COLLECTED", 0);
  if (rows.length === 0) {
    // zero IL players on roster — still collected
    return presence("COMPLETE", 0);
  }
  let partial = false;
  for (const raw of rows) {
    const r = asRecord(raw);
    if (!r) continue;
    const warnings = Array.isArray(r.warnings) ? r.warnings.length : 0;
    const missing = Array.isArray(r.missing) ? r.missing.length : 0;
    if (warnings > 0 || missing > 0) partial = true;
  }
  return presence(partial ? "PARTIAL" : "COMPLETE", rows.length);
}

function buildPairMatrix(games: GameCorrelation[]): PairCell[] {
  const pairs: PairCell[] = [];
  for (let i = 0; i < DATASET_KEYS.length; i++) {
    for (let j = i + 1; j < DATASET_KEYS.length; j++) {
      const a = DATASET_KEYS[i]!;
      const b = DATASET_KEYS[j]!;
      const cell: PairCell = {
        pair: `${a}-${b}`,
        bothPresent: 0,
        bothComplete: 0,
        bothPartial: 0,
        onePartial: 0,
        oneNotCollected: 0,
      };
      for (const g of games) {
        const sa = g[a].status;
        const sb = g[b].status;
        if (sa !== "NOT_COLLECTED" && sb !== "NOT_COLLECTED") {
          cell.bothPresent += 1;
        }
        if (sa === "COMPLETE" && sb === "COMPLETE") cell.bothComplete += 1;
        if (sa === "PARTIAL" && sb === "PARTIAL") cell.bothPartial += 1;
        if (
          (sa === "PARTIAL" && sb !== "PARTIAL") ||
          (sb === "PARTIAL" && sa !== "PARTIAL")
        ) {
          cell.onePartial += 1;
        }
        if (sa === "NOT_COLLECTED" || sb === "NOT_COLLECTED") {
          cell.oneNotCollected += 1;
        }
      }
      pairs.push(cell);
    }
  }
  return pairs;
}

function summarizeMissing(games: GameCorrelation[]) {
  const out: Record<
    DatasetKey,
    { NOT_COLLECTED: number; PARTIAL: number; COMPLETE: number }
  > = {} as Record<
    DatasetKey,
    { NOT_COLLECTED: number; PARTIAL: number; COMPLETE: number }
  >;
  for (const key of DATASET_KEYS) {
    out[key] = { NOT_COLLECTED: 0, PARTIAL: 0, COMPLETE: 0 };
    for (const g of games) {
      out[key][g[key].status] += 1;
    }
  }
  return out;
}

async function main() {
  console.log(`=== MLB Dataset Correlation Audit v2 (${DATE}) ===`);

  const root = process.cwd();
  const paths = {
    prediction: path.join(root, "data/predictions/mlb", `${DATE}.json`),
    starter: path.join(
      root,
      "data/research/mlb",
      `${DATE}-starter-dataset-v1.json`,
    ),
    bullpen: path.join(
      root,
      "data/research/mlb",
      `${DATE}-bullpen-role-dataset-v1_1.json`,
    ),
    lineup: path.join(
      root,
      "data/research/mlb",
      `${DATE}-lineup-dataset-v1.json`,
    ),
    weather: path.join(
      root,
      "data/research/mlb",
      `${DATE}-weather-dataset-v1.json`,
    ),
    travel: path.join(
      root,
      "data/research/mlb",
      `${DATE}-travel-rest-dataset-v1.json`,
    ),
    odds: path.join(
      root,
      "data/research/mlb",
      `${DATE}-odds-history-dataset-v1.json`,
    ),
    injury: path.join(
      root,
      "data/research/mlb",
      `${DATE}-injury-dataset-v1.json`,
    ),
  };

  for (const [name, p] of Object.entries(paths)) {
    if (!(await fileExists(p))) {
      throw new Error(`missing input ${name}: ${p}`);
    }
  }

  const hashBefore = {
    prediction: sha256(await readFile(paths.prediction, "utf8")),
    starter: sha256(await readFile(paths.starter, "utf8")),
    bullpen: sha256(await readFile(paths.bullpen, "utf8")),
    lineup: sha256(await readFile(paths.lineup, "utf8")),
    weather: sha256(await readFile(paths.weather, "utf8")),
    travel: sha256(await readFile(paths.travel, "utf8")),
    odds: sha256(await readFile(paths.odds, "utf8")),
    injury: sha256(await readFile(paths.injury, "utf8")),
  };

  const pred = (await readJson(paths.prediction)) as {
    predictions?: unknown[];
  };
  const starterDoc = (await readJson(paths.starter)) as { rows?: unknown[] };
  const bullpenDoc = (await readJson(paths.bullpen)) as { games?: unknown[] };
  const lineupDoc = (await readJson(paths.lineup)) as { rows?: unknown[] };
  const weatherDoc = (await readJson(paths.weather)) as { rows?: unknown[] };
  const travelDoc = (await readJson(paths.travel)) as { rows?: unknown[] };
  const oddsDoc = (await readJson(paths.odds)) as { rows?: unknown[] };
  const injuryDoc = (await readJson(paths.injury)) as { rows?: unknown[] };

  const starterByGame = new Map<string, unknown[]>();
  for (const raw of starterDoc.rows ?? []) {
    const r = asRecord(raw);
    const gid = asString(r?.gameId);
    if (!gid) continue;
    const list = starterByGame.get(gid) ?? [];
    list.push(raw);
    starterByGame.set(gid, list);
  }

  const bullpenByGame = new Map<string, Record<string, unknown>>();
  for (const raw of bullpenDoc.games ?? []) {
    const g = asRecord(raw);
    const gid = asString(g?.gameId);
    if (gid && g) bullpenByGame.set(gid, g);
  }

  const lineupByGame = new Map<string, unknown[]>();
  for (const raw of lineupDoc.rows ?? []) {
    const r = asRecord(raw);
    const gid = asString(r?.gameId);
    if (!gid) continue;
    const list = lineupByGame.get(gid) ?? [];
    list.push(raw);
    lineupByGame.set(gid, list);
  }

  const weatherByGame = new Map<string, Record<string, unknown>>();
  for (const raw of weatherDoc.rows ?? []) {
    const r = asRecord(raw);
    const gid = asString(r?.gameId);
    if (gid && r) weatherByGame.set(gid, r);
  }

  const travelByGame = new Map<string, unknown[]>();
  for (const raw of travelDoc.rows ?? []) {
    const r = asRecord(raw);
    const gid = asString(r?.gameId);
    if (!gid) continue;
    const list = travelByGame.get(gid) ?? [];
    list.push(raw);
    travelByGame.set(gid, list);
  }

  const oddsByGame = new Map<string, Record<string, unknown>>();
  for (const raw of oddsDoc.rows ?? []) {
    const r = asRecord(raw);
    const gid = asString(r?.gameId);
    if (gid && r) oddsByGame.set(gid, r);
  }

  const injuryByGame = new Map<string, unknown[]>();
  for (const raw of injuryDoc.rows ?? []) {
    const r = asRecord(raw);
    const gid = asString(r?.gameId);
    if (!gid) continue;
    const list = injuryByGame.get(gid) ?? [];
    list.push(raw);
    injuryByGame.set(gid, list);
  }

  const predictions = (pred.predictions ?? []).filter(
    (raw) => asString(asRecord(raw)?.dateKst) === DATE,
  );

  const games: GameCorrelation[] = predictions.map((raw) => {
    const p = asRecord(raw)!;
    const gameId = asString(p.gameId) ?? "";
    const home = asString(p.homeTeam) ?? "?";
    const away = asString(p.awayTeam) ?? "?";
    const resultStatus = asString(p.resultStatus);
    const predictionHit = p.predictionHit === true;
    const graded = resultStatus === "graded";

    const starterRows = starterByGame.get(gameId) ?? [];
    const starterP = assessStarter(starterRows);

    return {
      gameId,
      match: `${away} @ ${home}`,
      starter: starterP,
      bullpen: assessBullpen(bullpenByGame.get(gameId) ?? null),
      lineup: assessLineup(lineupByGame.get(gameId) ?? []),
      weather: assessWeather(weatherByGame.get(gameId) ?? null),
      travel: assessTravel(travelByGame.get(gameId) ?? []),
      odds: assessOdds(oddsByGame.get(gameId) ?? null),
      injury: assessInjury(
        injuryByGame.get(gameId) ?? [],
        starterP.status,
      ),
      predictionResult: {
        resultStatus,
        predictionHit: graded ? predictionHit : null,
        worked: graded && predictionHit,
        failed: graded && !predictionHit,
        pending: !graded,
      },
    };
  });

  games.sort((a, b) => a.gameId.localeCompare(b.gameId));

  const pairMatrix = buildPairMatrix(games);
  const missingSummary = summarizeMissing(games);

  const hashAfter = {
    prediction: sha256(await readFile(paths.prediction, "utf8")),
    starter: sha256(await readFile(paths.starter, "utf8")),
    bullpen: sha256(await readFile(paths.bullpen, "utf8")),
    lineup: sha256(await readFile(paths.lineup, "utf8")),
    weather: sha256(await readFile(paths.weather, "utf8")),
    travel: sha256(await readFile(paths.travel, "utf8")),
    odds: sha256(await readFile(paths.odds, "utf8")),
    injury: sha256(await readFile(paths.injury, "utf8")),
  };

  const regressionUnchanged =
    hashBefore.prediction === hashAfter.prediction &&
    hashBefore.starter === hashAfter.starter &&
    hashBefore.bullpen === hashAfter.bullpen &&
    hashBefore.lineup === hashAfter.lineup &&
    hashBefore.weather === hashAfter.weather &&
    hashBefore.travel === hashAfter.travel &&
    hashBefore.odds === hashAfter.odds &&
    hashBefore.injury === hashAfter.injury;

  const worked = games.filter((g) => g.predictionResult.worked).length;
  const failed = games.filter((g) => g.predictionResult.failed).length;
  const pending = games.filter((g) => g.predictionResult.pending).length;

  const audit = {
    meta: {
      version: "mlb-dataset-correlation-audit-v2",
      kind: "dataset-correlation-audit",
      dateKst: DATE,
      generatedAt: new Date().toISOString(),
      auditedGames: games.length,
      datasets: [...DATASET_KEYS],
      predictionWorked: worked,
      predictionFailed: failed,
      predictionPending: pending,
      engineAdmission: "PROHIBITED",
      correlationPurpose: "co-presence-only",
      noScores: true,
      noWeights: true,
      predictionHashSha256: hashBefore.prediction,
      datasetFilesUnchanged: regressionUnchanged,
      officialConclusion: "DATASET_CORRELATION_AUDIT_V2_CREATED",
    },
    inputPaths: paths,
    regressionHashes: {
      before: hashBefore,
      after: hashAfter,
      unchanged: regressionUnchanged,
    },
    missingSummary,
    pairMatrix,
    games,
    checks: [
      {
        id: "prediction-hash-unchanged",
        passed: hashBefore.prediction === hashAfter.prediction,
      },
      {
        id: "all-dataset-hashes-unchanged",
        passed: regressionUnchanged,
      },
      {
        id: "no-correlation-scores",
        passed: true,
        detail: "presence-only audit",
      },
      {
        id: "engine-prohibited",
        passed: true,
      },
    ],
    notes: [
      "Co-presence counts only — no importance, weight, or causal inference.",
      "Weather v1 venue-only → PARTIAL until forecast provider selected.",
      "Lineup pre-game NOT_COLLECTED → PARTIAL despite post-game COMPLETE.",
      "Injury zero-row games are COMPLETE when starter join succeeded.",
      "Odds PARTIAL when opening/latest odds absent in prediction snapshot.",
    ],
  };

  const outPath = path.join(
    root,
    "data/audits",
    `${DATE}-dataset-correlation-v2.json`,
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  const failedChecks = audit.checks.filter((c) => !c.passed);
  if (failedChecks.length > 0) {
    throw new Error(
      `audit checks failed: ${failedChecks.map((c) => c.id).join(", ")}`,
    );
  }

  console.log(`games=${games.length} pairs=${pairMatrix.length}`);
  console.log(`worked=${worked} failed=${failed} pending=${pending}`);
  console.log(`missingSummary=${JSON.stringify(missingSummary)}`);
  console.log(`regressionUnchanged=${regressionUnchanged}`);
  console.log(`저장: ${outPath}`);
  console.log("DATASET_CORRELATION_AUDIT_V2_CREATED");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
