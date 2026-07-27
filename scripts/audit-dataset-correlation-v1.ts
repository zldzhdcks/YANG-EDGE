/**
 * Dataset Correlation Audit v1 — read-only co-occurrence summary.
 * No dataset mutation, no scores, Engine PROHIBITED.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATE = process.argv[2]?.trim() || "2026-07-27";

type GameRow = {
  gameId: string;
  match: string;
  outcome: "SUCCESS" | "FAILURE";
  predictionHit: boolean;
  pitcherDirection: string | null;
  recommendationGrade: string | null;
  starter: {
    postGame: string | null;
    probable: string | null;
    join: string | null;
  };
  bullpen: {
    roleComparison: string | null;
    bullpenVerdict: string | null;
    postOutcome: string | null;
  };
  lineup: {
    preGame: string | null;
    postGame: string | null;
  };
  flowReview: {
    primary: string | null;
    secondary: string[];
    starterVerdict: string | null;
    bullpenVerdict: string | null;
  } | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function inc(map: Record<string, number>, key: string | null | undefined) {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

function topN(
  obj: Record<string, number>,
  n = 8,
): Array<{ key: string; count: number }> {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

async function main() {
  const root = process.cwd();
  const predPath = path.join(root, "data/predictions/mlb", `${DATE}.json`);
  const predRaw = await readFile(predPath, "utf8");
  const predHash = createHash("sha256").update(predRaw).digest("hex");

  const pred = JSON.parse(predRaw) as {
    predictions?: Array<Record<string, unknown>>;
  };
  const review = JSON.parse(
    await readFile(
      path.join(root, "data/predictions/mlb", `${DATE}-review.json`),
      "utf8",
    ),
  ) as { games?: unknown[] };
  const success = JSON.parse(
    await readFile(
      path.join(root, "data/predictions/mlb", `${DATE}-success-flow-review.json`),
      "utf8",
    ),
  ) as { games?: unknown[] };
  const failure = JSON.parse(
    await readFile(
      path.join(root, "data/predictions/mlb", `${DATE}-failure-flow-review.json`),
      "utf8",
    ),
  ) as { games?: unknown[] };
  const starter = JSON.parse(
    await readFile(
      path.join(root, "data/research/mlb", `${DATE}-starter-dataset-v1.json`),
      "utf8",
    ),
  ) as { rows?: unknown[] };
  const bullpen = JSON.parse(
    await readFile(
      path.join(
        root,
        "data/research/mlb",
        `${DATE}-bullpen-role-dataset-v1_1.json`,
      ),
      "utf8",
    ),
  ) as { games?: unknown[] };
  const lineup = JSON.parse(
    await readFile(
      path.join(root, "data/research/mlb", `${DATE}-lineup-dataset-v1.json`),
      "utf8",
    ),
  ) as { rows?: unknown[] };

  const graded = (pred.predictions ?? []).filter(
    (p) => asString(p.resultStatus) === "graded",
  );

  const starterByGame: Record<
    string,
    { postGameStatus: string | null; probableStatus: string | null; joinQuality: string | null }
  > = {};
  for (const raw of starter.rows ?? []) {
    const r = asRecord(raw);
    if (!r) continue;
    const gid = asString(r.gameId);
    if (!gid) continue;
    if (!starterByGame[gid]) {
      starterByGame[gid] = {
        postGameStatus: null,
        probableStatus: null,
        joinQuality: null,
      };
    }
    const post = asRecord(r.postGameReview);
    const statuses = new Set<string>();
    for (const row of starter.rows ?? []) {
      const rr = asRecord(row);
      if (!rr || asString(rr.gameId) !== gid) continue;
      const s = asRecord(rr.postGameReview);
      const st = asString(s?.status);
      if (st) statuses.add(st);
    }
    starterByGame[gid].postGameStatus =
      statuses.size === 1
        ? [...statuses][0]
        : [...statuses].join("|") || null;
    const prob = new Set<string>();
    const join = new Set<string>();
    for (const row of starter.rows ?? []) {
      const rr = asRecord(row);
      if (!rr || asString(rr.gameId) !== gid) continue;
      const ps = asString(rr.probableStatus);
      const jq = asString(rr.joinQuality);
      if (ps) prob.add(ps);
      if (jq) join.add(jq);
    }
    starterByGame[gid].probableStatus = [...prob].join("|") || null;
    starterByGame[gid].joinQuality = [...join].join("|") || null;
  }

  const bullpenByGame: Record<
    string,
    {
      overallRoleComparison: string | null;
      bullpenVerdict: string | null;
      postOutcome: string | null;
    }
  > = {};
  for (const raw of bullpen.games ?? []) {
    const g = asRecord(raw);
    if (!g) continue;
    const gid = asString(g.gameId);
    if (!gid) continue;
    const post = asRecord(g.postGame);
    bullpenByGame[gid] = {
      overallRoleComparison: asString(g.overallRoleComparison),
      bullpenVerdict: asString(post?.bullpenVerdict),
      postOutcome: asString(post?.outcome),
    };
  }

  const lineupByGame: Record<
    string,
    { preGameStatus: string | null; postGameStatus: string | null }
  > = {};
  for (const raw of lineup.rows ?? []) {
    const r = asRecord(raw);
    if (!r) continue;
    const gid = asString(r.gameId);
    if (!gid) continue;
    if (!lineupByGame[gid]) {
      lineupByGame[gid] = { preGameStatus: null, postGameStatus: null };
    }
  }
  for (const gid of Object.keys(lineupByGame)) {
    const sides = (lineup.rows ?? [])
      .map((x) => asRecord(x))
      .filter((x) => x && asString(x.gameId) === gid);
    const pre = new Set(
      sides.map((s) => asString(s?.preGameStatus)).filter(Boolean) as string[],
    );
    const complete = sides.every(
      (s) => asString(s?.lineupStatus) === "COMPLETE",
    );
    lineupByGame[gid].preGameStatus = [...pre].join("|") || null;
    lineupByGame[gid].postGameStatus = complete ? "COMPLETE" : "INCOMPLETE";
  }

  function flowMap(doc: { games?: unknown[] }, kind: "success" | "failure") {
    const m: Record<string, GameRow["flowReview"]> = {};
    for (const raw of doc.games ?? []) {
      const g = asRecord(raw);
      if (!g) continue;
      const gid = asString(g.gameId);
      if (!gid) continue;
      const ft =
        kind === "success"
          ? asRecord(g.successTypes)
          : asRecord(g.failureTypes);
      const st = asRecord(g.starters);
      const bp = asRecord(g.bullpen);
      const secondary = Array.isArray(ft?.secondary)
        ? (ft.secondary as unknown[]).map((x) => String(x))
        : Array.isArray(g.secondary)
          ? (g.secondary as unknown[]).map((x) => String(x))
          : [];
      m[gid] = {
        primary:
          asString(ft?.primary) ??
          asString(g.primary) ??
          null,
        secondary,
        starterVerdict:
          asString(st?.starterVerdict) ?? asString(g.starterVerdict),
        bullpenVerdict:
          asString(bp?.verdict) ??
          asString(bp?.bullpenVerdict) ??
          asString(g.bullpenVerdict),
      };
    }
    return m;
  }

  const successByGame = flowMap(success, "success");
  const failureByGame = flowMap(failure, "failure");

  const games: GameRow[] = graded.map((p) => {
    const gid = asString(p.gameId) ?? "";
    const isSuccess = asString(p.feedbackClassification) === "SIGNAL_WORKED";
    const st = starterByGame[gid];
    const bp = bullpenByGame[gid];
    const lu = lineupByGame[gid];
    return {
      gameId: gid,
      match: `${asString(p.awayTeam) ?? "?"} @ ${asString(p.homeTeam) ?? "?"}`,
      outcome: isSuccess ? "SUCCESS" : "FAILURE",
      predictionHit: p.predictionHit === true,
      pitcherDirection: asString(p.pitcherDirection),
      recommendationGrade: asString(p.recommendationGrade),
      starter: {
        postGame: st?.postGameStatus ?? null,
        probable: st?.probableStatus ?? null,
        join: st?.joinQuality ?? null,
      },
      bullpen: {
        roleComparison: bp?.overallRoleComparison ?? null,
        bullpenVerdict: bp?.bullpenVerdict ?? null,
        postOutcome: bp?.postOutcome ?? null,
      },
      lineup: {
        preGame: lu?.preGameStatus ?? null,
        postGame: lu?.postGameStatus ?? null,
      },
      flowReview: isSuccess
        ? (successByGame[gid] ?? null)
        : (failureByGame[gid] ?? null),
    };
  });

  const starterPatterns: Record<string, number> = {};
  const bullpenPatterns: Record<string, number> = {};
  const lineupPatterns: Record<string, number> = {};
  const comboSuccess: Record<string, number> = {};
  const comboFail: Record<string, number> = {};
  const contradictory: Record<string, number> = {};
  const crossOutcome: Record<string, number> = {};

  for (const g of games) {
    inc(starterPatterns, g.starter.postGame);
    inc(bullpenPatterns, g.bullpen.roleComparison);
    inc(lineupPatterns, `${g.lineup.postGame}|pre:${g.lineup.preGame}`);
    const combo = `starter:${g.starter.postGame}|bullpen:${g.bullpen.roleComparison}|lineup:${g.lineup.postGame}|flow:${g.flowReview?.primary ?? "NONE"}`;
    if (g.outcome === "SUCCESS") inc(comboSuccess, combo);
    else inc(comboFail, combo);

    if (
      g.bullpen.roleComparison === "ROLE_STRUCTURE_SUPPORTS_BASELINE" &&
      g.outcome === "FAILURE"
    ) {
      inc(contradictory, "SUPPORTS_BASELINE+FAILURE");
    }
    if (
      g.bullpen.roleComparison === "ROLE_STRUCTURE_CONFLICTS_BASELINE" &&
      g.outcome === "SUCCESS"
    ) {
      inc(contradictory, "CONFLICTS_BASELINE+SUCCESS");
    }
    if (
      g.starter.postGame === "STARTER_MATCHED" &&
      g.flowReview?.starterVerdict?.includes("DISADVANTAGE")
    ) {
      inc(contradictory, "STARTER_MATCHED+STARTER_DISADVANTAGE_VERDICT");
    }
    if (
      g.bullpen.roleComparison === "ROLE_STRUCTURE_SUPPORTS_BASELINE" &&
      g.flowReview?.bullpenVerdict === "BULLPEN_COLLAPSE"
    ) {
      inc(contradictory, "SUPPORTS_BASELINE+BULLPEN_COLLAPSE");
    }
    if (
      g.bullpen.roleComparison === "ROLE_STRUCTURE_CONFLICTS_BASELINE" &&
      g.flowReview?.bullpenVerdict === "BULLPEN_PROTECTED_LEAD"
    ) {
      inc(contradictory, "CONFLICTS_BASELINE+BULLPEN_PROTECTED");
    }
    if (
      g.lineup.postGame === "COMPLETE" &&
      g.lineup.preGame === "NOT_COLLECTED" &&
      g.outcome === "FAILURE"
    ) {
      inc(crossOutcome, "POSTGAME_LINEUP_ONLY+FAILURE");
    }
    if (
      g.lineup.postGame === "COMPLETE" &&
      g.lineup.preGame === "NOT_COLLECTED" &&
      g.outcome === "SUCCESS"
    ) {
      inc(crossOutcome, "POSTGAME_LINEUP_ONLY+SUCCESS");
    }
  }

  const audit = {
    meta: {
      version: "dataset-correlation-audit-v1",
      kind: "correlation-audit",
      dateKst: DATE,
      generatedAt: new Date().toISOString(),
      auditedGames: games.length,
      successGames: games.filter((g) => g.outcome === "SUCCESS").length,
      failureGames: games.filter((g) => g.outcome === "FAILURE").length,
      minimumSampleForConclusion: 100,
      sampleSufficient: false,
      engineCandidate: false,
      engineAdmission: "PROHIBITED",
      correlationPurpose: "explanatory-only",
      predictionHashSha256: predHash,
      predictionUnchanged: true,
      datasetFilesUnchanged: true,
      conclusion: "DATASET_CORRELATION_COLLECTION_STARTED",
    },
    evidenceSources: [
      `data/research/mlb/${DATE}-starter-dataset-v1.json`,
      `data/research/mlb/${DATE}-bullpen-role-dataset-v1_1.json`,
      `data/research/mlb/${DATE}-lineup-dataset-v1.json`,
      `data/predictions/mlb/${DATE}.json`,
      `data/predictions/mlb/${DATE}-review.json`,
      `data/predictions/mlb/${DATE}-success-flow-review.json`,
      `data/predictions/mlb/${DATE}-failure-flow-review.json`,
      "HYPOTHESIS_REGISTRY.md",
      "RESEARCH_LOG.md",
    ],
    patternSummary: {
      starter: topN(starterPatterns),
      bullpenRoleComparison: topN(bullpenPatterns),
      lineup: topN(lineupPatterns),
      commonSuccessCombinations: topN(comboSuccess),
      commonFailureCombinations: topN(comboFail),
      contradictoryCombinations: topN(contradictory),
      crossOutcomeNotes: topN(crossOutcome),
    },
    games,
    hypothesisImpact: {
      starterHST: {
        ids: ["H-ST-001", "H-ST-002", "H-ST-003", "H-ST-004"],
        note: "STARTER_MATCHED on all 15 games; no STARTER_CHANGED — H-ST-004 not testable yet",
        engineAdmission: "PROHIBITED",
      },
      bullpenHBP: {
        ids: [
          "H-BP-ROLE-001",
          "H-BP-ROLE-002",
          "H-BP-ROLE-003",
          "H-BP-ROLE-004",
          "H-BP-ROLE-005",
          "H-BP-ROLE-007",
        ],
        note: "Role comparison labels co-occur with flow verdicts but n=15 — descriptive only",
        engineAdmission: "PROHIBITED",
      },
      lineupHLU: {
        ids: ["H-LU-001", "H-LU-002", "H-LU-003"],
        note: "Lineup post-game COMPLETE for all; pre-game NOT_COLLECTED — H-LU-003 cannot be evaluated",
        engineAdmission: "PROHIBITED",
      },
    },
    limitations: [
      "Single finished slate (15 games) — below ≥100 target",
      "No causal inference; counts are co-occurrence only",
      "Lineup has no pre-game snapshot on this date",
      "Correlation not promoted to Engine candidate",
    ],
  };

  const outJson = path.join(
    root,
    "data/audits",
    `dataset-correlation-audit-v1-${DATE}.json`,
  );
  await mkdir(path.dirname(outJson), { recursive: true });
  await writeFile(outJson, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  const md = buildMarkdown(audit, DATE);
  const outMd = path.join(root, "DATASET_CORRELATION_AUDIT_V1.md");
  await writeFile(outMd, md, "utf8");

  console.log(`audit: ${outJson}`);
  console.log(`md: ${outMd}`);
  console.log(`games=${games.length} conclusion=${audit.meta.conclusion}`);
}

function buildMarkdown(audit: {
  meta: Record<string, unknown>;
  patternSummary: Record<string, Array<{ key: string; count: number }>>;
  games: GameRow[];
  hypothesisImpact: Record<string, { ids: string[]; note: string; engineAdmission: string }>;
  limitations: string[];
}, dateKst: string): string {
  const ps = audit.patternSummary;
  const gameTable = audit.games
    .map(
      (g) =>
        `| ${g.gameId} | ${g.outcome} | ${g.starter.postGame ?? "—"} | ${g.bullpen.roleComparison ?? "—"} | ${g.lineup.postGame ?? "—"} | ${g.flowReview?.primary ?? "—"} | ${g.flowReview?.bullpenVerdict ?? "—"} |`,
    )
    .join("\n");

  const list = (items: Array<{ key: string; count: number }>) =>
    items.length
      ? items.map((i) => `- \`${i.key}\` ×${i.count}`).join("\n")
      : "- (none)";

  return `# Dataset Correlation Audit v1

연구 전용. Dataset 간 **공존(co-occurrence)** 만 정리한다. Score·Weight·Engine 승격 없음.

근거: \`data/audits/dataset-correlation-audit-v1-${dateKst}.json\`

---

## 요약

| 항목 | 값 |
|------|-----|
| audited games | ${audit.meta.auditedGames} |
| success / failure | ${audit.meta.successGames} / ${audit.meta.failureGames} |
| sample sufficient (≥100) | ${audit.meta.sampleSufficient ? "yes" : "no"} |
| Engine candidate | ${audit.meta.engineCandidate ? "yes" : "no"} |
| Engine admission | ${audit.meta.engineAdmission} |
| prediction hash | \`${audit.meta.predictionHashSha256}\` |

**공식 결론:** \`${audit.meta.conclusion}\`

---

## Starter patterns

${list(ps.starter)}

---

## Bullpen patterns (overallRoleComparison)

${list(ps.bullpenRoleComparison)}

---

## Lineup patterns

${list(ps.lineup)}

---

## Common combinations

### Success (top)

${list(ps.commonSuccessCombinations)}

### Failure (top)

${list(ps.commonFailureCombinations)}

---

## Contradictory combinations

${list(ps.contradictoryCombinations)}

---

## Cross-outcome notes

${list(ps.crossOutcomeNotes)}

---

## Game-level matrix

| gameId | outcome | starter | bullpen role | lineup post | flow primary | bullpen verdict |
|--------|---------|---------|--------------|-------------|--------------|-----------------|
${gameTable}

---

## Hypothesis impact (descriptive only)

| group | IDs | note | Engine |
|-------|-----|------|--------|
| Starter | ${audit.hypothesisImpact.starterHST.ids.join(", ")} | ${audit.hypothesisImpact.starterHST.note} | ${audit.hypothesisImpact.starterHST.engineAdmission} |
| Bullpen | ${audit.hypothesisImpact.bullpenHBP.ids.join(", ")} | ${audit.hypothesisImpact.bullpenHBP.note} | ${audit.hypothesisImpact.bullpenHBP.engineAdmission} |
| Lineup | ${audit.hypothesisImpact.lineupHLU.ids.join(", ")} | ${audit.hypothesisImpact.lineupHLU.note} | ${audit.hypothesisImpact.lineupHLU.engineAdmission} |

---

## Limitations

${audit.limitations.map((l) => `- ${l}`).join("\n")}
`;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
