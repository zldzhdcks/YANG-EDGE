import type { ReasonIcon } from "@/types/analysis";

type ReasonIconProps = {
  icon: ReasonIcon;
  className?: string;
};

export default function ReasonIconView({
  icon,
  className = "h-3.5 w-3.5",
}: ReasonIconProps) {
  switch (icon) {
    case "pitcher":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18M3 12h18" />
        </svg>
      );
    case "home":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
        </svg>
      );
    case "offense":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M4 19V5M4 19h16M7 15l3-5 3 3 4-7" />
        </svg>
      );
    case "bullpen":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M12 3v6M8 9h8l-1.5 10h-5L8 9z" />
          <path d="M9 21h6" />
        </svg>
      );
    case "h2h":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M7 8h5M7 12h8M7 16h4" />
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      );
    case "form":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M4 17 10 11l4 4 6-8" />
          <path d="M15 7h5v5" />
        </svg>
      );
    case "defense":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3z" />
        </svg>
      );
    case "rest":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "pace":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M13 3 6 14h5l-1 7 8-12h-5l0-6z" />
        </svg>
      );
    case "rebound":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4v16M4 12c2.5-3 5.5-3 8 0s5.5 3 8 0" />
        </svg>
      );
    case "possession":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18M3 12h18" />
        </svg>
      );
    case "setpiece":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M5 19h14M7 19V9l5-5 5 5v10" />
          <path d="M10 19v-4h4v4" />
        </svg>
      );
    case "clutch":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M12 3l2.2 6.6H21l-5.4 4 2.1 6.5L12 16.8 6.3 20.1l2.1-6.5L3 9.6h6.8L12 3z" />
        </svg>
      );
    case "weather":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M7 16a4 4 0 1 1 1.2-7.8A5 5 0 0 1 18 11a3.5 3.5 0 0 1 0 7H7z" />
        </svg>
      );
    case "standings":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M6 20V10M12 20V4M18 20v-7" />
        </svg>
      );
    case "injury":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
      );
    case "streak":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
          <path d="M4 16c3-1 5-5 8-5s5 4 8 5" />
          <path d="M12 4v7" />
        </svg>
      );
  }
}
