/**
 * Research Framework v1 — 공통 Dataset 타입.
 *
 * Bullpen / Starter / Weather / Travel 등 모든 연구 Dataset이 공유한다.
 * Engine·weights·예측 런타임과 분리. 공개 UI 연결 금지.
 */

/** Dataset 수명주기 상태 (가설 status와 별개) */
export type ResearchDatasetStatus =
  | "NOT_STARTED"
  | "COLLECTING"
  | "PROMISING"
  | "VALIDATED"
  | "WEAK"
  | "REJECTED"
  | "SUPERSEDED"
  | "ARCHIVED";

/** 데이터 소스 법적/운영 표기 */
export type ResearchSourceLabel =
  | "API_BASEBALL_COMMERCIAL"
  | "THE_ODDS_API"
  | "INTERNAL_RESEARCH_ONLY"
  | "DERIVED_ONLY"
  | "OTHER_REVIEW_REQUIRED";

export type ResearchLeagueScope = "MLB" | "KBO" | "FOOTBALL" | "MULTI" | "NA";

/**
 * 버전 정책:
 * - schemaVersion: 저장 JSON 스키마 (breaking 시 major bump)
 * - classifierVersion / builderVersion: 파생 로직 버전
 * - frameworkVersion: 이 Framework 계약 버전
 */
export type ResearchVersionPolicy = {
  frameworkVersion: string;
  schemaVersion: string;
  builderVersion: string;
  /** semver-like: MAJOR.MINOR.PATCH — MAJOR = breaking schema */
  compatibility: "backward-compatible" | "breaking" | "experimental";
  notes?: string;
};

export type ResearchLegalMeta = {
  source: ResearchSourceLabel;
  publicRuntimeUseAllowed: false;
  commercialRuntimeUseAllowed: boolean;
  engineConnected: false;
  rawResponseInResearchCacheOnly: boolean;
  mlbHtmlCrawling: false;
  sportsDataIoScrambled: false;
};

export type ResearchDatasetMetadata = {
  datasetId: string;
  displayName: string;
  domain:
    | "bullpen"
    | "starter"
    | "lineup"
    | "weather"
    | "travel"
    | "market"
    | "umpire"
    | "other";
  league: ResearchLeagueScope;
  status: ResearchDatasetStatus;
  versions: ResearchVersionPolicy;
  legal: ResearchLegalMeta;
  /** 가설 Registry ID 목록 (H-…) */
  hypothesisIds: string[];
  /** 산출물 경로 (repo-relative) */
  artifactPaths: {
    dataset?: string;
    audit?: string;
    derivedCache?: string;
    scorecard?: string;
  };
  sample: {
    gradedGames?: number;
    rows?: number;
    uniqueEntities?: number;
    minimumSampleTarget: number;
  };
  createdAt: string | null;
  updatedAt: string | null;
  lastAuditedAt: string | null;
  notes?: string[];
};

/**
 * 모든 연구 Dataset JSON의 공통 envelope.
 * domain payload는 `records` / `games` 등 도메인 필드에 둔다.
 */
export type ResearchDatasetBase<TPayload extends object = Record<string, unknown>> =
  {
    meta: ResearchDatasetMetadata & {
      generatedAt: string;
      dateKst?: string;
      resultHashSha256: string | null;
      inputHashSha256?: string | null;
      predictionSnapshotsUntouched: true;
    };
    payload: TPayload;
  };

/** Registry에 등록되는 한 줄 */
export type ResearchDatasetRegistryEntry = {
  datasetId: string;
  status: ResearchDatasetStatus;
  schemaVersion: string;
  builderVersion: string;
  frameworkVersion: string;
  artifactDatasetPath: string | null;
  hypothesisIds: string[];
  engineAdmission: "PROHIBITED" | "CANDIDATE" | "APPROVED";
  notes?: string;
};
