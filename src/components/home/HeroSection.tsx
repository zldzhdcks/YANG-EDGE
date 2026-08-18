import Button from "@/components/ui/Button";

export default function HeroSection() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10">
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
        YANG EDGE
      </h1>
      <p className="mt-3 text-sm font-medium text-zinc-300 sm:text-base">
        데이터 기반 스포츠 리서치
      </p>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-zinc-500">
        경기 전 데이터를 기준으로 검증 가능한 분석을 제공합니다.
      </p>
      <div className="mt-6">
        <Button href="/games" variant="ghost" size="sm" className="px-0">
          오늘 경기 보기 →
        </Button>
      </div>
    </section>
  );
}
