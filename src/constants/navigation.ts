/**
 * Public header / mobile nav only.
 * EDGE Combo (`/toto`) and EDGE Ranking (`/picks`) are HIDDEN from public UI —
 * routes kept for personal/sample reuse; direct URL only.
 * @see EDGE_COMBO_PUBLIC_VISIBILITY in `@/constants/toto`
 * @see EDGE_RANKING_PUBLIC_VISIBILITY in `@/constants/picks`
 */
import { TODAY_RESEARCH_BATCH, TODAY_RESEARCH_DATE } from '@/lib/public-analysis/research-explorer-contract';

export const NAV_ITEMS = [
  { label: "오늘의 리서치", href: "/" },
  { label: "Research Explorer", href: `/research?batch=${TODAY_RESEARCH_BATCH}&date=${TODAY_RESEARCH_DATE}` },
  { label: "Engine Research", href: "/#engine-research" },
  { label: "내 가계부", href: "/ledger" },
] as const;

/**
 * Footer secondary links. Routes stay public; not in Header.
 * Labels match the destination page titles, not invented grouping names.
 */
export const FOOTER_NAV_ITEMS = [
  { label: "Learning", href: "/learning" },
  { label: "피드백", href: "/feedback" },
] as const;
