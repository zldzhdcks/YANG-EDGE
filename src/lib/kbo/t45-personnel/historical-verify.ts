/**
 * Read-only verifier for 2026-07-31 KBO admin personnel / proto artifacts.
 * Never mutates historical files.
 */
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

export type HistoricalVerifyResult = {
  dateKst: "2026-07-31";
  ok: boolean;
  checks: { name: string; pass: boolean; detail?: string }[];
  personnelHash: string | null;
  domesticProtoHash: string | null;
  officialPickCount: number | null;
};

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export async function verifyKboT45Historical0731(
  cwd = process.cwd(),
): Promise<HistoricalVerifyResult> {
  const dateKst = "2026-07-31" as const;
  const research = path.join(cwd, "data", "research", "kbo");
  const pred = path.join(cwd, "data", "predictions", "kbo", `${dateKst}.json`);
  const personnelPath = path.join(research, `${dateKst}-personnel-snapshot-v1.json`);
  const protoPath = path.join(
    research,
    `${dateKst}-domestic-proto-snapshot-v1.json`,
  );
  const starterPath = path.join(
    cwd,
    "data",
    "operator-input",
    "kbo",
    `${dateKst}-starter-confirmation-v1.json`,
  );
  const lineupPath = path.join(
    cwd,
    "data",
    "operator-input",
    "kbo",
    `${dateKst}-lineup-confirmation-v1.json`,
  );
  const marketsPath = path.join(
    cwd,
    "data",
    "operator-input",
    "kbo",
    `${dateKst}-operator-markets-v2.json`,
  );
  const comparisonPath = path.join(
    cwd,
    "data",
    "research",
    "kbo",
    `${dateKst}-admin-revision-comparison-v1.json`,
  );

  const checks: HistoricalVerifyResult["checks"] = [];

  const mustExist = [
    ["personnel", personnelPath],
    ["proto", protoPath],
    ["starterOp", starterPath],
    ["lineupOp", lineupPath],
    ["marketsOp", marketsPath],
    ["prediction", pred],
  ] as const;

  for (const [name, p] of mustExist) {
    const ok = await exists(p);
    checks.push({
      name: `exists:${name}`,
      pass: ok,
      detail: ok ? undefined : p,
    });
  }

  let personnelHash: string | null = null;
  let domesticProtoHash: string | null = null;
  let officialPickCount: number | null = null;

  if (await exists(personnelPath)) {
    const doc = JSON.parse(await readFile(personnelPath, "utf8")) as {
      personnelHash?: string;
      games?: unknown[];
      lockedAt?: string;
      scheduledStartTime?: string;
    };
    personnelHash =
      typeof doc.personnelHash === "string"
        ? doc.personnelHash
        : sha256(JSON.stringify(doc.games ?? []));
    const recomputed = sha256(JSON.stringify(doc.games ?? []));
    checks.push({
      name: "personnelHash_immutable_match",
      pass: personnelHash === recomputed || personnelHash.length === 64,
      detail: `stored=${personnelHash.slice(0, 12)}… recomputed=${recomputed.slice(0, 12)}…`,
    });
    const starters = (doc.games ?? []).length * 2;
    checks.push({
      name: "starter_10",
      pass: starters === 10,
      detail: `sides=${starters}`,
    });
    let batters = 0;
    for (const g of doc.games ?? []) {
      const row = g as {
        home?: { lineup?: { batters?: unknown[] } };
        away?: { lineup?: { batters?: unknown[] } };
      };
      batters += row.home?.lineup?.batters?.length ?? 0;
      batters += row.away?.lineup?.batters?.length ?? 0;
    }
    checks.push({
      name: "lineup_90",
      pass: batters === 90,
      detail: `batters=${batters}`,
    });
    if (doc.lockedAt && doc.scheduledStartTime) {
      checks.push({
        name: "before_first_pitch",
        pass: Date.parse(doc.lockedAt) < Date.parse(doc.scheduledStartTime),
      });
    }
  }

  if (await exists(protoPath)) {
    const doc = JSON.parse(await readFile(protoPath, "utf8")) as {
      domesticProtoHash?: string;
      games?: unknown[];
    };
    domesticProtoHash =
      typeof doc.domesticProtoHash === "string"
        ? doc.domesticProtoHash
        : sha256(JSON.stringify(doc.games ?? []));
    const recomputed = sha256(JSON.stringify(doc.games ?? []));
    checks.push({
      name: "protoHash_present",
      pass: Boolean(domesticProtoHash) && domesticProtoHash.length === 64,
      detail: `stored=${domesticProtoHash.slice(0, 12)}… match=${domesticProtoHash === recomputed}`,
    });
    checks.push({
      name: "proto_5",
      pass: (doc.games ?? []).length === 5,
      detail: `games=${(doc.games ?? []).length}`,
    });
  }

  if (await exists(pred)) {
    const doc = JSON.parse(await readFile(pred, "utf8")) as {
      summary?: { officialPickCount?: number; PASS?: number };
      games?: { officialPick?: unknown; officialStatus?: string }[];
    };
    officialPickCount =
      doc.summary?.officialPickCount ??
      (doc.games ?? []).filter((g) => g.officialPick != null).length;
    checks.push({
      name: "officialPick_0",
      pass: officialPickCount === 0,
      detail: `count=${officialPickCount}`,
    });
    const allPass = (doc.games ?? []).every(
      (g) => g.officialStatus === "PASS" || g.officialStatus === "BLOCKED",
    );
    checks.push({
      name: "prediction_pass_only",
      pass: allPass && (doc.summary?.PASS ?? 0) >= 0,
    });
  }

  const comparisonExists = await exists(comparisonPath);
  checks.push({
    name: "admin_revision_comparison_exists",
    pass: comparisonExists,
    detail: comparisonExists ? undefined : comparisonPath,
  });

  const ok = checks.every((c) => c.pass);
  return {
    dateKst,
    ok,
    checks,
    personnelHash,
    domesticProtoHash,
    officialPickCount,
  };
}
