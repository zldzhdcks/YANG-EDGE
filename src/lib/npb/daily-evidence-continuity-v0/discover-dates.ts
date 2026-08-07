import { readdir } from "node:fs/promises";
import path from "node:path";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function addDaysKst(dateKst: string, delta: number): string {
  const [y, m, d] = dateKst.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function extractDatesFromNames(names: string[], patterns: RegExp[]): string[] {
  const out = new Set<string>();
  for (const name of names) {
    for (const re of patterns) {
      const m = name.match(re);
      if (m?.[1] && DATE_RE.test(m[1])) out.add(m[1]);
    }
  }
  return [...out];
}

/**
 * Discover NPB ops dates from artifacts + neighbors of focus date.
 * Read-only; never invents schedule rows.
 */
export async function discoverNpbOpsDates(input: {
  focusDateKst: string;
  cwd?: string;
  /** Extra padding days around focus (default 1). */
  neighborSpan?: number;
}): Promise<string[]> {
  const cwd = input.cwd ?? process.cwd();
  const focus = input.focusDateKst;
  const span = input.neighborSpan ?? 1;
  const dates = new Set<string>([focus]);

  for (let i = 1; i <= span; i++) {
    dates.add(addDaysKst(focus, -i));
    dates.add(addDaysKst(focus, i));
  }

  const dirs = [
    path.join(cwd, "data/research/npb"),
    path.join(cwd, "data/predictions/npb"),
    path.join(cwd, "data/operator-input/npb"),
  ];

  for (const dir of dirs) {
    try {
      const names = await readdir(dir);
      for (const d of extractDatesFromNames(names, [
        /^(\d{4}-\d{2}-\d{2})-schedule-v1\.json$/,
        /^(\d{4}-\d{2}-\d{2})-official-results-v0\.json$/,
        /^(\d{4}-\d{2}-\d{2})\.json$/,
        /^(\d{4}-\d{2}-\d{2})-starter-confirmation-v1\.json$/,
        /^(\d{4}-\d{2}-\d{2})-market-odds-confirmation-v0\.json$/,
      ])) {
        dates.add(d);
      }
    } catch {
      /* missing dir ok */
    }
  }

  return [...dates].sort();
}

export function shortDateLabel(dateKst: string): string {
  const parts = dateKst.split("-");
  if (parts.length !== 3) return dateKst;
  return `${parts[1]}-${parts[2]}`;
}

export { addDaysKst };
