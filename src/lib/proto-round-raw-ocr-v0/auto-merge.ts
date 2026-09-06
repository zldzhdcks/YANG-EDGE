/**
 * Null acceptedObservationTime never authorizes merge/delete.
 * v0 also keeps CROSS_IMAGE_ROW_AUTO_DEDUPE = DISABLED, so this is
 * always false. buildObservationIdentity is not merge authorization.
 */
export function isAutoMergeEligible(
  acceptedObservationTime: string | null,
): false {
  void acceptedObservationTime;
  return false;
}

export function observationIdentityMayAuthorizeMerge(
  acceptedObservationTime: string | null,
): false {
  void acceptedObservationTime;
  return false;
}
