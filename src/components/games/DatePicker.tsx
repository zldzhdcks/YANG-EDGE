type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function DatePicker({ value, onChange }: DatePickerProps) {
  return (
    <label className="block shrink-0">
      <span className="sr-only">날짜 선택</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-white/[0.08] bg-zinc-900 px-3 text-sm text-white focus:border-blue-500/40 focus:outline-none sm:w-40 [color-scheme:dark]"
      />
    </label>
  );
}
