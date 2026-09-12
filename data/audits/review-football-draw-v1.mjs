// Descriptive review only: reads sealed outputs; no model import, inference, fitting or network.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sources=['data/audits/football-poisson-chronological-backtest-v1.json','data/audits/football-poisson-cross-league-backtest-v1.json'].map(p=>{
  const seal=read(p),bytes=fs.readFileSync(seal.localResultRelativePath);assert.equal(hash(bytes),seal.resultSha256);
  return {sealPath:p,path:seal.localResultRelativePath,sha256:hash(bytes),value:JSON.parse(bytes)};
});
const modelPath='src/lib/football/poisson-research-v1/index.ts';
const modelSourceSha256=hash(fs.readFileSync(modelPath,'utf8').replace(/\r\n/g,'\n'));
assert.equal(modelSourceSha256,sources[1].value.codeHashes[modelPath]);
const q=(v,p)=>{const a=[...v].sort((a,b)=>a-b),i=(a.length-1)*p,l=Math.floor(i);return a.length?a[l]+(a[Math.ceil(i)]-a[l])*(i-l):null;};
const stats=v=>({n:v.length,min:q(v,0),p10:q(v,.1),p25:q(v,.25),median:q(v,.5),p75:q(v,.75),p90:q(v,.9),max:q(v,1),mean:v.length?v.reduce((a,b)=>a+b,0)/v.length:null});
assert.equal(q([3,1,2],.25),1.5);
const profile=r=>({fixtureId:r.providerFixtureId,kickoffUtc:r.kickoffUtc,homeTeam:r.homeTeam,awayTeam:r.awayTeam,pHome:r.pHome,pDraw:r.pDraw,pAway:r.pAway,margin:Math.max(r.pHome,r.pAway)-r.pDraw,predictedClass:r.predictedClass,actualClass:r.actualClass,actualScore:[r.actualHomeGoals,r.actualAwayGoals],trainingMatchCount:r.trainingMatchCount,homeRelevantSampleCount:r.homeRelevantSampleCount,awayRelevantSampleCount:r.awayRelevantSampleCount});
const leagues=[{...sources[0].value,league:'EPL',leagueId:39},...sources[1].value.leagueResults].map(l=>{
  const rows=l.records,p=rows.filter(r=>r.status==='PREDICTED'),d=p.filter(r=>r.actualClass==='DRAW');
  assert.equal(rows.length,l.summary.TOTAL_TARGET_MATCHES);assert.equal(p.length,l.summary.PREDICTED_MATCHES);
  assert.equal(new Set(rows.map(r=>r.providerFixtureId)).size,rows.length);
  for(const r of p){assert.ok([r.pHome,r.pDraw,r.pAway].every(x=>Number.isFinite(x)&&x>=0&&x<=1));assert.ok(Math.abs(r.pHome+r.pDraw+r.pAway-1)<1e-12);assert.equal(['HOME','DRAW','AWAY'][[r.pHome,r.pDraw,r.pAway].indexOf(Math.max(r.pHome,r.pDraw,r.pAway))],r.predictedClass);assert.ok(Math.abs((1-3*r.pDraw+Math.abs(r.pHome-r.pAway))/2-(Math.max(r.pHome,r.pAway)-r.pDraw))<1e-12);}
  for(const r of rows.filter(r=>r.status==='PASS'))assert.equal(r.pDraw,null);
  const drawPred=p.filter(r=>r.predictedClass==='DRAW');assert.equal(drawPred.length,l.poisson.classMetrics.find(c=>c.outcome==='DRAW').predicted);assert.equal(d.length,l.poisson.classMetrics.find(c=>c.outcome==='DRAW').actual);
  assert.equal(p.filter(r=>r.pDraw===Math.max(r.pHome,r.pAway)).length,0,'DRAW_ARGMAX_TIE');
  const calibration=l.poisson.calibration.filter(b=>b.outcome==='DRAW');
  for(const b of calibration){const bin=p.filter(r=>r.pDraw>=b.lower&&(r.pDraw<b.upper||(b.upperInclusive&&r.pDraw===b.upper)));assert.equal(bin.length,b.predictionCount);if(bin.length){assert.ok(Math.abs(stats(bin.map(r=>r.pDraw)).mean-b.meanPredictedProbability)<1e-12);assert.ok(Math.abs(bin.filter(r=>r.actualClass==='DRAW').length/bin.length-b.observedFrequency)<1e-12);}}
  return {league:l.league,leagueId:l.leagueId,targets:rows.length,predicted:p.length,pass:rows.length-p.length,actualDraws:d.length,passActualDraws:rows.filter(r=>r.status==='PASS'&&r.actualClass==='DRAW').length,drawPredicted:drawPred.length,drawCorrect:drawPred.filter(r=>r.actualClass==='DRAW').length,
    pDraw:stats(p.map(r=>r.pDraw)),actualDrawPDraw:stats(d.map(r=>r.pDraw)),pHome:stats(p.map(r=>r.pHome)),pAway:stats(p.map(r=>r.pAway)),homeAwayImbalance:stats(p.map(r=>Math.abs(r.pHome-r.pAway))),margin:stats(p.map(r=>Math.max(r.pHome,r.pAway)-r.pDraw)),actualDrawMargin:stats(d.map(r=>Math.max(r.pHome,r.pAway)-r.pDraw)),
    belowOneThird:p.filter(r=>r.pDraw<1/3).length,atLeastOneThirdButNotArgmax:p.filter(r=>r.pDraw>=1/3&&r.predictedClass!=='DRAW').length,actualDrawArgmax:Object.fromEntries(['HOME','DRAW','AWAY'].map(c=>[c,d.filter(r=>r.predictedClass===c).length])),
    calibration,observedDrawRate:d.length/p.length,drawFrequencyMinusMeanProbability:d.length/p.length-stats(p.map(r=>r.pDraw)).mean,
    drawECE:calibration.reduce((s,b)=>s+(b.predictionCount?b.predictionCount*Math.abs(b.meanPredictedProbability-b.observedFrequency):0),0)/p.length,
    trainingMatches:stats(p.map(r=>r.trainingMatchCount)),homeSamples:stats(p.map(r=>r.homeRelevantSampleCount)),awaySamples:stats(p.map(r=>r.awayRelevantSampleCount)),
    drawPredictions:drawPred.map(profile),nearDrawRankingAllPredicted:p.map(profile).sort((a,b)=>a.margin-b.margin||a.fixtureId-b.fixtureId),passFixtureIds:rows.filter(r=>r.status==='PASS').map(r=>r.providerFixtureId)};
});
for(const s of sources)assert.equal(hash(fs.readFileSync(s.path)),s.sha256);
const result={schemaVersion:'FOOTBALL_DRAW_STRUCTURAL_FAILURE_REVIEW_V1',baseSha:'db7f81883da9215d5cc103a3b954fd35cac83409',sources:sources.map(({value,...s})=>s),methodology:{population:'All sealed 2024-season targets; probability diagnostics on PREDICTED only; PASS counts/IDs preserved',quantiles:'Linear interpolation at (n-1)*p',margin:'max(pHome,pAway)-pDraw, probability units',nearDraw:'All predictions ranked by signed margin; no decision threshold, no alternate prediction',calibration:'Original sealed 0.1 bins, verified from stored probabilities/labels; ECE descriptive only, not a new model performance experiment',expectedGoals:'Not serialized in sealed records; not reconstructed; no rate attribution or ablation performed'},leagues,conclusion:{DRAW_FAILURE_TYPE:'ARGMAX_COMPETITION',V2_RESEARCH_JUSTIFIED:true,V2_IMPLEMENTED:false},governance:{BACKTEST_RERUN:false,ENGINE_CHANGED:false,WEIGHTS_CHANGED:false,THRESHOLD_CHANGED:false,ODDS_USED:false,FORWARD_CHANGED:false,MODEL_CALLS:0,NETWORK_CALLS:0,SEALED_RESULT_HASH_UNCHANGED:true}};
result.rootCauses=[
 {id:'A',candidate:'Independent Poisson scoring',verdict:'PARTIALLY_SUPPORTED',evidence:'Source multiplies marginal goal PMFs, with no joint dependence parameter. Sealed probabilities rarely put DRAW first. Attribution versus alternative dependence models is not tested.'},
 {id:'B',candidate:'Home/away expected-goal formula',verdict:'PARTIALLY_SUPPORTED',evidence:'Source uses products of shrunk venue attack/defence rates divided by league rates. Probability imbalance is observed; per-fixture expectedGoals are not sealed, so rate bias and causal responsibility are not established.'},
 {id:'C',candidate:'Prior shrinkage',verdict:'NOT_TESTED',evidence:'Fixed priorMatches=5 exists, but no unshrunk rates or ablation are available in the sealed outputs. Direction and magnitude of its effect on DRAW are unidentified.'},
 {id:'D',candidate:'League-level goal-rate structure',verdict:'NOT_TESTED',evidence:'League home/away rate anchors exist in source. Different league pDraw distributions do not identify league-rate bias; neither rate reconstruction nor counterfactual was run.'},
 {id:'E',candidate:'Argmax competition',verdict:'SUPPORTED',evidence:'1320/1342 predictions have pDraw<1/3; 17 further predictions above that level lose to HOME/AWAY. All saved classes match frozen argmax. This is class-competition behavior, not a tie-break or implementation defect.'},
 {id:'F',candidate:'Calibration failure',verdict:'PARTIALLY_SUPPORTED',evidence:'Descriptive draw underestimation and bin errors exist, but no independent calibration validation or uncertainty-aware causal attribution. Near-zero class counts do not prove probability miscalibration.'},
 {id:'G',candidate:'Missing draw/low-score dependency',verdict:'PARTIALLY_SUPPORTED',evidence:'No draw-specific dependence term in source. Whether residual dependence actually explains errors cannot be tested from sealed 1X2 probabilities alone; score-cell predictive masses are missing.'},
 {id:'H',candidate:'Structure rather than insufficient data',verdict:'PARTIALLY_SUPPORTED',evidence:'All PREDICTED rows passed fixed sample gates; minimum competition histories 362/365/366/289, typical venue samples 16–19. This excludes universal sample-gate failure, not finite-sample uncertainty, selection bias or missing information.'}
];
result.modelSourceSha256=modelSourceSha256;
result.hypotheses=[
 {HYPOTHESIS_ID:'DRAW-H1',MECHANISM:'Explicit low-score joint dependence may correct diagonal probability mass beyond independent marginals.',WHY_SUPPORTED:'Independence is confirmed in code; DRAW frequency residuals motivate diagnosis, not proof of this mechanism.',WHAT_DATA_NEEDED:'Chronologically available full-time scores, frozen marginal goal rates and full score-grid predictive masses; independently held-out seasons.',EXPECTED_EFFECT:'Potentially improve joint-score and DRAW probability fit; direction and argmax recall gain not guaranteed.',FAILURE_RISK:'Dependence may be absent or unstable; may damage non-draw probabilities and does not automatically explain 2–2 draws.',BACKTEST_REQUIREMENT:'Preregister parameter estimation using training only, untouched temporal holdout, frozen v1 comparator, full cohort/PASS preservation and joint-score plus multiclass probability evaluation.'},
 {HYPOTHESIS_ID:'DRAW-H2',MECHANISM:'A separately specified goal-rate estimation model may better represent low-total, balanced fixtures.',WHY_SUPPORTED:'Venue shrinkage and league-rate products constrain current rates; observed class competition warrants inspecting those constraints. Existing evidence does not establish that rates are too high.',WHAT_DATA_NEEDED:'Training-only venue attack/defence components, rate estimates, uncertainty and sample sizes; sealed future or untouched historical score outcomes.',EXPECTED_EFFECT:'If rates are biased, improved marginal rates may improve DRAW and other classes together; no required direction.',FAILURE_RISK:'Sparse venue estimates, overfitting or erroneous reduction of rates to chase draw recall.',BACKTEST_REQUIREMENT:'Freeze specification and estimation before evaluation; isolate this change from dependence/calibration; same chronological cutoffs and fixed evaluation population; no league weights chosen from these results.'},
 {HYPOTHESIS_ID:'DRAW-H3',MECHANISM:'A preregistered multiclass probability calibration study may address systematic probability errors while retaining argmax.',WHY_SUPPORTED:'Observed versus predicted draw frequencies differ, with La Liga bin cancellation and Bundesliga low-bin residuals. This is exploratory evidence only.',WHAT_DATA_NEEDED:'Disjoint temporal calibration and final evaluation sets of probability vectors and outcomes, adequate class/bin counts.',EXPECTED_EFFECT:'Potentially better reliability/log loss; DRAW selection can remain rare even after successful calibration.',FAILURE_RISK:'Leakage, small-bin noise, loss of resolution or apparent gains on the already reviewed season.',BACKTEST_REQUIREMENT:'Fit only within training/calibration time windows, lock transformations before untouched holdout; preserve normalization, compare all classes and keep recall secondary; no arbitrary draw offset/multiplier/threshold.'}
];
fs.writeFileSync('data/audits/football-draw-structural-failure-review-v1.json',JSON.stringify(result,null,2)+'\n');
const pct=x=>(x*100).toFixed(2),dist=s=>`min ${pct(s.min)}, P10 ${pct(s.p10)}, P25 ${pct(s.p25)}, median ${pct(s.median)}, P75 ${pct(s.p75)}, P90 ${pct(s.p90)}, max ${pct(s.max)}, mean ${pct(s.mean)}`;
const line=r=>`fixture ${r.fixtureId}, ${r.kickoffUtc.slice(0,10)}, ${r.homeTeam}–${r.awayTeam}: H/D/A ${pct(r.pHome)}/${pct(r.pDraw)}/${pct(r.pAway)}%; margin ${pct(r.margin)}%p; argmax ${r.predictedClass}; actual ${r.actualScore.join('–')} (${r.actualClass}); training ${r.trainingMatchCount}, venue ${r.homeRelevantSampleCount}/${r.awayRelevantSampleCount}`;
const md=`# FOOTBALL_DRAW_STRUCTURAL_FAILURE_REVIEW_V1

BASE_SHA: db7f81883da9215d5cc103a3b954fd35cac83409

## 판정

DRAW_FAILURE_TYPE = ARGMAX_COMPETITION. V2_RESEARCH_JUSTIFIED = YES. V2_IMPLEMENTED = NO.

가장 직접적으로 입증된 원인은 확률 간 argmax 경쟁이다. 1,342개 PREDICTED 중 1,320개(98.36%)는 pDraw < 1/3이다. 나머지 22개 중 17개도 더 높은 HOME/AWAY 확률에 밀렸고 5개만 DRAW였다. 실제 DRAW 348개 중 맞힌 것은 2개다. 이것은 분류 선택의 현상이며, 독립 Poisson이 잘못됐다는 인과 증명이나 argmax 구현 오류 판정은 아니다. Calibration 오차도 관측되지만 그것이 주원인이라는 증거는 부족하다. 이 판정은 calibration 문제가 없다는 뜻이 아니다.

## Frozen evidence와 모집단

기존 2024/25 sealed result만 읽었다. 전체 target 1,446개 = PREDICTED 1,342 + PASS 104. 확률이 없는 PASS를 계산 가능 표본인 것처럼 채우지 않았다. 모든 PASS 수·fixture ID와 PASS의 실제 DRAW 수도 audit에 보존했다. 요청의 actual DRAW 85/90/99/74는 PREDICTED 모집단 기준이다. 현재 시즌 API, archive 재조회, 모델 재실행, 새 성능 실험은 없다. 코드 열람은 산식과 규칙 확인에만 사용했다. Historical 결과는 기존 retrospective provenance 그대로이며 Forward 관측 증거로 승격하지 않는다.

${sources.map(s=>`- ${s.path}\n  SHA256: ${s.sha256}`).join('\n')}

두 exact-byte hash는 읽기 전 검증하고 집계 후 다시 검증했다. 모델 source hash는 기존 seal의 6efa82f916346599b5e9c6ee4ad768501f7a0d2254dc9d2376acd5df755aadbf이며 모델/Forward 파일은 변경하지 않는다.

## Argmax의 정확한 조건

h+d+a=1에서 m=max(h,a)-d=(1-3d+|h-a|)/2.

DRAW가 최고 확률이려면 d >= (1+|h-a|)/3이어야 한다. 엄격한 1위는 > 조건이다. 따라서 d<1/3이면 불가능하고, d>=1/3이어도 HOME/AWAY 불균형이 크면 불가능하다. 이는 새 threshold 제안이 아니라 기존 argmax를 대수적으로 표현한 것이다. 1,342개 모두 저장 class와 기존 H/D/A 순서 argmax가 일치한다. 동점 처리로 누락된 DRAW는 발견하지 않았다. 실제 DRAW를 더 많이 선택해야 한다는 별도 목적을 정확도 중심 argmax에 사후 주입하지 않았다.

## 리그별 분포

확률 분포 단위는 %, margin은 %p. 분위수는 정렬한 값의 (n−1)p 선형 보간. m>0이면 DRAW가 최상위 승리 class보다 낮고, m<0이면 DRAW가 높다. 아래 near 사례는 작은 양의 margin 순서의 설명용 첫 3개일 뿐이며, 전체 1,342개 순위와 모든 분위수는 audit에 보존했다. near 기준으로 예측 규칙을 생성하지 않았다.

${leagues.map(l=>`### ${l.league}

- Targets ${l.targets}; PREDICTED ${l.predicted}; PASS ${l.pass} (PASS actual DRAW ${l.passActualDraws}). DRAW predicted ${l.drawPredicted}; actual ${l.actualDraws}; correct ${l.drawCorrect}.
- 전체 pDraw: ${dist(l.pDraw)}.
- 전체 pHome: ${dist(l.pHome)}.
- 전체 pAway: ${dist(l.pAway)}.
- |pHome−pAway|: ${dist(l.homeAwayImbalance)}.
- 전체 margin: ${dist(l.margin)}.
- 실제 DRAW에서 pDraw: ${dist(l.actualDrawPDraw)}.
- 실제 DRAW에서 margin: ${dist(l.actualDrawMargin)}.
- 실제 DRAW의 argmax: HOME ${l.actualDrawArgmax.HOME}, DRAW ${l.actualDrawArgmax.DRAW}, AWAY ${l.actualDrawArgmax.AWAY}.
- pDraw<1/3: ${l.belowOneThird}/${l.predicted}; pDraw>=1/3이나 DRAW 미선택: ${l.atLeastOneThirdButNotArgmax}.
- 평균 pDraw ${pct(l.pDraw.mean)}% vs 실제 DRAW 빈도 ${pct(l.observedDrawRate)}%; 실제−예측 ${pct(l.drawFrequencyMinusMeanProbability)}%p. 원래 0.1 calibration bin 기반 ECE ${pct(l.drawECE)}%p.
- Training 표본 min/median/max ${l.trainingMatches.min}/${l.trainingMatches.median}/${l.trainingMatches.max}; home venue ${l.homeSamples.min}/${l.homeSamples.median}/${l.homeSamples.max}; away venue ${l.awaySamples.min}/${l.awaySamples.median}/${l.awaySamples.max}.

기존 DRAW calibration bins (빈 bin도 JSON에 보존):

${l.calibration.filter(b=>b.predictionCount).map(b=>`- [${pct(b.lower)}, ${pct(b.upper)}${b.upperInclusive?']':')'}%: n=${b.predictionCount}, mean ${pct(b.meanPredictedProbability)}%, actual ${pct(b.observedFrequency)}%, lowSample=${b.lowSample}.`).join('\n')}

실제 DRAW 중 DRAW를 선택하지 않은 가장 가까운 3개:

${l.nearDrawRankingAllPredicted.filter(r=>r.actualClass==='DRAW'&&r.predictedClass!=='DRAW').slice(0,3).map(r=>'- '+line(r)).join('\n')}`).join('\n\n')}

## DRAW 예측 5개 전체

${leagues.flatMap(l=>l.drawPredictions.map(r=>'- '+l.league+': '+line(r))).join('\n')}

맞힌 두 경기는 모두 Empoli 홈 경기다. Udinese전은 DRAW의 선두 margin이 0.40%p, Venezia전은 1.18%p에 불과하며 venue sample은 각각 18/18, 18/16이다. 실제 결과는 1–1과 2–2라서 “둘 다 0–0/1–1 특수성으로 설명된다”고 할 수 없다. 같은 Empoli의 Genoa전은 더 높은 pDraw 36.90%와 5.29%p 선두에도 1–2였다. 2건은 독립적인 일반화 증거가 아니며 Empoli 전용 규칙을 만들 근거도 아니다.

## Calibration과 선택 실패의 구분

EPL의 평균 22.00% 대 실제 24.08%, La Liga 25.07% 대 25.57%는 빈도 수준에서 상대적으로 가깝지만, calibration 검증 통과를 뜻하지 않는다. La Liga 30–40% bin은 예측 32.07% 대 실제 23.81%로 과대추정하고, 20–30% bin은 25.40% 대 28.70%로 과소추정해 평균에서 상쇄된다. Serie A의 전체 과소추정은 3.33%p, Bundesliga는 4.00%p이며 Bundesliga 10–20% bin 잔차도 크다. 작은 bin은 특히 불안정하다. ECE는 기존 고정 bin의 기술적 집계일 뿐이고 독립성/유효 표본수/시간 의존성을 반영한 유의성 검정은 수행하지 않았다.

실제 DRAW 경기만 조건부로 뽑아 pDraw 평균을 100%와 비교하는 것은 calibration 평가가 아니다. Calibration은 같은 예측 확률을 받은 전체 경기에서 실제 빈도를 본다. 완벽히 calibrated된 25% DRAW 확률도 다른 class가 항상 더 크면 DRAW argmax가 0일 수 있다. 반대로 DRAW 선택률을 올리는 것만으로 calibration이나 전체 예측 품질이 개선됐다고 할 수 없다. EPL/Bundesliga 실제 DRAW에서 가장 가까운 실패조차 12.50/10.75%p 차이가 있어 단순 동점 근처 사례만의 문제도 아니다.

## Root cause 후보 A–H

${result.rootCauses.map(r=>`- **${r.id}. ${r.candidate}: ${r.verdict}** — ${r.evidence}`).join('\n')}

근거 수준별 TOP3: (1) E — argmax 경쟁: 입증됨. (2) A/G — 독립 점수분포와 DRAW/저득점 의존성 항 부재: 구조 존재는 확인, 실패 원인으로는 부분 지지. (3) F — calibration 잔차: 관측되지만 인과 기여도는 미확정. 서로 독립적인 원인 기여율이나 최적 수정 우선순위로 읽으면 안 된다.

모델 코드는 venue 득점/실점 평균을 priorMatches=5의 리그 home/away 평균으로 수축한 뒤 공격×상대수비/리그 평균으로 expected goal을 만든다. 독립 PMF의 대각합에서 P(DRAW)=exp(−λH−λA) × Σ[k>=0] (λHλA)^k/(k!)²가 된다. 따라서 DRAW는 별도로 적합된 class 확률이 아니라 두 goal rate가 정한 대각 질량이다. 이 식은 소스의 곱셈/대각합으로부터의 대수적 설명이며 새 확률 계산이나 실험이 아니다. 하지만 sealed record에는 expectedGoals, 수축 전후 구성값, 리그 goal-rate 수치, 전체 score-grid 확률이 저장되어 있지 않다. 이번에는 이를 재구성하지 않았다. 따라서 lambda 과대추정, prior가 DRAW를 얼마나 억제했는지, 리그 평균이 높은 것이 원인인지, 저득점 상관 잔차가 존재하는지는 확정할 수 없다. 표본 gate 통과도 충분한 추정 정확성을 보장하지 않는다.

## V2 연구 가설 — 최대 3개, 선택 없음

아래는 다음 연구의 반증 가능한 후보이며 구현·적합·비교 실험을 하지 않았다. 지금 검토한 2024/25 cohort는 이미 탐색에 사용했으므로 새로운 가설의 최종 미사용 평가셋으로 취급할 수 없다. 승자가 좋아 보이는 가설을 선택하거나 사후 DRAW threshold/offset/multiplier를 추가하지 않는다.

${result.hypotheses.map(h=>Object.entries(h).map(([k,v])=>`- ${k}: ${v}`).join('\n')).join('\n\n')}

## Governance / 재현 / Forward 보호

집계 재현: 저장소 root에서 node data/audits/review-football-draw-v1.mjs. 이 스크립트는 sealed 확률/label만 집계하고 모델·runner를 import하지 않는다. Hash 일치, 전체/PASS 수, fixture uniqueness, 확률 normalization, 저장 argmax 일치, margin 항등식, 기존 bin 빈도/평균을 assert한다. 기존 성능 지표를 다른 설정으로 재측정하지 않는다.

BACKTEST_RERUN=NO; ENGINE_CHANGED=NO; WEIGHTS_CHANGED=NO; THRESHOLD_CHANGED=NO; ODDS_USED=NO; FORWARD_CHANGED=NO; V2_IMPLEMENTED=NO. 기존 두 result SHA256 불변. 모든 행 보존; 새 데이터/네트워크/모델 호출 0. 수정 파일은 review script, machine-readable audit, 이 문서뿐이다. main merge 금지.

Forward v1은 현재 frozen 버전 그대로 유지한다. API 접근이 확보되면 기존 v1 경로로 시작하며 이번 가설·calibration 해석이 입력이나 결정에 들어가지 않는다. Historical v2는 별도 사전 등록 연구로만 진행한다. 오늘 추가 개발은 수행하지 않는다.

FOOTBALL_DRAW_STRUCTURAL_FAILURE_REVIEW_V1_READY_FOR_CTO_REVIEW
`;
fs.writeFileSync('docs/FOOTBALL_DRAW_STRUCTURAL_FAILURE_REVIEW_V1.md',md);
console.log('Review complete: sealed hashes and all 1342 probabilities verified; no model execution.');
