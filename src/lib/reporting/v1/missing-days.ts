/**
 * Missing Operating Day foundation.
 * A silent "0 games" must not hide a missing operating day.
 */
import type { DailyMandatoryAssessment } from "./daily-mandatory";
import type { Derivable, SportId } from "./types";

export type OperatingDayClass =
  | "FULLY_CLOSED"
  | "PARTIAL"
  | "MISSING"
  | "NOT_DERIVABLE";

export type DeclaredOperatingScope = {
  sport: SportId | "MULTI";
  dates: string[];
  scopeLockedAt: string;
  reason: string;
  evidenceRel: string | null;
  source: string;
};

export type MissingDaySummary = {
  expectedOperatingDays: Derivable<string[]>;
  daysWithEvidence: string[];
  fullyClosedDays: string[];
  partiallyClosedDays: string[];
  missingDays: string[];
  derivation: string;
};

function uniqueSorted(dates: string[]): string[] {
  return [...new Set(dates)].sort();
}

export function classifyOperatingDay(input: {
  expected: boolean;
  hasEvidence: boolean;
  assessment: DailyMandatoryAssessment | null;
}): OperatingDayClass {
  if (!input.expected) return "NOT_DERIVABLE";
  if (!input.hasEvidence) return "MISSING";
  if (!input.assessment) return "PARTIAL";
  if (input.assessment.completionStatus === "NOT_DERIVABLE") {
    return "NOT_DERIVABLE";
  }
  if (input.assessment.operationallyClosed) return "FULLY_CLOSED";
  return "PARTIAL";
}

/**
 * Expected days come from a locked operating scope, never from "every calendar day"
 * and never solely from days that already have files (that would hide missing days).
 */
export function summarizeMissingDays(input: {
  declaredScope: DeclaredOperatingScope | null;
  daysWithEvidence: string[];
  assessments: DailyMandatoryAssessment[];
}): MissingDaySummary {
  if (
    !input.declaredScope ||
    !input.declaredScope.scopeLockedAt.trim() ||
    !input.declaredScope.source.trim()
  ) {
    return {
      expectedOperatingDays: {
        status: "NOT_DERIVABLE",
        reason:
          "No locked operating-scope calendar. Schedule-file discovery cannot prove missing days.",
      },
      daysWithEvidence: uniqueSorted(input.daysWithEvidence),
      fullyClosedDays: [],
      partiallyClosedDays: [],
      missingDays: [],
      derivation: "NOT_DERIVABLE",
    };
  }

  const expected = uniqueSorted(input.declaredScope.dates);
  const evidence = new Set(input.daysWithEvidence);
  const byDate = new Map(input.assessments.map((a) => [a.dateKst, a]));
  const fullyClosedDays: string[] = [];
  const partiallyClosedDays: string[] = [];
  const missingDays: string[] = [];

  for (const date of expected) {
    const klass = classifyOperatingDay({
      expected: true,
      hasEvidence: evidence.has(date),
      assessment: byDate.get(date) ?? null,
    });
    if (klass === "MISSING") missingDays.push(date);
    else if (klass === "FULLY_CLOSED") fullyClosedDays.push(date);
    else if (klass === "PARTIAL") partiallyClosedDays.push(date);
  }

  return {
    expectedOperatingDays: { status: "DERIVED", value: expected },
    daysWithEvidence: uniqueSorted(input.daysWithEvidence),
    fullyClosedDays,
    partiallyClosedDays,
    missingDays,
    derivation: "DECLARED_OPERATING_SCOPE",
  };
}
