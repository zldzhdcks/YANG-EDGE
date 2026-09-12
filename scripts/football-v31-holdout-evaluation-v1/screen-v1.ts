import {type compare} from './frozen/scripts/football-v3-feature-research-v1/metrics-v1';
export type Comparison=ReturnType<typeof compare>;
export type Screen='ELIGIBLE_FOR_CTO_PROMOTION_REVIEW'|'SCREEN_NO'|'INSUFFICIENT'|'FAIL'|'INVALID';
type Gate={name:string;status:'PASS'|'NO'|'INSUFFICIENT';delta?:number};
export function screen(c:Comparison){const gates:Gate[]=[];const add=(name:string,ok:boolean|null,delta?:number)=>gates.push({name,status:ok===null?'INSUFFICIENT':ok?'PASS':'NO',...(delta===undefined?{}:{delta})});
 add('FIXED_U_MIN_100',c.pairedCount>=100);add('FIXED_U_80_PERCENT',c.pairedCount>=.8*c.full.targets);add('CANDIDATE_FULL_U',c.pairedComplete);add('FAIL_ZERO',c.full.fail===0);add('INVALID_ZERO',c.full.invalid===0);
 for(const key of ['v1','h2'] as const){const b=c[key],a=c.candidate;
  for(const field of ['logLoss','brier'] as const){const x=a?.[field],y=b[field];add(key+':'+field,x==null||y==null?null:x<y-1e-12,x==null||y==null?undefined:x-y);}
  for(let k=0;k<3;k++){const ac=a?.classes[k],bc=b.classes[k];add(key+':'+bc.name+':ACTUAL_CLASS_PRESENT',bc.actual>0);
   for(const field of ['recall','ece','brier'] as const){const x=ac?.[field],y=bc[field],d=x==null||y==null?null:x-y;add(key+':'+bc.name+':'+field,d===null?null:field==='recall'?d>=-.05-1e-12:field==='ece'?d<=.01+1e-12:d<=1e-12,d??undefined);}
  }
 }
 const status:Screen=c.full.invalid?'INVALID':c.full.fail?'FAIL':gates.some(g=>g.status==='INSUFFICIENT')?'INSUFFICIENT':gates.some(g=>g.status==='NO')?'SCREEN_NO':'ELIGIBLE_FOR_CTO_PROMOTION_REVIEW';return {status,gates};
}
export function aggregate(rows:ReturnType<typeof screen>[]):Screen{if(rows.some(r=>r.status==='INVALID'))return 'INVALID';if(rows.some(r=>r.status==='FAIL'))return 'FAIL';if(rows.some(r=>r.status==='INSUFFICIENT')||rows.length!==4)return 'INSUFFICIENT';return rows.every(r=>r.status==='ELIGIBLE_FOR_CTO_PROMOTION_REVIEW')?'ELIGIBLE_FOR_CTO_PROMOTION_REVIEW':'SCREEN_NO';}
export function interpretation(rows:Comparison[]){const ds=rows.flatMap(r=>r.delta?Object.values(r.delta).flatMap(d=>[d.logLoss,d.brier]):[]);return rows.length!==4||ds.length!==16?'INDEPENDENT_HOLDOUT_NOT_CONFIRMED':ds.every(d=>d< -1e-12)?'INDEPENDENT_HOLDOUT_CONFIRMED':ds.some(d=>d< -1e-12)?'INDEPENDENT_HOLDOUT_MIXED':'INDEPENDENT_HOLDOUT_NOT_CONFIRMED';}
