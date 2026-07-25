/**
 * 한국 시간(Asia/Seoul) 유틸.
 *
 * 서버/클라이언트 어디서든 동일 결과를 내기 위해 Intl(timeZone) 기반으로 계산한다.
 * (로컬 머신 TZ에 의존하지 않는다.)
 */

const KST_TIME_ZONE = "Asia/Seoul";

const KST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: KST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const KST_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: KST_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 주어진 시각의 KST 날짜(YYYY-MM-DD) */
export function getKstDateString(date: Date = new Date()): string {
  return KST_DATE_FORMATTER.format(date);
}

/** 오늘(KST) 날짜 YYYY-MM-DD */
export function getKstToday(): string {
  return getKstDateString(new Date());
}

/** ISO/Date → KST 날짜·시각 (HH:mm). 파싱 실패 시 null */
export function instantToKst(
  input: string | Date,
): { date: string; time: string } | null {
  const date =
    input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date: getKstDateString(date),
    time: KST_TIME_FORMATTER.format(date),
  };
}

/**
 * UTC 기준 날짜/시간을 KST 날짜·시간으로 변환한다.
 *
 * @param dateEvent "YYYY-MM-DD" (UTC 날짜)
 * @param strTime   "HH:MM" 또는 "HH:MM:SS" (UTC 시간). 없으면 시간 미정.
 * @returns { date, time } — time 은 미정 시 "TBD"
 */
export function utcToKst(
  dateEvent: string,
  strTime?: string,
): { date: string; time: string } | null {
  if (!dateEvent || !/^\d{4}-\d{2}-\d{2}$/.test(dateEvent)) return null;

  const hasTime = !!strTime && /^\d{2}:\d{2}/.test(strTime) && strTime !== "00:00:00";
  const normalizedTime = hasTime
    ? strTime!.length === 5
      ? `${strTime}:00`
      : strTime!.slice(0, 8)
    : "00:00:00";

  const utc = new Date(`${dateEvent}T${normalizedTime}Z`);
  if (Number.isNaN(utc.getTime())) return null;

  return {
    date: getKstDateString(utc),
    time: hasTime ? KST_TIME_FORMATTER.format(utc) : "TBD",
  };
}
