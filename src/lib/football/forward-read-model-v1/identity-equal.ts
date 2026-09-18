import { fail, FORWARD_READ_MODEL_ERROR } from "./errors";
import type { ResolvedFixtureIdentity } from "./types";

export function identitiesEqual(
  a: ResolvedFixtureIdentity,
  b: ResolvedFixtureIdentity,
): boolean {
  return (
    a.fixtureId === b.fixtureId &&
    a.league === b.league &&
    a.homeTeam === b.homeTeam &&
    a.awayTeam === b.awayTeam
  );
}

export function mergeCommittedIdentityEvidence(
  groups: readonly ResolvedFixtureIdentity[][],
): Map<number, ResolvedFixtureIdentity> {
  const index = new Map<number, ResolvedFixtureIdentity>();
  for (const group of groups) {
    for (const identity of group) {
      const existing = index.get(identity.fixtureId);
      if (existing && !identitiesEqual(existing, identity)) {
        fail(
          FORWARD_READ_MODEL_ERROR.FORWARD_IDENTITY_CONFLICT,
          `fixtureId=${identity.fixtureId}`,
        );
      }
      index.set(identity.fixtureId, identity);
    }
  }
  return index;
}
