/**
 * Open the Fresh Validation human-only annotation UI.
 * Reads frozen selection geometry only. Does not display machine OCR.
 *
 *   npm run open:proto-round-fresh-validation-human-ui-v0 -- --year 2026 --round 105
 */
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  absFromOperatorRelative,
  assertSafeProtoRoundCoords,
  resolveOperatorRoot,
  yangEdgeDirectoryRelative,
} from "../src/lib/proto-round-screenshot-intake-v1";
import {
  FRESH_ANNOTATION_HTML_FILE_NAME,
  FRESH_SELECTION_FILE_NAME,
  FRESH_VALIDATION_LOCAL_DIR_NAME,
  humanAnnotationRecordsFromSelection,
  renderFreshValidationHumanHtml,
  type FreshSelectionDocumentV0,
} from "../src/lib/proto-round-fresh-validation-blind-test-v0";

function parseArgs(argv: string[]) {
  let year: number | null = null;
  let round: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--year") {
      const v = argv[++i];
      if (!v) throw new Error("--year requires a number");
      year = Number(v);
      continue;
    }
    if (a === "--round") {
      const v = argv[++i];
      if (!v) throw new Error("--round requires a number");
      round = Number(v);
      continue;
    }
    throw new Error(`Unknown argument: ${a}`);
  }
  if (year == null || round == null) throw new Error("Specify --year and --round");
  return assertSafeProtoRoundCoords(year, round);
}

async function writeTextAtomic(abs: string, body: string): Promise<void> {
  const dir = path.dirname(abs);
  await mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `${path.basename(abs)}.${process.pid}.tmp`);
  await writeFile(tmp, body, "utf8");
  try {
    await rename(tmp, abs);
  } catch {
    await unlink(abs).catch(() => undefined);
    await rename(tmp, abs);
  }
}

function openLocalFile(abs: string): void {
  spawn("cmd.exe", ["/c", "start", "", abs], {
    windowsHide: true,
    detached: true,
    stdio: "ignore",
  }).unref();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const operatorRootAbs = resolveOperatorRoot();
  const yangAbs = absFromOperatorRelative(
    operatorRootAbs,
    yangEdgeDirectoryRelative(args.year, args.round),
  );
  const localDir = path.join(yangAbs, FRESH_VALIDATION_LOCAL_DIR_NAME);
  const selectionAbs = path.join(localDir, FRESH_SELECTION_FILE_NAME);
  const selection = JSON.parse(
    await readFile(selectionAbs, "utf8"),
  ) as FreshSelectionDocumentV0;
  const html = renderFreshValidationHumanHtml({
    protoRoundKey: selection.protoRoundKey,
    records: humanAnnotationRecordsFromSelection(selection.selectedRows),
  });
  const htmlAbs = path.join(localDir, FRESH_ANNOTATION_HTML_FILE_NAME);
  await writeTextAtomic(htmlAbs, html);
  openLocalFile(htmlAbs);
  console.log("FRESH VALIDATION HUMAN ACTION REQUIRED");
  console.log(htmlAbs);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
