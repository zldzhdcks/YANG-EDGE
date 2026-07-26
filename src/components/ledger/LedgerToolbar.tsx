import Button from "@/components/ui/Button";

type LedgerToolbarProps = {
  onExport: () => void;
  onClearAll: () => void;
};

export default function LedgerToolbar({
  onExport,
  onClearAll,
}: LedgerToolbarProps) {
  return (
    <section
      aria-label="백업 및 데이터 관리"
      className="flex flex-wrap items-center gap-2"
    >
      <Button type="button" variant="outline" size="sm" onClick={onExport}>
        JSON 백업 내보내기
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
        전체 기록 삭제
      </Button>
    </section>
  );
}
