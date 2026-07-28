/**
 * KBO Identity collection feature flag.
 *
 * KBO_IDENTITY_COLLECTION_ENABLED=true means:
 *   — KBO Identity 수집 CLI/Service 실행 허용
 *
 * Does NOT mean:
 *   — KBO Prediction 활성화
 *   — KBO Engine 활성화
 *   — KBO 공개 UI 활성화
 *   — KBO 상용 이용 승인
 *   — Engine Admission 승인
 *
 * Default: enabled (only explicit "false" blocks collection).
 */
export function isKboIdentityCollectionEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.KBO_IDENTITY_COLLECTION_ENABLED?.trim().toLowerCase();
  if (raw === "false") return false;
  return true;
}

export const KBO_IDENTITY_COLLECTION_DISABLED_CODE =
  "KBO_IDENTITY_COLLECTION_DISABLED" as const;

/**
 * KBO_IDENTITY_PROVIDER selects collection provider only.
 * It does NOT imply Prediction / Engine / public UI / legal approval.
 *
 * Default: API_BASEBALL (full-slate verified for 2026-07-28).
 */
export function getKboIdentityProvider(
  env: NodeJS.ProcessEnv = process.env,
): "API_BASEBALL" | "THESPORTSDB" {
  const raw = env.KBO_IDENTITY_PROVIDER?.trim().toUpperCase();
  if (raw === "THESPORTSDB") return "THESPORTSDB";
  return "API_BASEBALL";
}
