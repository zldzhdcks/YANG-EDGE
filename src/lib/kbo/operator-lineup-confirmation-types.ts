export type KboLineupConfirmationStatus =
  | "CONFIRMED"
  | "PARTIAL"
  | "NOT_CONFIRMED";

export type KboLineupSide = "HOME" | "AWAY";

export type KboLineupPlayerEntry = {
  slot: number;
  playerName: string;
  position: string | null;
  starter: boolean;
};

export type KboLineupTeamEntry = {
  side: KboLineupSide;
  team: string;
  status: KboLineupConfirmationStatus;
  operatorVerified: boolean;
  enteredAt: string | null;
  sourceNote: string | null;
  batters: KboLineupPlayerEntry[];
  bench?: KboLineupPlayerEntry[];
  excluded?: string[];
};

export type KboLineupConfirmationGame = {
  lineupInputId: string;
  internalGameId: string;
  providerGameId: string | null;
  homeTeam: string;
  awayTeam: string;
  scheduledStartTimeKst: string | null;
  reviewStatus: KboLineupConfirmationStatus;
  enteredAt: string | null;
  homeLineup: KboLineupTeamEntry;
  awayLineup: KboLineupTeamEntry;
};

export type KboLineupConfirmationDocument = {
  schemaVersion: "kbo-lineup-confirmation-v1";
  targetDateKst: string;
  sourceType: "OPERATOR_VERIFIED";
  reviewStatus: KboLineupConfirmationStatus;
  createdAt: string;
  updatedAt: string;
  games: KboLineupConfirmationGame[];
  metadata: {
    inputMethod: "MANUAL";
    notes?: string;
  };
};
