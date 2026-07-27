import type { AiPickData } from "@/types/pick";

/**
 * Public UI visibility for EDGE Ranking (`/picks`).
 * HIDDEN = not linked from nav/home/footer; direct URL kept (sample data retained).
 * Do not wire to MLB research artifacts or present as live picks.
 */
export const EDGE_RANKING_PUBLIC_VISIBILITY = "HIDDEN" as const;

/** Fixed sample ranking only — not live recommendations. */
export const AI_PICKS: AiPickData[] = [
  {
    rank: 1,
    gameId: "npb-softbank-orix",
    league: "NPB",
    homeTeam: "소프트뱅크",
    awayTeam: "오릭스",
    pickTeam: "소프트뱅크",
    starRating: 5,
    confidence: 92,
    edgeValue: 18,
    highlightReason: "선발 우위",
  },
  {
    rank: 2,
    gameId: "kbo-lg-doosan",
    league: "KBO",
    homeTeam: "LG",
    awayTeam: "두산",
    pickTeam: "LG",
    starRating: 4,
    confidence: 89,
    edgeValue: 15,
    highlightReason: "선발·불펜 우위",
  },
  {
    rank: 3,
    gameId: "kbl-seoul-anyang",
    league: "KBL",
    homeTeam: "서울 SK",
    awayTeam: "안양",
    pickTeam: "서울 SK",
    starRating: 4,
    confidence: 86,
    edgeValue: 13,
    highlightReason: "리바운드·수비 우위",
  },
  {
    rank: 4,
    gameId: "kleague-ulsan-jeonbuk",
    league: "K리그",
    homeTeam: "울산",
    awayTeam: "전북",
    pickTeam: "울산",
    starRating: 4,
    confidence: 85,
    edgeValue: 11,
    highlightReason: "홈 압박·중원 우위",
  },
  {
    rank: 5,
    gameId: "npb-hanshin-yomiuri",
    league: "NPB",
    homeTeam: "한신",
    awayTeam: "요미우리",
    pickTeam: "한신",
    starRating: 4,
    confidence: 84,
    edgeValue: 12,
    highlightReason: "홈 이점·선발 안정",
  },
];
