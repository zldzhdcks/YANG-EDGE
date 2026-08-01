/**
 * Read-only identity + edge-semantics audit for a frozen MLB prediction snapshot.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { deriveMoneylineEdgeSemantics } from "./edge-semantics";

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
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export type IdentityVerdict =
  | "SNAPSHOT_IDENTITY_VALID"
  | "DISPLAY_LABEL_ONLY_REVERSED"
  | "SNAPSHOT_HOME_AWAY_MISMATCH";

export type FrozenGameAuditRow = {
  gamePk: number | null;
  gameId: string;
  startTimeKst: string | null;
  commenceTimeUtc: string | null;
  scheduleHome: string;
  scheduleAway: string;
  predictionHome: string;
  predictionAway: string;
  oddsHome: string | null;
  oddsAway: string | null;
  identityOk: boolean;
  oddsIdentityOk: boolean;
  homeProbability: number;
  awayProbability: number;
  marketHomeProbability: number | null;
  marketAwayProbability: number | null;
  officialStatus: string | null;
  researchBaselineSelection: "HOME" | "AWAY" | null;
  /** Legacy ambiguous field = homeModelEdge only. */
  legacyReportedModelEdgeHome: number | null;
  semantics: ReturnType<typeof deriveMoneylineEdgeSemantics>;
  displayMatchupAwayAtHome: string;
};

export async function auditFrozenMlbPredictionIdentityV0(input: {
  dateKst: string;
  cwd?: string;
}): Promise<{
  dateKst: string;
  verdict: IdentityVerdict;
  snapshotMutationRequired: boolean;
  uniqueGamePk: number;
  scheduleMatched: number;
  oddsMatched: number;
  issues: Array<{ gameId: string; code: string; detail: string }>;
  games: FrozenGameAuditRow[];
  snapshotHashSha256: string;
  predictionHashSha256: string | null;
  configHash: string | null;
}> {
  const cwd = input.cwd ?? process.cwd();
  const predRel = `data/predictions/mlb/${input.dateKst}.json`;
  const schedRel = `data/research/mlb/${input.dateKst}-schedule-v1.json`;
  const oddsRel = `data/research/mlb/${input.dateKst}-odds-history-dataset-v1.json`;

  const predRaw = await readFile(path.join(cwd, predRel), "utf8");
  const snapshotHashSha256 = createHash("sha256")
    .update(predRaw)
    .digest("hex");
  const pred = JSON.parse(predRaw) as Record<string, unknown>;
  const meta = asRecord(pred.meta);
  const schedule = JSON.parse(
    await readFile(path.join(cwd, schedRel), "utf8"),
  ) as { games: Array<Record<string, unknown>> };
  const odds = JSON.parse(await readFile(path.join(cwd, oddsRel), "utf8")) as {
    rows: Array<Record<string, unknown>>;
  };

  const schedById = new Map(
    schedule.games.map((g) => [asString(g.internalGameId) ?? "", g]),
  );
  const oddsById = new Map(
    odds.rows.map((r) => [
      asString(r.gameId) ?? asString(r.internalGameId) ?? "",
      r,
    ]),
  );

  const issues: Array<{ gameId: string; code: string; detail: string }> = [];
  const games: FrozenGameAuditRow[] = [];
  const pks = new Set<number>();

  for (const raw of asArr(pred.predictions)) {
    const p = asRecord(raw);
    if (!p) continue;
    const gameId = asString(p.gameId) ?? "";
    const g = schedById.get(gameId);
    const o = oddsById.get(gameId);
    const mp = asRecord(asArr(p.marketPredictions)[0]) ?? {};
    const rb = asRecord(mp.researchBaseline);

    if (!g) {
      issues.push({
        gameId,
        code: "SCHEDULE_MISSING",
        detail: "prediction gameId not in schedule",
      });
      continue;
    }

    const scheduleHome = asString(g.homeTeam) ?? "";
    const scheduleAway = asString(g.awayTeam) ?? "";
    const predictionHome = asString(p.homeTeam) ?? "";
    const predictionAway = asString(p.awayTeam) ?? "";
    const oddsHome = o ? asString(o.homeTeam) : null;
    const oddsAway = o ? asString(o.awayTeam) : null;
    const identityOk =
      predictionHome === scheduleHome && predictionAway === scheduleAway;
    const oddsIdentityOk =
      o == null
        ? false
        : oddsHome === scheduleHome && oddsAway === scheduleAway;

    if (!identityOk) {
      issues.push({
        gameId,
        code: "SNAPSHOT_HOME_AWAY_MISMATCH",
        detail: `pred=${predictionAway}@${predictionHome} sched=${scheduleAway}@${scheduleHome}`,
      });
    }
    if (o && !oddsIdentityOk) {
      issues.push({
        gameId,
        code: "ODDS_HOME_AWAY_MISMATCH",
        detail: `odds=${oddsAway}@${oddsHome} sched=${scheduleAway}@${scheduleHome}`,
      });
    }

    const homeP = asNumber(mp.homeProbability) ?? NaN;
    const awayP = asNumber(mp.awayProbability) ?? NaN;
    const mktH = asNumber(mp.marketHomeProbability);
    const mktA = asNumber(mp.marketAwayProbability);
    if (!Number.isFinite(homeP) || !Number.isFinite(awayP)) {
      issues.push({ gameId, code: "NON_FINITE_PROB", detail: "" });
    } else if (Math.abs(homeP + awayP - 1) > 1e-6) {
      issues.push({
        gameId,
        code: "PROB_SUM",
        detail: String(homeP + awayP),
      });
    }
    if (
      mktH != null &&
      mktA != null &&
      Math.abs(mktH + mktA - 1) > 1e-5
    ) {
      issues.push({
        gameId,
        code: "MARKET_SUM",
        detail: String(mktH + mktA),
      });
    }

    const semantics = deriveMoneylineEdgeSemantics({
      homeProbability: homeP,
      awayProbability: awayP,
      marketHomeProbability: mktH,
      marketAwayProbability: mktA,
    });
    if (
      semantics.edgeComplementSum != null &&
      Math.abs(semantics.edgeComplementSum) > 1e-5
    ) {
      issues.push({
        gameId,
        code: "EDGE_COMPLEMENT",
        detail: String(semantics.edgeComplementSum),
      });
    }

    const gamePk = asNumber(g.gamePk);
    if (gamePk != null) {
      if (pks.has(gamePk)) {
        issues.push({
          gameId,
          code: "DUP_GAME_PK",
          detail: String(gamePk),
        });
      }
      pks.add(gamePk);
    }

    const rbSel = asString(rb?.selection);
    games.push({
      gamePk,
      gameId,
      startTimeKst: asString(g.startTimeKst),
      commenceTimeUtc: asString(g.commenceTimeUtc),
      scheduleHome,
      scheduleAway,
      predictionHome,
      predictionAway,
      oddsHome,
      oddsAway,
      identityOk,
      oddsIdentityOk,
      homeProbability: homeP,
      awayProbability: awayP,
      marketHomeProbability: mktH,
      marketAwayProbability: mktA,
      officialStatus: asString(p.officialStatus),
      researchBaselineSelection:
        rbSel === "HOME" || rbSel === "AWAY" ? rbSel : null,
      legacyReportedModelEdgeHome: asNumber(mp.modelEdgeHome),
      semantics,
      displayMatchupAwayAtHome: `${scheduleAway} @ ${scheduleHome}`,
    });
  }

  const mismatch = issues.some((i) => i.code === "SNAPSHOT_HOME_AWAY_MISMATCH");
  const verdict: IdentityVerdict = mismatch
    ? "SNAPSHOT_HOME_AWAY_MISMATCH"
    : "SNAPSHOT_IDENTITY_VALID";

  return {
    dateKst: input.dateKst,
    verdict,
    snapshotMutationRequired: mismatch,
    uniqueGamePk: pks.size,
    scheduleMatched: games.filter((g) => g.identityOk).length,
    oddsMatched: games.filter((g) => g.oddsIdentityOk).length,
    issues,
    games,
    snapshotHashSha256,
    predictionHashSha256: asString(meta?.predictionHashSha256),
    configHash: asString(meta?.configHash),
  };
}
