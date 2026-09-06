export class GroundTruthError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "GroundTruthError";
    this.code = code;
  }
}
