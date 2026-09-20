import type {PlayerEvidence} from '../football/official-canonical-v1/preview-player-context-v3';
/** Display-only safety correction. Archived selectors/artifacts remain untouched. */
export function safeResearchPlayers(players:PlayerEvidence[]){
 const active=players.filter(p=>p.minutes>0&&p.starts>0);
 const attack=(p:PlayerEvidence)=>['Attacker','Midfielder','ST_CF','WINGER_AM'].includes(p.position)||['ST_CF','WINGER_AM'].includes(p.role);
 const vector=(p:PlayerEvidence)=>attack(p)?[p.minutes,p.starts,p.goals??0,p.assists??0,p.axes.SHOTS??0,p.axes.CREATION??0]:[p.minutes,p.starts];
 const core=active.filter(p=>!active.some(q=>{if(p.position!==q.position)return false;const a=vector(p),b=vector(q);return b.every((v,i)=>v>=a[i])&&b.some((v,i)=>v>a[i]);}));
 const structural=active.filter(p=>{
  if(p.position==='Attacker'||['ST_CF','WINGER_AM'].includes(p.role))return false;
  if(p.position==='Goalkeeper'||p.role==='GK')return(p.axes.SHOT_STOPPING??0)>0;
  // Total passes alone are never sufficient. No CM/CB inference from broad labels.
  return ['Defender','Midfielder','CM_DM','CB','FB_WB'].includes(p.position)&&
   (p.axes.DEFENSIVE_IMPACT??0)>0&&((p.axes.INTERCEPTIONS??0)>0||(p.axes.BLOCKS??0)>0);
 });
 return{seasonCore:core,structuralKey:structural,recentImpact:[],matchKeyPlayer:'WAITING_FOR_XI',roleDetail:'UNKNOWN',goalsAssistsExcluded:false,goalsAssistsOnly:false};
}
