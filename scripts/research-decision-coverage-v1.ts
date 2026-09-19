import { readDecisionCoverage } from "../src/lib/research/terminal-decision";
import { assertExplicitDateKst } from "../src/lib/research/daily-scope-lock";
const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--date") throw Error("Usage: --date YYYY-MM-DD (read-only)");
const result = readDecisionCoverage(process.cwd(), assertExplicitDateKst(args[1]));
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.status === "COVERAGE_COMPLETE" ? 0 : 2;
