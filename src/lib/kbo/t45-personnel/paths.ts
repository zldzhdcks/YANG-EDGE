import path from "node:path";

export function kboT45Paths(dateKst: string, cwd = process.cwd()) {
  const op = path.join(cwd, "data", "operator-input", "kbo");
  const research = path.join(cwd, "data", "research", "kbo");
  const audits = path.join(cwd, "data", "audits");
  const predictions = path.join(cwd, "data", "predictions", "kbo");
  return {
    operatorRoot: op,
    researchRoot: research,
    auditsRoot: audits,
    personnelInput: path.join(op, `${dateKst}-personnel-input-v1.json`),
    starterConfirmation: path.join(op, `${dateKst}-starter-confirmation-v1.json`),
    lineupConfirmation: path.join(op, `${dateKst}-lineup-confirmation-v1.json`),
    operatorMarkets: path.join(op, `${dateKst}-operator-markets-v2.json`),
    schedule: path.join(research, `${dateKst}-schedule-v1.json`),
    personnelSnapshot: path.join(research, `${dateKst}-personnel-snapshot-v1.json`),
    domesticProtoSnapshot: path.join(
      research,
      `${dateKst}-domestic-proto-snapshot-v1.json`,
    ),
    prediction: path.join(predictions, `${dateKst}.json`),
    workflowAudit: path.join(
      audits,
      `${dateKst}-kbo-t45-personnel-workflow-v1.json`,
    ),
  };
}

export function defaultPersonnelInputPath(
  dateKst: string,
  cwd = process.cwd(),
): string {
  return kboT45Paths(dateKst, cwd).personnelInput;
}
