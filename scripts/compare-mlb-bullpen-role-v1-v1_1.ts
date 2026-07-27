/**
 * v1 vs v1.1 bullpen pre-game audit 비교 (연구 전용).
 * prediction / Engine / hypotheses 수치 미수정.
 *
 * 실행:
 *   npx tsx scripts/compare-mlb-bullpen-role-v1-v1_1.ts
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TARGET = "2026-07-27";
const PATHS = {
  v1: path.join(
    process.cwd(),
    "data",
    "research",
    "mlb",
    `${TARGET}-bullpen-role-dataset.json`,
  ),
  v11: path.join(
    process.cwd(),
    "data",
    "research",
    "mlb",
    `${TARGET}-bullpen-role-dataset-v1_1.json`,
  ),
  prediction: path.join(
    process.cwd(),
    "data",
    "predictions",
    "mlb",
    `${TARGET}.json`,
  ),
  out: path.join(
    process.cwd(),
    "data",
    "audits",
    `${TARGET}-bullpen-role-v1-vs-v1_1.json`,
  ),
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function sha256(t: string): string {
  return createHash("sha256").update(t, "utf8").digest("hex");
}

type GameRow = {
  gameId: string;
  match: string;
  overall: string;
  outcome: string | null;
  collapse: boolean;
  protected: boolean;
  pickFlags: string[];
};

function loadGames(doc: Record<string, unknown>): GameRow[] {
  const games = Array.isArray(doc.games) ? doc.games : [];
  return games.map((raw) => {
    const g = asRecord(raw) ?? {};
    const post = asRecord(g.postGame);
    const pick = asRecord(g.pick);
    const flags = Array.isArray(pick?.roleFlags)
      ? (pick!.roleFlags as string[])
      : [];
    return {
      gameId: asString(g.gameId) ?? "",
      match: asString(g.match) ?? "",
      overall: asString(g.overallRoleComparison) ?? "",
      outcome: asString(post?.outcome),
      collapse: post?.actualCollapse === true,
      protected: post?.actualProtected === true,
      pickFlags: flags,
    };
  });
}

const KEY_FLAGS = new Set([
  "CLOSER_USED_PREVIOUS_DAY",
  "CLOSER_BACK_TO_BACK",
  "CLOSER_THIRD_DAY_RISK",
  "SETUP_CORE_HEAVY_USAGE",
  "SETUP_CORE_BACK_TO_BACK",
  "HIGH_LEVERAGE_GROUP_FATIGUED",
  "MULTIPLE_KEY_RELIEVERS_USED_PREVIOUS_DAY",
]);

function hasKeyWarning(flags: string[]): boolean {
  return flags.some((f) => KEY_FLAGS.has(f));
}

async function main() {
  const predHashBefore = sha256(await readFile(PATHS.prediction, "utf8"));
  const v1 = JSON.parse(await readFile(PATHS.v1, "utf8"));
  const v11 = JSON.parse(await readFile(PATHS.v11, "utf8"));
  const g1 = loadGames(v1);
  const g11 = loadGames(v11);
  const byId1 = new Map(g1.map((g) => [g.gameId, g]));
  const byId11 = new Map(g11.map((g) => [g.gameId, g]));

  const failCollapse11 = g11.filter((g) => g.collapse);
  const successProt11 = g11.filter((g) => g.protected);
  const warn11 = failCollapse11.filter((g) => hasKeyWarning(g.pickFlags));
  const stable11 = successProt11.filter(
    (g) =>
      g.overall === "ROLE_STRUCTURE_SUPPORTS_BASELINE" ||
      (!hasKeyWarning(g.pickFlags) && g.overall !== "ROLE_STRUCTURE_CONFLICTS_BASELINE"),
  );

  const changes: Array<Record<string, unknown>> = [];
  for (const id of [...byId11.keys()].sort()) {
    const a = byId1.get(id);
    const b = byId11.get(id)!;
    if (!a) continue;
    if (a.overall !== b.overall) {
      changes.push({
        gameId: id,
        match: b.match,
        v1: a.overall,
        v11: b.overall,
        reason:
          "classifier v1.1 primaryRole/score/sample policy changed team roleFlags → overallRoleComparison",
      });
    }
  }

  // FP: CONFLICTS but HIT; FN: collapse without key warning
  const fp = g11.filter(
    (g) =>
      g.overall === "ROLE_STRUCTURE_CONFLICTS_BASELINE" && g.outcome === "HIT",
  );
  const fn = failCollapse11.filter((g) => !hasKeyWarning(g.pickFlags));

  const out = {
    meta: {
      version: "bullpen-role-v1-vs-v1.1-compare-v1",
      generatedAt: new Date().toISOString(),
      predictionHashSha256: predHashBefore,
      predictionUnchanged:
        sha256(await readFile(PATHS.prediction, "utf8")) === predHashBefore,
      engineConnected: false,
      note: "적중률 개선 목적이 아님. pre-game bullpen 구조 신호 비교만.",
    },
    v11: {
      failCollapseWarned: warn11.length,
      failCollapseTotal: failCollapse11.length,
      successProtectedStable: stable11.length,
      successProtectedTotal: successProt11.length,
    },
    v1Summary: asRecord(v1.summary),
    v11Summary: asRecord(v11.summary),
    changedGames: changes,
    falsePositive: fp.map((g) => ({ gameId: g.gameId, match: g.match })),
    falseNegative: fn.map((g) => ({ gameId: g.gameId, match: g.match })),
    falsePositiveCount: fp.length,
    falseNegativeCount: fn.length,
  };

  await mkdir(path.dirname(PATHS.out), { recursive: true });
  await writeFile(PATHS.out, `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    `fail warn ${warn11.length}/${failCollapse11.length} success stable ${stable11.length}/${successProt11.length}`,
  );
  console.log(`changed=${changes.length} fp=${fp.length} fn=${fn.length}`);
  console.log(`저장: ${PATHS.out}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
