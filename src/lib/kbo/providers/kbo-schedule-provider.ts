/**
 * KBO Schedule Provider — provider-neutral contract.
 * Builder must consume normalized values only; no raw provider payloads.
 */
import type {
  KboGameStatus,
  KboIdentityProviderId,
} from "../schedule-result-identity-types";

export type KboScheduleProviderMetadata = {
  id: KboIdentityProviderId;
  leagueId: string;
  legalStatus: "INTERNAL_RESEARCH_ONLY" | "NEEDS_LEGAL_REVIEW";
  researchUse: "INTERNAL_RESEARCH_ONLY";
  publicDisplay: "UNCONFIRMED";
  commercialUse: "UNCONFIRMED";
};

/** Identity Builder input — no raw provider fields exposed. */
export type KboNormalizedScheduleGame = {
  providerGameId: string;
  providerStatusRaw: string | null;
  providerStartTime: string | null;
  startTimeKst: string | null;
  season: string | null;
  homeTeamProviderId: string | null;
  homeTeamProviderName: string;
  awayTeamProviderId: string | null;
  awayTeamProviderName: string;
  venueName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  gameStatus: KboGameStatus;
  /** Stable hash of provider-normalized payload slice (not full raw response). */
  providerPayloadHash: string;
};

export type KboScheduleFetchResult = {
  games: KboNormalizedScheduleGame[];
  metadata: KboScheduleProviderMetadata;
  warnings: string[];
  missing: string[];
  rawGameCount: number;
};

export type KboScheduleProvider = {
  fetchGamesByDate(dateKst: string): Promise<KboScheduleFetchResult>;
  getProviderMetadata(): KboScheduleProviderMetadata;
};
