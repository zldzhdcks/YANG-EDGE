/**
 * Manual operator slate intake workflow.
 *
 * Intended operator steps (no auto one-click):
 * 1. init-draft
 * 2. manually enter all observed games
 * 3. validate
 * 4. manually verify home/away and times
 * 5. manually confirm complete slate
 * 6. set per-game reviewStatus=VERIFIED
 * 7. set top-level reviewStatus=VERIFIED
 * 8. set scopeCompletenessStatus=COMPLETE
 * 9. set reviewedAt
 * 10. validate again
 * 11. only then run research:slate-source-freeze
 *
 * Never auto-perform steps 4–9.
 */
import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import {
  BETMAN_DAILY_SLATE_SCHEMA_VERSION,
  type BetmanDailySlateInputV1,
} from "./betman-daily-slate-types";
import {
  betmanDailySlateInputPath,
  validateBetmanDailySlateV1,
  type OperatorSlateIntakeStatus,
  type ValidateBetmanDailySlateResult,
} from "./validate-betman-daily-slate-v1";

export { betmanDailySlateInputPath };

export type InitDraftResult =
  | {
      status: "DRAFT_CREATED";
      path: string;
      document: BetmanDailySlateInputV1;
    }
  | {
      status: "INPUT_ALREADY_EXISTS";
      path: string;
      document: null;
    };

export async function initOperatorSlateDraft(input: {
  dateKst: string;
  cwd?: string;
  enteredAt?: string;
}): Promise<InitDraftResult> {
  const cwd = input.cwd ?? process.cwd();
  const abs = betmanDailySlateInputPath(input.dateKst, cwd);
  await mkdir(path.dirname(abs), { recursive: true });

  const document: BetmanDailySlateInputV1 = {
    schemaVersion: BETMAN_DAILY_SLATE_SCHEMA_VERSION,
    targetDateKst: input.dateKst,
    sourceType: "OPERATOR_MANUAL",
    capturedAt: null,
    enteredAt: input.enteredAt ?? new Date().toISOString(),
    reviewedAt: null,
    reviewStatus: "DRAFT",
    scopeCompletenessStatus: "UNVERIFIED",
    games: [],
  };

  try {
    const fh = await open(abs, "wx");
    try {
      await fh.writeFile(`${JSON.stringify(document, null, 2)}\n`, "utf8");
    } finally {
      await fh.close();
    }
    return { status: "DRAFT_CREATED", path: abs, document };
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    if (code === "EEXIST") {
      return { status: "INPUT_ALREADY_EXISTS", path: abs, document: null };
    }
    throw err;
  }
}

export async function validateOperatorSlateIntake(input: {
  dateKst: string;
  cwd?: string;
}): Promise<ValidateBetmanDailySlateResult> {
  return validateBetmanDailySlateV1(input);
}

export type { OperatorSlateIntakeStatus, ValidateBetmanDailySlateResult };
