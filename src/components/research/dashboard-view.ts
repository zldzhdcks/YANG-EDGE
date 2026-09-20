import type { loadResearchExplorer } from '@/lib/public-analysis/load-research-explorer';
import type { Tier } from '@/lib/public-analysis/research-explorer-contract';

// Presentation policy only: no admission, tier calculation or probability changes.
const FEATURED_TARGETS = ['BETMAN-20260920-91', 'BETMAN-20260920-86'];
const SPORTS = ['SOCCER', 'BASEBALL', 'BASKETBALL', 'VOLLEYBALL'];
export const sportLabel = (sport: string) => ({ SOCCER: '축구', BASEBALL: '야구', BASKETBALL: '농구', VOLLEYBALL: '배구' }[sport] ?? sport);
export const qualityLabel = (tier: Tier) => ({ FULL: '심층 분석', STANDARD: '기본 분석', BASIC: '경기 정보' }[tier]);
export const researchTime = (value: string | null) => value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) + ' KST'
  : '확인 중';

export function dashboardView(data: ReturnType<typeof loadResearchExplorer>) {
  const football = data.lines.filter(line => line.sport === 'SOCCER');
  const tierCount = (tier: Tier) => football.filter(line => line.tier === tier).length;
  const rank = { FULL: 2, STANDARD: 1, BASIC: 0 };
  const timestamp = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
  return {
    covered: data.lines.length,
    sports: SPORTS.map(sport => ({ label: sportLabel(sport), value: data.lines.filter(line => line.sport === sport).length })),
    football: football.length,
    full: tierCount('FULL'), standard: tierCount('STANDARD'), basic: tierCount('BASIC'),
    standardOrAbove: tierCount('FULL') + tierCount('STANDARD'),
    featured: FEATURED_TARGETS.flatMap(id => data.details.filter(detail => detail.line.targetId === id)),
    preview: [...data.lines].sort((a, b) => rank[b.tier] - rank[a.tier]
      || timestamp(b.previewAsOf) - timestamp(a.previewAsOf)
      || timestamp(a.kickoff) - timestamp(b.kickoff)
      || a.targetId.localeCompare(b.targetId)).slice(0, 8),
  };
}
