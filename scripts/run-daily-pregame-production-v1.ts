import {readFileSync} from 'node:fs';
import {runDailyPregame,type ProductionPlan} from './daily-pregame-production-v1';
const a=process.argv.slice(2);
const options=new Map<string,string>();
for(let i=0;i<a.length;i+=2){if(!['--date','--plan','--batch'].includes(a[i])||!a[i+1]||a[i+1].startsWith('--')||options.has(a[i]))throw Error('Usage: --date YYYY-MM-DD [--batch EXACT_ID] [--plan EXPLICIT_LOCAL_JSON]');options.set(a[i],a[i+1]);}
if(!options.has('--date'))throw Error('EXPLICIT_DATE_REQUIRED');
const plan=options.has('--plan')?JSON.parse(readFileSync(options.get('--plan')!,'utf8')) as ProductionPlan:undefined;
runDailyPregame(process.cwd(),options.get('--date')!,plan,options.get('--batch')).then(r=>{console.log(JSON.stringify(r,null,2));if(!['COVERAGE_COMPLETE','COVERAGE_INCOMPLETE'].includes(r.coverage.status))process.exitCode=2;}).catch(e=>{console.error(e instanceof Error&&e.message.startsWith('EXPLICIT_BATCH_REQUIRED')?'EXPLICIT_BATCH_REQUIRED':'PRODUCTION_GATE_FAILED: inspect committed scope and pinned local evidence');process.exitCode=2;});
