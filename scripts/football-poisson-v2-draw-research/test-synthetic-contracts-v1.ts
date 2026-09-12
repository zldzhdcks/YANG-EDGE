import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {fitDependence,predictDependence,dependenceObjective,tau,RHO_LOWER,RHO_UPPER} from './h1-dixon-coles-v1';
import {fitRates,initialize,center,objectiveGradient,predictRates,rates} from './h2-ridge-rates-v1';
import {temperature,fitTemperature,calibrationObjective} from './h3-temperature-v1';
import {joint,bisectDerivative} from './numerics-v1';
import {baseline} from './v1-readonly-adapter';
import {metrics,compare,developmentScreen} from './evaluator-v1';
import {extractDevelopment} from './run-development-v1';
import {digest,sha,PROTOCOL_HASH,DESIGN_HASH,MODEL_HASH,DAY,eligible,validateHistory,validProb,predictSafely,actual,ResearchError,type Match,type Target,type Prob,type Prediction} from './contracts-v1';
const close=(a:number,b:number,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
const T=Date.parse('2023-12-20T12:00:00.000Z');
const target:Target={fixtureId:999,leagueId:39,season:2023,kickoffUtc:new Date(T).toISOString(),homeTeamId:1,awayTeamId:2};
const history=():Match[]=>Array.from({length:60},(_,i)=>({fixtureId:i+1,leagueId:39,season:2023,kickoffUtc:new Date(T-(i+3)*DAY).toISOString(),homeTeamId:i%2?2:1,awayTeamId:i%2?1:2,homeGoals:i%3===0?0:2,awayGoals:i%4===0?0:1})).sort((a,b)=>a.kickoffUtc.localeCompare(b.kickoffUtc));
const dep=()=>Array.from({length:60},(_,i)=>({lambda:1.4,mu:1.1,x:i%4<2?0:1,y:i%2}));
const cal=()=>Array.from({length:60},(_,i)=>({p:[0.6,0.25,0.15] as Prob,actual:i%3}));
test('frozen documents and model hashes, required imports, and market/network firewall',()=>{
  const root=fileURLToPath(new URL('../../',import.meta.url));
  assert.equal(digest(JSON.parse(readFileSync(join(root,'docs/FOOTBALL_POISSON_V2_DRAW_RESEARCH_PROTOCOL_V1.json'),'utf8'))),PROTOCOL_HASH);
  assert.equal(digest(JSON.parse(readFileSync(join(root,'docs/FOOTBALL_POISSON_V2_ALGORITHM_DESIGN_FREEZE_V1.json'),'utf8'))),DESIGN_HASH);
  assert.equal(sha(readFileSync(join(root,'src/lib/football/poisson-research-v1/index.ts'),'utf8').replace(/\r\n/g,'\n')),MODEL_HASH);
  const dir=fileURLToPath(new URL('./',import.meta.url));for(const f of readdirSync(dir).filter(f=>f.endsWith('.ts')&&!f.startsWith('test-'))){const source=readFileSync(join(dir,f),'utf8');const imports=[...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);assert.ok(imports.every(i=>!i.includes('forward')&&!i.includes('market')&&!i.includes('provider')));assert.ok(!/\bfetch\s*\(/.test(source));if(/^h[123]-/.test(f))assert.ok(imports.every(i=>!/^\.\/h[123]-/.test(i)));}
});
test('H1 rho=0 matches independent and frozen v1 probabilities',()=>{const b=baseline(target,history());assert.equal(b.status,'PREDICTED');const p=predictDependence(...b.rates!,0).p;for(let k=0;k<3;k++)close(p[k],b.p![k],1e-12);});
test('H1 four-cell mass and marginal conservation; global endpoints remain valid',()=>{
  for(const rho of [RHO_LOWER,0,RHO_UPPER])for(const h of [0.01,1.5,10])for(const a of [0.01,1.2,10]){const raw=joint(h,a),q=predictDependence(h,a,rho);validProb(q.p);for(const [x,y] of [[0,0],[0,1],[1,0],[1,1]])assert.ok(tau(x,y,h,a,rho)>0);close(raw.cells.reduce((a,b)=>a+b,0),q.cells.reduce((a,b)=>a+b,0),1e-12);close(raw.cells[0]+raw.cells[1],q.cells[0]+q.cells[1],1e-12);close(raw.cells[0]+raw.cells[2],q.cells[0]+q.cells[2],1e-12);}
});
test('H1 deterministic bisection, gradient, endpoint optimum and insufficiency',()=>{
  const rows=dep(),a=fitDependence(rows);assert.deepEqual(a,fitDependence(rows));assert.equal(a.status,'FITTED');const x=-0.03,epsilon=1e-6;close(dependenceObjective(rows,x).gradient,(dependenceObjective(rows,x+epsilon).objective-dependenceObjective(rows,x-epsilon).objective)/(2*epsilon),1e-8);
  const lows=fitDependence(Array.from({length:30},()=>({lambda:1,mu:1,x:0,y:0})));assert.equal(lows.status,'FITTED');if(lows.status==='FITTED')assert.equal(lows.parameters.rho,RHO_LOWER);
  assert.equal(fitDependence(rows.slice(0,29)).status,'PASS');assert.equal(fitDependence(rows.map(r=>({...r,x:3,y:2}))).status,'PASS');assert.throws(()=>predictDependence(1,1,0.02),/RHO_DOMAIN/);assert.equal(fitDependence([{...rows[0],lambda:NaN}]).status,'FAIL');
});
test('bisection handles interior/boundary and nonfinite failure deterministically',()=>{close(bisectDerivative(x=>x-0.3,-1,1,0).value,0.3,1e-9);assert.equal(bisectDerivative(()=>1,-1,1,0).value,-1);assert.equal(bisectDerivative(()=>-1,-1,1,0).value,1);assert.throws(()=>bisectDerivative(()=>NaN,-1,1,0),/NONFINITE/);});
test('H2 initialization, zero-sum projection, and exact gradient numerical check',()=>{
  const rows=history(),teams=[1,2],initial=initialize(rows,teams);assert.deepEqual(initial,initialize(rows,teams));assert.equal(initial[1],0);const theta=center([0.2,0.1,0.3,0.2,-0.2,0.1],2);close(theta[2]+theta[3],0);close(theta[4]+theta[5],0);
  const state=objectiveGradient(rows,teams,theta);for(let i=0;i<theta.length;i++){const plus=[...theta],minus=[...theta],eps=1e-6;plus[i]+=eps;minus[i]-=eps;close(state.gradient[i],(objectiveGradient(rows,teams,plus).value-objectiveGradient(rows,teams,minus).value)/(2*eps),1e-7);}
});
test('H2 convergence, Armijo acceptance, fresh deterministic fit and target output',()=>{
  const rows=history(),fit=fitRates(rows);assert.equal(fit.status,'FITTED');assert.deepEqual(fit,fitRates([...rows].reverse()));if(fit.status!=='FITTED')return;
  assert.ok((fit.diagnostics.projectedGradientInfinity as number)<=1e-7);for(const t of fit.diagnostics.armijoTrace as {before:number;after:number;alpha:number;normSquared:number}[])assert.ok(t.after<=t.before-1e-4*t.alpha*t.normSquared);
  const [h,a]=predictRates(fit.parameters,target,rows);validProb(joint(h,a).p);assert.throws(()=>rates(fit.parameters,1,3),/UNSEEN_TEAM/);
});
test('H2 sparse, zero-goal and nonfinite/out-of-range rules',()=>{
  assert.equal(fitRates(history().slice(0,29)).status,'PASS');assert.equal(fitRates(history().map(r=>({...r,homeGoals:0}))).status,'PASS');assert.equal(fitRates(history().map(r=>({...r,awayGoals:NaN}))).status,'INVALID');
  assert.throws(()=>rates({teams:[1,2],theta:[1000,0,0,0,0,0]},1,2),/FAIL_NUMERICAL/);assert.throws(()=>rates({teams:[1,2],theta:[3,0,0,0,0,0]},1,2),/OUT_OF_RANGE/);assert.throws(()=>rates({teams:[1,2],theta:[0,0,1,1,0,0]},1,2),/IDENTIFIABILITY/);
});
test('H3 neutral point, normalization, near-zero handling and class symmetry',()=>{
  for(const p of [[0.6,0.3,0.1],[0,0.4,0.6],[1e-300,0.4,0.6]] as Prob[]){const identity=temperature(p,1);for(let k=0;k<3;k++)close(identity[k],p[k],1e-15);for(const beta of [0.05,1,20]){const q=temperature(p,beta);validProb(q);const permutation:[number,number,number]=[2,0,1],permuted=permutation.map(k=>p[k]) as Prob,newQ=temperature(permuted,beta);for(let k=0;k<3;k++)close(newQ[k],q[permutation[k]],1e-15);}}
  assert.equal(temperature([0,0.4,0.6],2)[0],0);assert.throws(()=>temperature([0.4,0.3,0.3],0),/BETA/);assert.throws(()=>temperature([0.4,0.3,0.3],Infinity),/NONFINITE/);
});
test('H3 deterministic fit, convex gradient, exact flat identity, zero support and sample gates',()=>{
  const rows=cal(),fit=fitTemperature(rows);assert.equal(fit.status,'FITTED');assert.deepEqual(fit,fitTemperature(rows));const beta=0.8,eps=1e-6;close(calibrationObjective(rows,beta).gradient,(calibrationObjective(rows,beta+eps).objective-calibrationObjective(rows,beta-eps).objective)/(2*eps),1e-7);
  const flat=fitTemperature(rows.map(r=>({...r,p:[1/3,1/3,1/3]})));assert.equal(flat.status,'FITTED');if(flat.status==='FITTED')assert.equal(flat.parameters.beta,1);
  assert.equal(fitTemperature(rows.map(r=>({...r,p:[0,0.4,0.6]}))).status,'FAIL');assert.equal(fitTemperature(rows.slice(0,29)).status,'PASS');assert.equal(fitTemperature(rows.map(r=>({...r,actual:0}))).status,'PASS');
});
test('no extra market/provider fields enter candidate fit APIs',()=>{
  for(const key of ['odds','market','providerPrediction','ownerShadow']){assert.equal(fitDependence(dep().map(r=>({...r,[key]:1}))).status,'INVALID');assert.equal(fitRates(history().map(r=>({...r,[key]:1}))).status,'INVALID');assert.equal(fitTemperature(cal().map(r=>({...r,[key]:1}))).status,'INVALID');}
});
test('temporal/season/league firewall and target results excluded from history',()=>{
  const rows=history();assert.throws(()=>baseline({...target,season:2024},rows),/EVALUATION/);assert.throws(()=>validateHistory(target,[{...rows[0],leagueId:140}]),/LEAKAGE/);
  const future={...rows[0],fixtureId:200,kickoffUtc:new Date(T-DAY).toISOString()};Object.defineProperty(future,'homeGoals',{get(){throw Error('FUTURE_RESULT_READ');}});assert.equal(eligible([...rows,future],target).length,rows.length);
  const self={...rows[0],...target};Object.defineProperty(self,'homeGoals',{get(){throw Error('TARGET_RESULT_READ');}});assert.equal(eligible([...rows,self],target).length,rows.length);
});
test('archive projection never reads evaluation score properties',()=>{
  const evaluation={season:2024,get fullTimeHomeGoals():never{throw Error('EVALUATION_READ');},get fullTimeAwayGoals():never{throw Error('EVALUATION_READ');}};
  assert.deepEqual(extractDevelopment({matches:[evaluation]} as never,39),[]);
});
test('metrics definitions and DEVELOPMENT_SCREEN are independent of performance and row PASS',()=>{
  const prediction:Prediction={status:'PREDICTED',reasons:[],p:[0.1,0.8,0.1],rates:[1,1],details:{}};const row={fixtureId:1,prediction,homeGoals:2,awayGoals:0},passRow={...row,fixtureId:2,prediction:{...prediction,status:'PASS' as const,p:null,reasons:['PASS_INSUFFICIENT_HOME_HISTORY']}};
  const m=metrics([row,passRow]);close(m.logLoss!,-Math.log(0.1));close(m.brier!,0.9**2+0.8**2+0.1**2);assert.equal(m.accuracy,0);assert.equal(m.classes[1].precision,0);assert.equal(m.classes[1].recall,null);
  assert.equal(developmentScreen({status:'FITTED',parameters:{},diagnostics:{}},[row,passRow]),'PASS');assert.equal(developmentScreen({status:'PASS',parameters:null,reasons:['PASS_INSUFFICIENT_FIT'],diagnostics:{}},[passRow]),'INSUFFICIENT');assert.equal(developmentScreen({status:'FAIL',parameters:null,reasons:['FAIL_OPTIMIZER'],diagnostics:{}},[row]),'FAIL');
  assert.equal(developmentScreen({status:'FAIL',parameters:null,reasons:[],diagnostics:{}},[{...row,prediction:{...prediction,status:'INVALID'}}]),'INVALID');
  assert.equal(compare('H3',[row],[passRow]).mechanismStatus,'INSUFFICIENT');assert.equal(predictSafely(()=>{throw new ResearchError('FAIL','FAIL_NUMERICAL');}).status,'FAIL');assert.equal(actual(0,0),1);
});
