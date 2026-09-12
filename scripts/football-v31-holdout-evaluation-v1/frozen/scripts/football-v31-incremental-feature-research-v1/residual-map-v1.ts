import {attempt,BOUNDARY,DAY,digest,order,requireRule,validateTarget,type Target,type Fit} from './contracts-v1';
import {assertAnchor,type Anchor,type Pair,type Condition} from './causal-state-v1';
export type Parameters=[Condition,Condition];
export type MapRecord={kind:'PREFIX'|'INITIAL'|'FINAL';leagueId:number;targetId:number|null;cutoffAt:string;count:number;fixtureIds:number[];fixtureIdsHash:string;inputHash:string;parameterHash:string;fit:Fit<Parameters>};
const trusted=new WeakMap<MapRecord,string>();
export function normalEquations(rows:{h:Condition;q:Pair}[]){
  requireRule(rows.length>0,'PASS_INSUFFICIENT_REPRESENTATION_HISTORY','PASS');const A=Array.from({length:3},()=>[0,0,0]),b=[[0,0,0],[0,0,0]];
  for(const r of rows){requireRule(r.h.length===3&&r.h[0]===1&&r.q.length===2&&[...r.h,...r.q].every(Number.isFinite),'INVALID_MAP_ROW');for(let i=0;i<3;i++){for(let j=0;j<3;j++)A[i][j]+=r.h[i]*r.h[j];for(let j=0;j<2;j++)b[j][i]+=r.h[i]*r.q[j];}}
  for(let i=0;i<3;i++){for(let j=0;j<3;j++)A[i][j]/=rows.length;for(let j=0;j<2;j++)b[j][i]/=rows.length;}A[1][1]+=0.01;A[2][2]+=0.01;requireRule([...A.flat(),...b.flat()].every(Number.isFinite),'FAIL_NUMERICAL','FAIL');return {A,b};
}
export function solveMaps(A:number[][],b:number[][]):Parameters{
  requireRule(A.length===3&&A.every(r=>r.length===3)&&b.length===2&&b.every(r=>r.length===3),'INVALID_MAP_SYSTEM');
  const L=Array.from({length:3},()=>[0,0,0]);for(let i=0;i<3;i++)for(let j=0;j<=i;j++){let v=A[i][j];for(let k=0;k<j;k++)v-=L[i][k]*L[j][k];requireRule(Number.isFinite(v)&&(i!==j||v>0),'FAIL_MAP_CHOLESKY','FAIL');L[i][j]=i===j?Math.sqrt(v):v/L[j][j];}
  const params=b.map(rhs=>{const y=[0,0,0],x=[0,0,0];for(let i=0;i<3;i++){let v=rhs[i];for(let j=0;j<i;j++)v-=L[i][j]*y[j];y[i]=v/L[i][i];}for(let i=2;i>=0;i--){let v=y[i];for(let j=i+1;j<3;j++)v-=L[j][i]*x[j];x[i]=v/L[i][i];}requireRule(x.every(Number.isFinite),'FAIL_MAP_NONFINITE','FAIL');let err=0;for(let i=0;i<3;i++){let v=0;for(let j=0;j<3;j++)v+=A[i][j]*x[j];err=Math.max(err,Math.abs(v-rhs[i]));}requireRule(Number.isFinite(err)&&err<=1e-10*(1+Math.max(...rhs.map(Math.abs))),'FAIL_MAP_NORMAL_EQUATION','FAIL');return x as Condition;});return params as Parameters;
}
export function residual(q:Pair,h:Condition,a:Parameters):Pair{return a.map((col,j)=>{let dot=0;for(let i=0;i<3;i++)dot+=h[i]*col[i];return q[j]-dot;}) as Pair;}
export function prefixPool(t:Target,anchors:Anchor[]){validateTarget(t);requireRule(t.season===2023,'MAP_FIT_SEASON');for(const a of anchors){assertAnchor(a);requireRule(a.target.season===2023,'MAP_FIT_SEASON');}const c=Date.parse(t.kickoffUtc)-1;return anchors.filter(a=>a.target.leagueId===t.leagueId&&a.target.fixtureId!==t.fixtureId&&Date.parse(a.target.kickoffUtc)>=c-365*DAY&&Date.parse(a.target.kickoffUtc)+2*DAY<c);}
function record(kind:MapRecord['kind'],leagueId:number,targetId:number|null,cutoff:number,pool:Anchor[]):MapRecord{
  const ordered=order(pool.map(a=>({...a.target,a}))).map(r=>r.a);const fit=attempt<Parameters>(()=>{
    const ids=new Set<number>();for(const a of ordered){assertAnchor(a);requireRule(a.target.season===2023&&a.target.leagueId===leagueId,'MAP_FIT_SEASON_OR_LEAGUE');requireRule(!ids.has(a.target.fixtureId),'DUPLICATE_ANCHOR');ids.add(a.target.fixtureId);requireRule(Date.parse(a.target.kickoffUtc)+2*DAY<cutoff,'MAP_TEMPORAL_LEAKAGE');if(kind==='PREFIX')requireRule(a.target.fixtureId!==targetId&&Date.parse(a.target.kickoffUtc)>=cutoff-365*DAY,'MAP_PREFIX_LEAKAGE');if(a.status==='FAIL'||a.status==='INVALID')requireRule(false,a.reasons.join('|'),a.status);}
    const valid=ordered.filter(a=>a.status==='PREDICTED');requireRule(valid.length>=5,'PASS_INSUFFICIENT_REPRESENTATION_HISTORY','PASS');const rows=valid.flatMap(a=>[0,1].map(s=>({h:a.h![s],q:a.q![s]})));const eq=normalEquations(rows),parameters=solveMaps(eq.A,eq.b);return {parameters,diagnostics:{...eq,anchors:valid.length,sideRows:rows.length,slopeRidge:0.01,interceptPenalty:0}};
  });
  const valid=ordered.filter(a=>a.status==='PREDICTED'),fixtureIds=valid.map(a=>a.target.fixtureId);const out:MapRecord={kind,leagueId,targetId,cutoffAt:new Date(cutoff).toISOString(),count:valid.length,fixtureIds,fixtureIdsHash:digest(fixtureIds),inputHash:digest(ordered),parameterHash:digest(fit.parameters),fit};trusted.set(out,digest(out));return out;
}
export function fitPrefix(t:Target,pool:Anchor[]){validateTarget(t);requireRule(t.season===2023,'MAP_FIT_SEASON');return record('PREFIX',t.leagueId,t.fixtureId,Date.parse(t.kickoffUtc)-1,pool);}
export function fitStageMap(kind:'INITIAL'|'FINAL',leagueId:number,pool:Anchor[],fullSeason:Target[],now:number){
  requireRule(kind==='INITIAL'||kind==='FINAL','INVALID_MAP_STAGE');requireRule(fullSeason.length&&fullSeason.every(t=>{validateTarget(t);return t.season===2023&&t.leagueId===leagueId;}),'MAP_STAGE_SEASON');const max=Math.max(...fullSeason.map(t=>Date.parse(t.kickoffUtc))),cutoff=kind==='INITIAL'?BOUNDARY:max+2*DAY+1;requireRule(now>=cutoff,'MAP_NOT_YET_AVAILABLE');return record(kind,leagueId,null,cutoff,pool);
}
export function assertMap(map:MapRecord){requireRule(trusted.get(map)===digest(map),'UNTRUSTED_OR_MUTATED_MAP');}
export function transform(a:Anchor,map:MapRecord,mode:'TRAIN'|'CHECK'):[Pair,Pair]{
  assertAnchor(a);assertMap(map);requireRule(a.target.leagueId===map.leagueId,'MAP_LEAGUE');
  if(mode==='TRAIN')requireRule(a.target.season===2023&&map.kind==='PREFIX'&&map.targetId===a.target.fixtureId&&map.cutoffAt===new Date(Date.parse(a.target.kickoffUtc)-1).toISOString(),'FINAL_MAP_BACKFILL_FORBIDDEN');
  else requireRule(map.kind===(a.target.season===2023?'INITIAL':'FINAL')&&Date.parse(a.target.kickoffUtc)>=Date.parse(map.cutoffAt),'WRONG_CHECK_MAP');
  requireRule(a.status==='PREDICTED','UNAVAILABLE_ANCHOR');if(map.fit.status!=='FITTED')requireRule(false,map.fit.reasons.join('|'),map.fit.status);
  const x:[Pair,Pair]=[residual(a.q![0],a.h![0],map.fit.parameters),residual(a.q![1],a.h![1],map.fit.parameters)];requireRule(x.flat().every(Number.isFinite),'FAIL_NUMERICAL','FAIL');return x;
}

/** Evaluation-only hydration; caller supplies a sealed final map. No fitting. */
export function hydrateFinalMap(map:MapRecord, expectedRecordHash:string, expectedParameterHash:string){
  requireRule(map.kind==='FINAL'&&map.targetId===null&&map.fit.status==='FITTED','FINAL_MAP_REQUIRED');
  requireRule(digest(map)===expectedRecordHash&&digest(map.fit.parameters)===expectedParameterHash&&map.parameterHash===expectedParameterHash,'FINAL_MAP_HASH');
  requireRule(map.fit.parameters.length===2&&map.fit.parameters.every(r=>r.length===3&&r.every(Number.isFinite)),'FINAL_MAP_DIMENSION');
  trusted.set(map,digest(map));return map;
}
