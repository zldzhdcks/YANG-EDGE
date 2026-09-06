import type {
  ProtoRoundLocalOcrExtractResult,
  ProtoRoundLocalOcrProvider,
} from "./types";

export function createMockLocalOcrProvider(spec: {
  providerVersion?: string;
  languages?: string[];
  extract: (
    imagePath: string,
  ) =>
    | ProtoRoundLocalOcrExtractResult
    | Promise<ProtoRoundLocalOcrExtractResult>;
}): ProtoRoundLocalOcrProvider {
  return {
    providerKind: "MOCK",
    providerVersion: spec.providerVersion ?? "mock-v0",
    languages: spec.languages ?? ["und"],
    extract: async (imagePath) => spec.extract(imagePath),
  };
}
