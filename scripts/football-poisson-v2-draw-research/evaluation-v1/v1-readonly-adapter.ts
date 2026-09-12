import {predictFootball} from '../../../src/lib/football/poisson-research-v1/index';
import {validateHistory,type Target,type Match,type Prediction,type Prob,DAY,requireRule,validProb} from './contracts-evaluation-v1';
export function baseline(t:Target,history:Match[]):Prediction {
  validateHistory(t,history);
  const raw=predictFootball({target:{matchId:'API_FOOTBALL:'+t.fixtureId,competitionId:String(t.leagueId),homeTeamId:String(t.homeTeamId),awayTeamId:String(t.awayTeamId),kickoffAt:t.kickoffUtc},cutoffAt:new Date(Date.parse(t.kickoffUtc)-1).toISOString(),history:history.map(r=>({matchId:'API_FOOTBALL:'+r.fixtureId,competitionId:String(r.leagueId),homeTeamId:String(r.homeTeamId),awayTeamId:String(r.awayTeamId),kickoffAt:r.kickoffUtc,resultObservedAt:new Date(Date.parse(r.kickoffUtc)+2*DAY).toISOString(),regulationHomeGoals:r.homeGoals,regulationAwayGoals:r.awayGoals}))});
  if(raw.status!=='RESEARCH_PREDICTED')return {status:'PASS',reasons:raw.reasons,p:null,rates:null,details:{evidence:raw.evidence,IS_ACTUAL_OBSERVED_AT:false}};
  requireRule(raw.probabilities&&raw.expectedGoals,'INVALID_V1_OUTPUT');const p:Prob=[raw.probabilities.home,raw.probabilities.draw,raw.probabilities.away];validProb(p);
  return {status:'PREDICTED',reasons:[],p,rates:[raw.expectedGoals.home,raw.expectedGoals.away],details:{evidence:raw.evidence,IS_ACTUAL_OBSERVED_AT:false}};
}
