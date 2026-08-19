"use client";

import Button from "@/components/ui/Button";
import { shiftKstDate } from "@/lib/datetime/games-date";

type DatePickerProps = {
  value: string;
  today: string;
  onChange: (value: string) => void;
};

export default function DatePicker({ value, today, onChange }: DatePickerProps) {
  const isToday = value === today;

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label="이전 날"
        onClick={() => onChange(shiftKstDate(value, -1))}
        className="shrink-0 px-2.5"
      >
        ‹
      </Button>

      <label className="min-w-0 flex-1 sm:flex-initial">
        <span className="sr-only">날짜 선택</span>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full min-w-[9.5rem] rounded-lg border border-white/[0.08] bg-zinc-900 px-3 text-sm text-white focus:border-blue-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:w-40 [color-scheme:dark]"
        />
      </label>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        aria-label="다음 날"
        onClick={() => onChange(shiftKstDate(value, 1))}
        className="shrink-0 px-2.5"
      >
        ›
      </Button>

      <Button
        type="button"
        variant={isToday ? "outline" : "secondary"}
        size="sm"
        aria-label="오늘"
        aria-current={isToday ? "date" : undefined}
        onClick={() => onChange(today)}
        className="shrink-0"
      >
        오늘
      </Button>
    </div>
  );
}
