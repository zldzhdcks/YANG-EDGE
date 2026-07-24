import type { BudgetOption, TotoRoundData } from "@/types/toto";
import { getSportsProvider } from "@/lib/sports";
import { successResult, type ApiFetchResult } from "./types";

export type TotoResponse = {
  round: TotoRoundData;
  budgetOptions: BudgetOption[];
};

export type TotoResult = ApiFetchResult<TotoResponse>;

function toSource(
  kind: "dummy" | "thesportsdb" | "apisports",
): ApiFetchResult<unknown>["source"] {
  return kind === "dummy" ? "dummy" : "external-api";
}

/**
 * EDGE Combo — SportsProvider 위임
 */
export async function fetchToto(): Promise<TotoResult> {
  const provider = getSportsProvider();
  const data = await provider.getToto();
  return successResult(data, toSource(provider.kind));
}
