export type MatchupEntityV2 = {
  matchupKey: string;
  targetDateKst: string | null;
  competitionRawLabel: string | null;
  homeRawName: string | null;
  awayRawName: string | null;
  boardGameNumbers: string[];
  mergeStatus: "LINKED" | "UNMERGED_INCOMPLETE";
};

export function matchupKey(input: {
  targetDateKst: string | null;
  competitionRawLabel: string | null;
  homeRawName: string | null;
  awayRawName: string | null;
}): string | null {
  if (
    !input.targetDateKst ||
    !input.competitionRawLabel ||
    !input.homeRawName ||
    !input.awayRawName
  ) {
    return null;
  }
  return [
    input.targetDateKst,
    input.competitionRawLabel,
    input.homeRawName,
    input.awayRawName,
  ].join("|");
}

export function buildMatchupEntities(
  rows: Array<{
    boardGameNumber: string | null;
    targetDateKst: string | null;
    competitionRawLabel: string | null;
    homeRawName: string | null;
    awayRawName: string | null;
    homeStatus?: string | null;
    awayStatus?: string | null;
  }>,
): MatchupEntityV2[] {
  const grouped = new Map<string, MatchupEntityV2>();
  const incomplete: MatchupEntityV2[] = [];
  for (const row of rows) {
    if (!row.boardGameNumber) continue;
    if (
      row.homeStatus !== "TEAM_TEXT_VERIFIED" ||
      row.awayStatus !== "TEAM_TEXT_VERIFIED"
    ) {
      incomplete.push({
        matchupKey: `board:${row.boardGameNumber}`,
        targetDateKst: row.targetDateKst,
        competitionRawLabel: row.competitionRawLabel,
        homeRawName: row.homeRawName,
        awayRawName: row.awayRawName,
        boardGameNumbers: [row.boardGameNumber],
        mergeStatus: "UNMERGED_INCOMPLETE",
      });
      continue;
    }
    const key = matchupKey(row);
    if (!key) {
      incomplete.push({
        matchupKey: `board:${row.boardGameNumber}`,
        targetDateKst: row.targetDateKst,
        competitionRawLabel: row.competitionRawLabel,
        homeRawName: row.homeRawName,
        awayRawName: row.awayRawName,
        boardGameNumbers: [row.boardGameNumber],
        mergeStatus: "UNMERGED_INCOMPLETE",
      });
      continue;
    }
    const existing = grouped.get(key);
    if (existing) {
      if (!existing.boardGameNumbers.includes(row.boardGameNumber)) {
        existing.boardGameNumbers.push(row.boardGameNumber);
      }
    } else {
      grouped.set(key, {
        matchupKey: key,
        targetDateKst: row.targetDateKst,
        competitionRawLabel: row.competitionRawLabel,
        homeRawName: row.homeRawName,
        awayRawName: row.awayRawName,
        boardGameNumbers: [row.boardGameNumber],
        mergeStatus: "LINKED",
      });
    }
  }
  return [...grouped.values(), ...incomplete];
}

export function countUniqueMatchups(entities: MatchupEntityV2[]): {
  uniqueMatchups: number;
  targetDateUniqueMatchups: number;
} {
  const linked = entities.filter((e) => e.mergeStatus === "LINKED");
  return {
    uniqueMatchups: linked.length,
    targetDateUniqueMatchups: linked.filter((e) => e.targetDateKst != null).length,
  };
}
