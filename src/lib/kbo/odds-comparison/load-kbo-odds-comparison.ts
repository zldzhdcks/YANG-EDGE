import { readFile } from "node:fs/promises";
import path from "node:path";
import type { KboOddsComparisonDocument } from "./kbo-odds-comparison-types";

export async function loadKboOddsComparisonDocument(
  dateKst: string,
  cwd = process.cwd(),
): Promise<KboOddsComparisonDocument | null> {
  const filePath = path.join(
    cwd,
    "data/research/kbo",
    `${dateKst}-odds-comparison-v1.json`,
  );
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as KboOddsComparisonDocument;
  } catch {
    return null;
  }
}
