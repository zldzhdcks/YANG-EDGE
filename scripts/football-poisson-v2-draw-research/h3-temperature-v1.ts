import {attempt,exactKeys,argmax,requireRule,validProb,type Fit,type Prob} from './contracts-v1';
import {bisectDerivative} from './numerics-v1';
export type CalibrationExample={p:Prob;actual:number};
function validateBeta(beta:number){requireRule(Number.isFinite(beta),'FAIL_NONFINITE_PARAMETER','FAIL');requireRule(beta>=0.05&&beta<=20,'INVALID_BETA_DOMAIN');}
export function temperature(p:Prob,beta:number){validProb(p);validateBeta(beta);const logits=p.map(v=>v===0?-Infinity:Math.log(v)*beta),m=Math.max(...logits),e=logits.map(z=>Math.exp(z-m)),sum=e.reduce((a,b)=>a+b,0),q=e.map(v=>v/sum) as Prob;validProb(q);requireRule(argmax(q)===argmax(p),'INVALID_ARGMAX_DRIFT');return q;}
export function calibrationObjective(rows:CalibrationExample[],beta:number){validateBeta(beta);let objective=0,gradient=0;for(const r of rows){const q=temperature(r.p,beta),logs=r.p.map(p=>p===0?-Infinity:Math.log(p)),m=Math.max(...logs.map(v=>v*beta));requireRule(r.p[r.actual]>0,'FAIL_ZERO_SUPPORT','FAIL');objective+=m+Math.log(logs.reduce((n,z)=>n+Math.exp(beta*z-m),0))-beta*logs[r.actual];gradient+=q.reduce((n,v,k)=>n+(v===0?0:v*logs[k]),0)-logs[r.actual];}return {objective:objective/rows.length,gradient:gradient/rows.length};}
export function fitTemperature(rows:CalibrationExample[]):Fit<{beta:number;T:number}>{return attempt(()=>{
  for(const r of rows){exactKeys(r,['p','actual']);validProb(r.p);requireRule(Number.isSafeInteger(r.actual)&&r.actual>=0&&r.actual<3,'INVALID_CLASS');requireRule(r.p[r.actual]>0,'FAIL_ZERO_SUPPORT','FAIL');}
  const counts=[0,0,0];for(const r of rows)counts[r.actual]++;
  requireRule(rows.length>=30&&counts.every(n=>n>=5),'PASS_INSUFFICIENT_FIT','PASS');
  const flat=rows.every(r=>{const supported=r.p.filter(n=>n>0);return supported.every(n=>n===supported[0]);});
  const solution=flat?{value:1,iterations:0,boundary:false,gradient:0}:bisectDerivative(beta=>calibrationObjective(rows,beta).gradient,0.05,20,1);
  return {parameters:{beta:solution.value,T:1/solution.value},diagnostics:{...solution,flat,objective:calibrationObjective(rows,solution.value).objective,n:rows.length,classCounts:counts,zeroSupportCount:rows.reduce((n,r)=>n+r.p.filter(p=>p===0).length,0)}};
});}
