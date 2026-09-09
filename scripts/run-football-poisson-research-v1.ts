import { readFile } from "node:fs/promises";
import { predictFootball, type PredictionInput } from "../src/lib/football/poisson-research-v1";

// Explicit prepared pregame input only; stdout does not freeze or publish a prediction.
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw new Error("Usage: npx tsx scripts/run-football-poisson-research-v1.ts <prepared-input.json>");
  const input = JSON.parse(await readFile(args[0], "utf8")) as PredictionInput;
  console.log(JSON.stringify(predictFootball(input), null, 2));
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
