import {actual,argmax,CLASSES,validProb,type Prediction,type Fit} from './contracts-v1';
import {poissonNll,deviance} from './numerics-v1';
export type ScoredRow={fixtureId:number;prediction:Prediction;homeGoals:number;awayGoals:number};
const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
export function metrics(rows:ScoredRow[]){
  const known=rows.filter(r=>r.prediction.status==='PREDICTED');const confusion=Array.from({length:3},()=>[0,0,0]);let loss=0,brier=0,floorHits=0;
  const bins=Array.from({length:3},()=>Array.from({length:10},()=>({n:0,p:0,y:0}))),classBrier=[0,0,0],probSums=[0,0,0];
  for(const r of known){const p=r.prediction.p!;validProb(p);const y=actual(r.homeGoals,r.awayGoals),choice=argmax(p);confusion[y][choice]++;if(p[y]<1e-15)floorHits++;loss-=Math.log(Math.max(p[y],1e-15));for(let k=0;k<3;k++){const d=(p[k]-(y===k?1:0))**2;brier+=d;classBrier[k]+=d;probSums[k]+=p[k];const bin=bins[k][Math.min(9,Math.floor(p[k]*10))];bin.n++;bin.p+=p[k];bin.y+=y===k?1:0;}}
  const n=known.length,classes=CLASSES.map((name,k)=>{const predicted=confusion.reduce((s,r)=>s+r[k],0),actualCount=confusion[k].reduce((a,b)=>a+b,0),correct=confusion[k][k];const calibration=bins[k].map((b,i)=>({lower:i/10,upper:(i+1)/10,count:b.n,meanProbability:b.n?b.p/b.n:null,observedFrequency:b.n?b.y/b.n:null,lowSample:b.n<20}));return {name,predicted,actual:actualCount,correct,recall:actualCount?correct/actualCount:null,precision:predicted?correct/predicted:null,share:n?predicted/n:null,brier:n?classBrier[k]/n:null,meanProbability:n?probSums[k]/n:null,meanProbabilityMinusFrequency:n?(probSums[k]-actualCount)/n:null,ece:n?bins[k].reduce((s,b)=>s+(b.n?Math.abs(b.p-b.y)/n:0),0):null,calibration};});
  return {targets:rows.length,predicted:n,pass:rows.filter(r=>r.prediction.status==='PASS').length,fail:rows.filter(r=>r.prediction.status==='FAIL').length,invalid:rows.filter(r=>r.prediction.status==='INVALID').length,coverage:rows.length?n/rows.length:null,logLoss:n?loss/n:null,brier:n?brier/n:null,accuracy:n?confusion.reduce((s,r,k)=>s+r[k],0)/n:null,floorHits,classes,confusion,reasonCounts:Object.fromEntries([...new Set(rows.flatMap(r=>r.prediction.reasons))].map(reason=>[reason,rows.filter(r=>r.prediction.reasons.includes(reason)).length]))};
}
export function developmentScreen(fit:Fit<unknown>,rows:ScoredRow[]){if(fit.status==='INVALID'||rows.some(r=>r.prediction.status==='INVALID'))return 'INVALID';if(fit.status==='FAIL'||rows.some(r=>r.prediction.status==='FAIL'))return 'FAIL';if(fit.status==='PASS')return 'INSUFFICIENT';return 'PASS';}
export function compare(hypothesis:'H1'|'H2'|'H3',reference:ScoredRow[],candidate:ScoredRow[]){
  const map=new Map(candidate.map(r=>[r.fixtureId,r])),pairedBase=reference.filter(r=>r.prediction.status==='PREDICTED'),complete=pairedBase.every(r=>map.get(r.fixtureId)?.prediction.status==='PREDICTED');
  const base=metrics(pairedBase);if(!complete||!pairedBase.length)return {pairedComplete:complete,pairedCount:pairedBase.length,baseline:base,candidate:null,mechanismStatus:'INSUFFICIENT',diagnostics:null};
  const paired=pairedBase.map(r=>map.get(r.fixtureId)!),cand=metrics(paired);let supported=false;let diagnostics:Record<string,unknown>={};
  if(hypothesis==='H1'){
    const rawSum=[0,0,0,0],newSum=[0,0,0,0],observed=[0,0,0,0],lossDeltas:number[]=[];
    for(let i=0;i<paired.length;i++){const r=paired[i],baseRow=pairedBase[i],d=r.prediction.details;const old=d.rawCells as number[],next=d.correctedCells as number[];for(let c=0;c<4;c++){rawSum[c]+=old[c];newSum[c]+=next[c];}if(r.homeGoals<2&&r.awayGoals<2)observed[2*r.homeGoals+r.awayGoals]++;
      const [h,a]=baseRow.prediction.rates!,rho=d.rho as number;const factor=r.homeGoals===0&&r.awayGoals===0?1-h*a*rho:r.homeGoals===0&&r.awayGoals===1?1+h*rho:r.homeGoals===1&&r.awayGoals===0?1+a*rho:r.homeGoals===1&&r.awayGoals===1?1-rho:1;
      lossDeltas.push(-Math.log(factor));
    }
    const n=paired.length,rawResidual=rawSum.reduce((s,v,k)=>s+Math.abs(v-observed[k])/n,0),newResidual=newSum.reduce((s,v,k)=>s+Math.abs(v-observed[k])/n,0),jointNllDelta=mean(lossDeltas)!;
    const baselineJointNll=mean(pairedBase.map(r=>poissonNll(r.homeGoals,r.prediction.rates![0])+poissonNll(r.awayGoals,r.prediction.rates![1])))!;
    diagnostics={cellOrder:['00','01','10','11'],cells:rawSum.map((v,k)=>({baseline:v/n,candidate:newSum[k]/n,observed:observed[k]/n})),rawLowMass:rawSum.reduce((a,b)=>a+b,0)/n,correctedLowMass:newSum.reduce((a,b)=>a+b,0)/n,rawLowDrawMass:(rawSum[0]+rawSum[3])/n,correctedLowDrawMass:(newSum[0]+newSum[3])/n,observedLowDrawShare:(observed[0]+observed[3])/n,baselineJointNll,candidateJointNll:baselineJointNll+jointNllDelta,jointNllDelta,rawResidual,newResidual,residualDelta:newResidual-rawResidual};supported=jointNllDelta< -1e-12&&newResidual-rawResidual< -1e-12;
  }else if(hypothesis==='H2'){
    const sides=[0,1].map(side=>{const goals=(r:ScoredRow)=>side===0?r.homeGoals:r.awayGoals;const baseDev=mean(pairedBase.map(r=>deviance(goals(r),r.prediction.rates![side])))!,newDev=mean(paired.map(r=>deviance(goals(r),r.prediction.rates![side])))!;return {baselineDeviance:baseDev,candidateDeviance:newDev,devianceDelta:newDev-baseDev,baselineBias:mean(pairedBase.map(r=>r.prediction.rates![side]-goals(r))),candidateBias:mean(paired.map(r=>r.prediction.rates![side]-goals(r))),baselineMae:mean(pairedBase.map(r=>Math.abs(r.prediction.rates![side]-goals(r)))),candidateMae:mean(paired.map(r=>Math.abs(r.prediction.rates![side]-goals(r))))};});
    const totals=paired.map(r=>r.prediction.rates![0]+r.prediction.rates![1]).sort((a,b)=>a-b),mid=(totals.length-1)/2;
    diagnostics={home:sides[0],away:sides[1],sumRate:{min:totals[0],median:(totals[Math.floor(mid)]+totals[Math.ceil(mid)])/2,max:totals.at(-1)}};supported=sides.every(s=>s.devianceDelta< -1e-12);
  }else{const deltas=cand.classes.map((c,k)=>c.ece!-base.classes[k].ece!),changed=paired.filter((r,i)=>argmax(r.prediction.p!)!==argmax(pairedBase[i].prediction.p!)).length;diagnostics={eceDeltas:deltas,argmaxChanges:changed,logLossDelta:cand.logLoss!-base.logLoss!,brierDelta:cand.brier!-base.brier!};supported=deltas.every(d=>d<=1e-12)&&deltas.some(d=>d< -1e-12)&&cand.logLoss!-base.logLoss!< -1e-12;}
  return {pairedComplete:true,pairedCount:paired.length,baseline:base,candidate:cand,mechanismStatus:supported?'SUPPORTED':'NOT_SUPPORTED',diagnostics};
}
