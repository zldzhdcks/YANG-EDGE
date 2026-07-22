import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-16 pb-12 sm:px-6 sm:pt-20 sm:pb-16">
      <p className="text-xs font-medium tracking-widest text-blue-500 uppercase">
        AI Sports Analytics
      </p>

      <h1 className="mt-4 max-w-2xl text-3xl leading-tight font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
        오늘 가장 가치 있는 경기를
        <br />
        AI가 찾아드립니다.
      </h1>

      <p className="mt-5 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
        축구 · 야구 · 농구
        <br />
        배트맨 기준 경기를 분석하여
        <br />
        승률 + Confidence + EDGE Value + 분석 근거를 제공합니다.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="#today-games"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-500"
        >
          오늘 경기 보기
        </Link>
        <Link
          href="#today-pick"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 px-5 text-sm font-medium text-white hover:border-white/20 hover:bg-white/5"
        >
          AI PICK 보기
        </Link>
      </div>
    </section>
  );
}
