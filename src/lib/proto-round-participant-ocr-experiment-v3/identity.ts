import { PILOT_COUNT, type FrozenIdentityV3, type PilotTruthV3 } from "./types";

export class ParticipantOcrExperimentV3Error extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = "ParticipantOcrExperimentV3Error";
    this.code = code;
  }
}

export function identityKey(sha: string, visualRowIndex: number): string {
  return `${sha}|${visualRowIndex}`;
}

export function assertPilot10Keys(
  discoveryRowKeys: FrozenIdentityV3[],
): FrozenIdentityV3[] {
  const keys = discoveryRowKeys.slice(0, PILOT_COUNT);
  if (keys.length !== PILOT_COUNT) {
    throw new ParticipantOcrExperimentV3Error(
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
      throw new ParticipantOcrExperimentV3Error(`PILOT_IDENTITY_INVALID:${i + 1}`);
    }
  }
  return keys;
}

export function selectPilot10Truth(input: {
  discoveryRowKeys: FrozenIdentityV3[];
  records: PilotTruthV3[];
}): PilotTruthV3[] {
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
      throw new ParticipantOcrExperimentV3Error(`PILOT_TRUTH_JOIN_FAILED:${i + 1}`);
    }
    if (
      truth.sourceImageSha256 !== key.sourceImageSha256 ||
      truth.visualRowIndex !== key.visualRowIndex
    ) {
      throw new ParticipantOcrExperimentV3Error(`PILOT_IDENTITY_MISMATCH:${i + 1}`);
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
    throw new ParticipantOcrExperimentV3Error("FRESH_VALIDATION_OCR_FORBIDDEN");
  }
}
