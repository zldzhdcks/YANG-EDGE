import {Context,id,stable} from './contracts';
import {Registry,resolvePlayer} from './registry';
export type Player={playerId:string;teamId:string;position?:string};
export type XI={fixtureId:string;teams:{teamId:string;side:'HOME'|'AWAY';starters:Player[];substitutes:Player[]}[]};
export type Verdict={status:string;reasons:string[]};
function exact(r:Registry,c:Context,p:Player){return resolvePlayer(r,{provider:'api-football',playerId:p.playerId,teamId:p.teamId,competitionId:c.competitionProviderId,season:c.season,at:c.scheduledStart,knownAt:c.predictionCutoff}).status==='EXACT';}
export type XIStatus='UNKNOWN'|'INCOMPLETE'|'CONFIRMED_COMPLETE'|'INVALID';
export function validateXI(x:XI,c:Context,r:Registry):Verdict & {status:XIStatus}{
 const invalid=(reason:string):Verdict & {status:XIStatus}=>({status:'INVALID',reasons:[reason]});
 if(!x||typeof x!=='object'||!Array.isArray(x.teams))return invalid('SCHEMA_INVALID');
 if(x.fixtureId!==c.providerFixtureId)return invalid('FIXTURE_MISMATCH');
 if(c.homeTeamId===c.awayTeamId||x.teams.length>2)return invalid('IMPOSSIBLE_STRUCTURE');
 const reasons:string[]=[],all=new Set<string>(),teams=new Set<string>();
 let unresolved=false,home=0,away=0,observed=0;
 for(const t of x.teams){
  if(!t||!Array.isArray(t.starters)||!Array.isArray(t.substitutes))return invalid('SCHEMA_INVALID');
  const expected=t.teamId===c.homeTeamId?'HOME':t.teamId===c.awayTeamId?'AWAY':null;
  if(!expected){reasons.push('WRONG_TEAM');continue;}
  if(t.side!==expected)reasons.push('TEAM_SIDE_MISMATCH');
  if(teams.has(t.teamId))reasons.push('IMPOSSIBLE_STRUCTURE');teams.add(t.teamId);
  if(t.starters.length>11)reasons.push('TOO_MANY_STARTERS');
  if(expected==='HOME')home=t.starters.length;else away=t.starters.length;
  for(const p of [...t.starters,...t.substitutes]){
   if(!p||typeof p!=='object'){reasons.push('SCHEMA_INVALID');continue;}
   observed++;
   if(!id(p.playerId)){reasons.push('MISSING_PLAYER_ID');continue;}
   if(p.teamId!==t.teamId)reasons.push('PLAYER_TEAM_MISMATCH');
   if(all.has(p.playerId))reasons.push('DUPLICATE_PLAYER');all.add(p.playerId);
   const identity=resolvePlayer(r,{provider:'api-football',playerId:p.playerId,teamId:t.teamId,competitionId:c.competitionProviderId,season:c.season,at:c.scheduledStart,knownAt:c.predictionCutoff});
   if(identity.status==='CONFLICT')reasons.push('PROVIDER_IDENTITY_CONFLICT');
   else if(identity.status!=='EXACT')unresolved=true;
  }
 }
 if(reasons.length)return{status:'INVALID',reasons:[...new Set(reasons)]};
 if(!observed)return{status:'UNKNOWN',reasons:['EMPTY_LINEUP','UNKNOWN_AVAILABILITY']};
 if(home!==11||away!==11||unresolved)return{status:'INCOMPLETE',reasons:[...(home!==11||away!==11?['NOT_ELEVEN']:[]),...(unresolved?['REGISTRY_UNRESOLVED']:[])]};
 return{status:'CONFIRMED_COMPLETE',reasons:[]};
}
export type Injury={fixtureId:string;playerId:string;teamId:string;type:string;reason:string};
/** Frozen exact tokens only; no substring/name inference. Coverage remains unverified. */
export function classifyAbsence(row:Injury){if(row.type==='Suspension'||row.reason==='Suspended')return'EXPLICIT_SUSPENSION';if(row.type==='Injury')return'INJURY';if(row.type==='Missing Fixture')return'OTHER_ABSENCE';return'UNKNOWN';}
export function validateInjuries(rows:Injury[],c:Context,r:Registry){const seen=new Set<string>(),entity=new Map<string,string>();const normalized:Injury[]=[],reasons:string[]=[];let duplicates=0,unresolved=rows.length===0,conflict=false;
 for(const x of rows){if(x.fixtureId!==c.providerFixtureId||![c.homeTeamId,c.awayTeamId].includes(x.teamId)||!id(x.playerId)){reasons.push('FIXTURE_TEAM_OR_ID_INVALID');continue;}const key=stable(x);if(seen.has(key)){duplicates++;continue;}seen.add(key);const player=stable([x.fixtureId,x.teamId,x.playerId]);const state=stable([x.type,x.reason]);if(entity.has(player)&&entity.get(player)!==state)conflict=true;entity.set(player,state);if(!exact(r,c,x)||classifyAbsence(x)==='UNKNOWN')unresolved=true;normalized.push({...x});}
 return{status:reasons.length?'INVALID':conflict?'CONFLICT':unresolved?'UNRESOLVED':duplicates?'DUPLICATE_OBSERVATION':'VALID',reasons,duplicateRows:duplicates,normalized,suspensionCompleteness:'UNVERIFIED' as const};
}
