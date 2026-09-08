import { PILOT_COUNT, type FrozenIdentityV1, type PilotTruthV1 } from "./types";

export class OcrRecoveryExperimentError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "OcrRecoveryExperimentError";
    this.code = code;
  }
}

export function identityKey(sha: string, visualRowIndex: number): string {
  return `${sha}|${visualRowIndex}`;
}

export function assertPilot10Keys(
  discoveryRowKeys: FrozenIdentityV1[],
): FrozenIdentityV1[] {
  const keys = discoveryRowKeys.slice(0, PILOT_COUNT);
  if (keys.length !== PILOT_COUNT) {
    throw new OcrRecoveryExperimentError(
      `PILOT_KEYS_UNEXPECTED:${keys.length}`,
    );
  }
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!;
    if (
      typeof k.sourceImageSha256 !== "string" ||
      k.sourceImageSha256.length === 0 ||
      !Number.isInteger(k.visualRowIndex) ||
      k.visualRowIndex < 0
    ) {
      throw new OcrRecoveryExperimentError(`PILOT_IDENTITY_INVALID:${i + 1}`);
    }
  }
  return keys;
}

export function selectPilot10Truth(input: {
  discoveryRowKeys: FrozenIdentityV1[];
  records: PilotTruthV1[];
}): PilotTruthV1[] {
  const keys = assertPilot10Keys(input.discoveryRowKeys);
  const byId = new Map(
    input.records.map((r) => [
      identityKey(r.sourceImageSha256, r.visualRowIndex),
      r,
    ]),
  );
  return keys.map((key, i) => {
    const truth = byId.get(
      identityKey(key.sourceImageSha256, key.visualRowIndex),
    );
    if (!truth) {
      throw new OcrRecoveryExperimentError(`PILOT_TRUTH_JOIN_FAILED:${i + 1}`);
    }
    if (
      truth.sourceImageSha256 !== key.sourceImageSha256 ||
      truth.visualRowIndex !== key.visualRowIndex
    ) {
      throw new OcrRecoveryExperimentError(`PILOT_IDENTITY_MISMATCH:${i + 1}`);
    }
    return {
      sourceImageSha256: truth.sourceImageSha256,
      visualRowIndex: truth.visualRowIndex,
      annotationStatus: truth.annotationStatus,
      participantLeftRaw: truth.participantLeftRaw,
      participantRightRaw: truth.participantRightRaw,
      numericCellsRaw: Array.isArray(truth.numericCellsRaw)
        ? [...truth.numericCellsRaw]
        : [],
    };
  });
}

export function assertShaNotFresh(
  sourceImageSha256: string,
  freshSha256: ReadonlySet<string>,
): void {
  if (freshSha256.has(sourceImageSha256)) {
    throw new OcrRecoveryExperimentError("FRESH_VALIDATION_OCR_FORBIDDEN");
  }
}
