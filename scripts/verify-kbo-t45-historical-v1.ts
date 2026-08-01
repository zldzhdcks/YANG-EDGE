/**
 * Read-only historical verifier for 2026-07-31 KBO T45 artifacts.
 */
import { verifyKboT45Historical0731 } from "../src/lib/kbo/t45-personnel/historical-verify";

async function main() {
  const r = await verifyKboT45Historical0731(process.cwd());
  console.log(JSON.stringify(r, null, 2));
  if (!r.ok) {
    console.error("verify:kbo-t45-historical FAILED");
    process.exit(1);
  }
  console.log("verify:kbo-t45-historical OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
