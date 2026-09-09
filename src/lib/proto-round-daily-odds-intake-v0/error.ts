export class DailyOddsIntakeV0Error extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "DailyOddsIntakeV0Error";
    this.code = code;
  }
}
