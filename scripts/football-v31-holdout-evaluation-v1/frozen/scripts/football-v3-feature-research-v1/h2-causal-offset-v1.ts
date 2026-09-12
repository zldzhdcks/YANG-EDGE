import {historyReasons,requireRule,predictSafely,digest,validateHistory,type Target,type Match} from './contracts-v1';
import {fitRates,predictRates} from '../football-poisson-v2-draw-research/evaluation-v1/h2-ridge-rates-v1';
import {joint} from '../football-poisson-v2-draw-research/evaluation-v1/numerics-v1';
export {baseline} from '../football-poisson-v2-draw-research/evaluation-v1/v1-readonly-adapter';
export function causalOffset(t:Target,history:Match[]){return predictSafely(()=>{
  validateHistory(t,history);const reasons=historyReasons(t,history);requireRule(!reasons.length,reasons.join('|'),'PASS');
  const fit=fitRates(history);if(fit.status!=='FITTED'){requireRule(false,fit.reasons.join('|'),fit.status);}
  const rates=predictRates(fit.parameters,t,history);
  return {rates,p:joint(...rates).p,details:{historyIds:history.map(r=>r.fixtureId),inputHash:digest(history),parameterHash:digest(fit.parameters),fit}};
});}
