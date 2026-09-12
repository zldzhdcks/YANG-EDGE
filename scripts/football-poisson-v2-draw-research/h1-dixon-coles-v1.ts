import {attempt,exactKeys,rateGate,requireRule,type Fit} from './contracts-v1';
import {bisectDerivative,joint} from './numerics-v1';
export const RHO_LOWER=-(1-1e-8)/10,RHO_UPPER=(1-1e-8)/100;
export type DependenceExample={lambda:number;mu:number;x:number;y:number};
export function tau(x:number,y:number,h:number,a:number,rho:number){return x===0&&y===0?1-h*a*rho:x===0&&y===1?1+h*rho:x===1&&y===0?1+a*rho:x===1&&y===1?1-rho:1;}
function validateRho(rho:number){requireRule(Number.isFinite(rho),'FAIL_NONFINITE_PARAMETER','FAIL');requireRule(rho>=RHO_LOWER&&rho<=RHO_UPPER,'INVALID_RHO_DOMAIN');}
export function dependenceObjective(rows:DependenceExample[],rho:number){validateRho(rho);let objective=0,gradient=0;for(const r of rows){const c=r.x===0&&r.y===0?-r.lambda*r.mu:r.x===0&&r.y===1?r.lambda:r.x===1&&r.y===0?r.mu:r.x===1&&r.y===1?-1:0;const factor=1+c*rho;requireRule(factor>0&&Number.isFinite(factor),'INVALID_TAU');objective-=Math.log(factor);gradient-=c/factor;}return {objective:objective/rows.length,gradient:gradient/rows.length};}
export function fitDependence(rows:DependenceExample[]):Fit<{rho:number}>{return attempt(()=>{
  for(const r of rows){exactKeys(r,['lambda','mu','x','y']);rateGate(r.lambda,r.mu);for(const g of [r.x,r.y])requireRule(Number.isSafeInteger(g)&&g>=0&&g<=100,'INVALID_SCORE');}
  const counts=[0,0,0,0];for(const r of rows)if(r.x<2&&r.y<2)counts[2*r.x+r.y]++;
  requireRule(rows.length>=30&&counts.reduce((a,b)=>a+b,0)>=10,'PASS_INSUFFICIENT_FIT','PASS');
  const solution=bisectDerivative(rho=>dependenceObjective(rows,rho).gradient,RHO_LOWER,RHO_UPPER,0);
  return {parameters:{rho:solution.value},diagnostics:{...solution,objective:dependenceObjective(rows,solution.value).objective,n:rows.length,informativeCount:counts.reduce((a,b)=>a+b,0),cellCounts:counts,flat:false}};
});}
export function predictDependence(h:number,a:number,rho:number){validateRho(rho);return joint(h,a,(x,y)=>tau(x,y,h,a,rho));}
