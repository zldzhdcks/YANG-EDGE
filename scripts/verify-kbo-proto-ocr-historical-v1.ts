import { verifyProtoOcrHistorical0731 } from "../src/lib/kbo/proto-ocr/historical-verify";

async function main() {
  const r = await verifyProtoOcrHistorical0731();
  console.log(JSON.stringify(r, null, 2));
  if (!r.ok) process.exit(1);
  console.log("verify:kbo-proto-ocr-historical OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
