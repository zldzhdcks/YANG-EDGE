import {existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {select,loadParameters} from '../football-v31-r1-prospective-v1/adapter-v1';
import {storeRoot,list,readSeal,sha,requireRule,type Observation} from '../football-v31-r1-prospective-v1/store-v1';
import {validateTarget,type Target} from '../football-v31-r1-prospective-v1/frozen/scripts/football-v3-feature-research-v1/contracts-v1';

/** This path never invokes a prediction, fit, probability function, or snapshot writer. */
export function targetCensus(target:Target,status:string,at:string,observations:Observation[]){
 validateTarget(target);const future=Date.parse(target.kickoffUtc)>Date.parse(at),deadline=Date.parse(target.kickoffUtc)-Date.parse(at)>=60000;
 if(!future)return {target,checkedAt:at,FUTURE:false,NS:status==='NS',deadlineSatisfied:false,historyPotentiallySatisfiable:false,counts:null,baseCounts:null,boundaryCompatible:false};
 const c=select(target,at,at,observations),baseCounts={competition:c.selected.length,homeVenue:c.selected.filter(o=>o.fixture.homeTeamId===target.homeTeamId).length,awayVenue:c.selected.filter(o=>o.fixture.awayTeamId===target.awayTeamId).length};
 const boundaryCompatible=c.selected.every(o=>Date.parse(o.completion.providerFetchedAt)<Date.parse(at));
 return {target,checkedAt:at,FUTURE:future,NS:status==='NS',deadlineSatisfied:deadline,historyPotentiallySatisfiable:c.sufficient&&baseCounts.competition>=30&&baseCounts.homeVenue>=5&&baseCounts.awayVenue>=5&&boundaryCompatible,counts:c.counts,baseCounts,boundaryCompatible};
}
export async function preflight(root:string,key:string,request:typeof fetch=fetch){
 const privateRoot=storeRoot(root),fixtures=join(privateRoot,'fixtures');requireRule(!existsSync(fixtures)||readdirSync(fixtures).length===0,'REAL_SEAL_ALREADY_EXISTS');loadParameters();
 const foundation=readSeal<{targetCensus:{target:Target}[]}>(join(privateRoot,'foundation','READY_CENSUS.json'));
 const observations=list(root).map(s=>s.payload),targets=foundation.payload.targetCensus.map(r=>r.target),receipts=[];
 requireRule(new Set(targets.map(t=>t.fixtureId)).size===targets.length,'DUPLICATE_TARGET');
 for(const old of targets){
  const endpoint='/fixtures?id='+old.fixtureId;
  try{
   const response=await request('https://v3.football.api-sports.io'+endpoint,{headers:{'x-apisports-key':key},redirect:'error',signal:AbortSignal.timeout(30000)}),text=await response.text(),providerFetchedAt=new Date().toISOString(),sourceHash=sha(text);
   // Strict projection: score, goals, events, lineups, statistics and predictions are never accessed or saved.
   const body=JSON.parse(text) as {errors?:object;response?:{fixture:{id:number;date:string;status:{short:string}};league:{id:number;season:number};teams:{home:{id:number};away:{id:number}}}[]};
   requireRule(response.status===200&&Object.keys(body.errors??{}).length===0&&body.response?.length===1,'PROVIDER_UNAVAILABLE');const r=body.response[0];
   const target:Target={fixtureId:r.fixture.id,leagueId:r.league.id,season:r.league.season,kickoffUtc:new Date(r.fixture.date).toISOString(),homeTeamId:r.teams.home.id,awayTeamId:r.teams.away.id};validateTarget(target);
   requireRule(target.fixtureId===old.fixtureId&&target.leagueId===old.leagueId&&target.season===old.season&&target.homeTeamId===old.homeTeamId&&target.awayTeamId===old.awayTeamId,'IDENTITY_CHANGED');
   receipts.push({endpoint,providerFetchedAt,sourceHash,status:'VERIFIED',kickoffChanged:old.kickoffUtc!==target.kickoffUtc,providerStatus:r.fixture.status.short,...targetCensus(target,r.fixture.status.short,providerFetchedAt,observations)});
  }catch{receipts.push({endpoint,fixtureId:old.fixtureId,status:'NOT_VERIFIED',historyPotentiallySatisfiable:false,FUTURE:false,NS:false,deadlineSatisfied:false});}
 }
 const completedAt=new Date().toISOString();
 const potential=receipts.filter(r=>r.status==='VERIFIED'&&r.FUTURE&&r.NS&&r.deadlineSatisfied&&r.historyPotentiallySatisfiable&&'target' in r&&Date.parse(r.target.kickoffUtc)-Date.parse(completedAt)>=60000);
 requireRule(!existsSync(fixtures)||readdirSync(fixtures).length===0,'REAL_SEAL_ALREADY_EXISTS');
 return {completedAt,foundationCensusHash:foundation.sha256,storedTargets:targets.length,futureTargets:receipts.filter(r=>r.status==='VERIFIED'&&'target'in r&&Date.parse(r.target.kickoffUtc)>Date.parse(completedAt)).length,potentiallyEligibleTargets:potential.length,apiRequests:receipts.length,unverified:receipts.filter(r=>r.status!=='VERIFIED').length,observationRecords:observations.length,receipts,prospectiveShadowExecuted:false,probabilitiesComputed:false,firstRunStillRequiresAuthorization:true};
}
