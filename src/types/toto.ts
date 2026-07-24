export type TotoOutcome = "승" | "무" | "패";

export type TotoBetType = "단식" | "복식";

export type TotoMatchData = {
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  aiPick: TotoOutcome;
  confidence: number;
  edgeValue: number;
  betType: TotoBetType;
  doublePicks?: TotoOutcome[];
};

export type TotoRoundData = {
  round: number;
  deadlineLabel: string;
  matches: TotoMatchData[];
};

export type BudgetOption = {
  id: string;
  label: string;
  amount: number;
};
