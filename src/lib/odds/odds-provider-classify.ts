/** Split classifyH2hOutcome to avoid circular imports with compute-best-h2h. */

export function classifyH2hOutcome(
  outcomeName: string,
  homeTeam: string,
  awayTeam: string,
): "home" | "away" | "draw" | "unknown" {
  const n = outcomeName.trim().toLowerCase();
  if (n === "draw" || n === "tie" || n === "x") return "draw";
  const home = homeTeam.trim().toLowerCase();
  const away = awayTeam.trim().toLowerCase();
  if (n === home) return "home";
  if (n === away) return "away";
  return "unknown";
}
