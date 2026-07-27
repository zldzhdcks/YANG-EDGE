import Button from "@/components/ui/Button";

export default function HeroSection() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-16 pb-12 sm:px-6 sm:pt-20 sm:pb-16">
      <p className="text-xs font-medium tracking-widest text-blue-500 uppercase">
        EDGE Analytics
      </p>

      <h1 className="mt-4 max-w-2xl text-3xl leading-snug font-bold tracking-tight text-white sm:text-4xl md:text-5xl md:leading-tight">
        <span className="block">우리는 승자를 찾지 않습니다.</span>
        <span className="mt-2 block sm:mt-3">가치를 찾습니다.</span>
      </h1>

      <p className="mt-5 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
        축구 · 야구 · 농구
        <br />
        일정은 Provider 실데이터를 사용하고,
        <br />
        TODAY EDGE PICK은 연구 스냅샷 기준으로 선정합니다.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button href="/games">오늘 경기 보기</Button>
        <Button href="/ledger" variant="outline">
          내 가계부
        </Button>
      </div>
    </section>
  );
}
