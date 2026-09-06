import type { LayoutFragmentV0 } from "./types";
import type { MarketSignalAuditV0, NumericShapeAuditV0 } from "./types";
import { distribution } from "./geometry";
import { classifyNumericRawShape } from "./token-shape";
import { rowKey } from "./lineage";

type Tagged = {
  rowKey: string;
  frag: LayoutFragmentV0;
};

const MARKET_CLASSES: Array<{ className: string; pattern: string; test: (t: string) => boolean }> = [
  { className: "SUM_EXACT", pattern: "^SUM$", test: (t) => t === "SUM" },
  {
    className: "U_DECIMAL",
    pattern: "^U[0-9]+(?:\\.[0-9]+)?$",
    test: (t) => /^U[0-9]+(?:\.[0-9]+)?$/.test(t),
  },
  {
    className: "O_DECIMAL",
    pattern: "^O[0-9]+(?:\\.[0-9]+)?$",
    test: (t) => /^O[0-9]+(?:\.[0-9]+)?$/.test(t),
  },
  { className: "H_LITERAL", pattern: "^H$", test: (t) => t === "H" },
  {
    className: "H_SIGNED_NUMBER",
    pattern: "^H\\s*[+-][0-9]+(?:\\.[0-9]+)?$",
    test: (t) => /^H\s*[+-][0-9]+(?:\.[0-9]+)?$/.test(t),
  },
  {
    className: "SIGNED_NUMBER",
    pattern: "^[+-][0-9]+(?:\\.[0-9]+)?$",
    test: (t) => /^[+-][0-9]+(?:\.[0-9]+)?$/.test(t),
  },
  {
    className: "DECIMAL_ASCII",
    pattern: "^[0-9]+\\.[0-9]+$",
    test: (t) => /^[0-9]+\.[0-9]+$/.test(t),
  },
];

function examples(items: Tagged[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    if (out.length >= 8) break;
    if (!out.includes(it.frag.rawText)) out.push(it.frag.rawText);
  }
  return out;
}

export function auditMarketSignals(items: Tagged[]): MarketSignalAuditV0[] {
  return MARKET_CLASSES.map((cls) => {
    const hit = items.filter((it) => cls.test(it.frag.rawText));
    const rows = new Set(hit.map((h) => h.rowKey));
    return {
      className: cls.className,
      pattern: cls.pattern,
      count: hit.length,
      rowCoverage: rows.size,
      normalizedCenterX: distribution(hit.map((h) => h.frag.normalizedCenterX)),
      exampleRawTexts: examples(hit),
    };
  });
}

export function auditNumericShapes(items: Tagged[]): NumericShapeAuditV0[] {
  const groups = new Map<ReturnType<typeof classifyNumericRawShape>, Tagged[]>();
  for (const it of items) {
    const cls = classifyNumericRawShape(it.frag.rawText);
    const list = groups.get(cls) ?? [];
    list.push(it);
    groups.set(cls, list);
  }
  const order: ReturnType<typeof classifyNumericRawShape>[] = [
    "SPACED_DIGIT_GROUPS",
    "HYPHEN_DIGIT_GROUPS",
    "INTEGER_ASCII",
    "DECIMAL_ASCII",
    "BANG_SUFFIX",
    "OTHER_NUMERIC_LIKE",
    "NON_NUMERIC",
  ];
  return order.map((className) => {
    const hit = groups.get(className) ?? [];
    return {
      className,
      count: hit.length,
      rowCoverage: new Set(hit.map((h) => h.rowKey)).size,
      normalizedCenterX: distribution(hit.map((h) => h.frag.normalizedCenterX)),
      exampleRawTexts: examples(hit),
    };
  });
}

export function taggedRemainder(
  sourceImageSha256: string,
  visualRowIndex: number,
  remainder: LayoutFragmentV0[],
): Tagged[] {
  const k = rowKey(sourceImageSha256, visualRowIndex);
  return remainder.map((frag) => ({ rowKey: k, frag }));
}
