/**
 * MLB Research Pipeline Status Check v1 — read-only canonical readiness report.
 *
 * No script spawn, no network, no artifact writes.
 *
 * 실행:
 *   npm run research:status -- YYYY-MM-DD
 *   tsx scripts/check-mlb-research-pipeline-status-v1.ts YYYY-MM-DD
 */
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type CommandStatus =
  | "READY"
  | "ALREADY_COMPLETE"
  | "AWAITING_RESULTS"
  | "UP_TO_DATE_PARTIAL"
  | "WAIT_FOR_FINAL"
  | "WAIT_FOR_FULL_SLATE"
  | "BLOCKED_BY_MISSING_ARTIFACT";

type SlateCounts = {
  total: number;
  graded: number;
  pending: number;
  worked: number;
  failed: number;
};

type ArtifactPresence = {
  postgameReview: boolean;
  successFlow: boolean;
  failureFlow: boolean;
  starterPreGame: boolean;
  starterPostGame: boolean;
  starterPostGameSummary: string | null;
  bullpenDataset: boolean;
  bullpenValidation: boolean;
  lineupDataset: boolean;
  researchOps: boolean;
  researchOpsDetail: string;
};

type CommandDecision = {
  command: string;
  status: CommandStatus;
  note: string;
};

function parseDateArg(argv: string[]): string {
  const positional = argv.slice(2).filter((a) => !a.startsWith("--"));
  const date =
    positional[0]?.trim() ||
    process.env.MLB_TARGET_DATE_KST?.trim() ||
    "";

  if (!date) {
    throw new Error(
      "Missing date. Usage: npm run research:status -- YYYY-MM-DD",
    );
  }
  if (!DATE_RE.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD.`);
  }
  return date;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function fileExists(rel: string): Promise<boolean> {
  try {
    await access(path.join(process.cwd(), rel));
    return true;
  } catch {
    return false;
  }
}

async function readJson(rel: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(
      await readFile(path.join(process.cwd(), rel), "utf8"),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function countPredictionResults(predictions: unknown[]): SlateCounts {
  let graded = 0;
  let worked = 0;
  let failed = 0;
  let pending = 0;

  for (const raw of predictions) {
    const p = asRecord(raw);
    if (!p) continue;
    const resultStatus = asString(p.resultStatus);
    if (resultStatus === "graded") {
      graded += 1;
      if (p.predictionHit === true) worked += 1;
      else if (p.predictionHit === false) failed += 1;
    } else if (resultStatus === "pending" || resultStatus == null) {
      pending += 1;
    }
  }

  return {
    total: predictions.length,
    graded,
    pending,
    worked,
    failed,
  };
}

function countReviewGames(review: Record<string, unknown>): {
  worked: number;
  failed: number;
  pending: number;
} {
  const games = Array.isArray(review.games) ? review.games : [];
  let worked = 0;
  let failed = 0;
  let pending = 0;

  for (const raw of games) {
    const g = asRecord(raw);
    if (!g) continue;
    const resultStatus = asString(g.resultStatus);
    const feedback = asString(g.feedbackClassification);
    if (resultStatus === "graded") {
      if (feedback === "SIGNAL_WORKED") worked += 1;
      else if (feedback === "SIGNAL_FAILED") failed += 1;
    } else if (resultStatus === "pending") {
      pending += 1;
    }
  }

  return { worked, failed, pending };
}

function checkPostgameGuards(
  date: string,
  pred: Record<string, unknown>,
  review: Record<string, unknown> | null,
  successFlow: Record<string, unknown> | null,
  failureFlow: Record<string, unknown> | null,
): string[] {
  const issues: string[] = [];
  const reviewRel = `data/predictions/mlb/${date}-review.json`;

  if (!review) {
    issues.push(`Missing review artifact: ${reviewRel}`);
    return issues;
  }

  const summary = asRecord(review.summary) ?? {};
  const reviewGraded = asNumber(summary.graded) ?? 0;
  const reviewHits = asNumber(summary.hits) ?? 0;
  const reviewFails = asNumber(summary.fails) ?? 0;
  const reviewPending = asNumber(summary.pending) ?? 0;

  const predCounts = countPredictionResults(
    Array.isArray(pred.predictions) ? pred.predictions : [],
  );

  if (
    predCounts.graded !== reviewGraded ||
    predCounts.worked !== reviewHits ||
    predCounts.failed !== reviewFails ||
    predCounts.pending !== reviewPending
  ) {
    issues.push(
      `Review summary drift vs prediction (graded/hits/fails/pending review=${reviewGraded}/${reviewHits}/${reviewFails}/${reviewPending}, prediction=${predCounts.graded}/${predCounts.worked}/${predCounts.failed}/${predCounts.pending})`,
    );
  }

  const gameCounts = countReviewGames(review);
  if (gameCounts.worked !== reviewHits || gameCounts.failed !== reviewFails) {
    issues.push(
      `Review games drift vs summary (games worked/failed=${gameCounts.worked}/${gameCounts.failed}, summary hits/fails=${reviewHits}/${reviewFails})`,
    );
  }

  if (reviewHits > 0) {
    const successRel = `data/predictions/mlb/${date}-success-flow-review.json`;
    if (!successFlow) {
      issues.push(`Missing success flow review: ${successRel}`);
    } else {
      const games = Array.isArray(successFlow.games) ? successFlow.games : [];
      if (games.length !== reviewHits) {
        issues.push(
          `Success flow count mismatch: expected ${reviewHits}, got ${games.length}`,
        );
      }
    }
  }

  if (reviewFails > 0) {
    const failureRel = `data/predictions/mlb/${date}-failure-flow-review.json`;
    if (!failureFlow) {
      issues.push(`Missing failure flow review: ${failureRel}`);
    } else {
      const games = Array.isArray(failureFlow.games) ? failureFlow.games : [];
      if (games.length !== reviewFails) {
        issues.push(
          `Failure flow count mismatch: expected ${reviewFails}, got ${games.length}`,
        );
      }
    }
  }

  return issues;
}

function formatPresence(present: boolean): string {
  return present ? "present" : "absent";
}

function decideStarterStatus(
  date: string,
  artifacts: Pick<
    ArtifactPresence,
    "starterPreGame" | "starterPostGame" | "starterPostGameSummary"
  >,
  predCounts: Pick<SlateCounts, "graded" | "pending" | "total">,
  starterPost: Record<string, unknown> | null,
): CommandDecision {
  const starterCmd = `npm run research:starter -- ${date}`;

  if (!artifacts.starterPreGame) {
    return {
      command: starterCmd,
      status: "READY",
      note: "Pre-game Starter Dataset not collected yet.",
    };
  }

  if (predCounts.graded === 0) {
    return {
      command: starterCmd,
      status: "AWAITING_RESULTS",
      note: "Pre-game Starter Dataset collected; waiting for finished games.",
    };
  }

  if (!artifacts.starterPostGame) {
    return {
      command: starterCmd,
      status: "READY",
      note: "Final game(s) graded; post-game review missing — update needed.",
    };
  }

  const summary = asRecord(starterPost?.summary) ?? {};
  const totalRows = asNumber(summary.totalRows) ?? 0;
  const awaitingResult = asNumber(summary.awaitingResult) ?? 0;
  const rowsPerGame =
    predCounts.total > 0 && totalRows > 0
      ? totalRows / predCounts.total
      : 2;
  const expectedAwaiting = Math.round(predCounts.pending * rowsPerGame);

  if (predCounts.pending === 0) {
    if (awaitingResult === 0) {
      return {
        command: starterCmd,
        status: "ALREADY_COMPLETE",
        note: "Starter pre-game dataset + postgame review complete (awaitingResult=0).",
      };
    }
    return {
      command: starterCmd,
      status: "READY",
      note: `Full slate graded but post-game review has ${awaitingResult} unresolved row(s).`,
    };
  }

  if (awaitingResult === expectedAwaiting) {
    const artifactNote = artifacts.starterPostGameSummary
      ? ` (${artifacts.starterPostGameSummary})`
      : "";
    return {
      command: starterCmd,
      status: "UP_TO_DATE_PARTIAL",
      note: `Post-game review matches current partial slate${artifactNote}.`,
    };
  }

  return {
    command: starterCmd,
    status: "READY",
    note: `New Final game(s) since last Starter run (awaiting ${awaitingResult}, expected ${expectedAwaiting}).`,
  };
}

async function main() {
  const date = parseDateArg(process.argv);
  const predRel = `data/predictions/mlb/${date}.json`;

  if (!(await fileExists(predRel))) {
    console.error(
      `ERROR: Missing prediction snapshot for ${date}: ${predRel}`,
    );
    console.error(
      "Freeze a prediction snapshot before checking pipeline status.",
    );
    process.exitCode = 1;
    return;
  }

  const pred = (await readJson(predRel))!;
  const review = await readJson(`data/predictions/mlb/${date}-review.json`);
  const successFlow = await readJson(
    `data/predictions/mlb/${date}-success-flow-review.json`,
  );
  const failureFlow = await readJson(
    `data/predictions/mlb/${date}-failure-flow-review.json`,
  );
  const starterPre = await readJson(
    `data/research/mlb/${date}-starter-dataset-v1.json`,
  );
  const starterPost = await readJson(
    `data/research/mlb/${date}-starter-postgame-review-v1.json`,
  );
  const bullpenDataset = await readJson(
    `data/research/mlb/${date}-bullpen-role-dataset-v1_1.json`,
  );
  const bullpenValidation = await readJson(
    `data/audits/bullpen-v1_1-validation-${date}.json`,
  );
  const lineupDataset = await readJson(
    `data/research/mlb/${date}-lineup-dataset-v1.json`,
  );

  const opsPaths = [
    `data/audits/dataset-correlation-audit-v1-${date}.json`,
    `data/audits/contradiction-ledger-v1-${date}-audit.json`,
    `data/audits/contradiction-severity-audit-v1-${date}.json`,
    `data/audits/dataset-coverage-dashboard-v1-${date}.json`,
  ];
  const opsPresence = await Promise.all(opsPaths.map((p) => fileExists(p)));
  const opsPresentCount = opsPresence.filter(Boolean).length;

  const predCounts = countPredictionResults(
    Array.isArray(pred.predictions) ? pred.predictions : [],
  );

  let worked = predCounts.worked;
  let failed = predCounts.failed;
  if (review) {
    const summary = asRecord(review.summary) ?? {};
    const reviewHits = asNumber(summary.hits);
    const reviewFails = asNumber(summary.fails);
    if (reviewHits != null) worked = reviewHits;
    if (reviewFails != null) failed = reviewFails;
  }

  const postgameGuardIssues = checkPostgameGuards(
    date,
    pred,
    review,
    successFlow,
    failureFlow,
  );
  const postgameGuardsPass = postgameGuardIssues.length === 0;

  let starterPostSummary: string | null = null;
  if (starterPost) {
    const s = asRecord(starterPost.summary) ?? {};
    starterPostSummary = [
      `matched=${asNumber(s.starterMatched) ?? "?"}`,
      `awaiting=${asNumber(s.awaitingResult) ?? "?"}`,
      `rows=${asNumber(s.totalRows) ?? "?"}`,
    ].join(", ");
  }

  const bullpenPipelineRan =
    bullpenValidation?.meta &&
    asRecord(bullpenValidation.meta)?.pipelineRan === true;

  const artifacts: ArtifactPresence = {
    postgameReview: review != null,
    successFlow: successFlow != null,
    failureFlow: failureFlow != null,
    starterPreGame: starterPre != null,
    starterPostGame: starterPost != null,
    starterPostGameSummary: starterPostSummary,
    bullpenDataset: bullpenDataset != null,
    bullpenValidation: bullpenValidation != null,
    lineupDataset: lineupDataset != null,
    researchOps: opsPresentCount === opsPaths.length,
    researchOpsDetail: `${opsPresentCount}/${opsPaths.length} dated ops audits`,
  };

  const postgameComplete =
    predCounts.graded > 0 &&
    predCounts.pending === 0 &&
    postgameGuardsPass;

  const bullpenComplete =
    artifacts.bullpenDataset &&
    artifacts.bullpenValidation &&
    bullpenPipelineRan === true &&
    predCounts.pending === 0;

  const lineupComplete =
    artifacts.lineupDataset && predCounts.pending === 0;

  const opsPrereqs = {
    starter: artifacts.starterPreGame,
    bullpen: artifacts.bullpenDataset,
    lineup: artifacts.lineupDataset,
    review: artifacts.postgameReview && postgameGuardsPass,
  };
  const missingOpsPrereqs = Object.entries(opsPrereqs)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);

  const decisions: CommandDecision[] = [];

  // 1. postgame
  if (predCounts.graded === 0) {
    decisions.push({
      command: `npm run research:postgame -- ${date}`,
      status: "WAIT_FOR_FINAL",
      note: "No Final games graded yet (graded=0).",
    });
  } else if (postgameComplete) {
    decisions.push({
      command: `npm run research:postgame -- ${date}`,
      status: "ALREADY_COMPLETE",
      note: `Full slate graded (${predCounts.graded}/${predCounts.total}); review guards pass.`,
    });
  } else {
    decisions.push({
      command: `npm run research:postgame -- ${date}`,
      status: "READY",
      note: `${predCounts.graded} Final game(s) graded; ${predCounts.pending} still pending — partial rerun OK.`,
    });
  }

  // 2. starter
  decisions.push(
    decideStarterStatus(
      date,
      {
        starterPreGame: artifacts.starterPreGame,
        starterPostGame: artifacts.starterPostGame,
        starterPostGameSummary: artifacts.starterPostGameSummary,
      },
      predCounts,
      starterPost,
    ),
  );

  // 3. bullpen-validate --skip-postgame-steps
  const bullpenCmd = `npm run research:bullpen-validate -- ${date} --skip-postgame-steps`;
  if (!postgameGuardsPass) {
    decisions.push({
      command: bullpenCmd,
      status: "BLOCKED_BY_MISSING_ARTIFACT",
      note: postgameGuardIssues.join("; "),
    });
  } else if (predCounts.graded === 0) {
    decisions.push({
      command: bullpenCmd,
      status: "WAIT_FOR_FINAL",
      note: "Postgame guards pass but graded=0 (AWAITING_FINISHED_GAMES).",
    });
  } else if (bullpenComplete) {
    decisions.push({
      command: bullpenCmd,
      status: "ALREADY_COMPLETE",
      note: "Bullpen dataset + validation (pipelineRan=true) present for full slate.",
    });
  } else {
    decisions.push({
      command: bullpenCmd,
      status: "READY",
      note: `${predCounts.graded} graded game(s); postgame guards pass.`,
    });
  }

  // 4. lineup
  const lineupCmd = `npm run research:lineup -- ${date}`;
  if (predCounts.pending > 0) {
    decisions.push({
      command: lineupCmd,
      status: "WAIT_FOR_FULL_SLATE",
      note: `${predCounts.pending} game(s) still pending (${predCounts.graded}/${predCounts.total} graded).`,
    });
  } else if (predCounts.graded === 0) {
    decisions.push({
      command: lineupCmd,
      status: "WAIT_FOR_FINAL",
      note: "AWAITING_FINISHED_GAMES (graded=0).",
    });
  } else if (lineupComplete) {
    decisions.push({
      command: lineupCmd,
      status: "ALREADY_COMPLETE",
      note: "Lineup dataset present for full slate.",
    });
  } else {
    decisions.push({
      command: lineupCmd,
      status: "READY",
      note: "Full slate graded; lineup dataset not yet created.",
    });
  }

  // 5. research:ops
  const opsCmd = `npm run research:ops -- ${date}`;
  if (predCounts.pending > 0) {
    decisions.push({
      command: opsCmd,
      status: "WAIT_FOR_FULL_SLATE",
      note: `${predCounts.pending} game(s) pending — lineup dataset requires full slate.`,
    });
  } else if (missingOpsPrereqs.length > 0) {
    decisions.push({
      command: opsCmd,
      status: "BLOCKED_BY_MISSING_ARTIFACT",
      note: `Missing prerequisite artifact(s): ${missingOpsPrereqs.join(", ")}.`,
    });
  } else if (artifacts.researchOps) {
    decisions.push({
      command: opsCmd,
      status: "ALREADY_COMPLETE",
      note: `Research ops dated audits complete (${artifacts.researchOpsDetail}).`,
    });
  } else {
    decisions.push({
      command: opsCmd,
      status: "READY",
      note: "All required input artifacts present; ops dated audits incomplete.",
    });
  }

  const readyCommands = decisions
    .filter((d) => d.status === "READY")
    .map((d) => d.command);

  console.log(`=== MLB Research Pipeline Status v1 (${date}) ===\n`);
  console.log("Slate (from prediction snapshot + review when present):");
  console.log(`  total games : ${predCounts.total}`);
  console.log(`  graded      : ${predCounts.graded}`);
  console.log(`  pending     : ${predCounts.pending}`);
  console.log(`  worked      : ${worked}`);
  console.log(`  failed      : ${failed}`);
  console.log("");

  console.log("Artifacts (read-only):");
  console.log(
    `  postgame review        : ${formatPresence(artifacts.postgameReview)}`,
  );
  console.log(
    `  success flow           : ${formatPresence(artifacts.successFlow)}${predCounts.worked > 0 || worked > 0 ? "" : " (n/a)"}`,
  );
  console.log(
    `  failure flow           : ${formatPresence(artifacts.failureFlow)}${predCounts.failed > 0 || failed > 0 ? "" : " (n/a)"}`,
  );
  console.log(
    `  starter pre-game       : ${formatPresence(artifacts.starterPreGame)}`,
  );
  console.log(
    `  starter postgame       : ${formatPresence(artifacts.starterPostGame)}${starterPostSummary ? ` (${starterPostSummary})` : ""}`,
  );
  console.log(
    `  bullpen dataset        : ${formatPresence(artifacts.bullpenDataset)}`,
  );
  console.log(
    `  bullpen validation     : ${formatPresence(artifacts.bullpenValidation)}${bullpenValidation ? ` (pipelineRan=${String(bullpenPipelineRan)})` : ""}`,
  );
  console.log(
    `  lineup dataset         : ${formatPresence(artifacts.lineupDataset)}`,
  );
  console.log(
    `  research ops audits    : ${artifacts.researchOpsDetail} (${artifacts.researchOps ? "complete" : "incomplete"})`,
  );
  if (!postgameGuardsPass) {
    console.log("");
    console.log("Postgame guard issues:");
    for (const issue of postgameGuardIssues) {
      console.log(`  - ${issue}`);
    }
  }
  console.log("");

  console.log("Canonical commands:");
  for (const d of decisions) {
    console.log(`  [${d.status}] ${d.command}`);
    console.log(`             ${d.note}`);
  }
  console.log("");

  if (readyCommands.length > 0) {
    console.log("Copyable commands (READY, canonical order):");
    for (const cmd of readyCommands) {
      console.log(cmd);
    }
  } else {
    console.log("Copyable commands: (none)");
    if (predCounts.graded === 0) {
      console.log("현재 실행할 명령 없음 — 첫 Final 경기 대기");
    } else {
      console.log("");
      console.log("Waiting conditions:");
      for (const d of decisions) {
        if (
          d.status === "READY" ||
          d.status === "ALREADY_COMPLETE" ||
          d.status === "AWAITING_RESULTS" ||
          d.status === "UP_TO_DATE_PARTIAL"
        ) {
          continue;
        }
        console.log(`  - ${d.command}: ${d.status} — ${d.note}`);
      }
    }
  }

  console.log("");
  console.log("Official conclusion: RESEARCH_PIPELINE_STATUS_CHECK_READY");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
