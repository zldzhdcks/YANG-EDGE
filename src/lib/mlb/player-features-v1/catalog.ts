import type { FeatureCatalogEntry } from "./types";

export const DEFERRED_FEATURES_V1: string[] = [
  "BULLPEN_INDIVIDUAL_PLAYER_FEATURES",
  "HARD_HIT_PCT",
  "BARREL_PCT",
  "EXIT_VELOCITY",
  "XWOBA_IF_UNBOUNDED",
  "BATTER_VS_EXACT_PITCHER_H2H",
  "PITCH_TYPE_BATTER_PERFORMANCE",
  "DEFENSIVE_METRICS",
  "WAR_BASED_PLAYER_STRENGTH",
  "INJURY_NUMERIC_PENALTY",
  "WEATHER_NUMERIC_ADJUSTMENT",
  "TRAVEL_NUMERIC_ADJUSTMENT",
  "WIN_PROBABILITY",
  "ARBITRARY_PLAYER_RATING_0_100",
  "PLAYER_STRENGTH_SCORE",
];

export const FEATURE_CATALOG_V1: FeatureCatalogEntry[] = [
  {
    featureId: "batter.identity",
    group: "BATTER",
    implemented: true,
    availability: "COLLECTED",
    notes:
      "playerId, playerName, bats, battingOrder, defensivePosition from PRE_GAME lineup identity only.",
  },
  {
    featureId: "batter.season_to_date_counts",
    group: "BATTER",
    implemented: true,
    availability: "COLLECTED",
    notes:
      "PA/AB/H/2B/3B/HR/BB/SO/TB from hitting gameLog filtered through D-1.",
  },
  {
    featureId: "batter.season_to_date_rates",
    group: "BATTER",
    implemented: true,
    availability: "COLLECTED",
    notes:
      "AVG/OBP/SLG/OPS/BABIP from the same D-1 counting window. ISO = SLG - AVG.",
  },
  {
    featureId: "batter.derived_k_bb_hr_rate",
    group: "BATTER",
    implemented: true,
    availability: "COLLECTED",
    notes: "K_RATE=SO/PA, BB_RATE=BB/PA, HR_RATE=HR/PA. PA=0 → null.",
  },
  {
    featureId: "batter.last_14_days",
    group: "BATTER",
    implemented: true,
    availability: "COLLECTED",
    notes:
      "Inclusive 14-day window ending D-1. Observed recent data, not form strength.",
  },
  {
    featureId: "batter.last_30_days",
    group: "BATTER",
    implemented: true,
    availability: "COLLECTED",
    notes: "Inclusive 30-day window ending D-1.",
  },
  {
    featureId: "batter.platoon_vs_lhp_rhp",
    group: "BATTER",
    implemented: true,
    availability: "NOT_PROVABLE",
    notes:
      "Split payload stored with PA. Season sitCodes without a date bound are NOT_PROVABLE. No numeric matchup adjustment.",
  },
  {
    featureId: "batter.woba_wrc_plus",
    group: "BATTER",
    implemented: false,
    availability: "NOT_COLLECTED",
    notes:
      "Sabermetrics not collected unless a bounded point-in-time request is proven.",
  },
  {
    featureId: "starter.identity",
    group: "STARTER",
    implemented: true,
    availability: "COLLECTED",
    notes: "probable/confirmed starter playerId, name, pitch hand, starterStatus.",
  },
  {
    featureId: "starter.season_to_date",
    group: "STARTER",
    implemented: true,
    availability: "COLLECTED",
    notes: "IP/ERA/WHIP/SO/BB/HR/BF from pitching gameLog through D-1.",
  },
  {
    featureId: "starter.derived_rates",
    group: "STARTER",
    implemented: true,
    availability: "COLLECTED",
    notes: "K_RATE=SO/BF, BB_RATE=BB/BF, K_MINUS_BB_RATE, HR9=(HR*9)/IP.",
  },
  {
    featureId: "starter.fip_xfip",
    group: "STARTER",
    implemented: false,
    availability: "NOT_COLLECTED",
    notes: "Advanced pitching saber not collected without bounded provenance.",
  },
  {
    featureId: "starter.pitch_arsenal",
    group: "STARTER",
    implemented: false,
    availability: "NOT_PROVABLE",
    notes:
      "pitchArsenal season blobs are not classified PRE_GAME_SAFE in v1.",
  },
  {
    featureId: "bullpen.player_features",
    group: "DATASET",
    implemented: false,
    availability: "NOT_COLLECTED",
    notes:
      "Bullpen individual player features are deferred. Dataset-level bullpenImplemented=false.",
  },
];
