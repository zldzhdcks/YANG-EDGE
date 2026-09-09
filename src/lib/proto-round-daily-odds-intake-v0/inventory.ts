import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  isSupportedImageExtension,
  OPERATOR_ROOT_NAME,
  protoRoundIdentity,
} from "../proto-round-screenshot-intake-v1";
import { DailyOddsIntakeV0Error } from "./error";
import { DAILY_ODDS_INTAKE_TIMEZONE, type DailyOddsInventoryHitV0 } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_DIR_RE = /^\d{4}$/;
const ROUND_DIR_RE = /^(\d+)회차$/;

export function assertInventoryDate(value: string): string {
  if (!DATE_RE.test(value)) {
    throw new DailyOddsIntakeV0Error("INVALID_INVENTORY_DATE");
  }
  return value;
}

export function dailySealFileName(inventoryDate: string): string {
  return `${assertInventoryDate(inventoryDate)}-new-screenshot-seal-v0.json`;
}

export function filenameContainsInventoryDate(
  fileName: string,
  inventoryDate: string,
): boolean {
  return fileName.includes(assertInventoryDate(inventoryDate));
}

export function seoulCalendarDate(isoOrMs: string | number): string {
  const d = typeof isoOrMs === "number" ? new Date(isoOrMs) : new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) {
    throw new DailyOddsIntakeV0Error("INVALID_FILESYSTEM_TIME");
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_ODDS_INTAKE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function filesystemDateMatchesInventoryDate(
  inventoryDate: string,
  mtimeMs: number,
  birthtimeMs: number,
): boolean {
  const expected = assertInventoryDate(inventoryDate);
  return (
    seoulCalendarDate(mtimeMs) === expected ||
    seoulCalendarDate(birthtimeMs) === expected
  );
}

export function isDailyNewScreenshotFile(input: {
  fileName: string;
  inventoryDate: string;
  mtimeMs: number;
  birthtimeMs: number;
}): boolean {
  if (!isSupportedImageExtension(path.extname(input.fileName))) return false;
  return (
    filenameContainsInventoryDate(input.fileName, input.inventoryDate) ||
    filesystemDateMatchesInventoryDate(
      input.inventoryDate,
      input.mtimeMs,
      input.birthtimeMs,
    )
  );
}

export function listProtoRoundDirectories(operatorRootAbs: string): Array<{
  year: number;
  round: number;
  roundLabel: string;
  roundAbs: string;
}> {
  if (path.basename(operatorRootAbs) !== OPERATOR_ROOT_NAME) {
    throw new DailyOddsIntakeV0Error("INVALID_OPERATOR_ROOT_NAME");
  }
  if (!existsSync(operatorRootAbs)) return [];
  const out: Array<{
    year: number;
    round: number;
    roundLabel: string;
    roundAbs: string;
  }> = [];
  for (const yearEntry of readdirSync(operatorRootAbs, { withFileTypes: true })) {
    if (!yearEntry.isDirectory() || !YEAR_DIR_RE.test(yearEntry.name)) continue;
    const year = Number(yearEntry.name);
    const yearAbs = path.join(operatorRootAbs, yearEntry.name);
    for (const roundEntry of readdirSync(yearAbs, { withFileTypes: true })) {
      const match = ROUND_DIR_RE.exec(roundEntry.name);
      if (!roundEntry.isDirectory() || !match) continue;
      const round = Number(match[1]);
      const identity = protoRoundIdentity(year, round);
      out.push({
        year: identity.year,
        round: identity.round,
        roundLabel: identity.roundLabel,
        roundAbs: path.join(yearAbs, roundEntry.name),
      });
    }
  }
  out.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.round - b.round;
  });
  return out;
}

export function inventoryDailyScreenshots(input: {
  operatorRootAbs: string;
  inventoryDate: string;
}): DailyOddsInventoryHitV0[] {
  const inventoryDate = assertInventoryDate(input.inventoryDate);
  const hits: DailyOddsInventoryHitV0[] = [];
  for (const roundDir of listProtoRoundDirectories(input.operatorRootAbs)) {
    let entries: Array<{ name: string; isFile: () => boolean }>;
    try {
      entries = readdirSync(roundDir.roundAbs, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || entry.name === ".yang-edge") continue;
      const absPath = path.join(roundDir.roundAbs, entry.name);
      let st: { mtimeMs: number; birthtimeMs: number };
      try {
        st = statSync(absPath);
      } catch {
        continue;
      }
      if (
        !isDailyNewScreenshotFile({
          fileName: entry.name,
          inventoryDate,
          mtimeMs: st.mtimeMs,
          birthtimeMs: st.birthtimeMs,
        })
      ) {
        continue;
      }
      hits.push({
        year: roundDir.year,
        round: roundDir.round,
        roundLabel: roundDir.roundLabel,
        roundAbs: roundDir.roundAbs,
        sourceFileName: entry.name,
        relativePath: entry.name.replaceAll("\\", "/"),
        absPath: absPath,
      });
    }
  }
  hits.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.round !== b.round) return a.round - b.round;
    return a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0;
  });
  return hits;
}

export function groupInventoryByRound(
  hits: DailyOddsInventoryHitV0[],
): Map<string, DailyOddsInventoryHitV0[]> {
  const grouped = new Map<string, DailyOddsInventoryHitV0[]>();
  for (const hit of hits) {
    const key = `${hit.year}-${hit.round}`;
    const list = grouped.get(key);
    if (list) list.push(hit);
    else grouped.set(key, [hit]);
  }
  return grouped;
}