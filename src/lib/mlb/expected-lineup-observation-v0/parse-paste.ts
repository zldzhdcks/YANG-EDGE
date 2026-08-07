/**
 * Parse operator paste lines into expected batters.
 * Formats:
 *   1. Name POS Bats
 *   1 Name POS
 *   1. Name (Bats) POS
 */
import type { MlbExpectedLineupDraftBatter } from "./types";

const ORDER_NAME =
  /^\s*(\d{1,2})\s*[.)]?\s+(.+?)\s*$/;

export function parseExpectedLineupPaste(
  text: string,
): { batters: MlbExpectedLineupDraftBatter[]; errors: string[] } {
  const errors: string[] = [];
  const batters: MlbExpectedLineupDraftBatter[] = [];
  const seen = new Set<number>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = ORDER_NAME.exec(line);
    if (!m) {
      errors.push(`UNPARSEABLE_LINE:${line}`);
      continue;
    }
    const battingOrder = Number(m[1]);
    if (!Number.isInteger(battingOrder) || battingOrder < 1 || battingOrder > 9) {
      errors.push(`INVALID_ORDER:${line}`);
      continue;
    }
    if (seen.has(battingOrder)) {
      errors.push(`DUPLICATE_ORDER:${battingOrder}`);
      continue;
    }
    seen.add(battingOrder);

    let rest = (m[2] ?? "").trim();
    let bats: string | null = null;
    const batsParen = rest.match(/\(([LRSB])\)\s*$/i);
    if (batsParen) {
      bats = batsParen[1]!.toUpperCase();
      rest = rest.slice(0, batsParen.index).trim();
    }
    const batsTrail = rest.match(/\s+([LRSB])\s*$/i);
    if (!bats && batsTrail) {
      bats = batsTrail[1]!.toUpperCase();
      rest = rest.slice(0, batsTrail.index).trim();
    }

    let position: string | null = null;
    const posTrail = rest.match(
      /\s+(DH|C|1B|2B|3B|SS|LF|CF|RF|OF|P|SP|RP)\s*$/i,
    );
    if (posTrail) {
      position = posTrail[1]!.toUpperCase();
      rest = rest.slice(0, posTrail.index).trim();
    }

    const displayName = rest.replace(/\s+/g, " ").trim();
    if (!displayName) {
      errors.push(`MISSING_NAME:${line}`);
      continue;
    }

    batters.push({
      battingOrder,
      displayName,
      position,
      bats,
    });
  }

  batters.sort((a, b) => a.battingOrder - b.battingOrder);
  return { batters, errors };
}

export function validateNineSlotLineup(
  batters: MlbExpectedLineupDraftBatter[],
  label: string,
): string[] {
  const errors: string[] = [];
  if (batters.length !== 9) {
    errors.push(`${label}:EXPECTED_9_GOT_${batters.length}`);
  }
  const orders = batters.map((b) => b.battingOrder).sort((a, b) => a - b);
  for (let i = 1; i <= 9; i++) {
    if (!orders.includes(i)) errors.push(`${label}:MISSING_ORDER_${i}`);
  }
  for (const b of batters) {
    if (!b.displayName.trim()) {
      errors.push(`${label}:EMPTY_NAME_ORDER_${b.battingOrder}`);
    }
  }
  return errors;
}
