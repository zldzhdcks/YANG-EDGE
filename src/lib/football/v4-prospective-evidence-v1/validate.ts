import {Context,id,stable} from './contracts';
import {Registry,resolvePlayer} from './registry';
export type Player={playerId:string;teamId:string;position?:string};
export type XI={fixtureId:string;teams:{teamId:string;side:'HOME'|'AWAY';starters:Player[];substitutes:Player[]}[]};
export type Verdict={status:string;reasons:string[]};
function exact(r:Registry,c:Context,p:Player){return resolvePlayer(r,{provider:'api-football',playerId:p.playerId,teamId:p.teamId,competitionId:c.competitionProviderId,season:c.season,at:c.scheduledStart,knownAt:c.predictionCutoff}).status==='EXACT';}
export function validateXI(x:XI,c:Context,r:Registry):Verdict{
 const reasons:string[]=[];if(x.fixtureId!==c.providerFixtureId)return{status:'INVALID',reasons:['FIXTURE_MISMATCH']};if(!x.teams.length)return{status:'INCOMPLETE',reasons:['EMPTY_PROVIDER_RESPONSE','UNKNOWN_AVAILABILITY']};if(x.teams.length!==2)return{status:'INVALID',reasons:['TEAM_COUNT']};
 const all=new Set<string>();let unresolved=false,incomplete=false;
 for(const [i,teamId] of [c.homeTeamId,c.awayTeamId].entries()){const teams=x.teams.filter(t=>t.teamId===teamId&&t.side===(i===0?'HOME':'AWAY'));if(teams.length!==1){reasons.push('TEAM_SIDE_MISMATCH');continue;}const t=teams[0];if(t.starters.length>11)reasons.push('TOO_MANY_STARTERS');if(t.starters.length<11)incomplete=true;
 for(const p of [...t.starters,...t.substitutes]){if(!id(p.playerId))reasons.push('MISSING_PLAYER_ID');if(p.teamId!==teamId)reasons.push('PLAYER_TEAM_MISMATCH');if(all.has(p.playerId))reasons.push('DUPLICATE_OR_STARTER_SUB_CONFLICT');all.add(p.playerId);if(!exact(r,c,p))unresolved=true;}}
 return{status:reasons.length?'INVALID':incomplete||unresolved?'INCOMPLETE':'VALID',reasons:[...reasons,...(incomplete?['NOT_ELEVEN']:[]),...(unresolved?['REGISTRY_UNRESOLVED']:[])]};
}
export type Injury={fixtureId:string;playerId:string;teamId:string;type:string;reason:string};
/** Frozen exact tokens only; no substring/name inference. Coverage remains unverified. */
export function classifyAbsence(row:Injury){if(row.type==='Suspension'||row.reason==='Suspended')return'EXPLICIT_SUSPENSION';if(row.type==='Injury')return'INJURY';if(row.type==='Missing Fixture')return'OTHER_ABSENCE';return'UNKNOWN';}
export function validateInjuries(rows:Injury[],c:Context,r:Registry){const seen=new Set<string>(),entity=new Map<string,string>();const normalized:Injury[]=[],reasons:string[]=[];let duplicates=0,unresolved=rows.length===0,conflict=false;
 for(const x of rows){if(x.fixtureId!==c.providerFixtureId||![c.homeTeamId,c.awayTeamId].includes(x.teamId)||!id(x.playerId)){reasons.push('FIXTURE_TEAM_OR_ID_INVALID');continue;}const key=stable(x);if(seen.has(key)){duplicates++;continue;}seen.add(key);const player=stable([x.fixtureId,x.teamId,x.playerId]);const state=stable([x.type,x.reason]);if(entity.has(player)&&entity.get(player)!==state)conflict=true;entity.set(player,state);if(!exact(r,c,x)||classifyAbsence(x)==='UNKNOWN')unresolved=true;normalized.push({...x});}
 return{status:reasons.length?'INVALID':conflict?'CONFLICT':unresolved?'UNRESOLVED':duplicates?'DUPLICATE_OBSERVATION':'VALID',reasons,duplicateRows:duplicates,normalized,suspensionCompleteness:'UNVERIFIED' as const};
}
