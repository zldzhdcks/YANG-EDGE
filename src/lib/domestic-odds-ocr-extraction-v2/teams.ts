import { TEAM_ALIASES } from "../teams/team-aliases";
import { normalizeTeamName } from "../teams/normalize-team-name";
import type { OcrPassEvidenceV2, TeamFieldV2, TeamTextStatusV2 } from "./types";

const SPACED_MATCHUP = /([^\s:]+)\s+:\s+([^\s]+)/;
const GLUED_MATCHUP = /([^\s:]+):([^\s:]+)/;

function isProperPrefixOfDisplayName(ocr: string, displayName: string): boolean {
  const a = normalizeTeamName(ocr);
  const b = normalizeTeamName(displayName);
  return a.length > 0 && a.length < b.length && b.startsWith(a);
}

export function classifyTeamLabel(raw: string): {
  status: TeamTextStatusV2;
  aliasCandidate: string | null;
} {
  const n = normalizeTeamName(raw);
  if (!n) return { status: "TEAM_TEXT_UNREADABLE", aliasCandidate: null };
  const exactDisplay = TEAM_ALIASES.find(
    (a) => normalizeTeamName(a.displayName) === n,
  );
  if (exactDisplay) {
    return { status: "TEAM_TEXT_VERIFIED", aliasCandidate: exactDisplay.displayName };
  }
  const originalHit = TEAM_ALIASES.find((a) =>
    a.originalNames.some((name) => normalizeTeamName(name) === n),
  );
  if (originalHit) {
    if (isProperPrefixOfDisplayName(raw, originalHit.displayName)) {
      return { status: "TEAM_TEXT_PARTIAL", aliasCandidate: originalHit.displayName };
    }
    return { status: "TEAM_TEXT_VERIFIED", aliasCandidate: originalHit.displayName };
  }
  if (/^[\uac00-\ud7a3A-Za-z0-9]{2,12}$/.test(raw.trim())) {
    return { status: "TEAM_TEXT_PARTIAL", aliasCandidate: null };
  }
  return { status: "TEAM_TEXT_UNREADABLE", aliasCandidate: null };
}

export function parseMatchupFromCell(text: string): {
  home: TeamFieldV2;
  away: TeamFieldV2;
} | null {
  const spaced = SPACED_MATCHUP.exec(text);
  const glued = spaced ? null : GLUED_MATCHUP.exec(text);
  const hit = spaced ?? glued;
  if (!hit?.[1] || !hit[2]) return null;
  const homeC = classifyTeamLabel(hit[1]);
  const awayC = classifyTeamLabel(hit[2]);
  return {
    home: {
      rawText: hit[1],
      status: homeC.status,
      aliasCandidate: homeC.aliasCandidate,
      passes: [],
    },
    away: {
      rawText: hit[2],
      status: awayC.status,
      aliasCandidate: awayC.aliasCandidate,
      passes: [],
    },
  };
}

export function recoverTeamPair(passes: OcrPassEvidenceV2[]): {
  home: TeamFieldV2;
  away: TeamFieldV2;
} {
  const parsed = passes
    .map((p) => ({ pass: p, pair: parseMatchupFromCell(p.rawText) }))
    .filter((x): x is { pass: OcrPassEvidenceV2; pair: NonNullable<ReturnType<typeof parseMatchupFromCell>> } => x.pair != null);
  if (parsed.length === 0) {
    const joined = passes.map((p) => p.rawText).join(" ");
    const tokens = joined
      .split(/\s+/)
      .filter((t) => t !== ":" && t.length >= 2);
    const unread: TeamFieldV2 = {
      rawText: tokens[0] ?? null,
      status: tokens[0] ? classifyTeamLabel(tokens[0]).status : "TEAM_TEXT_UNREADABLE",
      aliasCandidate: tokens[0] ? classifyTeamLabel(tokens[0]).aliasCandidate : null,
      passes,
    };
    const awayTok = tokens[1] ?? null;
    return {
      home: unread,
      away: {
        rawText: awayTok,
        status: awayTok ? classifyTeamLabel(awayTok).status : "TEAM_TEXT_UNREADABLE",
        aliasCandidate: awayTok ? classifyTeamLabel(awayTok).aliasCandidate : null,
        passes,
      },
    };
  }
  const homeTexts = parsed.map((p) => p.pair.home.rawText);
  const awayTexts = parsed.map((p) => p.pair.away.rawText);
  const homeAgree = homeTexts[0] && homeTexts.every((t) => t === homeTexts[0]);
  const awayAgree = awayTexts[0] && awayTexts.every((t) => t === awayTexts[0]);
  const first = parsed[0]!.pair;
  return {
    home: {
      ...first.home,
      status: homeAgree ? first.home.status : "TEAM_TEXT_PARTIAL",
      passes,
    },
    away: {
      ...first.away,
      status: awayAgree ? first.away.status : "TEAM_TEXT_PARTIAL",
      passes,
    },
  };
}
