export class OcrResearchExpansionV1Error extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "OcrResearchExpansionV1Error";
    this.code = code;
  }
}
