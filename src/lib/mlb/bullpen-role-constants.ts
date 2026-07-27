/**
 * Bullpen Role Classifier v1.1 — 설명 가능한 상수.
 * 결과에 맞춘 threshold 튜닝 금지. Engine 미연결.
 */

export const BULLPEN_CLASSIFIER_VERSION = "bullpen-role-classifier-v1.1";
export const BULLPEN_SCHEMA_VERSION = "mlb-bullpen-role-dataset-v1.1";

/** slot0 이닝이 이 값 이상이면 traditional starter로 취급해 역할 feature에서 제외 */
export const TRADITIONAL_STARTER_MIN_OUTS = 9; // 3.0 IP

/** slot0 이닝이 이 값 미만이면 opener 후보 appearance로 유지 */
export const OPENER_MAX_OUTS_EXCLUSIVE = TRADITIONAL_STARTER_MIN_OUTS;

/** 표본 정책 */
export const SAMPLE_INSUFFICIENT_MAX = 2; // 0–2 → INSUFFICIENT_SAMPLE
export const SAMPLE_PROVISIONAL_MAX = 5; // 3–5 → PROVISIONAL
// 6+ → CLASSIFIED

/** primary 채택 최소 점수 */
export const PRIMARY_ROLE_MIN_SCORE = 2.0;

/** secondary: primary와 점수 차이가 이 값 이하이고 최소 점수 이상 */
export const SECONDARY_ROLE_MAX_SCORE_GAP = 1.5;
export const SECONDARY_ROLE_MIN_SCORE = 2.0;

/** CLOSER */
export const CLOSER_SAVE_RATE_MIN = 0.25;
export const CLOSER_SAVES_ABS_MIN = 3;
export const CLOSER_FINISH_RATE_MIN = 0.4;
export const CLOSER_LATE_CLOSE_RATE_MIN = 0.3;

/** SETUP */
export const SETUP_HOLD_RATE_MIN = 0.25;
export const SETUP_HOLDS_ABS_MIN = 3;
export const SETUP_INNING_CLOSE_RATE_MIN = 0.3;

/** HIGH_LEVERAGE */
export const HL_RATE_STRONG = 0.4;
export const HL_RATE_MODERATE = 0.3;
export const HL_MIN_SAMPLE_FOR_MODERATE = 4;

/** LONG — avgOuts 단독 금지 */
export const LONG_MULTI_INNING_RATE_MIN = 0.4; // outs>=6 비율
export const LONG_MEDIAN_OUTS_MIN = 5; // ≥1.2 IP median
export const LONG_EARLY_ENTRY_RATE_MIN = 0.35; // entry ≤ 5
export const LONG_HL_RATE_MAX = 0.35; // 고레버리지 낮을수록 LONG 가산

/** MIDDLE — 독립 score */
export const MIDDLE_ENTRY_INNING_MIN = 4;
export const MIDDLE_ENTRY_INNING_MAX = 7;
export const MIDDLE_TYPICAL_OUTS_MIN = 2;
export const MIDDLE_TYPICAL_OUTS_MAX = 5; // exclusive of long median band
export const MIDDLE_HL_RATE_MAX = 0.45;
export const MIDDLE_MOP_RATE_MAX = 0.35;

/** MOP_UP — MIDDLE과 분리 */
export const MOP_SCORE_DIFF_MIN = 4; // |entryScoreDiff| >= 4
export const MOP_RATE_MIN = 0.45;
export const MOP_MIN_SAMPLE = 3;

/** OPENER */
export const OPENER_SHORT_START_RATE_MIN = 0.5;
export const OPENER_MIN_SHORT_STARTS = 2;

/** confidence 표본 패널티 (PROVISIONAL) */
export const PROVISIONAL_CONFIDENCE_PENALTY = true;

export const MLB_STATS_SOURCE_LABEL = "INTERNAL_RESEARCH_ONLY" as const;
