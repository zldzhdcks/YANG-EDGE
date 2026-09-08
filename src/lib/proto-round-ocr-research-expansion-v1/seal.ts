import { hashRowIdentity } from "./hash";
import {
  DISCOVERY2_COUNT,
  OCR_RESEARCH_EXPANSION_SCHEMA_VERSION,
  SOURCE_POOL_COUNT,
  SPLIT_ALGORITHM,
  SPLIT_SALT,
  VALIDATION2_COUNT,
  type ExpansionSplitSealV1,
  type ExpansionSplitV1,
} from "./types";

export function buildExpansionSplitSealV1(input: {
  protoRoundKey: string;
  split: ExpansionSplitV1;
}): ExpansionSplitSealV1 {
  return {
    schemaVersion: OCR_RESEARCH_EXPANSION_SCHEMA_VERSION,
    protoRoundKey: input.protoRoundKey,
    sourcePoolCount: SOURCE_POOL_COUNT,
    splitAlgorithm: SPLIT_ALGORITHM,
    splitSalt: SPLIT_SALT,
    discovery2Count: DISCOVERY2_COUNT,
    validation2Count: VALIDATION2_COUNT,
    SPLIT_MUTABLE: false,
    VALIDATION_2_VISUAL_RENDERED: false,
    VALIDATION_2_HUMAN_ANNOTATED: false,
    VALIDATION_2_USED_FOR_RULE_DESIGN: false,
    PILOT10_MUTATED: false,
    discovery2RowKeys: input.split.discovery2RowKeys.map((k) => ({
      sourceImageSha256: k.sourceImageSha256,
      visualRowIndex: k.visualRowIndex,
    })),
    validation2RowKeyHashes: input.split.validation2RowKeys.map(hashRowIdentity),
  };
}
