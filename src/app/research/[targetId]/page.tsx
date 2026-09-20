import Header from '@/components/layout/Header';
import UniversalResearch from '@/components/research/UniversalResearch';
import {loadResearchExplorer} from '@/lib/public-analysis/load-research-explorer';
export const dynamic='force-dynamic';
export default async function ResearchMatch({params,searchParams}:{params:Promise<{targetId:string}>;searchParams:Promise<{batch?:string;date?:string}>}){const q=await searchParams,{targetId}=await params;if(!q.batch||!q.date)return <main className="p-8 text-zinc-300">EXPLICIT_BATCH_AND_DATE_REQUIRED</main>;const data=loadResearchExplorer(q.batch,q.date),detail=data.details.find(d=>d.line.targetId===targetId);return <><Header/>{detail?<><a className="mx-auto block max-w-4xl px-4 pt-6 text-sm text-zinc-400" href={`/research?batch=${q.batch}&date=${q.date}`}>← Research Explorer</a><UniversalResearch detail={detail}/></>:<p className="p-8 text-zinc-300">TARGET_NOT_IN_EXPLICIT_BATCH</p>}</>;}
