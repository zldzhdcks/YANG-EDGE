import {
  STAGE_E_B1_REL,
  STAGE_E_C_RECONCILIATION_REL,
  STAGE_E_C_RECONCILIATION_SHA256,
  STAGE_E_CLOSE_REL,
  STAGE_E_DATE_KST,
  STAGE_E_SNAPSHOT_REL,
  STAGE_E_SNAPSHOT_SHA256,
} from "../stage-e-result-grade-v1/paths";

export const STAGE_F_DATE_KST = STAGE_E_DATE_KST;

export const STAGE_F_SCOPE_REL =
  "data/audits/2026-08-26-daily-scope-lock-v1.json" as const;

export const STAGE_F_SCOPE_SHA256 =
  "97d04ce464c6e062264f20ea3de323a3e60eeac2e410c9ed6cf59c77d8a6c501" as const;

export const STAGE_F_B1_REL = STAGE_E_B1_REL;

export const STAGE_F_B1_SHA256 =
  "405c7f659edc21c9330d65c1bb61289776f8fd4e369b24a07101032105dd20b5" as const;

export const STAGE_F_B2_REL =
  "data/audits/2026-08-26-pregame-input-odds-coverage-v1.json" as const;

export const STAGE_F_B2_SHA256 =
  "8bea8a2890dd6f62adb490a362daea0edc3b505649e768de5bf10a64382c7d0e" as const;

export const STAGE_F_C_REL = STAGE_E_C_RECONCILIATION_REL;
export const STAGE_F_C_SHA256 = STAGE_E_C_RECONCILIATION_SHA256;

export const STAGE_F_SNAPSHOT_REL = STAGE_E_SNAPSHOT_REL;
export const STAGE_F_SNAPSHOT_SHA256 = STAGE_E_SNAPSHOT_SHA256;

export const STAGE_F_E_REL = STAGE_E_CLOSE_REL;

export const STAGE_F_E_SHA256 =
  "0a81f3a2b05c67851593491ed8dc683e05b836c6da3e354c1204c62d15875ec3" as const;

export const STAGE_F_CLOSE_REL =
  "data/audits/2026-08-26-stage-f-success-failure-review-scorecard-v1.json" as const;

export const STAGE_F_PRIOR_DAILY_CLOSE_REL =
  "data/audits/2026-08-22-stage-f-review-close-v1.json" as const;
