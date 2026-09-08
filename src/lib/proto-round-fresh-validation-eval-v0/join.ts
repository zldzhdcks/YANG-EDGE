import { FreshValidationEvalV0Error, rowIdentityKey } from "./identity";
import { assertNoDuplicateIdentities } from "./validate";
import { SELECTED_ROW_COUNT, type FreshEvalRowKeyV0 } from "./types";

export function joinFrozenFreshIdentities<H, M>(input: {
  selectionKeys: FreshEvalRowKeyV0[];
  humanRecords: Array<H & FreshEvalRowKeyV0>;
  machineRows: Array<M & FreshEvalRowKeyV0>;
}): Array<{
  key: FreshEvalRowKeyV0;
  human: H & FreshEvalRowKeyV0;
  machine: M & FreshEvalRowKeyV0;
}> {
  if (input.selectionKeys.length !== SELECTED_ROW_COUNT) {
    throw new FreshValidationEvalV0Error("SELECTION_COUNT_MISMATCH");
  }
  assertNoDuplicateIdentities(input.selectionKeys);
  assertNoDuplicateIdentities(input.humanRecords);
  assertNoDuplicateIdentities(input.machineRows);

  const selectionIds = new Set(input.selectionKeys.map(rowIdentityKey));
  const humanById = new Map(
    input.humanRecords.map((row) => [rowIdentityKey(row), row]),
  );
  const machineById = new Map(
    input.machineRows.map((row) => [rowIdentityKey(row), row]),
  );
  for (const row of input.humanRecords) {
    if (!selectionIds.has(rowIdentityKey(row))) {
      throw new FreshValidationEvalV0Error("EXTRA_HUMAN_IDENTITY");
    }
  }
  for (const row of input.machineRows) {
    if (!selectionIds.has(rowIdentityKey(row))) {
      throw new FreshValidationEvalV0Error("EXTRA_MACHINE_IDENTITY");
    }
  }

  const joined = [];
  for (const key of input.selectionKeys) {
    const id = rowIdentityKey(key);
    const human = humanById.get(id);
    const machine = machineById.get(id);
    if (!human) throw new FreshValidationEvalV0Error("MISSING_HUMAN_IDENTITY");
    if (!machine) throw new FreshValidationEvalV0Error("MISSING_MACHINE_ROW");
    if (
      human.sourceImageSha256 !== key.sourceImageSha256 ||
      human.visualRowIndex !== key.visualRowIndex ||
      machine.sourceImageSha256 !== key.sourceImageSha256 ||
      machine.visualRowIndex !== key.visualRowIndex
    ) {
      throw new FreshValidationEvalV0Error("IDENTITY_MUTATED");
    }
    joined.push({ key, human, machine });
  }
  return joined;
}
