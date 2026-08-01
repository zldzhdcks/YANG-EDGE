/**
 * Normalize prediction rows for scorecard v0.
 * V0 marketPredictions preferred; legacy baselinePick adapted read-only.
 */
import { asNumber, asRecord, asString, resolvePickSide } from "../mlb-review-utils";

export type NormalizedMarketRow = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  gamePkHint: number | null;
  marketType: "MONEYLINE_2WAY";
  homeProbability: number | null;
  awayProbability: number | null;
  marketHomeProbability: number | null;
  marketAwayProbability: number | null;
  confidence: number | null;
  officialStatus: string | null;
  officialPick: "HOME" | "AWAY" | null;
  researchSelection: "HOME" | "AWAY" | null;
  researchProbability: number | null;
  inputQuality: string | null;
  blockedReasons: string[];
  components: Record<string, number | null>;
  schemaSource: "V0_MARKET_PREDICTIONS" | "LEGACY_ADAPTER";
  modelVersion: string | null;
};

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function pctToProb(v: number | null): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  if (v > 1 && v <= 100) return v / 100;
  return v;
}

function collectBlockedReasons(
  p: Record<string, unknown>,
  mp: Record<string, unknown> | null,
): string[] {
  const out: string[] = [];
  for (const w of [...asArr(p.inputWarnings), ...asArr(mp?.warnings)]) {
    const s = asString(w);
    if (s) out.push(s);
  }
  for (const m of asArr(p.missingInputs)) {
    const s = asString(m);
    if (s) out.push(`MISSING:${s}`);
  }
  return [...new Set(out)];
}

export function normalizePredictionGames(
  predictions: unknown[],
  meta: Record<string, unknown>,
): NormalizedMarketRow[] {
  const modelVersion =
    asString(meta.modelVersion) ?? asString(meta.modelStatus);
  const rows: NormalizedMarketRow[] = [];

  for (const raw of predictions) {
    const p = asRecord(raw);
    if (!p) continue;
    const gameId = asString(p.gameId) ?? "";
    const homeTeam = asString(p.homeTeam) ?? "";
    const awayTeam = asString(p.awayTeam) ?? "";
    const gamePkHint = asNumber(p.gamePk);

    const markets = asArr(p.marketPredictions)
      .map((m) => asRecord(m))
      .filter(Boolean) as Record<string, unknown>[];
    const mp =
      markets.find((m) => asString(m.marketType) === "MONEYLINE_2WAY") ??
      markets[0] ??
      null;

    if (mp) {
      const rb = asRecord(mp.researchBaseline);
      const sel = asString(rb?.selection);
      const researchSelection =
        sel === "HOME" || sel === "AWAY" ? sel : null;
      const comps = asRecord(mp.components) ?? asRecord(p.components) ?? {};
      const officialPickRaw =
        asString(mp.officialPick) ?? asString(p.officialPick);
      const officialPick =
        officialPickRaw === "HOME" || officialPickRaw === "AWAY"
          ? officialPickRaw
          : null;
      const officialStatus =
        asString(mp.officialStatus) ?? asString(p.officialStatus);

      rows.push({
        gameId,
        homeTeam,
        awayTeam,
        gamePkHint,
        marketType: "MONEYLINE_2WAY",
        homeProbability: asNumber(mp.homeProbability),
        awayProbability: asNumber(mp.awayProbability),
        marketHomeProbability: asNumber(mp.marketHomeProbability),
        marketAwayProbability: asNumber(mp.marketAwayProbability),
        confidence: asNumber(mp.confidence) ?? asNumber(p.confidence),
        officialStatus,
        officialPick,
        researchSelection,
        researchProbability: asNumber(rb?.probability),
        inputQuality:
          asString(mp.inputQuality) ?? asString(p.inputStatus),
        blockedReasons: collectBlockedReasons(p, mp),
        components: {
          starter: asNumber(comps.starter),
          homeAdvantage: asNumber(comps.homeAdvantage),
          marketPrior: asNumber(comps.marketPrior),
          bullpen: asNumber(comps.bullpen),
          lineup: asNumber(comps.lineup),
        },
        schemaSource: "V0_MARKET_PREDICTIONS",
        modelVersion:
          asString(p.modelVersion) ?? asString(p.modelStatus) ?? modelVersion,
      });
      continue;
    }

    // Legacy adapter (no marketPredictions)
    const pickSide = resolvePickSide(
      asString(p.baselinePick),
      homeTeam,
      awayTeam,
    );
    const selectedPct = asNumber(p.modelProbability);
    const selectedP = pctToProb(selectedPct);
    let homeP: number | null = null;
    let awayP: number | null = null;
    if (pickSide && selectedP != null) {
      if (pickSide === "HOME") {
        homeP = selectedP;
        awayP = 1 - selectedP;
      } else {
        awayP = selectedP;
        homeP = 1 - selectedP;
      }
    }
    const marketSelected = pctToProb(asNumber(p.marketProbability));
    let marketHome: number | null = null;
    let marketAway: number | null = null;
    if (pickSide && marketSelected != null) {
      if (pickSide === "HOME") {
        marketHome = marketSelected;
        marketAway = 1 - marketSelected;
      } else {
        marketAway = marketSelected;
        marketHome = 1 - marketSelected;
      }
    }

    const inputStatus = asString(p.inputStatus);
    const baselineStatus = asString(p.baselineStatus);
    let officialStatus = asString(p.officialStatus);
    if (!officialStatus) {
      if (inputStatus === "BLOCKED" || baselineStatus === "BLOCKED") {
        officialStatus = "BLOCKED";
      } else if (inputStatus === "ELIGIBLE") {
        officialStatus = "ELIGIBLE";
      } else {
        officialStatus = "PASS";
      }
    }

    rows.push({
      gameId,
      homeTeam,
      awayTeam,
      gamePkHint,
      marketType: "MONEYLINE_2WAY",
      homeProbability: homeP,
      awayProbability: awayP,
      marketHomeProbability: marketHome,
      marketAwayProbability: marketAway,
      confidence: asNumber(p.confidence),
      officialStatus,
      officialPick: null,
      researchSelection: pickSide,
      researchProbability: selectedP,
      inputQuality: inputStatus,
      blockedReasons: collectBlockedReasons(p, null),
      components: {
        starter: null,
        homeAdvantage: null,
        marketPrior: null,
        bullpen: null,
        lineup: null,
      },
      schemaSource: "LEGACY_ADAPTER",
      modelVersion,
    });
  }

  return rows;
}
