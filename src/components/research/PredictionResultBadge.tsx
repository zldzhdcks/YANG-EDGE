import Badge from "@/components/ui/Badge";

type PredictionResultBadgeProps = {
  /** true = 예측 적중, false = 예측 실패 */
  hit: boolean;
  className?: string;
};

/**
 * Graded research outcome badge — shared by /games GameCard and Research Viewer.
 * Colors only: success=green, failure=red. Labels are fixed.
 */
export default function PredictionResultBadge({
  hit,
  className,
}: PredictionResultBadgeProps) {
  return (
    <Badge
      variant={hit ? "success" : "danger"}
      className={className ?? "tracking-wide"}
    >
      {hit ? "예측 적중" : "예측 실패"}
    </Badge>
  );
}
