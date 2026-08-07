import {
  failureCauseLabel,
  successCauseLabel,
} from "@/lib/mlb/research-ux-v1/category-labels";
import type {
  GoodPickGameFeedback,
  PreGameSignal,
  ReviewCandidate,
} from "./types";
import { signalArrow } from "./build-signals";

export function mapSuccessCandidates(
  categories: string[],
  whyCorrect: Array<Record<string, unknown>>,
): ReviewCandidate[] {
  return categories.map((code, i) => {
    const evidence = whyCorrect
      .filter((w) => String(w.category ?? "") === code)
      .map((w) => String(w.evidence ?? w.assessment ?? ""))
      .filter(Boolean)
      .slice(0, 2);
    return {
      code,
      label: successCauseLabel(code),
      role: i === 0 ? "primary" : "secondary",
      plain:
        evidence[0] ||
        `${successCauseLabel(code)} — 성공 복기 후보 (확정 원인 아님).`,
    };
  });
}

export function mapFailureCandidates(
  categories: string[],
  possibleCauses: Array<Record<string, unknown>>,
): ReviewCandidate[] {
  return categories.map((code, i) => {
    const evidence = possibleCauses
      .filter((w) => String(w.category ?? "") === code)
      .map((w) => String(w.evidence ?? w.assessment ?? ""))
      .filter(Boolean)
      .slice(0, 2);
    return {
      code,
      label: failureCauseLabel(code),
      role: i === 0 ? "primary" : "secondary",
      plain:
        evidence[0] ||
        `${failureCauseLabel(code)} — 실패 복기 후보 (확정 원인 아님).`,
    };
  });
}

function shortTeam(name: string | null): string {
  if (!name) return "이 Pick";
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

/**
 * Human-readable learning — Artifact-backed, no causal certainty.
 */
export function buildWhatWeLearned(game: {
  pickTeam: string | null;
  grade: GoodPickGameFeedback["grade"];
  beforeSignals: PreGameSignal[];
  preGameRiskLabels: string[];
  whyCorrect: ReviewCandidate[];
  whyIncorrect: ReviewCandidate[];
}): string {
  const team = shortTeam(game.pickTeam);
  const pos = game.beforeSignals
    .filter((s) => s.polarity === "POSITIVE")
    .map((s) => s.label);
  const lim = game.beforeSignals
    .filter((s) => s.polarity === "LIMITED" || s.polarity === "NOT_CONNECTED")
    .map((s) => `${s.label} ${signalArrow(s.polarity)}`);

  if (game.grade === "CORRECT") {
    const primary = game.whyCorrect[0]?.label ?? "관찰된 성공 패턴";
    const lines = [
      `${team} 선택은 적중했습니다.`,
      pos.length
        ? `경기 전 ${pos.join("·")} 신호가 Pick과 같은 방향이었습니다.`
        : "경기 전 강한 동조 신호는 Snapshot에 제한적이었습니다.",
      lim.length
        ? `동시에 ${lim.join(", ")} 등 사전 제한이 있었습니다.`
        : "",
      `경기 후 Review에서는 「${primary}」이(가) 주요 성공 관찰 후보로 나타났습니다.`,
      "한 경기만으로 해당 조합이 유효하다고 판단하지 않습니다.",
    ];
    return lines.filter(Boolean).join(" ");
  }

  if (game.grade === "INCORRECT") {
    const primary = game.whyIncorrect[0]?.label ?? "관찰된 실패 패턴";
    const secondary = game.whyIncorrect
      .slice(1, 3)
      .map((c) => c.label)
      .join("·");
    const risk =
      game.preGameRiskLabels.filter((r) => !/Research Only/i.test(r)).slice(0, 2);
    const lines = [
      `${team} 선택은 실패했습니다.`,
      risk.length
        ? `경기 전에도 ${risk.join("·")} 위험 신호가 있었습니다.`
        : "경기 전 Snapshot 기준 특이 위험은 제한적이었습니다.",
      `경기 후 Review에서는 「${primary}」${
        secondary ? `와 ${secondary}` : ""
      }이(가) 주요 관찰 후보로 나타났습니다.`,
      "현재로서는 사전 위험 신호가 실제 실패 원인이었다고 단정하지 않습니다.",
    ];
    return lines.filter(Boolean).join(" ");
  }

  return `${team} 결과는 아직 확정·채점되지 않았습니다. 사전 신호만 표시합니다.`;
}
