import type {
  AnalysisData,
  HeadToHead,
  RecentGame,
  TeamAnalysisSide,
} from "@/types/engine-analysis";

function recent(
  items: Array<[string, string, "W" | "D" | "L", number, number, boolean]>,
): RecentGame[] {
  return items.map(([date, opponent, result, scoreFor, scoreAgainst, isHome]) => ({
    date,
    opponent,
    result,
    scoreFor,
    scoreAgainst,
    isHome,
  }));
}

function formSequence(games: RecentGame[]): string {
  return games.map((g) => g.result).join("");
}

function side(input: {
  teamName: string;
  recentGames: RecentGame[];
  homeWinRate: number;
  awayWinRate: number;
  homePlayed?: number;
  awayPlayed?: number;
  rank: number;
  winningPercentage: number;
  gamesBehind: number;
  seasonWins: number;
  seasonLosses: number;
  scoredAvg: number;
  concededAvg: number;
  winRate: number;
  streakType: "win" | "loss" | "draw" | "none";
  streakCount: number;
  restDays: number;
  injuries: TeamAnalysisSide["injuries"];
  pitcher: NonNullable<TeamAnalysisSide["startingPitcher"]>;
}): TeamAnalysisSide {
  const homePlayed = input.homePlayed ?? 40;
  const awayPlayed = input.awayPlayed ?? 38;
  const homeWins = Math.round((homePlayed * input.homeWinRate) / 100);
  const awayWins = Math.round((awayPlayed * input.awayWinRate) / 100);

  return {
    teamName: input.teamName,
    recentGames: input.recentGames,
    homeRecord: {
      played: homePlayed,
      wins: homeWins,
      draws: 0,
      losses: homePlayed - homeWins,
      winRate: input.homeWinRate,
    },
    awayRecord: {
      played: awayPlayed,
      wins: awayWins,
      draws: 0,
      losses: awayPlayed - awayWins,
      winRate: input.awayWinRate,
    },
    leagueStanding: {
      rank: input.rank,
      played: input.seasonWins + input.seasonLosses,
      wins: input.seasonWins,
      draws: 0,
      losses: input.seasonLosses,
      winningPercentage: input.winningPercentage,
      gamesBehind: input.gamesBehind,
    },
    scoringAverages: {
      scoredAvg: input.scoredAvg,
      concededAvg: input.concededAvg,
    },
    recentForm: {
      sequence: formSequence(input.recentGames),
      last5: input.recentGames,
    },
    winRate: input.winRate,
    streak: {
      type: input.streakType,
      count: input.streakCount,
    },
    injuries: input.injuries,
    restDays: input.restDays,
    startingPitcher: input.pitcher,
  };
}

function h2h(
  played: number,
  homeWins: number,
  awayWins: number,
  meetings: RecentGame[],
): HeadToHead {
  return {
    played,
    homeTeamWins: homeWins,
    awayTeamWins: awayWins,
    draws: played - homeWins - awayWins,
    recentMeetings: meetings,
  };
}

const SOFTBANK_RECENT = recent([
  ["2026-07-22", "라쿠텐", "W", 5, 2, true],
  ["2026-07-21", "닛폰햄", "W", 4, 1, true],
  ["2026-07-20", "지바롯데", "L", 2, 3, false],
  ["2026-07-19", "세이부", "W", 7, 4, false],
  ["2026-07-18", "오릭스", "W", 6, 3, true],
]);

const ORIX_RECENT = recent([
  ["2026-07-22", "한신", "L", 1, 4, false],
  ["2026-07-21", "요미우리", "W", 3, 2, false],
  ["2026-07-20", "주니치", "L", 2, 5, true],
  ["2026-07-19", "히로시마", "L", 0, 3, true],
  ["2026-07-18", "소프트뱅크", "L", 3, 6, false],
]);

const HANSHIN_RECENT = recent([
  ["2026-07-22", "오릭스", "W", 4, 1, true],
  ["2026-07-21", "주니치", "W", 3, 2, true],
  ["2026-07-20", "히로시마", "D", 2, 2, false],
  ["2026-07-19", "요미우리", "L", 1, 5, false],
  ["2026-07-18", "야쿠르트", "W", 5, 3, true],
]);

const YOMIURI_RECENT = recent([
  ["2026-07-22", "야쿠르트", "W", 6, 2, true],
  ["2026-07-21", "히로시마", "L", 2, 4, false],
  ["2026-07-20", "주니치", "W", 3, 1, true],
  ["2026-07-19", "한신", "W", 5, 1, true],
  ["2026-07-18", "DeNA", "L", 0, 3, false],
]);

const LG_RECENT = recent([
  ["2026-07-22", "KT", "W", 5, 3, true],
  ["2026-07-21", "SSG", "W", 4, 2, true],
  ["2026-07-20", "한화", "L", 1, 4, false],
  ["2026-07-19", "NC", "W", 3, 1, false],
  ["2026-07-18", "두산", "W", 7, 2, true],
]);

const DOOSAN_RECENT = recent([
  ["2026-07-22", "삼성", "L", 2, 5, false],
  ["2026-07-21", "KIA", "W", 4, 3, true],
  ["2026-07-20", "키움", "L", 1, 2, true],
  ["2026-07-19", "롯데", "L", 0, 4, false],
  ["2026-07-18", "LG", "L", 2, 7, false],
]);

const SOFTBANK_ORIX: AnalysisData = {
  gameId: "npb-softbank-orix",
  sport: "baseball",
  league: "NPB",
  homeTeam: "소프트뱅크",
  awayTeam: "오릭스",
  date: "2026-07-23",
  startTime: "18:00",
  home: side({
    teamName: "소프트뱅크",
    recentGames: SOFTBANK_RECENT,
    homeWinRate: 67.5,
    awayWinRate: 52.6,
    rank: 1,
    winningPercentage: 0.603,
    gamesBehind: 0,
    seasonWins: 47,
    seasonLosses: 31,
    scoredAvg: 4.8,
    concededAvg: 3.2,
    winRate: 60.3,
    streakType: "win",
    streakCount: 2,
    restDays: 1,
    injuries: [
      {
        playerName: "백업 외야수 A",
        position: "OF",
        status: "out",
        note: "햄스트링",
      },
    ],
    pitcher: {
      name: "야나기자와",
      throws: "R",
      era: 1.98,
      whip: 0.92,
      wins: 8,
      losses: 2,
      inningsPitched: 95.1,
      strikeouts: 102,
      note: "직전 등판 7이닝 1실점",
    },
  }),
  away: side({
    teamName: "오릭스",
    recentGames: ORIX_RECENT,
    homeWinRate: 46.2,
    awayWinRate: 41.0,
    homePlayed: 39,
    awayPlayed: 39,
    rank: 5,
    winningPercentage: 0.436,
    gamesBehind: 13,
    seasonWins: 34,
    seasonLosses: 44,
    scoredAvg: 3.5,
    concededAvg: 4.1,
    winRate: 43.6,
    streakType: "loss",
    streakCount: 1,
    restDays: 0,
    injuries: [
      {
        playerName: "주전 내야수 B",
        position: "IF",
        status: "doubtful",
        note: "어깨 통증",
      },
      {
        playerName: "불펜투수 C",
        position: "P",
        status: "out",
        note: "팔꿈치",
      },
    ],
    pitcher: {
      name: "미야기",
      throws: "L",
      era: 3.41,
      whip: 1.28,
      wins: 5,
      losses: 6,
      inningsPitched: 88.0,
      strikeouts: 74,
      note: "직전 등판 5이닝 3실점",
    },
  }),
  headToHead: h2h(7, 5, 2, [
    {
      date: "2026-07-18",
      opponent: "오릭스",
      result: "W",
      scoreFor: 6,
      scoreAgainst: 3,
      isHome: true,
    },
    {
      date: "2026-06-12",
      opponent: "오릭스",
      result: "W",
      scoreFor: 4,
      scoreAgainst: 2,
      isHome: false,
    },
    {
      date: "2026-06-11",
      opponent: "오릭스",
      result: "L",
      scoreFor: 1,
      scoreAgainst: 5,
      isHome: false,
    },
    {
      date: "2026-05-03",
      opponent: "오릭스",
      result: "W",
      scoreFor: 3,
      scoreAgainst: 1,
      isHome: true,
    },
    {
      date: "2026-05-02",
      opponent: "오릭스",
      result: "W",
      scoreFor: 8,
      scoreAgainst: 4,
      isHome: true,
    },
  ]),
};

const HANSHIN_YOMIURI: AnalysisData = {
  gameId: "npb-hanshin-yomiuri",
  sport: "baseball",
  league: "NPB",
  homeTeam: "한신",
  awayTeam: "요미우리",
  date: "2026-07-23",
  startTime: "18:00",
  home: side({
    teamName: "한신",
    recentGames: HANSHIN_RECENT,
    homeWinRate: 61.0,
    awayWinRate: 48.0,
    rank: 2,
    winningPercentage: 0.55,
    gamesBehind: 4,
    seasonWins: 44,
    seasonLosses: 36,
    scoredAvg: 4.3,
    concededAvg: 3.6,
    winRate: 55.0,
    streakType: "win",
    streakCount: 2,
    restDays: 1,
    injuries: [],
    pitcher: {
      name: "무라카미",
      throws: "R",
      era: 2.55,
      whip: 1.05,
      wins: 7,
      losses: 3,
      inningsPitched: 90.0,
      strikeouts: 88,
      note: "직전 등판 6이닝 2실점",
    },
  }),
  away: side({
    teamName: "요미우리",
    recentGames: YOMIURI_RECENT,
    homeWinRate: 58.0,
    awayWinRate: 50.0,
    homePlayed: 40,
    awayPlayed: 40,
    rank: 3,
    winningPercentage: 0.525,
    gamesBehind: 6,
    seasonWins: 42,
    seasonLosses: 38,
    scoredAvg: 4.1,
    concededAvg: 3.8,
    winRate: 52.5,
    streakType: "win",
    streakCount: 1,
    restDays: 0,
    injuries: [
      {
        playerName: "주전 포수 D",
        position: "C",
        status: "doubtful",
        note: "타박상",
      },
    ],
    pitcher: {
      name: "스가노",
      throws: "R",
      era: 3.05,
      whip: 1.18,
      wins: 6,
      losses: 4,
      inningsPitched: 92.2,
      strikeouts: 79,
      note: "직전 등판 5.2이닝 3실점",
    },
  }),
  headToHead: h2h(6, 3, 3, [
    {
      date: "2026-07-01",
      opponent: "요미우리",
      result: "W",
      scoreFor: 4,
      scoreAgainst: 2,
      isHome: true,
    },
    {
      date: "2026-06-20",
      opponent: "요미우리",
      result: "L",
      scoreFor: 1,
      scoreAgainst: 3,
      isHome: false,
    },
    {
      date: "2026-06-19",
      opponent: "요미우리",
      result: "W",
      scoreFor: 5,
      scoreAgainst: 4,
      isHome: false,
    },
    {
      date: "2026-05-10",
      opponent: "요미우리",
      result: "L",
      scoreFor: 2,
      scoreAgainst: 6,
      isHome: true,
    },
    {
      date: "2026-05-09",
      opponent: "요미우리",
      result: "W",
      scoreFor: 3,
      scoreAgainst: 1,
      isHome: true,
    },
  ]),
};

const LG_DOOSAN: AnalysisData = {
  gameId: "kbo-lg-doosan",
  sport: "baseball",
  league: "KBO",
  homeTeam: "LG",
  awayTeam: "두산",
  date: "2026-07-23",
  startTime: "18:30",
  home: side({
    teamName: "LG",
    recentGames: LG_RECENT,
    homeWinRate: 64.0,
    awayWinRate: 55.0,
    rank: 1,
    winningPercentage: 0.59,
    gamesBehind: 0,
    seasonWins: 48,
    seasonLosses: 33,
    scoredAvg: 5.1,
    concededAvg: 3.4,
    winRate: 59.0,
    streakType: "win",
    streakCount: 3,
    restDays: 1,
    injuries: [
      {
        playerName: "불펜투수 E",
        position: "P",
        status: "out",
        note: "피로 관리",
      },
    ],
    pitcher: {
      name: "임찬규",
      throws: "R",
      era: 2.88,
      whip: 1.1,
      wins: 9,
      losses: 3,
      inningsPitched: 100.0,
      strikeouts: 95,
      note: "직전 등판 7이닝 무실점",
    },
  }),
  away: side({
    teamName: "두산",
    recentGames: DOOSAN_RECENT,
    homeWinRate: 52.0,
    awayWinRate: 44.0,
    homePlayed: 41,
    awayPlayed: 40,
    rank: 6,
    winningPercentage: 0.45,
    gamesBehind: 11,
    seasonWins: 36,
    seasonLosses: 44,
    scoredAvg: 3.9,
    concededAvg: 4.4,
    winRate: 45.0,
    streakType: "loss",
    streakCount: 3,
    restDays: 0,
    injuries: [
      {
        playerName: "주전 외야수 F",
        position: "OF",
        status: "out",
        note: "햄스트링",
      },
    ],
    pitcher: {
      name: "곽빈",
      throws: "R",
      era: 3.75,
      whip: 1.32,
      wins: 5,
      losses: 7,
      inningsPitched: 85.1,
      strikeouts: 70,
      note: "직전 등판 4이닝 4실점",
    },
  }),
  headToHead: h2h(8, 5, 3, [
    {
      date: "2026-07-18",
      opponent: "두산",
      result: "W",
      scoreFor: 7,
      scoreAgainst: 2,
      isHome: true,
    },
    {
      date: "2026-06-28",
      opponent: "두산",
      result: "W",
      scoreFor: 4,
      scoreAgainst: 1,
      isHome: false,
    },
    {
      date: "2026-06-27",
      opponent: "두산",
      result: "L",
      scoreFor: 2,
      scoreAgainst: 5,
      isHome: false,
    },
    {
      date: "2026-05-15",
      opponent: "두산",
      result: "W",
      scoreFor: 6,
      scoreAgainst: 3,
      isHome: true,
    },
    {
      date: "2026-05-14",
      opponent: "두산",
      result: "W",
      scoreFor: 3,
      scoreAgainst: 2,
      isHome: true,
    },
  ]),
};

/**
 * gameId → Engine AnalysisData (Dummy)
 * 최소 3경기: softbank-orix / hanshin-yomiuri / lg-doosan
 */
export const DUMMY_ENGINE_ANALYSIS_BY_GAME_ID: Record<string, AnalysisData> = {
  [SOFTBANK_ORIX.gameId]: SOFTBANK_ORIX,
  [HANSHIN_YOMIURI.gameId]: HANSHIN_YOMIURI,
  [LG_DOOSAN.gameId]: LG_DOOSAN,
};

export function getDummyEngineAnalysis(gameId: string): AnalysisData | null {
  return DUMMY_ENGINE_ANALYSIS_BY_GAME_ID[gameId] ?? null;
}

export function listDummyEngineGameIds(): string[] {
  return Object.keys(DUMMY_ENGINE_ANALYSIS_BY_GAME_ID);
}

/** @deprecated DUMMY_ENGINE_ANALYSIS_BY_GAME_ID / getDummyEngineAnalysis 사용 */
export const DummyAnalysisData = SOFTBANK_ORIX;
