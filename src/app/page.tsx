import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/home/HeroSection";
import HomeBestPicks from "@/components/home/HomeBestPicks";
import HomeRecord from "@/components/home/HomeRecord";
import { loadTodayEdgePicks } from "@/lib/api/today-edge-picks";
import { loadOwnerRichPreviews } from '@/lib/public-analysis/load-owner-rich-preview';
import RichMatchPreview from '@/components/analysis/public/RichMatchPreview';
import { getKstToday } from '@/lib/datetime/kst';
import ResearchShowcase from '@/components/home/ResearchShowcase';
import {isAtleticoShowcase,SHOWCASE_DATE} from '@/lib/public-analysis/engine-lab';
import OwnerPreviewNotice from '@/components/analysis/public/OwnerPreviewNotice';

export const dynamic = "force-dynamic";

export default async function Home() {
  const richPreviews = loadOwnerRichPreviews(getKstToday());
  const showcase=richPreviews.find(x=>isAtleticoShowcase(x.preview));
  const edgePickResult = await loadTodayEdgePicks();
  const selection =
    edgePickResult.status === "error" ? null : edgePickResult.result;

  return (
    <>
      <Header />
      <main>
        <HeroSection />
        {showcase&&<ResearchShowcase preview={showcase.preview}/>}
        {!showcase&&process.env.NODE_ENV!=='production'&&getKstToday()===SHOWCASE_DATE&&<OwnerPreviewNotice/>}
        {richPreviews.length > 0 && <section className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6" aria-label="필수 경기 프리뷰">
          <p className="text-xs tracking-wider text-zinc-500">OWNER PREVIEW · 오늘의 주요 경기</p>
          {richPreviews.filter(x=>!isAtleticoShowcase(x.preview)).map(({preview}) => <RichMatchPreview key={preview.targetId} preview={preview} compact />)}
        </section>}
        <HomeBestPicks result={selection} />
        <HomeRecord />
      </main>
      <Footer />
    </>
  );
}
