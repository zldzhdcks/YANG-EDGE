import {SHOWCASE_ROUTE} from '@/lib/public-analysis/engine-lab';
export default function OwnerPreviewNotice({local=true}:{local?:boolean}){
 return <section className="mx-auto my-10 max-w-3xl rounded-2xl bg-zinc-900 p-6 text-zinc-300"><p className="text-xs font-semibold tracking-wide text-emerald-400">LOCAL OWNER ONLY</p><h1 className="mt-3 text-2xl font-semibold text-white">Showcase는 소유자용 서버에서 확인하세요</h1><p className="mt-3 text-sm leading-7">이 실행 환경에는 소유자용 Preview가 연결되어 있지 않습니다. 공식 Prediction의 존재 여부를 뜻하는 메시지가 아닙니다.</p>{local&&<a className="mt-5 inline-block rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-zinc-950" href={`http://127.0.0.1:4198${SHOWCASE_ROUTE}`}>로컬 Showcase 열기 →</a>}</section>;
}
