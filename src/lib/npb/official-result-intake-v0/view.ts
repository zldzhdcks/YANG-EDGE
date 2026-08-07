import { loadNpbPregameEvidenceSnapshot } from "@/lib/npb/pregame-evidence-snapshot-v0";
import { loadNpbOfficialResultsV0 } from "./build";
import type { NpbOfficialResultGameViewV0 } from "./types";

export async function loadNpbOfficialResultIntakeView(input: {
  dateKst: string;
  cwd?: string;
}): Promise<{
  dateKst: string;
  hasResults: boolean;
  pregameHashShort: string | null;
  summaryLines: string[];
  games: NpbOfficialResultGameViewV0[];
  predictionNote: string;
}> {
  const snapshot = await loadNpbPregameEvidenceSnapshot(input);
  const results = await loadNpbOfficialResultsV0(input);

  if (!snapshot) {
    return {
      dateKst: input.dateKst,
      hasResults: false,
      pregameHashShort: null,
      summaryLines: ["Pregame Snapshot: MISSING"],
      games: [],
      predictionNote: "Prediction: NOT_AVAILABLE · Accuracy: NOT_APPLICABLE",
    };
  }

  const byId = new Map(results?.games.map((g) => [g.gameId, g]) ?? []);

  const games: NpbOfficialResultGameViewV0[] = snapshot.games.map((g) => {
    const r = byId.get(g.gameId);
    return {
      gameId: g.gameId,
      matchup: g.matchup,
      awayTeam: g.awayTeam,
      homeTeam: g.homeTeam,
      beforeGame: {
        starterAway: g.starter.away.displayName,
        starterHome: g.starter.home.displayName,
        moneylineAway: g.market.awayOdds,
        moneylineHome: g.market.homeOdds,
        lineupStatus: g.lineup.status,
      },
      afterGame: r
        ? {
            status: r.status,
            awayScore: r.awayScore,
            homeScore: r.homeScore,
            winner: r.winner,
            marketFavorite: r.marketObservation.marketFavorite,
            favoriteWon: r.marketObservation.favoriteWon,
            joinStatus: r.joinStatus,
          }
        : {
            status: "MISSING",
            awayScore: null,
            homeScore: null,
            winner: null,
            marketFavorite: null,
            favoriteWon: null,
            joinStatus: null,
          },
    };
  });

  const s = results?.summary;
  const summaryLines = results
    ? [
        `Official Result join: ${s!.joinMatched}/${s!.games}`,
        `FINAL ${s!.FINAL} · CANCELLED ${s!.CANCELLED} · POSTPONED ${s!.POSTPONED} · NOT_FINAL ${s!.NOT_FINAL}`,
        `Market Favorite Won ${s!.marketFavoriteWon} · Lost ${s!.marketFavoriteLost}`,
        `Pregame Hash: ${snapshot.predictionHashSha256.slice(0, 8)}…`,
      ]
    : [
        "Official Results: NOT COLLECTED",
        `Pregame Hash: ${snapshot.predictionHashSha256.slice(0, 8)}…`,
      ];

  return {
    dateKst: input.dateKst,
    hasResults: Boolean(results),
    pregameHashShort: `${snapshot.predictionHashSha256.slice(0, 8)}…`,
    summaryLines,
    games,
    predictionNote: "Prediction: NOT_AVAILABLE · Accuracy: NOT_APPLICABLE",
  };
}
