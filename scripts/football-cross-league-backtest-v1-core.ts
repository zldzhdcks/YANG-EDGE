/** Isolated external orchestration; frozen EPL prediction/scoring implementation is reused unchanged. */
import assert from 'node:assert/strict';
import {predictOne,targetMetadata,eligibleHistory,score,classification,sha,canonical,type Match,type Protocol,type Outcome,type Prob} from './football-poisson-backtest-v1-core';
import {scope} from './football-cross-league-scope-v1';
export const CROSS_SHA='6bedb86389f62afae5feebdd098b9ab6d4b2c151719ef267309d562f8df3e31f';
export const BASE_SHA='f7cd4fc5d7b809536173add181230f7b9a86e094';
export type ExternalSpec={leagueId:number;name:string;archiveSha256:string;archiveCanonical:number;primarySeason:number;contextSeasons:number[];regularSeasonCohort:number;primaryTargets:number;outOfScopeStage:number;scopeMetadataSha256:string};
export type CrossProtocol=Omit<Protocol,'archiveSha256'|'dataContract'>&{externalLeagues:ExternalSpec[];eplReference:{archiveSha256:string;resultSha256:string};parentProtocol:{sha256:string};scope:{evidenceAuditCanonicalSha256:string}};
export type ScopedMatch=Match&{round:string};
export function verifyCross(text:string):CrossProtocol {const p=JSON.parse(text);assert.equal(sha(canonical(p)),CROSS_SHA,'PROTOCOL_HASH_MISMATCH');return p;}
export function leagueProtocol(p:CrossProtocol,spec:ExternalSpec):Protocol {
  return {...p,archiveSha256:spec.archiveSha256,dataContract:{provider:'API_FOOTBALL',leagueId:spec.leagueId,primarySeason:spec.primarySeason,contextSeasons:spec.contextSeasons,archiveMatchCount:spec.regularSeasonCohort,targetMatchCount:spec.primaryTargets}};
}
export function selectRegular(rows:ScopedMatch[],spec:ExternalSpec) {
  // Fail on mixed input rather than silently mixing or borrowing any other league.
  assert.ok(rows.every(r=>r.leagueId===spec.leagueId),'CROSS_LEAGUE_INPUT');
  const selected=rows.filter(r=>scope(r)==='IN_SCOPE');
  assert.equal(selected.length,spec.regularSeasonCohort,'SCOPE_COUNT_MISMATCH');
  for(const season of spec.contextSeasons)assert.equal(selected.filter(r=>r.season===season).length,spec.primaryTargets,'SEASON_COUNT_MISMATCH');
  return selected;
}
export function validateRegular(rows:ScopedMatch[],spec:ExternalSpec) {
  const ids=new Set<number>();
  for(const r of rows){
    assert.equal(r.leagueId,spec.leagueId);assert.equal(r.leagueName,spec.name);assert.equal(r.provider,'API_FOOTBALL');assert.equal(scope(r),'IN_SCOPE');
    assert.ok(Number.isSafeInteger(r.providerFixtureId)&&r.providerFixtureId>0&&!ids.has(r.providerFixtureId));ids.add(r.providerFixtureId);
    assert.equal(new Date(r.kickoffUtc).toISOString(),r.kickoffUtc);assert.equal(r.fixtureStatus,'FT');
    assert.ok([r.fullTimeHomeGoals,r.fullTimeAwayGoals].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=100));assert.notEqual(r.homeTeamId,r.awayTeamId);
    for(const [id,name] of [[r.homeTeamId,r.homeTeamName],[r.awayTeamId,r.awayTeamName]] as const)assert.ok(Number.isSafeInteger(id)&&id>0&&typeof name==='string'&&name.trim());
    assert.equal(r.strictReplayEligible,false);assert.equal(r.resultCompletedAt,null);assert.equal(r.strictAsOfProvenance,'UNAVAILABLE');assert.ok(!('resultObservedAt' in r)&&!('observedAt' in r));
  }
  for(const season of spec.contextSeasons){const rs=rows.filter(r=>r.season===season);assert.equal(new Set(rs.flatMap(r=>[r.homeTeamId,r.awayTeamId])).size,spec.leagueId===78?18:20);assert.equal(new Set(rs.map(r=>`${r.homeTeamId}:${r.awayTeamId}`)).size,spec.primaryTargets);}
}
export function nameVariants(rows:ScopedMatch[]){
  const names=new Map<number,Set<string>>();
  for(const r of rows)for(const [id,name] of [[r.homeTeamId,r.homeTeamName],[r.awayTeamId,r.awayTeamName]] as const){const set=names.get(id)??new Set<string>();set.add(name);names.set(id,set);}
  return [...names].filter(([,values])=>values.size>1).sort((a,b)=>a[0]-b[0]).map(([providerTeamId,values])=>({providerTeamId,providerNames:[...values].sort(),identityPolicy:'Exact provider team ID; names preserved, no fuzzy matching or alias rewrite'}));
}
const actualClass=(h:number,a:number):Outcome=>h>a?'HOME':h===a?'DRAW':'AWAY';
export function executeLeague(rows:ScopedMatch[],spec:ExternalSpec,p:CrossProtocol,persist:(text:string)=>string,predictor?:Parameters<typeof predictOne>[3]) {
  const regular=selectRegular(rows,spec),lp=leagueProtocol(p,spec),targets=targetMetadata(regular,lp);
  const predictions=[];
  for(let start=0;start<targets.length;){
    let end=start+1;while(end<targets.length&&targets[end].kickoffUtc===targets[start].kickoffUtc)end++;
    const history=eligibleHistory(regular,targets[start],lp) as ScopedMatch[];
    assert.ok(history.every(r=>r.leagueId===spec.leagueId&&scope(r)==='IN_SCOPE'),'INVALID_TRAINING_SCOPE');
    // Freeze copies; do not mutate the source archive objects.
    const immutable=history.map(r=>Object.freeze({...r}));Object.freeze(immutable);
    for(const target of targets.slice(start,end)){
      const prediction=predictOne(target,immutable,lp,predictor);
      // Replace only EPL-specific provenance identifiers, never calculated model values.
      predictions.push({...prediction,leagueId:spec.leagueId,season:spec.primarySeason,archiveSha256:spec.archiveSha256,protocolSha256:CROSS_SHA,scopeDecision:'IN_SCOPE'});
    }
    start=end;
  }
  const bytes=JSON.stringify(predictions,null,2)+'\n',saved=persist(bytes);assert.equal(sha(saved),sha(bytes),'PREDICTION_PERSISTENCE_MISMATCH');
  const frozen:typeof predictions=JSON.parse(saved),labels=new Map(regular.map(r=>[r.providerFixtureId,r]));
  const records=frozen.map(r=>{const actual=labels.get(r.providerFixtureId)!;assert.ok(actual);const outcome=actualClass(actual.fullTimeHomeGoals,actual.fullTimeAwayGoals);return {...r,actualHomeGoals:actual.fullTimeHomeGoals,actualAwayGoals:actual.fullTimeAwayGoals,actualClass:outcome,correct1X2:r.status==='PASS'?null:r.predictedClass===outcome};});
  const cohort=records.filter(r=>r.status==='PREDICTED');
  const poisson=score(cohort.map(r=>({probabilities:[r.pHome!,r.pDraw!,r.pAway!] as Prob,actualClass:r.actualClass})),lp);
  const comparator=score(cohort.map(r=>{assert.ok(r.comparatorProbabilities);return {probabilities:r.comparatorProbabilities,actualClass:r.actualClass};}),lp);
  assert.equal(comparator.count,poisson.count);
  return {leagueId:spec.leagueId,league:spec.name,archiveSha256:spec.archiveSha256,protocolSha256:CROSS_SHA,
    summary:{TOTAL_TARGET_MATCHES:targets.length,PREDICTED_MATCHES:cohort.length,PASS_MATCHES:targets.length-cohort.length,COVERAGE:cohort.length/targets.length,BACKTEST_CLASSIFICATION:classification(cohort.length,poisson.classMetrics.map(r=>r.actual),lp),VALIDATED_MODEL:false},
    poisson,comparator:{name:'ELIGIBLE_HISTORY_EMPIRICAL_1X2',...comparator},records,pairedFixtureIds:cohort.map(r=>r.providerFixtureId),predictionSha256:sha(saved)};
}
export type LeagueResult=ReturnType<typeof executeLeague>;
export type LeagueSummary=Omit<LeagueResult,'records'|'pairedFixtureIds'|'predictionSha256'|'archiveSha256'|'protocolSha256'>;
export function overall(results:{summary:{BACKTEST_CLASSIFICATION:string}}[]) {
  if(results.some(r=>r.summary.BACKTEST_CLASSIFICATION==='INVALID'))return 'INVALID';
  return results.length===4&&results.every(r=>r.summary.BACKTEST_CLASSIFICATION==='BASELINE_MEASURED')?'ALL_BASELINES_MEASURED':'PARTIAL_BASELINE';
}
export function comparison(results:LeagueSummary[]) {
  return results.map(r=>({League:r.league,Targets:r.summary.TOTAL_TARGET_MATCHES,Predicted:r.summary.PREDICTED_MATCHES,PASS:r.summary.PASS_MATCHES,Coverage:r.summary.COVERAGE,
    Accuracy:r.poisson.accuracy,LogLoss:r.poisson.logLoss,Brier:r.poisson.brier,DrawPredicted:r.poisson.classMetrics[1].predicted,DrawActual:r.poisson.classMetrics[1].actual,DrawRecall:r.poisson.drawRecall,
    ComparatorAccuracy:r.comparator.accuracy,ComparatorLogLoss:r.comparator.logLoss,ComparatorBrier:r.comparator.brier,Classification:r.summary.BACKTEST_CLASSIFICATION}));
}
export function questionEvidence(results:LeagueSummary[]) {
  return {Q1:{question:'Accuracy reproduction relative to EPL, descriptively only',values:results.map(r=>({league:r.league,accuracy:r.poisson.accuracy,predicted:r.summary.PREDICTED_MATCHES})),interpretation:'No preregistered numeric similarity threshold; report values without declaring equivalence.'},
    Q2:{question:'Per-league fixed log loss / Brier versus paired comparator',values:results.map(r=>({league:r.league,poissonLogLoss:r.poisson.logLoss,comparatorLogLoss:r.comparator.logLoss,poissonBrier:r.poisson.brier,comparatorBrier:r.comparator.brier}))},
    Q3:{question:'Does DRAW predicted = 0 recur?',values:results.map(r=>({league:r.league,predicted:r.poisson.classMetrics[1].predicted,actual:r.poisson.classMetrics[1].actual,recall:r.poisson.drawRecall})),allFourZero:results.every(r=>r.poisson.classMetrics[1].predicted===0)},
    Q4:{question:'HOME/DRAW/AWAY calibration differences',values:results.map(r=>({league:r.league,poisson:r.poisson.calibration,comparator:r.comparator.calibration})),interpretation:'All bins retained; descriptive mean probability versus observed frequency only, no significance claim.'},
    Q5:{question:'Coverage/PASS differences',values:results.map(r=>({league:r.league,coverage:r.summary.COVERAGE,pass:r.summary.PASS_MATCHES,targets:r.summary.TOTAL_TARGET_MATCHES}))}};
}
export function report(results:LeagueSummary[],resultHash:string,crossStatus:string) {
  const table=comparison(results),fmt=(n:unknown)=>typeof n==='number'?Number.isInteger(n)?String(n):n.toFixed(6):String(n);
  const keys=Object.keys(table[0]);
  let text='# Football Poisson cross-league baseline V1\n\nIndependent league results; EPL is the previously sealed reference and was not rerun. No pooled accuracy or automatic model promotion.\n\n';
  text+='| '+keys.join(' | ')+' |\n| '+keys.map(()=>'---').join(' | ')+' |\n'+table.map(r=>'| '+Object.values(r).map(fmt).join(' | ')+' |').join('\n')+'\n\n';
  for(const r of results){text+=`## ${r.league}\n\nClassification: ${r.summary.BACKTEST_CLASSIFICATION}. Probabilities/calibration below use the PREDICTED cohort only.\n\n`;
    text+='| Outcome | Predicted | Actual | Correct |\n| --- | --- | --- | --- |\n'+r.poisson.classMetrics.map(c=>`| ${c.outcome} | ${c.predicted} | ${c.actual} | ${c.correct} |`).join('\n')+'\n\n';
    text+=`Mean pHome/pDraw/pAway: ${fmt(r.poisson.meanPHome)} / ${fmt(r.poisson.meanPDraw)} / ${fmt(r.poisson.meanPAway)}. Confusion rows actual, columns predicted HOME/DRAW/AWAY: ${JSON.stringify(r.poisson.confusionMatrix.values)}.\n\n`;
    text+='| Outcome | Bin | N | Mean predicted | Observed | Low sample |\n| --- | --- | --- | --- | --- | --- |\n'+r.poisson.calibration.map(b=>`| ${b.outcome} | [${b.lower},${b.upper}${b.upperInclusive?']':')'} | ${b.predictionCount} | ${fmt(b.meanPredictedProbability)} | ${fmt(b.observedFrequency)} | ${b.lowSample} |`).join('\n')+'\n\n';
  }
  text+=`CROSS_LEAGUE_STATUS=${crossStatus}; VALIDATED_MODEL=NO.\n\nALL_4_LEAGUES_DRAW_PREDICTED_ZERO=${results.every(r=>r.poisson.classMetrics[1].predicted===0)?'YES':'NO'}.\n\nResult SHA256: ${resultHash}\n\nFull comparator/class/calibration and Q1–Q5 evidence are in the aggregate review seal. Local result includes all prediction records. No engine/weight/minimum/lag changes, odds, provider predictions, network calls, fabricated observations or betting outputs.\n\nSTOP for CTO review. Do not rerun, tune V1, create V2 or merge main.\n`;
  return text;
}
