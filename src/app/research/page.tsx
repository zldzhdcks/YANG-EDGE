import Header from '@/components/layout/Header';
import ResearchExplorer from '@/components/research/ResearchExplorer';
import {loadResearchExplorer} from '@/lib/public-analysis/load-research-explorer';
export const dynamic='force-dynamic';
export default async function ResearchPage({searchParams}:{searchParams:Promise<{batch?:string;date?:string}>}){const q=await searchParams;if(!q.batch||!q.date)return <main className="p-8 text-zinc-300">EXPLICIT_BATCH_AND_DATE_REQUIRED</main>;const data=loadResearchExplorer(q.batch,q.date);return <><Header/><ResearchExplorer lines={data.lines} batch={data.batch} date={data.date}/></>;}
