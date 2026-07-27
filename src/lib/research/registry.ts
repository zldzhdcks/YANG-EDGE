/**
 * Research Framework v1 — Dataset Registry.
 * 등록만 하며 도메인 분류 로직을 실행하지 않는다.
 */
import { RESEARCH_FRAMEWORK_VERSION } from "./hash";
import type {
  ResearchDatasetMetadata,
  ResearchDatasetRegistryEntry,
  ResearchDatasetStatus,
} from "./types";

export const RESEARCH_DATASET_REGISTRY: ResearchDatasetRegistryEntry[] = [
  {
    datasetId: "mlb-bullpen-role",
    status: "COLLECTING",
    schemaVersion: "mlb-bullpen-role-dataset-v1.1",
    builderVersion: "bullpen-role-classifier-v1.1",
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    artifactDatasetPath:
      "data/research/mlb/2026-07-27-bullpen-role-dataset-v1_1.json",
    hypothesisIds: [
      "H-BP-ROLE-001",
      "H-BP-ROLE-002",
      "H-BP-ROLE-003",
      "H-BP-ROLE-004",
      "H-BP-ROLE-005",
    ],
    engineAdmission: "PROHIBITED",
    notes:
      "v1.1 classifier registered under Framework; logic lives in src/lib/mlb/* (unchanged by Framework).",
  },
  {
    datasetId: "mlb-starter",
    status: "COLLECTING",
    schemaVersion: "mlb-starter-dataset-v1",
    builderVersion: "starter-dataset-builder-v1",
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    artifactDatasetPath:
      "data/research/mlb/2026-07-27-starter-dataset-v1.json",
    hypothesisIds: ["H-ST-001", "H-ST-002", "H-ST-003", "H-ST-004"],
    engineAdmission: "PROHIBITED",
    notes:
      "Starter Dataset v1 collecting probable pre-game freezes. No Score/Engine. Adapter only.",
  },
  {
    datasetId: "mlb-lineup",
    status: "COLLECTING",
    schemaVersion: "mlb-lineup-dataset-v1",
    builderVersion: "lineup-dataset-builder-v1",
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    artifactDatasetPath:
      "data/research/mlb/2026-07-27-lineup-dataset-v1.json",
    hypothesisIds: ["H-LU-001", "H-LU-002", "H-LU-003"],
    engineAdmission: "PROHIBITED",
    notes:
      "Lineup Dataset v1 collecting post-game actual lineups only. Framework adapter only; builder independent of Framework.",
  },
  {
    datasetId: "mlb-weather",
    status: "NOT_STARTED",
    schemaVersion: "mlb-weather-dataset-v0",
    builderVersion: "not-implemented",
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    artifactDatasetPath: null,
    hypothesisIds: [],
    engineAdmission: "PROHIBITED",
  },
  {
    datasetId: "mlb-travel",
    status: "NOT_STARTED",
    schemaVersion: "mlb-travel-dataset-v0",
    builderVersion: "not-implemented",
    frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
    artifactDatasetPath: null,
    hypothesisIds: [],
    engineAdmission: "PROHIBITED",
  },
];

export function getRegistryEntry(
  datasetId: string,
): ResearchDatasetRegistryEntry | undefined {
  return RESEARCH_DATASET_REGISTRY.find((e) => e.datasetId === datasetId);
}

export function listDatasetsByStatus(
  status: ResearchDatasetStatus,
): ResearchDatasetRegistryEntry[] {
  return RESEARCH_DATASET_REGISTRY.filter((e) => e.status === status);
}

/** Bullpen v1.1 → Framework metadata 매핑 예시 (로직 미실행) */
export function bullpenV11FrameworkMetadata(
  overrides?: Partial<ResearchDatasetMetadata>,
): ResearchDatasetMetadata {
  const entry = getRegistryEntry("mlb-bullpen-role")!;
  return {
    datasetId: entry.datasetId,
    displayName: "MLB Bullpen Role Dataset",
    domain: "bullpen",
    league: "MLB",
    status: entry.status,
    versions: {
      frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
      schemaVersion: entry.schemaVersion,
      builderVersion: entry.builderVersion,
      compatibility: "backward-compatible",
      notes: "v1 frozen; v1.1 current research classifier",
    },
    legal: {
      source: "INTERNAL_RESEARCH_ONLY",
      publicRuntimeUseAllowed: false,
      commercialRuntimeUseAllowed: false,
      engineConnected: false,
      rawResponseInResearchCacheOnly: true,
      mlbHtmlCrawling: false,
      sportsDataIoScrambled: false,
    },
    hypothesisIds: entry.hypothesisIds,
    artifactPaths: {
      dataset: entry.artifactDatasetPath ?? undefined,
      audit: "data/audits/2026-07-27-bullpen-role-v1_1-audit.json",
      derivedCache: "data/cache/research/mlb/derived/bullpen/",
    },
    sample: {
      gradedGames: 14,
      minimumSampleTarget: 100,
    },
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: null,
    lastAuditedAt: null,
    notes: [
      "Framework adapter only — does not re-run bullpen classifier.",
      "Engine admission remains PROHIBITED.",
    ],
    ...overrides,
  };
}

/** Starter Dataset v1 → Framework metadata 매핑 (도메인 builder 비의존) */
export function starterV1FrameworkMetadata(
  overrides?: Partial<ResearchDatasetMetadata>,
): ResearchDatasetMetadata {
  const entry = getRegistryEntry("mlb-starter")!;
  return {
    datasetId: entry.datasetId,
    displayName: "MLB Starter Dataset",
    domain: "starter",
    league: "MLB",
    status: entry.status,
    versions: {
      frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
      schemaVersion: entry.schemaVersion,
      builderVersion: entry.builderVersion,
      compatibility: "experimental",
      notes: "v1 probable-only freeze; no Starter Score",
    },
    legal: {
      source: "INTERNAL_RESEARCH_ONLY",
      publicRuntimeUseAllowed: false,
      commercialRuntimeUseAllowed: false,
      engineConnected: false,
      rawResponseInResearchCacheOnly: true,
      mlbHtmlCrawling: false,
      sportsDataIoScrambled: false,
    },
    hypothesisIds: entry.hypothesisIds,
    artifactPaths: {
      dataset: entry.artifactDatasetPath ?? undefined,
      audit: "data/audits/2026-07-27-starter-dataset-v1-audit.json",
      derivedCache: "data/cache/research/mlb/derived/starter/",
    },
    sample: {
      minimumSampleTarget: 100,
    },
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: null,
    lastAuditedAt: null,
    notes: [
      "Framework adapter only — domain builder does not import Framework.",
      "Engine admission remains PROHIBITED.",
      "Probable ≠ confirmed. No QS. No live season without as-of.",
    ],
    ...overrides,
  };
}

/** Lineup Dataset v1 → Framework metadata 매핑 (도메인 builder 비의존) */
export function lineupV1FrameworkMetadata(
  overrides?: Partial<ResearchDatasetMetadata>,
): ResearchDatasetMetadata {
  const entry = getRegistryEntry("mlb-lineup")!;
  return {
    datasetId: entry.datasetId,
    displayName: "MLB Lineup Dataset",
    domain: "lineup",
    league: "MLB",
    status: entry.status,
    versions: {
      frameworkVersion: RESEARCH_FRAMEWORK_VERSION,
      schemaVersion: entry.schemaVersion,
      builderVersion: entry.builderVersion,
      compatibility: "experimental",
      notes: "v1 post-game actual only; pre-game NOT_COLLECTED; no Lineup Score",
    },
    legal: {
      source: "INTERNAL_RESEARCH_ONLY",
      publicRuntimeUseAllowed: false,
      commercialRuntimeUseAllowed: false,
      engineConnected: false,
      rawResponseInResearchCacheOnly: true,
      mlbHtmlCrawling: false,
      sportsDataIoScrambled: false,
    },
    hypothesisIds: entry.hypothesisIds,
    artifactPaths: {
      dataset: entry.artifactDatasetPath ?? undefined,
      audit: "data/audits/2026-07-27-lineup-dataset-v1-audit.json",
      derivedCache: "data/cache/research/mlb/derived/lineup/",
    },
    sample: {
      minimumSampleTarget: 100,
    },
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: null,
    lastAuditedAt: null,
    notes: [
      "Framework adapter only — domain builder does not import Framework.",
      "Engine admission remains PROHIBITED.",
      "Post-game actual only. Never backfill pre-game from boxscore.",
    ],
    ...overrides,
  };
}
