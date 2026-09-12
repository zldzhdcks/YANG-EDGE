import type {Target} from '../football-v31-r1-prospective-v1/frozen/scripts/football-v3-feature-research-v1/contracts-v1';

/** Exact 6-field identity. Team names are never used. */
export function exactIdentity(a:Target,b:Target){
 return a.fixtureId===b.fixtureId&&a.leagueId===b.leagueId&&a.season===b.season&&a.kickoffUtc===b.kickoffUtc&&a.homeTeamId===b.homeTeamId&&a.awayTeamId===b.awayTeamId;
}

export function projectIdentity(body:unknown,expected:Target):{target:Target;providerStatus:string}|null{
 const b=body as {errors?:object;response?:{fixture:{id:number;date:string;status:{short:string}};league:{id:number;season:number};teams:{home:{id:number};away:{id:number}}}[]};
 if(!b||Object.keys(b.errors??{}).length!==0||!Array.isArray(b.response)||b.response.length!==1)return null;
 const r=b.response[0];
 if(!r?.fixture||!r.league||!r.teams?.home||!r.teams?.away)return null;
 const target:Target={fixtureId:r.fixture.id,leagueId:r.league.id,season:r.league.season,kickoffUtc:new Date(r.fixture.date).toISOString(),homeTeamId:r.teams.home.id,awayTeamId:r.teams.away.id};
 if(!exactIdentity(target,{...expected,kickoffUtc:target.kickoffUtc}))return null;
 if(target.kickoffUtc!==expected.kickoffUtc)return null;
 return {target,providerStatus:r.fixture.status.short};
}
