/**
 * Proto candidate parser — OCR/paste text → team+price candidates.
 * Does not invent prices; conservative normalization only.
 */
import { randomUUID } from "node:crypto";
import { resolveKboTeamIdentity } from "../resolve-kbo-team-identity";
import { TEAM_ALIASES } from "../../teams/team-aliases";
import type { ProtoOcrCandidate, ProtoOcrRawResult } from "./types";
import { PROTO_OCR_PARSER_VERSION } from "./types";

export { PROTO_OCR_PARSER_VERSION };

function kboAliasNames(): string[] {
  const names: string[] = [];
  for (const e of TEAM_ALIASES) {
    if (e.league !== "KBO" || e.sport !== "baseball") continue;
    names.push(e.displayName, ...e.originalNames);
  }
  // longer first for greedy match
  return [...new Set(names)].sort((a, b) => b.length - a.length);
}

const KBO_NAMES = kboAliasNames();

const DECIMAL_RE = /\b(\d{1,2}[.,]\d{1,3})\b/g;
const AMERICAN_RE = /(?:^|[^\d])(-\d{3,4})\b/;

export function normalizePriceCandidate(
  raw: string,
  opts?: { allowCommaAsDecimal?: boolean },
): { value: number | null; warnings: string[] } {
  const warnings: string[] = [];
  const t = raw.trim();
  if (!t) return { value: null, warnings: ["EMPTY_PRICE"] };
  if (/\?/.test(t)) {
    warnings.push("PRICE_NOT_RECOGNIZED");
    return { value: null, warnings };
  }
  if (/^[Il1]\.\d{2}$/i.test(t) && /^[Il]/i.test(t)) {
    warnings.push("AMBIGUOUS_OCR_DIGIT");
    return { value: null, warnings };
  }
  if (AMERICAN_RE.test(` ${t}`)) {
    warnings.push("AMERICAN_ODDS_REJECTED");
    return { value: null, warnings };
  }
  if (/^\d{3,}$/.test(t) && !t.includes(".") && !t.includes(",")) {
    warnings.push("INTEGER_PRICE_NOT_AUTO_CONVERTED");
    return { value: null, warnings };
  }
  let normalized = t;
  if (t.includes(",") && !t.includes(".")) {
    if (opts?.allowCommaAsDecimal) {
      normalized = t.replace(",", ".");
      warnings.push("COMMA_DECIMAL_CANDIDATE");
    } else {
      warnings.push("COMMA_DECIMAL_NEEDS_LOCALE_EVIDENCE");
      return { value: null, warnings };
    }
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) {
    warnings.push("PRICE_NOT_RECOGNIZED");
    return { value: null, warnings };
  }
  if (n <= 1) {
    warnings.push("INVALID_PRICE");
    return { value: null, warnings };
  }
  return { value: n, warnings };
}

function findTeamsInLine(line: string): string[] {
  const found: string[] = [];
  const used: Array<{ start: number; end: number }> = [];
  const upper = line;
  for (const name of KBO_NAMES) {
    let idx = 0;
    while (idx < upper.length) {
      const at = upper.indexOf(name, idx);
      if (at < 0) break;
      const end = at + name.length;
      const overlap = used.some((u) => at < u.end && end > u.start);
      if (!overlap) {
        found.push(name);
        used.push({ start: at, end });
      }
      idx = at + 1;
    }
  }
  // preserve left-to-right order
  return found
    .map((name) => {
      const at = line.indexOf(name);
      return { name, at };
    })
    .sort((a, b) => a.at - b.at)
    .map((x) => x.name);
}

function findPricesInLine(line: string): string[] {
  const out: string[] = [];
  DECIMAL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DECIMAL_RE.exec(line)) != null) {
    out.push(m[1]!);
  }
  return out;
}

function canonicalLabel(text: string): string | null {
  const r = resolveKboTeamIdentity(text);
  return r.mappingStatus === "MATCHED" ? r.canonicalNameKo : null;
}

/**
 * Parse a single text blob (one image or paste) into candidates.
 * Heuristic: lines/snippets with ≥2 team mentions + ≥2 decimal prices.
 */
export function parseProtoCandidatesFromText(input: {
  rawText: string;
  sourceImageId: string;
  blocks?: { blockId: string; text: string }[];
  allowCommaAsDecimal?: boolean;
}): ProtoOcrCandidate[] {
  const warningsGlobal: string[] = [];
  const text = input.rawText.replace(/\u00a0/g, " ");
  if (!text.trim()) return [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Also try whole-text windows if line-based yields nothing
  const units = lines.length > 0 ? lines : [text];
  const candidates: ProtoOcrCandidate[] = [];

  for (const line of units) {
    const teams = findTeamsInLine(line);
    const prices = findPricesInLine(line);
    const parserWarnings: string[] = [];

    if (AMERICAN_RE.test(line)) parserWarnings.push("AMERICAN_ODDS_REJECTED");

    if (teams.length < 2 && prices.length < 2) {
      continue;
    }

    const firstTeam = teams[0] ?? null;
    const secondTeam = teams[1] ?? null;
    const price0 = prices[0] ?? null;
    const price1 = prices[1] ?? null;

    const n0 = price0
      ? normalizePriceCandidate(price0, {
          allowCommaAsDecimal: input.allowCommaAsDecimal,
        })
      : { value: null, warnings: ["MISSING_PRICE"] };
    const n1 = price1
      ? normalizePriceCandidate(price1, {
          allowCommaAsDecimal: input.allowCommaAsDecimal,
        })
      : { value: null, warnings: ["MISSING_PRICE"] };
    parserWarnings.push(...n0.warnings, ...n1.warnings);

    // Screenshot order: first team ↔ first price (candidate only)
    const screenshotFirst = firstTeam;
    const screenshotSecond = secondTeam;
    // Default assume first=away display common in KR proto lists — NOT final SoT
    let awayTeamText = screenshotFirst;
    let homeTeamText = screenshotSecond;
    let awayPriceText = price0;
    let homePriceText = price1;
    let awayPriceCandidate = n0.value;
    let homePriceCandidate = n1.value;

    let parserStatus: ProtoOcrCandidate["parserStatus"] = "PARSED";
    if (!firstTeam || !secondTeam) {
      parserStatus = prices.length >= 2 ? "PARTIAL" : "NOT_RECOGNIZED";
      parserWarnings.push("TEAM_NOT_RECOGNIZED");
    } else if (n0.value == null || n1.value == null) {
      parserStatus = "PARTIAL";
      parserWarnings.push("PRICE_NOT_RECOGNIZED");
    } else if (canonicalLabel(firstTeam) == null || canonicalLabel(secondTeam) == null) {
      parserStatus = "PARTIAL";
      parserWarnings.push("UNKNOWN_TEAM_ALIAS");
    }

    if (prices.length > 2) {
      parserWarnings.push("MULTIPLE_MARKET_NUMBERS");
      parserStatus = parserStatus === "PARSED" ? "AMBIGUOUS" : parserStatus;
    }

    const blockIds = (input.blocks ?? [])
      .filter((b) => line.includes(b.text) || b.text.includes(line.slice(0, 12)))
      .map((b) => b.blockId);

    candidates.push({
      candidateId: `cand-${randomUUID()}`,
      sourceImageId: input.sourceImageId,
      sourceBlockIds: blockIds,
      eventNumber: null,
      scheduledTimeText: null,
      awayTeamText,
      homeTeamText,
      screenshotFirstTeam: screenshotFirst,
      screenshotSecondTeam: screenshotSecond,
      awayPriceText,
      homePriceText,
      awayPriceCandidate,
      homePriceCandidate,
      marketLabel: /머니|승패|프로토|ML|moneyline/i.test(line)
        ? "MONEYLINE_2WAY"
        : null,
      parserStatus,
      parserWarnings: [...new Set([...parserWarnings, ...warningsGlobal])],
      rawSnippet: line.slice(0, 200),
    });
  }

  // Pairwise fallback: all teams + all prices in document
  if (candidates.length === 0) {
    const teams = findTeamsInLine(text);
    const prices = findPricesInLine(text);
    if (teams.length >= 2 && prices.length >= 2) {
      // pair consecutive teams with consecutive prices
      for (let i = 0; i + 1 < teams.length && i * 2 + 1 < prices.length; i += 2) {
        const t0 = teams[i]!;
        const t1 = teams[i + 1]!;
        const p0 = prices[i]!;
        const p1 = prices[i + 1]!;
        const n0 = normalizePriceCandidate(p0, {
          allowCommaAsDecimal: input.allowCommaAsDecimal,
        });
        const n1 = normalizePriceCandidate(p1, {
          allowCommaAsDecimal: input.allowCommaAsDecimal,
        });
        candidates.push({
          candidateId: `cand-${randomUUID()}`,
          sourceImageId: input.sourceImageId,
          sourceBlockIds: [],
          eventNumber: null,
          scheduledTimeText: null,
          awayTeamText: t0,
          homeTeamText: t1,
          screenshotFirstTeam: t0,
          screenshotSecondTeam: t1,
          awayPriceText: p0,
          homePriceText: p1,
          awayPriceCandidate: n0.value,
          homePriceCandidate: n1.value,
          marketLabel: null,
          parserStatus:
            n0.value != null && n1.value != null ? "PARSED" : "PARTIAL",
          parserWarnings: [...n0.warnings, ...n1.warnings, "PAIRWISE_FALLBACK"],
          rawSnippet: `${t0} ${p0} ${t1} ${p1}`,
        });
      }
    } else if (teams.length === 0 && prices.length === 0) {
      // nothing
    } else {
      candidates.push({
        candidateId: `cand-${randomUUID()}`,
        sourceImageId: input.sourceImageId,
        sourceBlockIds: [],
        eventNumber: null,
        scheduledTimeText: null,
        awayTeamText: teams[0] ?? null,
        homeTeamText: teams[1] ?? null,
        screenshotFirstTeam: teams[0] ?? null,
        screenshotSecondTeam: teams[1] ?? null,
        awayPriceText: prices[0] ?? null,
        homePriceText: prices[1] ?? null,
        awayPriceCandidate: null,
        homePriceCandidate: null,
        marketLabel: null,
        parserStatus: "NOT_RECOGNIZED",
        parserWarnings: ["NO_MATCHUP_DETECTED"],
        rawSnippet: text.slice(0, 200),
      });
    }
  }

  return candidates;
}

export function parseProtoCandidatesFromOcr(
  raw: ProtoOcrRawResult,
  opts?: { allowCommaAsDecimal?: boolean },
): ProtoOcrCandidate[] {
  const out: ProtoOcrCandidate[] = [];
  for (const img of raw.images) {
    out.push(
      ...parseProtoCandidatesFromText({
        rawText: img.rawText,
        sourceImageId: img.imageId,
        blocks: img.blocks,
        allowCommaAsDecimal: opts?.allowCommaAsDecimal,
      }),
    );
  }
  return out;
}
