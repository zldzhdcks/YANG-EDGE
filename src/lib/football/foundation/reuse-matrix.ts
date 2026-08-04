/**
 * MLB → Football reuse matrix (Identity Foundation scope).
 */
export type ReuseVerdict = "YES" | "NO" | "ADAPT" | "LATER";

export type FootballReuseRow = {
  id: string;
  mlbStructure: string;
  reuse: ReuseVerdict;
  notes: string;
};

export const FOOTBALL_REUSE_MATRIX_V0: FootballReuseRow[] = [
  {
    id: "pregame-gate",
    mlbStructure: "Pregame usability gates",
    reuse: "YES",
    notes: "ARTIFACT_PRESENT_UNUSABLE / cutoff philosophy",
  },
  {
    id: "prediction-validity",
    mlbStructure: "Prediction Validity sidecar",
    reuse: "YES",
    notes: "INVALID_FOR_PREGAME pattern; soccer schema later",
  },
  {
    id: "review-contract",
    mlbStructure: "Review Research vs Official split",
    reuse: "YES",
    notes: "Contract only; soccer result taxonomy separate",
  },
  {
    id: "scorecard-engine-none",
    mlbStructure: "Scorecard observational / Engine NONE",
    reuse: "YES",
    notes: "No auto weight update",
  },
  {
    id: "os-levels",
    mlbStructure: "READY / WARNING / BLOCKED / OFF",
    reuse: "YES",
    notes: "Already used in YANG EDGE OS",
  },
  {
    id: "identity-hash-idea",
    mlbStructure: "Frozen identity hash idea",
    reuse: "ADAPT",
    notes: "New football identityHash domain; do not share MLB hashes",
  },
  {
    id: "bullpen",
    mlbStructure: "Bullpen role dataset",
    reuse: "NO",
    notes: "Baseball-only",
  },
  {
    id: "starter",
    mlbStructure: "Starter / probable pitcher",
    reuse: "NO",
    notes: "Baseball-only",
  },
  {
    id: "batting-lineup",
    mlbStructure: "Batting lineup order",
    reuse: "NO",
    notes: "Baseball-only",
  },
  {
    id: "travel",
    mlbStructure: "Travel / rest features",
    reuse: "LATER",
    notes: "Common candidate after identity + schedule",
  },
  {
    id: "weather",
    mlbStructure: "Weather features",
    reuse: "LATER",
    notes: "Common candidate; legal/provider later",
  },
];
