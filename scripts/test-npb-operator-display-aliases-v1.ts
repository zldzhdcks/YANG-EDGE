/**
 * 2026-08-26 NPB operator-display aliases — exact originalNames only.
 * Nearby wrong strings must not resolve.
 *
 *   npm run test:npb-operator-display-aliases-v1
 */
import assert from "node:assert/strict";
import { TEAM_ALIASES } from "../src/lib/teams/team-aliases";
import { normalizeTeamName } from "../src/lib/teams/normalize-team-name";

function resolveNpbAlias(label: string) {
  const n = normalizeTeamName(label);
  return TEAM_ALIASES.filter((a) => {
    if (a.league !== "NPB" || a.sport !== "baseball") return false;
    if (normalizeTeamName(a.displayName) === n) return true;
    return a.originalNames.some((name) => normalizeTeamName(name) === n);
  });
}

const INTENDED: Array<{ label: string; displayName: string }> = [
  { label: "히로카프", displayName: "히로시마" },
  { label: "히로시마", displayName: "히로시마" },
  { label: "Hiroshima Carp", displayName: "히로시마" },
  { label: "요코베이", displayName: "요코하마" },
  { label: "요코하마", displayName: "요코하마" },
  { label: "Yokohama BayStars", displayName: "요코하마" },
  { label: "지바롯데", displayName: "롯데" },
  { label: "치바 롯데", displayName: "롯데" },
  { label: "Chiba Lotte Marines", displayName: "롯데" },
  { label: "소프트뱅", displayName: "소프트뱅크" },
  { label: "소프트뱅크", displayName: "소프트뱅크" },
  { label: "Fukuoka S. Hawks", displayName: "소프트뱅크" },
];

const MUST_FAIL = [
  "히로카",
  "히로시마카",
  "히로카프스",
  "요코베",
  "요코하마베",
  "지바롯",
  "지바 롯데",
  "소프트",
  "소프트뱅크스",
  "소프트뱅뱅",
  "한화",
];

function main() {
  for (const row of INTENDED) {
    const hits = resolveNpbAlias(row.label);
    assert.equal(hits.length, 1, `intended ${row.label} must be unique`);
    assert.equal(hits[0]!.displayName, row.displayName, row.label);
  }

  for (const label of MUST_FAIL) {
    const hits = resolveNpbAlias(label);
    assert.equal(hits.length, 0, `nearby string must fail: ${label}`);
  }

  const kboLotte = TEAM_ALIASES.filter(
    (a) =>
      a.league === "KBO" &&
      a.sport === "baseball" &&
      a.originalNames.some(
        (n) => normalizeTeamName(n) === normalizeTeamName("지바롯데"),
      ),
  );
  assert.equal(kboLotte.length, 0, "지바롯데 must not enter KBO Lotte aliases");

  console.log("test:npb-operator-display-aliases-v1 OK");
}

main();
