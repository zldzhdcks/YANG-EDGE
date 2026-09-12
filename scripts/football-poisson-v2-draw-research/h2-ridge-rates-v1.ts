import {attempt,requireRule,validatePool,order,exactKeys,historyReasons,rateGate,type Fit,type Match,type Target} from './contracts-v1';
export const KAPPA=0.01;
export type RateParameters={teams:number[];theta:number[]};
export function center(theta:number[],k:number){const out=[...theta];for(const offset of [2,2+k]){const mean=out.slice(offset,offset+k).reduce((a,b)=>a+b,0)/k;for(let j=0;j<k;j++)out[offset+j]-=mean;}return out;}
export function initialize(rows:Match[],teams:number[]){const goals=rows.reduce((n,r)=>n+r.homeGoals+r.awayGoals,0);return [Math.log(goals/(2*rows.length)),0,...new Array(2*teams.length).fill(0)] as number[];}
export function rates(parameters:RateParameters,home:number,away:number){
  exactKeys(parameters,['teams','theta']);const {teams,theta}=parameters,k=teams.length;
  requireRule(k>0&&new Set(teams).size===k&&teams.every((n,i)=>Number.isSafeInteger(n)&&n>0&&(i===0||n>teams[i-1])),'INVALID_TEAM_UNIVERSE');
  requireRule(theta.length===2+2*k,'INVALID_PARAMETER_DIMENSION');requireRule(theta.every(Number.isFinite),'FAIL_NONFINITE_PARAMETER','FAIL');
  requireRule([2,2+k].every(o=>Math.abs(theta.slice(o,o+k).reduce((a,b)=>a+b,0))<=1e-10),'INVALID_IDENTIFIABILITY');
  const hi=teams.indexOf(home),ai=teams.indexOf(away);requireRule(hi>=0&&ai>=0,'PASS_UNSEEN_TEAM','PASS');
  const h=Math.exp(theta[0]+theta[1]+theta[2+hi]-theta[2+k+ai]),a=Math.exp(theta[0]+theta[2+ai]-theta[2+k+hi]);rateGate(h,a);return [h,a] as [number,number];
}
export function objectiveGradient(rows:Match[],teams:number[],theta:number[]){
  const k=teams.length,index=new Map(teams.map((t,i)=>[t,i])),gradient=theta.map(n=>KAPPA*n);let value=theta.reduce((n,p)=>n+KAPPA*p*p/2,0);const scale=1/(2*rows.length);
  for(const r of rows){const hi=index.get(r.homeTeamId),ai=index.get(r.awayTeamId);requireRule(hi!==undefined&&ai!==undefined,'INVALID_TEAM_UNIVERSE');const etaH=theta[0]+theta[1]+theta[2+hi]-theta[2+k+ai],etaA=theta[0]+theta[2+ai]-theta[2+k+hi],lh=Math.exp(etaH),la=Math.exp(etaA);if(!Number.isFinite(lh)||!Number.isFinite(la)||lh<=0||la<=0)return {value:Infinity,gradient:theta.map(()=>NaN)};
    value+=scale*(lh-r.homeGoals*etaH+la-r.awayGoals*etaA);const eh=scale*(lh-r.homeGoals),ea=scale*(la-r.awayGoals);gradient[0]+=eh+ea;gradient[1]+=eh;gradient[2+hi]+=eh;gradient[2+ai]+=ea;gradient[2+k+ai]-=eh;gradient[2+k+hi]-=ea;
  }return {value,gradient};
}
export function fitRates(input:Match[]):Fit<RateParameters>{return attempt(()=>{
  validatePool(input);const rows=order(input);requireRule(rows.length>=30,'PASS_INSUFFICIENT_FIT','PASS');requireRule(rows.reduce((n,r)=>n+r.homeGoals,0)>0&&rows.reduce((n,r)=>n+r.awayGoals,0)>0,'PASS_ZERO_COMPETITION_GOAL_RATE','PASS');
  const teams=[...new Set(rows.flatMap(r=>[r.homeTeamId,r.awayTeamId]))].sort((a,b)=>a-b),k=teams.length;let theta=initialize(rows,teams),reductions=0;const trace:{iteration:number;before:number;after:number;alpha:number;normSquared:number}[]=[];
  for(let iteration=0;iteration<=10000;iteration++){
    const state=objectiveGradient(rows,teams,theta);requireRule(Number.isFinite(state.value)&&state.gradient.every(Number.isFinite)&&theta.every(Number.isFinite),'FAIL_NUMERICAL','FAIL');const gp=center(state.gradient,k),norm=Math.max(...gp.map(Math.abs));const sums=[2,2+k].map(o=>theta.slice(o,o+k).reduce((a,b)=>a+b,0));
    if(norm<=1e-7&&sums.every(n=>Math.abs(n)<=1e-10))return {parameters:{teams,theta},diagnostics:{n:rows.length,k,objective:state.value,projectedGradientInfinity:norm,iterations:iteration,lineSearchReductions:reductions,zeroSums:sums,armijoTrace:trace,kappa:KAPPA}};
    requireRule(iteration<10000,'FAIL_NON_CONVERGENCE','FAIL');const normSquared=gp.reduce((n,g)=>n+g*g,0);let accepted=false;
    for(let j=0;j<60;j++){const alpha=2**(-j),trial=center(theta.map((p,i)=>p-alpha*gp[i]),k),next=objectiveGradient(rows,teams,trial);if(trial.every(Number.isFinite)&&Number.isFinite(next.value)&&next.value<=state.value-1e-4*alpha*normSquared){trace.push({iteration,before:state.value,after:next.value,alpha,normSquared});theta=trial;reductions+=j;accepted=true;break;}}
    requireRule(accepted,'FAIL_LINE_SEARCH','FAIL');
  }requireRule(false,'FAIL_NON_CONVERGENCE','FAIL');
});}
export function predictRates(parameters:RateParameters,t:Target,history:Match[]){const reasons=historyReasons(t,history);requireRule(!reasons.length,reasons.join('|'),'PASS');return rates(parameters,t.homeTeamId,t.awayTeamId);}
