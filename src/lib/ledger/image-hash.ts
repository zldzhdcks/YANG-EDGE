/**
 * 이미지 중복 판별 (순수 함수).
 * 실제 파일 해시는 계산하지 않는다 — 이미 계산된 hash 문자열만 비교.
 */

/**
 * candidate 가 knownHashes 에 있으면 중복.
 * 빈 문자열·null·undefined 는 중복으로 보지 않는다 (해시 없음).
 */
export function isDuplicateImageHash(
  candidate: string | null | undefined,
  knownHashes: ReadonlyArray<string | null | undefined>,
): boolean {
  if (candidate == null) return false;
  const key = candidate.trim();
  if (key === "") return false;

  for (const h of knownHashes) {
    if (h == null) continue;
    if (h.trim() === key) return true;
  }
  return false;
}

/**
 * known 목록에 candidate 를 추가한 새 배열.
 * 중복이거나 빈 값이면 원본 목록을 그대로 반환 (참조 유지 가능하도록 복사만 필요할 때 복사).
 */
export function appendImageHashIfNew(
  candidate: string | null | undefined,
  knownHashes: ReadonlyArray<string>,
): string[] {
  if (candidate == null || candidate.trim() === "") {
    return [...knownHashes];
  }
  if (isDuplicateImageHash(candidate, knownHashes)) {
    return [...knownHashes];
  }
  return [...knownHashes, candidate.trim()];
}
