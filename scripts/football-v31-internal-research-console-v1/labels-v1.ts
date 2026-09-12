/** Display-only labels for the sealed first-real batch. Identity remains provider IDs. */
export const LEAGUE_LABELS: Record<number, string> = {
  39: "Premier League",
  78: "Bundesliga",
  135: "Serie A",
  140: "La Liga",
};

export const TEAM_LABELS: Record<number, string> = {
  35: "Bournemouth",
  36: "Fulham",
  40: "Liverpool",
  42: "Arsenal",
  45: "Everton",
  47: "Tottenham",
  49: "Chelsea",
  52: "Crystal Palace",
  55: "Brentford",
  57: "Ipswich",
  64: "Hull City",
  65: "Nottingham Forest",
  66: "Aston Villa",
  160: "SC Freiburg",
  162: "Werder Bremen",
  163: "Borussia Mönchengladbach",
  164: "FSV Mainz 05",
  165: "Borussia Dortmund",
  167: "1899 Hoffenheim",
  168: "Bayer Leverkusen",
  169: "Eintracht Frankfurt",
  170: "FC Augsburg",
  172: "VfB Stuttgart",
  185: "SC Paderborn 07",
  192: "1. FC Köln",
  487: "Lazio",
  489: "AC Milan",
  490: "Cagliari",
  495: "Genoa",
  499: "Atalanta",
  512: "Frosinone",
  531: "Athletic Club",
  535: "Malaga",
  538: "Celta Vigo",
  540: "Espanyol",
  541: "Real Madrid",
  727: "Osasuna",
  728: "Rayo Vallecano",
  746: "Sunderland",
  797: "Elche",
};

export function leagueLabel(leagueId: number): string {
  return LEAGUE_LABELS[leagueId] ?? `League ${leagueId}`;
}

export function teamLabel(teamId: number): string {
  return TEAM_LABELS[teamId] ?? `Team ${teamId}`;
}
