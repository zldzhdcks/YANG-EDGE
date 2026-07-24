/**
 * YANG EDGE Engine — 분석 입력/통계 모델
 *
 * UI 화면용 타입(`@/types/analysis`의 AnalysisData)과 분리한다.
 * Engine은 이 구조를 바탕으로 EDGE Score / Pick을 계산한다.
 */

export type MatchResult = "W" | "D" | "L";

export type EngineSport = "football" | "baseball" | "basketball";

/** 최근 경기 한 건 */
export type RecentGame = {
  date: string;
  opponent: string;
  /** 해당 팀 기준 결과 */
  result: MatchResult;
  scoreFor: number;
  scoreAgainst: number;
  isHome: boolean;
};

/** 홈 또는 원정 성적 */
export type VenueRecord = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  /** 승률 % (0–100) */
  winRate: number;
};

/** 리그 순위 */
export type LeagueStanding = {
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  /** 축구 등 승점제 */
  points?: number;
  /** 야구 등 승률제 */
  winningPercentage?: number;
  gamesBehind?: number;
};

/** 득점·실점 평균 */
export type ScoringAverages = {
  /** 경기당 득점 */
  scoredAvg: number;
  /** 경기당 실점 */
  concededAvg: number;
};

/** 최근 폼 */
export type RecentForm = {
  /** 예: "WWLWD" (최신→왼쪽 또는 팀 컨벤션에 맞춤) */
  sequence: string;
  last5: RecentGame[];
};

/** 연승 / 연패 */
export type Streak = {
  type: "win" | "loss" | "draw" | "none";
  count: number;
};

/** 부상자 */
export type InjuryItem = {
  playerName: string;
  position?: string;
  status: "out" | "doubtful" | "probable";
  note?: string;
};

/** 야구 선발투수 (타 종목은 null) */
export type StartingPitcher = {
  name: string;
  throws?: "L" | "R";
  era?: number;
  whip?: number;
  wins?: number;
  losses?: number;
  inningsPitched?: number;
  strikeouts?: number;
  note?: string;
} | null;

/** 팀 한쪽(홈 또는 원정) 분석 스냅샷 */
export type TeamAnalysisSide = {
  teamName: string;
  /** 최근 5경기 */
  recentGames: RecentGame[];
  /** 홈 성적 */
  homeRecord: VenueRecord;
  /** 원정 성적 */
  awayRecord: VenueRecord;
  /** 리그 순위 */
  leagueStanding: LeagueStanding;
  /** 득점·실점 평균 */
  scoringAverages: ScoringAverages;
  /** 최근 폼 */
  recentForm: RecentForm;
  /** 승률 % (시즌) */
  winRate: number;
  /** 연승/연패 */
  streak: Streak;
  /** 부상자 */
  injuries: InjuryItem[];
  /** 직전 경기 대비 휴식일 */
  restDays: number;
  /** 선발투수 (야구만) */
  startingPitcher: StartingPitcher;
};

/** 맞대결 (시즌/최근 H2H) */
export type HeadToHead = {
  played: number;
  homeTeamWins: number;
  awayTeamWins: number;
  draws: number;
  /** 최근 맞대결 (최대 5) */
  recentMeetings: RecentGame[];
};

/**
 * YANG EDGE Engine용 AnalysisData
 *
 * 포함 항목:
 * - 최근 5경기
 * - 홈/원정 성적
 * - 맞대결
 * - 리그순위
 * - 득점 평균 / 실점 평균
 * - 최근 폼
 * - 승률
 * - 연승/연패
 * - 부상자
 * - 휴식일
 * - 선발투수(야구)
 */
export type AnalysisData = {
  gameId: string;
  sport: EngineSport;
  league: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  startTime: string;
  home: TeamAnalysisSide;
  away: TeamAnalysisSide;
  /** 맞대결 */
  headToHead: HeadToHead;
};
