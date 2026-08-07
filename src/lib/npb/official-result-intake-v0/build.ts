import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  loadNpbPregameEvidenceSnapshot,
  type NpbPregameEvidenceSnapshotV0,
} from "@/lib/npb/pregame-evidence-snapshot-v0";
import { collectedOfficialForDate } from "./collected-2026-08-07";
import { joinCollectedToPregame, mapScoresOntoPregame } from "./join";
import { buildMarketObservation, resolveWinner } from "./market-observation";
import {
  npbOfficialResultsAbs,
  npbOfficialResultsRel,
  npbPregameEvidenceSnapshotRel,
} from "./paths";
import {
  NPB_OFFICIAL_RESULTS_SCHEMA,
  type NpbCollectedOfficialGameV0,
  type NpbOfficialResultGameV0,
  type NpbOfficialResultsDocumentV0,
} from "./types";

function emptyMarketObservation(): NpbOfficialResultGameV0["marketObservation"] {
  return buildMarketObservation({ market: null, actualWinner: null });
}

function buildGameRow(input: {
  pregame: NpbPregameEvidenceSnapshotV0["games"][number];
  collectedList: NpbCollectedOfficialGameV0[];
  resultCollectedAt: string;
  sourceProvider: string;
}): NpbOfficialResultGameV0 {
  const { pregame, collectedList, resultCollectedAt, sourceProvider } = input;
  const hit = joinCollectedToPregame(pregame, collectedList);

  if (hit.joinStatus !== "MATCHED" || !hit.collected) {
    return {
      gameId: pregame.gameId,
      awayTeam: pregame.awayTeam,
      homeTeam: pregame.homeTeam,
      awayScore: null,
      homeScore: null,
      winner: null,
      status: "NOT_FINAL",
      resultCollectedAt,
      joinStatus: hit.joinStatus,
      modelGrade: "NOT_APPLICABLE",
      predictionAccuracy: "NOT_APPLICABLE",
      marketObservation: emptyMarketObservation(),
      lineupStatus: pregame.lineup.status,
      source: {
        provider: sourceProvider,
        sourceGameKey: null,
        sourceUrl: null,
      },
    };
  }

  const collected = hit.collected;
  const mapped = mapScoresOntoPregame(pregame, collected);
  const status = collected.status;
  const winner =
    status === "FINAL"
      ? resolveWinner(mapped.awayScore, mapped.homeScore)
      : null;
  const actualWinner = status === "FINAL" ? winner : null;

  return {
    gameId: pregame.gameId,
    awayTeam: pregame.awayTeam,
    homeTeam: pregame.homeTeam,
    awayScore: mapped.awayScore,
    homeScore: mapped.homeScore,
    winner,
    status,
    resultCollectedAt,
    joinStatus: "MATCHED",
    modelGrade: "NOT_APPLICABLE",
    predictionAccuracy: "NOT_APPLICABLE",
    marketObservation: buildMarketObservation({
      market: pregame.market,
      actualWinner,
    }),
    lineupStatus: pregame.lineup.status,
    source: {
      provider: sourceProvider,
      sourceGameKey: collected.sourceGameKey,
      sourceUrl: collected.sourceUrl,
    },
  };
}

function summarize(
  games: NpbOfficialResultGameV0[],
): NpbOfficialResultsDocumentV0["summary"] {
  const summary: NpbOfficialResultsDocumentV0["summary"] = {
    games: games.length,
    FINAL: 0,
    NOT_FINAL: 0,
    CANCELLED: 0,
    POSTPONED: 0,
    joinMatched: 0,
    joinNotMatched: 0,
    joinAmbiguous: 0,
    marketFavoriteWon: 0,
    marketFavoriteLost: 0,
    marketFavoriteNotApplicable: 0,
  };

  for (const g of games) {
    summary[g.status] += 1;
    if (g.joinStatus === "MATCHED") summary.joinMatched += 1;
    else if (g.joinStatus === "NOT_MATCHED") summary.joinNotMatched += 1;
    else summary.joinAmbiguous += 1;

    if (g.marketObservation.favoriteWon === "YES") {
      summary.marketFavoriteWon += 1;
    } else if (g.marketObservation.favoriteWon === "NO") {
      summary.marketFavoriteLost += 1;
    } else {
      summary.marketFavoriteNotApplicable += 1;
    }
  }

  return summary;
}

export async function buildNpbOfficialResultsV0(input: {
  dateKst: string;
  cwd?: string;
  collected?: NpbCollectedOfficialGameV0[];
  collectedAt?: string;
  sourceProvider?: string;
  write?: boolean;
}): Promise<{
  document: NpbOfficialResultsDocumentV0;
  pathRel: string;
  wrote: boolean;
  pregameHash: string;
}> {
  const cwd = input.cwd ?? process.cwd();
  const dateKst = input.dateKst;
  const snapshot = await loadNpbPregameEvidenceSnapshot({ dateKst, cwd });
  if (!snapshot) {
    throw new Error(
      `Pregame Evidence Snapshot missing for ${dateKst} (immutable source of truth)`,
    );
  }
  if (snapshot.snapshotKind !== "PREGAME_EVIDENCE") {
    throw new Error(
      `Expected PREGAME_EVIDENCE snapshot; got ${String(snapshot.snapshotKind)}`,
    );
  }

  const collected =
    input.collected ?? collectedOfficialForDate(dateKst) ?? [];
  const collectedAt = input.collectedAt ?? new Date().toISOString();
  const sourceProvider = input.sourceProvider ?? "npb.jp";

  const games = snapshot.games.map((pregame) =>
    buildGameRow({
      pregame,
      collectedList: collected,
      resultCollectedAt: collectedAt,
      sourceProvider,
    }),
  );

  const document: NpbOfficialResultsDocumentV0 = {
    schemaVersion: NPB_OFFICIAL_RESULTS_SCHEMA,
    sport: "baseball",
    league: "NPB",
    date: dateKst,
    dateKst,
    collectedAt,
    sourceProvider,
    pregameSnapshotPath: npbPregameEvidenceSnapshotRel(dateKst),
    pregameSnapshotHashSha256: snapshot.predictionHashSha256,
    note:
      "OFFICIAL RESULT INTAKE v0 — joins finals to immutable Pregame Evidence. " +
      "modelGrade/predictionAccuracy = NOT_APPLICABLE (no Prediction Engine). " +
      "MARKET_OBSERVATION_RESULT is not engine performance. Lineup not backfilled.",
    summary: summarize(games),
    games,
  };

  const pathRel = npbOfficialResultsRel(dateKst);
  let wrote = false;
  if (input.write !== false) {
    const abs = npbOfficialResultsAbs(dateKst, cwd);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    wrote = true;
  }

  return {
    document,
    pathRel,
    wrote,
    pregameHash: snapshot.predictionHashSha256,
  };
}

export async function loadNpbOfficialResultsV0(input: {
  dateKst: string;
  cwd?: string;
}): Promise<NpbOfficialResultsDocumentV0 | null> {
  const abs = npbOfficialResultsAbs(input.dateKst, input.cwd);
  try {
    const raw = await readFile(abs, "utf8");
    return JSON.parse(raw) as NpbOfficialResultsDocumentV0;
  } catch {
    return null;
  }
}
