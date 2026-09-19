import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { ResearchTargetGame } from "../../research/daily-scope-lock";

const instant = (s: string) => { assert.ok(typeof s === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(s)); const n = Date.parse(s); assert.ok(Number.isFinite(n)); return n; };
export type PregameIdentity = { provider: "API_FOOTBALL"; fixtureId: number; leagueId: number; season: number; kickoffUtc: string; homeTeamId: number; homeTeamName: string; awayTeamId: number; awayTeamName: string; status: "NS"; observedAt: string };
export type ExactBinding = { targetId: string; scopeSha256: string; homeRaw: string; awayRaw: string; competitionRaw: string; providerFixtureId: number; homeProviderId: number; awayProviderId: number; leagueId: number; season: number; scheduledStart: string; reviewStatus: "VERIFIED"; reviewedAt: string; evidenceSha256: string };

/** Strict sibling of the legacy matcher. No legacy partial-name/cache fallback. */
export function resolveExactPregameIdentity(target: ResearchTargetGame, scopeHash: string, binding: ExactBinding, sourceBytes: Buffer, now: string): PregameIdentity {
  assert.equal(binding.reviewStatus, "VERIFIED");
  assert.equal(binding.targetId, target.targetId); assert.equal(binding.scopeSha256, scopeHash);
  assert.match(scopeHash, /^[a-f0-9]{64}$/);
  assert.equal(target.sport, "SOCCER");
  assert.equal(binding.homeRaw, target.homeTeamRaw); assert.equal(binding.awayRaw, target.awayTeamRaw); assert.notEqual(binding.homeRaw, binding.awayRaw);
  assert.equal(binding.competitionRaw, target.competitionNameRaw);
  assert.equal(createHash("sha256").update(sourceBytes).digest("hex"), binding.evidenceSha256);
  const s = JSON.parse(sourceBytes.toString("utf8")) as PregameIdentity;
  const fields = ["provider", "fixtureId", "leagueId", "season", "kickoffUtc", "homeTeamId", "homeTeamName", "awayTeamId", "awayTeamName", "status", "observedAt"];
  assert.deepEqual(Object.keys(s).sort(), fields.sort(), "PREGAME_IDENTITY_FIELDS_ONLY");
  assert.equal(s.provider, "API_FOOTBALL"); assert.equal(s.status, "NS");
  for (const n of [s.fixtureId,s.homeTeamId,s.awayTeamId,s.leagueId,s.season]) assert.ok(Number.isSafeInteger(n) && n > 0);
  assert.ok([39,140,135,78].includes(s.leagueId));
  assert.notEqual(s.homeTeamId,s.awayTeamId);
  assert.ok(typeof s.homeTeamName === "string" && s.homeTeamName.trim()); assert.ok(typeof s.awayTeamName === "string" && s.awayTeamName.trim());
  assert.equal(s.fixtureId,binding.providerFixtureId); assert.equal(s.homeTeamId,binding.homeProviderId); assert.equal(s.awayTeamId,binding.awayProviderId);
  assert.equal(s.leagueId,binding.leagueId); assert.equal(s.season,binding.season);
  if (target.providerFixtureId != null) assert.equal(target.providerFixtureId,String(s.fixtureId));
  const start=instant(target.scheduledStartTimeKst!);
  assert.equal(instant(s.kickoffUtc),start); assert.equal(instant(binding.scheduledStart),start);
  assert.ok(instant(s.observedAt)<=instant(binding.reviewedAt) && instant(binding.reviewedAt)<=instant(now));
  assert.ok(instant(now)<start,"PREGAME_WINDOW_MISSED");
  return s;
}

export function assertOneToOneBindings(bindings: ExactBinding[]) {
  assert.equal(new Set(bindings.map(b=>b.targetId)).size,bindings.length,"DUPLICATE_OPERATOR_TARGET");
  assert.equal(new Set(bindings.map(b=>b.providerFixtureId)).size,bindings.length,"DUPLICATE_PROVIDER_FIXTURE");
}

/** Provider-ID-first discovery from already verified identity claims; never name similarity. */
export function selectExactFixture(claim: {fixtureId?:number;homeTeamId?:number;awayTeamId?:number;leagueId:number;kickoff:string;verified:boolean}, fixtures:PregameIdentity[], now:string) {
  if(!claim.verified || claim.homeTeamId===undefined || claim.awayTeamId===undefined)return {status:'NO_PROVIDER_EVIDENCE' as const};
  const candidates=fixtures.filter(f=>claim.fixtureId!==undefined?f.fixtureId===claim.fixtureId:f.homeTeamId===claim.homeTeamId&&f.awayTeamId===claim.awayTeamId&&f.leagueId===claim.leagueId&&instant(f.kickoffUtc)===instant(claim.kickoff));
  if(candidates.length>1)return {status:'AMBIGUOUS' as const};
  if(!candidates.length){
    const reversed=fixtures.some(f=>f.homeTeamId===claim.awayTeamId&&f.awayTeamId===claim.homeTeamId&&f.leagueId===claim.leagueId&&instant(f.kickoffUtc)===instant(claim.kickoff));
    return {status:reversed?'CONFLICT' as const:'NO_PROVIDER_EVIDENCE' as const};
  }
  const f=candidates[0];
  if(f.provider!=='API_FOOTBALL'||f.status!=='NS'||f.homeTeamId!==claim.homeTeamId||f.awayTeamId!==claim.awayTeamId||f.leagueId!==claim.leagueId||instant(f.kickoffUtc)!==instant(claim.kickoff)||instant(f.observedAt)>instant(now)||instant(now)>=instant(f.kickoffUtc))return {status:'CONFLICT' as const};
  return {status:'EXACT_MATCH' as const,fixture:f};
}
