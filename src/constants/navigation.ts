/**
 * Public header / mobile nav only.
 * EDGE Combo (`/toto`) and EDGE Ranking (`/picks`) are HIDDEN from public UI —
 * routes kept for personal/sample reuse; direct URL only.
 * @see EDGE_COMBO_PUBLIC_VISIBILITY in `@/constants/toto`
 * @see EDGE_RANKING_PUBLIC_VISIBILITY in `@/constants/picks`
 */
export const NAV_ITEMS = [
  { label: "오늘 경기", href: "/games" },
  { label: "내 가계부", href: "/ledger" },
  { label: "피드백", href: "/feedback" },
  { label: "Learning", href: "/learning" },
] as const;
