import {requireRule,rateGate,validProb,type Prob} from './contracts-v1';
export function bisectDerivative(g:(x:number)=>number,lower:number,upper:number,initial:number){
  const evaluate=(x:number)=>{const v=g(x);requireRule(Number.isFinite(v),'FAIL_NONFINITE_DERIVATIVE','FAIL');return v;};
  let lo=lower,hi=upper;const gl=evaluate(lo),gh=evaluate(hi);
  if(gl>=0)return {value:lo,iterations:0,boundary:true,gradient:gl};if(gh<=0)return {value:hi,iterations:0,boundary:true,gradient:gh};
  const gi=evaluate(initial);if(Math.abs(gi)<=1e-10)return {value:initial,iterations:0,boundary:false,gradient:gi};if(gi>0)hi=initial;else lo=initial;
  for(let iteration=1;iteration<=80;iteration++){const mid=(lo+hi)/2,gm=evaluate(mid);if(Math.abs(gm)<=1e-10||hi-lo<=1e-10)return {value:mid,iterations:iteration,boundary:false,gradient:gm};if(gm>0)hi=mid;else lo=mid;}
  requireRule(false,'FAIL_OPTIMIZER','FAIL');
}
function pmf(rate:number){const p=[Math.exp(-rate)];let sum=p[0];for(let k=1;k<=199;k++){const value=p[k-1]*rate/k;requireRule(Number.isFinite(value),'INVALID_GRID');p.push(value);sum+=value;if(1-sum<=1e-12)return p;}requireRule(false,'INVALID_GRID_CAP');}
export function joint(h:number,a:number,tau:(x:number,y:number)=>number=()=>1){
  rateGate(h,a);const home=pmf(h),away=pmf(a),p:Prob=[0,0,0],cells=[0,0,0,0];let z=0;
  for(let x=0;x<home.length;x++)for(let y=0;y<away.length;y++){const correction=tau(x,y);requireRule(Number.isFinite(correction)&&correction>0,'INVALID_TAU');const q=home[x]*away[y]*correction;requireRule(Number.isFinite(q)&&q>=0,'INVALID_GRID_MASS');z+=q;p[x>y?0:x===y?1:2]+=q;if(x<2&&y<2)cells[x*2+y]=q;}
  requireRule(Number.isFinite(z)&&z>0&&Math.abs(1-z)<=3e-12,'INVALID_PROBABILITY_MASS');for(let k=0;k<3;k++)p[k]/=z;validProb(p);return {p,cells:cells.map(n=>n/z),normalization:z};
}
export function logFactorial(g:number){let n=0;for(let k=1;k<=g;k++)n+=Math.log(k);return n;}
export const poissonNll=(g:number,lambda:number)=>lambda-g*Math.log(lambda)+logFactorial(g);
export const deviance=(g:number,lambda:number)=>2*((g===0?0:g*Math.log(g/lambda))-(g-lambda));
