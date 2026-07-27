import {
  SAMPLE_ANALYSIS_BADGE,
  SAMPLE_ANALYSIS_BANNER_BODY,
  SAMPLE_ANALYSIS_NOT_LIVE,
} from "@/constants/home-sample";

type SampleAnalysisNoticeProps = {
  /** Compact one-line for cards; default is full banner */
  compact?: boolean;
  className?: string;
};

export default function SampleAnalysisNotice({
  compact = false,
  className = "",
}: SampleAnalysisNoticeProps) {
  if (compact) {
    return (
      <p
        role="status"
        className={`text-[11px] font-medium tracking-wide text-amber-500/90 ${className}`.trim()}
      >
        {SAMPLE_ANALYSIS_BADGE} · {SAMPLE_ANALYSIS_NOT_LIVE}
      </p>
    );
  }

  return (
    <div
      role="status"
      className={`rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90 ${className}`.trim()}
    >
      <p className="font-medium text-amber-200">
        {SAMPLE_ANALYSIS_BADGE}
        <span className="ml-2 text-xs font-normal text-amber-100/70">
          ({SAMPLE_ANALYSIS_NOT_LIVE})
        </span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
        {SAMPLE_ANALYSIS_BANNER_BODY}
      </p>
    </div>
  );
}
