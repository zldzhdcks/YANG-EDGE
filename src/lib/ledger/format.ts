const KRW = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat("ko-KR");

/** 원화 표시. 비유한 값은 "—" */
export function formatKrw(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return KRW.format(value);
}

/** 손익 표시 (+/− 부호). pending 등 null → "정산 대기" */
export function formatProfit(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "정산 대기";
  if (value > 0) return `+${KRW.format(value)}`;
  return KRW.format(value);
}

export function formatOdds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return NUM.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${NUM.format(value)}%`;
}

/**
 * 입력 문자열 → 유한 숫자 또는 null.
 * 빈 문자열은 null (0과 구분).
 */
export function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return n;
}

/** 원 단위 정수. 실패 시 null */
export function parseWonAmount(raw: string): number | null {
  const n = parseOptionalNumber(raw);
  if (n == null) return null;
  if (n < 0) return null;
  return Math.round(n);
}
