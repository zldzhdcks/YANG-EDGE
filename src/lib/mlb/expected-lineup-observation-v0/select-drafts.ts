/**
 * UI/API boundary: omit blank games, reject one-sided drafts.
 * Does not promote EXPECTED to CONFIRMED.
 */
import { parseExpectedLineupPaste } from "./parse-paste";
import type { MlbExpectedLineupDraftGame } from "./types";

export function expectedLineupPasteIsBlank(
  text: string | null | undefined,
): boolean {
  return !(text ?? "").trim();
}

export type SelectExpectedLineupDraftsInput = {
  gamePk?: number;
  awayPaste?: string;
  homePaste?: string;
};

export function selectExpectedLineupDraftsFromPastes(
  rows: SelectExpectedLineupDraftsInput[],
): {
  drafts: MlbExpectedLineupDraftGame[];
  errors: string[];
} {
  const drafts: MlbExpectedLineupDraftGame[] = [];
  const errors: string[] = [];

  for (const raw of rows) {
    const gamePk = Number(raw.gamePk);
    if (!Number.isFinite(gamePk) || gamePk <= 0) {
      errors.push("INVALID_GAMEPK");
      continue;
    }
    const awayBlank = expectedLineupPasteIsBlank(raw.awayPaste);
    const homeBlank = expectedLineupPasteIsBlank(raw.homePaste);
    if (awayBlank && homeBlank) {
      continue;
    }
    if (awayBlank) {
      errors.push(`INCOMPLETE_GAME_DRAFT:${gamePk}:AWAY_MISSING`);
      continue;
    }
    if (homeBlank) {
      errors.push(`INCOMPLETE_GAME_DRAFT:${gamePk}:HOME_MISSING`);
      continue;
    }

    const away = parseExpectedLineupPaste(raw.awayPaste ?? "");
    const home = parseExpectedLineupPaste(raw.homePaste ?? "");
    errors.push(
      ...away.errors.map((e) => `AWAY:${gamePk}:${e}`),
      ...home.errors.map((e) => `HOME:${gamePk}:${e}`),
    );
    drafts.push({
      gamePk,
      awayLineup: away.batters,
      homeLineup: home.batters,
    });
  }

  if (errors.length === 0 && drafts.length === 0) {
    errors.push("NO_OBSERVATIONS_TO_SAVE");
  }

  return { drafts, errors };
}
