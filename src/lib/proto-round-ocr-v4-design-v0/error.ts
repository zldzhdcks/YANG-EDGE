export class OcrV4DesignV0Error extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "OcrV4DesignV0Error";
    this.code = code;
  }
}
