/** Editorial evidence categories, not a player-impact score or engine input. */
import assert from 'node:assert/strict';
export const ROLE_AXES={
 'ST_CF':['SCORING','CREATION','LINK_PLAY','RECENT_IMPACT'],
 'WINGER_AM':['SCORING','CREATION','BALL_PROGRESSION','RECENT_IMPACT'],
 'CM_DM':['CONTROL','BUILD_UP','CREATION','DEFENSIVE_IMPACT','STRUCTURAL_IMPACT'],
 'FB_WB':['BUILD_UP','CREATION','DEFENSIVE_IMPACT','WIDTH_STRUCTURAL_ROLE'],
 'CB':['DEFENSIVE_IMPACT','BUILD_UP','AERIAL_DUEL','STRUCTURAL_STABILITY'],
 'GK':['SHOT_STOPPING','AVAILABILITY','STARTING_STABILITY','DISTRIBUTION','REPLACEMENT_IMPORTANCE'],
} as const;
export type PlayerEvidence={id:number;name:string;position:string;role: keyof typeof ROLE_AXES|'UNRESOLVED';minutes:number;starts:number;goals:number|null;assists:number|null;axes:Record<string,number>;sourceHashes:string[];recent?:{fixtureId:number;kickoffUtc:string;fetchedAt:string;minutes:number;axes:Record<string,number>;officialMvp?:{verified:boolean;sourceHash:string}}[]};
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>0;
export function selectRoleContext(players:PlayerEvidence[],cutoff:string,targetId:number,latestFixtureIds:number[]=[]){
 assert(Number.isFinite(Date.parse(cutoff)),'INVALID_CUTOFF');
 assert(new Set(players.map(p=>p.id)).size===players.length,'DUPLICATE_PLAYER');
 const active=players.filter(p=>p.minutes>0&&p.starts>0);
 // Season continuity is compared within provider position, not across all roles.
 const core=active.filter(p=>!active.some(q=>q.position===p.position&&q.minutes>=p.minutes&&q.starts>=p.starts&&(q.minutes>p.minutes||q.starts>p.starts)));
 const structural=active.filter(p=>Object.entries(p.axes).some(([k,v])=>['BUILD_UP','DEFENSIVE_IMPACT','SHOT_STOPPING','CONTROL'].includes(k)&&positive(v)))
  .filter(p=>!active.some(q=>q.position===p.position&&q.id!==p.id&&Object.keys(p.axes).length>0&&Object.keys(p.axes).every(k=>(q.axes[k]??-1)>=p.axes[k])&&Object.keys(p.axes).some(k=>(q.axes[k]??-1)>p.axes[k])));
 const recent=active.flatMap(p=>{
  const rows=(p.recent??[]).map(r=>{assert(r.fixtureId!==targetId,'TARGET_EXCLUDED');assert(Date.parse(r.kickoffUtc)<Date.parse(r.fetchedAt)&&Date.parse(r.fetchedAt)<=Date.parse(cutoff),'RECENT_AS_OF');return r;}).filter(r=>latestFixtureIds.slice(0,3).includes(r.fixtureId));
  // Awards are supplementary: positive playing minutes AND role contribution required.
  const qualifying=rows.filter(r=>r.minutes>0&&Object.values(r.axes).some(positive));
  return qualifying.length?[{...p,recent:qualifying.map(r=>({...r,officialMvp:r.officialMvp?.verified&&/^[a-f0-9]{64}$/.test(r.officialMvp.sourceHash)?r.officialMvp:undefined}))}]:[];
 });
 const order=(a:PlayerEvidence,b:PlayerEvidence)=>a.position.localeCompare(b.position)||a.id-b.id;
 return{seasonCore:core.sort(order),structuralKey:structural.sort(order),recentImpact:recent.sort(order),matchKeyPlayer:'WAITING_FOR_XI',selectionRule:'WITHIN_POSITION_PARETO_EVIDENCE_NO_WEIGHTS',goalsAssistsDominance:false};
}

export function playerEvidenceFromContext(context:any,registry:any[],cutoff:string):PlayerEvidence[]{
 assert(Number.isSafeInteger(context.leagueId)&&Number.isSafeInteger(context.season),'CONTEXT_SCOPE');
 assert(context.playerReceipts.length>0&&context.playerReceipts.every((r:any)=>Date.parse(r.providerFetchedAt)<=Date.parse(cutoff)),'PLAYER_TIME');
 return context.players.flatMap((p:any)=>{
  const membership=registry.filter((m:any)=>m.provider==='api-football'&&m.providerPlayerId===String(p.player.id)&&m.teamProviderId===String(context.teamId)&&m.competitionProviderId===String(context.leagueId)&&m.season===String(context.season)&&m.verificationStatus==='EXACT'&&Date.parse(m.recordedAt)<=Date.parse(cutoff)&&Date.parse(m.validFrom)<=Date.parse(cutoff)&&(!m.validTo||Date.parse(m.validTo)>Date.parse(cutoff)));
  if(membership.length!==1)return[];
  const stats=p.statistics.filter((s:any)=>s.team.id===context.teamId&&s.league.id===context.leagueId&&s.league.season===context.season);assert(stats.length<=1,'STAT_IDENTITY');if(!stats.length)return[];
  const s=stats[0],axes:Record<string,number>={};
  // Only already observed basic provider counters. Ratings and advanced metrics are never read.
  if(positive(s.passes?.total))axes.BUILD_UP=s.passes.total;
  if(positive(s.tackles?.total))axes.DEFENSIVE_IMPACT=s.tackles.total;
  if(s.games.position==='Goalkeeper'&&positive(s.goals?.saves))axes.SHOT_STOPPING=s.goals.saves;
  if(positive(s.goals?.total))axes.SCORING=s.goals.total;
  if(positive(s.goals?.assists))axes.CREATION=s.goals.assists;
  if(positive(s.shots?.total))axes.SHOTS=s.shots.total;
  if(positive(s.passes?.key))axes.KEY_PASSES=s.passes.key;
  if(positive(s.tackles?.interceptions))axes.INTERCEPTIONS=s.tackles.interceptions;
  if(positive(s.tackles?.blocks))axes.BLOCKS=s.tackles.blocks;
  const n=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
  return[{id:p.player.id,name:membership[0].displayNameRaw,position:s.games.position,role:s.games.position==='Goalkeeper'?'GK':'UNRESOLVED',minutes:n(s.games.minutes)??0,starts:n(s.games.lineups)??0,goals:n(s.goals.total),assists:n(s.goals.assists),axes,sourceHashes:context.playerReceipts.map((r:any)=>r.sha256)}];
 });
}
