/**
 * 팀명 정규화 — display 별칭 조회용.
 * Odds 매칭용 normalizeTeamNameForOdds 와 분리한다 (그쪽은 영문 원본 비교 전용).
 */
export function normalizeTeamName(name: string): string {
  return name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[.\-_/']/g, " ")
    .replace(/\s+/g, " ");
}
