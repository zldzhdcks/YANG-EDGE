export default function LedgerDisclaimer() {
  return (
    <aside className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-5 sm:px-5">
      <h2 className="text-xs font-medium tracking-wide text-zinc-500">
        이용 안내
      </h2>
      <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-zinc-600 sm:text-xs">
        <li>이 페이지는 개인 기록 및 자금관리 목적의 도구입니다.</li>
        <li>
          종목 선택은 개인 베팅 기록 분류이며, YANG EDGE 분석 지원 범위(야구·축구·농구·배구)와
          동일하지 않습니다. 「기타」및 이전 기록 종목은 AI 분석 대상이 아닙니다.
        </li>
        <li>베팅 참여나 수익을 권유하거나 보장하지 않습니다.</li>
        <li>
          데이터는 현재 브라우저의 localStorage에만 저장되며, 서버로 전송되지
          않습니다.
        </li>
        <li>
          브라우저 데이터를 삭제하거나 기기를 바꾸면 기록이 사라질 수 있습니다.
        </li>
        <li>초기 버전에서는 기기 간 자동 동기화를 지원하지 않습니다.</li>
        <li>합법적으로 본인이 구매한 내역만 기록하는 용도로 사용해 주세요.</li>
      </ul>
    </aside>
  );
}
