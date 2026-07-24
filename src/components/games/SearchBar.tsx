type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <label className="relative block flex-1">
      <span className="sr-only">경기 검색</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500"
        aria-hidden
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="팀명, 리그 검색"
        className="h-10 w-full rounded-lg border border-white/[0.08] bg-zinc-900 pr-4 pl-10 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500/40 focus:outline-none"
      />
    </label>
  );
}
