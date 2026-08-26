import { readFile } from "node:fs/promises";
import path from "node:path";
import { namesMatchViaApprovedAlias } from "./game-id-resolver";
import type { DailyCArtifact, DailyCGameRow } from "./daily-c-types";

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

function asBoolean(v: unknown): boolean {
  return v === true;
}

async function readJson(rel: string, cwd: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path.join(cwd, rel), "utf8")) as unknown;
  } catch {
    return null;
  }
}

function parseMarket(raw: unknown): DailyCGameRow["marketBenchmark"] {
  const m = asRecord(raw);
  return {
    attached: asBoolean(m?.attached),
    marketBenchmarkOnly: m?.marketBenchmarkOnly !== false,
    source: asString(m?.source),
    observedAt: asString(m?.observedAt),
    oddsHomeTeam: asString(m?.oddsHomeTeam),
    oddsAwayTeam: asString(m?.oddsAwayTeam),
    oddsBestHome: asNumber(m?.oddsBestHome),
    oddsBestDraw: asNumber(m?.oddsBestDraw ?? m?.oddsBestDrawOdds),
    oddsBestAway: asNumber(m?.oddsBestAway),
  };
}

function parsePrediction(raw: unknown): DailyCGameRow["independentPrediction"] {
  const p = asRecord(raw);
  return {
    created: asBoolean(p?.created),
    predictedSide: asString(p?.predictedSide),
    independentProbability: asNumber(p?.independentProbability),
    confidence: asNumber(p?.confidence),
  };
}

function parseRow(raw: unknown): DailyCGameRow | null {
  const g = asRecord(raw);
  if (!g) return null;
  const operatorGameId = asString(g.operatorGameId);
  const sport = asString(g.sport);
  const rawHome = asString(g.rawHome);
  const rawAway = asString(g.rawAway);
  const cState = asString(g.cState);
  if (!operatorGameId || !sport || !rawHome || !rawAway || !cState) return null;
  return {
    operatorGameId,
    sport,
    rawLeagueLabel: asString(g.rawLeagueLabel),
    rawHome,
    rawAway,
    canonicalHome: asString(g.canonicalHome),
    canonicalAway: asString(g.canonicalAway),
    displayedStartKst: asString(g.displayedStartKst),
    displayedKickoffUtc: asString(g.displayedKickoffUtc),
    cState,
    independentPrediction: parsePrediction(g.independentPrediction),
    marketBenchmark: parseMarket(g.marketBenchmark),
    extraPublicGameIds: [],
  };
}

type IdentitySide = {
  providerName: string | null;
  canonicalNameKo: string | null;
  canonicalNameEn: string | null;
};

function parseIdentitySide(raw: unknown): IdentitySide | null {
  const s = asRecord(raw);
  if (!s) return null;
  return {
    providerName: asString(s.providerName),
    canonicalNameKo: asString(s.canonicalNameKo),
    canonicalNameEn: asString(s.canonicalNameEn),
  };
}

async function attachKboIdentityIds(
  rows: DailyCGameRow[],
  dateKst: string,
  cwd: string,
): Promise<void> {
  const rel = `data/research/kbo/${dateKst}-schedule-result-identity-v1-api-baseball.json`;
  const doc = asRecord(await readJson(rel, cwd));
  if (!doc) return;
  const identityRows = Array.isArray(doc.rows) ? doc.rows : [];
  const kbo = rows.filter((r) => r.sport === "KBO");

  for (const raw of identityRows) {
    const rec = asRecord(raw);
    if (!rec) continue;
    if (asString(rec.dateKst) !== dateKst) continue;
    const home = parseIdentitySide(rec.homeTeam);
    const away = parseIdentitySide(rec.awayTeam);
    if (!home || !away) continue;

    const matched = kbo.find(
      (row) =>
        namesMatchViaApprovedAlias(
          row.canonicalHome ?? row.rawHome,
          home.canonicalNameKo ?? home.canonicalNameEn ?? home.providerName,
          "KBO",
          "baseball",
        ) &&
        namesMatchViaApprovedAlias(
          row.canonicalAway ?? row.rawAway,
          away.canonicalNameKo ?? away.canonicalNameEn ?? away.providerName,
          "KBO",
          "baseball",
        ),
    );
    if (!matched) continue;
    const iid = asString(rec.internalGameId);
    if (iid) matched.extraPublicGameIds.push(iid);
  }
}

async function attachNpbScheduleIds(
  rows: DailyCGameRow[],
  dateKst: string,
  cwd: string,
): Promise<void> {
  const rel = `data/research/npb/${dateKst}-schedule-v1.json`;
  const doc = asRecord(await readJson(rel, cwd));
  if (!doc) return;
  const games = Array.isArray(doc.games) ? doc.games : [];
  const npb = rows.filter((r) => r.sport === "NPB");

  for (const raw of games) {
    const g = asRecord(raw);
    if (!g) continue;
    const home =
      asString(g.homeTeam) ?? asString(g.home) ?? asString(g.homeTeamName);
    const away =
      asString(g.awayTeam) ?? asString(g.away) ?? asString(g.awayTeamName);
    if (!home || !away) continue;

    const matched = npb.find(
      (row) =>
        namesMatchViaApprovedAlias(
          row.canonicalHome ?? row.rawHome,
          home,
          "NPB",
          "baseball",
        ) &&
        namesMatchViaApprovedAlias(
          row.canonicalAway ?? row.rawAway,
          away,
          "NPB",
          "baseball",
        ),
    );
    if (!matched) continue;
    const gameId = asString(g.gameId) ?? asString(g.internalGameId);
    if (gameId) matched.extraPublicGameIds.push(gameId);
  }
}

export function dailyCArtifactRel(dateKst: string): string {
  return `data/audits/${dateKst}-prediction-pass-reconciliation-v1.json`;
}

export async function loadDailyCArtifact(input: {
  dateKst: string;
  cwd?: string;
}): Promise<DailyCArtifact | null> {
  const cwd = input.cwd ?? process.cwd();
  const sourceRel = dailyCArtifactRel(input.dateKst);
  const doc = asRecord(await readJson(sourceRel, cwd));
  if (!doc) return null;
  if (asString(doc.dateKst) !== input.dateKst) return null;

  const games = (Array.isArray(doc.games) ? doc.games : [])
    .map(parseRow)
    .filter((row): row is DailyCGameRow => row != null);

  await attachKboIdentityIds(games, input.dateKst, cwd);
  await attachNpbScheduleIds(games, input.dateKst, cwd);

  return {
    dateKst: input.dateKst,
    predictionCount: asNumber(doc.predictionCount) ?? 0,
    passCount: asNumber(doc.passCount) ?? 0,
    marketBenchmarkOnly: doc.marketBenchmarkOnly !== false,
    providerLiveCalls: asNumber(doc.providerLiveCalls) ?? 0,
    games,
    sourceRel,
  };
}
