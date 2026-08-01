/**
 * Proto OCR admin/access smoke tests.
 */
import assert from "node:assert/strict";
import { assertInternalKboT45Access } from "../src/lib/kbo/t45-personnel/internal-access";

function main() {
  const prodNoToken = assertInternalKboT45Access(
    new Request("http://localhost/api", { headers: {} }),
    { NODE_ENV: "production" } as NodeJS.ProcessEnv,
  );
  assert.equal(prodNoToken?.status, 403);

  const wrong = assertInternalKboT45Access(
    new Request("http://localhost/api", {
      headers: { "x-internal-token": "wrong" },
    }),
    { NODE_ENV: "production", INTERNAL_ADMIN_TOKEN: "secret" } as NodeJS.ProcessEnv,
  );
  assert.equal(wrong?.status, 401);

  const ok = assertInternalKboT45Access(
    new Request("http://localhost/api", {
      headers: { "x-internal-token": "secret" },
    }),
    { NODE_ENV: "production", INTERNAL_ADMIN_TOKEN: "secret" } as NodeJS.ProcessEnv,
  );
  assert.equal(ok, null);

  console.log("test:kbo-proto-ocr-admin OK");
}

main();
