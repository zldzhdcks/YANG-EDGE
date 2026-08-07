/**
 * Plain-language card summaries from existing review fields.
 * Presentation only — not an Engine / Prediction change.
 */

import { failureCauseLabel, successCauseLabel } from "./category-labels";

export function buildFailureAiSummary(input: {
  failureCategories: string[];
  unexpectedOutcome: string;
  alternativeHypothesis: string;
  volatilityRisk: string;
  pickTeam: string | null;
  actualSide: string | null;
}): string {
  const primary = input.failureCategories[0];
  const primaryLabel = primary ? failureCauseLabel(primary) : "Unclassified";
  const hasBlowout = input.failureCategories.includes("BLOWOUT");
  const hasLineup = input.failureCategories.includes("LINEUP");
  const hasBullpen = input.failureCategories.includes("BULLPEN");
  const hasStarter = input.failureCategories.includes("STARTER");
  const hasOneRun = input.failureCategories.includes("ONE_RUN_GAME");

  const parts: string[] = [];

  if (hasStarter) {
    parts.push(
      "Starter edge was evaluated before the game, but the outing or opposing offense did not follow the pre-game signal.",
    );
  } else if (hasLineup) {
    parts.push(
      "Lineup confirmation was incomplete or late, so the model lacked the final batting context.",
    );
  }

  if (hasBlowout) {
    parts.push(
      "Offensive production greatly exceeded a typical variance band and produced a blowout.",
    );
  } else if (hasOneRun) {
    parts.push(
      "The game was decided by a single run — high-volatility territory where one miss is weakly informative.",
    );
  } else if (hasBullpen) {
    parts.push(
      "Late-inning leverage / bullpen sequencing is a plausible swing factor on this miss.",
    );
  }

  if (parts.length === 0) {
    parts.push(input.alternativeHypothesis || input.volatilityRisk);
  }

  const pick = input.pickTeam ?? "the pick";
  parts.push(
    `Predicted ${pick}; actual winner side=${input.actualSide ?? "?"}. Primary tag: ${primaryLabel}.`,
  );

  return parts.join(" ");
}

export function buildSuccessAiSummary(input: {
  successCategories: string[];
  whyCorrect: Array<{ category: string; evidence: string }>;
  pickTeam: string | null;
}): string {
  const primary = input.successCategories[0];
  const primaryLabel = primary ? successCauseLabel(primary) : "Correct pick";
  const why =
    input.whyCorrect[0]?.evidence ??
    "Correct side matched the final winner.";

  const extras = input.successCategories
    .slice(1, 3)
    .map((c) => successCauseLabel(c).toLowerCase());

  const tail =
    extras.length > 0
      ? ` Secondary support: ${extras.join("; ")}.`
      : "";

  return `${primaryLabel} for ${input.pickTeam ?? "the pick"}. ${why}.${tail} A correct result is not causal proof for Engine changes.`;
}

export function buildDailyResearchCommentary(input: {
  failureCategoryCount: Record<string, number>;
  successCategoryCount: Record<string, number>;
  incorrect: number;
  correct: number;
}): string {
  const failEntries = Object.entries(input.failureCategoryCount).sort(
    (a, b) => b[1] - a[1],
  );
  const top = failEntries.slice(0, 2).map(([k]) => k);
  const hasLineup = (input.failureCategoryCount.LINEUP ?? 0) > 0;
  const hasBullpen = (input.failureCategoryCount.BULLPEN ?? 0) > 0;
  const hasStarter = (input.failureCategoryCount.STARTER ?? 0) > 0;
  const marketSuccess = input.successCategoryCount.MARKET ?? 0;

  const lines: string[] = [];

  if (input.incorrect === 0) {
    lines.push("No incorrect graded picks today — still treat results as research-only.");
  } else if (hasLineup && hasBullpen) {
    lines.push(
      "Today's failures were concentrated around late lineup impact and bullpen variance.",
    );
  } else if (hasLineup) {
    lines.push(
      "Today's failures were concentrated around lineup timing / confirmation gaps.",
    );
  } else if (hasBullpen) {
    lines.push("Today's failures leaned toward late-game bullpen / close-game variance.");
  } else if (top[0]) {
    lines.push(
      `Today's failures were led by ${failureCauseLabel(top[0]).toLowerCase()}.`,
    );
  }

  if (!hasStarter || (input.failureCategoryCount.STARTER ?? 0) <= 1) {
    lines.push("Starter evaluation remained relatively stable versus other tags.");
  } else {
    lines.push("Starter tags appeared more than usual — inspect starter completeness before weight talk.");
  }

  if (marketSuccess > 0) {
    lines.push(
      `Market alignment showed up on ${marketSuccess} correct picks (supportive, not causal).`,
    );
  }

  if (hasLineup) {
    lines.push(
      "Future research should prioritize lineup timing before changing bullpen weighting.",
    );
  } else {
    lines.push(
      "Accumulate more graded days before proposing Engine or weight changes.",
    );
  }

  lines.push(
    `Scoreboard (research): ${input.correct} correct / ${input.incorrect} incorrect.`,
  );

  return lines.join(" ");
}
