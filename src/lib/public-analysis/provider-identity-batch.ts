import assert from 'node:assert/strict';
export type ScheduleIdentity={fixtureId:number;leagueId:number;leagueName:string;season:number;kickoff:string;homeId:number;homeName:string;awayId:number;awayName:string};
export type VerifiedAlias={sourceName:string;canonicalName:string;teamId:number;competitionId:number;evidence:string;verifiedAt:string;status:'VERIFIED'|'CANDIDATE'};
/** Allowlist projection: never read fixture.status, goals, score, winner or events. */
export function projectScheduleIdentity(r:any):ScheduleIdentity{
 const f={fixtureId:r.fixture.id,leagueId:r.league.id,leagueName:r.league.name,season:r.league.season,kickoff:new Date(r.fixture.date).toISOString(),homeId:r.teams.home.id,homeName:r.teams.home.name,awayId:r.teams.away.id,awayName:r.teams.away.name};
 for(const id of [f.fixtureId,f.leagueId,f.season,f.homeId,f.awayId])assert(Number.isSafeInteger(id)&&id>0,'INVALID_ID');
 assert(f.homeId!==f.awayId,'SAME_TEAM');return f;
}
export function resolveTeamAlias(name:string,competitionId:number,registry:VerifiedAlias[]){
 const teamClass=(s:string)=>s.match(/\b(U\d{2}|B|II|Women|Ladies|Reserves)\b/i)?.[0].toUpperCase()??'FIRST_TEAM';
 const matches=registry.filter(a=>a.sourceName===name&&a.competitionId===competitionId&&a.status==='VERIFIED'&&a.evidence&&Number.isFinite(Date.parse(a.verifiedAt))&&teamClass(a.sourceName)===teamClass(a.canonicalName));
 const ids=[...new Set(matches.map(a=>a.teamId))];
 return ids.length===1?{status:'ALIAS_VERIFIED',id:ids[0],evidence:matches.map(a=>a.evidence)}:ids.length>1?{status:'AMBIGUOUS',id:null,evidence:[]}:{status:'NOT_FOUND',id:null,evidence:[]};
}
export function resolveIdentity(target:{competitionId:number|null;home:string;away:string;kickoff:string},aliases:VerifiedAlias[],fixtures:ScheduleIdentity[]){
 if(!target.competitionId)return{status:'SOURCE_EVIDENCE_INCOMPLETE',reason:'COMPETITION_ALIAS_UNREGISTERED',fixture:null};
 const home=resolveTeamAlias(target.home,target.competitionId,aliases),away=resolveTeamAlias(target.away,target.competitionId,aliases);
 if(home.status==='AMBIGUOUS'||away.status==='AMBIGUOUS')return{status:'AMBIGUOUS',reason:'TEAM_NAME_COLLISION',fixture:null};
 if(home.id===null||away.id===null)return{status:'TEAM_ID_UNRESOLVED',reason:'VERIFIED_COMPETITION_SCOPED_ALIAS_REQUIRED',fixture:null};
 if(home.id===away.id)return{status:'CONFLICT',reason:'HOME_AWAY_ID_COLLISION',fixture:null};
 const same=fixtures.filter(f=>f.leagueId===target.competitionId&&f.homeId===home.id&&f.awayId===away.id&&Date.parse(f.kickoff)===Date.parse(target.kickoff));
 if(same.length>1)return{status:'AMBIGUOUS',reason:'MULTIPLE_FIXTURE_CANDIDATES',fixture:null};
 if(same.length===1)return{status:'EXACT',reason:null,fixture:same[0]};
 const conflict=fixtures.some(f=>(f.homeId===home.id&&f.awayId===away.id)||(f.homeId===away.id&&f.awayId===home.id));
 return{status:conflict?'CONFLICT':'FIXTURE_NOT_FOUND',reason:conflict?'COMPETITION_KICKOFF_OR_DIRECTION_CONFLICT':'NO_MATCHING_SCHEDULE_METADATA',fixture:null};
}
