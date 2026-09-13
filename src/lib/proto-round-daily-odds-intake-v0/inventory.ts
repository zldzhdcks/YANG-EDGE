import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  assertSafeProtoRoundCoords,
  isSupportedImageExtension,
  OPERATOR_ROOT_NAME,
  protoRoundIdentity,
} from "../proto-round-screenshot-intake-v1";
import { DailyOddsIntakeV0Error } from "./error";
import {
  DAILY_ODDS_INTAKE_TIMEZONE,
  ROUND_DIRECTORY_KIND_LABELLED_HOICHA,
  ROUND_DIRECTORY_KIND_NUMERIC,
  type AmbiguousDuplicateRoundDirectoryV0,
  type DailyOddsInventoryHitV0,
  type ProtoRoundDirectoryV0,
  type RoundDirectoryKindV0,
} from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_DIR_RE = /^\d{4}$/;
const ROUND_DIR_LABELLED_RE = /^(\d+)회차$/;
const ROUND_DIR_NUMERIC_RE = /^(\d+)$/;

/**
 * Operating round folders are either `<N>회차` (legacy labelled) or `<N>`
 * (numeric, used by 2026/108). Dated folders and unrelated names are ignored.
 *
 * Duplicate resolution: if both forms exist for the same year+round, ingest
 * neither. Ambiguous duplicates are reported as
 * AMBIGUOUS_DUPLICATE_ROUND_FOLDERS and never auto-selected.
 */

export function parseRoundDirectoryName(
  name: string,
): { round: number; kind: RoundDirectoryKindV0 } | null {
  const labelled = ROUND_DIR_LABELLED_RE.exec(name);
  const numeric = labelled ? null : ROUND_DIR_NUMERIC_RE.exec(name);
  const raw = labelled?.[1] ?? numeric?.[1];
  if (raw == null) return null;
  const round = Number(raw);
  try {
    assertSafeProtoRoundCoords(2000, round);
  } catch {
    return null;
  }
  return {
    round,
    kind: labelled
      ? ROUND_DIRECTORY_KIND_LABELLED_HOICHA
      : ROUND_DIRECTORY_KIND_NUMERIC,
  };
}

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

function collectYearRoundDirectories(operatorRootAbs: string): {
  unique: ProtoRoundDirectoryV0[];
  ambiguous: AmbiguousDuplicateRoundDirectoryV0[];
} {
  if (path.basename(operatorRootAbs) !== OPERATOR_ROOT_NAME) {
    throw new DailyOddsIntakeV0Error("INVALID_OPERATOR_ROOT_NAME");
  }
  const unique: ProtoRoundDirectoryV0[] = [];
  const ambiguous: AmbiguousDuplicateRoundDirectoryV0[] = [];
  if (!existsSync(operatorRootAbs)) return { unique, ambiguous };
  for (const yearEntry of readdirSync(operatorRootAbs, { withFileTypes: true })) {
    if (!yearEntry.isDirectory() || !YEAR_DIR_RE.test(yearEntry.name)) continue;
    const year = Number(yearEntry.name);
    const yearAbs = path.join(operatorRootAbs, yearEntry.name);
    const grouped = new Map<number, ProtoRoundDirectoryV0[]>();
    for (const roundEntry of readdirSync(yearAbs, { withFileTypes: true })) {
      if (!roundEntry.isDirectory()) continue;
      const parsed = parseRoundDirectoryName(roundEntry.name);
      if (!parsed) continue;
      const identity = protoRoundIdentity(year, parsed.round);
      const row: ProtoRoundDirectoryV0 = {
        year: identity.year,
        round: identity.round,
        roundLabel: identity.roundLabel,
        roundAbs: path.join(yearAbs, roundEntry.name),
        roundDirectoryName: roundEntry.name,
        roundDirectoryKind: parsed.kind,
      };
      const list = grouped.get(identity.round);
      if (list) list.push(row);
      else grouped.set(identity.round, [row]);
    }
    for (const rows of grouped.values()) {
      const kinds = new Set(rows.map((r) => r.roundDirectoryKind));
      if (rows.length > 1 || kinds.size > 1) {
        const first = rows[0]!;
        ambiguous.push({
          year: first.year,
          round: first.round,
          roundLabel: first.roundLabel,
          directoryNames: [...new Set(rows.map((r) => r.roundDirectoryName))].sort(),
          resolution: "AMBIGUOUS_DUPLICATE_ROUND_FOLDERS",
        });
        continue;
      }
      unique.push(rows[0]!);
    }
  }
  unique.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.round - b.round;
  });
  ambiguous.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.round - b.round;
  });
  return { unique, ambiguous };
}

export function listAmbiguousDuplicateRoundDirectories(
  operatorRootAbs: string,
): AmbiguousDuplicateRoundDirectoryV0[] {
  return collectYearRoundDirectories(operatorRootAbs).ambiguous;
}

export function listProtoRoundDirectories(
  operatorRootAbs: string,
): ProtoRoundDirectoryV0[] {
  return collectYearRoundDirectories(operatorRootAbs).unique;
}

export function summarizeRoundDirectoryImages(roundAbs: string): {
  physical: number;
  canonical: number;
  duplicates: number;
  unsupported: number;
  eligible: number;
} {
  let physical = 0;
  let unsupported = 0;
  const shaCount = new Map<string, number>();
  let entries: Array<{ name: string; isFile: () => boolean }>;
  try {
    entries = readdirSync(roundAbs, { withFileTypes: true });
  } catch {
    return {
      physical: 0,
      canonical: 0,
      duplicates: 0,
      unsupported: 0,
      eligible: 0,
    };
  }
  for (const entry of entries) {
    if (!entry.isFile() || entry.name === ".yang-edge") continue;
    physical += 1;
    if (!isSupportedImageExtension(path.extname(entry.name))) {
      unsupported += 1;
      continue;
    }
    const absPath = path.join(roundAbs, entry.name);
    const sha = createHash("sha256").update(readFileSync(absPath)).digest("hex");
    shaCount.set(sha, (shaCount.get(sha) ?? 0) + 1);
  }
  let canonical = 0;
  let duplicates = 0;
  for (const n of shaCount.values()) {
    canonical += 1;
    duplicates += n - 1;
  }
  return {
    physical,
    canonical,
    duplicates,
    unsupported,
    eligible: canonical,
  };
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
        roundDirectoryName: roundDir.roundDirectoryName,
        roundDirectoryKind: roundDir.roundDirectoryKind,
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