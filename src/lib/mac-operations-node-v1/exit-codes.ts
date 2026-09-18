/**
 * Mac operations node v1 — exit codes for launchd.
 * Documented constants only. No magic numbers at call sites.
 */
export const MAC_OPS_EXIT = {
  HEALTHY: 0,
  PREREQUISITE_BLOCKED: 10,
  DUPLICATE_TICK: 20,
  EXECUTION_FAILURE: 30,
  CONFIG_FAILURE: 40,
} as const;

export type MacOpsExitCode = (typeof MAC_OPS_EXIT)[keyof typeof MAC_OPS_EXIT];

export const MAC_OPS_EXIT_REASON = {
  0: "HEALTHY_TICK",
  10: "PREREQUISITE_BLOCKED",
  20: "DUPLICATE_TICK",
  30: "EXECUTION_FAILURE",
  40: "CONFIG_FAILURE",
} as const;
