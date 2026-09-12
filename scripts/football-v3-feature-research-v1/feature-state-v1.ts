import {FEATURES,REQUIRED,exactKeys,validateTarget,requireRule,selectTargets,order,digest,type Target,type Feature,type Candidate} from './contracts-v1';
export type FeatureRecord={target:Target;values:Record<Feature,[number,number]|null>;sourceHash:string;providerFetchedAt:string};
type ProviderBody={errors?:object;response?:{team?:{id:number};statistics?:{type:string;value:unknown}[]}[]};
export function parseFeature(body:ProviderBody,t:Target,f:Feature):[number,number]|null{
  validateTarget(t);requireRule(Object.keys(body.errors??{}).length===0&&Array.isArray(body.response),'INVALID_PROVIDER_RESPONSE');
  const blocks=body.response!,ids=[t.homeTeamId,t.awayTeamId];
  requireRule(blocks.length<=2&&blocks.every(b=>ids.includes(b.team?.id??-1))&&new Set(blocks.map(b=>b.team?.id)).size===blocks.length,'INVALID_TEAM_BLOCKS');
  const type={xG:'expected_goals',shots:'Total Shots',sot:'Shots on Goal'}[f];
  const values=ids.map(id=>{const b=blocks.find(x=>x.team?.id===id);if(!b)return null;requireRule(Array.isArray(b.statistics),'INVALID_STATISTICS_SCHEMA');const rows=b.statistics!.filter(x=>x.type===type);requireRule(rows.length<=1,'DUPLICATE_FEATURE');if(!rows.length||rows[0].value===null)return null;const v=rows[0].value;
    requireRule((typeof v==='number'||typeof v==='string'&&/^\d+(\.\d+)?$/.test(v.trim()))&&Number.isFinite(Number(v))&&Number(v)>=0&&(f==='xG'||Number.isInteger(Number(v))),'INVALID_RAW_FEATURE_VALUE');return Number(v);});
  return values.some(v=>v===null)?null:values as [number,number];
}
export function validateFeature(r:FeatureRecord,required:readonly Feature[]){
  exactKeys(r,['target','values','sourceHash','providerFetchedAt']);validateTarget(r.target);exactKeys(r.values,[...FEATURES]);
  requireRule(/^[a-f0-9]{64}$/.test(r.sourceHash)&&Number.isFinite(Date.parse(r.providerFetchedAt)),'INVALID_FEATURE_PROVENANCE');
  for(const f of required){const v=r.values[f];requireRule(v===null||Array.isArray(v)&&v.length===2&&v.every(n=>Number.isFinite(n)&&n>=0&&(f==='xG'||Number.isInteger(n))),'INVALID_RAW_FEATURE_VALUE');}
}
export function validateFeatureHistory(candidate:Candidate,t:Target,history:FeatureRecord[]){
  validateTarget(t);const required=REQUIRED[candidate];requireRule(required,'INVALID_CANDIDATE');for(const r of history)validateFeature(r,required);
  const ordered=order(history.map(r=>({...r.target,record:r})));const selected=selectTargets(t,ordered.map(r=>r.record.target));
  requireRule(selected.length===history.length,'TARGET_FUTURE_OR_FOREIGN_FEATURE');
  return ordered;
}
export function featureState(candidate:Candidate,t:Target,history:FeatureRecord[]){
  const ordered=validateFeatureHistory(candidate,t,history),required=REQUIRED[candidate];
  const deficits:string[]=[],details=[];
  for(const f of required){const pool=ordered.filter(r=>r.record.values[f]!==null),teamRows=[t.homeTeamId,t.awayTeamId].map(teamId=>pool.filter(r=>r.homeTeamId===teamId||r.awayTeamId===teamId));
    for(let side=0;side<2;side++)if(teamRows[side].length<5)deficits.push(f+':'+[t.homeTeamId,t.awayTeamId][side]);
    details.push({feature:f,pool,teamRows});}
  requireRule(!deficits.length,'PASS_INSUFFICIENT_FEATURE_HISTORY|'+deficits.join('|'),'PASS');
  const home:number[]=[],away:number[]=[],audit=[];
  for(const {feature:f,pool,teamRows} of details){let total=0;for(const r of pool){total+=r.record.values[f]![0];total+=r.record.values[f]![1];}const reference=total/(2*pool.length);
    const teams=teamRows.map((rows,side)=>{const teamId=[t.homeTeamId,t.awayTeamId][side];let forSum=0,againstSum=0;for(const r of rows){const v=r.record.values[f]!;forSum+=v[r.homeTeamId===teamId?0:1];againstSum+=v[r.homeTeamId===teamId?1:0];}return {teamId,count:rows.length,forMean:forSum/rows.length,againstMean:againstSum/rows.length,ids:rows.map(r=>r.fixtureId)};});
    const means=[reference,...teams.flatMap(x=>[x.forMean,x.againstMean])];requireRule(means.every(Number.isFinite),'FAIL_NUMERICAL','FAIL');requireRule(means.every(n=>n>0),'PASS_NONPOSITIVE_FEATURE_MEAN','PASS');
    const z=teams.map(x=>[Math.log(x.forMean)-Math.log(reference),Math.log(x.againstMean)-Math.log(reference)]);
    home.push(z[0][0],z[1][1]);away.push(z[1][0],z[0][1]);audit.push({feature:f,reference,teams,eligibleIds:pool.map(r=>r.fixtureId),excluded:ordered.filter(r=>r.record.values[f]===null).map(r=>({fixtureId:r.fixtureId,reason:'FEATURE_UNAVAILABLE'}))});
  }
  return {home,away,audit,inputHash:digest(history),provenance:history.map(r=>({fixtureId:r.target.fixtureId,sourceHash:r.sourceHash,providerFetchedAt:r.providerFetchedAt}))};
}
