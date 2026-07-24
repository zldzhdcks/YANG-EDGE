import type { AnalysisData, RecentGame } from "@/types/engine-analysis";

const HOME_RECENT_5: RecentGame[] = [
  {
    date: "2026-07-22",
    opponent: "라쿠텐",
    result: "W",
    scoreFor: 5,
    scoreAgainst: 2,
    isHome: true,
  },
  {
    date: "2026-07-21",
    opponent: "닛폰햄",
    result: "W",
    scoreFor: 4,
    scoreAgainst: 1,
    isHome: true,
  },
  {
    date: "2026-07-20",
    opponent: "지바롯데",
    result: "L",
    scoreFor: 2,
    scoreAgainst: 3,
    isHome: false,
  },
  {
    date: "2026-07-19",
    opponent: "세이부",
    result: "W",
    scoreFor: 7,
    scoreAgainst: 4,
    isHome: false,
  },
  {
    date: "2026-07-18",
    opponent: "오릭스",
    result: "W",
    scoreFor: 6,
    scoreAgainst: 3,
    isHome: true,
  },
];

const AWAY_RECENT_5: RecentGame[] = [
  {
    date: "2026-07-22",
    opponent: "한신",
    result: "L",
    scoreFor: 1,
    scoreAgainst: 4,
    isHome: false,
  },
  {
    date: "2026-07-21",
    opponent: "요미우리",
    result: "W",
    scoreFor: 3,
    scoreAgainst: 2,
    isHome: false,
  },
  {
    date: "2026-07-20",
    opponent: "주니치",
    result: "L",
    scoreFor: 2,
    scoreAgainst: 5,
    isHome: true,
  },
  {
    date: "2026-07-19",
    opponent: "히로시마",
    result: "L",
    scoreFor: 0,
    scoreAgainst: 3,
    isHome: true,
  },
  {
    date: "2026-07-18",
    opponent: "소프트뱅크",
    result: "L",
    scoreFor: 3,
    scoreAgainst: 6,
    isHome: false,
  },
];

/**
 * YANG EDGE Engine용 Dummy AnalysisData
 * (소프트뱅크 vs 오릭스 — NPB 야구 예시)
 */
export const DummyAnalysisData: AnalysisData = {
  gameId: "npb-softbank-orix",
  sport: "baseball",
  league: "NPB",
  homeTeam: "소프트뱅크",
  awayTeam: "오릭스",
  date: "2026-07-23",
  startTime: "18:00",

  home: {
    teamName: "소프트뱅크",
    recentGames: HOME_RECENT_5,
    homeRecord: {
      played: 40,
      wins: 27,
      draws: 0,
      losses: 13,
      winRate: 67.5,
    },
    awayRecord: {
      played: 38,
      wins: 20,
      draws: 0,
      losses: 18,
      winRate: 52.6,
    },
    leagueStanding: {
      rank: 1,
      played: 78,
      wins: 47,
      draws: 0,
      losses: 31,
      winningPercentage: 0.603,
      gamesBehind: 0,
    },
    scoringAverages: {
      scoredAvg: 4.8,
      concededAvg: 3.2,
    },
    recentForm: {
      sequence: "WWLWW",
      last5: HOME_RECENT_5,
    },
    winRate: 60.3,
    streak: {
      type: "win",
      count: 2,
    },
    injuries: [
      {
        playerName: "백업 외야수 A",
        position: "OF",
        status: "out",
        note: "햄스트링",
      },
    ],
    restDays: 1,
    startingPitcher: {
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
  },

  away: {
    teamName: "오릭스",
    recentGames: AWAY_RECENT_5,
    homeRecord: {
      played: 39,
      wins: 18,
      draws: 0,
      losses: 21,
      winRate: 46.2,
    },
    awayRecord: {
      played: 39,
      wins: 16,
      draws: 0,
      losses: 23,
      winRate: 41.0,
    },
    leagueStanding: {
      rank: 5,
      played: 78,
      wins: 34,
      draws: 0,
      losses: 44,
      winningPercentage: 0.436,
      gamesBehind: 13.0,
    },
    scoringAverages: {
      scoredAvg: 3.5,
      concededAvg: 4.1,
    },
    recentForm: {
      sequence: "LWLLL",
      last5: AWAY_RECENT_5,
    },
    winRate: 43.6,
    streak: {
      type: "loss",
      count: 1,
    },
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
    restDays: 0,
    startingPitcher: {
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
  },

  headToHead: {
    played: 7,
    homeTeamWins: 5,
    awayTeamWins: 2,
    draws: 0,
    recentMeetings: [
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
    ],
  },
};
