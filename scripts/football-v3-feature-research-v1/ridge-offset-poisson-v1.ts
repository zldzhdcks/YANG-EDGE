import {attempt,requireRule,validateTarget,exactKeys,order,type Target} from './contracts-v1';
export const KAPPA=0.01;
export type Example={target:Target;home:number[];away:number[];offset:[number,number];goals:[number,number]};
export const initialize=(dimension:number)=>Array<number>(dimension).fill(0);
export function objective(rows:Example[],beta:number[]){
  const d=beta.length,g=beta.map(b=>KAPPA*b),h=Array.from({length:d},(_,i)=>Array.from({length:d},(_,j)=>i===j?KAPPA:0));let value=beta.reduce((s,b)=>s+KAPPA*b*b/2,0);const scale=1/(2*rows.length);
  for(const row of rows)for(let side=0;side<2;side++){
    const x=side===0?row.home:row.away;let dot=0;for(let j=0;j<d;j++)dot+=beta[j]*x[j];const eta=Math.log(row.offset[side])+dot,rate=Math.exp(eta);
    if(!Number.isFinite(rate)||rate<=0)return {value:Infinity,g:g.map(()=>NaN),h};value+=scale*(rate-row.goals[side]*eta);
    for(let j=0;j<d;j++){g[j]+=scale*x[j]*(rate-row.goals[side]);for(let k=0;k<d;k++)h[j][k]+=scale*rate*x[j]*x[k];}
  }return {value,g,h};
}
export function choleskyDirection(h:number[][],g:number[]){
  const n=g.length,L=Array.from({length:n},()=>Array<number>(n).fill(0));
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let s=h[i][j];for(let k=0;k<j;k++)s-=L[i][k]*L[j][k];requireRule(Number.isFinite(s)&&(i!==j||s>0),'FAIL_NUMERICAL','FAIL');L[i][j]=i===j?Math.sqrt(s):s/L[j][j];}
  const y=Array<number>(n).fill(0),d=[...y];for(let i=0;i<n;i++){let s=-g[i];for(let j=0;j<i;j++)s-=L[i][j]*y[j];y[i]=s/L[i][i];}for(let i=n-1;i>=0;i--){let s=y[i];for(let j=i+1;j<n;j++)s-=L[j][i]*d[j];d[i]=s/L[i][i];}requireRule(d.every(Number.isFinite),'FAIL_NUMERICAL','FAIL');return d;
}
export function fitBeta(input:Example[],dimension:number){return attempt(()=>{
  requireRule([2,4,6].includes(dimension),'INVALID_DIMENSION');const ids=new Set<number>();
  for(const r of input){exactKeys(r,['target','home','away','offset','goals']);validateTarget(r.target);requireRule(r.target.season===2023,'BETA_FIT_SEASON_FIREWALL');requireRule(!ids.has(r.target.fixtureId),'DUPLICATE_FIT_EXAMPLE');ids.add(r.target.fixtureId);requireRule(input.every(x=>x.target.leagueId===r.target.leagueId),'CROSS_LEAGUE_FIT');
    requireRule([r.home,r.away].every(x=>x.length===dimension&&x.every(Number.isFinite))&&r.offset.length===2&&r.offset.every(n=>Number.isFinite(n)&&n>0)&&r.goals.length===2&&r.goals.every(n=>Number.isSafeInteger(n)&&n>=0),'INVALID_FIT_EXAMPLE');}
  requireRule(input.length>=30,'PASS_INSUFFICIENT_FIT','PASS');const rows=order(input.map(r=>({...r.target,r}))).map(x=>x.r);let beta=initialize(dimension);const trace=[];
  for(let iteration=0;iteration<=100;iteration++){
    const state=objective(rows,beta),norm=Math.max(...state.g.map(Math.abs));requireRule(Number.isFinite(state.value)&&state.g.every(Number.isFinite)&&state.h.flat().every(Number.isFinite)&&beta.every(Number.isFinite),'FAIL_NUMERICAL','FAIL');
    if(norm<=1e-7)return {parameters:beta,diagnostics:{n:rows.length,dimension,objective:state.value,gradientInfinity:norm,iterations:iteration,trace,kappa:KAPPA,initialization:initialize(dimension)}};
    requireRule(iteration<100,'FAIL_NON_CONVERGENCE','FAIL');const d=choleskyDirection(state.h,state.g),gd=state.g.reduce((s,g,i)=>s+g*d[i],0);requireRule(Number.isFinite(gd)&&gd<0,'FAIL_NUMERICAL','FAIL');let accepted=false;
    for(let j=0;j<60;j++){const alpha=2**(-j),trial=beta.map((b,i)=>b+alpha*d[i]),next=objective(rows,trial);if(trial.every(Number.isFinite)&&Number.isFinite(next.value)&&next.value<=state.value+1e-4*alpha*gd){trace.push({iteration,alpha,before:state.value,after:next.value,gradientInfinity:norm});beta=trial;accepted=true;break;}}
    requireRule(accepted,'FAIL_LINE_SEARCH','FAIL');
  }requireRule(false,'FAIL_NON_CONVERGENCE','FAIL');
});}
