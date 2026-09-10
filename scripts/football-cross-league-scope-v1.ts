/** Scope and temporal metadata only. No predictor, scores, odds, network or archive writes. */
import assert from 'node:assert/strict';
export type ScopeRow = {providerFixtureId:number;leagueId:number;season:number;round:string;kickoffUtc:string};
export const LEAGUE_RULES = [{id:140,rounds:38,targets:380},{id:135,rounds:38,targets:380},{id:78,rounds:34,targets:306}] as const;
export function scope(row:ScopeRow):'IN_SCOPE'|'OUT_OF_SCOPE_STAGE' {
  const rule=LEAGUE_RULES.find(l=>l.id===row.leagueId);
  assert.ok(rule,'UNSUPPORTED_EXTERNAL_LEAGUE');assert.ok(row.season===2023||row.season===2024,'UNSUPPORTED_SEASON');
  if(row.leagueId===78&&row.round==='Relegation Round')return 'OUT_OF_SCOPE_STAGE';
  const regular=/^Regular Season - ([1-9][0-9]*)$/.exec(row.round);
  assert.ok(regular&&Number(regular[1])<=rule.rounds,'UNKNOWN_STAGE_REQUIRES_REVIEW');
  return 'IN_SCOPE';
}
export const ordered=(rows:ScopeRow[])=>[...rows].sort((a,b)=>Date.parse(a.kickoffUtc)-Date.parse(b.kickoffUtc)||a.providerFixtureId-b.providerFixtureId);
export const evaluationTargets=(rows:ScopeRow[],leagueId:number)=>ordered(rows.filter(r=>r.leagueId===leagueId&&r.season===2024&&scope(r)==='IN_SCOPE'));
export function eligibleMetadata(rows:ScopeRow[],target:ScopeRow) {
  assert.equal(scope(target),'IN_SCOPE');
  const cutoff=Date.parse(target.kickoffUtc)-1;
  return ordered(rows.filter(r=>r.leagueId===target.leagueId&&(r.season===2023||r.season===2024)&&r.providerFixtureId!==target.providerFixtureId&&scope(r)==='IN_SCOPE'&&
    Date.parse(r.kickoffUtc)<cutoff&&Date.parse(r.kickoffUtc)+48*3600000<cutoff&&Date.parse(r.kickoffUtc)>=cutoff-365*86400000));
}
