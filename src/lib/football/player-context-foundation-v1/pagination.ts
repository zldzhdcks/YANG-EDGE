/**
 * API-Football /players pagination planner.
 * Pure. No network. Fail-closed when paging is missing or over the safety cap.
 */
import type { FootballPagingMetaV1 } from "./types";

/** Sane default: 8 pages × 20 players = 160. */
export const DEFAULT_PLAYERS_MAX_PAGES = 8;

/** Absolute fail-closed cap even if a caller requests more. */
export const HARD_PLAYERS_MAX_PAGES_CAP = 20;

export type PlayerPaginationPlan = {
  pagesToFetch: number[];
  totalPages: number;
  truncated: boolean;
  complete: boolean;
  pagingPresent: boolean;
  maxPages: number;
  reason: string | null;
};

export function clampPlayersMaxPages(maxPages: number | undefined): number {
  const requested =
    maxPages == null || !Number.isFinite(maxPages) ? DEFAULT_PLAYERS_MAX_PAGES : Math.floor(maxPages);
  if (requested < 1) return 1;
  if (requested > HARD_PLAYERS_MAX_PAGES_CAP) return HARD_PLAYERS_MAX_PAGES_CAP;
  return requested;
}

export function parseApiFootballPaging(raw: unknown): {
  current: number | null;
  total: number | null;
  pagingPresent: boolean;
} {
  if (!raw || typeof raw !== "object") {
    return { current: null, total: null, pagingPresent: false };
  }
  const paging = (raw as { paging?: { current?: unknown; total?: unknown } }).paging;
  if (!paging || typeof paging !== "object") {
    return { current: null, total: null, pagingPresent: false };
  }
  const current =
    typeof paging.current === "number" && Number.isFinite(paging.current)
      ? paging.current
      : null;
  const total =
    typeof paging.total === "number" && Number.isFinite(paging.total)
      ? paging.total
      : null;
  return {
    current,
    total,
    pagingPresent: current != null && total != null,
  };
}

/**
 * Plan which /players pages to fetch.
 * Does not assume page 1 is the entire response.
 * Never returns more than maxPages entries.
 */
export function planPlayerPagination(input: {
  current: number | null;
  total: number | null;
  pagingPresent: boolean;
  maxPages: number;
}): PlayerPaginationPlan {
  const maxPages = clampPlayersMaxPages(input.maxPages);

  if (!input.pagingPresent || input.current == null || input.total == null) {
    return {
      pagesToFetch: [1],
      totalPages: 1,
      truncated: true,
      complete: false,
      pagingPresent: false,
      maxPages,
      reason: "PAGING_METADATA_MISSING",
    };
  }

  if (input.current < 1 || input.total < 1) {
    return {
      pagesToFetch: [1],
      totalPages: Math.max(input.total, 1),
      truncated: true,
      complete: false,
      pagingPresent: true,
      maxPages,
      reason: "PAGING_METADATA_INVALID",
    };
  }

  const totalPages = input.total;
  const fetchCount = Math.min(totalPages, maxPages);
  const pagesToFetch = Array.from({ length: fetchCount }, (_, i) => i + 1);
  const truncated = totalPages > maxPages;

  return {
    pagesToFetch,
    totalPages,
    truncated,
    complete: !truncated,
    pagingPresent: true,
    maxPages,
    reason: truncated ? "MAX_PAGES_SAFETY_CAP" : null,
  };
}

export function toFootballPagingMetaV1(plan: PlayerPaginationPlan): FootballPagingMetaV1 {
  return {
    current: plan.pagesToFetch.length > 0 ? plan.pagesToFetch[plan.pagesToFetch.length - 1]! : 1,
    total: plan.totalPages,
    pagesFetched: plan.pagesToFetch.length,
    truncated: plan.truncated,
    complete: plan.complete,
    pagingPresent: plan.pagingPresent,
    maxPages: plan.maxPages,
    reason: plan.reason,
  };
}
