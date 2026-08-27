import {
  STAGE_F_B1_REL,
  STAGE_F_B1_SHA256,
  STAGE_F_B2_REL,
  STAGE_F_B2_SHA256,
  STAGE_F_C_REL,
  STAGE_F_C_SHA256,
  STAGE_F_CLOSE_REL,
  STAGE_F_DATE_KST,
  STAGE_F_E_REL,
  STAGE_F_E_SHA256,
  STAGE_F_SCOPE_REL,
  STAGE_F_SCOPE_SHA256,
  STAGE_F_SNAPSHOT_REL,
  STAGE_F_SNAPSHOT_SHA256,
} from "../stage-f-review-scorecard-v1/paths";

export const STAGE_G_DATE_KST = STAGE_F_DATE_KST;

export const STAGE_G_SCOPE_REL = STAGE_F_SCOPE_REL;
export const STAGE_G_SCOPE_SHA256 = STAGE_F_SCOPE_SHA256;
export const STAGE_G_B1_REL = STAGE_F_B1_REL;
export const STAGE_G_B1_SHA256 = STAGE_F_B1_SHA256;
export const STAGE_G_B2_REL = STAGE_F_B2_REL;
export const STAGE_G_B2_SHA256 = STAGE_F_B2_SHA256;
export const STAGE_G_C_REL = STAGE_F_C_REL;
export const STAGE_G_C_SHA256 = STAGE_F_C_SHA256;
export const STAGE_G_SNAPSHOT_REL = STAGE_F_SNAPSHOT_REL;
export const STAGE_G_SNAPSHOT_SHA256 = STAGE_F_SNAPSHOT_SHA256;
export const STAGE_G_E_REL = STAGE_F_E_REL;
export const STAGE_G_E_SHA256 = STAGE_F_E_SHA256;
export const STAGE_G_F_REL = STAGE_F_CLOSE_REL;

export const STAGE_G_F_SHA256 =
  "08bb1859ab46f0ec6a1f10e28163a4083ad1bec8266bcddde575ca45ee137683" as const;

export const STAGE_G_CLOSE_REL =
  "data/audits/2026-08-26-stage-g-daily-close-git-sync-v1.json" as const;

export const STAGE_G_PRIOR_DAILY_CLOSE_REL =
  "data/audits/2026-08-22-daily-close-v1.json" as const;

export const STAGE_G_REQUIRED_HEAD =
  "fc2f3591d8492f474cb56f55b6e188739aebfa8d" as const;

export const STAGE_G_F_PARENT =
  "ef5859abdb354f78a56c2ed158a40ab46694cc37" as const;

export const STAGE_G_A_COMMIT =
  "48ffb4cd6f3d20558f2011b28813a9c913620783" as const;
export const STAGE_G_B1_COMMIT =
  "e12edabe4b8c46eeab4653ff6426f799075b64fe" as const;
export const STAGE_G_B2_COMMIT =
  "3f1ef7ac014d8edb32edbca3d640b54ba4829108" as const;
export const STAGE_G_C_D_COMMIT =
  "2efa2c219b59ab797ec244e1319dffa9dc1d814a" as const;
export const STAGE_G_E_COMMIT = STAGE_G_F_PARENT;
export const STAGE_G_F_COMMIT = STAGE_G_REQUIRED_HEAD;
